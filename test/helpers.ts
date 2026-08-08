import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { before, after } from 'node:test';

let storeRoot: string | undefined;

/**
 * Redirects AGENTPM_STORE / AGENTPM_CACHE to a throwaway temp dir for the
 * whole test file and removes it afterwards, so tests never write into the
 * user's real ~/.agentplugins store.
 */
export function isolateAgentStore(): void {
  before(async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'agentpm-test-store-'));
    storeRoot = base;
    process.env.AGENTPM_STORE = path.join(base, 'store');
    process.env.AGENTPM_CACHE = path.join(base, 'cache');
  });
  after(async () => {
    if (storeRoot) await fs.rm(storeRoot, { recursive: true, force: true });
  });
}
