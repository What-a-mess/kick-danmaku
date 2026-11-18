const kickDanmakuPageActive = !document.documentElement.hasAttribute("data-kick-danmaku-runtime");
if (kickDanmakuPageActive) {
  document.documentElement.dataset.kickDanmakuRuntime = kickDanmakuUserscript ? "userscript" : "extension";
}
let kickDanmakuGetStatus = () => ({ state: "idle" });
