(() => {
  if (!kickDanmakuPageActive) return;
  const dock = document.createElement("div");
  dock.id = "kick-danmaku-composer";
  dock.setAttribute("role", "region");
  dock.setAttribute("aria-label", "播放器聊天");
  const slot = document.createElement("div");
  slot.className = "kick-danmaku-composer-slot";
  slot.setAttribute("aria-hidden", "true");

  let footer;
  let originalParent;
  let originalNext;
  let lastKeepAlive = 0;
  let caretFrame = 0;
  let composingEditor;

  function scheduleCaretScroll() {
    const editor = document.activeElement;
    if (caretFrame || !dock.contains(editor) || !editor.matches('#chat-input-wrapper [contenteditable="true"]')) return;

    // Lexical can update its selection after the input event, especially on paste.
    caretFrame = requestAnimationFrame(() => {
      caretFrame = 0;
      if (document.activeElement !== editor || editor.scrollWidth <= editor.clientWidth) return;
      const selection = document.getSelection();
      if (!selection?.isCollapsed || !selection.rangeCount || !editor.contains(selection.focusNode)) return;
      const caret = selection.getRangeAt(0).getClientRects()[0];
      if (!caret) return;

      const edgePadding = 8;
      const left = editor.getBoundingClientRect().left + editor.clientLeft + edgePadding;
      const right = left + editor.clientWidth - 2 * edgePadding;
      if (caret.right > right) editor.scrollLeft += Math.ceil(caret.right - right);
      else if (caret.left < left) editor.scrollLeft -= Math.ceil(left - caret.left);
    });
  }

  function move(node, parent, next = null) {
    // Chrome and Edge preserve the editor's focus and selection with moveBefore.
    if (parent.moveBefore && node.isConnected && parent.isConnected) {
      parent.moveBefore(node, next);
    } else {
      const focus = node.contains(document.activeElement) ? document.activeElement : null;
      parent.insertBefore(node, next);
      if (parent.isConnected) focus?.focus({ preventScroll: true });
    }
  }

  function restore() {
    if (!footer) return;
    if (footer.parentNode === dock) {
      move(footer, originalParent, originalNext?.parentNode === originalParent ? originalNext : null);
    }
    dock.remove();
    slot.remove();
    composingEditor = undefined;
    footer = undefined;
    originalParent = undefined;
    originalNext = undefined;
  }

  function update() {
    const player = document.querySelector("#injected-channel-player video#video-player");
    const fullscreen = document.fullscreenElement;
    const videoWrapper = player?.parentElement;
    const useFullscreen = player && fullscreen && fullscreen !== player && fullscreen.contains(player);
    const chatCollapsed = player && !fullscreen && player.closest('[data-chat="false"]');
    if (!useFullscreen && !chatCollapsed) {
      restore();
      return;
    }

    const row = videoWrapper.querySelector(":scope > div > .grid-row-2 > .z-controls");
    const hasSlot = row?.firstElementChild?.nextElementSibling && (!useFullscreen || fullscreen.contains(row));
    const interacting = dock.contains(document.activeElement) || composingEditor;
    if (!hasSlot && (!interacting || dock.parentNode !== videoWrapper)) {
      restore();
      return;
    }

    const nativeFooter = document.querySelector("#channel-chatroom #chatroom-footer");
    if (footer && (!originalParent.isConnected || footer.parentNode !== dock || nativeFooter)) {
      restore();
    }
    if (!footer) {
      if (!nativeFooter || nativeFooter.hasAttribute("hidden")) return;
      footer = nativeFooter;
      originalParent = footer.parentNode;
      originalNext = footer.nextSibling;
      dock.style.setProperty("--chatroom-font-size",
        getComputedStyle(footer).getPropertyValue("--chatroom-font-size").trim() || "14px");
    }
    // Kick removes its controls on inactivity. Keep the editor in the stable
    // player wrapper; the controls only carry its layout placeholder.
    if (dock.parentNode !== videoWrapper) move(dock, videoWrapper);
    if (footer.parentNode !== dock) move(footer, dock);
    if (hasSlot) {
      if (slot.parentNode !== row) move(slot, row, row.firstElementChild.nextSibling);
      const position = slot.getBoundingClientRect();
      const wrapper = videoWrapper.getBoundingClientRect();
      dock.style.left = `${position.left - wrapper.left}px`;
      dock.style.top = `${position.top + position.height / 2 - wrapper.top}px`;
      dock.style.width = `${position.width}px`;
    }

    // Preserve the usual behavior for typing without an active IME candidate.
    const now = performance.now();
    if (interacting && !composingEditor && now - lastKeepAlive >= 500) {
      lastKeepAlive = now;
      videoWrapper.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    }
  }

  dock.addEventListener("focusin", scheduleCaretScroll);
  dock.addEventListener("input", scheduleCaretScroll, true);
  dock.addEventListener("compositionstart", event => {
    if (event.target.matches('#chat-input-wrapper [contenteditable="true"]')) composingEditor = event.target;
  });
  dock.addEventListener("compositionend", event => {
    if (event.target !== composingEditor) return;
    const editor = composingEditor;
    queueMicrotask(() => {
      if (editor !== composingEditor) return;
      composingEditor = undefined;
      if (document.fullscreenElement && document.hasFocus() && document.activeElement === document.body) {
        editor.focus({ preventScroll: true });
      }
    });
  });
  window.addEventListener("pointerdown", event => {
    if (!dock.contains(event.target)) composingEditor = undefined;
  }, true);
  function protectComposition(event) {
    if (!document.fullscreenElement || !composingEditor || dock.contains(event.target)) return;
    if (event.target === document.body || event.target === document.documentElement) {
      event.stopImmediatePropagation();
    }
  }
  window.addEventListener("keydown", protectComposition, true);
  window.addEventListener("keyup", protectComposition, true);
  document.addEventListener("selectionchange", scheduleCaretScroll);
  document.addEventListener("fullscreenchange", update);
  window.navigation?.addEventListener("navigate", event => {
    if (new URL(event.destination.url).pathname !== location.pathname) restore();
  });
  window.addEventListener("pagehide", restore);
  setInterval(update, 100);
  update();
})();
