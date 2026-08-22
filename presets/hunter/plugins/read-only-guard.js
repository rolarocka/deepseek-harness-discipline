// read-only-guard.js — deterministic write/edit deny for read-only DSH presets.
//
// Mounted by planner, advisor and hunter (the read-only presets). The
// `standard`-derived composition mounts @deepseek-ai/dsh-tool-fs, whose
// apply() registers the FULL read/write/edit suite unconditionally (verified
// against dsh-tool-fs 0.1.0-rc.7) — so "read-only" cannot be enforced by
// omitting rows without also losing `read`. This plugin restores the
// enforcement half that opencode-agents carried as `permission: {edit: deny}`:
// the mutating fs tools are denied deterministically, no LLM judgment. Shell
// tools are already absent from those presets' compositions.
//
//   - id: read-only-guard
//     name: './plugins/read-only-guard.js'
//
// The relative specifier resolves against the preset directory, so the file
// travels with the preset (see dsh-agent-presets PresetTree.import()).

export const DENIED_TOOLS = ['write', 'edit'];

// True when the given tool name is a mutation this guard denies. Pure.
export function isDeniedTool(toolName) {
  return DENIED_TOOLS.includes(toolName);
}

const name = 'read-only-guard';

function apply(ctx) {
  const prompt = ctx.get('systemPrompt');

  // Always-on card so the model learns the policy before the first denial.
  if (prompt !== undefined) {
    prompt.section({
      name: 'read-only-guard',
      order: 51,
      text: [
        '## Read-only Guard (always-on)',
        '- This agent is READ-ONLY by policy: the write and edit tools are disabled and every attempt is denied.',
        '- Never route around a denial (rule 3): report the intended change with file paths and hand it to builder/surgeon/design.',
      ].join('\n'),
    });
  }

  ctx.on('tools/pre-execute', async (exec, next) => {
    if (!isDeniedTool(exec.name)) return next();
    return {
      kind: 'deny',
      reason: 'READ-ONLY PRESET: the ' + exec.name + ' tool is disabled on this agent. Report the intended change (file, location, exact content) instead of applying it.',
    };
  });
}

export { name, apply }
export default { name, apply }
