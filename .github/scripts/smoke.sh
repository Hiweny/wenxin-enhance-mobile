#!/usr/bin/env bash
# 在 Android 模拟器上实测 APK：启动 → 截图 → CDP 探查页面状态 → 键盘行为 → 深色跟随
# 所有 adb 命令都套 timeout，避免个别命令在软件渲染的模拟器上挂死。
set -x
mkdir -p shots
PKG=com.hiweny.wenxin
TMO="timeout 90"
stamp() { echo "[$(date -u +%H:%M:%S)] $*"; }

stamp "boot check"
$TMO adb shell getprop sys.boot_completed || true
$TMO adb logcat -c || true

stamp "install"
$TMO adb install -r Wenxin.apk || stamp "install failed"

stamp "launch"
$TMO adb shell am start -W -n $PKG/.MainActivity || true
sleep 18

stamp "screencap 01"
$TMO adb exec-out screencap -p > shots/01-launch.png || stamp "screencap failed"
ls -la shots/ || true

stamp "devtools socket"
SOCK=$($TMO adb shell cat /proc/net/unix | tr -d '\r' | grep -o 'webview_devtools_remote_[0-9]*' | head -1)
stamp "socket=$SOCK"
if [ -n "$SOCK" ]; then
  $TMO adb forward tcp:9222 localabstract:$SOCK || true
  sleep 2
  timeout 120 python3 .github/scripts/probe.py light | tee probe.txt || stamp "probe failed"
fi

stamp "tap input to raise IME"
if [ -f /tmp/tap.txt ]; then
  read TX TY < /tmp/tap.txt
  stamp "tap $TX $TY"
  $TMO adb shell input tap $TX $TY || true
  sleep 4
  $TMO adb exec-out screencap -p > shots/02-ime.png || true
  $TMO adb shell dumpsys input_method | grep -iE "mInputShown|mImeWindowVis" > shots/ime.txt || true
  if [ -n "$SOCK" ]; then timeout 120 python3 .github/scripts/probe.py ime | tee -a probe.txt || true; fi
  $TMO adb shell input text "hello" || true
  sleep 2
  $TMO adb exec-out screencap -p > shots/03-typed.png || true
  $TMO adb shell input keyevent 111 || true
  sleep 2
else
  stamp "no tap target (probe found no input)"
fi

stamp "switch to dark"
$TMO adb shell "cmd uimode night yes" || true
sleep 5
$TMO adb exec-out screencap -p > shots/04-dark.png || true
if [ -n "$SOCK" ]; then timeout 120 python3 .github/scripts/probe.py dark | tee -a probe.txt || true; fi

stamp "back to light"
$TMO adb shell "cmd uimode night no" || true
sleep 4
$TMO adb exec-out screencap -p > shots/05-light.png || true

stamp "logcat"
timeout 60 adb logcat -d -s chromium:* WXMobile:* AndroidRuntime:E > shots/logcat.txt || true
tail -40 shots/logcat.txt || true

stamp "done"
ls -la shots
