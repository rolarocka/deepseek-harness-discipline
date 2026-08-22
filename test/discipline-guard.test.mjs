import test from 'node:test'
import assert from 'node:assert/strict'
import { canonical, isOscillating, recordCall, unrecordCall, OSC_WINDOW, PARTIAL_WINDOW_LINES, isPartialRead, name as guardName, apply as guardApply } from '../presets/builder/plugins/discipline-guard.js'
import { DENIED_TOOLS, isDeniedTool, name as roName, apply as roApply } from '../presets/planner/plugins/read-only-guard.js'

test('canonical: primitives are JSON-represented', () => {
  assert.equal(canonical('read file.txt'), '"read file.txt"')
  assert.equal(canonical(42), '42')
  assert.equal(canonical(true), 'true')
})

test('canonical: null is distinguishable from undefined-less object gap', () => {
  assert.equal(canonical(null), 'null')
})

test('canonical: object keys are sorted, so key order does not matter', () => {
  const a = canonical({ b: 1, a: 2 })
  const b = canonical({ a: 2, b: 1 })
  assert.equal(a, b)
  assert.ok(a.indexOf('"a":2') < a.indexOf('"b":1'))
})

test('canonical: nested objects recurse deterministically (array order is kept)', () => {
  const a = canonical({ x: [3, { y: 1, z: 2 }], w: 'q' })
  const b = canonical({ w: 'q', x: [3, { z: 2, y: 1 }] }) // same array order, keys reordered
  assert.equal(a, b)
})

test('isOscillating: A,B,A,B,A is denied', () => {
  const ring = ['A', 'B', 'A', 'B', 'A']
  assert.equal(isOscillating(ring), true)
})

test('isOscillating: not oscillating when fewer than OSC_WINDOW sigs', () => {
  assert.equal(isOscillating(['A', 'B', 'A', 'B']), false)
  assert.equal(isOscillating([]), false)
})

test('isOscillating: repeated same call (A,A,A,A,A) is NOT oscillation', () => {
  const ring = ['A', 'A', 'A', 'A', 'A']
  assert.equal(isOscillating(ring), false)
})

test('isOscillating: half-pattern (A,B,B,B,A) is NOT oscillation', () => {
  const ring = ['A', 'B', 'B', 'B', 'A']
  assert.equal(isOscillating(ring), false)
})

test('isOscillating: rejects non-array or wrong-length input', () => {
  assert.equal(isOscillating(null), false)
  assert.equal(isOscillating('AAAAA'), false)
  assert.equal(isOscillating(new Array(OSC_WINDOW + 1).fill('A')), false)
})

// isPartialRead: the large-read guard treats a read as partial only when it
// is a bounded window — a finite, positive numeric limit within the cap.
test('isPartialRead: bounded numeric limit within cap is partial', () => {
  assert.equal(isPartialRead({ limit: 200 }), true)
  assert.equal(isPartialRead({ offset: 10, limit: 200 }), true)
  assert.equal(isPartialRead({ offset: 9000, limit: PARTIAL_WINDOW_LINES }), true) // cap boundary counts as partial
})

test('isPartialRead: missing or oversized limit is a full read', () => {
  assert.equal(isPartialRead({}), false) // plain full read
  assert.equal(isPartialRead({ offset: 5 }), false) // offset alone still covers whole-file scale (host caps apply)
  assert.equal(isPartialRead({ limit: PARTIAL_WINDOW_LINES + 1 }), false) // oversized window
  assert.equal(isPartialRead({ limit: 0 }), false)
  assert.equal(isPartialRead({ limit: '200' }), false) // non-numeric limit
  assert.equal(isPartialRead(null), false)
  assert.equal(isPartialRead(undefined), false)
})

test('unrecordCall: removes one equal entry, tolerates a missing entry', () => {
  const ring = ['A', 'B', 'A']
  unrecordCall(ring, 'A') // removes the LAST equal entry
  assert.deepEqual(ring, ['A', 'B'])
  unrecordCall(ring, 'Z') // no-op
  assert.deepEqual(ring, ['A', 'B'])
})

// Integration-style: replay the plugin's ring logic (recordCall + pop-on-deny)
// to confirm the breaker trips exactly at the 5th call of A,B,A,B,A, that a
// denied call is not recorded (identical retry denies again — hard stop), and
// that a genuinely different call unblocks.
test('ring mechanics: oscillation detected on the 5th call, then clears', () => {
  const ring = []
  const pushSig = (s) => recordCall(ring, s)
  // oscillating A,B,A,B,A
  assert.equal(pushSig('A'), false)
  assert.equal(pushSig('B'), false)
  assert.equal(pushSig('A'), false)
  assert.equal(pushSig('B'), false)
  assert.equal(pushSig('A'), true) // 5th -> deny
  // the deny pops the signature: the ring is back to A,B,A,B, so an identical
  // retry lands on the same pattern and denies again (no phase-shift escape)
  ring.pop()
  assert.equal(pushSig('A'), true)
  // after the deny the agent must change ONE variable; a genuinely different
  // call slides the ring forward and unblocks.
  assert.equal(pushSig('X'), false)
  assert.equal(pushSig('Y'), false)
})

