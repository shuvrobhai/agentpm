import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapToolName, mapToolNames, mapHookMatcher } from '../src/ir/tool-mapper.js';

describe('ToolMapper', () => {
  it('maps standard shell tool bash to run_command for Antigravity', () => {
    const res = mapToolName('bash', 'antigravity');
    assert.equal(res.mappedName, 'run_command');
    assert.equal(res.isKnown, true);
  });

  it('maps read_file to view_file for Antigravity and read for OpenCode', () => {
    assert.equal(mapToolName('read_file', 'antigravity').mappedName, 'view_file');
    assert.equal(mapToolName('read_file', 'opencode').mappedName, 'read');
    assert.equal(mapToolName('read_file', 'claude-code').mappedName, 'View');
  });

  it('maps edit_file and str_replace to replace_file_content for Antigravity', () => {
    assert.equal(mapToolName('edit_file', 'antigravity').mappedName, 'replace_file_content');
    assert.equal(mapToolName('str_replace', 'antigravity').mappedName, 'replace_file_content');
  });

  it('passes custom or unknown tool names through unchanged with warning (ADR 0022)', () => {
    const res = mapToolName('custom_jira_tool', 'antigravity');
    assert.equal(res.mappedName, 'custom_jira_tool');
    assert.equal(res.isKnown, false);
  });

  it('mapToolNames deduplicates mapped tools and produces warnings for unknown tools', () => {
    const tools = ['bash', 'terminal', 'custom_tool', 'read_file'];
    const res = mapToolNames(tools, 'antigravity');
    assert.deepEqual(res.mappedTools, ['run_command', 'custom_tool', 'view_file']);
    assert.equal(res.warnings.length, 1);
    assert.match(res.warnings[0]!, /custom_tool/);
  });

  it('mapHookMatcher translates tool matchers correctly', () => {
    const res = mapHookMatcher('bash', 'antigravity');
    assert.equal(res.mappedMatcher, 'run_command');
    assert.equal(res.warnings.length, 0);

    const undefinedRes = mapHookMatcher(undefined, 'antigravity');
    assert.equal(undefinedRes.mappedMatcher, undefined);
  });
});
