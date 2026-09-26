# 百度文心助手「手机版」网页结构研究文档

> 研究对象：`https://wenxin.baidu.com/`（手机 UA：iPhone iOS 17，视口 390×844，触屏模拟）
> 研究时间：2026-09-26
> 说明：站点为自研框架（非 React，DOM 上无 `__reactFiber` 键），类名带 `_xxxx` 哈希后缀，发版会变；脚本内统一使用 **语义前缀（`cos-` / `cosd-`）+ 属性子串匹配**，不依赖哈希。

---

## 1. 顶层结构

```
#app > div
├── div._background-color-mask            # 背景遮罩
├── #chat-container-main
│   └── div > ._chat-body-container
│       └── #conversation-flow-container._content-area
│           └── #conversation-flow-content.conversation-flow-content   ← 消息滚动容器
├── div > ._chat-bottom-wrapper > ._chat-bottom                        ← 固定底部输入区
├── div > .chat-selector + ._language-picker-container + #work-popup-wise
├── #chat-mkt-ball._chat-mkt-ball
├── #chat-mkt-answer._chat-mkt-answer-wrapper > ._chat-mkt-answer
└── ._workspace-stage-wise > #work-stage-wise > ._workspace
```

## 2. 消息滚动容器 `#conversation-flow-content`

- `.chat-search-page-header`（顶部，含侧边栏入口）
  - `.chat-search-page-header-container > .chat-search-page-header-title`
    - `img.chat-history-header-icon` + `span.chat-search-page-header-text`「文心助手」
  - `i.cos-icon-new-dialog.new-dialog-icon`（右上角新对话）
- `._tips-container`、自定义元素 `<chat-share-popup>`、`.chat-dialog-container`
- **任务进度浮层** `._operate-layer`
  - `._layer-schedule > ._schedule-tips`
    - `._schedule-progress`「已完成 次」`span._progress-number`
    - `._layer-close > i.cos-icon-close`
  - `._capsule-loading ._tip-text._capsule`「智能体回答中，请等待」

### 2.1 一轮问答 `.chat-qa-container.cs-rank-container.last-history`

**用户侧**
```
._question-wrapper
└── .conversation-flow-question-container
    └── .cs-rank.cs-enable-selection
        ├── ._divider > ._timestamp            「21:10」
        └── .cs-question-bubble.cs-bubble
            └── ._question-block.c-fwb
                └── span.cs-question-pure-text
                    └── span._question-line-break   ← 用户原文
```

**AI 侧**
```
.conversation-flow-answer-container
└── .history-answer-box > .chat-search-history-answer
    └── ._answer-layout > .cos-swiper.history-answer-swiper
        └── .cos-swiper-content > .cos-swiper-list
            └── .cos-swiper-item.cs-history-answer
                └── .answer-container.cs-enable-selection
                    └── .ai-entry
                        ├── .ai-entry-block.ai-thinking-steps     ← 思考块
                        │   └── ._thinking-steps > ._collapse-container
                        │       ├── header.root-header
                        │       └── ._main-mask > ._mask-dom
                        ├── .ai-entry-block.ai-markdown           ← 正文
                        │   └── .cosd-markdown > .cosd-markdown-content
                        │       └── .marklang > p.marklang-paragraph
                        └── ._interact-root                       ← 操作栏
                            └── ._interact-wrapper
                                ├── ._interact-wrapper-left
                                │   ├─ TTS  ._tts-chat-wrapper span._audio-icon-wrapper
                                │   ├─ 复制 .cos-row.copy-container._copy
                                │   └─ 分享 .cos-row._share
                                └── ._interact-wrapper-right
                                    ├─ 赞/踩 span.cos-tooltip
                                    └─ 重新生成 .cos-row._replace
```
- 历史锚点：`#ai_index_history_0`（首页）/ `#ai_index_history_1`…
- 追问推荐：`.answer-ask-container .cs-question-closely-container` 内多个 `.cs-question-closely-single`

