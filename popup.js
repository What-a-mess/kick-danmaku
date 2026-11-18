const form = document.querySelector("#settings");
const fields = Object.fromEntries(Object.keys(kickDanmakuDefaults).map(key => [key, document.getElementById(key)]));
const preview = document.querySelector("#preview");
const statusLabel = document.querySelector("#status");
const saveError = document.querySelector("#save-error");
let writes = Promise.resolve();

function display(settings) {
  for (const [key, value] of Object.entries(settings)) {
    if (fields[key].type === "checkbox") fields[key].checked = value;
    else fields[key].value = value;
  }
  updatePreview(settings);
}

function updatePreview(settings) {
  for (const [key, unit] of Object.entries({ size: " px", opacity: "%", speed: " px/s", area: "%" })) {
    form.querySelector(`output[for="${key}"]`).textContent = `${settings[key]}${unit}`;
  }
  preview.style.fontFamily = kickDanmakuFonts[settings.font];
  preview.style.fontSize = `${settings.size}px`;
  preview.style.color = settings.color;
  preview.style.opacity = settings.opacity / 100;
  preview.textContent = settings.showName ? "观众: 这是一条弹幕" : "这是一条弹幕";
}

function save(settings) {
  updatePreview(settings);
  writes = writes.then(async () => {
    await chrome.storage.local.set({ danmaku: settings });
    saveError.textContent = "";
  }).catch(() => {
    saveError.textContent = "设置保存失败";
  });
}

function readForm() {
  return kickDanmakuSettings(Object.fromEntries(Object.entries(fields).map(([key, field]) => {
    if (field.type === "checkbox") return [key, field.checked];
    if (field.type === "range") return [key, field.valueAsNumber];
    return [key, field.value];
  })));
}

async function updateStatus() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const { state, detail } = await chrome.tabs.sendMessage(tab.id, { type: "kick-danmaku-status" });
    statusLabel.textContent = {
      idle: "等待 Kick 直播播放器",
      connecting: "正在连接实时聊天",
      live: "实时聊天已连接",
      disabled: "弹幕已关闭",
      retry: detail ? `重新连接中 · ${detail}` : "正在重新连接",
    }[state] ?? "等待 Kick 直播播放器";
  } catch {
    statusLabel.textContent = "请打开或刷新 Kick 直播页面";
  }
}

chrome.storage.local.get("danmaku").then(({ danmaku }) => {
  display(kickDanmakuSettings(danmaku));
}).catch(() => {
  display(kickDanmakuDefaults);
  saveError.textContent = "读取设置失败";
}).finally(() => {
  form.addEventListener("input", () => save(readForm()));
  fields.enabled.addEventListener("input", () => save(readForm()));
  document.querySelector("#reset").addEventListener("click", () => {
    display(kickDanmakuDefaults);
    save(kickDanmakuDefaults);
  });
});
updateStatus();
setInterval(updateStatus, 1000);
