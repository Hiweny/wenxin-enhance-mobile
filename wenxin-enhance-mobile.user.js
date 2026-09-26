// ==UserScript==
// @name         文心助手手机版增强 (Wenxin Enhance Mobile)
// @namespace    https://github.com/Hiweny/wenxin-enhance-mobile
// @version      1.0.0
// @description  百度文心助手手机版增强：默认 DeepSeek-V4 Pro + 思考模式 + 任务模式、防撤回、自定义全局背景、移除 App 专属胶囊、输入框与整体手机端美化。
// @author       Hiweny
// @match        https://wenxin.baidu.com/*
// @match        https://chat.baidu.com/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      *
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  /* ============================================================
   * 1. 基础：存储桥 / 工具 / 事件
   * ============================================================ */
  var Bridge = {
    get: function (k, d) {
      try { if (typeof GM_getValue === 'function') { var v = GM_getValue(k, d); return (v === undefined || v === null) ? d : v; } } catch (e) {}
      try { var x = localStorage.getItem('wxem_' + k); return x === null ? d : JSON.parse(x); } catch (e) { return d; }
    },
    set: function (k, v) {
      try { if (typeof GM_setValue === 'function') { GM_setValue(k, v); return; } } catch (e) {}
      try { localStorage.setItem('wxem_' + k, JSON.stringify(v)); } catch (e) {}
    }
  };

  var DEFAULT_BG = 'https://s41.ax1x.com/2026/09/04/pnkaWjK.png';

  var CONFIG = {
    model: {
      enabled: true,
      id: 'DeepSeek-V4',          // DS-V4 Pro
      think: '1',                 // 思考模式
      task: 1,                    // 任务模式 deep_decision
      deepSearch: '0'
    },
    antiRecall: {
      enabled: true,
      privacy: 'smart'            // off / smart / full
    },
    bg: {
      enabled: false,
      url: DEFAULT_BG,
      blur: 8,
      brightness: 100,
      upload: ''
    },
    ui: {
      removeAppCapsules: true,
      removeImageEntry: true,
      beautify: true,
      frosted: true
    }
  };

  function loadConfig() {
    var saved = Bridge.get('config', null);
    if (saved) {
      ['model', 'antiRecall', 'bg', 'ui'].forEach(function (s) {
        if (saved[s]) Object.keys(saved[s]).forEach(function (k) { CONFIG[s][k] = saved[s][k]; });
      });
    }
  }
  function saveConfig() { Bridge.set('config', CONFIG); }
  loadConfig();

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function on(el, ev, fn, opt) { el.addEventListener(ev, fn, opt || false); }
  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // 极简 markdown -> html（防撤回回填用）
  function md2html(src) {
    var lines = String(src).replace(/\r/g, '').split('\n');
    var html = '', i = 0, inCode = false, inList = false;
    function closeList() { if (inList) { html += '</ul>'; inList = false; } }
    while (i < lines.length) {
      var ln = lines[i];
      if (/^```/.test(ln)) {
        if (!inCode) { closeList(); html += '<pre class="wxem-code"><code>'; inCode = true; }
        else { html += '</code></pre>'; inCode = false; }
        i++; continue;
      }
      if (inCode) { html += escapeHtml(ln) + '\n'; i++; continue; }
      var m;
      if ((m = ln.match(/^###\s+(.*)/))) { closeList(); html += '<h4>' + inline(m[1]) + '</h4>'; }
      else if ((m = ln.match(/^##\s+(.*)/))) { closeList(); html += '<h3>' + inline(m[1]) + '</h3>'; }
      else if ((m = ln.match(/^#\s+(.*)/))) { closeList(); html += '<h2>' + inline(m[1]) + '</h2>'; }
      else if ((m = ln.match(/^\s*[-*]\s+(.*)/))) { if (!inList) { html += '<ul>'; inList = true; } html += '<li>' + inline(m[1]) + '</li>'; }
      else if ((m = ln.match(/^\s*\d+\.\s+(.*)/))) { if (!inList) { html += '<ul class="wxem-ol">'; inList = true; } html += '<li>' + inline(m[1]) + '</li>'; }
      else if (ln.trim() === '') { closeList(); }
      else { closeList(); html += '<p>' + inline(ln) + '</p>'; }
      i++;
    }
    if (inCode) html += '</code></pre>';
    closeList();
    return html;
    function inline(t) {
      return escapeHtml(t)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>');
    }
  }

  /* ============================================================
   * 2. 样式注入（设计变量 + 手机端美化）
   * ============================================================ */
  var CSS = `
:root{
  --wxem-accent:#3b6cf6; --wxem-accent-2:#6b93ff;
  --wxem-text:#1d2129; --wxem-text-2:#6b7280;
  --wxem-frost:rgba(255,255,255,.72); --wxem-frost-strong:rgba(255,255,255,.86);
  --wxem-border:rgba(0,0,0,.08);
  --wxem-shadow:0 6px 24px rgba(15,23,42,.08);
  --wxem-radius:16px;
}
#wxem-bg-layer{position:fixed;inset:0;z-index:-2;background-size:cover;background-position:center;
  background-repeat:no-repeat;will-change:transform,filter;}
#wxem-bg-mask{position:fixed;inset:0;z-index:-1;background:rgba(255,255,255,.18);}
html.wxem-has-bg #conversation-flow-content,
html.wxem-has-bg .chat-search-page-header{background:transparent !important;}
html.wxem-has-bg .cs-history-answer .answer-container,
html.wxem-has-bg .cs-question-bubble{
  background:var(--wxem-frost-strong) !important; backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);
}
html.wxem-has-bg .cs-question-closely-single-bub,
html.wxem-has-bg .cs-question-closely-single{
  background:var(--wxem-frost) !important; backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
}

/* 整体圆角/阴影/字体平滑 */
#conversation-flow-content{ -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility; }
.cs-question-bubble{border-radius:18px !important; box-shadow:var(--wxem-shadow);}
.cs-history-answer .answer-container{border-radius:var(--wxem-radius);}
.ai-markdown .marklang p{line-height:1.8;}
.ai-markdown pre,.ai-markdown code{border-radius:10px;}
.ai-markdown img{border-radius:12px;}

/* 操作栏按钮 */
._interact-wrapper .cos-row,._interact-wrapper span[class*=audio-icon]{transition:transform .15s ease, background .2s;}
._interact-wrapper .cos-row:active{transform:scale(.9);}

/* 输入框美化 */
.chat-input-box-pc{padding:6px 10px;}
.cs-input-invoke{border-radius:22px !important; box-shadow:var(--wxem-shadow);
  border:1px solid var(--wxem-border) !important; background:rgba(255,255,255,.92) !important;
  backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); overflow:hidden;}
