# First release — 1.0.0 Ackbar

The maintainer authorized proceeding with the first release on 2026-10-23. Keep source work on development. Distribution builds run only in GitHub Actions following a PR merge into main. The first version is unsigned; optional Windows signing starts with a later 1.0.1 patch.

1. Complete the in-progress guided connection/demo change, its final review and regression checks. Preserve unrelated local skill files.
2. Commit and push development, open the initial release PR into main, and verify hosted Checks on its exact head. Resolve actual failures before merging; do not bypass protections or force-push.
3. Merge the reviewed PR only when checks pass. Verify the release workflow selects the immutable merge commit and produces every expected unsigned artifact plus checksums. Do not package distribution assets locally or create a tag ahead of the workflow.
4. Inspect the generated draft and verify asset hashes and tag provenance. Record actual build outcomes without claiming clean-machine, OS-keystore or cloud acceptance. Follow the acceptance checklist before public publication; report any external gate that cannot be completed here.

The repository's default branch initially contains only LICENSE and .gitignore. Check the initial workflow bootstrap explicitly; do not introduce a manual distribution trigger to work around it.
