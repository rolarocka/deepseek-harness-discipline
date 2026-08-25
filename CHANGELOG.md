# Changelog

All notable changes to **deepseek-harness-discipline**. This project follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions are added
once the repo starts tagging releases, until then changes accumulate in the
dated section below.

The eight presets are intentional per-directory copies (self-contained install;
the `discipline-guard.js` plugin "travels with the preset"), so an entry often
touches all `presets/<id>` trees at once.

## [Unreleased] — 2026-08-23

### Added

- **SURFACE ASSUMPTIONS + SURGICAL DIFF rules** — two rules added (32 → 34)
  across all eight presets and the always-on discipline card, distilled from
  [andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills)
  (MIT; behavioral guidelines derived from Andrej Karpathy's observations on
  LLM coding pitfalls): state assumptions explicitly, present competing
  interpretations instead of running on a silent guess, and push back when a
  simpler approach exists; keep every changed line traceable to the request —
  no orthogonal improvements, no refactors of working code, orphan cleanup
  limited to your own change. The consistency guard now asserts rules 1..34.
- **`optimized` preset changelog catch-up** — entries the variant shipped with:
  shell `timeoutMs` raised to 600000 ms (cold Gradle builds), `!!js` platform
  switching replaced by two unconditionally enabled shell rows (no loader
  dependency), dead `dsh-tool-ralph` config keys removed after schema
  verification, and pure-repetition detection introduced in its guard fork
  (since backported to all copies, see below).

### Changed

- **Oscillation breaker catches straight repetition** — A,A,A,A,A (same tool,
  identical arguments, five calls in a row) now trips the circuit breaker in
  all nine discipline-guard copies; previously only A,B,A,B,A alternation was
  detected, so a pure repeat loop could run forever. Semantics backported
  from the `optimized` fork and pinned by tests for both variants; README
  breaker description updated accordingly.

### Fixed

- **`install.sh` retention broke on stock macOS** — pruning used `mapfile`
  (bash ≥ 4), while macOS still ships bash 3.2: the script aborted with
  exit 127 after installing but before pruning. Replaced with a plain
  pipeline that works on bash 3.2+.
- **`canonical()` never throws** — a BigInt argument made `JSON.stringify`
  throw before the string fallback applied, violating the always-string
  signature contract; bigints now serialize as `<value>n`.
- **Docs sync after review** — README/THIRD-PARTY no longer claim the 32
  rules live in *every* persona (`optimized` carries its own directives);
  manual-install snippets and picker lists include `optimized`; stale
  "platform-switched" descriptions, the CI step name and the pre-commit
  comment corrected; the `optimized` shell-row comment now states the real
  rationale (deliberate divergence, not repo convention).
- **Whole-repo review hardening sweep** — findings from a two-axis review of
  every tracked file (all verified by consistency check + unit tests):
  - large-read guard normalizes `tool:`/`tool-` prefixes on `exec.name`
    (same unpinned-contract stance as `read-only-guard`) in all nine copies;
  - fs resolve/stat failures fail open but warn once instead of silently
    skipping the >25 KB check;
  - breaker deny reason + comments now cover straight repetition, not just
    alternation; stale inline comments corrected;
  - both installers roll the backup back when the copy step fails mid-loop,
    so a preset can never be left absent; `install.ps1` is ASCII-only as its
    header claims and lists `optimized` in its closing summary;
  - `.gitattributes` pins `*.sh` and `hooks/pre-commit` to LF — CRLF
    worktree copies made bash die on `pipefail\r` on default Windows clones;
  - consistency guard: persona row end-anchored, a persona placed after the
    rules is rejected, end-marker regex derived from `RULE_COUNT`,
    duplicate-`- id:` check accepts indented rows;
  - CI: Node 22/24 matrix (Node 20 is EOL), concurrency grouping, `push`
    limited to main, actions bumped v4 → v7;
  - tests pin the fork's `canonical()` bigint branch, prefixed read names,
    the 25600/25601-byte boundary and the fail-open path; unused import
    removed;
  - docs: README verification note covers the ninth preset truthfully,
    THIRD-PARTY-NOTICES scopes caveman's MIT carve-out (engine dirs are
    BUSL-1.1 upstream), install.md documents `-DshHome`.

## [Unreleased] — 2026-08-22

### Added

