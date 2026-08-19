# Third-Party Notices

This document lists third-party software components used by, inspired by, or
referenced in the `deepseek-harness-discipline` project, mirroring the attribution chain of
its source repository [opencode-agents](https://github.com/rolarocka/opencode-agents).

## Direct derivations

### opencode-agents (rules, personas, guard concept)

- **Source:** https://github.com/rolarocka/opencode-agents
- **License:** MIT, Copyright (c) 2026 rolarocka
- **Used for:**
  - the 30 universal rules embedded in every `presets/*/agent.cordis.yml`
    persona (adapted, trimmed of OpenCode-specific mechanics such as
    `/caveman`, BrowserClaw and rtk);
  - the persona role texts for all 8 presets: plan, build, surgical, advisor,
    design, scribe, tester, hunter (adapted from the `agent` prompts in
    `opencode.json` / `opencode.extended.json`);
  - the large-read redirect concept from `plugins/token-optimizer.js`,
    which is itself adapted from
    https://github.com/ooples/token-optimizer-mcp (MIT, Copyright (c) 2025
    ooples) — see below.

### @ooples/token-optimizer-mcp (large-read redirect concept)

- **Source:** https://github.com/ooples/token-optimizer-mcp
  (`integrations/opencode/.opencode/plugins/token-optimizer.js`)
- **License:** MIT, Copyright (c) 2025 ooples
- **Used for:** the large-read guard in `presets/*/plugins/discipline-guard.js`
  (threshold constant and redirect behavior; the DSH implementation is
  original code against the `tools/pre-execute` / `fs` interfaces).

### DeepSeek Harness (preset structure, plugin APIs)

- **Source:** https://github.com/deepseek-ai/deepseek-harness
- **License:** MIT
- **Used for:** the `agent.cordis.yml` composition structure and comments,
  derived from the shipped `standard` preset; and the `tools/pre-execute`,
  `systemPrompt` and `fs` plugin interfaces the discipline-guard plugin uses.

## Inspiration chain (concepts only, carried via opencode-agents)

The following projects inspired rules that appear (adapted) in the persona
texts of this repository. Concepts only — no code vendored. This chain is
documented in opencode-agents' THIRD-PARTY-NOTICES.md and is reproduced here
for completeness.

### savant0x/savant-code — ECHO Protocol

- **Source:** https://github.com/savant0x/savant-code
- **License:** Apache 2.0
- **Used for:** rule 29 (CALL-GRAPH REACHABILITY — "compilation is NOT
  verification") and rule 30 (CIRCUIT BREAKER — change cap per pass,
  convergence detection) in every persona.

### TencentDB-Agent-Memory

- **Source:** https://github.com/TencentCloud/TencentDB-Agent-Memory
- **License:** MIT
- **Used for:** rule 21 (LAYERED RECALL — capped memory results, name the
  source) in every persona.

### juliusbrussee/caveman

- **Source:** https://github.com/juliusbrussee/caveman
- **License:** MIT
- **Used for:** rule 22 (TERSELY — compressed communication style) in every
  persona.

### mattpocock/skills

- **Source:** https://github.com/mattpocock/skills
- **License:** MIT
- **Used for:** the grill-before-build and persona-role patterns the personas
  follow (via opencode-agents).

## Licenses

All components listed above are licensed under MIT unless otherwise noted
(ECHO Protocol is Apache 2.0, concepts only). Full license texts are available
at their respective source repositories. The MIT license texts are reproduced
in the repo's `LICENSE` file.

---

*Last updated: 2026-08-19*
