// discipline-guard.js — condensed guard fork for the 'optimized' preset.
// Lineage: deepseek-harness-discipline presets/*/plugins/discipline-guard.js
// (itself ported from opencode-agents / token-optimizer-mcp, MIT — see
// THIRD-PARTY-NOTICES.md). Differences from the 8-preset copies, by design:
//   - no DENIED_TOOLS layer (this preset is write-enabled);
//   - pure repetition (A,A,A,A,A) IS an oscillation;
//   - calls without resolvable exec.agent are skipped, not pooled.

export const OSC_WINDOW = 5;
export const LARGE_READ_BYTES = 25600; // 25 KB
export const PARTIAL_WINDOW_LINES = 500;

export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((k) => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  }
  return JSON.stringify(value) ?? String(value);
}

export function isOscillating(ring) {
  if (!Array.isArray(ring) || ring.length !== OSC_WINDOW) return false;
  const [s1, s2, s3, s4, s5] = ring;

  // Straight repetition (A,A,A,A,A) is the simplest stuck-loop pattern of
  // all and must be caught on its own: the alternation check below requires
  // s1 !== s2, so a pure repeat never trips it and can run forever.
  const allSame = s1 === s2 && s2 === s3 && s3 === s4 && s4 === s5;
  if (allSame) return true;

  // Strict 2-cycle alternation (A,B,A,B,A).
  return s1 === s3 && s3 === s5 && s2 === s4 && s1 !== s2;
}

export function recordCall(ring, sig) {
  ring.push(sig);
  if (ring.length > OSC_WINDOW) ring.shift();
  return isOscillating(ring);
}

export function unrecordCall(ring, sig) {
  const idx = ring.lastIndexOf(sig);
  if (idx !== -1) ring.splice(idx, 1);
}

export function isPartialRead(args) {
  if (args === null || typeof args !== 'object') return false;
  const lim = args.limit;
  return typeof lim === 'number' && Number.isFinite(lim) && lim > 0 && lim <= PARTIAL_WINDOW_LINES;
}

const name = 'discipline-guard';

function apply(ctx) {
  const fsService = ctx.get('fs');
  if (fsService === undefined) return;

  const rings = new WeakMap();
  const agentKey = (exec) => (exec && typeof exec.agent === 'object' && exec.agent !== null ? exec.agent : null);
  let warnedNoAgent = false;

  ctx.on('tools/pre-execute', async (exec, next) => {
    const key = agentKey(exec);

    // Calls without a resolvable agent identity are NOT oscillation-tracked:
    // a process-wide fallback ring would pool unrelated sessions' calls,
    // masking real loops or tripping false denials on someone else's work.
    // Skipping is the safer failure mode — but say so ONCE, so a silent
    // loss of protection cannot go unnoticed.
    let ring = null;
    if (key !== null) {
      ring = rings.get(key);
      if (ring === undefined) {
        ring = [];
        rings.set(key, ring);
      }
    } else if (!warnedNoAgent) {
      warnedNoAgent = true;
      console.warn('[discipline-guard] exec.agent missing — circuit breaker inactive for such calls');
    }

    const sig = exec.name + ' ' + canonical(exec.arguments);

    // 1. CIRCUIT BREAKER (Oszillations-Schutz)
    if (ring !== null && recordCall(ring, sig)) {
      unrecordCall(ring, sig);
      return {
        kind: 'deny',
        reason: 'CIRCUIT BREAKER: Loop detected (repeating same call/args). Change variables, strategy, or ask user.',
      };
    }

    // 2. LARGE READ GUARD (Gedeckelte Read-Fenster)
    // Contract verified against dsh-tool-fs 0.1.0-rc.7: the read tool is
    // named 'read', takes string `file_path` and an optional numeric
    // `limit` in lines (no limit -> host cap of 2000 lines / ~50 KB).
    if (exec.name !== 'read') return next();
    const args = exec.arguments;
    if (args === null || typeof args !== 'object' || isPartialRead(args)) return next();

    const raw = args.file_path;
    if (typeof raw !== 'string' || raw.length === 0) return next();

    try {
      const target = await fsService.resolve(raw, { signal: exec.signal });
      const info = await fsService.stat(target, exec.signal);

      if (info && typeof info.size === 'number' && info.size > LARGE_READ_BYTES) {
        const kb = Math.round(info.size / 1024);
        if (ring !== null) unrecordCall(ring, sig);
        return {
          kind: 'deny',
          reason: `DENIED: ${raw} is ${kb} KB (>25 KB). Use bounded reads (limit <= ${PARTIAL_WINDOW_LINES} lines, offset N).`,
        };
      }
    } catch {
      return next();
    }

    return next();
  });
}

export { name, apply };
export default { name, apply };
