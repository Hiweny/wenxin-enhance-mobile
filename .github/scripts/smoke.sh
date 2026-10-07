#!/usr/bin/env bash
# 在 Android 模拟器上实测 APK：启动 → 多次截图 → 前台/进程确认 → 崩溃日志 → CDP 探查 → 键盘 → 深色跟随
set -x
mkdir -p shots
PKG=com.hiweny.wenxin
TMO="timeout 90"
stamp() { echo "[$(date -u +%H:%M:%S)] $*"; }

stamp "boot check"
$TMO adb shell getprop sys.boot_completed || true
$TMO adb logcat -c || true
$TMO adb shell dumpsys webviewupdate | head -12 || true

stamp "install"
$TMO adb install -r Wenxin.apk || stamp "install failed"

stamp "launch"
$TMO adb shell am start -n $PKG/.MainActivity || true

for t in 15 30 50 70; do
  sleep 15
  $TMO adb exec-out screencap -p > shots/t${t}s.png || true
  echo "--- @${t}s pid=$($TMO adb shell pidof $PKG | tr -d '\r') fg=$($TMO adb shell dumpsys activity activities | grep -aE 'ResumedActivity|topResumedActivity' | head -1 | tr -d '\r')"
done
ls -la shots/ || true

stamp "app log"
timeout 90 adb logcat -d -v time -s WenxinWeb:V ActivityTaskManager:I ActivityManager:I AndroidRuntime:E chromium:V > shots/logcat.txt || true
grep -aE "WenxinWeb|STATE|onPage|onReceived|FATAL|died|ANR" shots/logcat.txt | tail -40 || true

stamp "crash buffer"
timeout 60 adb logcat -d -b crash -v time > shots/crash.txt || true
tail -40 shots/crash.txt || true

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
  $TMO adb exec-out screencap -p > shots/ime.png || true
  $TMO adb shell dumpsys input_method | grep -iE "mInputShown|mImeWindowVis" > shots/ime.txt || true
  if [ -n "$SOCK" ]; then timeout 120 python3 .github/scripts/probe.py ime | tee -a probe.txt || true; fi
  $TMO adb shell input text "hello" || true
  sleep 2
  $TMO adb exec-out screencap -p > shots/typed.png || true
  $TMO adb shell input keyevent 111 || true
  sleep 2
else
  stamp "no tap target"
fi

stamp "switch to dark"
$TMO adb shell "cmd uimode night yes" || true
sleep 5
$TMO adb exec-out screencap -p > shots/dark.png || true
if [ -n "$SOCK" ]; then timeout 120 python3 .github/scripts/probe.py dark | tee -a probe.txt || true; fi

stamp "back to light"
$TMO adb shell "cmd uimode night no" || true
sleep 4
$TMO adb exec-out screencap -p > shots/light.png || true

stamp "final logs"
timeout 90 adb logcat -d -v time -s WenxinWeb:V AndroidRuntime:E chromium:V > shots/logcat2.txt || true
grep -aE "WenxinWeb|STATE|onPage|onReceived|FATAL" shots/logcat2.txt | tail -30 || true

stamp "done"
ls -la shots
