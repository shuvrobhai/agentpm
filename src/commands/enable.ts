import { AgentAdapter } from '../adapters/base.js';
import { AntigravityAdapter } from '../adapters/antigravity.js';
import { ClaudeCodeAdapter } from '../adapters/claudecode.js';

export async function enableCommand(plugin: string, options: { global?: boolean; target?: string }): Promise<void> {
  try {
    const scope = options.global ? 'global' : 'local';
    console.log(`Enabling plugin ${plugin} (${scope})...`);

    const adapters: AgentAdapter[] = [new AntigravityAdapter(), new ClaudeCodeAdapter()];
    let materializedCount = 0;

    for (const adapter of adapters) {
      if (options.target) {
        if (options.target === adapter.name) {
          await adapter.enable(plugin, 'latest', scope);
          materializedCount++;
        }
      } else {
        if (await adapter.detect(scope)) {
          await adapter.enable(plugin, 'latest', scope);
          materializedCount++;
        }
      }
    }

    if (materializedCount === 0 && scope === 'local' && !options.target) {
      const defaultAdapter = new AntigravityAdapter();
      await defaultAdapter.enable(plugin, 'latest', 'local');
    }
  } catch (err: any) {
    console.error(`Error enabling plugin: ${err.message}`);
    process.exitCode = 1;
  }
}
