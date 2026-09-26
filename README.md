# 文心助手手机版增强 (Wenxin Enhance Mobile)

百度文心助手**手机版网页**（`https://wenxin.baidu.com/`，手机 UA）的 Tampermonkey 增强脚本。

## 功能
- 默认选择 **DeepSeek-V4 Pro** 模型、默认开启**思考模式**、默认开启**任务模式**（在网络请求层强制，最可靠）
- **防撤回**：缓存真实回答，被撤回/过滤后自动恢复（移植自 deepseek-enhance 思路，针对文心 SSE 适配）
- **自定义全局背景**：背景图 + 模糊/亮度调节、本地上传（≤8MB）、磨砂透明气泡
- **移除胶囊条中需要 App 的功能**，仅保留网页可用项（深度思考 / 模型 / 任务 / 深入研究）
- 去掉图片相关入口；输入框与整体手机端美化（圆角、阴影、磨砂、安全区适配）
- 右下角 ✦ 唤起底部滑出设置面板

## 安装
1. 安装 Tampermonkey（手机可用 Kiwi/Edge 扩展，或支持油猴的浏览器）
2. 打开 raw 脚本链接即可安装：
   https://raw.githubusercontent.com/Hiweny/wenxin-enhance-mobile/main/wenxin-enhance-mobile.user.js

## 文档
- 网页结构研究：[docs/dom-research.md](docs/dom-research.md)
