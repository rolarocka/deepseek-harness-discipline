#!/usr/bin/env node
// Dedup build for deepseek-harness-discipline.
//
// Source of truth lives OUTSIDE the generated presets:
//   shared/                 common fragments reused by every preset
//     fixed-head.txt        identity comment + persona row + `text: |-` intro + the
//                           30 universal rules, ending with the mandatory blank
//                           line that separates rule 30 from the persona line.
//                           KEEP that trailing blank: it is byte-significant and
//                           `--check` fails with DRIFT if it is trimmed.
//     agent-instr.txt       the `- id: agent-instructions` block (through maxBytes)
//     shell-rows.txt        `# ── shell ─` section incl. tool-bash/tool-pwsh rows
//     fixed-tail.txt        `# ── filesystem ─` through end-of-file
//   roles/<id>/
//     header.txt            role-specific top comment (description)
//     persona.txt           role-specific persona line + ROLE/RULES/OUTPUT block,
//                           incl. the trailing blank before `- id: agent-instructions`
//     readonly.txt          (shell-less roles only) the read-only shell comment
//
// Composition per preset:
//   header + fixed-head + persona + agent-instr + (readonly | shell-rows) + fixed-tail
//
// Every fragment is whitespace-sensitive. Trimming a trailing newline anywhere
// silently corrupts the assembled YAML; only `--check` detects it. Normalization
// strips CR so a Windows CRLF checkout does not produce a false DRIFT.
//
// Usage:
//   node shared/build.mjs           compose and WRITE presets/<id>/agent.cordis.yml
//   node shared/build.mjs --check   verify composed bytes match existing files; exit 1 on DRIFT
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(dirname(fileURLToPath(import.meta.url)));
const sharedDir = join(here, 'shared');
const rolesDir = join(here, 'roles');
const presetsDir = join(here, 'presets');

// P3: include directories only — a stray FILE in roles/ would otherwise crash
// the read below (read(<file>/header.txt)).
const presetIds = readdirSync(rolesDir)
  .filter((e) => statSync(join(rolesDir, e)).isDirectory())
  .sort();

const readFrag = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const read = (p) => readFrag(p);
const norm = (s) => s.replace(/\r\n/g, '\n');

const FIXED = {
  head: read(join(sharedDir, 'fixed-head.txt')),
  agentInstr: read(join(sharedDir, 'agent-instr.txt')),
  shellRows: read(join(sharedDir, 'shell-rows.txt')),
  tail: read(join(sharedDir, 'fixed-tail.txt')),
};

function compose(id) {
  const r = join(rolesDir, id);
  const header = read(join(r, 'header.txt'));
  const persona = read(join(r, 'persona.txt'));
  const roPath = join(r, 'readonly.txt');
  const hasReadonly = (() => { try { statSync(roPath); return true; } catch { return false; } })();
  const shellPart = hasReadonly ? read(roPath) : FIXED.shellRows;
  return header + FIXED.head + persona + FIXED.agentInstr + shellPart + FIXED.tail;
}

const check = process.argv.includes('--check');

let drift = 0;
for (const id of presetIds) {
  const out = compose(id);
  if (check) {
    const cur = norm(read(join(presetsDir, id, 'agent.cordis.yml')));
    if (out !== cur) {
      drift++;
      // locate first divergence for diagnosis
      let k = 0;
      const n = Math.max(out.length, cur.length);
      while (k < n && out[k] === (cur[k] ?? '')) k++;
      console.error(`DRIFT ${id}: composed differs from presets/${id}/agent.cordis.yml at byte ${k}`);
    }
  } else {
    const p = join(presetsDir, id, 'agent.cordis.yml');
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, out, 'utf8');
  }
}

if (check) {
  if (drift) { console.error(`FAIL: ${drift}/${presetIds.length} presets drifted`); process.exit(1); }
  console.log(`OK: ${presetIds.length} presets byte-exact (${presetIds.join(', ')})`);
} else {
  console.log(`wrote ${presetIds.length} presets (${presetIds.join(', ')})`);
}
