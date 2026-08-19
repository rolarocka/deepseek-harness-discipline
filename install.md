# Install DeepSeek Harness (DSH) - Discipline (AI one-liner)

You are installing the **deepseek-harness-discipline** preset pack into a local
**DeepSeek Harness** (DSH) installation. The repo ships eight DSH agent presets
(planner, builder, surgeon, advisor, design, scribe, tester, hunter — ported
from opencode-agents) plus a deterministic discipline-guard plugin per preset.

## What to do

1. Clone the repo anywhere:

   ```bash
   git clone https://github.com/rolarocka/deepseek-harness-discipline
   cd deepseek-harness-discipline
   ```

2. Determine the DSH home (default `$HOME/.dsh`, or the value of `DSH_HOME`).

3. Copy the eight preset directories into `<dsh-home>/.agent-presets/`:

   - **PowerShell:** run `.\install.ps1` from the repo root (it does this for
     you). Or manually:

     ```powershell
     New-Item -ItemType Directory -Force "$HOME\.dsh\.agent-presets" | Out-Null
     Copy-Item -Recurse presets\planner, presets\builder, presets\surgeon, presets\advisor, presets\design, presets\scribe, presets\tester, presets\hunter "$HOME\.dsh\.agent-presets\"
     ```

   - **bash (macOS/Linux):**

     ```bash
     mkdir -p "$HOME/.dsh/.agent-presets"
     cp -r presets/planner presets/builder presets/surgeon presets/advisor presets/design presets/scribe presets/tester presets/hunter "$HOME/.dsh/.agent-presets/"
     ```

4. Restart dsh (or open a new session). The presets appear in the preset
   picker as:

   - `planner` — Planner (Architect), read-only planning agent
   - `builder` — Builder (TDD Implementation)
   - `surgeon` — Surgeon (Minimal Fixes)
   - `advisor` — Advisor (Reviewer), read-only reviewer
   - `design` — Designer (UI/UX)
   - `scribe` — Scribe (Docs)
   - `tester` — Tester (Coverage)
   - `hunter` — Hunter (Sweep), read-only

5. Verify: start a session on any preset and try a full `read` of a file
   larger than 25 KB without `offset`/`limit` — it is rejected with guidance
   (discipline guard active). The 30 universal rules are embedded in every
   persona.

## Notes

- Existing presets with the same ids in `.agent-presets/` are overwritten.
- The presets reference the plugin file via a relative row
  (`./plugins/discipline-guard.js`), so each preset directory is self-contained
  and can be copied as a whole.
- Requires a DSH deployment that ships the `standard` preset row set
  (`@deepseek-ai/dsh-*` packages, `dsh-persona`, `dsh-tool-fs`, etc.).

Contributors maintaining this repo: the pre-commit drift guard
(`hooks/pre-commit`, activated with `git config core.hooksPath hooks`) is only
executed by Git when it carries the executable bit. On fresh Linux/macOS clones
or if the bit is not preserved, run `chmod +x hooks/pre-commit` once before
trusting it.