### 2.2 全新欢迎页 `#init`

```
#init
└── ._new-multi-recommend-word
    ├── ._new-multi-recommend-word-container
    │   ├── ._recommend-container-title
    │   │   ├── img._title-emoji            （👋）
    │   │   └── ._recommend-container-title-text  「晚上好！想和我聊点什么？」
    │   ├── ._recommend-container-desc
    │   └── ._arc-swiper                     ← 大卡片轮播（12 张）
    │       └── ._arc-swiper-content
    │           └── ._arc-swiper-item > ._arc-swiper-content._press-animation
    └── ._recommend-closely-list             ← 3 个推荐话题
        └── .cs-question-closely-single-bub > span.cs-question-closely-agent-text
```

## 3. 固定底部输入区

```
._chat-bottom
└── .chat-input-box-pc
    └── .cs-input-invoke.cs-rich-input
        ├── ._sug-warp > ._sug-container > ._sug-list     ← 输入联想
        ├── .input-wrap
        │   └── .input-container
        │       ├── textarea#chat-input-box.input-fields   ← 输入框
        │       ├── .input-hide-content
        │       └── .cs-input-ds-btn-wrap
        │           └── .cs-input-right-btn
        │               ├── img.cs-input-voice-btn        ← 语音
        │               └── .cs-input-plus-btn i.cos-icon-plus-circle  ← 「+」
        ├── .ai-generated                                 「内容由AI生成」
        └── .chat-input-function-box                      ← 「+」展开面板
            ├── input.chat-input-function-file
            └── .cos-row > .cos-col.chat-input-function-item ×4
                （相机 / 相册 / 文件 / 打电话，文字在 .chat-input-function-text）
```

## 4. 功能胶囊条（共 17 项）

`.capsules-box > .cos-swiper.capsules-container > .cos-swiper-content > .cos-swiper-list`
每项：`.cos-swiper-item.capsules-item > span.cos-tooltip`（模型项内层 `#model-list-id`）

| 索引 | 名称 | 匿名实测行为 | 脚本处理 |
|---|---|---|---|
| 0 | 深度思考 | 网页可用（`deepsearch_btn`） | **保留** |
| 1 | 文心5.1（模型，带下拉箭头） | 网页可用（`ask_model_btn`） | **保留** |
| 2 | AI生视频 | App 专属（boxer scheme→App Store） | 移除 |
| 3 | 生成视频 | 外链 aigc/miaobi | 移除 |
| 4 | 任务 | 网页可用（deep_decision） | **保留** |
| 5 | 拍题答疑 | App 专属 | 移除 |
| 6 | AI修图 | 外链图片编辑页 | 移除 |
| 7 | AI写作 | App 专属 | 移除 |
| 8 | 健康相机 | App 专属 | 移除 |
| 9 | 图片生成 | App 专属（匿名） | 移除 |
| 10 | 拍照问 | App 专属 | 移除 |
| 11 | 测运势 | App 专属 | 移除 |
| 12 | 视频通话 | App 专属 | 移除 |
| 13 | 打电话 | App 专属 | 移除 |
| 14 | AI音乐 | App 专属 | 移除 |
| 15 | AI播客 | App 专属 | 移除 |
| 16 | 深入研究 | 网页/登录后可用 | **保留** |

## 5. 模型下拉面板 `#model-list-panel-id`

模型列表由**服务端下发**，内嵌于首屏 HTML 的 `modelList` JSON：

| id | 标题 | 说明 | thinkMode |
|---|---|---|---|
| `smartMode` | 智能模式(推荐) | 智能识别需求，调度最佳模型 | — |
| `ERINE-5.1` | 文心5.1 | 文心最新模型 搜索推理能力强 | 可切换 |
| **`DeepSeek-V4`** | **DS-V4 Pro** | 编程更强 推理更优 | 可切换 |
| `DeepSeek-V4-Flash` | DS-V4 Flash | 响应更快 适合日常回答 | 可切换 |
| `DeepSeek` | DS-R1 | 深度思考 适合复杂问题 | 强制开、不可关 |

