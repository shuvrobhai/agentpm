import { AntigravityAdapter } from '../adapters/antigravity.js';
import { ClaudeCodeAdapter } from '../adapters/claudecode.js';

export async function enableCommand(plugin: string, options: { global?: boolean; target?: string }): Promise<void> {
  const scope = options.global ? 'global' : 'local';
  console.log(`Enabling plugin ${plugin} (${scope})...`);

  const adapters = [new AntigravityAdapter(), new ClaudeCodeAdapter()];

  for (const adapter of adapters) {
    if (!options.target || options.target === adapter.name) {
      if (await adapter.detect()) {
        await adapter.enable(plugin, 'latest', scope);
      }
    }
  }
}
