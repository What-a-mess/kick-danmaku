(() => {
  const dock = document.createElement("div");
  dock.id = "kick-danmaku-composer";
  dock.setAttribute("role", "region");
  dock.setAttribute("aria-label", "播放器聊天");

  let footer;
  let originalParent;
  let originalNext;
  let lastKeepAlive = 0;
  let caretFrame = 0;

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
    const row = (useFullscreen || chatCollapsed) && videoWrapper.querySelector(":scope > div > .grid-row-2 > .z-controls");
    if (!row?.firstElementChild?.nextElementSibling || (useFullscreen && !fullscreen.contains(row))) {
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
    if (dock.parentNode !== row) move(dock, row, row.firstElementChild.nextSibling);
    if (footer.parentNode !== dock) move(footer, dock);

    // Kick unmounts its controls after pointer inactivity. While the composer
    // has focus, keep the native controls alive so typing and IME can finish.
    const now = performance.now();
    if (dock.contains(document.activeElement) && now - lastKeepAlive >= 500) {
      lastKeepAlive = now;
      videoWrapper.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    }
  }

  dock.addEventListener("focusin", scheduleCaretScroll);
  dock.addEventListener("input", scheduleCaretScroll, true);
  document.addEventListener("selectionchange", scheduleCaretScroll);
  document.addEventListener("fullscreenchange", update);
  window.navigation?.addEventListener("navigate", event => {
    if (new URL(event.destination.url).pathname !== location.pathname) restore();
  });
  window.addEventListener("pagehide", restore);
  setInterval(update, 100);
  update();
})();
