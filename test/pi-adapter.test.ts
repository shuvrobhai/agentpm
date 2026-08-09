import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PiAdapter } from '../src/adapters/pi.js';
import type { PortableCoreIR } from '../src/ir/types.js';

describe('PiAdapter Greenfield Conversion', () => {
  const sampleIR: PortableCoreIR = {
    source: {
      type: 'local',
      originalInput: './pi-plugin',
      resolvedPath: '/tmp/pi-plugin',
      pluginName: 'pi-test-plugin',
      pluginDescription: 'Test Plugin for Pi',
    },
    metadata: {},
    skills: [
      {
        name: 'pi-helper',
        description: 'Helper skill for Pi',
        body: 'Skill instructions',
        rawFrontmatter: {},
        supportingFiles: [],
        sourcePath: 'skills/helper.md',
        sourceDir: 'skills',
      },
    ],
    mcpServers: [
      {
        name: 'pi-mcp',
        type: 'stdio',
        command: '${CLAUDE_PLUGIN_ROOT}/bin/pi-server',
        args: [],
        sourcePath: 'mcp.json',
      },
    ],
    extensions: {
      agents: [],
      commands: [],
      rules: [],
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

  it('PiAdapter registers with identity pi and Pi Coding Agent', () => {
    const adapter = new PiAdapter();
    assert.equal(adapter.name, 'pi');
    assert.equal(adapter.displayName, 'Pi Coding Agent');
  });

  it('emits skills, mcp.json, index.ts extension wrapper, and trust.json', () => {
    const adapter = new PiAdapter();
    const result = adapter.convert(sampleIR, 'workspace');

    const skillFile = result.files.find((f) => f.relativePath === 'skills/pi-helper/SKILL.md');
    assert.equal(skillFile !== undefined, true);

    const mcpFile = result.files.find((f) => f.relativePath === 'mcp.json');
    assert.equal(mcpFile !== undefined, true);
    assert.match(mcpFile!.content, /\/tmp\/pi-plugin\/bin\/pi-server/);

    const indexFile = result.files.find((f) => f.relativePath === 'index.ts');
    assert.equal(indexFile !== undefined, true);
    assert.match(indexFile!.content, /pi\.registerSkill/);
    assert.match(indexFile!.content, /pi\.on/);

    const trustFile = result.files.find((f) => f.relativePath === 'trust.json');
    assert.equal(trustFile !== undefined, true);
    assert.match(trustFile!.content, /"trusted": true/);
  });
});
