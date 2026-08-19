# Install dsh-discipline (AI one-liner)

You are installing the **dsh-discipline** preset pack into a local
**DeepSeek Harness** (DSH) installation. The repo ships four DSH agent presets
(planner, builder, surgeon, advisor — ported from opencode-agents) plus a
deterministic discipline-guard plugin per preset.

## What to do

1. Clone the repo anywhere:

   ```bash
   git clone https://github.com/rolarocka/dsh-discipline
   cd dsh-discipline
   ```

2. Determine the DSH home (default `$HOME/.dsh`, or the value of `DSH_HOME`).

3. Copy the four preset directories into `<dsh-home>/.agent-presets/`:

   - **PowerShell:** run `.\install.ps1` from the repo root (it does this for
     you). Or manually:

     ```powershell
     New-Item -ItemType Directory -Force "$HOME\.dsh\.agent-presets" | Out-Null
     Copy-Item -Recurse presets\planner, presets\builder, presets\surgeon, presets\advisor "$HOME\.dsh\.agent-presets\"
     ```

   - **bash (macOS/Linux):**

     ```bash
     mkdir -p "$HOME/.dsh/.agent-presets"
     cp -r presets/planner presets/builder presets/surgeon presets/advisor "$HOME/.dsh/.agent-presets/"
     ```

4. Restart dsh (or open a new session). The presets appear in the preset
   picker as:

   - `planner` — Planer (Architekt), read-only planning agent
   - `builder` — Builder (TDD-Implementierung)
   - `surgeon` — Surgeon (Minimal-Fixes)
   - `advisor` — Advisor (Reviewer), read-only reviewer

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
