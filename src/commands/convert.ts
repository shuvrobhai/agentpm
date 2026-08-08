import path from 'node:path';
import fs from 'node:fs/promises';
import { GlobalStore } from '../core/store.js';
import { PluginConverter } from '../core/converter.js';
import { getAdapter } from '../adapters/index.js';

export interface ConvertCommandOptions {
  target?: string;
  out?: string;
  memory?: string;
  varPrefix?: string;
}

export async function convertCommand(
  pluginPathOrIdentifier: string,
  options: ConvertCommandOptions
): Promise<void> {
  try {
    let sourcePath = path.resolve(pluginPathOrIdentifier);
    const sourceExists = await fs.access(sourcePath).then(() => true).catch(() => false);

    if (!sourceExists) {
      sourcePath = await GlobalStore.findPluginPath(pluginPathOrIdentifier);
    }

    const targetAdapterName = options.target || 'antigravity';
    const adapter = getAdapter(targetAdapterName);
    const memoryFilename = (options.memory as 'AGENTS.md' | 'CLAUDE.md') || 'AGENTS.md';
    const rootVarName = options.varPrefix || 'PLUGIN_ROOT';

    const pluginName = path.basename(sourcePath);

    let outDir: string;
    if (options.out) {
      outDir = path.resolve(options.out);
    } else if (sourceExists) {
      // Default local workspace conversion output to the target adapter's local plugin folder
      outDir = adapter.getLocalPluginDir(pluginName);
    } else {
      outDir = adapter.getPluginDir(pluginName, 'latest');
    }

    console.log(`Converting plugin from "${sourcePath}"...`);
    console.log(`Target Adapter: ${adapter.name}`);
    console.log(`Memory Filename: ${memoryFilename}`);
    console.log(`Variable Prefix: \${${rootVarName}}`);
    console.log(`Output Directory: ${outDir}`);

    const result = await PluginConverter.convertPlugin(sourcePath, outDir, {
      targetAdapter: adapter.name,
      memoryFilename,
      rootVarName,
      expandMcpPaths: true,
      neutralizeTerms: true,
    });

    console.log('\nConversion Summary:');
    console.log(`- Files processed: ${result.filesProcessed}`);
    console.log(`- Files modified: ${result.filesModified}`);
    console.log(`- Variables rewritten: ${result.variablesRewritten}`);
    console.log(`- MCP paths expanded: ${result.mcpPathsExpanded}`);
    console.log(`- Rules/memory transpiled: ${result.rulesTranspiled}`);
    console.log(`\nPlugin successfully converted to workspace: ${outDir}`);

  } catch (err: any) {
    console.error('Error converting plugin:', err);
    process.exit(1);
  }
}
