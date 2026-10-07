#!/usr/bin/env bash
# 模拟器实测：①深色模式 + 真实站点（验证白块/对比度修复）②轻量页键盘行为
# 注：CI 模拟器只有软件 GPU，真实站点跑久了会把整机拖崩，所以把最重要的深色验证放在最前面。
set -x
mkdir -p shots
PKG=com.hiweny.wenxin
TMO="timeout 90"
stamp() { echo "[$(date -u +%H:%M:%S)] $*"; }

stamp "boot"
$TMO adb shell getprop sys.boot_completed || true
$TMO adb logcat -c || true
$TMO adb shell settings put secure show_ime_with_hard_keyboard 1 || true

stamp "install"
$TMO adb install -r Wenxin.apk || stamp "install failed"

# ================= 阶段 1：深色模式 + 真实站点 =================
stamp "phase1: force night + launch real site"
$TMO adb shell "cmd uimode night yes" || true
sleep 4
$TMO adb exec-out screencap -p > shots/p1-shell-dark.png || true
$TMO adb shell am start -n $PKG/.MainActivity || true
sleep 14
$TMO adb exec-out screencap -p > shots/p1-dark-14s.png || true
echo "--- p1 @14s pid=$($TMO adb shell pidof $PKG | tr -d '\r')"
sleep 10
$TMO adb exec-out screencap -p > shots/p1-dark-24s.png || true
echo "--- p1 @24s pid=$($TMO adb shell pidof $PKG | tr -d '\r')"

stamp "phase1 state via CDP"
SOCK=$($TMO adb shell cat /proc/net/unix | tr -d '\r' | grep -o 'webview_devtools_remote_[0-9]*' | head -1)
stamp "socket=$SOCK"
if [ -n "$SOCK" ]; then
  $TMO adb forward tcp:9222 localabstract:$SOCK || true
  sleep 2
  timeout 100 python3 .github/scripts/probe.py dark-home | tee probe.txt || stamp "probe failed"
fi

stamp "phase1 open drawer (看抽屉内白块)"
$TMO adb shell input swipe 30 900 700 900 220 || true
sleep 4
$TMO adb exec-out screencap -p > shots/p1-dark-drawer.png || true
if [ -n "$SOCK" ]; then timeout 100 python3 .github/scripts/probe.py dark-drawer | tee -a probe.txt || true; fi

stamp "phase1 logs"
timeout 60 adb logcat -d -v time -s WenxinWeb:V AndroidRuntime:E > shots/logcat-p1.txt || true
grep -aE "WenxinWeb|STATE|dark mode|onPage|FATAL" shots/logcat-p1.txt | tail -15 || true

# ================= 阶段 2：浅色对照 =================
stamp "phase2: light control"
$TMO adb shell "cmd uimode night no" || true
sleep 3
$TMO adb shell am force-stop $PKG || true
sleep 2
$TMO adb shell am start -n $PKG/.MainActivity || true
sleep 14
$TMO adb exec-out screencap -p > shots/p2-light.png || true
echo "--- p2 pid=$($TMO adb shell pidof $PKG | tr -d '\r')"
if [ -n "$SOCK" ]; then timeout 100 python3 .github/scripts/probe.py light | tee -a probe.txt || true; fi

stamp done
ls -la shots
