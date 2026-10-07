# 文心 APK（WebView 壳）实现说明

把仓库根目录的 `wenxin-mobile.user.js` 装进一个原生 WebView 壳，得到「电脑端 UA + 手机端显示」的独立 App。
**脚本只有一份**：构建时由 Gradle 任务 `syncInject` 把 `wenxin-mobile.user.js` 复制进 `app/src/main/assets/inject.js`。

## 1. 与油猴版效果对齐的关键：桌面版式视口

手机浏览器「请求桌面版网站」会把布局视口锁成 ~980px，脚本检测到后进入**缩放补偿**（`html{zoom: 980/360}`
+ 伪装 `innerWidth`），把页面还原成手机宽度。APK 要想效果一致，就必须让 WebView 处于同样的视口状态：

| 配置 | 值 | 作用 |
| --- | --- | --- |
| `setUserAgentString` | 桌面 Chrome UA | 站点返回电脑版 DOM |
| `setUseWideViewPort(true)` | — | 尊重 viewport meta |
| `setLoadWithOverviewMode(true)` | — | 980 宽整页缩放到屏幕 |
| 早期注入 viewport meta | `width=980, user-scalable=no, viewport-fit=cover` | 复刻桌面版视口宽度 |

脚本侧改动（向后兼容，油猴版不受影响）：

```js
function vpContent() {
  if (window.__WX_VIEWPORT_WIDTH__) {            // APK 壳注入
    return 'width=' + window.__WX_VIEWPORT_WIDTH__ + ', user-scalable=no, viewport-fit=cover';
  }
  return 'width=device-width, initial-scale=1, ...'; // 手机浏览器
}
```

壳里另注入 `window.__WX_FORCE_MOBILE__ = true`（`isTouchDevice()` 兜底），以及 `window.__WX_APK__`。

## 2. 全屏沉浸（无顶底空白）

- `WindowCompat.setDecorFitsSystemWindows(window, false)` + 状态栏/导航栏透明 + `LAYOUT_STABLE | LAYOUT_FULLSCREEN | LAYOUT_HIDE_NAVIGATION`
- 刘海/挖孔：`LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES`（`values-v28` 主题里也设 `windowLayoutInDisplayCutoutMode=shortEdges`）
- **绝不使用** `SYSTEM_UI_FLAG_IMMERSIVE* / HIDE_NAVIGATION / FULLSCREEN` —— 那会让 IME insets 失效，键盘顶不动输入框
- 窗口/容器/WebView 三层底色都跟随主题，避免键盘动画或首帧露出黑缝

## 3. 主题跟随系统

`values/themes.xml`（Light，`windowLightStatusBar=true`） + `values-night/themes.xml`（Dark）。
Activity 声明 `configChanges` 含 `uiMode`，切换系统深色时**不重建**，WebView 的 `prefers-color-scheme`
自动跟随 app 主题，页面里脚本的 `@media (prefers-color-scheme: dark)` 一并生效。

## 4. 键盘 & 输入框（不遮、不闪、不塌）

三通道，全部落在 `MainActivity#setupKeyboard`：

1. **动画通道**：`WindowInsetsAnimationCompat.Callback`。动画期间**不改布局**，只用 `translationY` 平移 WebView
   （GPU 合成，逐帧无重排、不会露黑缝）；`onEnd` 同一时刻清零位移并落一次 `bottomMargin` 压缩，
   首尾位置严格相等 → 无跳变。
2. **现代 insets 通道**：`ViewCompat.setOnApplyWindowInsetsListener` 取 IME/navigationBars insets，去抖 60ms 合并。
3. **传统兜底**：`OnGlobalLayoutListener` + `getWindowVisibleDisplayFrame`，兼容无动画 ROM。

**为什么用 bottomMargin 而不是 padding**：Chromium WebView 里 `position:fixed` 元素锚定的是**自身视口底边**，
只有 View 的布局高度真的变小，网页 `visualViewport` 才会收缩，悬浮输入框才会稳定停在键盘上方（padding 不够）。

**防闪/防卡**：磨砂输入框 `backdrop-filter` 在聚焦时逐帧重采样会闪/卡，早期注入的 CSS 在
`:focus-within` 期间关掉 backdrop-filter、改近不透明纯色兜底（深浅两套），失焦自动恢复。

## 5. 图标

`tools/make_icons.py` 从用户提供的图（628×638）中心裁方，产出：

- **Legacy**：`mipmap-{m,h,xh,xxh,xxxh}dpi/ic_launcher.png`（48/72/96/144/192）
- **Adaptive**（v26+）：`mipmap-*/ic_launcher_foreground.png`（108dp 画布，原图缩到 68dp 居中留透明边）
  + `mipmap-anydpi-v26/ic_launcher(.round).xml` + 背景色 `#21212D`（取自原图四角，接缝无痕）

## 6. 构建期自检

`android/tools/Gen.java`（同包，纯 JVM 无 Android 依赖）用真实 javac 编译 `InlineJs`，
把拼好的注入串写盘后交给 `node --check` —— 专治「Java 字符串拼接出的 JS 语法错误静默上线」。
CI 的 *Verify injected bootstrap JS* 步骤每次都跑（本地就是这么抓到一处多余引号的）。

## 7. CI

`.github/workflows/android.yml`

- **build** job：setup-java 17 → sdkmanager 装 platform-34/build-tools 34.0.0 → `./gradlew assembleRelease`
  （release 用 debug 签名，直接可装）→ 上传 artifact + 发布到 Release（tag `apk`，资产 `Wenxin.apk`，
  固定直链 `releases/latest/download/Wenxin.apk`）
- **smoke** job（真机实测）：启 Android 模拟器（API 34 / x86_64 / KVM）→ 装 APK → 启动截图 →
  `adb forward` 到 WebView 的 DevTools socket，用 CDP 探查页面真实状态（`__WX_APK__`、body class、
  `innerWidth`、`prefers-color-scheme`、输入框 rect…）→ 点输入框拉键盘看是否遮挡 → `cmd uimode night yes`
  验证深色跟随 → 产物（截图/probe.txt/logcat）上传 artifact

## 8. 已知边界

- 底部导航栏区域的系统手势条（白条）由系统绘制，App 只能做到「透明 + 内容延伸」
- 模拟器实测无登录态，只能覆盖首页与设置面板；对话页需真机确认
- AI 生成的图片若要「长按保存」，blob: 链接在 WebView 里不支持直接下载（未实现原生下载桥）
