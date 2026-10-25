#!/bin/sh
# Developer asset export on macOS. Outputs are committed; release runners need no image tools.
set -eu
cd "$(dirname "$0")/.."
for tool in rsvg-convert magick iconutil; do
  command -v "$tool" >/dev/null || { echo "Missing asset tool: $tool" >&2; exit 1; }
done
icon_tmp=$(mktemp -d)
trap 'rm -rf "$icon_tmp"' EXIT HUP INT TERM
mkdir -p "$icon_tmp/App.iconset"
for size in 16 24 32 48 64 128 256 512 1024; do
  rsvg-convert -w "$size" -h "$size" resources/branding/icon.svg -o "$icon_tmp/$size.png"
done
cp "$icon_tmp/1024.png" resources/icon.png
# Linux icon themes look up fixed hicolor sizes; a lone 1024 px PNG is often ignored.
mkdir -p resources/linux
for size in 16 24 32 48 64 128 256 512; do
  cp "$icon_tmp/$size.png" "resources/linux/${size}x${size}.png"
done
for size in 16 32 128 256 512; do
  cp "$icon_tmp/$size.png" "$icon_tmp/App.iconset/icon_${size}x${size}.png"
  double=$((size * 2))
  cp "$icon_tmp/$double.png" "$icon_tmp/App.iconset/icon_${size}x${size}@2x.png"
done
iconutil -c icns "$icon_tmp/App.iconset" -o resources/icon.icns
magick "$icon_tmp/256.png" "$icon_tmp/128.png" "$icon_tmp/64.png" "$icon_tmp/48.png" "$icon_tmp/32.png" "$icon_tmp/24.png" "$icon_tmp/16.png" resources/icon.ico
rsvg-convert -w 20 -h 20 resources/branding/mark.svg -o resources/tray.png
rsvg-convert -w 40 -h 40 resources/branding/mark.svg -o resources/tray@2x.png
