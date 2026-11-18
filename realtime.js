const kickDanmakuApi = "https://web.kick.com/api/v1/realtime";

function kickDanmakuJson(text) {
  if (typeof text !== "string") return text;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function kickDanmakuId(value) {
  if (typeof value === "string" && value.trim()) return value;
  return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
}

function kickDanmakuEvent(publication) {
  const envelope = kickDanmakuJson(publication?.data);
  const name = envelope?.event ?? publication?.tags?.event;
  const event = typeof name === "string" ? name.split("\\").at(-1) : "";
  const data = kickDanmakuJson(envelope?.data);
  if (event === "ChatroomClearEvent") return { type: "clear" };
  if (!data || typeof data !== "object") return null;
  if (event === "MessageDeletedEvent") {
    const id = kickDanmakuId(data.message?.id ?? data.message_id ?? data.id);
    return id ? { type: "delete", id } : null;
  }
  if (event !== "ChatMessageEvent") return null;
  const id = kickDanmakuId(data.id);
  const content = typeof data.content === "string" ? data.content.trim() : "";
  if (!id || !content || data.deleted_at || data.deleted || data.is_deleted) return null;
  if (/^\[?\(?\s*(?:message\s+)?deleted by (?:a )?mod(?:erator)?\s*[.!]?\s*\)?\]?$/i.test(content)) return null;
  return {
    type: "message", id, content,
    username: typeof data.sender?.username === "string" ? data.sender.username : "",
    createdAt: Date.parse(data.created_at),
  };
}

async function kickDanmakuRequest(url, signal, body) {
  const options = { signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]), credentials: "omit" };
  if (body) {
    options.method = "POST";
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(body);
  }
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

class KickDanmakuRealtime {
  constructor(slug, onEvent, onStatus) {
    this.slug = slug;
    this.onEvent = onEvent;
    this.onStatus = onStatus;
    this.abort = new AbortController();
    this.retryDelay = 1000;
    this.connect();
  }

  stop() {
    this.abort.abort();
    clearTimeout(this.retryTimer);
    this.endSocket?.();
  }

  retry(httpOrSocketError = "") {
    if (this.abort.signal.aborted) return;
    this.onStatus("retry", httpOrSocketError);
    this.retryTimer = setTimeout(() => this.connect(), this.retryDelay * (1 + Math.random() * 0.25));
    this.retryDelay = Math.min(this.retryDelay * 2, 30000);
  }

  async connect() {
    const { signal } = this.abort;
    this.onStatus("connecting");
    try {
      if (!this.room) {
        const channel = await kickDanmakuRequest(`/api/v2/channels/${this.slug}`, signal);
        const id = kickDanmakuId(channel.id);
        const room = kickDanmakuId(channel.chatroom?.id);
        if (!/^\d+$/.test(id ?? "") || !/^\d+$/.test(room ?? "")) throw new Error("找不到聊天室");
        this.channelId = id;
        this.room = `chatrooms.${room}.v2`;
      }
      const clientId = crypto.randomUUID();
      const getToken = async () => {
        const auth = await kickDanmakuRequest(`${kickDanmakuApi}/auth/connection`, signal, { client_id: clientId });
        const token = auth.data?.token;
        if (typeof token !== "string" || !token) throw new Error("缺少访客令牌");
        return token;
      };
      const [server, token] = await Promise.all([
        kickDanmakuRequest(`${kickDanmakuApi}/channels/${this.channelId}/chat/connection`, signal, {
          client: { id: clientId, type: "web" },
          capabilities: { accepted_providers: [{ provider: "centrifugo" }] },
        }),
        getToken(),
      ]);
      if (signal.aborted) return;
      const endpoint = server.data?.connections?.find(entry => entry.provider === "centrifugo")?.credentials?.url;
      const url = endpoint ? new URL(endpoint) : null;
      if (url?.protocol !== "wss:" || !/^realtime\.[a-z0-9-]+\.platform\.kick\.com$/.test(url.hostname)) {
        throw new Error("Kick 未返回实时聊天地址");
      }
      this.openSocket(url, token, getToken);
    } catch (error) {
      this.retry(error.message);
    }
  }

  openSocket(url, token, getToken) {
    const ws = new WebSocket(url);
    let subscribed = false;
    let pong = false;
    let heartbeatMs = 0;
    let heartbeatTimer;
    let refreshTimer;
    let commandTimer;
    let ended = false;
    const finish = (reason) => {
      if (ended) return;
      ended = true;
      clearTimeout(heartbeatTimer);
      clearTimeout(refreshTimer);
      clearTimeout(commandTimer);
      this.endSocket = null;
      ws.close();
      this.retry(reason);
    };
    this.endSocket = finish;
    const commandTimeout = () => {
      clearTimeout(commandTimer);
      commandTimer = setTimeout(() => finish("实时聊天响应超时"), 12000);
    };
    const resetHeartbeat = () => {
      clearTimeout(heartbeatTimer);
      if (heartbeatMs) heartbeatTimer = setTimeout(() => finish("实时聊天连接超时"), heartbeatMs);
    };
    const scheduleRefresh = (result) => {
      clearTimeout(refreshTimer);
      if (!result.expires || !(result.ttl > 0)) return;
      refreshTimer = setTimeout(async () => {
        try {
          const nextToken = await getToken();
          if (ended || ws.readyState !== WebSocket.OPEN) return;
          ws.send(JSON.stringify({ id: 3, refresh: { token: nextToken } }));
          commandTimeout();
        } catch {
          finish("访客令牌续期失败");
        }
      }, Math.max(1000, result.ttl * 1000 - 60000));
    };
    commandTimeout();
    ws.addEventListener("open", () => {
      if (ended) return;
      ws.send(JSON.stringify({ id: 1, connect: { token, name: "js" } }));
      commandTimeout();
    });
    ws.addEventListener("message", ({ data }) => {
      if (ended || typeof data !== "string") return;
      resetHeartbeat();
      for (const line of data.split("\n")) {
        if (ended) break;
        const packet = kickDanmakuJson(line);
        if (!packet || typeof packet !== "object") continue;
        if (Object.keys(packet).length === 0 && pong) ws.send("{}");
        if (packet.error) {
          finish(`实时聊天错误 ${packet.error.code ?? ""}`.trim());
          continue;
        }
        if (packet.id === 1 && packet.connect) {
          pong = packet.connect.pong === true;
          heartbeatMs = packet.connect.ping > 0 ? packet.connect.ping * 1000 + 12000 : 0;
          resetHeartbeat();
          scheduleRefresh(packet.connect);
          ws.send(JSON.stringify({ id: 2, subscribe: { channel: this.room } }));
          commandTimeout();
        } else if (packet.id === 2 && packet.subscribe) {
          clearTimeout(commandTimer);
          subscribed = true;
          this.retryDelay = 1000;
          this.onStatus("live");
        } else if (packet.id === 3 && packet.refresh) {
          clearTimeout(commandTimer);
          scheduleRefresh(packet.refresh);
        }
        if (packet.push?.disconnect || (packet.push?.channel === this.room && packet.push.unsubscribe)) {
          finish("实时聊天订阅已断开");
        }
        if (subscribed && packet.push?.channel === this.room && !ended) {
          const event = kickDanmakuEvent(packet.push.pub);
          if (event) this.onEvent(event);
        }
      }
    });
    ws.addEventListener("close", ({ code }) => finish(`连接已关闭 (${code})`));
    ws.addEventListener("error", () => finish("WebSocket 连接失败"));
  }
}
