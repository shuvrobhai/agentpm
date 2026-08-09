import path from 'node:path';
import { Acquirer } from '../core/acquirer.js';
import { printIRSummary } from '../parser/index.js';

export interface ConvertCommandOptions {
  target?: string;
  to?: string;
  from?: string;
  out?: string;
  memory?: string;
  varPrefix?: string;
  dryRun?: boolean;
}

export async function convertCommand(
  pluginPathOrIdentifier: string,
  options: ConvertCommandOptions
): Promise<void> {
  try {
    const targetAdapter = options.to || options.target || 'agent-plugins';
    const outDir = options.out
      ? path.resolve(options.out)
      : path.resolve('./output');

    if (options.dryRun) {
      console.log(`\n[Dry-run mode] Converting plugin source: "${pluginPathOrIdentifier}" -> target "${targetAdapter}"`);
      console.log(`Output path (skipped write): ${outDir}\n`);
      return;
    }

    const result = await Acquirer.convertSource(
      pluginPathOrIdentifier,
      targetAdapter,
      outDir
    );

    printIRSummary(result.ir);
  } catch (err: unknown) {
    console.error('Error converting plugin:', err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}
