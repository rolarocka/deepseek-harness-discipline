import test from 'node:test'
import assert from 'node:assert/strict'
import { canonical, isOscillating, OSC_WINDOW } from '../presets/builder/plugins/discipline-guard.js'

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

// Integration-style: replay the plugin's ring logic (push + shift + test on
// each step) to confirm the breaker trips exactly at the 5th call of A,B,A,B,A.
test('ring mechanics: oscillation detected on the 5th call, then clears', () => {
  const ring = []
  const pushSig = (s) => {
    ring.push(s)
    if (ring.length > OSC_WINDOW) ring.shift()
    return isOscillating(ring)
  }
  // oscillating A,B,A,B,A
  assert.equal(pushSig('A'), false)
  assert.equal(pushSig('B'), false)
  assert.equal(pushSig('A'), false)
  assert.equal(pushSig('B'), false)
  assert.equal(pushSig('A'), true) // 5th -> deny
  // after the deny the agent must change ONE variable; a genuinely different
  // call slides the ring forward and unblocks.
  assert.equal(pushSig('X'), false)
  assert.equal(pushSig('Y'), false)
})
