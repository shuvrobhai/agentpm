# Domain Glossary

- **agentpm**: The Universal Agent Extension Manager. A CLI tool that manages composite packages containing declarative capabilities and host-specific implementations for various AI coding agents.
- **Declarative Capabilities**: Portable configuration like `SKILL.md` or static MCP config that does not require host-specific execution logic.
- **Adapter**: A target-agent-specific module within `agentpm` that handles materialization (e.g., symlinking, copying, or config mutation) of a package's capabilities for that specific agent (e.g., Claude Code, Antigravity).
- **Global Store**: The canonical local storage location for downloaded plugins (e.g., `~/.agentplugins/plugins/`).
- **Materialization**: The process by which `agentpm` makes a package available to a target agent, either through symlinking, copying files, or mutating the agent's configuration files.
- **Namespace**: A grouping mechanism for packages (usually a GitHub username or org) to prevent name collisions in the global store.
- **Versioned Subdirectories**: The structure in the global store where each plugin version gets its own folder (`<namespace>/<plugin-name>/<version>/`) to allow multiple versions to coexist.
- **Symlink Materialization**: A technique where `agentpm` adapters create symlinks in the target agent's specific directories pointing to the global store, allowing zero-copy sharing and live updates.
