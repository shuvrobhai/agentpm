import { AdapterRegistry, type DiagnosticIssue } from '../adapters/index.js';

export type { DiagnosticIssue };

export interface DoctorReport {
  timestamp: string;
  healthy: boolean;
  totalChecks: number;
  activePlugins: { agent: string; scope: string; name: string; target: string }[];
  issues: DiagnosticIssue[];
  fixedIssues: string[];
}

export async function runDoctorDiagnostics(options?: { fix?: boolean | undefined }): Promise<DoctorReport> {
  const fix = options?.fix !== undefined ? { fix: options.fix } : undefined;
  const health = await AdapterRegistry.checkHealth(fix);
  return {
    timestamp: health.timestamp,
    healthy: health.healthy,
    totalChecks: health.totalChecks,
    activePlugins: health.activePlugins,
    issues: health.issues,
    fixedIssues: health.fixedIssues,
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
