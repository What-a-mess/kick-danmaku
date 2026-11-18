function kickDanmakuBindPanel(root, getStatus) {
  const form = root.querySelector("#settings");
  const fields = Object.fromEntries(Object.keys(kickDanmakuDefaults).map(key => [key, root.getElementById(key)]));
  const preview = root.querySelector("#preview");
  const statusLabel = root.querySelector("#status");
  const saveError = root.querySelector("#save-error");
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
      await kickDanmakuStore.set(settings);
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
      const { state, detail } = await getStatus();
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

  form.addEventListener("submit", event => event.preventDefault());
  const reset = root.querySelector("#reset");
  for (const field of [...Object.values(fields), reset]) field.disabled = true;
  kickDanmakuStore.get().then(danmaku => {
    display(kickDanmakuSettings(danmaku));
  }).catch(() => {
    display(kickDanmakuDefaults);
    saveError.textContent = "读取设置失败";
  }).finally(() => {
    for (const field of [...Object.values(fields), reset]) field.disabled = false;
    form.addEventListener("input", () => save(readForm()));
    fields.enabled.addEventListener("input", () => save(readForm()));
    reset.addEventListener("click", () => {
      display(kickDanmakuDefaults);
      save(kickDanmakuDefaults);
    });
  });

  updateStatus();
  const timer = setInterval(updateStatus, 1000);
  return () => clearInterval(timer);
}
