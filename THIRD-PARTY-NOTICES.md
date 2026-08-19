# Third-Party Notices

## opencode-agents (source of rules, personas, guard concept)

- **Source:** https://github.com/rolarocka/opencode-agents
- **License:** MIT
- **Used for:** the 30 universal rules, the plan/build/surgical/advisor persona
  roles (adapted), and the large-read redirect concept from
  `plugins/token-optimizer.js` (itself vendored from
  https://github.com/ooples/token-optimizer-mcp, MIT, Copyright (c) 2025 ooples).

The persona texts in `presets/*/agent.cordis.yml` are adapted from the persona
prompts in opencode-agents' `opencode.json` (rules 1-30 and role sections),
trimmed of OpenCode-specific mechanics (e.g. `/caveman`, BrowserClaw, rtk).

## DeepSeek Harness (preset structure, plugin APIs)

- **Source:** https://github.com/deepseek-ai/deepseek-harness
- **License:** MIT
- **Used for:** the `agent.cordis.yml` composition structure (derived from the
  shipped `standard` preset) and the `tools/pre-execute` / `systemPrompt`
  plugin interfaces the discipline-guard plugin uses.
