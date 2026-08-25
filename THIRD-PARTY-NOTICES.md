# Third-Party Notices

This document lists third-party software components used by, inspired by, or
referenced in the `deepseek-harness-discipline` project, mirroring the attribution chain of
its source repository [opencode-agents](https://github.com/rolarocka/opencode-agents).

## Direct derivations

### opencode-agents (rules, personas, guard concept)

- **Source:** https://github.com/rolarocka/opencode-agents
- **License:** MIT, Copyright (c) 2026 rolarocka
- **Used for:**
  - the first 32 of the 34 universal rules embedded in the eight discipline
    `presets/*/agent.cordis.yml` personas (adapted, trimmed of
    OpenCode-specific mechanics such as `/caveman`, BrowserClaw and rtk);
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
- **License:** MIT (core), BSD-3-Clause for `@deepseek-ai/dsh-tool-bash`
- **Used for:** the `agent.cordis.yml` composition structure and comments,
  derived from the shipped `standard` preset; and the `tools/pre-execute`,
  `systemPrompt` and `fs` plugin interfaces the discipline-guard and
  read-only-guard plugins use. Runtime verification against
  `@deepseek-ai/dsh-tool-fs@0.1.1-rc.2` and `@deepseek-ai/dsh-tool-bash@0.1.1-rc.2`
  confirmed the tool catalog (`read`/`write`/`edit` and `bash`/`pwsh` via
  `defineTool({toolName:"bash"})`).

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
  convergence detection) in every discipline persona.

### TencentDB-Agent-Memory

- **Source:** https://github.com/TencentCloud/TencentDB-Agent-Memory
- **License:** MIT
- **Used for:** rule 21 (LAYERED RECALL — capped memory results, name the
  source) in every discipline persona.

### juliusbrussee/caveman

- **Source:** https://github.com/juliusbrussee/caveman
- **License:** MIT (with an upstream scope carve-out: engine-linked
  directories are licensed under BUSL-1.1 per that repo's LICENSE; rule 22
  derives from MIT-covered content)
- **Used for:** rule 22 (TERSELY — compressed communication style) in every
  discipline persona.

### mattpocock/skills

- **Source:** https://github.com/mattpocock/skills
- **License:** MIT
- **Used for:** the grill-before-build and persona-role patterns the personas
  follow (via opencode-agents).

### Leonxlnx/unlazy — GATES LEDGER + REPORT AUDIT

- **Source:** https://github.com/Leonxlnx/unlazy
- **License:** MIT
- **Used for:** rules 31 (GATES LEDGER — acceptance gates written as
  `- [ ] G: ... CHECK: <command> EXPECT: <result>` with recorded evidence, not
  a feeling) and 32 (REPORT AUDIT — re-measure every number in the final
  report at report time) in every discipline persona.

### multica-ai/andrej-karpathy-skills — SURFACE ASSUMPTIONS + SURGICAL DIFF

- **Source:** https://github.com/multica-ai/andrej-karpathy-skills
- **License:** MIT (behavioral guidelines distilled from Andrej Karpathy's
  observations on LLM coding pitfalls)
- **Used for:** rules 33 (SURFACE ASSUMPTIONS — state assumptions explicitly,
  present competing interpretations instead of picking silently, push back
  when a simpler approach exists) and 34 (SURGICAL DIFF — every changed line
  traces to the request; no orthogonal improvements, no refactors of working
  code, orphan cleanup limited to your own change) in every discipline
  persona.

## Licenses

All components listed above are licensed under MIT unless otherwise noted
(ECHO Protocol is Apache 2.0, concepts only). Full license texts are available
at their respective source repositories. The MIT license texts are reproduced
in the repo's `LICENSE` file.

---

*Last updated: 2026-08-23*
