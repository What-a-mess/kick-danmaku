# Kick 弹幕

<img src="assets/icon-128.png" width="96" height="96" alt="Kick 弹幕 Logo">

适用于 Chrome / Edge 扩展和 Tampermonkey 的 Kick 实时弹幕。

## 安装

### Tampermonkey 油猴脚本

1. 确认浏览器已安装 Tampermonkey，然后打开 [安装 Kick 弹幕](https://raw.githubusercontent.com/What-a-mess/kick-danmaku/main/kick-danmaku.user.js)，在 Tampermonkey 安装页确认。
2. 刷新 Kick 直播页，打开「聊天室设置 → 弹幕设置」。Tampermonkey 菜单也提供「弹幕设置」入口。

### Chrome / Edge 扩展

1. 打开 `chrome://extensions` 或 `edge://extensions`，开启「开发者模式」。
2. [下载并解压本仓库](https://github.com/What-a-mess/kick-danmaku/archive/refs/heads/main.zip)，点「加载已解压的扩展程序」，选择包含 `manifest.json` 的文件夹。
3. 停用旧弹幕插件并刷新 Kick 直播页，避免两套弹幕同时出现。全屏时使用 Kick 播放器自己的全屏按钮。
4. 打开「聊天室设置 → 弹幕设置」，或点击浏览器工具栏里的「Kick 弹幕」。可以查看连接状态，调整字体、字重、字号、颜色、不透明度、速度和覆盖范围，或设置屏蔽词。

两种版本使用独立的本地设置，建议同一个浏览器只启用其中一种。

## 行为

- 直接订阅 Kick 网站使用的实时聊天流。进房、切换频道和重连时只接收新推送，聊天侧栏滚动不会触发弹幕。
- 屏蔽词支持每行一个或逗号分隔，按不区分大小写的子串匹配，只作用于视频弹幕。
- 登录 Kick 后，自己的消息默认带绿色描边，可在弹幕设置中关闭。
- 新消息短暂排队，收到删帖事件后会丢弃排队消息或撤下已显示的弹幕；清空聊天会清除画面上的弹幕。直播间太热闹时会舍弃来不及显示的消息，避免积压。
- 支持普通播放和播放器容器全屏。浏览器原生画中画或仅让原始视频元素进入全屏的模式无法叠加网页元素。
- 右侧聊天折叠或进入播放器全屏时，Kick 自带的聊天输入框会在播放控制栏内与按钮同排。输入框随播放控制栏显隐，打字时控制栏保持展开。可按 Enter 或点原有发送按钮，草稿随输入框保留。
- 用途限于直播频道页。实时连接使用 Kick 的访客令牌，设置保存在本机；聊天内容只在当前标签页内处理。

## 构建

在仓库目录运行 `node build-userscript.cjs`，根据扩展源码生成 `kick-danmaku.user.js` 和内嵌面板模板。无需安装依赖。`node build-userscript.cjs --check` 可检查产物是否最新。

## Credits

- [DanMage](https://github.com/teststaybaka/danmage) · 感谢 teststaybaka 开发原先使用的弹幕插件，它是本项目的灵感来源。
- [kicksdk 的实时消息记录](https://github.com/AnisAbdellatif/kicksdk/blob/main/docs/KICK.md#6-realtime-chat-feed) · Kick 实时聊天协议参考。
- 项目 Logo 由 OpenAI ImageGen 生成。

本项目是独立浏览器扩展。