- **Read-only Guard** — new preset-local plugin `plugins/read-only-guard.js`,
  mounted in exactly the three read-only presets (`planner`, `advisor`,
  `hunter`). DSH's `@deepseek-ai/dsh-tool-fs` registers the full
  `read`/`write`/`edit` suite unconditionally (verified against the
  `dsh-tool-fs@0.1.0-rc.7` package source), so dropping the shell rows alone
  left `write`/`edit` in those agents' tool catalogs with only the persona
  prompt as a fence. The guard denies both tools deterministically on
  `tools/pre-execute` and adds an always-on prompt card — restoring the
  enforcement half of opencode-agents' `permission: {edit: deny}`.
  `shared/check-consistency.mjs` now also verifies the file exists in exactly
  the read-only presets, is byte-identical across them, and that its mount row
  is present there and absent in the shell presets.

### Changed

- **Oscillation breaker is a hard stop** — a denied call's signature is
  removed from the ring again (new exported, unit-tested helpers `recordCall`
  and `unrecordCall`), so an identical retry lands on the same A,B,A,B ring
  and denies again instead of shifting the cycle's phase and resuming it.
  Denied reads no longer pollute the ring either. The deny paths remove by
  value (`unrecordCall`), not by position: the large-read deny decides after
  two awaits, and a concurrent call for the same agent may have mutated the
  ring in between.
- **Large-read guard wording matches DSH reality** — the old comment claimed
  an offset-only read "reads to EOF"; actually dsh-tool-fs defaults `limit` to
  its host cap (2000 lines, ~50 KB response cap). The comment and the deny
  message now describe whole-file-scale reads accurately; guard behavior is
  unchanged (still conservative).
- **Consistency guard asserts rule-block structure** — each rules block must
  contain exactly rules 1..32, sequentially numbered. This catches uniform
  insertions/deletions applied identically to all eight presets, which the
  majority comparison cannot see. Remaining blind spot documented in the
  script header: identical content edits across all copies still pass.
- **Consistency guard rejects duplicate mount rows** — every `- id:` within a
  preset file must be unique; a duplicated row mounts a component twice (the
  exact bug an install-repair briefly introduced in `hunter`). Row-match
  regexes are now end-anchored, so `- id: tool-bash-x` can no longer satisfy
  a `tool-bash` check.
- **Tests exercise the real plugin wiring** — new fake-ctx harness drives
  `apply()` directly: the hard stop on identical retries, the large-read deny
  with window guidance, and the read-only guard's write/edit denies are all
  proven through the registered `tools/pre-execute` handler, not
  hand-simulated. The harness also documents that rings key on `exec.agent`
  identity: a fresh agent object per call silently disables the breaker.
- **CI runs the unit tests** — the workflow now executes `npm test` alongside
  the consistency check.

### Fixed

- **`install.ps1` same-second collision** — backup stamps now carry
  milliseconds (`yyyyMMdd-HHmmss-fff`), so two installs within one second no
  longer race on the same backup directory. `-KeepBackups` is validated to
  1..99 (0 would have pruned the fresh backup too).
- **CI least privilege** — the workflow sets `permissions: contents: read`.
- **CHANGELOG drift** — the unit-test bullet dropped its brittle exact case
  count (said "10 cases" while the suite had grown).

## [Unreleased] — 2026-08-20

### Added

- **Local-variant preset `optimized`** — ninth preset, shipped verbatim from
  the maintainer's machine: Android/Gradle-focused persona, condensed
  discipline-guard fork (circuit breaker + large-read guard only),
  unconditional `tool-bash`/`tool-pwsh` rows (no `!!js` switching) and
  Android noise-filtered fs-search excludes. Wired into both installers and
  existence-checked by the consistency script (`LOCAL_PRESETS`), deliberately
  outside the byte-identity contracts that bind the eight ported presets.
