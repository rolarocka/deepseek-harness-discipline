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
// It checks four things across all 8 presets:
//   1. the 32 universal rules are byte-identical everywhere;
//   2. the persona header (the `- id: persona` row through the rules) is
//      byte-identical everywhere;
//   3. the shell-tool block state is as designed — BOTH rows (tool-bash and
//      tool-pwsh) PRESENT in builder, surgeon, design, scribe, tester; NEITHER
//      row present in planner, advisor, hunter;
//   4. the preset-local plugins/discipline-guard.js copies are byte-identical
//      everywhere (the plugin is duplicated by design and travels with the
//      preset).
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
  return {
    header: lines.slice(personaIdx, rulesStart), // persona row through the rules' leading lines
    headerStart: personaIdx + 1, // 1-based file line of the header block
    rules: lines.slice(rulesStart, rulesEnd + 1), // the 32 rules
    rulesStart: rulesStart + 1, // 1-based file line of the first rule
  };
}

const files = {};
for (const id of PRESETS) {
  const ex = extract(id);
  if (!ex) {
    console.error(`UNRECOGNIZED structure in presets/${id}/agent.cordis.yml — ` +
      `cannot locate the '- id: persona' row or the 32-rule block.`);
    process.exit(2);
  }
  files[id] = ex;
}

// Majority reference: the value shared by the most presets wins, so an edit in
// ANY single preset (including the one an admin might otherwise treat as the
// reference) is flagged. On a tie there is no trustworthy reference — report
// the ambiguity instead of silently picking one.
function majorityValue(getVal) {
  const counts = new Map();
  for (const id of PRESETS) {
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
const majRules = majorityValue((id) => files[id].rules.join('\n'));
const majHeader = majorityValue((id) => files[id].header.join('\n'));

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
// silently).
const hasRow = (id, row) => new RegExp('^- id: ' + row, 'm').test(text[id]);
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
const majPlugin = majorityValue((id) => pluginLines[id].join('\n'));
for (const id of PRESETS) {
  if (majPlugin === null) {
    failures.push({ id, file: `presets/${id}/plugins/discipline-guard.js`, block: 'discipline-guard.js', msg: 'no majority value — presets disagree on the plugin (tie)' });
  } else if (pluginLines[id].join('\n') !== majPlugin) {
    const dP = diffFromMajority(pluginLines[id], majPlugin.split('\n'));
    failures.push({ id, file: `presets/${id}/plugins/discipline-guard.js`, block: 'discipline-guard.js', line: dP + 1, a: majPlugin.split('\n')[dP], b: pluginLines[id][dP] });
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
  `shell rows (tool-bash, tool-pwsh) present in (${present}) and absent in (${absent}).`);
