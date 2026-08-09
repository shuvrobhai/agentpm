import { ProviderTopology } from '../core/topology.js';

export interface ProvidersCommandOptions {
  provider?: string;
}

export async function providersCommand(options: ProvidersCommandOptions): Promise<void> {
  console.log('\n=== Direct Provider Target Inspection ===\n');
  await ProviderTopology.inspectProviders(options.provider);
}
