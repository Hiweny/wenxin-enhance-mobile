# 百度文心助手「电脑版」网页结构研究

> 研究对象：`https://wenxin.baidu.com/`（**电脑端 UA**，桌面视口 1440×900 与手机视口 390×844 均已采样）
> 登录态：已登录（cookies 含 BDUSS / STOKEN / PTOKEN）
> 采集时间：2026-10-06
> 说明：站点为自研框架（非 React，DOM 上无 `__reactFiber`），类名带哈希后缀（如 `_chat-top-bar-new_j35qp_1`），**发版会变**。脚本内统一使用 **属性子串匹配**（`[class*="_chat-top-bar-new"]`）或稳定的 **id / 语义类名**，不要硬编码哈希。

---

## 0. 顶层

```
body.cos-chat.cos-pc.font-size-1.cos-h5.aitab-chat-search.pc-fresh-wrapper.pc-fresh-title-con
└── #app
    └── #cs-container-scroll._chat-container_10y6s_1
        └── ._chat-container-body_10y6s_1
            ├── .chat-aside-container.is-new-aside-sample.new-aside-container     ← 左侧栏容器
            └── #chat-container-main._chat-container-wrapper_10y6s_4              ← 主区
```

关键 meta：

```html
<meta name="viewport" content="width=device-width,minimum-scale=1.0,maximum-scale=1.0,user-scalable=no">
<link rel="shortcut icon" href="https://www.baidu.com/favicon.ico">
```

- `body` 同时带 `cos-pc` 与 `cos-h5`：页面**自带一定响应式**，窄视口下左侧栏会自动折叠（`.chat-aside-wrapper.collapsed`、`.chat-aside.collapsed` 被移到 `x=-240` 屏幕外）。
- 但折叠后**没有可见的抽屉入口**，桌面残留在左上角的 `#fold-aside-new`（181×37）语义不清 —— 这是需要脚本接管的核心痛点之一。

---

## 1. 左侧栏（`.chat-aside-container`）

```
.chat-aside-container
└── .chat-aside-wrapper.collapsed.new-task-ui-wrapper
    ├── #fold-aside-new.fold-aside.fold-aside-new.fold-aside-exp.fold-aside-new-task-ui   ← 折叠态残留条（181×37）
    │   ├── .fold-aside-brand-container > img.fold-aside-brand-img
    │   ├── .fold-aside-divider
    │   ├── .fold-aside-expand-container.fold-aside-exp-item > i.cos-icon-sidebar-right.fold-aside-expand-btn  ← 展开按钮
    │   └── .fold-aside-new-dialog-container > .fold-aside-new-dialog > i.cos-icon-new-dialog
    └── .chat-aside.collapsed.chat-aside-exp          ← 侧栏主体（240×844，折叠时 x=-240）
        ├── ._chat-aside-header_…                     ← 头部：搜索 ._history-search-btn_ / 标题 ._chat-aside-header-title_ / 新对话 ._btn-box_
        ├── .aside-fixed-menu                         ← 固定入口菜单（156 高）
        │   ├── .aside-main-tab.normal.new-task-tab   ← 新工作任务（i.cos-icon-deep-decision）
        │   ├── .aside-main-tab.normal                ← 定时任务（i.cos-icon-clock-ai）
        │   ├── .aside-main-tab.normal                ← 知识库（i.cos-icon-ai-knowledgebase）
        │   └── .aside-main-tab.normal                ← 收藏夹（i.cos-icon-star）
        ├── .aside-scroll-container.chat-aside-scroll ← 历史会话滚动区
        │   └── .chat-aside-scroll-content > .history-chat
        │       ├── .history-chat-header-box > .history-chat-header.aside-main-tab   ← "对话历史"
        │       └── .history-chat-gird > .history-chat-list-container
        │           └── .chat-history-list.history-chat-list
        │               └── .chat-history-time-item.chat-aside-new-item ×N           ← 会话条目（34px/条）
        └── .chat-left-bar.chat-aside-bottom          ← 底部：反馈/下载入口 + 用户信息
            └── .chat-aside-user-mask
                ├── .chat-aside-user-info             ← 头像 .chat-aside-avatar + 用户名
                └── .chat-aside-user-menu             ← 悬浮用户菜单（默认 0×0，hover 展开）
```