html.wxem-has-bg .cs-input-invoke{background:var(--wxem-frost-strong) !important;}
#chat-input-box{font-size:16px !important; line-height:1.5; max-height:38vh;}
.cs-input-right-btn img,.cs-input-plus-btn i{transition:transform .15s;}
.cs-input-plus-btn:active i{transform:scale(.85) rotate(90deg);}
.chat-input-function-box{border-radius:18px; background:var(--wxem-frost); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);}

/* 头部 */
.chat-search-page-header{backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); background:rgba(255,255,255,.7);}

/* 欢迎页大卡片 */
[class*=arc-swiper-item]{border-radius:20px; overflow:hidden; box-shadow:var(--wxem-shadow);}
[class*=arc-swiper-content]{transition:transform .15s;}
[class*=arc-swiper-content]:active{transform:scale(.97);}

/* 模型面板（若出现） */
[class*=model-list-wrapper]{border-radius:18px !important; box-shadow:0 12px 40px rgba(15,23,42,.18) !important;
  overflow:hidden; backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); background:var(--wxem-frost-strong) !important;}
[class*=model-list-item-title]{font-weight:600;}

/* 设置面板 */
#wxem-panel{position:fixed;left:0;right:0;bottom:0;z-index:99999;transform:translateY(105%);
  transition:transform .32s cubic-bezier(.2,.8,.2,1); width:100%;}
