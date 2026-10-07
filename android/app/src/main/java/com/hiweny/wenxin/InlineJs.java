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

            // ⑤ 深色兜底：站点对深色适配不完整（输入框/选中标签/列表卡片仍是浅色、正文对比偏低），
            //    这里只做「最小必要修补」——算法化深色（原生层）已经在做统一反色，这层是兜底与对比度校正。
            + "try{if(!document.getElementById('__wx_apk_dark')){var dk=document.createElement('style');"
            + "dk.id='__wx_apk_dark';"
            + "dk.textContent='"
            + "@media (prefers-color-scheme:dark){"
            + "body.wx-mobile .history-chat-header-box{background:rgba(255,255,255,.06)!important}"
            + "body.wx-mobile .history-chat-header-box *{color:#c9cdd6!important}"
            + "body.wx-mobile [class*=\"home-mode-switch-indicator\"]{background:rgba(255,255,255,.16)!important}"
            + "body.wx-mobile [class*=\"home-mode-switch-item\"]{color:#c9cdd6!important}"
            + "body.wx-mobile .history-item-text{color:#c9cdd6!important}"
            + "body.wx-mobile #new-input-wrapper::before{background:transparent!important}"
            + "body.wx-mobile textarea#chat-textarea{background:transparent!important;color:#e8eaed!important}"
            + "body.wx-beauty .ci-wrapper:not(:focus-within){background:rgba(32,34,42,.62)!important}"
            + "body.wx-beauty .ci-wrapper-border{box-shadow:inset 0 0 0 1.8px rgba(165,182,255,.85)!important;background:transparent!important}"
            + "[class*=\"markdown\"]{color:#e6e8ec!important}"
            + "[class*=\"markdown\"] p,[class*=\"markdown\"] li,[class*=\"markdown\"] h1,[class*=\"markdown\"] h2,[class*=\"markdown\"] h3{color:#e6e8ec!important}"
            + "[class*=\"markdown\"] code,[class*=\"markdown\"] pre{color:#e6e8ec!important}"
            + "}"
            + "';"
            + "var mnt2=function(){var p2=document.head||document.documentElement;if(!p2){setTimeout(mnt2,4);return;}p2.appendChild(dk);};mnt2();}}catch(e){}"

            // ⑥ 弹窗尺寸修复：登录弹窗等 PC 布局浮层在窄屏下会超出视口、底部被截断。
            //    不依赖具体类名——扫描「定位浮层且尺寸接近/超过视口」的容器并约束尺寸+允许滚动。
            + "try{if(!window.__WX_DLG_FIX__){window.__WX_DLG_FIX__=1;"
            + "var fixDlg=function(){"
            + "var de=document.documentElement;"
            + "var vw=de.clientWidth||window.innerWidth||360;"
            + "var vh=de.clientHeight||window.innerHeight||640;"
            + "var ns=document.querySelectorAll('div,section,form');"
            + "for(var i=0;i<ns.length;i++){var el=ns[i];if(el.getAttribute('data-wxfit')==='1')continue;"
            + "var cs=getComputedStyle(el);if(cs.display==='none'||cs.visibility==='hidden'||parseFloat(cs.opacity)<0.05)continue;"
            + "var pos=cs.position;if(pos!=='fixed'&&pos!=='absolute')continue;"
            + "var r=el.getBoundingClientRect();"
            + "if(r.width<vw*0.55||r.height<vh*0.22)continue;"
            + "if(r.width<=vw*0.98&&r.height<=vh*0.90&&r.top>-2)continue;"
            + "el.setAttribute('data-wxfit','1');"
            + "el.style.setProperty('max-width',Math.round(vw*0.94)+'px','important');"
            + "el.style.setProperty('max-height',Math.round(vh*0.88)+'px','important');"
            + "el.style.setProperty('overflow','auto','important');"
            + "el.style.setProperty('box-sizing','border-box','important');"
            + "el.style.setProperty('top','max(4px,calc(50% - '+Math.round(vh*0.44)+'px))','important');"
            + "}"
            + "};"
            + "fixDlg();var dt=setInterval(fixDlg,800);setTimeout(function(){clearInterval(dt);},180000);"
            + "window.__WX_FIX_DIALOGS__=fixDlg;"
            + "}}catch(e){}"

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
