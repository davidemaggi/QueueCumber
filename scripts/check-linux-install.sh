#!/usr/bin/env bash
# Checks an installed QueueCumber Linux package, inside a throwaway container. Used by
# .github/workflows/package-managers.yml after installing the release's .deb, .rpm or AUR package.
# QueueCumber has no command-line interface, so instead of a --version this checks the installed
# package's version, that every shared library resolves, the desktop entry and icon and, with
# "start", that the app actually starts (under Xvfb, as root, so without Chromium's sandbox).
#
#   check-linux-install.sh <version> <deb|rpm|pacman> <package> [start]
set -euo pipefail
version=$1 kind=$2 package=$3 start=${4:-}
fail() {
  echo "check-linux-install: $*" >&2
  exit 1
}

case "$kind" in
  deb) installed=$(dpkg-query -W -f='${Version}' "$package") ;;
  rpm) installed=$(rpm -q --qf '%{VERSION}' "$package") ;;
  pacman) installed=$(pacman -Q "$package" | awk '{print $2}'); installed=${installed%-*} ;;
  *) fail "unknown package kind $kind" ;;
esac
[ "$installed" = "$version" ] || fail "$package is version $installed, expected $version"

app=$(readlink -f /usr/bin/queuecumber) || fail '/usr/bin/queuecumber is missing'
[ -x "$app" ] || fail "$app isn't executable"
missing=$(ldd "$app" | grep 'not found' || true)
[ -z "$missing" ] || fail "missing libraries: $missing"
test -f /usr/share/applications/queuecumber.desktop || fail 'no desktop entry'
test -f /usr/share/icons/hicolor/256x256/apps/queuecumber.png || fail 'no 256 px icon'
echo "$package $installed: $app, every library found, desktop entry and icons in place"

[ "$start" = start ] || exit 0
case "$kind" in
  deb) DEBIAN_FRONTEND=noninteractive apt-get install -y -qq xvfb xauth >/dev/null ;;
  rpm)
    xvfb() { dnf install -y -q --disablerepo=fedora-cisco-openh264 xorg-x11-server-Xvfb xorg-x11-xauth >/dev/null; }
    xvfb || { sleep 15; xvfb; }
    ;;
  pacman) pacman -S --noconfirm --needed xorg-server-xvfb xorg-xauth >/dev/null ;;
esac
# Still running after 20 seconds means it started: timeout ends it with 124
status=0
timeout 20 xvfb-run -a "$app" --no-sandbox --user-data-dir=/tmp/qc-profile >/tmp/qc-start.log 2>&1 || status=$?
if [ "$status" != 124 ]; then
  cat /tmp/qc-start.log >&2
  fail "the app exited with $status within 20 seconds"
fi
echo "$package $installed started and kept running"
