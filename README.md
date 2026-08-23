# DeepSeek Harness (DSH) - Discipline

Eight agent presets carrying the battle-tested discipline from
[opencode-agents](https://github.com/rolarocka/opencode-agents) — ported to
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH)
agent presets (`cordis.yml`) — plus a deterministic **Discipline Guard**
plugin in every preset.

See [CHANGELOG](CHANGELOG.md) for a full history of changes.

## What is this?

| opencode-agents (source) | deepseek-harness-discipline (port) |
|---|---|
| Personas (plan, build, surgical, advisor, design, scribe, tester, hunter) | 8 DSH agent presets (`presets/<id>/agent.cordis.yml`) |
| 30 universal rules in the persona prompt | The same 30 plus 2 port additions (GATES LEDGER, REPORT AUDIT) — 32 in every persona |
| `permission: {edit: deny, bash: deny}` (plan/advisor) | Read-only presets: no shell-tool rows + `read-only-guard` denies `write`/`edit`/`bash`/`pwsh` deterministically |
| `plugins/token-optimizer.js` (large-read redirect) | `presets/*/plugins/discipline-guard.js` |
| Rule 30 (CIRCUIT BREAKER, loop detection) | Oscillation guard in the same plugin |

## Presets

| Preset | Role | Shell |
|---|---|---|
| `planner` | "The Architect" — read-only, interviews before building (GRILL BEFORE BUILD), delivers an exact execution plan | ❌ |
| `builder` | TDD at seams, vertical slices, independent advisor review | ✅ |
| `surgeon` | Ultra-precise minimal fixes, diagnosis loops, circuit breaker | ✅ |
| `advisor` | Read-only reviewer — two-axis review (Standards + Spec), security check | ❌ |
| `design` | UI/UX, theming and UI-framework implementation — design-system first, accessibility gate, dark/light parity | ✅ |
| `scribe` | Documentation-only — keeps docs truthful and in sync with the code, drift checks, changelog discipline | ✅ |
| `tester` | Proactively closes test-coverage gaps with TDD — test files only, never production code | ✅ |
| `hunter` | Read-only whole-codebase sweep for bug classes, dead code and quality-gate risks | ❌ |
| `optimized` | User-authored local variant — Android/Gradle coding agent, own persona + condensed guard fork, platform-switched shell tools | ✅ |

The eight discipline presets embed the **32 universal rules** (VERIFY BEFORE
CLAIMING, QUALITY GATE, COMMIT GATE, LAYERED RECALL, TERSELY, CALL-GRAPH
REACHABILITY, CIRCUIT BREAKER, …) plus a role section.

`optimized` ships verbatim as a user-authored local variant: its own
Android/Gradle-focused persona, a condensed guard fork (circuit breaker +
large-read guard only) and platform-switched `tool-bash`/`tool-pwsh` rows.
Both installers deploy it and the consistency script verifies its file
presence, but it is deliberately outside the byte-identity contracts that
bind the eight ported presets.

## Discipline Guard (in every preset)

The plugin `plugins/discipline-guard.js` is mounted by a relative row
(`name: './plugins/discipline-guard.js'`) and travels with the preset. It is
deterministic — no LLM judgment:

- **Large-read guard:** a `read` at whole-file scale (no `limit`, an
  offset-only read, or a limit above 500 lines) of a file larger than 25 KB is
  rejected with partial-window guidance (ported from token-optimizer.js).
  Policy thresholds are **25 KB / 500 lines** — stricter than DSH's own caps
  (2000 lines / ~50 KB), so a windowed read is always bounded.
- **Oscillation circuit breaker:** the pattern A→B→A→B→A is rejected on the
  5th call, and the denied call is not recorded — an identical retry denies
  again (hard stop) instead of shifting the cycle's phase. The breaker resumes
  only after a genuinely different call (rule 30). Complements the host-wide
  `dsh-repeat-tool-reminder` (consecutive identical calls only).
- **Discipline prompt section:** always-on short rules in the system prompt.

## Read-only Guard (planner / advisor / hunter)

DSH's `@deepseek-ai/dsh-tool-fs` registers the full `read`/`write`/`edit`
suite unconditionally — there is no row-level opt-out, so "read-only" cannot
be enforced by omitting rows without also losing `read`. The preset-local
plugin `plugins/read-only-guard.js` (mounted only in the three read-only
presets) restores the enforcement half that opencode-agents carried as
`permission: {edit: deny}`: every `write`/`edit`/`bash`/`pwsh` call is denied
deterministically on `tools/pre-execute`, with an always-on prompt card
stating the policy. Shell tools are already absent from those compositions;
the `bash`/`pwsh` deny is defense-in-depth against a mistakenly added row.
The consistency guard verifies the plugin exists exactly there, is
byte-identical across the three copies, and is mounted in no shell preset.

