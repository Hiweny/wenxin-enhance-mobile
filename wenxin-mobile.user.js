// ==UserScript==
// @name         文心助手 · 手机版适配（PC网页改造）
// @namespace    https://github.com/Hiweny/wenxin-enhance-mobile
// @version      0.16.0
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

  var VERSION = '0.16.0';
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
    'body.wx-mobile{font-size:17px}',

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
    'body.wx-mobile #chat-textarea,body.wx-mobile .ci-textarea{font-size:18px!important;line-height:1.5!important}',
    'body.wx-mobile .more-dropdown-trigger{background:transparent!important;box-shadow:none!important}',
    /* 输入框内部固定 min-width:352px + 负 margin，窄屏会右溢出 → 纠正为自适应 */
    'body.wx-mobile #input-root{min-width:0!important;width:100%!important;margin-left:0!important;margin-right:0!important;max-width:100%!important}',
    'body.wx-mobile .chat-input-background{max-width:100%!important;box-sizing:border-box!important}',
    'body.wx-mobile .right-tools-wrapper{background:transparent!important;box-shadow:none!important}',
    'body.wx-mobile .ci-input-mode-button{background:transparent!important}',

    /* 消息字号 */
    'body.wx-mobile #conversation-flow-content{font-size:17px!important;line-height:1.62!important}',
    'body.wx-mobile [class*="_question-block"]{font-size:17px!important;line-height:1.5!important}',
    'body.wx-mobile .cosd-markdown,body.wx-mobile .cosd-markdown-content,body.wx-mobile .marklang-paragraph{font-size:17px!important;line-height:1.62!important}',
    'body.wx-mobile .cs-question-bubble.cs-bubble{max-width:86%!important}',
    'body.wx-mobile .cs-answer-hover-menu-container,body.wx-mobile .cs-hover-menu{flex-wrap:wrap!important;gap:4px 8px!important}',
    'body.wx-mobile [class*="_home-footer-tip"]{font-size:12px!important}',
    'body.wx-mobile .chat-input-box-pc .tip,body.wx-mobile .ci-container .tip{font-size:12px!important;padding:2px 0!important}',
    'body.wx-mobile .chat-qa-container{padding-left:14px!important;padding-right:14px!important;box-sizing:border-box!important}',

    /* 右侧任务栏 -> 移动端全屏页（可关闭） */
    'body.wx-mobile.wx-rightbar-open [class*="_right-bar-wrapper"]:not([class*="_hide"]){position:fixed!important;left:0!important;right:0!important;top:0!important;bottom:0!important;width:var(--wx-lw,100%)!important;max-width:var(--wx-lw,100%)!important;height:var(--wx-lh,100%)!important;z-index:1600!important;background:#fff!important;box-shadow:none!important;overflow:hidden!important}',
    /* 关闭时：只撤销我们的全屏覆盖，绝不设 display/visibility（否则站点布局计算拿到 0 尺寸会白屏） */
    'body.wx-rightbar-closed [class*="_right-bar-wrapper"]{position:static!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;width:auto!important;max-width:none!important;height:auto!important;overflow:visible!important}',
    'body.wx-rightbar-closed #wx-rightbar-close{display:none!important}',
    'body.wx-mobile [class*="_right-bar-divider-hit-area"]{display:none!important}',
    /* 任务栏内部：整条链路强制为逻辑视口宽度，消除 580px 横向溢出（站点把内部最小宽度按 PC 定死） */
    'body.wx-mobile [class*="_right-bar-wrapper"] [class*="workspace-stage"],body.wx-mobile [class*="_right-bar-wrapper"] #work-stage,body.wx-mobile [class*="_right-bar-wrapper"] [id*="__qiankun_microapp_wrapper"],body.wx-mobile [class*="_right-bar-wrapper"] [class*="_ease-in-show"],body.wx-mobile [class*="_right-bar-wrapper"] [class*="_workspace_"],body.wx-mobile [class*="_right-bar-wrapper"] .chat-right-bar{width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important}',
    /* 任务栏右上工具栏（下载/复制/上传/关闭）：放大触控区、贴右不出屏 */
    'body.wx-mobile [class*="_right-bar-wrapper"] [class*="_header-actions"]{right:6px!important;top:6px!important;height:44px!important;align-items:center!important;z-index:5!important;gap:0!important}',
    'body.wx-mobile [class*="_right-bar-wrapper"] [class*="_header-actions"]>*{margin:0!important}',
    'body.wx-mobile [class*="_right-bar-wrapper"] [class*="_header-actions"] [class*="cos-tooltip"]{min-width:38px!important;min-height:38px!important;display:flex!important;align-items:center!important;justify-content:center!important}',
    'body.wx-mobile [class*="_right-bar-wrapper"] [class*="_header-actions"] [class*="cos-icon"]{transform:scale(1.4)!important}',
    'body.wx-mobile [class*="_right-bar-wrapper"] iframe{width:100%!important;max-width:100%!important;border:0!important}',
    'body.wx-mobile [class*="_right-bar-wrapper"] img,body.wx-mobile [class*="_right-bar-wrapper"] video,body.wx-mobile [class*="_right-bar-wrapper"] canvas{max-width:100%!important;height:auto!important}',
    'body.wx-mobile [class*="_right-bar-wrapper"] pre,body.wx-mobile [class*="_right-bar-wrapper"] table{max-width:100%!important;overflow-x:auto!important}',
    'body.wx-mobile [class*="_right-bar-wrapper"] [class*="_scroll-wrapper"],body.wx-mobile [class*="_right-bar-wrapper"] [class*="_content"]{max-width:100%!important;box-sizing:border-box!important}',

    /* 弹窗约束 */
    'body.wx-mobile [class*="_more-dropdown"],body.wx-mobile [class*="message-panel-container"],body.wx-mobile [class*="message-center-settings"],body.wx-mobile .chat-aside-user-menu-content,body.wx-mobile [class*="_more-dropdown-wrapper"]{max-width:calc(100vw - 24px)!important}',
    'body.wx-mobile .ci-input-mode-panel{max-width:calc(100vw - 24px)!important;border-radius:16px!important;box-shadow:0 8px 32px rgba(0,0,0,.16)!important}',
    'body.wx-mobile .ci-merge-upload-fixed-popover{max-width:calc(100vw - 24px)!important;border-radius:14px!important;box-shadow:0 8px 32px rgba(0,0,0,.16)!important}',

    /* 首页 */
    'body.wx-mobile #welcomeText{font-size:22px!important;line-height:1.45!important}',
    'body.wx-mobile [class*="_home-recommend-words-item"]{min-height:44px!important;font-size:15px!important}',

    /* 侧栏条目 */
    'body.wx-mobile .aside-main-tab{min-height:44px!important;font-size:16px!important}',
    'body.wx-mobile .chat-history-time-item,body.wx-mobile .chat-aside-new-item{min-height:42px!important}',
    'body.wx-mobile .chat-aside-container .chat-aside{padding-bottom:env(safe-area-inset-bottom,0px)!important}',

    'body.wx-mobile #conversation-flow-content,body.wx-mobile .aside-scroll-container{-webkit-overflow-scrolling:touch!important}',

    /* ================= 美化（body.wx-beauty / body.wx-bg） ================= */
    /* 背景层：固定满屏 + 四周外扩，避免模糊时露边 */
    '#wx-bg{position:fixed;left:-10px;top:-10px;width:calc(100% + 20px);height:calc(100% + 20px);z-index:-1;pointer-events:none;background:linear-gradient(160deg,#e7edff,#e4e2fb 48%,#e9f1ff);overflow:hidden;will-change:filter}',
    '#wx-bg .wx-bg-layer{position:absolute;left:0;top:0;right:0;bottom:0;background-position:center;background-repeat:no-repeat;background-size:cover;opacity:0;transition:opacity .6s ease}',
    '#wx-bg .wx-bg-layer.on{opacity:1}',
    '@media (prefers-color-scheme: dark){#wx-bg{background:linear-gradient(160deg,#1c2130,#161327 55%,#10141d)}}',
    /* 有背景图时：主容器透明，透出背景 */
    'body.wx-bg,body.wx-bg #app,body.wx-bg #cs-container-scroll,body.wx-bg [class*="_chat-container-body"],body.wx-bg [class*="_chat-container-wrapper"],body.wx-bg #chat-container-main,body.wx-bg [class*="_chat-container-main"],body.wx-bg [class*="_chat-container-pc"],body.wx-bg [class*="_chat-container-main-wrapper"],body.wx-bg [class*="_new-home"],body.wx-bg [class*="_chat-body-container"],body.wx-bg #conversation-flow-container,body.wx-bg #conversation-flow-content,body.wx-bg .chat-qa-container,body.wx-bg [class*="_content-area"],body.wx-bg .aside-scroll-container,body.wx-bg #new-input-wrapper,body.wx-bg .answer-container,body.wx-bg .cs-rich-input,body.wx-bg [class*="ai-entry"],body.wx-bg [class*="_answer-block"],body.wx-bg [class*="_chat-container-pc_"]{background:transparent!important;background-image:none!important}',
    /* 首页站点用 #new-input-wrapper::before 铺了一层纯白底（向上延伸满屏）→ 让它透明 */
    'body.wx-bg #new-input-wrapper::before,body.wx-bg #new-input-wrapper::after{background:transparent!important;background-image:none!important}',
    /* 侧栏抽屉：磨砂玻璃 */    'body.wx-bg [class*="chat-aside-container"],body.wx-bg .chat-aside{background:rgba(255,255,255,.66)!important;backdrop-filter:blur(26px) saturate(180%)!important;-webkit-backdrop-filter:blur(26px) saturate(180%)!important}',
    '@media (prefers-color-scheme: dark){body.wx-bg [class*="chat-aside-container"],body.wx-bg .chat-aside{background:rgba(26,28,34,.74)!important}}',
    /* 任务步骤 / 交付卡片：磨砂玻璃 */
    'body.wx-bg [class*="_task-process"],body.wx-bg [class*="_deliverable-card"]{background:rgba(255,255,255,.20)!important;backdrop-filter:blur(16px) saturate(160%)!important;-webkit-backdrop-filter:blur(16px) saturate(160%)!important}',
    '@media (prefers-color-scheme: dark){body.wx-bg [class*="_task-process"],body.wx-bg [class*="_deliverable-card"]{background:rgba(255,255,255,.10)!important}}',
    /* 顶栏：去掉整条栏的底/边框/模糊，只留我方汉堡（汉堡注入在该栏内，故不能直接 display:none） */
    'body.wx-beauty [class*="_chat-top-bar-new"]{background:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;border-bottom:0!important;box-shadow:none!important}',
    'body.wx-beauty #chat-top-tab-list{display:none!important}',
    /* 汉堡改为磨砂小圆钮，保证在任何背景上都可见 */
    'body.wx-beauty #wx-hamburger{width:38px!important;height:38px!important;border-radius:12px!important;margin-right:auto!important;margin-left:0!important;background:rgba(255,255,255,.22)!important;backdrop-filter:blur(16px) saturate(170%)!important;-webkit-backdrop-filter:blur(16px) saturate(170%)!important;box-shadow:0 2px 10px rgba(0,0,0,.12)!important;color:#1c1c1e}',
    'body.wx-beauty #wx-hamburger i,body.wx-beauty #wx-hamburger i:before,body.wx-beauty #wx-hamburger i:after{background:currentColor!important}',
    '@media (prefers-color-scheme: dark){body.wx-beauty #wx-hamburger{background:rgba(255,255,255,.16)!important;color:#f2f3f5}}',
    /* 首页示例样本去掉 */
    'body.wx-beauty [class*="_home-recommend-wrapper"],body.wx-beauty [class*="_home-recommend-words"]{display:none!important}',
    /* 底部 AI 标识：视觉隐藏但保留占位（输入框保持悬浮，不贴底） */
    'body.wx-beauty [class*="_home-footer-tip"],body.wx-beauty .chat-input-box-pc .tip,body.wx-beauty .ci-container .tip{visibility:hidden!important;pointer-events:none!important}',
    /* 输入框磨砂玻璃（保留原生五彩边框 .ci-wrapper-border） */
    'body.wx-beauty .ci-wrapper{background:rgba(255,255,255,.20)!important;background-image:none!important;backdrop-filter:blur(26px) saturate(185%)!important;-webkit-backdrop-filter:blur(26px) saturate(185%)!important;border-radius:22px!important}',
    'body.wx-beauty .ci-wrapper-box-shadow{background:transparent!important;background-image:none!important;box-shadow:0 10px 30px rgba(0,0,0,.16)!important;border-radius:22px!important}',
    'body.wx-beauty .ci-container{background:transparent!important}',
    '@media (prefers-color-scheme: dark){body.wx-beauty .ci-wrapper{background:rgba(38,40,48,.36)!important}}',
    /* 原生边框底板（纯色填充）改为「透明底 + 同色内描边」，既保留彩色边框又让磨砂玻璃透出背景 */
    'body.wx-beauty .ci-wrapper-border{background:transparent!important;background-image:none!important;box-shadow:inset 0 0 0 1.8px rgba(150,170,255,.95)!important}',
    '@media (prefers-color-scheme: dark){body.wx-beauty .ci-wrapper-border{box-shadow:inset 0 0 0 1.8px rgba(165,182,255,.92)!important}}',
    'body.wx-beauty .cs-rich-input{background:transparent!important}',
    /* 输入文本域/内部容器自带白底 → 透明，避免盖住磨砂层（这就是深色模式下的灰块来源） */
    'body.wx-beauty #chat-textarea,body.wx-beauty .ci-textarea,body.wx-beauty #ci-area,body.wx-beauty .ci-file-input-wrapper,body.wx-beauty .ci-container>div{background:transparent!important;background-image:none!important}',
    'body.wx-beauty .ci-scroll-style{background:transparent!important}',
    /* 首页「对话/工作」药丸：磨砂玻璃 */
    'body.wx-bg [class*="_home-mode-switch_"]{background:rgba(255,255,255,.20)!important;backdrop-filter:blur(16px) saturate(160%)!important;-webkit-backdrop-filter:blur(16px) saturate(160%)!important}',
    '@media (prefers-color-scheme: dark){body.wx-bg [class*="_home-mode-switch_"]{background:rgba(255,255,255,.10)!important}}',
    /* 用户气泡磨砂玻璃 */
    'body.wx-beauty .cs-question-bubble.cs-bubble{background:rgba(255,255,255,.58)!important;backdrop-filter:blur(20px) saturate(180%)!important;-webkit-backdrop-filter:blur(20px) saturate(180%)!important;border:1px solid rgba(255,255,255,.65)!important;box-shadow:0 6px 20px rgba(0,0,0,.10)!important;border-radius:20px!important}',
    '@media (prefers-color-scheme: dark){body.wx-beauty .cs-question-bubble.cs-bubble{background:rgba(255,255,255,.16)!important;border-color:rgba(255,255,255,.22)!important;color:#f2f3f5!important}}',

    /* 设置按钮（注入到输入框左工具栏） */
    '#wx-settings-btn{width:34px;height:34px;margin:0 6px 0 0;border:0;padding:0;background:transparent;display:flex;align-items:center;justify-content:center;flex:0 0 auto;cursor:pointer;border-radius:10px;-webkit-tap-highlight-color:transparent;color:#6b7280}',
    '#wx-settings-btn:active{background:rgba(127,127,127,.20)}',
    '#wx-settings-btn svg{width:20px;height:20px;display:block}',
    '@media (prefers-color-scheme: dark){#wx-settings-btn{color:#c9cdd6}}',

    /* 设置面板 */
    '#wx-settings-mask{position:fixed;left:0;top:0;width:100vw;height:100vh;background:rgba(0,0,0,.38);z-index:9000;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .2s,visibility .2s}',
    '#wx-settings-mask.show{opacity:1;visibility:visible;pointer-events:auto}',
    '#wx-settings-sheet{position:fixed;left:0;right:0;bottom:0;z-index:9001;transform:translateY(105%);visibility:hidden;max-height:88vh;overflow-y:auto;-webkit-overflow-scrolling:touch;transition:transform .3s cubic-bezier(.2,.8,.2,1),visibility .3s;background:rgba(255,255,255,.80);backdrop-filter:blur(30px) saturate(180%);-webkit-backdrop-filter:blur(30px) saturate(180%);border-radius:20px 20px 0 0;box-shadow:0 -10px 40px rgba(0,0,0,.22);color:#1c1c1e;font-size:15px;padding:10px 16px calc(16px + env(safe-area-inset-bottom,0px));box-sizing:border-box}',
    '#wx-settings-sheet.show{transform:translateY(0);visibility:visible}',
    '@media (prefers-color-scheme: dark){#wx-settings-sheet{background:rgba(32,34,40,.88);color:#f2f3f5}}',
    '#wx-set-handle{width:40px;height:5px;border-radius:3px;background:rgba(127,127,127,.4);margin:2px auto 8px}',
    '.wx-set-title{font-size:16px;font-weight:600;text-align:center;margin:0 0 12px}',
    '.wx-set-label{font-size:13px;opacity:.72;margin:12px 0 6px}',
    '.wx-set-label2{font-size:14px;opacity:.85;width:52px;flex:0 0 auto}',
    '.wx-set-row{display:flex;align-items:center;gap:8px}',
    '.wx-set-preview-row{justify-content:space-between;margin-bottom:4px}',
    '#wx-set-preview{width:100%;height:96px;flex:1 1 auto;border-radius:14px;background-size:cover;background-position:center;background-color:rgba(127,127,127,.16);border:1px solid rgba(127,127,127,.18);margin-right:10px}',
    '.wx-set-btns{display:flex;flex-direction:column;gap:8px}',
    '.wx-set-btn{border:0;background:rgba(120,140,255,.16);color:#3b5bdb;font-size:14px;padding:8px 14px;border-radius:12px;cursor:pointer;text-align:center;-webkit-tap-highlight-color:transparent}',
    '@media (prefers-color-scheme: dark){.wx-set-btn{background:rgba(120,140,255,.24);color:#aebcff}}',
    '.wx-set-btn.ghost{background:rgba(127,127,127,.16);color:inherit}',
    '#wx-set-url{flex:1 1 auto;min-width:0;height:38px;border-radius:12px;border:1px solid rgba(127,127,127,.28);background:rgba(255,255,255,.6);color:inherit;font-size:14px;padding:0 12px;box-sizing:border-box}',
    '@media (prefers-color-scheme: dark){#wx-set-url{background:rgba(255,255,255,.10)}}',
    '.wx-set-range{flex:1 1 auto;min-width:0;accent-color:#3b5bdb;height:28px}',
    '.wx-set-val{width:34px;text-align:right;font-size:13px;opacity:.72;flex:0 0 auto}',
    '.wx-set-switch{position:relative;width:48px;height:28px;flex:0 0 auto;margin-left:auto}',
    '.wx-set-switch input{position:absolute;opacity:0;width:100%;height:100%;margin:0}',
    '.wx-set-switch span{position:absolute;inset:0;border-radius:999px;background:rgba(127,127,127,.35);transition:background .2s}',
    '.wx-set-switch span:after{content:"";position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .2s}',
    '.wx-set-switch input:checked+span{background:#3b5bdb}',
    '.wx-set-switch input:checked+span:after{transform:translateX(20px)}',
    '.wx-set-primary{width:100%;margin-top:16px;height:46px;border:0;border-radius:14px;background:#3b5bdb;color:#fff;font-size:16px;font-weight:600;cursor:pointer}',
    '.wx-set-primary:active{filter:brightness(.94)}',
    '.wx-set-row+.wx-set-row{margin-top:10px}'

  ].join('\n');

  /* 右侧任务栏内的 HTML 预览是 qiankun 微应用，跑在 Shadow DOM 里：
     普通 document 样式进不去，必须把样式注入到它的 shadowRoot。
     目标：把内部按 PC 定死的宽度/留白改成手机宽度，并给顶部「代码/预览」标签让位给右上工具栏。 */
  var SHADOW_CSS = [
    ':host{width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;display:block!important}',
    '#comate-chat-workspace{width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;overflow-x:hidden!important}',
    '#comate-chat-workspace>div{width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important}',
    '#comate-chat-workspace header{padding-left:6px!important;padding-right:150px!important;box-sizing:border-box!important;justify-content:flex-start!important}',
    '#comate-chat-workspace header>div{margin-left:0!important;margin-right:0!important}',
    '#comate-chat-workspace header>div>div{width:64px!important}',
    /* 「代码」标签页：文件树(min-w 156) + 编辑器(min-w 220) 会超出 360 → 放开最小宽度，编辑器内部横向滚动 */
    '#comate-chat-workspace [class*="ccw-min-w-"]{min-width:0!important}',
    '#comate-chat-workspace [class*="ccw-w-fit"]{max-width:100%!important}',
    '#comate-chat-workspace .cm-theme,#comate-chat-workspace .cm-editor,#comate-chat-workspace .cm-scroller{min-width:0!important;max-width:100%!important}',
    'iframe{width:100%!important;max-width:100%!important;border:0!important}'
  ].join('\n');

  function injectShadowCSS() {
    var hosts = document.querySelectorAll('[id*="qiankun_microapp_wrapper"],[id^="__qiankun"]');
    for (var i = 0; i < hosts.length; i++) {
      var sr = hosts[i].shadowRoot;
      if (sr && !sr.getElementById('wx-shadow-css')) {
        var s = document.createElement('style');
        s.id = 'wx-shadow-css';
        s.type = 'text/css';
        s.textContent = SHADOW_CSS;
        sr.appendChild(s);
      }
    }
  }

  /* ================= 美化：背景 + 设置面板 ================= */
  var BEAUTY_KEY = 'wx-beauty-v2';
  var DEFAULT_BG = 'https://piv.cc.cd/file/BQACAgUAAyEGAASLVN5eAAJycmrFsEF_gBAEksOkBJck6n9y6IK2AALKIAAC1YYwVs2Pus_QNfIXPQQ.jpg';
  var BEAUTY = { img: DEFAULT_BG, blur: 6, bright: 100, on: true };
  function saveBeauty() {
    try { localStorage.setItem(BEAUTY_KEY, JSON.stringify(BEAUTY)); }
    catch (e) { try { alert('背景保存失败：图片过大，请改用图片链接'); } catch (e2) {} }
  }
  function loadBeauty() {
    var raw = null;
    try { raw = localStorage.getItem(BEAUTY_KEY); } catch (e) {}
    if (!raw) { saveBeauty(); return; }   /* 首次运行：写入默认背景 */
    try {
      var s = JSON.parse(raw);
      if (typeof s.img === 'string') BEAUTY.img = s.img;
      if (typeof s.blur === 'number') BEAUTY.blur = s.blur;
      if (typeof s.bright === 'number') BEAUTY.bright = s.bright;
      if (typeof s.on === 'boolean') BEAUTY.on = s.on;
    } catch (e) {}
  }
  loadBeauty();

  /* 背景用上下两层做「加载完再淡入 / 切换时交叉淡变」，避免图片一点点铺开 */
  var bgLayers = [], bgActive = -1, bgUrl = '';
  function ensureBgDom() {
    var bg = document.getElementById('wx-bg');
    if (!bg) {
      bg = document.createElement('div'); bg.id = 'wx-bg';
      var l1 = document.createElement('div'); l1.className = 'wx-bg-layer';
      var l2 = document.createElement('div'); l2.className = 'wx-bg-layer';
      bg.appendChild(l1); bg.appendChild(l2);
      (document.body || document.documentElement).appendChild(bg);
      bgLayers = [l1, l2];
    } else if (bgLayers.length !== 2 || !document.body.contains(bgLayers[0])) {
      bgLayers = [bg.children[0], bg.children[1]];
    }
    return bg;
  }
  function bgUrlCss(u) { return 'url("' + u.replace(/"/g, '%22') + '")'; }
  function setBgImage(url) {
    ensureBgDom();
    if (!url) {
      if (bgLayers[0]) bgLayers[0].classList.remove('on');
      if (bgLayers[1]) bgLayers[1].classList.remove('on');
      bgActive = -1; bgUrl = '';
      return;
    }
    if (url === bgUrl) return;
    var done = false;
    var applyIt = function () {
      if (done) return; done = true;
      var next = (bgActive === 0) ? 1 : 0;
      var layer = bgLayers[next]; if (!layer) return;
      layer.style.backgroundImage = bgUrlCss(url);
      void layer.offsetWidth;            /* 先让新图就位再加 on，触发过渡 */
      layer.classList.add('on');
      if (bgActive >= 0 && bgLayers[bgActive]) bgLayers[bgActive].classList.remove('on');
      bgActive = next; bgUrl = url;
    };
    var probe = new Image();
    probe.onload = applyIt;
    probe.onerror = function () { done = true; };   /* 加载失败：保留当前背景，不清空 */
    probe.src = url;
    setTimeout(function () { if (!done) applyIt(); }, 4000);  /* 兜底 */
  }

  var beautySig = '';
  function applyBeauty() {
    if (!document.body) return;
    var sig = (BEAUTY.on ? 1 : 0) + '|' + BEAUTY.blur + '|' + BEAUTY.bright + '|' + BEAUTY.img.length + '|' + BEAUTY.img.slice(-24);
    var bg = document.getElementById('wx-bg');
    if (sig === beautySig && bg) return;
    beautySig = sig;
    document.body.classList.toggle('wx-beauty', !!BEAUTY.on);
    document.body.classList.toggle('wx-bg', !!BEAUTY.on);   /* 无图时也铺渐变底，消除浅色模式白块 */
    bg = ensureBgDom();
    if (!BEAUTY.on) { bg.style.display = 'none'; }
    else { bg.style.display = 'block'; }
    bg.style.filter = 'blur(' + (BEAUTY.blur || 0) + 'px) brightness(' + ((BEAUTY.bright || 100) / 100) + ')';
    setBgImage(BEAUTY.on ? BEAUTY.img : '');
    var u = BEAUTY.img ? bgUrlCss(BEAUTY.img) : 'none';
    var pv = document.getElementById('wx-set-preview'); if (pv) pv.style.backgroundImage = u;
    var e1 = document.getElementById('wx-set-blur'); if (e1) e1.value = BEAUTY.blur;
    var e2 = document.getElementById('wx-set-bright'); if (e2) e2.value = BEAUTY.bright;
    var v1 = document.getElementById('wx-set-blur-v'); if (v1) v1.textContent = BEAUTY.blur;
    var v2 = document.getElementById('wx-set-bright-v'); if (v2) v2.textContent = BEAUTY.bright;
    var ck = document.getElementById('wx-set-on'); if (ck) ck.checked = !!BEAUTY.on;
  }

  var GEAR_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.1"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10.6 3.09V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 16 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09A1.65 1.65 0 0 0 20.91 10.6H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
  function ensureSettingsButton() {
    if (!document.body || !isMobile()) return;
    if (document.getElementById('wx-settings-btn')) return;
    /* 放进右工具栏首位：该容器 justify-content:flex-end，左侧本就留有空隙，
       能落在「四宫格」与「麦克风」之间，不与绝对定位的四宫格图标重叠 */
    var wrap = document.querySelector('.right-tools-wrapper') || document.querySelector('.ci-tool');
    if (!wrap) return;
    var b = document.createElement('button');
    b.id = 'wx-settings-btn';
    b.type = 'button';
    b.setAttribute('aria-label', '设置');
    b.innerHTML = GEAR_SVG;
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openSettings(); });
    wrap.insertBefore(b, wrap.firstChild);
  }

  var PANEL_INNER = [
    '<div id="wx-set-handle"></div>',
    '<div class="wx-set-title">设置</div>',
    '<div class="wx-set-row wx-set-preview-row">',
    '  <div id="wx-set-preview"></div>',
    '  <div class="wx-set-btns">',
    '    <label class="wx-set-btn">上传图片<input id="wx-set-file" type="file" accept="image/*" style="display:none"></label>',
    '    <button id="wx-set-clear" class="wx-set-btn ghost" type="button">清除</button>',
    '  </div>',
    '</div>',
    '<div class="wx-set-label">图片链接</div>',
    '<div class="wx-set-row">',
    '  <input id="wx-set-url" type="url" inputmode="url" placeholder="https:// 或 data:image/...">',
    '  <button id="wx-set-apply" class="wx-set-btn" type="button">应用</button>',
    '</div>',
    '<div class="wx-set-row" style="margin-top:14px"><span class="wx-set-label2">模糊度</span><input id="wx-set-blur" class="wx-set-range" type="range" min="0" max="40" step="1"><span id="wx-set-blur-v" class="wx-set-val">0</span></div>',
    '<div class="wx-set-row"><span class="wx-set-label2">亮度</span><input id="wx-set-bright" class="wx-set-range" type="range" min="30" max="150" step="5"><span id="wx-set-bright-v" class="wx-set-val">100</span></div>',
    '<div class="wx-set-row" style="margin-top:14px"><span class="wx-set-label2" style="width:auto">界面美化</span><label class="wx-set-switch"><input id="wx-set-on" type="checkbox"><span></span></label></div>',
    '<button id="wx-set-done" class="wx-set-primary" type="button">完成</button>'
  ].join('\n');

  var panelBuilt = false;
  function buildSettings() {
    if (panelBuilt) return;
    panelBuilt = true;
    var mask = document.createElement('div'); mask.id = 'wx-settings-mask';
    var sheet = document.createElement('div'); sheet.id = 'wx-settings-sheet'; sheet.innerHTML = PANEL_INNER;
    document.body.appendChild(mask); document.body.appendChild(sheet);
    mask.addEventListener('click', closeSettings);
    var $ = function (id) { return document.getElementById(id); };
    $('wx-set-done').addEventListener('click', closeSettings);
    $('wx-set-file').addEventListener('change', function () {
      var f = this.files && this.files[0]; if (!f) return;
      if (f.size > 4 * 1024 * 1024) { alert('图片较大（' + Math.round(f.size / 1048576) + 'MB），可能保存失败，建议用图片链接'); }
      var fr = new FileReader();
      fr.onload = function () { BEAUTY.img = String(fr.result); saveBeauty(); applyBeauty(); };
      fr.readAsDataURL(f);
    });
    $('wx-set-clear').addEventListener('click', function () { BEAUTY.img = ''; saveBeauty(); applyBeauty(); var u = $('wx-set-url'); if (u) u.value = ''; });
    $('wx-set-apply').addEventListener('click', function () {
      var u = ($('wx-set-url').value || '').trim();
      if (!u) { BEAUTY.img = ''; saveBeauty(); applyBeauty(); return; }
      if (!/^(https?:\/\/|data:image\/)/i.test(u)) { alert('请输入以 http(s):// 或 data:image/ 开头的图片地址'); return; }
      BEAUTY.img = u; saveBeauty(); applyBeauty();
    });
    var bl = $('wx-set-blur'), br = $('wx-set-bright');
    bl.addEventListener('input', function () { BEAUTY.blur = +this.value; var el = $('wx-set-blur-v'); if (el) el.textContent = BEAUTY.blur; applyBeautyLive(); });
    bl.addEventListener('change', function () { saveBeauty(); });
    br.addEventListener('input', function () { BEAUTY.bright = +this.value; var el = $('wx-set-bright-v'); if (el) el.textContent = BEAUTY.bright; applyBeautyLive(); });
    br.addEventListener('change', function () { saveBeauty(); });
    $('wx-set-on').addEventListener('change', function () { BEAUTY.on = this.checked; saveBeauty(); applyBeauty(); });
  }
  /* 拖动滑块时即时预览（跳过签名缓存） */
  function applyBeautyLive() {
    var bg = document.getElementById('wx-bg');
    if (bg) bg.style.filter = 'blur(' + (BEAUTY.blur || 0) + 'px) brightness(' + ((BEAUTY.bright || 100) / 100) + ')';
  }
  function openSettings() {
    buildSettings();
    beautySig = '';   /* 强制刷新面板上的预览/滑块/开关 */
    applyBeauty();
    var m = document.getElementById('wx-settings-mask'), s = document.getElementById('wx-settings-sheet');
    if (m) m.classList.add('show');
    if (s) s.classList.add('show');
  }
  function closeSettings() {
    var m = document.getElementById('wx-settings-mask'), s = document.getElementById('wx-settings-sheet');
    if (m) m.classList.remove('show');
    if (s) s.classList.remove('show');
  }

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
  function rbVisible(rb) {
    var cls = rb.className || '';
    if (/_hide/.test(cls)) return false;
    if (/right-bar-wrapper-live/.test(cls)) return true;
    /* 曾判定为打开、此刻又丢了 open 类 → 说明站点已收起，避免我方覆盖层残留 */
    if (document.body.classList.contains('wx-rightbar-open')) return false;
    return rb.getBoundingClientRect().width > 2;
  }
  function ensureRightBar() {
    var rb = q('[class*="_right-bar-wrapper"]');
    if (!rb) return;
    var hidden = /_hide/.test(rb.className || '');
    if (hidden) captureHideToken(rb);
    if (rbVisible(rb)) {
      if (!document.body.classList.contains('wx-rightbar-open')) document.body.classList.add('wx-rightbar-open');
      injectShadowCSS();
    } else if (document.body.classList.contains('wx-rightbar-open')) {
      document.body.classList.remove('wx-rightbar-open');
    }
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
    /* 站点工具栏自带的 X 已随移动端适配进入屏内、触控区足够大 → 隐藏我们的兜底键，避免两个关闭键重叠 */
    var siteClose = null;
    try {
      var acts = q('[class*="_header-actions"]');
      if (acts) siteClose = acts.querySelector('[class*="cos-icon-close"],[class*="close"]');
    } catch (e) {}
    btn.style.display = (siteClose && siteClose.getBoundingClientRect().width > 0) ? 'none' : 'flex';
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
    ensureSettingsButton();
    applyBeauty();
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
    /* 微应用 shadowRoot 的建立、以及任务栏 class 变化都不触发 childList 观察器 → 轮询兜底：
       打开期间补注入 shadow 样式；收起时及时撤掉我方覆盖层（避免残留导致白屏） */
    setInterval(function () {
      if (!document.body || !isMobile()) return;
      ensureRightBar();
      if (document.body.classList.contains('wx-rightbar-open')) injectShadowCSS();
    }, 600);
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
