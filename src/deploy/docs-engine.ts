import { getProviderSpec, PROVIDER_SPECS, type ProviderSpec } from './provider-specs.js';

export class DocsEngine {
  public renderMatrix(): string {
    const rows = PROVIDER_SPECS.map(s => ({
      id: s.id,
      targetPath: s.targetPath,
      skills: s.supportedComponents.skill ? '✔' : '✖',
      rules: s.supportedComponents.rule ? '✔' : '✖',
      hooks: s.supportedComponents.hook ? '✔' : '✖',
      mcp: s.supportedComponents.mcp_server ? '✔' : '✖',
      url: s.officialDocUrl,
    }));

    const colWidths = {
      id: Math.max(...rows.map(r => r.id.length), 8),
      targetPath: Math.max(...rows.map(r => r.targetPath.length), 12),
      skills: 6,
      rules: 5,
      hooks: 5,
      mcp: 5,
    };

    const sep = (w: number) => '-'.repeat(w);
    const hdr = (val: string, w: number) => val.padEnd(w);

    let output = '\n=== Multi-Provider Plugin Capability Matrix ===\n\n';
    output += `${hdr('Provider', colWidths.id)} | ${hdr('Target Path', colWidths.targetPath)} | ${hdr('Skills', colWidths.skills)} | ${hdr('Rules', colWidths.rules)} | ${hdr('Hooks', colWidths.hooks)} | ${hdr('MCP', colWidths.mcp)} | Official Doc Link\n`;
    output += `${sep(colWidths.id)}-+-${sep(colWidths.targetPath)}-+-${sep(colWidths.skills)}-+-${sep(colWidths.rules)}-+-${sep(colWidths.hooks)}-+-${sep(colWidths.mcp)}-+-${'-'.repeat(35)}\n`;

    for (const r of rows) {
      output += `${hdr(r.id, colWidths.id)} | ${hdr(r.targetPath, colWidths.targetPath)} | ${hdr(r.skills, colWidths.skills)} | ${hdr(r.rules, colWidths.rules)} | ${hdr(r.hooks, colWidths.hooks)} | ${hdr(r.mcp, colWidths.mcp)} | ${r.url}\n`;
    }

    output += '\nRun "plugins docs <provider>" for detailed provider specs.\n';
    return output;
  }

  public renderProviderDocs(provider: string): string {
    const spec = this.getSpec(provider);
    if (!spec) {
      return `[ERROR] Provider "${provider}" not found. Available providers: ${PROVIDER_SPECS.map(s => s.id).join(', ')}.`;
    }

    let output = `\n==================================================\n`;
    output += ` Provider Knowledge Base: ${spec.displayName} (${spec.id})\n`;
    output += `==================================================\n\n`;
    output += `Description: ${spec.description}\n`;
    output += `Target Installation Path: ${spec.targetPath}\n`;
    output += `Official Documentation: ${spec.officialDocUrl}\n\n`;

    output += `Supported Plugin Components:\n`;
    for (const [comp, supported] of Object.entries(spec.supportedComponents)) {
      output += `  - ${comp.padEnd(12)}: ${supported ? '✔ Supported' : '✖ Not supported'}\n`;
    }

    output += `\nManifest Requirements:\n  ${spec.manifestRequirements}\n`;

    output += `\nConfiguration Files Touched:\n`;
    for (const file of spec.configFiles) {
      output += `  - ${file}\n`;
    }

    output += `\nImplementation Notes:\n`;
    for (const note of spec.notes) {
      output += `  - ${note}\n`;
    }

    output += `\n`;
    return output;
  }

  public renderJson(provider?: string): string {
    if (provider) {
      const spec = this.getSpec(provider);
      return JSON.stringify(spec || { error: `Provider "${provider}" not found` }, null, 2);
    }
    return JSON.stringify(PROVIDER_SPECS, null, 2);
  }

  public getSpec(provider: string): ProviderSpec | undefined {
    return getProviderSpec(provider.toLowerCase());
  }
}
