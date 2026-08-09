import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  convertCommandToAntigravity,
  convertCommandsToAntigravityWorkflows,
  convertWorkflowToClaudeCommand,
  ANTIGRAVITY_WORKFLOW_MAX_CHARS,
} from '../src/ir/command-converter.js';
import type { CommandIR } from '../src/ir/types.js';

describe('CommandConverter', () => {
  it('converts short command under 12,000 chars to Antigravity Workflow', () => {
    const cmd: CommandIR = {
      name: 'deploy-app',
      description: 'Deploy the application',
      body: 'echo "deploying..."',
      rawFrontmatter: {},
      variables: [],
      dynamicInjections: [],
      sourcePath: 'commands/deploy.md',
    };

    const res = convertCommandToAntigravity(cmd);
    assert.equal(res.isUpgradedToSkill, false);
    assert.equal(res.file.relativePath, 'workflows/deploy-app.md');
    assert.match(res.file.content, /name: deploy-app/);
    assert.match(res.file.content, /echo "deploying..."/);
  });

  it('automatically upgrades commands exceeding 12,000 chars to Agent Skills (ADR 0023)', () => {
    const largeBody = 'a'.repeat(ANTIGRAVITY_WORKFLOW_MAX_CHARS + 500);
    const cmd: CommandIR = {
      name: 'large-prompt',
      description: 'Massive prompt template',
      body: largeBody,
      rawFrontmatter: {},
      variables: [],
      dynamicInjections: [],
      sourcePath: 'commands/large.md',
    };

    const res = convertCommandToAntigravity(cmd);
    assert.equal(res.isUpgradedToSkill, true);
    assert.equal(res.file.relativePath, 'skills/large-prompt/SKILL.md');
    assert.equal(res.upgradedSkill !== undefined, true);
    assert.equal(res.upgradedSkill!.name, 'large-prompt');
    assert.match(res.warning!, /exceeds Antigravity workflow 12,000 character limit — upgraded to Agent Skill/);
  });

  it('convertCommandsToAntigravityWorkflows separates workflows and upgraded skills', () => {
    const smallCmd: CommandIR = {
      name: 'small',
      description: 'Small command',
      body: 'small body',
      rawFrontmatter: {},
      variables: [],
      dynamicInjections: [],
      sourcePath: 'commands/small.md',
    };
    const largeCmd: CommandIR = {
      name: 'large',
      description: 'Large command',
      body: 'x'.repeat(13000),
      rawFrontmatter: {},
      variables: [],
      dynamicInjections: [],
      sourcePath: 'commands/large.md',
    };

    const res = convertCommandsToAntigravityWorkflows([smallCmd, largeCmd]);
    assert.equal(res.workflowFiles.length, 1);
    assert.equal(res.upgradedSkillFiles.length, 1);
    assert.equal(res.upgradedSkills.length, 1);
    assert.equal(res.warnings.length, 1);
  });

  it('convertWorkflowToClaudeCommand formats Claude slash commands', () => {
    const res = convertWorkflowToClaudeCommand('test-flow', 'A test flow', 'run step 1');
    assert.equal(res.relativePath, 'commands/test-flow.md');
    assert.match(res.content, /# \/test-flow/);
    assert.match(res.content, /> A test flow/);
    assert.match(res.content, /run step 1/);
  });
});
