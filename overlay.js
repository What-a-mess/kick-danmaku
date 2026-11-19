(() => {
  if (!kickDanmakuPageActive) return;
  const maxAge = 2200;
  const moderationDelay = 450;
  const layer = document.createElement("div");
  layer.id = "kick-danmaku-overlay";
  layer.setAttribute("aria-hidden", "true");

  let settings = kickDanmakuSettings();
  let blocked = [];
  let loaded = false;
  let channel = "";
  let realtime;
  let status = { state: "idle", detail: "" };
  let cutoff = 0;
  let video;
  let width = 0;
  let height = 0;
  let lanes = [];
  let queue = [];
  const active = new Map();
  const seen = new Map();

  function removeMessage(id) {
    const item = active.get(id);
    if (!item) return;
    active.delete(id);
    item.animation.cancel();
    item.node.remove();
    if (item.lane.tail === item) item.lane.tail = null;
  }

  function clearActive() {
    for (const id of active.keys()) removeMessage(id);
    lanes = [];
  }

  function clearOverlay() {
    clearActive();
    queue = [];
  }

  function currentChannel() {
    return location.pathname.match(/^\/([a-z0-9_-]+)\/?$/i)?.[1].toLowerCase() ?? "";
  }

  function visibleVideo(root) {
    const player = root.querySelector("video#video-player, #video-player video");
    if (player?.getBoundingClientRect().width > 120) return player;
    return [...root.querySelectorAll("video")]
      .map(node => ({ node, rect: node.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 240 && rect.height > 135)
      .sort((a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height)[0]?.node;
  }

  function syncPlayer() {
    const fullscreen = document.fullscreenElement;
    const scope = fullscreen ?? document;
    if (!video?.isConnected || !scope.contains(video) || video.clientWidth <= 120) {
      video = visibleVideo(scope);
    }
    // A bare fullscreen <video> cannot paint DOM children. Kick's player button
    // fullscreens the player container, which can host the overlay.
    if (!video || fullscreen instanceof HTMLVideoElement || video === document.pictureInPictureElement) {
      layer.remove();
      return;
    }
    const rect = video.getBoundingClientRect();
    if (rect.width <= 120 || rect.height <= 70 || rect.bottom <= 0 || rect.right <= 0 ||
        rect.top >= innerHeight || rect.left >= innerWidth) {
      layer.remove();
      return;
    }
    const previousWidth = width;
    width = Math.round(rect.width);
    height = Math.round(rect.height);
    // Kick puts its video wrapper in fullscreen. Keeping the overlay in that
    // wrapper lets the same elements stay connected across the transition.
    const wrapper = video.matches("#video-player") && video.closest("#injected-channel-player")
      ? video.parentElement : null;
    const anchored = wrapper && (!fullscreen || fullscreen.contains(wrapper));
    const host = anchored ? wrapper : fullscreen ?? document.body;
    if (layer.parentNode !== host) host.append(layer);
    const origin = anchored ? host.getBoundingClientRect() : { left: 0, top: 0 };
    layer.style.position = anchored ? "absolute" : "fixed";
    layer.style.left = `${Math.round(rect.left - origin.left)}px`;
    layer.style.top = `${Math.round(rect.top - origin.top)}px`;
    layer.style.width = `${width}px`;
    layer.style.height = `${height}px`;
    const laneCount = Math.max(1, Math.floor((height * settings.area / 100 - 10) / laneHeight()));
    if (lanes.length > laneCount) {
      const removedLanes = new Set(lanes.splice(laneCount));
      for (const [id, item] of active) if (removedLanes.has(item.lane)) removeMessage(id);
    }
    while (lanes.length < laneCount) lanes.push({ tail: null });
    if (previousWidth !== width) {
      for (const item of active.values()) updateMotion(item);
    }
  }

  function laneHeight() {
    return Math.ceil(settings.size * 1.35) + 5;
  }

  function remember(id) {
    if (seen.has(id)) seen.delete(id);
    seen.set(id, true);
    if (seen.size > 3000) seen.delete(seen.keys().next().value);
  }

  function isBlocked(message) {
    const normalized = kickDanmakuFilter(message.content);
    return blocked.some(word => normalized.includes(word));
  }

  function onEvent(event) {
    if (event.type === "clear") {
      cutoff = Date.now();
      clearOverlay();
      return;
    }
    if (event.type === "delete") {
      remember(event.id);
      queue = queue.filter(message => message.id !== event.id);
      removeMessage(event.id);
      return;
    }
    if (seen.has(event.id) || (Number.isFinite(event.createdAt) && event.createdAt < cutoff)) return;
    remember(event.id);
    if (document.hidden || isBlocked(event)) return;
    queue.push({ ...event, receivedAt: performance.now() });
    if (queue.length > 32) queue.shift();
  }

  function isOwnMessage(username) {
    if (!username) return false;
    const accounts = document.querySelectorAll('nav button[aria-haspopup="menu"][aria-label]');
    for (const button of accounts) {
      const name = button.getAttribute("aria-label").trim().toLowerCase();
      const avatar = button.querySelector("img[alt]")?.alt.trim().toLowerCase();
      if (name && name === avatar) return name === username.trim().toLowerCase();
    }
    return false;
  }

  function createMessage(message) {
    const node = document.createElement("span");
    node.className = "kick-danmaku-message";
    node.style.fontWeight = settings.fontWeight;
    if (settings.highlightOwn && isOwnMessage(message.username)) {
      node.classList.add("kick-danmaku-own-message");
    }
    if (settings.showName && message.username) node.append(`${message.username}: `);
    const parts = message.content.split(/\[emote:(\d+):([^\]\r\n]+)\]/g);
    node.append(parts[0]);
    for (let index = 1; index < parts.length; index += 3) {
      const img = document.createElement("img");
      img.src = `https://files.kick.com/emotes/${parts[index]}/fullsize`;
      img.alt = parts[index + 1];
      img.referrerPolicy = "no-referrer";
      node.append(img, parts[index + 2]);
    }
    return node;
  }

  function updateMotion(item) {
    const nodeWidth = Math.ceil(item.node.getBoundingClientRect().width);
    const distance = width + nodeWidth;
    const duration = distance / settings.speed * 1000;
    const keyframes = [{ transform: "translateX(0)" }, { transform: `translateX(-${distance}px)` }];
    if (item.animation) {
      // Updating the end point and duration together preserves pixels per
      // second and the distance this message has traveled from the right edge.
      item.animation.effect.setKeyframes(keyframes);
      item.animation.effect.updateTiming({ duration });
    } else {
      item.animation = item.node.animate(keyframes, { duration, fill: "both" });
    }
    item.entryTime = (nodeWidth + 28) / settings.speed * 1000;
  }

  function launch(message, lane, index) {
    const node = createMessage(message);
    node.style.top = `${10 + index * laneHeight()}px`;
    layer.append(node);
    const item = { node, lane, message };
    updateMotion(item);
    lane.tail = item;
    active.set(message.id, item);
    item.animation.onfinish = () => removeMessage(message.id);
  }

  function tick() {
    if (!loaded) return;
    const slug = settings.enabled ? currentChannel() : "";
    if (slug !== channel) {
      realtime?.stop();
      realtime = undefined;
      channel = slug;
      video = undefined;
      cutoff = Date.now() - 2000;
      seen.clear();
      clearOverlay();
      layer.remove();
    }
    if (!channel) return;
    syncPlayer();
    if (video && !realtime) {
      realtime = new KickDanmakuRealtime(channel, event => {
        if (currentChannel() === slug) onEvent(event);
      }, (state, detail) => {
        status = { state, detail };
      });
    }
    if (document.hidden) {
      clearOverlay();
      return;
    }
    const now = performance.now();
    while (queue.length && now - queue[0].receivedAt > maxAge) queue.shift();
    // Launch at most one per tick even if a burst arrives on an empty screen.
    if (!layer.isConnected || !queue.length || now - queue[0].receivedAt < moderationDelay) return;
    const index = lanes.findIndex(({ tail }) => !tail || tail.animation.currentTime >= tail.entryTime);
    if (index !== -1) launch(queue.shift(), lanes[index], index);
  }

  function applySettings(value) {
    const previous = settings;
    settings = kickDanmakuSettings(value);
    blocked = kickDanmakuFilter(settings.blocked).split(/[\r\n,，]+/).map(word => word.trim()).filter(Boolean);
    layer.style.fontFamily = kickDanmakuFonts[settings.font];
    layer.style.fontSize = `${settings.size}px`;
    layer.style.fontWeight = settings.fontWeight;
    layer.style.color = settings.color;
    layer.style.opacity = settings.opacity / 100;
    if (["size", "speed", "font", "fontWeight", "area", "showName", "highlightOwn"].some(key => previous[key] !== settings[key])) {
      clearActive();
    }
    if (previous.blocked !== settings.blocked) {
      queue = queue.filter(message => !isBlocked(message));
      for (const [id, item] of active) if (isBlocked(item.message)) removeMessage(id);
    }
    loaded = true;
    tick();
  }

  kickDanmakuStore.subscribe(applySettings);
  kickDanmakuStore.get().then(danmaku => {
    if (!loaded) applySettings(danmaku);
  }).catch(() => {
    if (!loaded) applySettings();
  });
  kickDanmakuGetStatus = () => !settings.enabled ? { state: "disabled" } : realtime ? status : { state: "idle" };
  if (!kickDanmakuUserscript) {
    chrome.runtime.onMessage.addListener((message, _sender, reply) => {
      if (message?.type === "kick-danmaku-status") reply(kickDanmakuGetStatus());
    });
  }
  document.addEventListener("fullscreenchange", tick);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearOverlay();
    else tick();
  });
  setInterval(tick, 100);
})();
