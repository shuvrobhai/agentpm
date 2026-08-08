import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { GlobalStore } from '../core/store.js';
import { validateCodexManifest } from '../core/codex-validator.js';

export interface DiagnosticIssue {
  type: 'broken_symlink' | 'schema_error' | 'dangling_marketplace_entry' | 'missing_target';
  agent: string;
  scope: 'global' | 'local';
  path: string;
  target?: string;
  message: string;
}

export interface DoctorReport {
  timestamp: string;
  healthy: boolean;
  totalChecks: number;
  activePlugins: { agent: string; scope: string; name: string; target: string }[];
  issues: DiagnosticIssue[];
  fixedIssues: string[];
}

export async function runDoctorDiagnostics(options?: { fix?: boolean | undefined }): Promise<DoctorReport> {
  const issues: DiagnosticIssue[] = [];
  const fixedIssues: string[] = [];
  const activePlugins: { agent: string; scope: string; name: string; target: string }[] = [];
  let totalChecks = 0;


  const checkDirs = [
    // Antigravity
    { agent: 'antigravity', scope: 'local' as const, dir: path.join(process.cwd(), '.agents', 'plugins') },
    { agent: 'antigravity', scope: 'global' as const, dir: path.join(os.homedir(), '.gemini', 'config', 'plugins') },
    // Claude Code
    { agent: 'claude-code', scope: 'local' as const, dir: path.join(process.cwd(), '.claude', 'plugins') },
    { agent: 'claude-code', scope: 'global' as const, dir: path.join(os.homedir(), '.claude', 'plugins') },
    // Codex
    { agent: 'codex', scope: 'local' as const, dir: path.join(process.cwd(), '.codex', 'plugins') },
    { agent: 'codex', scope: 'global' as const, dir: path.join(os.homedir(), '.codex', 'plugins') },
    // OpenCode
    { agent: 'opencode', scope: 'local' as const, dir: path.join(process.cwd(), '.opencode', 'plugins') },
    { agent: 'opencode', scope: 'global' as const, dir: path.join(os.homedir(), '.config', 'opencode', 'plugins') },
  ];

  for (const { agent, scope, dir } of checkDirs) {
    totalChecks++;
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        totalChecks++;
        const fullPath = path.join(dir, entry.name);
        try {
          const lstat = await fs.lstat(fullPath);
          if (lstat.isSymbolicLink()) {
            const rawTarget = await fs.readlink(fullPath);
            const resolvedTarget = path.isAbsolute(rawTarget) ? rawTarget : path.resolve(dir, rawTarget);
            const targetExists = await fs.access(resolvedTarget).then(() => true).catch(() => false);

            if (!targetExists) {
              issues.push({
                type: 'broken_symlink',
                agent,
                scope,
                path: fullPath,
                target: resolvedTarget,
                message: `Dangling symlink points to non-existent target: ${resolvedTarget}`,
              });

              if (options?.fix) {
                await fs.unlink(fullPath).catch(() => {});
                fixedIssues.push(`Removed broken symlink: ${fullPath}`);
              }
            } else {
              activePlugins.push({
                agent,
                scope,
                name: entry.name,
                target: resolvedTarget,
              });

              // Validate manifest if present
              const codexManifestPath = path.join(resolvedTarget, '.codex-plugin', 'plugin.json');
              const standardManifestPath = path.join(resolvedTarget, 'plugin.json');

              if (agent === 'codex') {
                try {
                  const raw = await fs.readFile(codexManifestPath, 'utf8');
                  const parsed = JSON.parse(raw);
                  const val = validateCodexManifest(parsed);
                  if (!val.valid) {
                    issues.push({
                      type: 'schema_error',
                      agent,
                      scope,
                      path: codexManifestPath,
                      message: `Codex manifest schema invalid: ${val.errors.join('; ')}`,
                    });
                  }
                } catch {
                  // manifest missing or invalid json
                }
              } else {
                const hasStandard = await fs.access(standardManifestPath).then(() => true).catch(() => false);
                if (!hasStandard) {
                  // checked
                }
              }
            }
          }
        } catch (err: any) {
          issues.push({
            type: 'missing_target',
            agent,
            scope,
            path: fullPath,
            message: `Could not inspect entry: ${err.message}`,
          });
        }
      }
    } catch {
      // directory does not exist, normal for uninitialized agents
    }
  }

  // 2. Validate Codex marketplace.json entries
  const marketplaceFiles = [
    { scope: 'local' as const, file: path.join(process.cwd(), '.agents', 'plugins', 'marketplace.json') },
    { scope: 'global' as const, file: path.join(os.homedir(), '.agents', 'plugins', 'marketplace.json') },
  ];

  for (const { scope, file } of marketplaceFiles) {
    totalChecks++;
    try {
      const raw = await fs.readFile(file, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.plugins)) {
        let changed = false;
        const validPlugins = [];
        for (const item of data.plugins) {
          totalChecks++;
          if (item.source && typeof item.source.path === 'string') {
            const resolvedPath = path.resolve(path.dirname(file), item.source.path);
            const exists = await fs.access(resolvedPath).then(() => true).catch(() => false);
            if (!exists) {
              issues.push({
                type: 'dangling_marketplace_entry',
                agent: 'codex',
                scope,
                path: file,
                target: resolvedPath,
                message: `Marketplace entry "${item.name}" points to non-existent folder: ${resolvedPath}`,
              });
              if (options?.fix) {
                changed = true;
                fixedIssues.push(`Cleaned dangling marketplace entry "${item.name}" from ${file}`);
                continue;
              }
            }
          }
          validPlugins.push(item);
        }
        if (changed) {
          data.plugins = validPlugins;
          await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
        }
      }
    } catch {
      // marketplace file does not exist
    }
  }


  return {
    timestamp: new Date().toISOString(),
    healthy: issues.length === 0,
    totalChecks,
    activePlugins,
    issues,
    fixedIssues,
  };
}

export async function doctorCommand(options: { fix?: boolean; json?: boolean }): Promise<void> {
  const report = await runDoctorDiagnostics({ fix: options.fix });

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log('\n🩺 AgentPlugins Doctor Diagnostic Report');
  console.log('────────────────────────────────────────');
  console.log(`Total System Checks: ${report.totalChecks}`);
  console.log(`Active Materialized Plugins: ${report.activePlugins.length}`);

  if (report.activePlugins.length > 0) {
    console.log('\n📦 Active Plugins by Provider:');
    for (const p of report.activePlugins) {
      console.log(`  • [${p.agent}] (${p.scope}) ${p.name} -> ${p.target}`);
    }
  }

  if (report.issues.length === 0) {
    console.log('\n✅ All plugin directories, manifests, and symlinks are healthy!\n');
    return;
  }

  console.log(`\n⚠️  Found ${report.issues.length} issue(s):`);
  for (const issue of report.issues) {
    console.log(`  ❌ [${issue.agent.toUpperCase()}] (${issue.scope}) ${issue.message}`);
    console.log(`     Path: ${issue.path}`);
  }

  if (report.fixedIssues.length > 0) {
    console.log('\n🛠️  Fixed Issues:');
    for (const fix of report.fixedIssues) {
      console.log(`  ✨ ${fix}`);
    }
  } else if (!options.fix) {
    console.log('\n💡 Tip: Run `plugins doctor --fix` to automatically clean up broken symlinks.\n');
  }
}
