#!/usr/bin/env bash
# 在 Android 模拟器上实测 APK。
# 阶段 1：加载轻量内联页（固定底部输入框）→ 验证「键盘不遮、输入框不塌、不闪」
# 阶段 2：加载真实站点 → 验证启动、全屏沉浸、脚本注入
# 说明：CI 模拟器只有软件 GPU，真实站点（重 JS）渲染久了容易把整机拖崩，所以把键盘验证放在轻页面阶段先做。
set -x
mkdir -p shots
PKG=com.hiweny.wenxin
TMO="timeout 90"
stamp() { echo "[$(date -u +%H:%M:%S)] $*"; }

stamp "boot check"
$TMO adb shell getprop sys.boot_completed || true
$TMO adb logcat -c || true
$TMO adb shell dumpsys webviewupdate | head -8 || true

stamp "install"
$TMO adb install -r Wenxin.apk || stamp "install failed"

# ---------- 阶段 1：轻量页 + 键盘行为 ----------
TESTHTML='<!doctype html><html><head><meta charset=utf-8><meta name="viewport" content="width=980,user-scalable=no,viewport-fit=cover"><style>html,body{margin:0;padding:0;background:#fff;font:16px system-ui}#bottom{position:fixed;left:0;right:0;bottom:0;padding:10px;background:rgba(255,255,255,.95);border-top:1px solid #ddd}textarea{width:100%;box-sizing:border-box;height:48px;font-size:18px}</style></head><body><div id="bottom"><textarea id="ta" placeholder="keyboard test"></textarea></div><script>window.__TESTPAGE__=1;</script></body></html>'
B64=$(printf '%s' "$TESTHTML" | base64 -w0)
stamp "phase1 launch (lightweight page)"
$TMO adb shell am start -n $PKG/.MainActivity --es wxurl "data:text/html;base64,$B64" || true
sleep 12
$TMO adb exec-out screencap -p > shots/p1-idle.png || true
echo "--- p1 pid=$($TMO adb shell pidof $PKG | tr -d '\r')"

SOCK=$($TMO adb shell cat /proc/net/unix | tr -d '\r' | grep -o 'webview_devtools_remote_[0-9]*' | head -1)
stamp "phase1 socket=$SOCK"
if [ -n "$SOCK" ]; then
  $TMO adb forward tcp:9222 localabstract:$SOCK || true
  sleep 2
  timeout 90 python3 .github/scripts/probe.py p1-idle | tee probe.txt || stamp "probe failed"
fi

stamp "phase1 tap input -> IME"
SIZE=$($TMO adb shell wm size | tr -d '\r' | grep -oE '[0-9]+x[0-9]+' | head -1)
SW=${SIZE%x*}; SH=${SIZE#*x}
if [ -z "$SW" ]; then SW=1080; SH=1920; fi
TX=$((SW / 2)); TY=$((SH - 60))
if [ -n "$TX" ]; then
  stamp "tap $TX $TY (fixed bottom-center)"
  $TMO adb shell input tap $TX $TY || true
  sleep 5
  $TMO adb exec-out screencap -p > shots/p1-ime.png || true
  $TMO adb shell dumpsys input_method | grep -iE "mInputShown|mImeWindowVis" > shots/p1-ime.txt || true
  grep -a "mInputShown" shots/p1-ime.txt || true
  if [ -n "$SOCK" ]; then timeout 90 python3 .github/scripts/probe.py p1-ime | tee -a probe.txt || true; fi
  $TMO adb shell input text "hello" || true
  sleep 2
  $TMO adb exec-out screencap -p > shots/p1-typed.png || true
  $TMO adb shell input keyevent 4 || true
  sleep 2
  $TMO adb exec-out screencap -p > shots/p1-closed.png || true
else
  stamp "phase1 no tap target"
fi

stamp "phase1 logs"
timeout 60 adb logcat -d -v time -s WenxinWeb:V AndroidRuntime:E chromium:V > shots/logcat-p1.txt || true
grep -aE "WenxinWeb|STATE|onPage|onReceived|FATAL" shots/logcat-p1.txt | tail -20 || true

# ---------- 阶段 2：真实站点 ----------
stamp "phase2 launch (real site)"
$TMO adb shell am force-stop $PKG || true
sleep 2
$TMO adb shell am start -n $PKG/.MainActivity || true
sleep 18
$TMO adb exec-out screencap -p > shots/p2-18s.png || true
echo "--- p2 @18s pid=$($TMO adb shell pidof $PKG | tr -d '\r')"
sleep 15
$TMO adb exec-out screencap -p > shots/p2-33s.png || true
echo "--- p2 @33s pid=$($TMO adb shell pidof $PKG | tr -d '\r')"

stamp "phase2 logs"
timeout 60 adb logcat -d -v time -s WenxinWeb:V AndroidRuntime:E chromium:V > shots/logcat-p2.txt || true
grep -aE "WenxinWeb|STATE|onPage|onReceived|FATAL" shots/logcat-p2.txt | tail -25 || true

stamp "done"
ls -la shots
