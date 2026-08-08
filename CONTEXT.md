# Domain Glossary

- **agentpm**: The Universal Agent Extension Manager. A CLI tool that manages composite packages containing declarative capabilities and host-specific implementations for various AI coding agents.
- **Declarative Capabilities**: Portable configuration like `SKILL.md` or static MCP config that does not require host-specific execution logic.
- **Adapter**: A target-agent-specific module within `agentpm` that handles materialization (e.g., symlinking, copying, or config mutation) of a package's capabilities for that specific agent (e.g., Claude Code, Antigravity).
- **Global Store**: The canonical local storage location for downloaded plugins (e.g., `~/.agentplugins/plugins/`).
- **Materialization**: The process by which `agentpm` makes a package available to a target agent, either through symlinking, copying files, or mutating the agent's configuration files.
- **Namespace**: A grouping mechanism for packages (usually a GitHub username or org) to prevent name collisions in the global store.
- **Versioned Subdirectories**: The structure in the global store where each plugin version gets its own folder (`<namespace>/<plugin-name>/<version>/`) to allow multiple versions to coexist.
- **Symlink Materialization**: A technique where `agentpm` adapters create symlinks in the target agent's specific directories pointing to the global store, allowing zero-copy sharing and live updates.
- **Dematerialize-on-Uninstall**: Safety mechanism where `agentpm uninstall` detects and unlinks all active workspace/global symlinks pointing to a package before removing its files from the global store.
- **Package Inspection**: The process by which `agentpm info` scans and parses declarative manifests (`plugin.json`, `SKILL.md`) to report capabilities and target agent compatibility without executing code.
- **Plugin Conversion Engine**: The pipeline (`PluginConverter`) that translates vendor-specific variable placeholders (`${CLAUDE_PLUGIN_ROOT}` → `${PLUGIN_ROOT}`), memory references (`CLAUDE.md` → `AGENTS.md`), and relative MCP working paths into agent-agnostic specs.
- **Staged Adapted Store**: The local store location (`~/.agentplugins/adapted/`) where converted plugin packages are staged for target host adapters prior to materialization.
- **Open Canonical Format**: The vendor-agnostic standardized package layout stored in `~/.agentplugins/plugins/` containing unified `plugin.json`, `skills/`, `rules/`, `AGENTS.md`, `mcp_config.json`, and `hooks.json`.
- **Workspace Materialization Priority**: The paradigm where `agentpm enable` materializes plugins directly into `.agents/plugins/<plugin-name>` (or `.agents/skills/`) for Google Antigravity without placing any `agentpm` tool files inside project workspaces.
- **Adapter Version Resolution**: The capability of an `AgentAdapter` to automatically resolve the target version of an adapted plugin from local adapted or global storage when unspecified by the CLI caller.
- **Adapter Directory Encapsulation**: The architectural boundary where each target agent adapter owns the precise directory structure (`getPluginDir`, `getLocalPluginDir`) for storing and staging adapted plugin packages.
- **Workspace-First Local Conversion**: The resolution strategy where `agentpm convert` outputs local conversions to the target adapter's local workspace directory (`getLocalPluginDir`), allowing `agentpm enable` to materialize directly from workspace files without requiring a global store installation.
