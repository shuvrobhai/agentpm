import { DocsEngine } from '../deploy/docs-engine.js';

export interface DocsCommandOptions {
  matrix?: boolean;
  json?: boolean;
}

export async function docsCommand(providerArg?: string, options?: DocsCommandOptions): Promise<void> {
  const docsEngine = new DocsEngine();
  const provider = providerArg?.toLowerCase();

  if (options?.json) {
    console.log(docsEngine.renderJson(provider));
    return;
  }

  if (options?.matrix || !provider) {
    console.log(docsEngine.renderMatrix());
    return;
  }

  console.log(docsEngine.renderProviderDocs(provider));
}
