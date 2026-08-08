import path from 'node:path';
import { parsePlugin, printIRSummary } from '../parser/index.js';
import { toPortableCore } from '../ir/to-portable-core.js';
import { getAdapter } from '../adapters/index.js';
import { writeConversion } from '../adapters/convert-writer.js';
import { writePortableCore } from '../core/portable-writer.js';

export interface ConvertCommandOptions {
  target?: string;
  out?: string;
  memory?: string;
  varPrefix?: string;
}

const PORTABLE_TARGETS = new Set(['agent-plugins', 'v1', 'portable']);

export async function convertCommand(
  pluginPathOrIdentifier: string,
  options: ConvertCommandOptions
): Promise<void> {
  try {
    // Single pipeline (ADR 0013): parse into the 9-type IR, narrow to the
    // portable core, then emit. Bare `convert` emits the portable v1 core;
    // native targets are reached via --target.
    const ir = await parsePlugin(pluginPathOrIdentifier);
    printIRSummary(ir);

    const portable = toPortableCore(ir);
    const targetName = options.target || 'agent-plugins';

    const outDir = options.out
      ? path.resolve(options.out)
      : path.resolve('./output');

    if (PORTABLE_TARGETS.has(targetName)) {
      await writePortableCore(portable, outDir);
      return;
    }

    const adapter = getAdapter(targetName);
    await writeConversion(portable, adapter, outDir);
  } catch (err: any) {
    console.error('Error converting plugin:', err);
    process.exit(1);
  }
}
