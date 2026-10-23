# Optional self-hosted Windows signing

Authorized by maintainer: 1.0.0 ships unsigned; from 1.0.1 merges to main produce unsigned artifacts and optionally Windows-signed variants when a self-hosted runner is available. Keep existing draft/manual-publication policy. Do not bump 1.0.0 yet or provision runners/secrets.

- [x] Always package Windows/macOS/Linux unsigned on GitHub runners, with explicit filenames. macOS arm64 may retain ad-hoc signing required by the platform, without a trusted Developer ID/notarization claim.
- [x] Upload validated merge release context. An isolated workflow_run follow-up accepts only successful main-merge release runs, verifies tag/commit/package identity and skips 1.0.0, disabled/missing inventory credentials, busy/offline/missing runners or inventory API failure.
- [x] Optional self-hosted Windows job signs via an accessible local certificate store using explicit thumbprint/publisher; no Azure login. Fail closed on signing verification. Add signed names and a separate checksum manifest to the same release, never overwrite unsigned assets or publish the draft.
- [x] Hosted watchdog cancels only the optional workflow if its self-hosted job remains queued for two minutes, including runner-disappearance race. After starting, job timeout bounds signing work. No unsigned dependency on the follow-up.
- [x] Test decisions/API failures/version/context guards/watchdog and naming, validate builder schema/workflows, update conventions/docs/private guide, run relevant checks and one independent review. Commit locally only.

Tradeoff: runner availability is a snapshot, not a reservation; the isolated workflow/watchdog prevents that race from delaying unsigned output. Actual self-hosted signing and remote Actions remain unverified until configured. Package version stays1.0.0; future1.0.1 must omit releaseName.

Outcome: 76 unit tests/types/lint/format/actionlint and builder schema checks pass. One independent review found a last-poll watchdog race; regressions RED→GREEN after deadline recheck and no cancellation on uncertain API state. Unknown state can leave the optional job queued; unsigned output is already independent. No remote Actions/signing/packaging was performed, no version bump/publication, and private runner notes stay ignored. See docs/VALIDATION.md for evidence and external gates.
