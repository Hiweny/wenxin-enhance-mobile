package com.hiweny.wenxin;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Rect;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Message;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewTreeObserver;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsAnimationCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

/**
 * 文心助手 手机版 · WebView 壳。
 *
 * 设计要点：
 * 1) 电脑端 UA + 「请求桌面版网站」式视口（width=980）→ 交给油猴脚本做缩放补偿，
 *    结果与手机上装脚本的效果一致；
 * 2) edge-to-edge 全屏沉浸：系统栏透明、内容延伸到刘海与底部导航区，无黑边/白条；
 * 3) 主题跟随系统：values-night 主题 + uiMode 配置变化，WebView 的 prefers-color-scheme 自动跟随；
 * 4) 键盘三通道（动画期位移 / 动画后压缩布局高度 / 全局布局兜底），保证底部悬浮输入框
 *    既不闪烁也不错位。
 */
public class MainActivity extends Activity {

    private static final String HOME = "https://wenxin.baidu.com/";
    private static final int FILE_CHOOSER_CODE = 1001;
    private static final int PERM_CODE = 1002;
    private static final String TAG = "WenxinWeb";

    /** 模拟器（软件 GPU）上要降低渲染负担，否则 WebView 容易把整机拖崩 */
    private static boolean isEmulator() {
        String fp = Build.FINGERPRINT == null ? "" : Build.FINGERPRINT;
        String hw = Build.HARDWARE == null ? "" : Build.HARDWARE;
        return fp.contains("generic") || fp.contains("emulator") || hw.contains("goldfish") || hw.contains("ranchu");
    }

    // 桌面端 UA（与手机浏览器「请求桌面版网站」一致）
    private static final String DESKTOP_UA =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            + "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

    private FrameLayout root;
    private WebView web;
    private String injectJs;
    private ValueCallback<Uri[]> filePathCallback;

    // ---- 键盘三通道状态 ----
    private int navBarH = 0;
    private int imePadModern = 0;
    private int imePadLegacy = 0;
    private int lastAnimH = 0;
    private boolean imeAnimating = false;
    private int settledMargin = 0;
    private final Rect visibleRect = new Rect();
    private final Runnable applyRunnable = this::applyTargetPadding;