- 顶部还有 `.aside-outer-collapse > i.cos-icon-sidebar-right`（收起按钮）。

---

## 2. 顶栏（`._chat-top-bar-new_j35qp_1`）

```
._chat-top-bar-new._chat-top-bar-task
├── #chat-top-tab-list._chat-top-tab-list_62twd_4     ← 位于右侧（窄视口下 margin-left:auto）
│   ├── ._tab-item_62twd_12                            ← 对话 tab
│   ├── .message-center-container._message-center_3ihji_1._tab-item_62twd_12   ← 通知（含 .message-unread-dot 红点）
│   │   └── .message-panel-container-wrapper / .message-center-push-container / .message-center-settings-modal-container
│   └── ._more-btn_62twd_61                            ← 更多
│       └── ._more-dropdown-wrapper > ._more-dropdown
│           └── ._dropdown-item_62twd_95 ×N（网页 / 图片 / 资讯 / 视频 / 笔记）
```

---

## 3. 对话为主区

```
#chat-container-main-wrapper._chat-container-main-wrapper
├── ._chat-top-bar-new…                        ← 顶栏（见上）
├── ._chat-container-main_1r2co_9
│   └── ._chat-container-main-area > ._chat-container-main-stream
│       └── ._chat-body-container_1ozo5_1._scroll-container_1ozo5_37      ← 消息滚动容器
│           └── #conversation-flow-container._content-area_1ozo5_9
│               └── #conversation-flow-content.conversation-flow-content
│                   ├── ._tips-container_ / chat-share-popup / chat-toast / .chat-dialog-container
│                   ├── ._operate-layer_soow8_1                    ← 任务进度浮层
│                   │   ├── ._layer-schedule_ > ._schedule-tips_ > ._schedule-progress_ > span._progress-number_
│                   │   └── ._capsule-loading_ > ._tip-text_._capsule_   ← "智能体回答中，请等待"
│                   └── .chat-qa-container.cs-rank-container.last-history   ← 一轮问答
│                       ├── ._question-wrapper_1ozo5_49
│                       │   └── .conversation-flow-question-container > .cs-rank
│                       │       └── .cs-question-bubble.cs-bubble > ._question-block.c-fwb   ← 用户消息
│                       └── .conversation-flow-answer-container
│                           └── .history-answer-box > .chat-search-history-answer
│                               └── ._answer-layout > .cos-swiper.history-answer-swiper     ← AI 回答
│                                   └── #ai_index_history_N                                  ← 历史锚点
├── ._chat-bottom-wrapper_1r2co_74.new-input-box        ← 底部输入区（见 §4）
├── ._todo-panel-wrapper_1r2co_181                      ← 待办卡片浮层（.cosc-card._todo-panel）
└── ._right-bar-wrapper_1r2co_117.[_hide_]              ← 右侧工作栏（默认 _hide）
    ├── ._right-bar-divider-hit-area
    ├── ._ease-in-show > .workspace-stage-inner._workspace-stage_1vw4r_1
    │   └── #work-stage._workspace_1vw4r_1              ← 任务工作区
    └── ._ease-in-show > .chat-right-bar
        ├── ._container._blue-background > ._header + ._scroll-wrapper > ._content
        └── ._wrapper_19nhp_1 > ._result-head._result-head-task > span._result-head-text + ._result-container
```

> **任务模式**：选择"工作任务"模式后，AI 的回答以**可折叠步骤块**内联在消息流中（"需求梳理/读取文档/查询天气/…"），不是右侧栏。`._right-bar-wrapper` 仅在产出文件类产物时才展开，PC/窄屏默认都是 `_hide`（0 宽）。

---

## 4. 输入框

### 4.1 对话页 `.chat-input-box-pc`