test('recordCall: trims the ring to OSC_WINDOW', () => {
  const ring = []
  for (let i = 0; i < OSC_WINDOW + 3; i++) recordCall(ring, 'S' + i)
  assert.equal(ring.length, OSC_WINDOW)
  assert.equal(ring[0], 'S3') // oldest trimmed entries are gone
})

// read-only-guard: the mutating fs tools are denied deterministically.
test('isDeniedTool: write and edit are denied; reads, shell and unknown are not', () => {
  assert.equal(isDeniedTool('write'), true)
  assert.equal(isDeniedTool('edit'), true)
  assert.equal(isDeniedTool('read'), false)
  assert.equal(isDeniedTool('read_image'), false)
  assert.equal(isDeniedTool('bash'), false)
  assert.equal(isDeniedTool(undefined), false)
})

test('DENIED_TOOLS: exactly the mutating fs tools from dsh-tool-fs', () => {
  assert.deepEqual(DENIED_TOOLS, ['write', 'edit'])
})

// --- apply() wiring: exercise the real plugin through a fake ctx so the
// hard-stop pop and the deny paths are tested, not hand-simulated.

function fakeCtx({ fs } = {}) {
  const handlers = {}
  return {
    ctx: {
      get: (key) => (key === 'fs' ? fs : undefined),
      on: (event, handler) => { handlers[event] = handler },
    },
    handlers,
  }
}

const NEXT = async () => 'allowed'
// One shared agent object: the breaker keys its ring on `exec.agent` identity
// (WeakMap), so a sequence of calls must carry the SAME agent to accumulate
// history — a fresh object per call would silently disable the breaker.
const AGENT = {}
const execOf = (name, args) => ({ name, arguments: args, agent: AGENT })

test('discipline-guard apply(): identical retry after an oscillation deny denies again (hard stop)', async () => {
  const { ctx, handlers } = fakeCtx({ fs: {} })
  guardApply(ctx)
  const preExecute = handlers["tools/pre-execute"]
  assert.equal(typeof preExecute, 'function')
  const callA = () => preExecute(execOf('bash', { command: 'a' }), NEXT)
  const callB = () => preExecute(execOf('bash', { command: 'b' }), NEXT)
  assert.equal(await callA(), 'allowed')
  assert.equal(await callB(), 'allowed')
  assert.equal(await callA(), 'allowed')
  assert.equal(await callB(), 'allowed')
  const denied = await callA()
  assert.equal(denied.kind, 'deny')
  // the deny is not recorded: the identical retry re-forms A,B,A,B,A
  const retry = await callA()
  assert.equal(retry.kind, 'deny')
  // changing ONE variable unblocks
  assert.equal(await preExecute(execOf('bash', { command: 'c' }), NEXT), 'allowed')
})

test('discipline-guard apply(): full read of a >25 KB file is denied with window guidance', async () => {
  const fs = { resolve: async () => ({}), stat: async () => ({ size: 120 * 1024 }) }
  const { ctx, handlers } = fakeCtx({ fs })
  guardApply(ctx)
  const preExecute = handlers["tools/pre-execute"]
  const denied = await preExecute(execOf('read', { file_path: 'big.txt' }), NEXT)
  assert.equal(denied.kind, 'deny')
  assert.match(denied.reason, /120 KB/)
  assert.match(denied.reason, /offset\/limit/)
  // bounded windows pass through to the host
  assert.equal(await preExecute(execOf('read', { file_path: 'big.txt', offset: 1, limit: PARTIAL_WINDOW_LINES }), NEXT), 'allowed')
})

test('read-only-guard apply(): write and edit are denied, read passes through', async () => {
  const { ctx, handlers } = fakeCtx()
  roApply(ctx)
  const preExecute = handlers["tools/pre-execute"]
  assert.equal(roName, 'read-only-guard')
  const w = await preExecute(execOf('write', { file_path: 'x.txt', content: 'hi' }), NEXT)
  assert.equal(w.kind, 'deny')
  assert.match(w.reason, /READ-ONLY PRESET/)
  const e = await preExecute(execOf('edit', { file_path: 'x.txt', old_string: 'a', new_string: 'b' }), NEXT)
  assert.equal(e.kind, 'deny')
  assert.equal(await preExecute(execOf('read', { file_path: 'x.txt' }), NEXT), 'allowed')
})