#wxem-panel.open{transform:translateY(0);}
#wxem-panel .wxem-sheet{margin:0 auto;max-width:520px;background:rgba(255,255,255,.94);
  backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px);
  border-radius:22px 22px 0 0; padding:14px 18px calc(18px + env(safe-area-inset-bottom));
  box-shadow:0 -10px 40px rgba(15,23,42,.18);}
#wxem-panel .wxem-grab{width:42px;height:4px;border-radius:4px;background:rgba(0,0,0,.18);margin:0 auto 12px;}
#wxem-panel h3{font-size:16px;font-weight:700;margin:6px 0 12px;display:flex;justify-content:space-between;align-items:center;}
.wxem-row{display:flex;align-items:center;justify-content:space-between;padding:11px 4px;font-size:14px;color:var(--wxem-text);}
.wxem-row .wxem-sub{display:block;font-size:12px;color:var(--wxem-text-2);margin-top:2px;}
.wxem-switch{position:relative;width:46px;height:27px;flex:none;}
.wxem-switch input{opacity:0;width:0;height:0;}
.wxem-switch .sl{position:absolute;inset:0;background:#d1d5db;border-radius:27px;transition:.22s;}
.wxem-switch .sl:before{content:"";position:absolute;width:21px;height:21px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.22s;box-shadow:0 1px 3px rgba(0,0,0,.25);}
.wxem-switch input:checked + .sl{background:var(--wxem-accent);}
.wxem-switch input:checked + .sl:before{transform:translateX(19px);}
.wxem-range{width:100%;accent-color:var(--wxem-accent);}
.wxem-seg{display:flex;background:rgba(0,0,0,.06);border-radius:10px;padding:3px;gap:3px;}
.wxem-seg button{flex:1;border:0;background:transparent;padding:6px;border-radius:8px;font-size:13px;color:var(--wxem-text-2);}
.wxem-seg button.on{background:#fff;color:var(--wxem-accent);font-weight:600;box-shadow:0 1px 4px rgba(0,0,0,.12);}
#wxem-fab{position:fixed;right:14px;bottom:96px;z-index:99998;width:44px;height:44px;border-radius:50%;
  background:var(--wxem-accent);color:#fff;border:0;font-size:20px;box-shadow:0 6px 18px rgba(59,108,246,.45);
  display:flex;align-items:center;justify-content:center;}
#wxem-fab:active{transform:scale(.9);}
.wxem-toast{position:fixed;left:50%;bottom:120px;transform:translateX(-50%);background:rgba(17,24,39,.92);color:#fff;
  padding:9px 16px;border-radius:20px;font-size:13px;z-index:100000;opacity:0;transition:opacity .25s;pointer-events:none;}
.wxem-toast.show{opacity:1;}
.wxem-recall-tag{display:inline-block;margin-left:8px;font-size:11px;color:#b45309;background:#fef3c7;
  border-radius:6px;padding:1px 6px;vertical-align:middle;}
.wxem-code{background:#0f172a;color:#e2e8f0;padding:12px;border-radius:10px;overflow:auto;}
.wxem-code code,.ai-markdown code{font-family:ui-monospace,Menlo,monospace;}
`;
  function injectStyle() {
    if (typeof GM_addStyle === 'function') { GM_addStyle(CSS); return; }
    var st = document.createElement('style'); st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  function toast(msg) {
    var t = $('#wxem-toast');
    if (!t) { t = document.createElement('div'); t.id = 'wxem-toast'; t.className = 'wxem-toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 1800);
  }

  /* ============================================================
   * 3. 网络层：fetch 包裹（默认模型/思考/任务 + 防撤回采集）
   * ============================================================ */
  var recallStore = {
    key: function (sid, mid) { return 'wxem_recall_' + sid + '_' + mid; },
    save: function (sid, mid, payload) {
      try { Bridge.set(this.key(sid, mid), payload); } catch (e) {}
    },
    get: function (sid, mid) { return Bridge.get(this.key(sid, mid), null); },
    keys: function () {
      var out = [];
      try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k.indexOf('wxem_recall_') === 0) out.push(k); } } catch (e) {}
      return out;
    }
  };

  // 解析一段 SSE 文本，返回消息事件数组
  function parseSSE(raw) {
    var out = [];
    raw.split(/\n\n+/).forEach(function (blk) {
      var em = (blk.match(/^event:(.+)$/m) || [])[1];
      var dm = blk.match(/^data:([\s\S]*)$/m);
      if (!dm) return;
      var data; try { data = JSON.parse(dm[1]); } catch (e) { return; }
      out.push({ event: em ? em.trim() : 'message', data: data });
    });
    return out;
  }

  // 进行中的会话累积器： sid -> { mid, answer, reasoning, safe, finished }
  var live = {};

  function feedSSE(raw) {
    if (!CONFIG.antiRecall.enabled) return;
    parseSSE(raw).forEach(function (p) {
      var d = p.data;
      var msg = d && d.data && d.data.message;
      if (!msg) return;
      var sid = d.sessionId || (msg.metaData && msg.metaData.sessionId) || d.qid;
      var mid = msg.msgId;
      if (!sid || !mid) return;
      var k = sid + '|' + mid;
      var st = live[k] || (live[k] = { sid: sid, mid: mid, answer: '', reasoning: '', safe: true, finished: false });

      var g = msg.content && msg.content.generator;
      if (g) {
        // 安全标记翻转 => 撤回/过滤
        if (g.antiFlag !== undefined && g.antiFlag !== 0) st.safe = false;
        if (g.isSafe !== undefined && g.isSafe !== 1 && g.isSafe !== true) st.safe = false;

        if (g.component === 'markdown-yiyan' && g.data && typeof g.data.value === 'string') {
          st.answer += g.data.value;
        } else if (g.component === 'thinkingSteps' && g.data) {
          var arr = g.data.reasoningContentArr || [];
          arr.forEach(function (r) { if (r) st.reasoning += r; });
        }
        // 持续缓存真实内容（在被替换之前）
        if (st.answer) recallStore.save(sid, mid, { answer: st.answer, reasoning: st.reasoning, t: Date.now() });
      }

      var state = msg.metaData && msg.metaData.state;
      if (state === 'generate-complete' || (g && g.isFinished)) {
        st.finished = true;
        if (st.answer) recallStore.save(sid, mid, { answer: st.answer, reasoning: st.reasoning, t: Date.now() });
      }
    });
  }

  function installFetchHook() {
    var of = window.fetch;
    window.fetch = function (input, init) {
      var url = (typeof input === 'string') ? input : (input && input.url);
      url = url || '';

      // —— 发送会话：强制默认模型/思考/任务 ——
      if (CONFIG.model.enabled && url.indexOf('/aichat/api/conversation') !== -1 && init && typeof init.body === 'string') {
        try {
          var obj = JSON.parse(init.body);
          var si = obj.message && obj.message.searchInfo;
          if (si) {
            si.usedModel = si.usedModel || {};
            si.usedModel.modelName = CONFIG.model.id;
            si.usedModel.modelFunction = si.usedModel.modelFunction || {};
            si.usedModel.modelFunction.thinkMode = CONFIG.model.think;
            si.usedModel.modelFunction.deepSearch = CONFIG.model.deepSearch;
            si.deepDecisionInfo = si.deepDecisionInfo || {};
            si.deepDecisionInfo.isDeepDecision = CONFIG.model.task;
            init.body = JSON.stringify(obj);
          }
        } catch (e) {}
      }

      var p = of.apply(this, arguments);

      // —— 采集 SSE（防撤回） ——
      if (url.indexOf('/aichat/api/conversation') !== -1) {
        return p.then(function (resp) {
          try {
            var ct = resp.headers.get('content-type') || '';
            if (ct.indexOf('text/event-stream') !== -1) {
              var reader = resp.clone().body && resp.clone().body.getReader();
              if (reader) {
                var dec = new TextDecoder(), buf = '';
                (function pump() {
                  reader.read().then(function (r) {
                    if (r.done) { feedSSE(buf); return; }
                    buf += dec.decode(r.value, { stream: true });
                    // 按完整块增量喂入
                    feedSSE(buf);
                    return pump();
                  }).catch(function () {});
                })();
              }
            }
          } catch (e) {}
          return resp;
        });
      }

      // —— 历史/消息列表：撤回对账 ——
      if (/messages\/list|\/conversation|history/i.test(url)) {
        return p.then(function (resp) {
          try {
            resp.clone().text().then(function (txt) {
              // 若历史里出现过滤标记，触发 DOM 回填检查
              if (/CONTENT_FILTER|内容无法展示|违规|已撤回|antiFlag/i.test(txt)) {
                setTimeout(restoreAllFromCache, 600);
              }
            }).catch(function () {});
          } catch (e) {}
          return resp;
        });
      }
      return p;
    };
  }

  /* ============================================================
   * 4. 防撤回 DOM 回填
   * ============================================================ */
  function restoreAllFromCache() {
    if (!CONFIG.antiRecall.enabled) return;
    // 找到每个回答容器，判断是否被替换为过滤提示
    $all('.cs-history-answer').forEach(function (item) {
      var md = $('.ai-markdown', item);
      var box = md ? ($('.cosd-markdown-content', md) || md) : null;
      if (!box) return;
      var cur = box.textContent || '';
      var blocked = /内容无法展示|违反|无法提供该内容|已被删除|CONTENT_FILTER|该回答|安全策略|暂不展示/.test(cur) || cur.trim().length < 6;
      if (!blocked) return;
      // 从缓存找最近的匹配回答（按会话内顺序，简单取该页缓存中长度最接近的）
      var keys = recallStore.keys();
      var best = null;
      keys.forEach(function (k) {
        var v = Bridge.get(k.replace(/^wxem_/, '').replace(/^recall_/, 'recall_'), null);
        // Bridge.get 会自动加前缀；这里直接 localStorage 读
        try { v = JSON.parse(localStorage.getItem(k)); } catch (e) { v = null; }
        if (v && v.answer && (!best || v.answer.length > best.answer.length)) best = v;
      });
      if (best && best.answer.length > cur.length) {
        box.innerHTML = md2html(best.answer);
        var tag = document.createElement('span');
        tag.className = 'wxem-recall-tag'; tag.textContent = '已恢复（防撤回）';
        box.insertBefore(tag, box.firstChild);
      }
    });
  }

  /* ============================================================
   * 5. 自定义全局背景
   * ============================================================ */
  function applyBackground() {
    var layer = $('#wxem-bg-layer'), mask = $('#wxem-bg-mask');
    if (!layer) {
      layer = document.createElement('div'); layer.id = 'wxem-bg-layer';
      mask = document.createElement('div'); mask.id = 'wxem-bg-mask';
      document.documentElement.appendChild(layer);
      document.documentElement.appendChild(mask);
    }
    var c = CONFIG.bg;
    var src = c.upload || c.url;
    if (c.enabled && src) {
      var img = new Image();
      img.onload = function () {
        layer.style.backgroundImage = 'url("' + src + '")';
        layer.style.filter = 'blur(' + c.blur + 'px) brightness(' + c.brightness + '%)';
        layer.style.transform = 'scale(1.08)';
        mask.style.background = 'rgba(255,255,255,' + (0.12 + Math.min(c.blur, 20) / 120) + ')';
        document.documentElement.classList.add('wxem-has-bg');
      };
      img.src = src;
    } else {
      layer.style.backgroundImage = 'none';
      document.documentElement.classList.remove('wxem-has-bg');
    }
  }

  /* ============================================================
   * 6. 胶囊清理：移除 App 专属 / 外部工具 / 图片入口
   * ============================================================ */
  var APP_CAPSULES = ['AI生视频','生成视频','拍题答疑','AI修图','AI写作','健康相机',
    '图片生成','拍照问','测运势','视频通话','打电话','AI音乐','AI播客'];
  // 保留：深度思考 / 模型(文心5.1/DS) / 任务 / 深入研究(登录后可用则保留)
  var KEEP_ALWAYS = ['深度思考','任务','深入研究'];

  function capsuleText(it) {
    var sp = $('.cos-tooltip', it);
    return sp ? sp.textContent.trim() : '';
  }
  function isModelCapsule(it) {
    return !!($('#model-list-id', it) || $('[id*=model-list-id]', it) ||
      it.querySelector('[data-show-ext*="ask_model_btn"]'));
  }

  function cleanCapsules() {
    if (!CONFIG.ui.removeAppCapsules) return;
    $all('.capsules-item').forEach(function (it) {
      var t = capsuleText(it);
      var keep = KEEP_ALWAYS.indexOf(t) !== -1 || isModelCapsule(it);
      if (CONFIG.ui.removeImageEntry && /图片|生视频|视频|修图|拍照|相机|通话|打电话|音乐|播客|运势|写作/.test(t)) keep = false;
      if (!keep) { it.style.display = 'none'; it.setAttribute('data-wxem-hidden', '1'); }
      else { it.style.display = ''; }
    });
  }

  // 拦截 App scheme / 外链跳转（兜底，防止漏网胶囊拉起 App）
  function blockAppScheme() {
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (a && /boxer\.baidu\.com|baiduboxapp|apps\.apple\.com|aigc\.baidu\.com|miaobi\.baidu|sf\/vsearch/.test(a.href)) {
        e.preventDefault(); e.stopPropagation();
        toast('已移除该 App 专属功能');
      }
    }, true);
  }

  /* ============================================================
   * 7. 设置面板（底部滑出，移动端）
   * ============================================================ */
  function switchRow(label, sub, checked, onchange) {
    var row = document.createElement('div'); row.className = 'wxem-row';
    var lab = document.createElement('div'); lab.innerHTML = label + (sub ? '<span class="wxem-sub">' + sub + '</span>' : '');
    var sw = document.createElement('label'); sw.className = 'wxem-switch';
    var inp = document.createElement('input'); inp.type = 'checkbox'; inp.checked = checked;
    var sl = document.createElement('span'); sl.className = 'sl';
    inp.addEventListener('change', function () { onchange(inp.checked); });
    sw.appendChild(inp); sw.appendChild(sl);
    row.appendChild(lab); row.appendChild(sw);
    return row;
  }

  function rangeRow(label, value, min, max, onchange) {
    var wrap = document.createElement('div'); wrap.className = 'wxem-row';
    wrap.style.flexDirection = 'column'; wrap.style.alignItems = 'stretch';
    var top = document.createElement('div'); top.style.display = 'flex'; top.style.justifyContent = 'space-between';
    top.innerHTML = '<span>' + label + '</span><span class="wxem-sub" id="wxem-rv">' + value + '</span>';
    var r = document.createElement('input'); r.type = 'range'; r.className = 'wxem-range';
    r.min = min; r.max = max; r.value = value;
    r.addEventListener('input', function () { $('#wxem-rv').textContent = r.value; onchange(+r.value); });
    wrap.appendChild(top); wrap.appendChild(r);
    return wrap;
  }

  function buildPanel() {
    var panel = document.createElement('div'); panel.id = 'wxem-panel';
    var sheet = document.createElement('div'); sheet.className = 'wxem-sheet';
    var grab = document.createElement('div'); grab.className = 'wxem-grab';
    var h = document.createElement('h3'); h.textContent = '文心增强 · 设置';
    var close = document.createElement('button'); close.textContent = '完成'; close.className = 'wxem-mini';
    close.style.cssText = 'border:0;background:var(--wxem-accent);color:#fff;padding:6px 14px;border-radius:14px;font-size:13px;';
    close.addEventListener('click', function () { panel.classList.remove('open'); });
    h.appendChild(close);
    sheet.appendChild(grab); sheet.appendChild(h);

    sheet.appendChild(switchRow('默认 DeepSeek-V4 Pro', '发送时自动选择 DS-V4 Pro 模型', CONFIG.model.enabled, function (v) {
      CONFIG.model.enabled = v; saveConfig();
    }));
    sheet.appendChild(switchRow('默认开启思考模式', 'thinkMode=1', CONFIG.model.think === '1', function (v) {
      CONFIG.model.think = v ? '1' : '0'; saveConfig();
    }));
    sheet.appendChild(switchRow('默认开启任务模式', 'deep_decision 任务化对话', CONFIG.model.task === 1, function (v) {
      CONFIG.model.task = v ? 1 : 0; saveConfig();
    }));

    sheet.appendChild(document.createElement('hr'));
    sheet.appendChild(switchRow('防撤回', '缓存真实回答，被撤回后自动恢复', CONFIG.antiRecall.enabled, function (v) {
      CONFIG.antiRecall.enabled = v; saveConfig();
    }));

    sheet.appendChild(document.createElement('hr'));
    sheet.appendChild(switchRow('自定义全局背景', '磨砂透明气泡 + 背景图', CONFIG.bg.enabled, function (v) {
      CONFIG.bg.enabled = v; saveConfig(); applyBackground();
    }));
    sheet.appendChild(rangeRow('背景模糊', CONFIG.bg.blur, 0, 30, function (v) { CONFIG.bg.blur = v; saveConfig(); applyBackground(); }));
    sheet.appendChild(rangeRow('背景亮度', CONFIG.bg.brightness, 20, 200, function (v) { CONFIG.bg.brightness = v; saveConfig(); applyBackground(); }));

    var upRow = document.createElement('div'); upRow.className = 'wxem-row';
    var upLab = document.createElement('div'); upLab.textContent = '上传本地背景（≤8MB）';
    var upBtn = document.createElement('button'); upBtn.textContent = '选择图片';
    upBtn.style.cssText = 'border:1px solid var(--wxem-border);background:#fff;border-radius:12px;padding:6px 12px;font-size:13px;';
    var file = document.createElement('input'); file.type = 'file'; file.accept = 'image/*'; file.style.display = 'none';
    upBtn.addEventListener('click', function () { file.click(); });
    file.addEventListener('change', function () {
      var f = file.files[0]; if (!f) return;
      if (f.size > 8 * 1024 * 1024) { toast('图片需 ≤8MB'); return; }
      var rd = new FileReader();
      rd.onload = function () { CONFIG.bg.upload = rd.result; CONFIG.bg.enabled = true; saveConfig(); applyBackground(); toast('背景已更新'); };
      rd.readAsDataURL(f);
    });
    upRow.appendChild(upLab); upRow.appendChild(upBtn); upRow.appendChild(file);
    sheet.appendChild(upRow);

    sheet.appendChild(document.createElement('hr'));
    sheet.appendChild(switchRow('移除 App 专属胶囊', '仅保留网页可用功能', CONFIG.ui.removeAppCapsules, function (v) {
      CONFIG.ui.removeAppCapsules = v; saveConfig(); cleanCapsules();
    }));
    sheet.appendChild(switchRow('整体手机端美化', '圆角/阴影/磨砂/输入框美化', CONFIG.ui.beautify, function (v) {
      CONFIG.ui.beautify = v; saveConfig();
      document.documentElement.classList.toggle('wxem-no-beautify', !v);
    }));

    panel.appendChild(sheet);
    document.body.appendChild(panel);

    // 点击遮罩关闭（在 sheet 外）
    on(panel, 'click', function (e) { if (e.target === panel) panel.classList.remove('open'); });
    return panel;
  }

  function buildFab() {
    var fab = document.createElement('button'); fab.id = 'wxem-fab'; fab.textContent = '✦';
    fab.title = '文心增强设置';
    on(fab, 'click', function () { $('#wxem-panel').classList.toggle('open'); });
    document.body.appendChild(fab);
  }

  /* ============================================================
   * 8. 初始化 / MutationObserver
   * ============================================================ */
  function init() {
    injectStyle();
    installFetchHook();
    blockAppScheme();

    var mo = new MutationObserver(function () {
      if (CONFIG.ui.removeAppCapsules) cleanCapsules();
    });
    mo.observe(document.body, { childList: true, subtree: true });

    var boot = function () {
      try { cleanCapsules(); } catch (e) {}
      try { applyBackground(); } catch (e) {}
      if (!$('#wxem-panel')) { buildPanel(); buildFab(); }
      // 防撤回对账：生成完成后延迟检查
      setTimeout(restoreAllFromCache, 1500);
      setInterval(restoreAllFromCache, 4000);
    };
    if (document.body) boot();
    else document.addEventListener('DOMContentLoaded', boot);
  }

  // document-start 时 body 可能不存在
  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init);

  // 页面历史导航（SPA）后重新清理
  on(window, 'popstate', function () { setTimeout(function () { cleanCapsules(); applyBackground(); }, 500); });
})();
