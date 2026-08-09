import type { CommandIR, PortableSkillIR, FileOutput } from './types.js';

export interface CommandConversionResult {
  workflowFiles: FileOutput[];
  upgradedSkillFiles: FileOutput[];
  upgradedSkills: PortableSkillIR[];
  warnings: string[];
}

export const ANTIGRAVITY_WORKFLOW_MAX_CHARS = 12000;

/**
 * Converts Claude Code / generic commands into Antigravity Workflows or upgraded Agent Skills (ADR 0023).
 */
export function convertCommandToAntigravity(command: CommandIR): {
  file: FileOutput;
  isUpgradedToSkill: boolean;
  upgradedSkill?: PortableSkillIR;
  warning?: string;
} {
  const contentLen = command.body.length;

  if (contentLen > ANTIGRAVITY_WORKFLOW_MAX_CHARS) {
    const warning = `Command '${command.name}' (${contentLen} chars) exceeds Antigravity workflow 12,000 character limit — upgraded to Agent Skill (ADR 0023)`;

    const skillContent = [
      '---',
      `name: ${command.name}`,
      `description: ${JSON.stringify(command.description || command.name)}`,
      '---',
      '',
      `# ${command.name}`,
      '',
      command.body,
    ].join('\n');

    const upgradedSkill: PortableSkillIR = {
      name: command.name,
      description: command.description || command.name,
      body: command.body,
      rawFrontmatter: { name: command.name, description: command.description },
      supportingFiles: [],
      sourcePath: command.sourcePath,
      sourceDir: '',
    };

    return {
      file: {
        relativePath: `skills/${command.name}/SKILL.md`,
        content: skillContent,
        description: `Upgraded Command to Skill: ${command.name} (exceeded 12k workflow limit)`,
      },
      isUpgradedToSkill: true,
      upgradedSkill,
      warning,
    };
  }

  // Under 12k chars -> Emit native Antigravity Workflow (.agents/workflows/<name>.md)
  const workflowContent = [
    '---',
    `name: ${command.name}`,
    `description: ${JSON.stringify(command.description || command.name)}`,
    '---',
    '',
    command.body,
  ].join('\n');

  return {
    file: {
      relativePath: `workflows/${command.name}.md`,
      content: workflowContent,
      description: `Workflow: ${command.name}`,
    },
    isUpgradedToSkill: false,
  };
}

/**
 * Converts a list of commands into Antigravity workflow or upgraded skill outputs.
 */
export function convertCommandsToAntigravityWorkflows(commands: CommandIR[]): CommandConversionResult {
  const workflowFiles: FileOutput[] = [];
  const upgradedSkillFiles: FileOutput[] = [];
  const upgradedSkills: PortableSkillIR[] = [];
  const warnings: string[] = [];

  for (const cmd of commands) {
    const res = convertCommandToAntigravity(cmd);
    if (res.warning) {
      warnings.push(res.warning);
    }
    if (res.isUpgradedToSkill) {
      upgradedSkillFiles.push(res.file);
      if (res.upgradedSkill) {
        upgradedSkills.push(res.upgradedSkill);
      }
    } else {
      workflowFiles.push(res.file);
    }
  }

  return {
    workflowFiles,
    upgradedSkillFiles,
    upgradedSkills,
    warnings,
  };
}

/**
 * Converts Antigravity Workflows to Claude Code commands (.claude/commands/<name>.md).
 */
export function convertWorkflowToClaudeCommand(
  name: string,
  description: string,
  body: string
): FileOutput {
  const content = [
    `# /${name}`,
    '',
    description ? `> ${description}\n` : '',
    body,
  ].join('\n');

  return {
    relativePath: `commands/${name}.md`,
    content,
    description: `Claude Code Command: ${name}`,
  };
}
