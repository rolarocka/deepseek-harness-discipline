# dsh-discipline — Agent-Presets für DeepSeek Harness (DSH)

Vier Agent-Presets mit der bewährten Disziplin aus
[opencode-agents](https://github.com/rolarocka/opencode-agents) — portiert auf
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH)
Agent-Presets (`cordis.yml`), plus ein deterministisches **Discipline-Guard**
Plugin in jedem Preset.

**English:** DSH agent presets carrying the 30-rule discipline and
plan/build/surgical/advisor personas from opencode-agents, plus a
deterministic large-read + oscillation guard plugin per preset.

## Was ist das?

| opencode-agents (Quelle) | dsh-discipline (Port) |
|---|---|
| Personas (plan, build, surgical, advisor) | 4 DSH-Agent-Presets (`presets/<id>/agent.cordis.yml`) |
| 30 Universal Rules im Persona-Prompt | Dieselben 30 Regeln in jeder Persona |
| `permission: {edit: deny, bash: deny}` (plan/advisor) | Read-only-Presets ohne Shell-Tools-Rows |
| `plugins/token-optimizer.js` (Large-Read-Redirect) | `presets/*/plugins/discipline-guard.js` |
| Regel 30 (CIRCUIT BREAKER, Loop-Erkennung) | Oszillations-Guard im selben Plugin |

## Presets

| Preset | Rolle | Shell |
|---|---|---|
| `planner` | „The Architect" — read-only, interviewt vor dem Bauen (GRILL BEFORE BUILD), liefert exakten Ausführungsplan | ❌ |
| `builder` | TDD an Seams, vertikale Slices, unabhängiges Advisor-Review | ✅ |
| `surgeon` | Ultra-präzise Minimal-Fixes, Diagnose-Loops, Circuit Breaker | ✅ |
| `advisor` | Read-only Reviewer — Zwei-Achsen-Review (Standards + Spec), Sicherheits-Check | ❌ |

Jedes Preset enthält die **30 Universal Rules** (VERIFY BEFORE CLAIMING,
QUALITY GATE, COMMIT GATE, LAYERED RECALL, TERSELY, CALL-GRAPH REACHABILITY,
CIRCUIT BREAKER, …) + eine Rollen-Sektion.

## Discipline Guard (in jedem Preset)

Das Plugin `plugins/discipline-guard.js` wird per relative Row
(`name: './plugins/discipline-guard.js'`) vom Preset gemountet und reist mit
dem Preset. Es ist deterministisch — kein LLM-Urteil:

- **Large-Read-Guard:** `read` ohne `offset`/`limit` auf Dateien > 25 KB wird
  mit Partial-Window-Guidance abgelehnt (Port von token-optimizer.js).
- **Oszillations-Circuit-Breaker:** Muster A→B→A→B→A → der 5. Aufruf wird
  abgelehnt (Regel 30). Ergänzt das host-weite `dsh-repeat-tool-reminder`
  (nur identische Wiederholungen).
- **Discipline-Prompt-Sektion:** immer-aktive Kurzregeln im System-Prompt.

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
cp -r presets/planner presets/builder presets/surgeon presets/advisor "$HOME/.dsh/.agent-presets/"
```

Danach **dsh neu starten** (bzw. neue Session öffnen) und im Preset-Picker
„Planer (Architekt)", „Builder (TDD-Implementierung)", „Surgeon (Minimal-Fixes)"
oder „Advisor (Reviewer)" wählen. Die Presets erscheinen erst nach dem Neustart,
weil das Roster beim Start gelesen wird.

### Install with AI (one-liner)

```bash
curl -fsSL https://raw.githubusercontent.com/rolarocka/dsh-discipline/main/install.md | claude
```

## Verifikation

```powershell
# Presets sichtbar?
Get-ChildItem "$HOME\.dsh\.agent-presets" -Directory

# Guard aktiv? Ein Voll-Read einer Datei > 25 KB sollte abgelehnt werden:
#   read: CHANGELOG.md (ohne offset/limit) -> Error: ... is 120 KB. Use offset/limit ...
```

## Lizenz & Danksagung

MIT — siehe [LICENSE](LICENSE) und [THIRD-PARTY-NOTICES](THIRD-PARTY-NOTICES.md).
Die 30 Regeln, Persona-Rollen und das Large-Read-Guard-Konzept stammen aus
[opencode-agents](https://github.com/rolarocka/opencode-agents) (MIT); die
Preset-Struktur folgt den mitgelieferten DSH-Presets
([deepseek-harness](https://github.com/deepseek-ai/deepseek-harness), MIT).