- **GATES LEDGER + REPORT AUDIT rules** — two rules added (30 → 32) across all
  eight presets and the always-on discipline card, distilled from
  [unlazy](https://github.com/Leonxlnx/unlazy): before non-trivial work,
  acceptance gates are written as `- [ ] G: ... CHECK: <command> EXPECT:
  <result>` and a checked box needs recorded evidence, not a feeling; and every
  number in the final report is re-measured at report time instead of copied
  from earlier in the session.
- **Initial preset pack** — four DSH agent presets (`planner`, `builder`,
  `surgeon`, `advisor`) with the 30 universal rules and a deterministic
  `discipline-guard` plugin, ported from
  [opencode-agents](https://github.com/rolarocka/opencode-agents).
- **Extended tier** — four more presets (`design`, `scribe`, `tester`,
  `hunter`) bring the total to **eight**.
- **License attribution** — inspiration chain in `THIRD-PARTY-NOTICES.md` and
  the ooples credit in the plugin header comment (the large-read guard is
  adapted from `ooples/token-optimizer-mcp`).
- **Plugin-drift + full shell-row guard** — `shared/check-consistency.mjs`
  additionally verifies that all eight preset-local copies of
  `plugins/discipline-guard.js` stay byte-identical (same majority-reference
  policy as the rules), and hardens the shell-block check from
  "`tool-bash` present/absent" to "both `tool-bash` and `tool-pwsh`". This
  closes two silent holes: a read-only preset could gain a lone `tool-pwsh`
  row (shell access without alarm), and a shell preset could lose `tool-pwsh`
  unnoticed.
- **Preset-consistency drift guard** — `shared/check-consistency.mjs` verifies
  the 30 rules and persona header are byte-identical across all eight presets
  and that the shell-tool block is present/absent as designed. Runs in CI
  (`.github/workflows/consistency.yml`) and before every commit
  (`hooks/pre-commit`, enabled via `git config core.hooksPath hooks`). Uses a
  majority reference so an edit to *any* single preset — including `builder` —
  is caught, and reports file + line on failure.
- **Unit tests for the guard** — `test/discipline-guard.test.mjs`
  (`node:test`, no framework) covering the canonicalizer, the oscillation
  detector, the ring mechanics, and (since 2026-08-22) the read-only guard's
  deny list. `npm test`, `npm run check`, and
  `npm run test:all` scripts added.
- **DSH compatibility note** — README documents that the presets reference
  `@deepseek-ai/dsh-*` by bare id (no runtime version pin) and recommends
  verifying against a chosen DSH release.

### Changed

- **`install.ps1` backup retention** — after installing, only the newest
  `$KeepBackups` (default 5) `_backup` timestamp stamps are kept and older
  ones are pruned, so repeated installs no longer grow `_backup` without
  bound. Override per run with `.\install.ps1 -KeepBackups 3`.
- **`discipline-guard.js` large-read guard hardened** — the guard now decides
  via the new exported, unit-tested helper `isPartialRead`: only a finite,
  positive `limit` of at most `PARTIAL_WINDOW_LINES` (500) lines counts as a
  partial window. Previously any present `offset`/`limit` bypassed the guard,
  so a single oversized `limit` could still read a whole >25 KB file (and an
  offset without a limit read to EOF). The size check is also strictly
  "over 25 KB" now, so a file of exactly 25 KiB passes as documented. Applied
  to all eight preset copies.
- **`discipline-guard.js` hardened** — the pure logic (`canonical`,
  `isOscillating`) is exported for testability; the oscillation breaker no
  longer sleeps silently when `exec.agent` is missing — it falls back to a
  shared ring and logs a warning on first occurrence.
- **`install.ps1` preserves previous presets** — before installing, an existing
  target is moved to `<dest>/_backup/<timestamp>/<preset>` (timestamped, so
  repeated installs keep their own backups) and the backup path is printed.
  Previously the old preset was deleted.
- **`install.ps1` wording** — now "Copy the **eight** preset directories"
  (was "four"); a Linux/macOS note explains the pre-commit hook needs
  `chmod +x hooks/pre-commit` once.
- **Pre-commit hook is now executable** — `hooks/pre-commit` is tracked with
  mode `100755` (Git silently skips a non-executable hook).
- **README "Tested against" reference** — now records the real verified DSH
  release instead of a placeholder.

### Fixed

- **`install.ps1` nested-copy bug** — `Copy-Item -Recurse` into an existing
  target directory would nest the source as a child (`$to/$preset`) instead of
  replacing it; the target is now moved aside first.
- **`install.md`** said "four" preset directories — corrected to "eight".
- **Preset header comments** — reworded to describe the actual persona of each
  preset.
- **Repo language** — made exclusively English.
- **`install.md` overwrite note** — claimed existing presets are "overwritten"; corrected to the actual `install.ps1` behavior (previous version moved to `_backup/<timestamp>/<preset>` before the fresh copy, revertible) and noted that manual copies keep no backup.

### Tested against

`@deepseek-ai/dsh@0.1.1-rc.2` (every `dsh-*` package at `0.1.1-rc.2`, the
current npm latest); npm-wrapped checkout, so no git commit hash is available.
Recorded **2026-08-22**: the eight presets, the hardened `discipline-guard`
plugin and the new `read-only-guard` plugin install cleanly in this release
(consistency guard and unit tests green; live in-session guard spot checks
pending).