```
._chat-bottom-wrapper > #cs-bottom._chat-bottom
└── .chat-input-box-pc > .cs-rich-input.cs-rich-input-new
    └── .ci-root.ci-ai-search…result-chat-input
        └── #ci-main.two-line-input
            └── .ci-wrapper.ci-normal-wrapper > .ci-container
                ├── #ci-top-band                                 ← 上部胶囊带（模式等）
                ├── .ci-file-input-wrapper > #ci-area > textarea#chat-textarea.ci-textarea   ← 输入框
                ├── .ci-tool
                │   ├── #ci-left-tool.ci-left-tool
                │   │   └── .ci-left-tools-wrapper
                │   │       ├── .ci-input-mode-wrapper > button.ci-input-mode-button[.ci-new-dot]  ← 模式按钮
                │   │       └── .ci-capsule-layout > #ci-tools.ci-tools-inside
                │   └── .right-tools-wrapper
                │       ├── #ci-right-tool > .ci-right-tool > #ci-smart-mic + .ci-merge-upload-wrapper
                │       └── span.ci-submit-button > img#ci-submit-button-ai     ← 发送
                └── .ci-upload-panel                                 ← 上传面板（默认 0 高）
```

### 4.2 首页 `#chat-input-home`

```
#new-page
├── #chat-input-home.chat-input-home.chat-input-box-newer.chat-input-box-top
│   └── .chat-input-background > #input-root.input-root > .ci-root…（同上结构）
└── #new-input-wrapper._new-input-wrapper
    ├── h1#welcomeText._welcome-text_1yeco_1        ← "有什么我可以帮你的吗？"
    ├── ._home-mode-switch-wrapper_1menl_102        ← 模式切换
    │   └── ._home-mode-switch_u4syo_1
    │       ├── span._home-mode-switch-indicator_u4syo_10        ← 滑动指示器
    │       ├── button._home-mode-switch-item_u4syo_24._home-mode-switch-item-active_u4syo_41  ← 对话
    │       └── button._home-mode-switch-item_u4syo_24                                          ← 工作
    └── ._home-recommend-wrapper_1menl_112 > ._home-recommend-words_c0no7_1
        └── button._home-recommend-words-item_c0no7_7 ×N          ← 推荐词
```

### 4.3 输入模式面板（"任务模式"入口）

点击 `.ci-input-mode-button` 弹出 `.ci-input-mode-panel`（约 154×180）：

| 项 | class |
|---|---|
| 快速 | `.ci-input-mode-title` |
| 快速回答 | `.ci-input-mode-desc` |
| 工作任务（含"上新"） | `.ci-input-mode-title` + `.ci-input-mode-new-badge` |
| 专业技能 | `.ci-input-mode-desc` |
| 模型 / 自动 | `.ci-input-mode-model-label` / `.ci-input-mode-model-name` |

---

## 5. 其它浮层容器

```
.message-panel-container-wrapper（通知面板）
.message-center-push-container
.message-center-settings-modal-container
.ci-toast-portal
```

---

## 6. 实测方法（用于开发调试）

用 Playwright 模拟「**手机视口 + 电脑 UA + 注入脚本**」：

```python
ctx = browser.new_context(storage_state="state.json",
                          viewport={"width": 390, "height": 844},
                          locale="zh-CN", device_scale_factor=2)
ctx.add_init_script(open("wenxin-mobile.user.js").read())
page.goto("https://wenxin.baidu.com/")
```

要点：
- `viewport` 用手机尺寸（390×844）模拟"手机显示"；**不要**用 mobile 设备描述符（那会改 UA 与触摸行为）。
- `add_init_script` 模拟油猴的 `@run-at document-start` 注入。
- ⚠️ **`document-start` 时 `document.head` 可能尚不存在**，`appendChild` 会抛 `Cannot read properties of null`，必须等 `documentElement && head` 就绪后再注入（脚本内已用轮询处理）。
- 副作用：账号会新增历史会话（任务测试会产生）。