## Installation

### Windows (PowerShell)

```powershell
git clone https://github.com/rolarocka/deepseek-harness-discipline
cd deepseek-harness-discipline
.\install.ps1
```

### Linux / macOS

```bash
git clone https://github.com/rolarocka/deepseek-harness-discipline
cd deepseek-harness-discipline
./install.sh
# or: DSH_HOME=/custom/dsh KEEP_BACKUPS=3 ./install.sh
```

Then **restart dsh** (or open a new session) and pick "Planner (Architect)",
"Builder (TDD Implementation)", "Surgeon (Minimal Fixes)", "Advisor (Reviewer)",
"Designer (UI/UX)", "Scribe (Docs)", "Tester (Coverage)" or "Hunter (Sweep)"
in the preset picker. The presets only appear after a restart because the
roster is read at startup.

### Install with AI (one-liner)

```bash
curl -fsSL https://raw.githubusercontent.com/rolarocka/deepseek-harness-discipline/main/install.md | claude
```

> **Tested against:** `@deepseek-ai/dsh@0.1.1-rc.2` (every `dsh-*` package at
> `0.1.1-rc.2`, the current npm latest), npm-wrapped checkout — no git commit
> hash is available for a non-git install. Recorded **2026-08-22**: the eight
> presets, the hardened `discipline-guard` plugin and the new
> `read-only-guard` plugin install cleanly in this release (consistency guard
> and unit tests green; live in-session guard spot checks pending). Update
> this line with the version/date whenever the presets are next verified,
> and check the gap here first if a later DSH update breaks something. No
> version is enforced at runtime; this is just a reference point.

## Verification

```powershell
# Presets visible?
Get-ChildItem "$HOME\.dsh\.agent-presets" -Directory

# Guard active? Create a file larger than 25 KB and try a full read:
#   read: <path-to->large-file.txt (without offset/limit) -> Error: ... is 28 KB. Read it in bounded partial windows: ...
#
# Read-only guard active? (planner/advisor/hunter) A write should be rejected:
#   write: notes.txt -> Error: READ-ONLY PRESET: the write tool is disabled ...
```

## Preset consistency

The 32 universal rules, the persona header and the shell-tool block are
duplicated across all eight `presets/<id>/agent.cordis.yml` files by design —
each preset directory is self-contained and the installer copies whole
directories. That deliberate duplication is guarded against silent drift:

```bash
node shared/check-consistency.mjs   # exit 1 (loudly, with file + line) on drift
```

It verifies the 32 rules and the persona header are byte-identical across all
eight presets, that each rules block is structurally intact (exactly rules
1..32, sequentially numbered), that both shell rows (`tool-bash` **and**
`tool-pwsh`) are present in the five shell presets and absent (read-only) in
planner/advisor/hunter, that all eight copies of `plugins/discipline-guard.js`
are byte-identical, and that `plugins/read-only-guard.js` exists in exactly
the three read-only presets (byte-identical there) with its mount row present
there and absent in the shell presets. It runs in CI
(`.github/workflows/consistency.yml`) and, once installed, before every commit:

```bash
git config core.hooksPath hooks     # activates hooks/pre-commit
```

## Compatibility with DSH

DSH itself is in active development and its API can change without notice. The
presets reference the `@deepseek-ai/dsh-*` rows by **bare id** (no version pin),
so this repo does not promise a specific DSH release. Before relying on a
preset, install against a DSH build you control and verify (see Installation).
If you need a reproducible deployment, note the exact DSH version you tested
against: the `discipline-guard` plugin hooks `tools/pre-execute` and keys its
oscillation rings on `exec.agent`, and the `read-only-guard` plugin hooks
`tools/pre-execute` keyed on tool names (`write`/`edit`/`bash`/`pwsh`) — surfaces DSH could reshape.

## License & credits

MIT — see [LICENSE](LICENSE) and [THIRD-PARTY-NOTICES](THIRD-PARTY-NOTICES.md).
The 30 rules, the persona roles and the large-read guard concept come from
[opencode-agents](https://github.com/rolarocka/opencode-agents) (MIT); the
preset structure follows the shipped DSH presets
([deepseek-harness](https://github.com/deepseek-ai/deepseek-harness), MIT).
