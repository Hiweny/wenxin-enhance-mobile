// ==UserScript==
// @name         文心助手 · 手机版适配（PC网页改造）
// @namespace    https://github.com/Hiweny/wenxin-enhance-mobile
// @version      0.13.1
// @description  将百度文心助手电脑版网页 (wenxin.baidu.com / chat.baidu.com) 全量改造为移动端布局：侧栏抽屉、底部输入框、消息重排、默认工作模式、任务侧栏全屏页、桌面版网站模式缩放补偿。适配手机使用电脑版 UA 的场景。
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

  var VERSION = '0.13.1';
  var MOBILE_MAX = 1200;
  var SCALE_TARGET = 360;      // 缩放补偿后的目标逻辑宽度
  var FORCE_OFF = /[?&#]wxmobile=0/.test(location.href);

  /* ===== 读取"真实"视口尺寸（先保存原始描述符，shim 后仍可读到真值） ===== */
  var _oIW = null, _oIH = null, _oCW = null, _oCH = null;
  try { _oIW = Object.getOwnPropertyDescriptor(window, 'innerWidth'); } catch (e) {}
  try { _oIH = Object.getOwnPropertyDescriptor(window, 'innerHeight'); } catch (e) {}
  try { _oCW = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth'); } catch (e) {}
  try { _oCH = Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight'); } catch (e) {}
  function realW() {
    try { if (_oIW && _oIW.get) return _oIW.get.call(window); } catch (e) {}
    return window.innerWidth;
  }
  function realH() {
    try { if (_oIH && _oIH.get) return _oIH.get.call(window); } catch (e) {}
    return window.innerHeight;
  }

  /* ===== 把视口尺寸"伪装"成手机尺寸，让站点按手机宽度布局 ===== */
  var SHIM = { w: 0, h: 0, on: false };
  function shimEl(el) {
    if (!el) return;
    try {
      Object.defineProperty(el, 'clientWidth', { configurable: true, get: function () { return SHIM.w; } });
      Object.defineProperty(el, 'clientHeight', { configurable: true, get: function () { return SHIM.h; } });
    } catch (e) {}
  }
  function applyShim() {
    try { Object.defineProperty(window, 'innerWidth', { configurable: true, get: function () { return SHIM.w; } }); } catch (e) {}
    try { Object.defineProperty(window, 'innerHeight', { configurable: true, get: function () { return SHIM.h; } }); } catch (e) {}
    shimEl(document.documentElement);
    if (document.body) shimEl(document.body);
    SHIM.on = true;
  }
  function removeShim() {
    if (!SHIM.on) return;
    try { if (_oIW) Object.defineProperty(window, 'innerWidth', _oIW); else delete window.innerWidth; } catch (e) {}
    try { if (_oIH) Object.defineProperty(window, 'innerHeight', _oIH); else delete window.innerHeight; } catch (e) {}
    try { delete document.documentElement.clientWidth; delete document.documentElement.clientHeight; } catch (e) {}
    if (document.body) {
      try { delete document.body.clientWidth; delete document.body.clientHeight; } catch (e) {}
    }
    SHIM.on = false;
  }

  function isTouchDevice() {
    return (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints || 0) > 0 || /Android|iPhone|iPad|iPod|Mobile|HarmonyOS/i.test(navigator.userAgent);
  }
  function isMobile() {
    if (FORCE_OFF) return false;
    if (realW() > 1400) return false;
    return isTouchDevice() || realW() <= MOBILE_MAX;
  }

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

  /* ===== viewport meta ===== */
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

  /* ===== 样式 ===== */
  var CSS = [
    'html,body{width:100%!important;max-width:100%!important;overflow-x:hidden!important;-webkit-text-size-adjust:100%}',
    'body.wx-mobile{font-size:16px}',

    /* 禁双击缩放 */
    'html{touch-action:manipulation!important}',
    'body{touch-action:manipulation!important}',

    /* 缩放补偿模式基础 */
    'body.wx-scaled,body.wx-scaled #app,body.wx-scaled #cs-container-scroll{height:var(--wx-lh,100%)!important;max-height:var(--wx-lh,100%)!important}',
    /* 首页内容被站点锚定在视口下方（偏移≈97%高度）导致上方大片空白 → 上移到约 32% 处 */
    'body.wx-scaled #new-input-wrapper{margin-top:calc(var(--wx-lh,0px) * 0.32)!important}',
    'body.wx-scaled #chat-input-home{top:calc(var(--wx-lh,0px) * 0.32)!important}',
    'body.wx-scaled #app,body.wx-scaled #cs-container-scroll{overflow:hidden!important}',
    'body.wx-scaled [class*="_chat-container-body"],body.wx-scaled [class*="_chat-container-wrapper"],body.wx-scaled [class*="_chat-container-pc"],body.wx-scaled [class*="_chat-container-main-wrapper"]{height:100%!important;max-height:100%!important}',
    /* 站点大量用 vw 单位（不受 shim 影响），统一改回逻辑宽度 */    'body.wx-scaled #cs-container-scroll,body.wx-scaled [class*="_chat-container-body"],body.wx-scaled [class*="_chat-container-wrapper"],body.wx-scaled [class*="_chat-container-pc"],body.wx-scaled [class*="_chat-container-main-wrapper"],body.wx-scaled [class*="_chat-container-main_"],body.wx-scaled [class*="_chat-container-main-area"],body.wx-scaled [class*="_chat-container-main-stream"],body.wx-scaled [class*="_chat-body-container"],body.wx-scaled [class*="_content-area"],body.wx-scaled #conversation-flow-container,body.wx-scaled #new-page,body.wx-scaled #chat-input-home,body.wx-scaled #new-input-wrapper,body.wx-scaled [class*="_chat-bottom-wrapper"],body.wx-scaled [class*="_chat-top-bar-new"]{width:var(--wx-lw,100%)!important;max-width:var(--wx-lw,100%)!important;min-width:0!important;box-sizing:border-box!important}',

    /* 侧栏 -> 抽屉 */
    'body.wx-mobile .chat-aside-container{position:fixed!important;left:0;top:0;bottom:0;width:300px!important;max-width:84%;height:100%!important;z-index:1500;transform:translateX(-102%);transition:transform .28s cubic-bezier(.4,0,.2,1);will-change:transform;box-shadow:0 0 32px rgba(0,0,0,.20);background:#fff}',
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

    /* 底部输入区 */
    'body.wx-mobile [class*="_chat-bottom-wrapper"]{padding-bottom:calc(env(safe-area-inset-bottom,0px) + 2px)!important;padding-left:12px!important;padding-right:12px!important;box-sizing:border-box!important}',
    'body.wx-mobile [class*="_chat-bottom-wrapper"] #cs-bottom,body.wx-mobile [class*="_chat-bottom-wrapper"] .chat-input-box-pc,body.wx-mobile [class*="_chat-bottom-wrapper"] .cs-rich-input,body.wx-mobile [class*="_chat-bottom-wrapper"] .ci-root{width:100%!important;max-width:100%!important;min-width:0!important;margin-left:0!important;margin-right:0!important;box-sizing:border-box!important}',
    'body.wx-mobile .chat-input-box-pc{width:100%!important}',
    'body.wx-mobile #new-input-wrapper{padding-left:12px!important;padding-right:12px!important;box-sizing:border-box!important}',
    'body.wx-mobile #chat-input-home{width:100%!important}',
    'body.wx-mobile .ci-wrapper-border,body.wx-mobile .ci-wrapper{border-radius:22px!important}',
    'body.wx-mobile #chat-textarea,body.wx-mobile .ci-textarea{font-size:17px!important;line-height:1.5!important}',
    'body.wx-mobile .more-dropdown-trigger{background:transparent!important;box-shadow:none!important}',
    /* 输入框内部固定 min-width:352px + 负 margin，窄屏会右溢出 → 纠正为自适应 */
    'body.wx-mobile #input-root{min-width:0!important;width:100%!important;margin-left:0!important;margin-right:0!important;max-width:100%!important}',
    'body.wx-mobile .chat-input-background{max-width:100%!important;box-sizing:border-box!important}',
    'body.wx-mobile .right-tools-wrapper{background:transparent!important;box-shadow:none!important}',
    'body.wx-mobile .ci-input-mode-button{background:transparent!important}',

    /* 消息字号 */
    'body.wx-mobile #conversation-flow-content{font-size:16px!important;line-height:1.62!important}',
    'body.wx-mobile [class*="_question-block"]{font-size:16px!important;line-height:1.5!important}',
    'body.wx-mobile .cosd-markdown,body.wx-mobile .cosd-markdown-content,body.wx-mobile .marklang-paragraph{font-size:16px!important;line-height:1.62!important}',
    'body.wx-mobile .cs-question-bubble.cs-bubble{max-width:86%!important}',
    'body.wx-mobile .cs-answer-hover-menu-container,body.wx-mobile .cs-hover-menu{flex-wrap:wrap!important;gap:4px 8px!important}',
    'body.wx-mobile [class*="_home-footer-tip"]{font-size:12px!important}',
    'body.wx-mobile .chat-input-box-pc .tip,body.wx-mobile .ci-container .tip{font-size:12px!important;padding:2px 0!important}',
    'body.wx-mobile .chat-qa-container{padding-left:14px!important;padding-right:14px!important;box-sizing:border-box!important}',

    /* 右侧任务栏 -> 移动端全屏页（可关闭） */
    'body.wx-mobile [class*="_right-bar-wrapper"]:not([class*="_hide"]){position:fixed!important;left:0!important;right:0!important;top:0!important;bottom:0!important;width:100%!important;max-width:100%!important;height:100%!important;z-index:1600!important;background:#fff!important;box-shadow:none!important;overflow:hidden!important}',
    /* 关闭时：只撤销我们的全屏覆盖，绝不设 display/visibility（否则站点布局计算拿到 0 尺寸会白屏） */
    'body.wx-rightbar-closed [class*="_right-bar-wrapper"]{position:static!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;width:auto!important;max-width:none!important;height:auto!important;overflow:visible!important}',
    'body.wx-rightbar-closed #wx-rightbar-close{display:none!important}',
    'body.wx-mobile [class*="_right-bar-divider-hit-area"]{display:none!important}',
    'body.wx-mobile [class*="_right-bar-wrapper"] [class*="workspace-stage"],body.wx-mobile [class*="_right-bar-wrapper"] .chat-right-bar{width:100%!important;max-width:100%!important}',
    /* 任务栏内部：内容框/预览/工具栏做移动端约束（仅作用于任务栏内部，避免影响其它页面） */
    'body.wx-mobile [class*="_right-bar-wrapper"] iframe{width:100%!important;max-width:100%!important;border:0!important}',
    'body.wx-mobile [class*="_right-bar-wrapper"] img,body.wx-mobile [class*="_right-bar-wrapper"] video,body.wx-mobile [class*="_right-bar-wrapper"] canvas{max-width:100%!important;height:auto!important}',
    'body.wx-mobile [class*="_right-bar-wrapper"] pre,body.wx-mobile [class*="_right-bar-wrapper"] table{max-width:100%!important;overflow-x:auto!important}',
    'body.wx-mobile [class*="_right-bar-wrapper"] [class*="_header"],body.wx-mobile [class*="_right-bar-wrapper"] [class*="_toolbar"]{flex-wrap:wrap!important;overflow-x:auto!important;max-width:100%!important;box-sizing:border-box!important}',
    'body.wx-mobile [class*="_right-bar-wrapper"] [class*="_scroll-wrapper"],body.wx-mobile [class*="_right-bar-wrapper"] [class*="_content"]{max-width:100%!important;box-sizing:border-box!important}',

    /* 弹窗约束 */
    'body.wx-mobile [class*="_more-dropdown"],body.wx-mobile [class*="message-panel-container"],body.wx-mobile [class*="message-center-settings"],body.wx-mobile .chat-aside-user-menu-content,body.wx-mobile [class*="_more-dropdown-wrapper"]{max-width:calc(100vw - 24px)!important}',
    'body.wx-mobile .ci-input-mode-panel{max-width:calc(100vw - 24px)!important;border-radius:16px!important;box-shadow:0 8px 32px rgba(0,0,0,.16)!important}',
    'body.wx-mobile .ci-merge-upload-fixed-popover{max-width:calc(100vw - 24px)!important;border-radius:14px!important;box-shadow:0 8px 32px rgba(0,0,0,.16)!important}',

    /* 首页 */
    'body.wx-mobile #welcomeText{font-size:22px!important;line-height:1.45!important}',
    'body.wx-mobile [class*="_home-recommend-words-item"]{min-height:44px!important;font-size:15px!important}',

    /* 侧栏条目 */
    'body.wx-mobile .aside-main-tab{min-height:44px!important;font-size:15px!important}',
    'body.wx-mobile .chat-history-time-item,body.wx-mobile .chat-aside-new-item{min-height:42px!important}',
    'body.wx-mobile .chat-aside-container .chat-aside{padding-bottom:env(safe-area-inset-bottom,0px)!important}',

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

  /* ===== DOM 增强 ===== */
  function q(sel, root) { return (root || document).querySelector(sel); }
  function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

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
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); toggleDrawer(); });
    return b;
  }
  function ensureHamburger() {
    if (!isMobile()) { var h0 = document.getElementById('wx-hamburger'); if (h0) h0.remove(); return; }
    var bar = q('[class*="_chat-top-bar-new"]');
    if (!bar) return;
    if (!q('#wx-hamburger', bar)) bar.insertBefore(makeHamburger(), bar.firstChild);
  }
  function markMobile() { if (document.body) document.body.classList.toggle('wx-mobile', isMobile()); }

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

  /* 右侧任务栏关闭按钮 */
  var lastRightHidden = null;
  var hideToken = null;       // 站点自己的隐藏类（如 _hide_xxx），用它关闭最安全
  function captureHideToken(rb) {
    var m = (rb.className || '').match(/_hide[\w-]*/);
    if (m && m[0]) hideToken = m[0];
  }
  function ensureRightBar() {
    var rb = q('[class*="_right-bar-wrapper"]');
    if (!rb) return;
    var hidden = /_hide/.test(rb.className || '');
    if (hidden) captureHideToken(rb);
    if (lastRightHidden === null) lastRightHidden = hidden;
    if (lastRightHidden !== hidden) {
      lastRightHidden = hidden;
      if (!hidden) document.body.classList.remove('wx-rightbar-closed');
    }
    var btn = document.getElementById('wx-rightbar-close');
    if (hidden) { if (btn) btn.style.display = 'none'; return; }
    if (!btn) {
      btn = document.createElement('div');
      btn.id = 'wx-rightbar-close';
      btn.textContent = '\u2715';
      btn.style.cssText = 'position:fixed;top:calc(env(safe-area-inset-top,0px) + 10px);right:12px;z-index:1700;width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,.08);display:flex;align-items:center;justify-content:center;font-size:17px;color:#333;cursor:pointer;-webkit-tap-highlight-color:transparent';
      btn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        var r = q('[class*="_right-bar-wrapper"]');
        var clickedSite = false;
        if (r) {
          // 1) 优先触发站点自己的关闭/收起控件（这样才能让站点恢复对话区）
          try {
            var ctl = r.querySelector('[class*="collapse"],[class*="close"],[class*="back"],[class*="shrink"]');
            if (ctl && ctl.getBoundingClientRect().width > 0) { ctl.click(); clickedSite = true; }
          } catch (err) {}
          // 2) 再复用站点自己的 _hide 类（不改变盒子尺寸）
          if (!clickedSite && hideToken) { try { r.classList.add(hideToken); } catch (err) {} }
        }
        // 3) ESC 兜底（部分弹层响应 Esc）
        try {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
        } catch (err) {}
        // 4) 撤销我们的全屏覆盖（绝不设 display/visibility）
        document.body.classList.add('wx-rightbar-closed');
        btn.style.display = 'none';
        // 5) 安全网：若关闭后对话区没有内容（站点未恢复），自动刷新一次回到干净状态
        setTimeout(function () {
          try {
            var box = q('#conversation-flow-content');
            var hasMsg = box && box.querySelector('.chat-qa-container');
            var flagged = false;
            try { flagged = sessionStorage.getItem('wx-rb-reloaded') === '1'; } catch (err2) {}
            if (!hasMsg && !flagged) {
              try { sessionStorage.setItem('wx-rb-reloaded', '1'); } catch (err3) {}
              location.reload();
            }
          } catch (err4) {}
        }, 700);
      });
      document.body.appendChild(btn);
    }
    btn.style.display = 'flex';
  }

  /* 缩放补偿 */
  function applyDesktopScale() {
    if (!isMobile()) { removeShim(); document.documentElement.style.zoom = ''; document.documentElement.style.removeProperty('--wx-lw'); document.documentElement.style.removeProperty('--wx-lh'); if (document.body) document.body.classList.remove('wx-scaled'); return; }
    var vw = realW();
    var vh = (window.visualViewport && window.visualViewport.height) || realH();
    if (vw > 700 && isTouchDevice()) {
      var z = Math.min(3, Math.max(1.15, vw / SCALE_TARGET));
      z = Math.round(z * 1000) / 1000;
      var lw = Math.round(vw / z), lh = Math.round(vh / z);
      var changed = (SHIM.w !== lw) || (SHIM.h !== lh) || (document.documentElement.style.zoom !== String(z));
      SHIM.w = lw; SHIM.h = lh;
      applyShim();
      if (document.documentElement.style.zoom !== String(z)) document.documentElement.style.zoom = String(z);
      var de = document.documentElement.style;
      de.setProperty('--wx-lw', lw + 'px');
      de.setProperty('--wx-lh', lh + 'px');
      if (document.body) document.body.classList.add('wx-scaled');
      if (changed) { try { window.dispatchEvent(new Event('resize')); } catch (e) {} }
    } else {
      removeShim();
      if (document.documentElement.style.zoom) document.documentElement.style.zoom = '';
      document.documentElement.style.removeProperty('--wx-lw');
      document.documentElement.style.removeProperty('--wx-lh');
      if (document.body) document.body.classList.remove('wx-scaled');
    }
  }

  function sync() {
    if (!document.body) return;
    markMobile();
    if (!isMobile()) { document.body.classList.remove('wx-drawer-open'); applyDesktopScale(); return; }
    applyDesktopScale();
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

  function debugBadge() {
    if (!/[#&?]wxdebug/.test(location.href)) return;
    var d = document.getElementById('wx-debug');
    if (!d) {
      d = document.createElement('div');
      d.id = 'wx-debug';
      d.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99999;background:#111;color:#0f0;font:12px/1.5 monospace;padding:6px 8px;border-radius:8px;max-width:82vw;word-break:break-all;pointer-events:none';
      document.body.appendChild(d);
    }
    d.textContent = 'WXMobile v' + VERSION + ' | realW=' + realW() + ' | logicalW=' + SHIM.w + ' | zoom=' + (document.documentElement.style.zoom || 1) + ' | mobile=' + isMobile();
  }

  function whenDocReady(fn) {
    if (document.documentElement && document.head) { fn(); return; }
    var t = setInterval(function () {
      if (document.documentElement && document.head) { clearInterval(t); fn(); }
    }, 10);
  }
  whenDocReady(function () { fixViewport(); injectCSS(); });

  function boot() {
    try { console.log('[WXMobile] v' + VERSION + ' mobile=' + isMobile() + ' realW=' + realW()); } catch (e) {}
    injectCSS();
    try { sessionStorage.removeItem('wx-rb-reloaded'); } catch (e) {}
    sync();
    debugBadge();
    var mo = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        if (muts[i].addedNodes && muts[i].addedNodes.length) { scheduleSync(); debugBadge(); return; }
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('resize', scheduleSync, { passive: true });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', scheduleSync, { passive: true });
    window.addEventListener('popstate', function () { closeDrawer(); scheduleSync(); });

    document.addEventListener('click', function (e) {
      if (!document.body.classList.contains('wx-drawer-open')) return;
      var t = e.target;
      var hit = t && t.closest && t.closest('.chat-history-time-item,.chat-aside-new-item,.aside-main-tab,.new-dialog-container,.chat-aside-user-menu-item');
      if (hit) setTimeout(closeDrawer, 160);
    }, true);

    var lastTouchEnd = 0;
    document.addEventListener('touchend', function (e) {
      var now = Date.now();
      if (now - lastTouchEnd <= 320) { if (e.cancelable) e.preventDefault(); }
      lastTouchEnd = now;
    }, { passive: false });
    document.addEventListener('dblclick', function (e) { e.preventDefault(); }, { passive: false });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
