import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AntigravityAdapter } from '../src/adapters/antigravity.js';
import type { PortableCoreIR } from '../src/ir/types.js';

describe('AntigravityAdapter Upgraded Conversion', () => {
  const sampleIR: PortableCoreIR = {
    source: {
      type: 'local',
      originalInput: './my-plugin',
      resolvedPath: '/tmp/my-plugin',
      pluginName: 'security-plugin',
      pluginDescription: 'Security Tools',
    },
    metadata: {},
    skills: [
      {
        name: 'code-audit',
        description: 'Audit code quality',
        body: 'Check for security flaws',
        rawFrontmatter: {},
        supportingFiles: [],
        sourcePath: 'skills/audit.md',
        sourceDir: 'skills',
      },
    ],
    mcpServers: [
      {
        name: 'sec-mcp',
        type: 'stdio',
        command: '${CLAUDE_PLUGIN_ROOT}/bin/sec-server',
        args: [],
        sourcePath: 'mcp.json',
      },
    ],
    extensions: {
      agents: [
        {
          name: 'auditor-agent',
          description: 'Audits code security',
          body: 'System prompt for auditor',
          tools: ['bash', 'read_file', 'custom_tool'],
          rawFrontmatter: {},
          sourcePath: 'agents/auditor.md',
        },
      ],
      commands: [
        {
          name: 'audit-cmd',
          description: 'Run audit command',
          body: 'echo "auditing..."',
          rawFrontmatter: {},
          variables: [],
          dynamicInjections: [],
          sourcePath: 'commands/audit.md',
        },
      ],
      rules: [
        {
          name: 'sec-rule',
          content: 'Always validate input',
          sourcePath: 'rules/sec.md',
        },
      ],
      hooks: [
        {
          event: 'PreToolUse',
          matcher: 'bash',
          type: 'command',
          command: './check.sh',
          raw: {},
          sourcePath: 'hooks.json',
        },
      ],
      outputStyles: [],
      workflows: [],
      opaque: {},
    },
    warnings: [],
  };

  it('emits skills in Agent Skills standard directory layout (skills/<name>/SKILL.md)', () => {
    const adapter = new AntigravityAdapter();
    const result = adapter.convert(sampleIR, 'workspace');

    const skillFile = result.files.find((f) => f.relativePath === 'skills/code-audit/SKILL.md');
    assert.equal(skillFile !== undefined, true);
    assert.match(skillFile!.content, /name: code-audit/);
  });

  it('emits subagents with YAML frontmatter and mapped tool names', () => {
    const adapter = new AntigravityAdapter();
    const result = adapter.convert(sampleIR, 'workspace');

    const agentFile = result.files.find((f) => f.relativePath === 'agents/auditor-agent.md');
    assert.equal(agentFile !== undefined, true);
    assert.match(agentFile!.content, /tools:\n  - run_command\n  - view_file\n  - custom_tool/);
    assert.match(agentFile!.content, /subagent: true/);
    assert.match(agentFile!.content, /commandExecutionPolicy: sandbox/);
  });

  it('emits mcp_config.json with absolute expanded paths', () => {
    const adapter = new AntigravityAdapter();
    const result = adapter.convert(sampleIR, 'workspace');

    const mcpFile = result.files.find((f) => f.relativePath === 'mcp_config.json');
    assert.equal(mcpFile !== undefined, true);
    const parsed = JSON.parse(mcpFile!.content);
    assert.equal(parsed['sec-mcp'].command, '/tmp/my-plugin/bin/sec-server');
  });

  it('emits hooks.json using nested regex schema', () => {
    const adapter = new AntigravityAdapter();
    const result = adapter.convert(sampleIR, 'workspace');

    const hookFile = result.files.find((f) => f.relativePath === 'hooks.json');
    assert.equal(hookFile !== undefined, true);
    const parsed = JSON.parse(hookFile!.content);
    assert.equal(parsed['security-plugin'].PreToolUse[0].matcher, 'run_command');
  });

  it('emits commands as workflows under workflows/<name>.md', () => {
    const adapter = new AntigravityAdapter();
    const result = adapter.convert(sampleIR, 'workspace');

    const wfFile = result.files.find((f) => f.relativePath === 'workflows/audit-cmd.md');
    assert.equal(wfFile !== undefined, true);
    assert.match(wfFile!.content, /name: audit-cmd/);
  });
});
