const kickDanmakuFonts = {
  system: 'system-ui, "Microsoft YaHei", sans-serif',
  sans: 'Arial, "Microsoft YaHei", sans-serif',
  serif: 'Georgia, "Songti SC", SimSun, serif',
  mono: 'Consolas, "Microsoft YaHei", monospace',
};

const kickDanmakuDefaults = Object.freeze({
  enabled: true,
  showName: false,
  highlightOwn: true,
  font: "system",
  fontWeight: "700",
  size: 26,
  opacity: 85,
  color: "#ffffff",
  speed: 160,
  area: 35,
  blocked: "",
});

function kickDanmakuSettings(value = {}) {
  const settings = { ...kickDanmakuDefaults };
  for (const key of Object.keys(settings)) {
    if (value && Object.hasOwn(value, key)) settings[key] = value[key];
  }
  settings.font = Object.hasOwn(kickDanmakuFonts, settings.font) ? settings.font : "system";
  settings.fontWeight = ["400", "500", "600", "700", "900"].includes(settings.fontWeight)
    ? settings.fontWeight : kickDanmakuDefaults.fontWeight;
  for (const [key, minimum, maximum] of [
    ["size", 14, 48], ["opacity", 10, 100], ["speed", 70, 320], ["area", 15, 80],
  ]) {
    settings[key] = Number.isFinite(settings[key])
      ? Math.round(Math.min(maximum, Math.max(minimum, settings[key])))
      : kickDanmakuDefaults[key];
  }
  settings.enabled = settings.enabled !== false;
  settings.showName = settings.showName === true;
  settings.highlightOwn = settings.highlightOwn !== false;
  settings.color = /^#[0-9a-f]{6}$/i.test(settings.color) ? settings.color : "#ffffff";
  settings.blocked = typeof settings.blocked === "string" ? settings.blocked.slice(0, 10000) : "";
  return settings;
}

function kickDanmakuFilter(value) {
  return value.normalize("NFKC").replace(/[\u200b-\u200d\ufeff]/g, "").toLowerCase();
}
