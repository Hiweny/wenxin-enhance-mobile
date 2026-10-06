// ==UserScript==
// @name         文心助手 · 手机版适配（PC网页改造）
// @namespace    https://github.com/Hiweny/wenxin-enhance-mobile
// @version      0.6.1
// @description  将百度文心助手电脑版网页 (wenxin.baidu.com / chat.baidu.com) 全量改造为移动端布局：侧栏抽屉、底部输入框、消息重排、默认工作模式、任务侧栏独立页。适配手机使用电脑版 UA 的场景。
// @author       Hiweny
// @match        *://wenxin.baidu.com/*
// @match        *://chat.baidu.com/*
// @match        *://yiyan.baidu.com/*
// @icon         https://www.baidu.com/favicon.ico
// @run-at       document-start
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  var VERSION = '0.6.1';
  var MOBILE_MAX = 1200;
  var FORCE_OFF = /[?&#]wxmobile=0/.test(location.href);
  function isMobile() {
    if (FORCE_OFF) return false;
    if (window.innerWidth > 1400) return false;           // 真·宽屏桌面，不启用
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true;
    if (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) return true;
    if (/Android|iPhone|iPad|iPod|Mobile|HarmonyOS/i.test(navigator.userAgent)) return true;
    return window.innerWidth <= MOBILE_MAX;
  }
  function q(sel, root) { return (root || document).querySelector(sel); }
  function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  window.__WX_MOBILE__ = {
    version: VERSION,
    open: function () { openDrawer(); },
    close: function () { closeDrawer(); },
    toggle: function () { toggleDrawer(); },
    sync: function () { sync(); }
  };

  function openDrawer() {
    if (!isMobile()) return;
    document.body.classList.add('wx-drawer-open');
    try { history.pushState({ wx: 'drawer' }, ''); } catch (e) {}
  }
  function closeDrawer() { document.body.classList.remove('wx-drawer-open'); }
  function toggleDrawer() {
    if (document.body.classList.contains('wx-drawer-open')) closeDrawer(); else openDrawer();
  }

  /* ---------------- viewport ---------------- */
  var VP_CONTENT = 'width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover';
  function fixViewport() {
    var m = document.querySelector('meta[name="viewport"]');
    if (!m) {
      m = document.createElement('meta');
      m.setAttribute('name', 'viewport');
      (document.head || document.documentElement).appendChild(m);
    }
    if (m.getAttribute('content') !== VP_CONTENT) m.setAttribute('content', VP_CONTENT);
  }

  /* ---------------- 样式 ---------------- */
  var CSS = [
    /* 基础 */
    'html,body{width:100%!important;max-width:100%!important;overflow-x:hidden!important;-webkit-text-size-adjust:100%}',
    'body.wx-mobile{font-size:16px}',
    'body.wx-mobile [class*="_chat-container-main-wrapper"]{width:100%!important;max-width:100%!important}',
    'body.wx-mobile [class*="_chat-container-pc"]{width:100%!important;max-width:100%!important}',

    /* 侧栏 -> 抽屉 */
    'body.wx-mobile .chat-aside-container{position:fixed!important;left:0;top:0;bottom:0;width:300px!important;max-width:84vw;height:100%!important;z-index:1500;transform:translateX(-102%);transition:transform .28s cubic-bezier(.4,0,.2,1);will-change:transform;box-shadow:0 0 32px rgba(0,0,0,.20);background:#fff}',
    'body.wx-mobile.wx-drawer-open .chat-aside-container{transform:translateX(0)}',
    'body.wx-mobile .chat-aside-container .chat-aside-wrapper{width:100%!important;height:100%!important}',
    'body.wx-mobile .chat-aside-container .chat-aside{width:100%!important;height:100%!important;position:relative!important;left:0!important;right:auto!important;transform:none!important;margin:0!important}',
    'body.wx-mobile #fold-aside-new{display:none!important}',

    /* 遮罩 */
    '#wx-scrim{position:fixed;left:0;right:0;top:0;bottom:0;background:rgba(0,0,0,.45);z-index:1400;opacity:0;pointer-events:none;transition:opacity .28s;-webkit-tap-highlight-color:transparent}',
    'body.wx-mobile.wx-drawer-open #wx-scrim{opacity:1;pointer-events:auto}',

    /* 顶栏 */
    'body.wx-mobile [class*="_chat-top-bar-new"]{position:fixed!important;top:0;left:0;right:0;width:100%!important;max-width:100%!important;height:52px!important;z-index:1200;display:flex!important;align-items:center!important;box-sizing:border-box!important;padding:0 8px!important;padding-left:calc(8px + env(safe-area-inset-left,0px))!important;padding-right:calc(8px + env(safe-area-inset-right,0px))!important;backdrop-filter:saturate(180%) blur(14px);-webkit-backdrop-filter:saturate(180%) blur(14px);background:rgba(255,255,255,.82)!important;border-bottom:1px solid rgba(0,0,0,.06)}',
    'body.wx-mobile [class*="_chat-top-bar-new"] #chat-top-tab-list{margin-left:auto!important;font-size:13px!important;gap:6px!important;align-items:center!important;padding-right:4px!important}',
    'body.wx-mobile [class*="_chat-top-bar-new"] #chat-top-tab-list > *{white-space:nowrap!important;flex:0 0 auto!important}',
    'body.wx-mobile [class*="_chat-container-main_"]{padding-top:52px!important;box-sizing:border-box!important}',

    /* 汉堡 */
    '#wx-hamburger{display:flex;align-items:center;justify-content:center;width:40px;height:40px;margin-right:2px;flex:0 0 auto;border-radius:10px;cursor:pointer;-webkit-tap-highlight-color:transparent}',
    '#wx-hamburger:active{background:rgba(0,0,0,.06)}',
    '#wx-hamburger i{display:block;width:20px;height:2px;background:#333;border-radius:2px;position:relative}',
    '#wx-hamburger i:before,#wx-hamburger i:after{content:"";position:absolute;left:0;width:20px;height:2px;background:#333;border-radius:2px}',
    '#wx-hamburger i:before{top:-6px}#wx-hamburger i:after{top:6px}',

    /* 底部输入区（对话页 + 首页） */
    'body.wx-mobile [class*="_chat-bottom-wrapper"]{padding-bottom:calc(env(safe-area-inset-bottom,0px) + 2px)!important}',
    'body.wx-mobile .chat-input-box-pc{width:100%!important}',
    'body.wx-mobile #new-input-wrapper{padding-left:12px!important;padding-right:12px!important;box-sizing:border-box!important}',
    'body.wx-mobile #chat-input-home{width:100%!important}',
    'body.wx-mobile .ci-wrapper-border,body.wx-mobile .ci-wrapper{border-radius:22px!important}',
    'body.wx-mobile #chat-textarea,body.wx-mobile .ci-textarea{font-size:17px!important;line-height:1.5!important}',
    /* 输入框内部按钮统一（消除矩形色块） */
    'body.wx-mobile .more-dropdown-trigger{background:transparent!important;box-shadow:none!important}',
    'body.wx-mobile .right-tools-wrapper{background:transparent!important;box-shadow:none!important}',
    'body.wx-mobile .ci-input-mode-button{background:transparent!important}',

    /* 消息字号 */
    'body.wx-mobile #conversation-flow-content{font-size:16px!important;line-height:1.62!important}',
    'body.wx-mobile [class*="_question-block"]{font-size:16px!important;line-height:1.5!important}',
    'body.wx-mobile .cosd-markdown,body.wx-mobile .cosd-markdown-content,body.wx-mobile .marklang-paragraph{font-size:16px!important;line-height:1.62!important}',
    'body.wx-mobile .cs-question-bubble.cs-bubble{max-width:86%!important}',
    /* 消息操作栏：允许换行，避免 7 个图标挤一行 */
    'body.wx-mobile .cs-answer-hover-menu-container,body.wx-mobile .cs-hover-menu{flex-wrap:wrap!important;gap:4px 8px!important}',
    /* 底部合规小字 */
    'body.wx-mobile [class*="_home-footer-tip"]{font-size:12px!important}',
    'body.wx-mobile .chat-input-box-pc .tip,body.wx-mobile .ci-container .tip{font-size:12px!important;padding:2px 0 2px!important}',
    /* 消息区左右内边距 */
    'body.wx-mobile .chat-qa-container{padding-left:14px!important;padding-right:14px!important;box-sizing:border-box!important}',

    /* 右侧任务栏 -> 移动端全屏页（可关闭） */
    'body.wx-mobile [class*="_right-bar-wrapper"]:not([class*="_hide"]){position:fixed!important;left:0!important;right:0!important;top:0!important;bottom:0!important;width:100vw!important;max-width:100vw!important;height:100dvh!important;z-index:1600!important;background:#fff!important;box-shadow:none!important;overflow:hidden!important}',
    'body.wx-mobile.wx-rightbar-closed [class*="_right-bar-wrapper"]{display:none!important}',
    'body.wx-mobile [class*="_right-bar-divider-hit-area"]{display:none!important}',
    'body.wx-mobile [class*="_right-bar-wrapper"] [class*="workspace-stage"],body.wx-mobile [class*="_right-bar-wrapper"] .chat-right-bar{width:100%!important;max-width:100%!important}',

    /* 弹窗通用约束：不溢出屏幕 */
    'body.wx-mobile [class*="_more-dropdown"],body.wx-mobile [class*="message-panel-container"],body.wx-mobile [class*="message-center-settings"],body.wx-mobile .chat-aside-user-menu-content,body.wx-mobile [class*="_more-dropdown-wrapper"]{max-width:calc(100vw - 24px)!important}',
    'body.wx-mobile .ci-input-mode-panel{max-width:calc(100vw - 24px)!important;border-radius:16px!important;box-shadow:0 8px 32px rgba(0,0,0,.16)!important;backdrop-filter:blur(12px)}',
    'body.wx-mobile .ci-merge-upload-fixed-popover{max-width:calc(100vw - 24px)!important;border-radius:14px!important;box-shadow:0 8px 32px rgba(0,0,0,.16)!important}',

    /* 首页欢迎语 / 模式切换 / 推荐 */
    'body.wx-mobile #welcomeText{font-size:22px!important;line-height:1.45!important}',
    'body.wx-mobile [class*="_home-recommend-words-item"]{min-height:44px!important;font-size:15px!important}',

    /* 侧栏条目热区 */
    'body.wx-mobile .aside-main-tab{min-height:44px!important;font-size:15px!important}',
    'body.wx-mobile .chat-history-time-item,body.wx-mobile .chat-aside-new-item{min-height:42px!important}',
    'body.wx-mobile .chat-aside-container .chat-aside{box-sizing:border-box!important;padding-bottom:env(safe-area-inset-bottom,0px)!important}',

    /* 滚动惯性 */
    'body.wx-mobile #conversation-flow-content,body.wx-mobile .aside-scroll-container{-webkit-overflow-scrolling:touch!important}'
  ].join('\n');

  function injectCSS() {
    if (document.getElementById('wx-mobile-css')) return;
    var s = document.createElement('style');
    s.id = 'wx-mobile-css';
    s.type = 'text/css';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  /* ---------------- DOM 增强 ---------------- */
  function ensureScrim() {
    var s = document.getElementById('wx-scrim');
    if (!s) {
      s = document.createElement('div');
      s.id = 'wx-scrim';
      s.addEventListener('click', function () { closeDrawer(); });
      document.body.appendChild(s);
    }
    return s;
  }
  function makeHamburger() {
    var b = document.createElement('div');
    b.id = 'wx-hamburger';
    b.setAttribute('role', 'button');
    b.setAttribute('aria-label', '菜单');
    b.innerHTML = '<i></i>';
    b.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      toggleDrawer();
    });
    return b;
  }
  function ensureHamburger() {
    if (!isMobile()) { var h0 = document.getElementById('wx-hamburger'); if (h0) h0.remove(); return; }
    var bar = q('[class*="_chat-top-bar-new"]');
    if (!bar) return;
    if (!q('#wx-hamburger', bar)) bar.insertBefore(makeHamburger(), bar.firstChild);
  }
  function markMobile() { document.body.classList.toggle('wx-mobile', isMobile()); }

  /* 默认工作模式 */
  var didDefaultMode = false;
  function applyDefaultMode() {
    if (didDefaultMode) return;
    var wrap = q('[class*="_home-mode-switch-wrapper"]');
    if (!wrap) return;
    var items = qa('[class*="_home-mode-switch-item"]', wrap);
    if (items.length < 2) return;
    var active = items.filter(function (b) { return /_home-mode-switch-item-active/.test(b.className || ''); })[0];
    if (active && /工作/.test(active.textContent || '')) { didDefaultMode = true; return; }
    var work = items.filter(function (b) { return /工作/.test(b.textContent || ''); })[0] || items[1];
    if (work) { work.click(); didDefaultMode = true; }
  }

  /* 右侧任务栏：可见时给一个关闭按钮，关掉后置 wx-rightbar-closed */
  var lastRightHidden = null;
  function ensureRightBar() {
    var rb = q('[class*="_right-bar-wrapper"]');
    if (!rb) return;
    var hidden = /_hide/.test(rb.className || '');
    if (lastRightHidden === null) lastRightHidden = hidden;
    if (lastRightHidden !== hidden) {
      lastRightHidden = hidden;
      if (!hidden) document.body.classList.remove('wx-rightbar-closed'); // 新展开时重置
    }
    var btn = document.getElementById('wx-rightbar-close');
    if (hidden) { if (btn) btn.style.display = 'none'; return; }
    if (!btn) {
      btn = document.createElement('div');
      btn.id = 'wx-rightbar-close';
      btn.textContent = '\u2715';
      btn.style.cssText = 'position:fixed;top:calc(env(safe-area-inset-top,0px) + 10px);right:12px;z-index:1700;width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,.06);display:flex;align-items:center;justify-content:center;font-size:17px;color:#333;cursor:pointer;-webkit-tap-highlight-color:transparent';
      btn.addEventListener('click', function () { document.body.classList.add('wx-rightbar-closed'); });
      document.body.appendChild(btn);
    }
    btn.style.display = 'flex';
  }

  function sync() {
    if (!document.body) return;
    markMobile();
    if (!isMobile()) { document.body.classList.remove('wx-drawer-open'); return; }
    ensureScrim();
    ensureHamburger();
    applyDefaultMode();
    ensureRightBar();
  }

  var pending = false;
  function scheduleSync() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; sync(); });
  }

  function whenDocReady(fn) {
    if (document.documentElement && document.head) { fn(); return; }
    var t = setInterval(function () {
      if (document.documentElement && document.head) { clearInterval(t); fn(); }
    }, 10);
  }
  whenDocReady(function () { fixViewport(); injectCSS(); });

  function debugBadge() {
    if (!/[#&?]wxdebug/.test(location.href)) return;
    if (document.getElementById('wx-debug')) return;
    var d = document.createElement('div');
    d.id = 'wx-debug';
    d.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99999;background:#111;color:#0f0;font:12px/1.5 monospace;padding:6px 8px;border-radius:8px;max-width:82vw;word-break:break-all';
    d.textContent = 'WXMobile v' + VERSION + ' | innerW=' + window.innerWidth + ' | mobile=' + isMobile() + ' | touch=' + navigator.maxTouchPoints;
    document.body.appendChild(d);
  }

  function boot() {
    try { console.log('[WXMobile] v' + VERSION + ' loaded, mobile=' + isMobile() + ', innerWidth=' + window.innerWidth); } catch (e) {}
    injectCSS();
    sync();
    debugBadge();
    var mo = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var an = muts[i].addedNodes;
        if (an && an.length) { scheduleSync(); return; }
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('resize', scheduleSync, { passive: true });
    window.addEventListener('popstate', function () { closeDrawer(); scheduleSync(); });
    /* 点抽屉里的条目后自动收起抽屉 */
    document.addEventListener('click', function (e) {
      if (!document.body.classList.contains('wx-drawer-open')) return;
      var t = e.target;
      var hit = t && t.closest && t.closest('.chat-history-time-item,.chat-aside-new-item,.aside-main-tab,.new-dialog-container,.chat-aside-user-menu-item');
      if (hit) setTimeout(closeDrawer, 160);
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
