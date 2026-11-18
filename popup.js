kickDanmakuBindPanel(document, async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return chrome.tabs.sendMessage(tab.id, { type: "kick-danmaku-status" });
});
