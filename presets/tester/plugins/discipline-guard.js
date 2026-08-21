// discipline-guard.js — deterministic session discipline for DSH agent presets.
//
// Ported from opencode-agents (github.com/rolarocka/opencode-agents):
//   - plugins/token-optimizer.js  → the large-read redirect
//   - universal rule 30           → the oscillation circuit breaker
//
// opencode-agents' plugins/token-optimizer.js is itself adapted from
// github.com/ooples/token-optimizer-mcp (integrations/opencode), MIT License,
// Copyright (c) 2025 ooples. See THIRD-PARTY-NOTICES.md in the repo root.
// No LLM judgment: the guards either deny a call with a reason or delegate
// via next(). Mounted by a preset row:
//
//   - id: discipline-guard
//     name: './plugins/discipline-guard.js'
//
// The relative specifier resolves against the preset directory, so the file
// travels with the preset (see dsh-agent-presets PresetTree.import()).
//
// The pure helpers (`canonical`, `isOscillating`, `isPartialRead`) are
// exported and unit-tested in test/discipline-guard.test.mjs; `apply` keeps the DSH-facing wiring. The
// oscillation breaker keys rings per-agent via a WeakMap; if `exec.agent` is
// ever missing (a DSH contract we do not pin to), it falls back to a shared
// ring and logs a warning FIRST time instead of silently sleeping.

export const OSC_WINDOW = 5; // A,B,A,B denies the 5th call
const LARGE_READ_BYTES = 25600; // mirrors plugins/token-optimizer.js
// A "partial window" is a bounded slice: a numeric limit no larger than this
// many lines. offset alone (limit missing) reads to EOF, and a limit above
// the cap is a full read in disguise — both are treated as full reads by the
// large-read guard.
export const PARTIAL_WINDOW_LINES = 500;

// Deep key-sort canonicalization so identical calls with reordered argument
// keys still match (same heuristic as repeat-tool-reminder). Pure.
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (value !== null && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((k) => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}'
  }
  return JSON.stringify(value)
}

// Deterministic oscillation test on a signature ring whose length is exactly
// OSC_WINDOW: the ring spells A,B,A,B,A. Pure — no state here.
export function isOscillating(ring) {
  if (!Array.isArray(ring) || ring.length !== OSC_WINDOW) return false
  const [s1, s2, s3, s4, s5] = ring
  return s1 === s3 && s3 === s5 && s2 === s4 && s1 !== s2
}

// True when the read arguments describe a bounded partial window: a finite,
// positive numeric limit within PARTIAL_WINDOW_LINES. Anything else (no
// limit, offset-only, oversized limit, non-numeric limit) is treated as a
// full read by the large-read guard. Pure.
export function isPartialRead(args) {
  if (args === null || typeof args !== 'object') return false
  const lim = args.limit
  return typeof lim === 'number' && Number.isFinite(lim) && lim > 0 && lim <= PARTIAL_WINDOW_LINES
}

const name = 'discipline-guard';

function apply(ctx) {
  const fsService = ctx.get('fs')
  const prompt = ctx.get('systemPrompt')

  // Always-on discipline card injected into every assembled prompt.
  if (prompt !== undefined) {
    prompt.section({
      name: 'discipline-guard',
      order: 50,
      text: [
        '## Discipline Guard (always-on)',
        '- VERIFY BEFORE CLAIMING: check actual files; never trust memory/changelog. Never output secrets/credentials.',
        '- VERIFY SIDE EFFECTS: after file/command changes, run a separate check before claiming success; report actual failures.',
        '- QUALITY GATE: after changes, run the project test/lint/build; discover the exact command, do not guess.',
        '- COMMIT GATE: never commit/push/tag without an explicit user ask.',
        '- LARGE READS: files over 25 KB are read with the read tool as offset/limit partial windows (up to 500 lines each), never as one full read.',
        '- LAYERED RECALL: memory/docs results capped at ~3-5, <=1.5 KB, name the source.',
        '- TERSELY: short answers (<4 lines unless detail is requested); no preamble/postamble.',
        '- CIRCUIT BREAKER: if a guard denied a call, change ONE variable or stop and ask; never retry the identical call.',
        '- GATES LEDGER: before non-trivial work, write acceptance gates as "- [ ] G: ... CHECK: <command> EXPECT: <result>"; a checked box needs recorded evidence.',
        '- REPORT AUDIT: re-measure every number in the final report at report time; never copy numbers from earlier in the session.',
      ].join('\n'),
    })
  }

  if (fsService === undefined) return

  // Per-agent ring of recent canonical call signatures.
  const rings = new WeakMap()
  // Fallback shared ring + first-time warning for the (unexpected) case where
  // a pre-execute event carries no usable `exec.agent`.
  let fallbackRing = []
  let warnedMissingAgent = false
  const agentKey = (exec) => (exec && typeof exec.agent === 'object' && exec.agent !== null ? exec.agent : null)

  ctx.on('tools/pre-execute', async (exec, next) => {
    // 1) Oscillation circuit breaker: the last OSC_WINDOW signatures form
    //    A,B,A,B,A.
    const key = agentKey(exec)
    let ring
    if (key !== null) {
      ring = rings.get(key)
      if (ring === undefined) {
        ring = []
        rings.set(key, ring)
      }
    } else {
      ring = fallbackRing
      if (!warnedMissingAgent) {
        console.warn('discipline-guard: exec.agent missing on tools/pre-execute — oscillation guard fell back to a shared ring (weaker, cross-agent).')
        warnedMissingAgent = true
      }
    }
    const sig = exec.name + ' ' + canonical(exec.arguments)
    ring.push(sig)
    if (ring.length > OSC_WINDOW) ring.shift()
    if (isOscillating(ring)) {
      return {
        kind: 'deny',
        reason: 'CIRCUIT BREAKER: oscillating between "' + exec.name + '" and the previous call (' + OSC_WINDOW + '-call cycle). Change ONE variable or stop and ask the user; do not repeat the cycle.',
      }
    }

    // 2) Large-read guard: a full `read` of a file above the threshold is
    //    denied with partial-window guidance. A window counts as partial
    //    only when it is bounded (see isPartialRead): no limit, an offset
    //    without a limit, or an oversized limit all reach whole-file scale.
    if (exec.name !== 'read') return next()
    const args = exec.arguments
    if (args === null || typeof args !== 'object') return next()
    if (isPartialRead(args)) return next()
    const raw = args.file_path
    if (typeof raw !== 'string' || raw.length === 0) return next()
    let target
    try {
      target = await fsService.resolve(raw, { signal: exec.signal })
    } catch {
      return next()
    }
    let info
    try {
      info = await fsService.stat(target, exec.signal)
    } catch {
      return next()
    }
    // strictly "over 25 KB": a file of exactly LARGE_READ_BYTES passes.
    if (info === undefined || typeof info.size !== 'number' || info.size <= LARGE_READ_BYTES) return next()
    const kb = Math.round(info.size / 1024)
    return {
      kind: 'deny',
      reason: raw + ' is ' + kb + ' KB. Use the read tool with offset/limit partial windows (line-numbered, up to ' + PARTIAL_WINDOW_LINES + ' lines each) instead of one full read.',
    }
  })
}

export { name, apply }
export default { name, apply }
