#!/usr/bin/env python3
"""通过 Chrome DevTools Protocol 探查运行中的 WebView（页面真实状态）。"""
import base64
import json
import os
import sys
import time
import urllib.request

import websocket

TAG = sys.argv[1] if len(sys.argv) > 1 else "probe"
SHOTS = "shots"
os.makedirs(SHOTS, exist_ok=True)

EXPRS = {
    "apkFlag": "window.__WX_APK__===true",
    "forceMobile": "window.__WX_FORCE_MOBILE__===true",
    "url": "location.href",
    "bodyClass": "document.body?document.body.className:''",
    "htmlClass": "document.documentElement.className",
    "innerSize": "window.innerWidth+'x'+window.innerHeight",
    "clientW": "document.documentElement.clientWidth",
    "visualVH": "(window.visualViewport?Math.round(window.visualViewport.height):-1)",
    "dpr": "window.devicePixelRatio",
    "zoom": "document.documentElement.style.zoom||'1'",
    "darkMedia": "matchMedia('(prefers-color-scheme:dark)').matches",
    "bodyBg": "document.body?getComputedStyle(document.body).backgroundColor:''",
    "hasBgLayer": "!!document.getElementById('wx-bg')",
    "hasHamburger": "!!document.getElementById('wx-hamburger')",
    "hasGear": "!!document.getElementById('wx-settings-btn')",
    "scaled": "document.body?document.body.classList.contains('wx-scaled'):false",
    "inputRect": "(function(){var e=document.querySelector('#chat-input-home')||document.querySelector('textarea')||document.querySelector('[contenteditable=true]');"
                 "if(!e)return null;var r=e.getBoundingClientRect();"
                 "return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),bottom:Math.round(r.bottom)};})()",
    "inputCount": "document.querySelectorAll('textarea,[contenteditable=true]').length",
    "pageH": "Math.round(document.documentElement.scrollHeight)",
    "ua": "navigator.userAgent",
    "crashed": "window.__wxCrashed===true",
}


def ws_url():
    for _ in range(15):
        try:
            data = json.load(urllib.request.urlopen("http://127.0.0.1:9222/json", timeout=4))
            for t in data:
                if t.get("type") == "page" and t.get("webSocketDebuggerUrl"):
                    return t["webSocketDebuggerUrl"]
        except Exception:
            pass
        time.sleep(1)
    return None


def main():
    url = ws_url()
    if not url:
        print(json.dumps({"error": "no devtools target"}))
        return 1
    ws = websocket.create_connection(url, timeout=20, suppress_origin=True)
    mid = [0]

    def call(method, params=None):
        mid[0] += 1
        ws.send(json.dumps({"id": mid[0], "method": method, "params": params or {}}))
        while True:
            m = json.loads(ws.recv())
            if m.get("id") == mid[0]:
                return m

    out = {"tag": TAG}
    for k, expr in EXPRS.items():
        r = call("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True})
        res = r.get("result", {})
        if "exceptionDetails" in res:
            out[k] = "ERR:" + str(res["exceptionDetails"].get("text"))
        else:
            out[k] = res.get("result", {}).get("value")

    # 页面截图（比 adb screencap 更干净，只含网页内容）
    shot = call("Page.captureScreenshot", {"format": "png"})
    data = shot.get("result", {}).get("data")
    if data:
        with open(os.path.join(SHOTS, "web-%s.png" % TAG), "wb") as f:
            f.write(base64.b64decode(data))

    print(json.dumps(out, ensure_ascii=False, indent=1))

    # 供 shell 使用的点击坐标（物理像素）
    ir = out.get("inputRect")
    if isinstance(ir, dict):
        dpr = float(out.get("dpr") or 1)
        x = int((ir["x"] + ir["w"] / 2) * dpr)
        y = int((ir["y"] + ir["h"] / 2) * dpr)
        with open("/tmp/tap.txt", "w") as f:
            f.write("%d %d" % (x, y))
        print("TAP %d %d" % (x, y))
    ws.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
