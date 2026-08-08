# Glossary

Workplace shorthand, domain terminology, and project concepts for `agentpm`.

## Acronyms & Core Terms
| Term | Meaning | Context |
|------|---------|---------|
| **agentpm** | Universal Agent Extension Manager | CLI tool & package manager for AI agent plugins |
| **ADR** | Architectural Decision Record | Design decision documentation in `docs/adr/` |
| **ESM** | ECMAScript Modules | Module system used (`type: module` in `package.json`) |
| **MCP** | Model Context Protocol | Specification for tool & resource integration |

## Domain Terminology
| Term | Meaning |
|------|---------|
| **Declarative Capabilities** | Static skills (`SKILL.md`) and MCP configs that don't require custom binary execution |
| **Adapter** | Host-agent integration layer (e.g., `AntigravityAdapter`, `ClaudeCodeAdapter`) |
| **Global Store** | Canonical local storage where installed raw plugins live (`~/.agentplugins/plugins/`) |
| **Staged Adapted Store** | Local storage location where converted plugins live (`~/.agentplugins/adapted/`) |
| **Plugin Conversion Engine** | Pipeline (`PluginConverter`) translating vendor paths, variable placeholders, and memory references |
| **Materialization** | Symlinking or linking global/adapted store plugin files into target agent skill directories |
| **Dematerialization** | Safely removing target symlinks during uninstallation or disabling |
| **Namespace** | GitHub org/user owner name for plugin packages (e.g., `octocat/Hello-World`) |
| **Versioned Subdirectory** | Path pattern `<namespace>/<plugin-name>/<version>/` inside global store |
| **Package Inspection** | Scans and parses `plugin.json` or `SKILL.md` manifests without code execution |
