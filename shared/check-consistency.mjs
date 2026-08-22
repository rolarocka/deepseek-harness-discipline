#!/usr/bin/env node
// check-consistency.mjs — drift guard for the 8 presets.
//
// The 32 universal rules, the persona header and the shell-tool block are
// intentionally duplicated across every presets/<id>/agent.cordis.yml because
// each preset directory is self-contained (its plugin "travels with the
// preset" and the installer copies whole directories). That deliberate
// duplication has one structural risk: an edit landed in one preset but not
// the others drifts silently. This script is the guard against that drift.
//
// It checks six things across all 8 presets:
//   1. the 32 universal rules are byte-identical everywhere;
//   2. the persona header (the `- id: persona` row through the rules) is
//      byte-identical everywhere;
//   3. the shell-tool block state is as designed — BOTH rows (tool-bash and
//      tool-pwsh) PRESENT in builder, surgeon, design, scribe, tester; NEITHER
//      row present in planner, advisor, hunter;
//   4. the preset-local plugins/discipline-guard.js copies are byte-identical
//      everywhere (the plugin is duplicated by design and travels with the
//      preset);
//   5. plugins/read-only-guard.js exists in exactly the three read-only
//      presets (planner, advisor, hunter), is byte-identical across them, and
//      its `- id: read-only-guard` mount row is present there and absent in
//      the shell presets;
//   6. each rules block is structurally intact: exactly rules 1..32,
//      sequentially numbered (catches uniform insertions/deletions that the
//      majority comparison below cannot see).
//
// Remaining blind spot (by design): an edit applied IDENTICALLY to all copies
// of a block still passes — majority comparison has no independent source of
// truth for block content beyond structure (check 6).
//
// On any mismatch it prints the offending file, the block, and the first line
// where it diverges, then exits 1. No silent exit codes.
//
// Usage:
//   node shared/check-consistency.mjs
//
// Runs locally and in CI (see .github/workflows/consistency.yml).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(dirname(fileURLToPath(import.meta.url)));
const presetsDir = join(here, 'presets');

// design intent: shell-tool rows present vs. absent
const SHELL_PRESETS = ['builder', 'surgeon', 'design', 'scribe', 'tester'];
const READ_ONLY_PRESETS = ['planner', 'advisor', 'hunter'];

const PRESETS = [...SHELL_PRESETS, ...READ_ONLY_PRESETS];
for (const id of PRESETS) {
  if (!statSync(join(presetsDir, id, 'agent.cordis.yml')).isFile()) {
    console.error(`MISSING preset file: presets/${id}/agent.cordis.yml`);
    process.exit(2);
  }
}

const norm = (s) => s.replace(/\r\n/g, '\n');

const RULE_COUNT = 32;

// Read each agent.cordis.yml exactly once; every check below works off this
// shared map instead of re-reading the files.
const text = {};
for (const id of PRESETS) text[id] = norm(readFileSync(join(presetsDir, id, 'agent.cordis.yml'), 'utf8'));

// Extract { header, rules } line arrays for one file, or null if the
// structure is unrecognizable (missing the - id: persona row or the rules).
function extract(id) {
  const lines = text[id].split('\n');
  const personaIdx = lines.findIndex((l) => /^- id: persona/.test(l));
  const rulesStart = lines.findIndex((l) => /^      1\. VERIFY BEFORE CLAIMING/.test(l));
  let rulesEnd = -1;
  for (let i = Math.max(0, rulesStart); i < lines.length; i++) {
    if (/^      32\. REPORT AUDIT/.test(lines[i])) { rulesEnd = i; break; }
  }
  if (personaIdx < 0 || rulesStart < 0 || rulesEnd < 0) return null;
  const rules = lines.slice(rulesStart, rulesEnd + 1);
  // Structural integrity: exactly rules 1..RULE_COUNT, sequentially numbered.
  // The majority comparison below cannot catch an edit applied identically to
  // every preset; a broken rule sequence (insertion, deletion, renumbering)
  // is visible locally and fails here regardless of drift.
  const nums = [];
  for (const l of rules) {
    const m = l.match(/^      (\d+)\. /);
    if (m) nums.push(Number(m[1]));
  }
  if (nums.length !== RULE_COUNT || nums.some((n, i) => n !== i + 1)) return null;
  return {
    header: lines.slice(personaIdx, rulesStart), // persona row through the rules' leading lines
    headerStart: personaIdx + 1, // 1-based file line of the header block
    rules, // the 32 rules
    rulesStart: rulesStart + 1, // 1-based file line of the first rule
  };
}

const files = {};
for (const id of PRESETS) {
  const ex = extract(id);
  if (!ex) {
    console.error(`UNRECOGNIZED structure in presets/${id}/agent.cordis.yml — ` +
      `cannot locate the '- id: persona' row or a well-formed 32-rule block ` +
      `(exactly rules 1..32, sequentially numbered).`);
    process.exit(2);
  }
  files[id] = ex;
}

