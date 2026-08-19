# Changelog

All notable changes to **deepseek-harness-discipline**. This project follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions are added
once the repo starts tagging releases, until then changes accumulate in the
dated section below.

The eight presets are intentional per-directory copies (self-contained install;
the `discipline-guard.js` plugin "travels with the preset"), so an entry often
touches all `presets/<id>` trees at once.

## [Unreleased] — 2026-08-20

### Added

- **Initial preset pack** — four DSH agent presets (`planner`, `builder`,
  `surgeon`, `advisor`) with the 30 universal rules and a deterministic
  `discipline-guard` plugin, ported from
  [opencode-agents](https://github.com/rolarocka/opencode-agents).
- **Extended tier** — four more presets (`design`, `scribe`, `tester`,
  `hunter`) bring the total to **eight**.
- **License attribution** — inspiration chain in `THIRD-PARTY-NOTICES.md` and
  the ooples credit in the plugin header comment (the large-read guard is
  adapted from `ooples/token-optimizer-mcp`).
- **Preset-consistency drift guard** — `shared/check-consistency.mjs` verifies
  the 30 rules and persona header are byte-identical across all eight presets
  and that the shell-tool block is present/absent as designed. Runs in CI
  (`.github/workflows/consistency.yml`) and before every commit
  (`hooks/pre-commit`, enabled via `git config core.hooksPath hooks`). Uses a
  majority reference so an edit to *any* single preset — including `builder` —
  is caught, and reports file + line on failure.
- **Unit tests for the guard** — `test/discipline-guard.test.mjs` (10 cases,
  `node:test`, no framework) covering the canonicalizer, the oscillation
  detector, and the ring mechanics. `npm test`, `npm run check`, and
  `npm run test:all` scripts added.
- **DSH compatibility note** — README documents that the presets reference
  `@deepseek-ai/dsh-*` by bare id (no runtime version pin) and recommends
  verifying against a chosen DSH release.

### Changed

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

### Tested against

`@deepseek-ai/dsh@0.1.0-rc.7` (all `dsh-*` packages at `0.1.0-rc.7`); npm-wrapped
checkout, so no git commit hash is available. Recorded **2026-08-20**: the eight
presets and the hardened `discipline-guard` plugin mount successfully in this
release.
