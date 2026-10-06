# 文心助手 · 手机版适配（PC网页改造）

把 **百度文心助手电脑版网页**（`https://wenxin.baidu.com/` / `https://chat.baidu.com/`，电脑端 UA）用油猴脚本**全量改造成移动端布局**。使用场景：手机上用电脑版 UA 打开文心助手（电脑版功能更全，但界面是桌面布局），脚本把它变成"原生手机 App 一样"的界面。

> 注意：本项目改造的是**电脑版 UA 的页面**，目标是**手机端显示**。与仓库早期"手机版 UA 增强"是两回事。

## 功能

- **手机端 viewport / 布局**：强制 `width=device-width`，主容器铺满，消除横向溢出
- **侧边栏 → 抽屉**：左侧滑出抽屉（汉堡按钮开关、遮罩点击关闭、返回键关闭、宽 300px/84vw、点会话自动收起）
- **默认工作模式**：进入首页自动切到「工作」模式
- **底部输入框**：全宽、大圆角、安全区适配、字号加大、内部按钮统一
- **消息排版**：正文 16px / 行高 1.62、气泡最大宽 86%、操作栏自动换行
- **顶栏**：固定顶部 + 磨砂玻璃，消除溢出
- **任务模式**：任务步骤面板正常展示
- **任务侧栏 → 独立全屏页**：`._right-bar-wrapper` 展开时改为全屏页 + 关闭按钮
- **弹窗适配**：模式面板 / 上传面板 / 通知面板 / 更多下拉 / 用户菜单 均约束在屏内

## 安装

1. 安装油猴扩展（手机可用 **Kiwi Browser / Edge / Firefox / Via** 等支持扩展的浏览器）
2. 打开 raw 脚本链接即可安装：
   ```
   https://raw.githubusercontent.com/Hiweny/wenxin-enhance-mobile/main/wenxin-mobile.user.js
   ```
3. 用**电脑版 UA** 打开 `https://wenxin.baidu.com/` 即可看到手机版界面。

## 排障 / 诊断

- **加 `#wxdebug`**：在地址栏把 URL 改成 `https://wenxin.baidu.com/#wxdebug`，页面左下角会出现绿色小徽标，显示：
  `WXMobile vX.X.X | innerW=… | mobile=… | touch=…`
  - 看不到徽标 → 脚本没运行（检查油猴是否启用 / @match 是否命中 / 浏览器是否支持油猴）
  - `mobile=false` → 手机判定没通过
  - `innerW=` 很大（如 980）→ 浏览器处于"桌面版网站"模式（布局视口被固定为 980）
- **`?wxmobile=0`**：临时关闭脚本（URL 加该参数）。

## 文档

- 电脑版网页结构研究：[docs/dom-research.md](docs/dom-research.md)

## 开发

- 脚本单文件：`wenxin-mobile.user.js`
- 本地实测：Playwright 以「手机视口 + 电脑 UA + 注入脚本」截图核对（见 `docs/dom-research.md`）
