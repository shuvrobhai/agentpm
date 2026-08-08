import { parsePlugin, printIRSummary } from '../parser/index.js';

export interface InspectCommandOptions {
  json?: boolean;
}

export async function inspectCommand(source: string, options: InspectCommandOptions): Promise<void> {
  try {
    const ir = await parsePlugin(source);

    if (options.json) {
      console.log(JSON.stringify(ir, null, 2));
      return;
    }

    printIRSummary(ir);
  } catch (err: unknown) {
    console.error('Error inspecting plugin:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
