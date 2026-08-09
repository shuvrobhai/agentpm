# 22. Universal Tool Name Mapping and Unknown Tool Pass-Through Strategy

- Status: Accepted
- Date: 2026-08-10

## Context and Problem Statement

Source agent plugins (such as Claude Code commands or subagents) reference tool names like `bash`, `read_file`, `edit_file`, or custom MCP tools (e.g., `jira_create_ticket`). Previously, target adapters like Antigravity printed static text warnings (`manualSteps`) instead of programmatically translating tool names in subagent tool permissions and hook matchers.

## Decision Drivers

- **Programmatic Seam**: Conversion between agent ecosystems must automatically map standard tool vocabularies without requiring manual user edits.
- **Custom MCP Preservation**: Plugins frequently utilize custom MCP tool names that are not part of core agent built-ins; these must not be stripped or corrupted.
- **Observability**: Any unmapped or non-standard tool reference must generate structured warnings in `ConversionResult.warnings`.

## Considered Options

1. **Pass-Through Unchanged with Structured Warning [Chosen]**:
   - Build a central `ToolMapper` (`src/ir/tool-mapper.ts`) with a 20-tool canonical translation matrix for standard built-ins (`bash` → `run_command`, `read_file` → `view_file`, `edit_file` → `replace_file_content`, etc.).
   - Pass custom or unrecognized tool names through unchanged to target manifests while recording a non-fatal entry in `ConversionResult.warnings`.
2. **Strict Whitelist & Filter**:
   - Strip unrecognized tools from subagent tool lists and fail hook conversion.
   - *Trade-off*: Destroys legitimate custom MCP tools.
3. **Fallback to Shell / Wildcard Alias**:
   - Rewrite unknown tool names to `run_command` or `*`.
   - *Trade-off*: Leads to unexpected hook execution and security boundary erosion.

## Decision Outcome

Chosen option: **"Pass-Through Unchanged with Structured Warning"**, ensuring complete tool translation for standard built-ins while preserving custom MCP tools across target agent environments.
