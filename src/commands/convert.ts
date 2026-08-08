import path from 'node:path';
import { Acquirer } from '../core/acquirer.js';
import { printIRSummary } from '../parser/index.js';

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
    const outDir = options.out
      ? path.resolve(options.out)
      : path.resolve('./output');

    const result = await Acquirer.convertSource(
      pluginPathOrIdentifier,
      options.target,
      outDir
    );

    printIRSummary(result.ir);
  } catch (err: unknown) {
    console.error('Error converting plugin:', err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}