- 选项：`[class*=model-list-item]`，内含 `[class*=model-list-item-title]` / `-desc` / 选中标记 `i.cos-icon-check-circle-fill`
- 面板底部「思考模式」开关：`[class*=model-func-switch] .cos-switcher`
- 面板会自动关闭，自动化需「打开 + 点击」在同一执行单元完成。

## 6. 网络协议（防撤回 / 默认模型依据）

### 6.1 发送会话
`POST https://chat.baidu.com/aichat/api/conversation`（**fetch**，响应为 **SSE**，约 100KB+）

请求体关键字段：
```jsonc
{
  "message": {
    "query": [{ "type": "TEXT", "data": { "text": { "query": "用户输入" } } }],
    "searchInfo": {
      "ori_lid": "会话 id",
      "usedModel": {
        "modelName": "smartMode",                 // 模型 id
        "modelFunction": { "thinkMode": "0", "deepSearch": "0" }
      },
      "deepDecisionInfo": { "isDeepDecision": 0 } // 任务模式
    }
  }
}
```
- 模型切换 → `usedModel.modelName`（DS-V4 Pro = `"DeepSeek-V4"`）
- 思考模式 → `modelFunction.thinkMode`（"1" 开）
- 深度思考胶囊 → `modelFunction.deepSearch`（"1" 开）
- 任务模式 → `deepDecisionInfo.isDeepDecision = 1`（面板类型 `deep_decision`）

脚本在 fetch 层重写该请求体，强制默认模型/思考/任务，**不依赖 UI 点击**，最可靠。

### 6.2 SSE 响应
- `event:basedata`：基础信息（isUserLogin、baiduid、lid…）
- `event:ping`
- `event:message`（多条）：`data.data.message`
  - `metaData.state`：`waiting-resp` → `generating-resp` → `generate-complete`
  - `content.generator` 为对象：
    - `component`：`thinkingSteps`（思考，`data.reasoningContentArr`）/ `markdown-yiyan`（正文，**增量 token 在 `data.value`**）/ `questionClosely` / `input`
    - 安全标记：`antiFlag`（0 正常）、`isSafe`（1 正常）

**撤回/过滤信号**：`antiFlag !== 0` 或 `isSafe !== 1`，或正文在完成后被替换为过滤提示。
防撤回做法：增量拼接 `markdown-yiyan.data.value` 得到完整答案，持续按 `sessionId+msgId` 缓存；检测到安全标记翻转或 DOM 正文被替换为提示时，用缓存内容回填，并加「已恢复（防撤回）」标记。

### 6.3 其它接口
- `POST /aichat/api/impush`：消息已读上报
- `GET /aichat/api/aitabserver?ctl=sug`：输入联想
- `POST /aichat/api/messages/list`：历史消息分页
- `POST /aichat/api/getShareToken`：分享令牌

## 7. 登录（百度账号扫码）
- 登录页：`https://passport.baidu.com/v2/?login&u=https://wenxin.baidu.com/&tpl=wx&qrcode=1`
- 流程：`getqrcode`（返回 sign）→ `qrcode?sign=` 二维码 → `channel/unicast` 长轮询 → 确认后交换 BDUSS 并回跳
- 未登录 cookie 仅 BAIDUID 等，无 BDUSS。

## 8. 设计变量（美化基准）
`--wxem-accent #3b6cf6`、`--wxem-text #1d2129`、`--wxem-text-2 #6b7280`、
`--wxem-frost rgba(255,255,255,.72)`、`--wxem-frost-strong rgba(255,255,255,.86)`、
`--wxem-border rgba(0,0,0,.08)`、`--wxem-shadow 0 6px 24px rgba(15,23,42,.08)`、`--wxem-radius 16px`。
设置面板移动端为底部滑出（含 `env(safe-area-inset-bottom)`），右下角悬浮 ✦ 按钮唤起。
