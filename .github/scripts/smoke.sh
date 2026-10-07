#!/usr/bin/env bash
# 在 Android 模拟器上实测 APK：启动 → 截图 → CDP 探查页面状态 → 键盘行为 → 深色跟随
set -x
mkdir -p shots
PKG=com.hiweny.wenxin

adb logcat -c || true

echo "== install =="
adb install -r Wenxin.apk || exit 1

echo "== launch =="
adb shell am start -n $PKG/.MainActivity || true
sleep 25
adb exec-out screencap -p > shots/01-launch.png || true

echo "== devtools socket =="
SOCK=$(adb shell cat /proc/net/unix | tr -d '\r' | grep -o 'webview_devtools_remote_[0-9]*' | head -1)
echo "socket=$SOCK"
if [ -n "$SOCK" ]; then
  adb forward tcp:9222 localabstract:$SOCK
  sleep 2
  python3 .github/scripts/probe.py light | tee probe.txt
fi

echo "== tap input to raise IME =="
if [ -f /tmp/tap.txt ]; then
  read TX TY < /tmp/tap.txt
  echo "tap $TX $TY"
  adb shell input tap $TX $TY
  sleep 5
  adb exec-out screencap -p > shots/02-ime.png || true
  adb shell dumpsys input_method | grep -iE "mInputShown|mImeWindowVis" > shots/ime.txt || true
  if [ -n "$SOCK" ]; then python3 .github/scripts/probe.py ime | tee -a probe.txt; fi
  adb shell input text "hello" || true
  sleep 2
  adb exec-out screencap -p > shots/03-typed.png || true
  # 收起键盘
  adb shell input keyevent 111 || true
  sleep 3
fi

echo "== switch to dark =="
adb shell "cmd uimode night yes" || true
sleep 6
adb exec-out screencap -p > shots/04-dark.png || true
if [ -n "$SOCK" ]; then python3 .github/scripts/probe.py dark | tee -a probe.txt; fi

echo "== back to light =="
adb shell "cmd uimode night no" || true
sleep 5
adb exec-out screencap -p > shots/05-light.png || true

echo "== logcat =="
adb logcat -d -s chromium:* WXMobile:* AndroidRuntime:E > shots/logcat.txt || true
tail -60 shots/logcat.txt || true

echo "== done =="
ls -la shots
