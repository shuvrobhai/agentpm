import { ProviderTopology } from '../core/topology.js';
import type { ProviderInspectionItem } from '../core/topology.js';
export type InstalledItem = ProviderInspectionItem;

export async function inspectProviders(provider?: string) {
  return ProviderTopology.inspectProviders(provider);
}

/** @deprecated Use inspectProviders */
export class ProviderInspector {
  inspect(provider?: string): Promise<InstalledItem[]> {
    return inspectProviders(provider);
  }
}