// Majority reference: the value shared by the most presets wins, so an edit in
// ANY single preset (including the one an admin might otherwise treat as the
// reference) is flagged. On a tie there is no trustworthy reference — report
// the ambiguity instead of silently picking one. `ids` scopes the vote (the
// read-only-guard majority only polls presets that carry the file).
function majorityValue(ids, getVal) {
  const counts = new Map();
  for (const id of ids) {
    const v = getVal(id);
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const entries = [...counts.entries()].sort((x, y) => y[1] - x[1]);
  const [topV, topN] = entries[0];
  if (topN === 1 || (entries[1] && entries[1][1] === topN)) return null; // tie / no leader
  return topV;
}

// First line index (0-based, relative to the majority value) where the given
// block differs from the majority value, or -1 if equal.
function diffFromMajority(blockLines, majLines) {
  const n = Math.max(blockLines.length, majLines.length);
  for (let i = 0; i < n; i++) if ((blockLines[i] ?? undefined) !== (majLines[i] ?? undefined)) return i;
  return -1;
}

const failures = [];
const majRules = majorityValue(PRESETS, (id) => files[id].rules.join('\n'));
const majHeader = majorityValue(PRESETS, (id) => files[id].header.join('\n'));

for (const id of PRESETS) {
  const f = files[id];

  if (majRules === null) {
    failures.push({ id, block: 'rules', msg: 'no majority value — presets disagree on the 32 rules (tie)' });
  } else if (f.rules.join('\n') !== majRules) {
    const dR = diffFromMajority(f.rules, majRules.split('\n'));
    failures.push({ id, block: 'rules', line: f.rulesStart + dR, a: majRules.split('\n')[dR], b: f.rules[dR] });
  }

  if (majHeader === null) {
    failures.push({ id, block: 'persona-header', msg: 'no majority value — presets disagree on the persona header (tie)' });
  } else if (f.header.join('\n') !== majHeader) {
    const dH = diffFromMajority(f.header, majHeader.split('\n'));
    failures.push({ id, block: 'persona-header', line: f.headerStart + dH, a: majHeader.split('\n')[dH], b: f.header[dH] });
  }
}

// shell-tool block state: BOTH rows (tool-bash + tool-pwsh) PRESENT in shell
// presets, NEITHER row present in read-only ones. Checking only tool-bash —
// as this guard once did — would let a read-only preset drift into shell
// access by gaining a lone tool-pwsh row (and a shell preset lose pwsh
// silently). The regex is end-anchored so a hypothetical `- id: tool-bash-x`
// row cannot satisfy the tool-bash check.
const hasRow = (id, row) => new RegExp('^- id: ' + row + '$', 'm').test(text[id]);
for (const id of PRESETS) {
  for (const row of ['tool-bash', 'tool-pwsh']) {
    const has = hasRow(id, row);
    if (SHELL_PRESETS.includes(id) && !has) {
      failures.push({ id, block: 'shell-block', msg: `expected ${row} row (shell preset) but it is missing` });
    }
    if (READ_ONLY_PRESETS.includes(id) && has) {
      failures.push({ id, block: 'shell-block', msg: `expected NO shell tools (read-only preset) but ${row} is present` });
    }
  }
}

// plugin identity: every preset carries its own plugins/discipline-guard.js
// copy (self-contained install), so all 8 copies must stay byte-identical —
// same majority-reference policy as the rules and persona header.
const pluginLines = {};
for (const id of PRESETS) {
  const rel = join('plugins', 'discipline-guard.js');
  const p = join(presetsDir, id, rel);
  let st;
  try {
    st = statSync(p);
  } catch {
    console.error(`MISSING preset file: presets/${id}/${join('plugins', 'discipline-guard.js')}`);
    process.exit(2);
  }
  if (!st.isFile()) {
    console.error(`MISSING preset file: presets/${id}/${join('plugins', 'discipline-guard.js')}`);
    process.exit(2);
  }
  pluginLines[id] = norm(readFileSync(p, 'utf8')).split('\n');
}
const majPlugin = majorityValue(PRESETS, (id) => pluginLines[id].join('\n'));
for (const id of PRESETS) {
  if (majPlugin === null) {
    failures.push({ id, file: `presets/${id}/plugins/discipline-guard.js`, block: 'discipline-guard.js', msg: 'no majority value — presets disagree on the plugin (tie)' });
  } else if (pluginLines[id].join('\n') !== majPlugin) {
    const dP = diffFromMajority(pluginLines[id], majPlugin.split('\n'));
    failures.push({ id, file: `presets/${id}/plugins/discipline-guard.js`, block: 'discipline-guard.js', line: dP + 1, a: majPlugin.split('\n')[dP], b: pluginLines[id][dP] });
  }
}

// read-only guard: the three read-only presets carry a preset-local
// plugins/read-only-guard.js (byte-identical, same majority policy as above)
// and mount it via a `- id: read-only-guard` row; shell presets must carry
// neither the file nor the row. This is the enforcement half of the source
// repo's `permission: {edit: deny}` — dsh-tool-fs registers write/edit
// unconditionally, so a missing guard silently re-opens write access.
const roGuardPath = (id) => join(presetsDir, id, 'plugins', 'read-only-guard.js');
const roGuardExists = {};
for (const id of PRESETS) {
  let st;
  try {
    st = statSync(roGuardPath(id));
    roGuardExists[id] = st.isFile();
  } catch {
    roGuardExists[id] = false;
  }
}
for (const id of PRESETS) {
  if (READ_ONLY_PRESETS.includes(id) && !roGuardExists[id]) {
    failures.push({ id, file: `presets/${id}/plugins/read-only-guard.js`, block: 'read-only-guard', msg: 'read-only preset must carry plugins/read-only-guard.js but it is missing' });
  }
  if (SHELL_PRESETS.includes(id) && roGuardExists[id]) {
    failures.push({ id, file: `presets/${id}/plugins/read-only-guard.js`, block: 'read-only-guard', msg: 'shell preset must NOT carry plugins/read-only-guard.js but it is present' });
  }
}
const roGuardIds = PRESETS.filter((id) => roGuardExists[id]);
if (roGuardIds.length > 0) {
  const roGuardLines = {};
  for (const id of roGuardIds) roGuardLines[id] = norm(readFileSync(roGuardPath(id), 'utf8')).split('\n');
  const majRoGuard = majorityValue(roGuardIds, (id) => roGuardLines[id].join('\n'));
  for (const id of roGuardIds) {
    if (majRoGuard === null) {
      failures.push({ id, file: `presets/${id}/plugins/read-only-guard.js`, block: 'read-only-guard.js', msg: 'no majority value — presets disagree on the plugin (tie)' });
    } else if (roGuardLines[id].join('\n') !== majRoGuard) {
      const dG = diffFromMajority(roGuardLines[id], majRoGuard.split('\n'));
      failures.push({ id, file: `presets/${id}/plugins/read-only-guard.js`, block: 'read-only-guard.js', line: dG + 1, a: majRoGuard.split('\n')[dG], b: roGuardLines[id][dG] });
    }
  }
}

// mount row: read-only presets must mount read-only-guard, shell presets must not
for (const id of PRESETS) {
  const hasGuardRow = hasRow(id, 'read-only-guard');
  if (READ_ONLY_PRESETS.includes(id) && !hasGuardRow) {
    failures.push({ id, block: 'read-only-guard-row', msg: 'expected a read-only-guard mount row (read-only preset) but it is missing' });
  }
  if (SHELL_PRESETS.includes(id) && hasGuardRow) {
    failures.push({ id, block: 'read-only-guard-row', msg: 'expected NO read-only-guard mount row (shell preset) but it is present' });
  }
}

// duplicate rows: every `- id:` within one preset file must be unique — a
// duplicated row mounts the same component twice (dsh rejects it at mount or
// double-instantiates the plugin: duplicate prompt cards, doubled rings).
for (const id of PRESETS) {
  const seen = new Map();
  for (const l of text[id].split('\n')) {
    const m = l.match(/^- id: (\S+)$/);
    if (!m) continue;
    const n = (seen.get(m[1]) ?? 0) + 1;
    seen.set(m[1], n);
    if (n === 2) failures.push({ id, block: 'duplicate-row', msg: `row '- id: ${m[1]}' appears more than once — a component is mounted twice` });
  }
}

if (failures.length > 0) {
  console.error('CONSISTENCY FAIL — presets drifted apart:\n');
  for (const f of failures) {
    console.error(`  ${f.file ?? `presets/${f.id}/agent.cordis.yml`}`);
    if (f.msg) {
      console.error(`    block: ${f.block} — ${f.msg}`);
    } else {
      console.error(`    block: ${f.block} — first difference at line ${f.line}`);
      console.error(`      majority: ${JSON.stringify(f.a)}`);
      console.error(`      ${f.id.padEnd(11)}: ${JSON.stringify(f.b)}`);
    }
  }
  console.error(`\n${failures.length} preset(s) drifted from the majority.`);
  process.exit(1);
}

const present = SHELL_PRESETS.join(', ');
const absent = READ_ONLY_PRESETS.join(', ');
console.log(`OK: 32 rules + persona header + discipline-guard.js identical across ${PRESETS.length} presets; ` +
  `read-only-guard.js identical across (${READ_ONLY_PRESETS.join(', ')}) and absent elsewhere; ` +
  `shell rows (tool-bash, tool-pwsh) present in (${present}) and absent in (${absent}).`);
