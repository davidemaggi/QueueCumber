# QueueCumber artwork

The maintainer supplied `icon.svg` (square application icon) and `mark.svg` (transparent mark). These SVGs are the source artwork; keep their geometry and colors intact.

The renderer uses the SVG mark directly. The tray uses its colored 20 px and 40 px PNG exports as 1x/2x representations; monochrome template mode would flatten the filled rings. Platform application icons use the square artwork: PNG for Linux/window/Dock, multi-resolution ICO for Windows/NSIS and ICNS for macOS.

Run `sh scripts/generate-icons.sh` on macOS with `rsvg-convert`, ImageMagick (`magick`) and Apple's `iconutil` installed to regenerate the committed native resources. These are source assets; release runners package the committed exports and need no conversion tools. All distribution packages still build only through GitHub Actions after a main merge.
