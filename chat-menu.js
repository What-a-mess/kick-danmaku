(() => {
  if (!kickDanmakuPageActive) return;

  let dialog;
  let entry;
  const markup = document.createElement("template");
  markup.innerHTML = kickDanmakuPanelMarkup;
  const styles = new CSSStyleSheet();
  styles.replaceSync(kickDanmakuPanelStyles);

  function openSettings() {
    if (dialog?.open) return;
    dialog = document.createElement("dialog");
    dialog.id = "kick-danmaku-settings";
    dialog.setAttribute("aria-label", "弹幕设置");
    const activeDialog = dialog;
    const mount = document.createElement("div");
    activeDialog.append(mount);
    const root = mount.attachShadow({ mode: "open" });
    root.adoptedStyleSheets = [styles];
    const content = document.createElement("div");
    content.className = "settings-content";
    content.append(markup.content.cloneNode(true));
    root.append(content);
    const close = document.createElement("button");
    close.id = "close-settings";
    close.type = "button";
    close.textContent = "关闭";
    close.autofocus = true;
    close.addEventListener("click", () => activeDialog.close());
    root.querySelector("footer").append(close);

    const fullscreen = document.fullscreenElement;
    const host = fullscreen && !(fullscreen instanceof HTMLVideoElement) ? fullscreen : document.body;
    host.append(activeDialog);
    const stopStatus = kickDanmakuBindPanel(root, kickDanmakuGetStatus);
    activeDialog.addEventListener("close", () => {
      stopStatus();
      activeDialog.remove();
      if (dialog === activeDialog) dialog = undefined;
    }, { once: true });
    activeDialog.showModal();
  }

  function syncMenu() {
    const panel = document.getElementById("chat-settings-panel");
    const list = panel?.querySelector("ul");
    if (!list || entry?.parentElement === list) return;
    entry?.remove();
    entry = document.createElement("li");
    const button = document.createElement("button");
    button.id = "kick-danmaku-open-settings";
    button.type = "button";
    button.textContent = "弹幕设置";
    button.addEventListener("click", () => {
      panel.querySelector("button")?.click();
      openSettings();
    });
    entry.append(button);
    list.append(entry);
  }

  document.addEventListener("fullscreenchange", () => dialog?.close());
  if (kickDanmakuUserscript) GM_registerMenuCommand("弹幕设置", openSettings);
  syncMenu();
  setInterval(syncMenu, 300);
})();
