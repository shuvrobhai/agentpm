import { Acquirer } from '../core/acquirer.js';
import { printIRSummary } from '../parser/index.js';

export interface InspectCommandOptions {
  json?: boolean;
}

export async function inspectCommand(source: string, options: InspectCommandOptions): Promise<void> {
  try {
    const result = await Acquirer.inspectSource(source);

    if (options.json) {
      console.log(JSON.stringify(result.ir, null, 2));
      return;
    }

    printIRSummary(result.ir);
  } catch (err: unknown) {
    console.error('Error inspecting plugin:', err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}
