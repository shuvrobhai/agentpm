import type { AgentAdapter } from '../adapters/index.js';
import { getAdapter } from '../adapters/index.js';
import { AntigravityAdapter } from '../adapters/antigravity.js';
import { ClaudeCodeAdapter } from '../adapters/claudecode.js';
import { CodexAdapter } from '../adapters/codex.js';

export async function enableCommand(
  plugin: string,
  options: { global?: boolean | undefined; target?: string | undefined; copy?: boolean | undefined }
): Promise<void> {
  try {
    const scope = options.global ? 'global' : 'local';
    console.log(`Enabling plugin ${plugin} (${scope}, mode: ${options.copy ? 'copy' : 'symlink'})...`);

    const enableOpts = options.copy !== undefined ? { copy: options.copy } : undefined;

    if (options.target) {
      const adapter = getAdapter(options.target);
      await adapter.enable(plugin, scope, enableOpts);
      return;
    }

    const adapters: AgentAdapter[] = [new AntigravityAdapter(), new ClaudeCodeAdapter(), new CodexAdapter()];
    let materializedCount = 0;

    for (const adapter of adapters) {
      if (await adapter.detect(scope)) {
        await adapter.enable(plugin, scope, enableOpts);
        materializedCount++;
      }
    }

    if (materializedCount === 0 && scope === 'local') {
      const defaultAdapter = new AntigravityAdapter();
      await defaultAdapter.enable(plugin, scope, enableOpts);
    }
  } catch (err: any) {
    console.error('Error enabling plugin:', err);
    process.exit(1);
  }
}
