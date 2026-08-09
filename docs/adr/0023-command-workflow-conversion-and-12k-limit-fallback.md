# 23. Commands to Workflows Conversion and 12k Character Boundary Fallback

- Status: Accepted
- Date: 2026-08-10

## Context and Problem Statement

Claude Code slash commands (`.claude/commands/<name>.md`) map to Antigravity Workflows (`.agents/workflows/<name>.md`). However, the Antigravity workflow engine enforces a hard 12,000 character limit per workflow file. When converting large slash commands (e.g. multi-step prompts or extensive documentation templates), exceeding this limit would cause Antigravity runtime validation failures.

## Decision Drivers

- **Zero Data Loss**: Prompts and instruction steps must not be truncated or corrupted during conversion.
- **Runtime Compliance**: Generated artifacts must strictly comply with target agent limits (12k limit for Antigravity workflows).
- **Automated Graceful Fallback**: The conversion pipeline should resolve size constraints without requiring manual user splitting.

## Considered Options

1. **Automatic Upgrade to Agent Skill (`.agents/skills/<name>/SKILL.md`) [Chosen]**:
   - Commands under 12,000 characters convert directly to `.agents/workflows/<name>.md` with YAML frontmatter.
   - Commands exceeding 12,000 characters are automatically upgraded to full Agent Skills (`.agents/skills/<name>/SKILL.md`), which carry no character limits, with a structured warning in `ConversionResult.warnings`.
2. **Hard Truncation at 12,000 Characters**:
   - Truncate command contents at 12,000 characters with a warning footer.
   - *Trade-off*: Causes syntax errors, broken code, and missing instructions.
3. **Conversion Error / Halt**:
   - Fail conversion if size exceeds 12,000 characters.
   - *Trade-off*: Blocks automated batch conversion of large plugins.

## Decision Outcome

Chosen option: **"Automatic Upgrade to Agent Skill"**, preserving 100% of large command prompts while guaranteeing compliance with Antigravity runtime size boundaries.
