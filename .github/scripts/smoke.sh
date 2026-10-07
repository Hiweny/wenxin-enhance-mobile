#!/usr/bin/env bash
# 在 Android 模拟器上实测 APK：启动 → 截图 → 读 app 日志里的页面状态 → CDP 探查 → 键盘 → 深色跟随
# 所有 adb 命令都套 timeout，避免个别命令在软件渲染的模拟器上挂死。
set -x
mkdir -p shots
PKG=com.hiweny.wenxin
TMO="timeout 90"
stamp() { echo "[$(date -u +%H:%M:%S)] $*"; }

stamp "boot check"
$TMO adb shell getprop sys.boot_completed || true
$TMO adb logcat -c || true
$TMO adb shell dumpsys webviewupdate | head -12 || true

stamp "network check"
$TMO adb shell ping -c 3 -W 3 www.baidu.com || stamp "ping failed"

stamp "install"
$TMO adb install -r Wenxin.apk || stamp "install failed"

stamp "launch"
$TMO adb shell am start -W -n $PKG/.MainActivity || true
sleep 20
$TMO adb exec-out screencap -p > shots/01-launch-20s.png || true
sleep 20
$TMO adb exec-out screencap -p > shots/02-launch-40s.png || true
ls -la shots/ || true

stamp "app log (页面状态由 app 自己回报)"
timeout 60 adb logcat -d -s WenxinWeb:V chromium:V AndroidRuntime:E > shots/logcat.txt || true
grep -aE "WenxinWeb|STATE|onPage|onReceived|ERR" shots/logcat.txt | tail -40 || true

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
  $TMO adb exec-out screencap -p > shots/03-ime.png || true
  $TMO adb shell dumpsys input_method | grep -iE "mInputShown|mImeWindowVis" > shots/ime.txt || true
  if [ -n "$SOCK" ]; then timeout 120 python3 .github/scripts/probe.py ime | tee -a probe.txt || true; fi
  $TMO adb shell input text "hello" || true
  sleep 2
  $TMO adb exec-out screencap -p > shots/04-typed.png || true
  $TMO adb shell input keyevent 111 || true
  sleep 2
else
  stamp "no tap target (probe found no input)"
fi

stamp "switch to dark"
$TMO adb shell "cmd uimode night yes" || true
sleep 5
$TMO adb exec-out screencap -p > shots/05-dark.png || true
if [ -n "$SOCK" ]; then timeout 120 python3 .github/scripts/probe.py dark | tee -a probe.txt || true; fi

stamp "back to light"
$TMO adb shell "cmd uimode night no" || true
sleep 4
$TMO adb exec-out screencap -p > shots/06-light.png || true

stamp "final app log"
timeout 60 adb logcat -d -s WenxinWeb:V chromium:V AndroidRuntime:E > shots/logcat2.txt || true
grep -aE "WenxinWeb|STATE|onPage|onReceived" shots/logcat2.txt | tail -30 || true

stamp "done"
ls -la shots
