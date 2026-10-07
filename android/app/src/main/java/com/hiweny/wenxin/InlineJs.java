package com.hiweny.wenxin;

/**
 * 纯 JVM、无 Android 依赖的内联脚本构造器（便于用 javac 单独编译校验拼接结果）。
 *
 * early      —— document-start 极早期脚本：APK 标志位、桌面版式视口、首帧底色压闪、输入聚焦降载。
 * fullBootstrap —— 早期脚本 + 油猴脚本本体，__WX_BOOTED__ 保证多次调用幂等。
 */
final class InlineJs {

    private InlineJs() { }

    /** 桌面版网站式布局视口宽度：站点按 980 宽渲染，油猴脚本再缩放补偿回手机宽度 */
    private static final int VIEWPORT_W = 980;

    static String earlyInner(boolean dark, String bg) {
        return ""
            // ① 标志位：油猴脚本据此知道自己跑在 APK 壳里（视口宽度、性能策略）
            + "window.__WX_APK__=true;"
            + "window.__WX_VIEWPORT_WIDTH__='" + VIEWPORT_W + "';"
            + "window.__WX_FORCE_MOBILE__=true;"

            // ② 桌面版式视口：与手机浏览器「请求桌面版网站」等价
            + "try{if(!window.__WX_VPT__){window.__WX_VPT__=1;"
            + "var W='" + VIEWPORT_W + "';var C='width='+W+',user-scalable=no,viewport-fit=cover';"
            + "var setVP=function(){var m=document.querySelector('meta[name=viewport]');"
            + "if(!m){var p=document.head||document.documentElement;if(!p)return;"
            + "m=document.createElement('meta');m.setAttribute('name','viewport');p.appendChild(m);}"
            + "if(m.getAttribute('content')!==C)m.setAttribute('content',C);};"
            + "setVP();var n=0;var vt=setInterval(function(){n++;setVP();if(n>60)clearInterval(vt);},50);}}catch(e){}"

            // ③ 首帧底色：压住官网默认底色，等我们的背景层接管后再撤掉，避免启动白闪/黑闪
            + "try{var fp=document.getElementById('__wx_firstpaint');"
            + "if(!fp){fp=document.createElement('style');fp.id='__wx_firstpaint';"
            + "fp.textContent='html,body{background:" + bg + " !important}'"
            + ";(document.head||document.documentElement).appendChild(fp);"
            + "var kill=function(){var e=document.getElementById('__wx_firstpaint');if(e)e.parentNode.removeChild(e);return !!e;};"
            + "var t0=Date.now();var ft=setInterval(function(){"
            + "if(document.getElementById('wx-bg')||(document.body&&document.body.classList.contains('wx-bg'))||Date.now()-t0>4000){"
            + "clearInterval(ft);kill();}},100);}}catch(e){}"

            // ④ 输入聚焦降载：磨砂输入框在逐帧重采样时容易闪/卡，聚焦期间切近不透明纯色兜底
            + "try{if(!document.getElementById('__wx_apk_css')){var st=document.createElement('style');"
            + "st.id='__wx_apk_css';"
            + "st.textContent='"
            + "body.wx-beauty .ci-wrapper:focus-within{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;"
            + "background:rgba(255,255,255,.94)!important}"
            + "body.wx-beauty .ci-wrapper:focus-within *{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}"
            + "';"
            + "var mnt=function(){var p=document.head||document.documentElement;if(!p){setTimeout(mnt,4);return;}p.appendChild(st);};mnt();}}catch(e){}"

            // ⑤ 深色跟随系统时，允许页面自行使用暗色（WebView 的 prefers-color-scheme 已随 app 主题）
            + "try{document.documentElement.setAttribute('data-wx-shell','apk');}catch(e){}";
    }

    static String early(boolean dark, String bg) {
        return "(function(){" + earlyInner(dark, bg) + "})();";
    }

    static String fullBootstrap(boolean dark, String bg, String injectJs) {
        return "(function(){"
                + "if(window.__WX_BOOTED__)return;window.__WX_BOOTED__=true;"
                + earlyInner(dark, bg)
                + "\n" + injectJs + "\n"
                + "})();";
    }
}
