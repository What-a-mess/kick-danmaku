const kickDanmakuUserscript = typeof GM_getValue === "function";
const kickDanmakuStorageKey = "danmaku";
const kickDanmakuStore = {
  async get() {
    if (kickDanmakuUserscript) return GM_getValue(kickDanmakuStorageKey);
    return (await chrome.storage.local.get(kickDanmakuStorageKey))[kickDanmakuStorageKey];
  },
  async set(value) {
    if (kickDanmakuUserscript) return GM_setValue(kickDanmakuStorageKey, value);
    return chrome.storage.local.set({ [kickDanmakuStorageKey]: value });
  },
  subscribe(listener) {
    if (kickDanmakuUserscript) {
      GM_addValueChangeListener(kickDanmakuStorageKey, (_key, _old, value) => listener(value));
      return;
    }
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes[kickDanmakuStorageKey]) {
        listener(changes[kickDanmakuStorageKey].newValue);
      }
    });
  },
};
