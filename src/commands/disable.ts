import { AntigravityAdapter } from '../adapters/antigravity.js';
import { ClaudeCodeAdapter } from '../adapters/claudecode.js';
import { CodexAdapter } from '../adapters/codex.js';

export async function disableCommand(plugin: string, options: { global?: boolean; target?: string }): Promise<void> {
  try {
    const scope = options.global ? 'global' : 'local';
    console.log(`Disabling plugin ${plugin} (${scope})...`);

    const adapters = [new AntigravityAdapter(), new ClaudeCodeAdapter(), new CodexAdapter()];

    for (const adapter of adapters) {
      if (!options.target || options.target === adapter.name) {
        if (await adapter.detect(scope)) {
          await adapter.disable(plugin, scope);
        }
      }
    }
  } catch (err: any) {
    console.error(`Error disabling plugin: ${err.message}`);
    process.exitCode = 1;
  }
}
