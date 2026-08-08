import { GlobalStore } from '../core/store.js';

export async function installCommand(repo: string, options: { global?: boolean }): Promise<void> {
  console.log(`Installing package from ${repo}...`);
  // For MVP: Download to global store without enabling (per ADR 0001)
  console.log(`Package ${repo} downloaded to ${GlobalStore.getStorePath()}`);
  console.log(`Run 'agentpm enable <plugin>' to activate it for your agent.`);
}
