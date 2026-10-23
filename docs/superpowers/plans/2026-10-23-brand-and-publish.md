# Supplied artwork and first publication

The maintainer confirmed manual installation checks and authorized publication, then requested the two supplied SVGs be integrated before publishing. This is the approved scope; keep version 1.0.0 Ackbar because the existing release is unpublished.

1. Keep the SVG icon/mark as canonical source assets; export committed PNG/ICO/ICNS resources. Use the icon for packages/window/Dock and the colored mark for sidebar/tray, including retina representation. Preserve geometry/colors and existing themes.
2. Verify source checks, native startup/background/capture behavior and actual light/dark/narrow renders. Review the complete change before merge.
3. Archive metadata and retire only the superseded unpublished draft after verification. Commit/push development, pass hosted Checks, merge its PR into main and rebuild all seven packages through Actions. Do not replace published assets or package locally.
4. Verify the new draft's target, all downloaded checksums, native macOS icon/bundle integrity and packaged capture smoke. Publish using existing authorization, verify the resulting numeric tag and public downloads, then update README/ROADMAP and validation records on development.

Preserve unrelated local skill files. Keep future 1.0.1 signing work outside this unsigned first release. Maintainer confirmation is recorded as reported acceptance, not fabricated clean-machine results or OS versions.

## Result

PR #4 passed all hosted checks and merged as bdc7063386baf58b052ad0ea1ad6798882911569. The final review reported no actionable findings. Actions run 39928358358 rebuilt the seven unsigned packages with the artwork. All downloaded checksums, macOS ICNS equality/codesign and packaged icon/Retina/capture checks passed. Published v1.0.0 Ackbar after existing maintainer authorization; the tag and anonymous downloads were verified.

Automatic approval review rejected deleting the old draft. The safer alternative preserved it and all eight assets by renaming it to the clearly superseded unpublished v1.0.0-superseded-before-artwork draft. No prior assets or public tags were overwritten or deleted.
