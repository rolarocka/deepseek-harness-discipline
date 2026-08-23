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
  let fallbackRing = [];
  const agentKey = (exec) => (exec && typeof exec.agent === 'object' && exec.agent !== null ? exec.agent : null);

  ctx.on('tools/pre-execute', async (exec, next) => {
    const key = agentKey(exec);
    let ring = key !== null ? rings.get(key) : fallbackRing;
    if (key !== null && ring === undefined) {
      ring = [];
      rings.set(key, ring);
    }

    // 1. CIRCUIT BREAKER (Oszillations-Schutz)
    const sig = exec.name + ' ' + canonical(exec.arguments);
    if (recordCall(ring, sig)) {
      unrecordCall(ring, sig);
      return {
        kind: 'deny',
        reason: 'CIRCUIT BREAKER: Loop detected (repeating same call/args). Change variables, strategy, or ask user.',
      };
    }

    // 2. LARGE READ GUARD (Gedeckelte Read-Fenster)
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
        unrecordCall(ring, sig);
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
