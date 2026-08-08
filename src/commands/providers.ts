import { ProviderInspector } from '../deploy/provider-inspector.js';

export interface ProvidersCommandOptions {
  provider?: string;
}

export async function providersCommand(options: ProvidersCommandOptions): Promise<void> {
  console.log('\n=== Direct Provider Target Inspection ===\n');
  const inspector = new ProviderInspector();
  await inspector.inspect(options.provider);
}
