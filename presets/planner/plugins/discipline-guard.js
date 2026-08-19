// discipline-guard.js — deterministic session discipline for DSH agent presets.
//
// Ported from opencode-agents (github.com/rolarocka/opencode-agents):
//   - plugins/token-optimizer.js  → the large-read redirect
//   - universal rule 30           → the oscillation circuit breaker
// No LLM judgment: the guards either deny a call with a reason or delegate
// via next(). Mounted by a preset row:
//
//   - id: discipline-guard
//     name: './plugins/discipline-guard.js'
//
// The relative specifier resolves against the preset directory, so the file
// travels with the preset (see dsh-agent-presets PresetTree.import()).

const LARGE_READ_BYTES = 25600; // mirrors plugins/token-optimizer.js
const OSC_WINDOW = 5;           // A,B,A,B denies the 5th call

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
        '- LARGE READS: files over 25 KB are read with the read tool offset/limit partial windows, never as one full read.',
        '- LAYERED RECALL: memory/docs results capped at ~3-5, <=1.5 KB, name the source.',
        '- TERSELY: short answers (<4 lines unless detail is requested); no preamble/postamble.',
        '- CIRCUIT BREAKER: if a guard denied a call, change ONE variable or stop and ask; never retry the identical call.',
      ].join('\n'),
    })
  }

  if (fsService === undefined) return

  // Deep key-sort canonicalization so identical calls with reordered
  // argument keys still match (same heuristic as repeat-tool-reminder).
  const canonical = (value) => {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
    if (value !== null && typeof value === 'object') {
      return '{' + Object.keys(value).sort().map((k) => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}'
    }
    return JSON.stringify(value)
  }

  // Per-agent ring of recent canonical call signatures.
  const rings = new WeakMap()

  ctx.on('tools/pre-execute', async (exec, next) => {
    // 1) Oscillation circuit breaker: the last 5 signatures form A,B,A,B,A.
    if (exec.agent !== undefined) {
      let ring = rings.get(exec.agent)
      if (ring === undefined) {
        ring = []
        rings.set(exec.agent, ring)
      }
      const sig = exec.name + ' ' + canonical(exec.arguments)
      ring.push(sig)
      if (ring.length > OSC_WINDOW) ring.shift()
      if (ring.length === OSC_WINDOW) {
        const [s1, s2, s3, s4, s5] = ring
        if (s1 === s3 && s3 === s5 && s2 === s4 && s1 !== s2) {
          return {
            kind: 'deny',
            reason: 'CIRCUIT BREAKER: oscillating between "' + exec.name + '" and the previous call (' + OSC_WINDOW + '-call cycle). Change ONE variable or stop and ask the user; do not repeat the cycle.',
          }
        }
      }
    }

    // 2) Large-read guard: a full `read` (no offset/limit) of a file above
    //    the threshold is denied with partial-window guidance.
    if (exec.name !== 'read') return next()
    const args = exec.arguments
    if (args === null || typeof args !== 'object') return next()
    if (args.offset !== undefined || args.limit !== undefined) return next()
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
    if (info === undefined || typeof info.size !== 'number' || info.size < LARGE_READ_BYTES) return next()
    const kb = Math.round(info.size / 1024)
    return {
      kind: 'deny',
      reason: raw + ' is ' + kb + ' KB. Use the read tool with offset/limit partial windows (line-numbered) instead of one full read.',
    }
  })
}

export { name, apply }
export default { name, apply }
