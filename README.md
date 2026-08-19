# dsh-discipline — Agent presets for DeepSeek Harness (DSH)

Eight agent presets carrying the battle-tested discipline from
[opencode-agents](https://github.com/rolarocka/opencode-agents) — ported to
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH)
agent presets (`cordis.yml`) — plus a deterministic **Discipline Guard**
plugin in every preset.

## What is this?

| opencode-agents (source) | dsh-discipline (port) |
|---|---|
| Personas (plan, build, surgical, advisor, design, scribe, tester, hunter) | 8 DSH agent presets (`presets/<id>/agent.cordis.yml`) |
| 30 universal rules in the persona prompt | The same 30 rules in every persona |
| `permission: {edit: deny, bash: deny}` (plan/advisor) | Read-only presets without shell-tool rows |
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

Every preset embeds the **30 universal rules** (VERIFY BEFORE CLAIMING,
QUALITY GATE, COMMIT GATE, LAYERED RECALL, TERSELY, CALL-GRAPH REACHABILITY,
CIRCUIT BREAKER, …) plus a role section.

## Discipline Guard (in every preset)

The plugin `plugins/discipline-guard.js` is mounted by a relative row
(`name: './plugins/discipline-guard.js'`) and travels with the preset. It is
deterministic — no LLM judgment:

- **Large-read guard:** a `read` without `offset`/`limit` on files larger than
  25 KB is rejected with partial-window guidance (ported from
  token-optimizer.js).
- **Oscillation circuit breaker:** the pattern A→B→A→B→A is rejected on the
  5th call (rule 30). Complements the host-wide `dsh-repeat-tool-reminder`
  (consecutive identical calls only).
- **Discipline prompt section:** always-on short rules in the system prompt.

## Installation

### Windows (PowerShell)

```powershell
git clone https://github.com/rolarocka/dsh-discipline
cd dsh-discipline
.\install.ps1
```

### Linux / macOS

```bash
git clone https://github.com/rolarocka/dsh-discipline
cd dsh-discipline
mkdir -p "$HOME/.dsh/.agent-presets"
cp -r presets/planner presets/builder presets/surgeon presets/advisor presets/design presets/scribe presets/tester presets/hunter "$HOME/.dsh/.agent-presets/"
```

Then **restart dsh** (or open a new session) and pick "Planner (Architect)",
"Builder (TDD Implementation)", "Surgeon (Minimal Fixes)", "Advisor (Reviewer)",
"Designer (UI/UX)", "Scribe (Docs)", "Tester (Coverage)" or "Hunter (Sweep)"
in the preset picker. The presets only appear after a restart because the
roster is read at startup.

### Install with AI (one-liner)

```bash
curl -fsSL https://raw.githubusercontent.com/rolarocka/dsh-discipline/main/install.md | claude
```

## Verification

```powershell
# Presets visible?
Get-ChildItem "$HOME\.dsh\.agent-presets" -Directory

# Guard active? A full read of a file larger than 25 KB should be rejected:
#   read: CHANGELOG.md (without offset/limit) -> Error: ... is 120 KB. Use offset/limit ...
```

## License & credits

MIT — see [LICENSE](LICENSE) and [THIRD-PARTY-NOTICES](THIRD-PARTY-NOTICES.md).
The 30 rules, the persona roles and the large-read guard concept come from
[opencode-agents](https://github.com/rolarocka/opencode-agents) (MIT); the
preset structure follows the shipped DSH presets
([deepseek-harness](https://github.com/deepseek-ai/deepseek-harness), MIT).