    private boolean isDark() {
        return (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
                == Configuration.UI_MODE_NIGHT_YES;
    }

    // 与页面最终底色保持一致，避免启动/resize 瞬间出现色差闪块
    private int pageBgColor() { return isDark() ? 0xFF17181C : 0xFFFFFFFF; }
    private String pageBgCss() { return isDark() ? "#17181c" : "#ffffff"; }

    private String earlyJs() { return InlineJs.early(isDark(), pageBgCss()); }

    private String fullBootstrapJs() { return InlineJs.fullBootstrap(isDark(), pageBgCss(), injectJs()); }

    private String injectJs() {
        if (injectJs != null) return injectJs;
        StringBuilder sb = new StringBuilder();
        try (InputStream is = getAssets().open("inject.js");
             BufferedReader br = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            String line;
            while ((line = br.readLine()) != null) sb.append(line).append('\n');
        } catch (Exception e) {
            return "";
        }
        injectJs = sb.toString();
        return injectJs;
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Log.i(TAG, "onCreate");
        // 必须在任何 WebView 实例创建之前启用，否则 devtools 不暴露 target
        WebView.setWebContentsDebuggingEnabled(true);
        requestWindowFeature(Window.FEATURE_NO_TITLE);

        // edge-to-edge：内容铺到系统栏之下；键盘高度由我们按 insets 补 padding
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        getWindow().setBackgroundDrawable(new ColorDrawable(pageBgColor()));
        applyImmersive();

        root = new FrameLayout(this);
        root.setBackgroundColor(pageBgColor());
        root.setClipToPadding(false);

        applyChromiumTuning();
        web = new WebView(this);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            web.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, true);
        }
        web.setBackgroundColor(pageBgColor());
        web.setClipToPadding(false);
        root.addView(web, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        setupKeyboard();

        if (!isEmulator()) web.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setSupportMultipleWindows(false);
        // 桌面版网站式的宽视口 + 整页适配：脚本据此进入缩放补偿，还原手机端布局
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        s.setOffscreenPreRaster(!isEmulator());
        s.setTextZoom(100);
        s.setUserAgentString(DESKTOP_UA);
        s.setMinimumFontSize(0);
        s.setDefaultTextEncodingName("utf-8");
        applyDarkMode(s);

        // 登录态：允许 Cookie 与第三方 Cookie（百度 passport 跨站登录）
        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(web, true);

        // document-start 注入；未注册成功则由 onPageStarted/onPageFinished 兜底（__WX_BOOTED__ 幂等）
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            try {
                WebViewCompat.addDocumentStartJavaScript(web, fullBootstrapJs(), Collections.singleton("*"));
            } catch (Exception ignored) { }
        }

        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                Log.i(TAG, "onPageStarted " + url);
                view.evaluateJavascript(fullBootstrapJs(), null);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                Log.i(TAG, "onPageFinished " + url);
                view.evaluateJavascript(fullBootstrapJs(), null);
                // 把页面真实状态回报到 logcat，便于无人值守的云端实测核对
                view.evaluateJavascript("(function(){try{return JSON.stringify({apk:!!window.__WX_APK__,"
                        + "iw:window.innerWidth,ih:window.innerHeight,vvh:(window.visualViewport?Math.round(window.visualViewport.height):-1),"
                        + "dpr:window.devicePixelRatio,zoom:document.documentElement.style.zoom||'1',"
                        + "dark:matchMedia('(prefers-color-scheme:dark)').matches,mobile:!!window.__WX_MOBILE__,"
                        + "cls:document.body?document.body.className:'-',scaled:document.body?document.body.classList.contains('wx-scaled'):false,"
                        + "bg:document.body?getComputedStyle(document.body).backgroundColor:'-',"
                        + "gear:!!document.getElementById('wx-settings-btn'),burger:!!document.getElementById('wx-hamburger'),"
                        + "bgLayer:!!document.getElementById('wx-bg'),ta:document.querySelectorAll('textarea,[contenteditable=true]').length,"
                        + "title:document.title});}catch(e){return 'ERR:'+e.message}})()",
                        v -> Log.i(TAG, "STATE " + v));
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, android.webkit.WebResourceError err) {
                Log.e(TAG, "onReceivedError " + req.getUrl() + " -> " + err.getErrorCode() + " " + err.getDescription());
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest req, android.webkit.WebResourceResponse res) {
                Log.e(TAG, "onReceivedHttpError " + req.getUrl() + " -> " + res.getStatusCode());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                String scheme = u.getScheme() == null ? "" : u.getScheme();
                if (scheme.equals("http") || scheme.equals("https")) {
                    if (isInternalHost(u.getHost())) return false;
                    try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                    return true;
                }
                // 非 http 协议（如 baiduboxapp://）只在内部拦截，避免跳出到不存在的应用
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int p) {
                if (p == 100) Log.i(TAG, "progress 100");
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage cm) {
                Log.i(TAG, "JS " + cm.messageLevel() + " " + cm.message() + " @" + cm.lineNumber());
                return true;
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = cb;
                Intent intent = params.createIntent();
                try {
                    startActivityForResult(Intent.createChooser(intent, "选择文件"), FILE_CHOOSER_CODE);
                } catch (Exception e) {
                    filePathCallback = null;
                    return false;
                }
                return true;
            }

            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                // target=_blank：直接在当前窗口打开
                WebView.HitTestResult r = view.getHitTestResult();
                String url = r == null ? null : r.getExtra();
                if (url != null && !url.isEmpty()) {
                    web.loadUrl(url);
                    return false;
                }
                return false;
            }

            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    String[] wanted = request.getResources();
                    boolean needPerm = false;
                    for (String r : wanted) {
                        if (r.equals(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
                                && checkSelfPermission(android.Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) needPerm = true;
                        if (r.equals(PermissionRequest.RESOURCE_AUDIO_CAPTURE)
                                && checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) needPerm = true;
                    }
                    if (needPerm) {
                        request.deny();
                        requestPermissions(new String[]{android.Manifest.permission.CAMERA,
                                android.Manifest.permission.RECORD_AUDIO}, PERM_CODE);
                    } else {
                        request.grant(wanted);
                    }
                });
            }
        });

        Log.i(TAG, "webview ready ua=" + WebSettings.getDefaultUserAgent(this));
        // 自动化实测用：允许通过 intent extra 覆盖起始页（仅限内联 data: 页面，不引入外部 URL 注入面）
        String override = getIntent() == null ? null : getIntent().getStringExtra("wxurl");
        String startUrl = HOME;
        if (override != null && override.startsWith("data:text/html")) {
            startUrl = override;
            Log.i(TAG, "start url overridden by test harness");
        }
        if (savedInstanceState == null) web.loadUrl(startUrl);
        else web.restoreState(savedInstanceState);
    }

    /**
     * 深色模式：让 WebView 走「强制深色」——等价于桌面浏览器里的"强制为此站点启用深色"。
     * 文心网页自身对深色适配不完整（输入框、选中标签、列表卡片仍是浅色，正文对比偏低），
     * 开启后 WebView 会统一做算法化反色，配合注入的兜底样式即可消除深色下的白块与低对比文字。
     */
    private void applyDarkMode(WebSettings s) {
        boolean dark = isDark();
        try {
            WebSettingsCompat.setForceDark(s, dark
                    ? WebSettingsCompat.FORCE_DARK_ON : WebSettingsCompat.FORCE_DARK_OFF);
        } catch (Throwable t) {
            Log.w(TAG, "setForceDark failed: " + t);
        }
        try {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(s, dark);
        } catch (Throwable t) {
            Log.w(TAG, "algorithmic darkening failed: " + t);
        }
        Log.i(TAG, "dark mode applied: " + dark);
    }

    private boolean isInternalHost(String host) {
        if (host == null) return false;
        return host.endsWith("baidu.com");
    }

    /**
     * Chromium 引擎调优：必须在第一个 WebView 实例化之前调用。
     * 反射访问 WebView 内置的 org.chromium.base.CommandLine（不在隐藏 API 灰名单内），
     * 打开 GPU 光栅化/零拷贝等开关；任何机型不支持都静默跳过。
     *
     * 注意：模拟器（goldfish/ranchu + 软件 GPU）上加这些 GPU 开关会让渲染进程直接崩掉，
     * 因此模拟器环境下整体跳过，真机才应用。
     */
    private void applyChromiumTuning() {
        if (isEmulator()) {
            Log.i(TAG, "skip chromium tuning on emulator");
            return;
        }
        String[] switches = {
                "--ignore-gpu-blocklist",
                "--enable-gpu-rasterization",
                "--enable-zero-copy",
                "--enable-quic",
                "--force-gpu-mem-available-mb=512"
        };
        try {
            Class<?> cmd = Class.forName("org.chromium.base.CommandLine");
            try { cmd.getMethod("init", java.io.File.class).invoke(null, (Object) null); } catch (Throwable ignored) { }
            Object instance = cmd.getMethod("getInstance").invoke(null);
            if (instance == null) return;
            java.lang.reflect.Method append = cmd.getMethod("appendSwitch", String.class);
            for (String sw : switches) {
                try { append.invoke(instance, sw); } catch (Throwable ignored) { }
            }
        } catch (Throwable ignored) { }
    }

    /**
     * 动画结束后真正压缩一次 WebView【布局高度】（bottomMargin，而非 padding）：
     * Chromium WebView 内 fixed 元素锚定自身视口底边，只有 View 高度变小，
     * 网页 visualViewport 才收缩、fixed 输入框才稳定停在键盘上方。
     */
    private void setSettledMargin(int bottom) {
        if (web == null) return;
        settledMargin = bottom;
        ViewGroup.LayoutParams lp = web.getLayoutParams();
        if (lp instanceof FrameLayout.LayoutParams) {
            FrameLayout.LayoutParams flp = (FrameLayout.LayoutParams) lp;
            if (flp.bottomMargin != bottom) {
                flp.bottomMargin = bottom;
                web.setLayoutParams(flp);
            }
        }
    }

    private void scheduleApply() {
        if (root == null) return;
        root.removeCallbacks(applyRunnable);
        root.postDelayed(applyRunnable, 60);
    }

    private void applyTargetPadding() {
        if (imeAnimating) return;      // IME 动画期间由位移接管
        if (web != null) web.setTranslationY(0f);
        setSettledMargin(Math.max(imePadModern, imePadLegacy));
    }

    /**
     * 键盘三通道。核心策略：IME 动画期间【不改布局】，只用 translationY 平移 WebView
     * （GPU 合成，丝滑且不会因逐帧 resize 露出黑缝）；动画结束同一时刻清零位移、落一次布局，
     * 首尾位置严格相等所以无跳变。收起方向在 onStart 先放开布局、改用位移承接。
     * 注意：绝不使用 HIDE_NAVIGATION/ IMMERSIVE / FULLSCREEN（会让 IME insets 失效）。
     */
    private void setupKeyboard() {
        ViewCompat.setWindowInsetsAnimationCallback(root,
                new WindowInsetsAnimationCompat.Callback(
                        WindowInsetsAnimationCompat.Callback.DISPATCH_MODE_STOP) {
                    @Override
                    public WindowInsetsAnimationCompat.BoundsCompat onStart(
                            WindowInsetsAnimationCompat anim,
                            WindowInsetsAnimationCompat.BoundsCompat bounds) {
                        if ((anim.getTypeMask() & WindowInsetsCompat.Type.ime()) != 0) {
                            imeAnimating = true;
                            if (settledMargin > 0) {
                                web.setTranslationY(-settledMargin);
                                setSettledMargin(0);
                            } else {
                                web.setTranslationY(0f);
                            }
                        }
                        return bounds;
                    }

                    @Override
                    public WindowInsetsCompat onProgress(WindowInsetsCompat insets,
                                                         java.util.List<WindowInsetsAnimationCompat> anims) {
                        for (WindowInsetsAnimationCompat a : anims) {
                            if ((a.getTypeMask() & WindowInsetsCompat.Type.ime()) != 0) {
                                Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
                                Insets nav = insets.getInsets(WindowInsetsCompat.Type.navigationBars());
                                navBarH = nav.bottom;
                                lastAnimH = Math.max(0, ime.bottom - nav.bottom);
                                web.setTranslationY(-lastAnimH);
                            }
                        }
                        return insets;
                    }

                    @Override
                    public void onEnd(WindowInsetsAnimationCompat anim) {
                        if ((anim.getTypeMask() & WindowInsetsCompat.Type.ime()) != 0) {
                            imeAnimating = false;
                            web.setTranslationY(0f);
                            setSettledMargin(lastAnimH);
                            scheduleApply();
                        }
                    }
                });

        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            Insets nav = insets.getInsets(WindowInsetsCompat.Type.navigationBars());
            navBarH = nav.bottom;
            imePadModern = Math.max(0, ime.bottom - nav.bottom);
            scheduleApply();
            return insets;
        });

        // 无动画 ROM 兜底：全局布局测量
        root.getViewTreeObserver().addOnGlobalLayoutListener(new ViewTreeObserver.OnGlobalLayoutListener() {
            @Override
            public void onGlobalLayout() {
                if (root == null) return;
                root.getWindowVisibleDisplayFrame(visibleRect);
                int screenH = root.getRootView().getHeight();
                int covered = screenH - visibleRect.bottom;
                imePadLegacy = Math.max(0, covered - navBarH);
                scheduleApply();
            }
        });
        root.post(() -> ViewCompat.requestApplyInsets(root));
    }

    /** 透明系统栏 + 内容铺到其下 */
    private void applyImmersive() {
        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        w.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        w.setStatusBarColor(0x00000000);
        w.setNavigationBarColor(0x00000000);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) w.setNavigationBarContrastEnforced(false);
        int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
        View decor = w.getDecorView();
        if (!isDark()) flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        decor.setSystemUiVisibility(flags);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = w.getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            w.setAttributes(lp);
        }
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        applyImmersive();
        getWindow().setBackgroundDrawable(new ColorDrawable(pageBgColor()));
        if (root != null) root.setBackgroundColor(pageBgColor());
        if (web != null) {
            web.setBackgroundColor(pageBgColor());
            applyDarkMode(web.getSettings());
            web.evaluateJavascript(earlyJs(), null);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applyImmersive();
            if (root != null) ViewCompat.requestApplyInsets(root);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_CODE) {
            if (filePathCallback == null) return;
            Uri[] result = (data == null || resultCode != RESULT_OK) ? null
                    : WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            filePathCallback.onReceiveValue(result);
            filePathCallback = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else moveTaskToBack(true);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (web != null) web.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        Log.i(TAG, "onDestroy");
        if (web != null) {
            if (web.getParent() instanceof ViewGroup) ((ViewGroup) web.getParent()).removeView(web);
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
