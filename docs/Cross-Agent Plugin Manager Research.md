Feasibility and Architectural Analysis of Cross-Agent Plugin Management (agentpm)
Executive Summary and System Architecture
The rapid proliferation of specialized artificial intelligence coding agents—including Anthropic's Claude Code, OpenAI's Codex CLI, Google's Antigravity (which officially superseded Gemini CLI in June 2026), Anomaly's OpenCode, and Mario Zechner's Pi Coding Agent—has created severe fragmentation across software engineering workflows. While these agent platforms share the broad goal of automating software engineering tasks, each platform enforces a distinct extensibility paradigm, file directory layout, configuration schema, lifecycle hook model, and execution runtime. Engineering teams seeking to distribute standardized toolsets, coding rules, custom workflows, and Model Context Protocol (MCP) integrations across multiple agents currently face significant operational friction.
This research report evaluates the technical feasibility of building a unified, cross-agent plugin manager (tentatively named agentpm). Conceptually modeled after package managers like npm or skills.sh, agentpm aims to provide a canonical global store alongside an adapter layer to install, enable, configure, update, and remove plugins across heterogeneous coding agents.
The primary finding of this investigation is that a universal cross-agent plugin manager is partially feasible, bounded by a strict structural distinction between declarative extension assets and imperative runtime extensions:
Declarative Capabilities (Fully Portable): Assets defined by structured metadata, prompt instructions, and static schemas—specifically Agent Skills (SKILL.md), prompt templates, rules files, and stdio/SSE Model Context Protocol (MCP) server configurations—can be managed canonically and synthesized into target-specific configurations via an adapter layer.
Imperative Capabilities (Host-Bound): Capabilities requiring dynamic, in-process execution of language-specific code—such as OpenCode’s Bun/Node-based event plugins or Pi Agent’s TypeScript Extension API—cannot be natively adapted across agent boundaries without embedding heavy polyfill runtimes or process-isolated IPC bridges.
Building an effective cross-agent manager requires abandoning naive symlinking in favor of an active Synthesis and Adapter Layer Engine. This engine must translate canonical manifests into native formats, rewrite path references, canonicalize configuration schemas, and handle platform-specific symlink and cache behaviors.
Technical Evaluation of Target Agent Architectures
A successful cross-agent plugin manager requires an understanding of the extension models, directory structures, lifecycle hooks, and storage mechanisms of all target agents.
Agent
Extension Paradigm
Manifest Schema & Location
Storage & Precedence Paths
Symlink & Path Semantics
Lifecycle Hooks & Execution
Claude Code
Declarative Plugin Bundles
.claude-plugin/plugin.json at plugin root
Global: ~/.claude/plugins/ Workspace: .claude/skills/
Supports marketplace symlinks; resolves paths via ${CLAUDE_PLUGIN_ROOT}
Out-of-process hooks (shell, HTTP, MCP tools, agent verifiers)
OpenAI Codex CLI
Agent Plugins & Marketplaces
.codex-plugin/plugin.json
Cache: ~/.codex/plugins/cache/$MARKETPLACE/$PLUGIN/$VER/
Local materializer historically drops/skips source symlinks
External command execution via JSON hook definitions
Google Antigravity
Namespaced Bundles & Sparse Configs
plugin.json at bundle root
Global: ~/.gemini/config/ Workspace: .agents/skills/, .agents/rules/
Real-directory scanning across global and workspace trees
Script hooks (hooks.json); rules engines (Glob, Always On, Model Decision)
Gemini CLI (Legacy)
Legacy Extensions (Superseded)
gemini.json
Integrated into Antigravity migration layer
Legacy fallback imports mapped to Antigravity structures
Primitive prompt/command hooks
OpenCode
In-Process JS/TS Modules + Agent Skills
opencode.json (plugins array)
Global: ~/.config/opencode/plugins/ Workspace: .opencode/plugins/
In-process ESM/CJS module loading via Bun
Rich async runtime lifecycle events (session.created, tool.execute.before)
Pi Coding Agent
Pi Packages (TS Extensions & Skills)
package.json with "pi" field
Global: ~/.pi/agent/extensions/ Workspace: .pi/extensions/
Direct Node module imports; explicit trust verification
Event listeners via ExtensionAPI (session_start, custom slash commands)

Detailed Agent Capabilities and Mechanics
1. Claude Code
Claude Code structures extensibility around self-contained plugin directories with automatic component discovery. A plugin manifest located at .claude-plugin/plugin.json defines metadata, while component subdirectories—specifically skills/, commands/, agents/, hooks/, and .mcp.json—must reside at the plugin root level rather than inside the .claude-plugin/ folder.
Plugins can be installed globally or pointed to locally using the --plugin-dir flag. Claude Code also allows adding curated or community marketplaces using /plugin marketplace add. For path portability across plugin updates, Claude Code provides the ${CLAUDE_PLUGIN_ROOT} variable.
Hooks defined in hooks/hooks.json support multiple trigger formats, including shell commands, HTTP POST webhooks, MCP tool invocations, prompt evaluations, and agentic verifiers.
2. OpenAI Codex CLI
OpenAI Codex CLI manages extensibility through Agent Plugins, backed by local, personal, or remote marketplaces. Plugins contain a required manifest at .codex-plugin/plugin.json. When a plugin is installed, Codex copies its files into a cached directory structured as ~/.codex/plugins/cache/$MARKETPLACE_NAME/$PLUGIN_NAME[span_53](start_span)[span_53](end_span)[span_60](start_span)[span_60](end_span)/$VERSION/. Central discovery is maintained through ~/.agents/plugins/marketplace.json for personal scope or ./.agents/plugins/marketplace.json for workspace scope.
A critical architectural consideration for external package managers is Codex's local installation materializer (store.rs). In previous releases, its recursive directory copier handled only explicit directory and file types, dropping symlinks during installation. This broke marketplaces using symlinked skill libraries. Additionally, if a marketplace name matches a plugin name identically, path-flattening bugs can occur when reading skills.
For MCP servers declared in .mcp.json, relative working directories (cwd) resolve relative to the launch directory rather than the cached plugin root, making path resolution a key adapter requirement.
3. Google Antigravity
Google Antigravity officially superseded Gemini CLI as Google's primary terminal agent in June 2026. It organizes extensions into namespaced plugin bundles staged under ~/.gemini/antigravity-cli/plugins/<namespace>/<plugin>/. A bundle requires a plugin.json marker file at its root, accompanied by optional subdirectories for skills/, rules/, hooks.json, and mcp_config.json.
Antigravity scans global paths (~/.gemini/config/plugins/ and ~/.gemini/config/skills/) and workspace paths (.agents/skills/, .agents/rules/, .agents/plugins/). Its rules framework processes standalone Markdown files in rules/, assigning execution triggers like "Always On", "Model Decision", "Manual @mention", or file-matching "Glob" patterns.
Antigravity also includes a Terminal Sandbox that restricts local process execution via system sandbox boundaries (nsjail on Linux, sandbox-exec on macOS, AppContainer on Windows).
4. Gemini CLI (Legacy Context)
Gemini CLI served as Google's early open-source terminal agent harness. Extensions packaged commands, prompts, themes, sub-agents, and MCP configurations using a gemini.json manifest.
With the launch of Antigravity in June 2026, Gemini CLI was deprecated. Antigravity provides backward-compatibility migration tools to convert legacy gem[span_123](start_span)[span_123](end_span)ini.json configurations and .gemini/ directories into Antigravity's unified plugin layout.
5. OpenCode
OpenCode employs an in-process extensibility model using the Bun JavaScript/TypeScript runtime. Rather than shelling out to external processes, OpenCode loads plugins directly into its process context via the @opencode-ai/plugin SDK.
Plugins are configured in openc[span_145](start_span)[span_145](end_span)[span_151](start_span)[span_151](end_span)ode.json under the plugins array, or automatically discovered as direct JavaScript/TypeScript files inside .opencode/plugins/ (workspace) and ~/.config/opencode/plugins/ (global).
OpenCode plugins can intercept core lifecycle events (session.created, tool.execute.before, tui.command.execute), modify prompt context, register custom tools using Zod schemas, and alter model parameters on the fly.
For static capabilities, OpenCode natively implements the Agent Skills standard, scanning six distinct directory locations across project and global levels.
6. Pi Coding Agent
Pi Coding Agent (@mariozechner/pi-coding-agent) is a terminal coding harness built for customizable workflows. Extensibility is centered around "Pi Packages"—standard npm packages or repositories containing a package.json file with a dedicated "pi" field.
Local extensions reside in ~/.pi/agent/extensions/ or .pi/extensions/. Pi dynamically imports these TypeScript entry points into Node.js, passing an ExtensionAPI instance that allows extensions to register slash commands, listen to session events, or manage custom user prompts.
Pi enforces explicit workspace trust boundaries (~/.pi/agent/trust.json) before executing project-level extensions, safeguarding users against untrusted codebase scripts.
Evaluation of Existing Cross-Agent Infrastructure
Several tools and specifications have attempted to unify agent capabilities, offering valuable design insights for a multi-agent plugin manager.
skills.sh and npx skills
Developed by Vercel Labs, skills.sh serves as an open directory and command-line package manager designed exclusively for the Agent Skills standard.
Running npx skills add <repo> fetches a remote repository containing SKILL.md instruction files and deploys them to target agent skill folders, such as .agents/skills/ or ~/.agents/skills/.
skills.sh successfully establishes cross-agent portability for prompt-based workflows across more than 18 coding agents. However, it is fundamentally limited to static Markdown skills. It cannot install or manage complex plugins requiring executable binaries, custom event hooks, environment settings, dynamic MCP configurations, or TypeScript extension code.
Agent Plugins Specification (agentplugins)
The agentplugins project defines a vendor-neutral specification (v1.0.0) for packaging reusable agent components into distributable archives.
A compliant plugin consists of a directory containing a plugin.json manifest that conforms to the Agent Plugins JSON Schema, alongside a skills/ directory and optional MCP server definitions.
The specification focuses on static, declarative components (Skills + MCP) to ensure broad compatibility. It intentionally leaves runtime event execution, dynamic UI surfaces, and agent-specific hooks out of the core specification to avoid vendor lock-in.
Ecosystem Utilities
qvr (Quiver): A Git-native package manager for agent skills that enforces lockfile-first dependency management and content-hash drift detection.
SkillDock: A desktop application that scans local agent directories, provides Git-aware diff previews, and manages skills and MCP configurations across Claude Code, Cursor, Codex, and Windsurf.
ccmanager: A multi-agent session manager that coordinates auto-approvals and container isolation across Claude Code, Codex, Gemini CLI, and OpenCode.
Impedance Mismatches and Abstraction Challenges
Building a single, cross-agent plugin manager requires addressing key architectural differences between agent platforms.
1. Imperative vs. Declarative Runtime Paradigms
The main technical barrier to a unified plugin manager is the difference between declarative asset paradigms and imperative runtime execution models:
Declarative Agents (Claude Code, Codex CLI, Antigravity) parse JSON manifests, expose defined tools, and execute external scripts via controlled child processes or I/O channels. The host binary owns the event loop, state, and tool routing.
Imperative Agents (OpenCode, Pi Coding Agent) execute extension code directly inside their Node.js or Bun process. Extensions register callbacks, manipulate ASTs, alter stream buffers, and access internal SDK abstractions.
A plugin written for OpenCode that intercepts an active HTTP stream using Bun APIs cannot run natively within Claude Code or Antigravity, as neither agent exposes an in-process JavaScript runtime.
2. File System Resolution and Cache Staging
When agentpm installs a package globally to ~/.agentplugins/store/, exposing that package to local agents requires navigating different file system behaviors:
Claude Code supports symlinked marketplace paths and uses ${CLAUDE_PLUGIN_ROOT} for internal file resolution.
OpenAI Codex CLI copies files directly into ~/.codex/plugins/cache/ using a recursive file reader. Historically, this installer skipped symlinks, requiring absolute file copies or hard links.
Antigravity scans local directories (.agents/skills/) and uses an import_manifest.json file to track staged plugins.
As a result, agentpm cannot rely on a single file-linking strategy. Instead, it requires a Target-Specific Materialization Engine capable of choosing between atomic symlinking, hardlinking, or explicit directory copying based on the destination agent.
3. Lifecycle Event Models
Event hooks vary widely across platforms:
Claude Code executes hooks out-of-process using shell commands, POST webhooks, or sub-agent verifiers, passing context through environment variables and JSON payloads.
Antigravity uses a hooks.json schema to trigger shell scripts on specific events.
OpenCode provides programmatic async hooks (session.compacted, to[span_89](start_span)[span_89](end_span)[span_95](start_span)[span_95](end_span)ol.execute.before) using TypeScript functions.
Pi Coding Agent exposes an event emitter (pi.on("session_start")) directly within its process boundary.
Abstracting these event models requires agentpm to translate event declarations into target-native formats: generating shell wrappers for declarative agents and synthesizing TypeScript entry points for imperative agents.
4. MCP Transport and Path Expansion
While Model Context Protocol (MCP) is widely supported across modern coding agents, configuration schemas and path evaluation mechanics differ:
Configuration file locations vary: .mcp.json (Claude Code/Codex), mcp_config.json (Antigravity), and opencode.json (OpenCode).
Relative working directory (cwd) values inside Codex CLI's .mcp.json resolve relative to the active launch folder rather than the cached plugin root. agentpm must automatically expand relative paths to absolute target paths during installation to ensure portable server execution.
Proposed Architecture for agentpm
To support cross-agent compatibility, agentpm must function as an active Synthesis and Translation Engine rather than a passive symlink manager.
Canonical Package Format (CPF)
agentpm introduces the Canonical Package Format (CPF), extending the agent-plugins-spec standard. A CPF plugin package uses the following canonical structure:
agentpm.json: Central multi-agent manifest defining capabilities, versions, and target requirements.
skills/: Agent Skills standard compliant subdirectories containing SKILL.md instruction files.
rules/: Standardized Markdown rule files defining guidelines or glob-matched constraints.
agents/: Markdown sub-agent definitions detailing specialized roles and prompts.
hooks/: Declarative hooks.json specifying event triggers and associated script handlers.
mcp/: Standardized mcp.json declaring stdio and SSE MCP server entry points.
src/: Optional JavaScript or TypeScript source files for imperative runtime hooks.
Canonical Capabilities Mapping
CPF Capability
Claude Code Mapping
Codex CLI Mapping
Antigravity Mapping
OpenCode Mapping
Pi Agent Mapping
skills/
Synthesizes to .claude/skills/
Copies to cache skills/
Syncs to .agents/skills/
Copies to ~/.config/opencode/skills/
Registers via /skill: prefixing
mcp/
Writes to .claude-plugin/plugin.json
Injects into .mcp.json with expanded absolute paths
Rewrites to mcp_config.json
Injects into opencode.json
Configures via CLI execution wrapper
rules/
Appends to CLAUDE.md
Injects into AGENTS.md[span_253](start_span)[span_253](end_span)[span_256](start_span)[span_256](end_span)
Deploys to .agents/rules/ with frontmatter triggers
Appends to main opencode.json context
Injects into .pi/set[span_189](start_span)[span_189](end_span)tings.json
hooks/
Converts to hooks/hooks.json with ${CLAUDE_PLUGIN_ROOT}
Generates external process execution triggers
Converts to native hooks.json schema
Synthesizes @opencode-ai/plugin wrapper
Generates ExtensionAPI event listener
src/
Unsupported (Ignored)
Unsupported (Ignored)
Unsupported (Ignored)
Loaded natively via opencode.json
Loaded natively via Pi Package loader

Adapter Engine Mechanics per Target Agent
Claude Code Adapter
The agentpm Claude Code adapter processes CPF source files and outputs a compliant Claude Code plugin directory:
Creates a manifest at .claude-plugin/plugin.json containing metadata and mapped component paths.
Copies skills/, commands/, agents/, and hooks/ directly to ~/.claude/plugins/canonical-$PLUG[span_141](start_span)[span_141](end_span)IN/.
Transforms mcp/mcp.json[span_56](start_span)[span_56](end_span)[span_63](start_span)[span_63](end_span) into inline .mcp.json definitions, rewriting environment variable references.
Replaces local path references in shell hook scripts with the ${CLAUD[span_149](start_span)[span_149](end_span)[span_155](start_span)[span_155](end_span)E_PLUGIN_ROOT} variable.
OpenAI Codex CLI Adapter
The Codex CLI adapter handles installation while working around Codex's cache materialization behaviors:
Copies plugin assets directly into ~/.codex/plugins/cache/agen[span_112](start_span)[span_112](end_span)tpm/$PLUGIN_NAME/$VERSION/. 2. Dereferences all internal symlinks during staging to prevent the installer from skipping files.
Updates ~/.agents/plugins/marketpl[span_57](start_span)[span_57](end_span)[span_64](start_span)[span_64](end_span)ace.json with plugin metadata, local file paths, and explicit category declarations.
Expands relative working directory (cwd) paths in .mcp.json into absolute filesystem paths.
Google Antigravity Adapter
The Antigravity adapter targets Google's unified plugin staging environment:
Stages plugin bundles under ~/.gemini/antigravity-cli/plugins/agentpm/$PLUGIN_NAME/.
Generates a plugin.json marker file at the root.
Converts CPF rule files into Markdown documents under rules/, injecting frontmatter triggers (Always On, Glob, Model Decision).
Merges MCP server configurations into global ~/.gemini/config/mcp_config.json or workspace .agents/mcp_config.json files.
OpenCode Adapter
The OpenCode adapter provisions both static skills and imperative Node/Bun plugins:
Syncs static SKIL[span_40](start_span)[span_40](end_span)[span_46](start_span)[span_46](end_span)L.m[span_182](start_span)[span_182](end_span)d folders to ~/.config/opencode/skills/.
If the package contains imperative code (src/), installs dependencies using Bun and registers the entry point in ~/.config/opencode/opencode.json under the plugins array.
Merges MCP server definitions into opencode.json.
Pi Coding Agent Adapter
The Pi Agent adapter packages CPF components into a compliant Pi Package:
Synthesizes a package.json file containing a "pi" configuration block pointing to generated skills and extensions.
Places TypeScript extension entry points into ~/.pi/agent/ext[span_135](start_span)[span_135](end_span)ensions/.
Registers skills under the /skill: namespace prefix for interactive command auto-completion.
Recommendations and Feasibility Roadmap
To maximize adoption and technical feasibility, development of agentpm should proceed in three planned phases:
Phase 1: Declarative Capabilities Synchronization
Focus on cross-agent management for Agent Skills (SKILL.md), Rules files, and MCP server configurations.
Implement the Canonical Package Format parser alongside filesystem sync engines for Claude Code, Codex CLI, Antigravity, OpenCode, and Pi.
Add automated path expansion routines to rewrite relative paths into absolute paths, resolving MCP working directory issues across agents.
Phase 2: Hook Translation and Marketplace Integration
Build adapter modules that compile declarative hooks.json specifications into target-native shell scripts.
Integrate directly with target registration APIs, updating ~/.agents/plugins/marketplace.json for Codex CLI and opencode.json for OpenCode.
Build an atomic materialization engine that dereferences symlinks when installing to agents with strict directory copy requirements.
Phase 3: Runtime IPC Bridging for Imperative Code
Design a lightweight background daemon (agentpm-daemon) that exposes an IPC/gRPC interface over standard I/O.
Allow imperative TypeScript plugins (written for OpenCode or Pi) to register events with the daemon, enabling declarative agents (Claude Code, Antigravity) to query plugin state and trigger actions through standard MCP tools.
Conclusions
Building a unified cross-agent plugin manager (agentpm) across Claude Code, OpenAI Codex CLI, Google Antigravity, OpenCode, and Pi Coding Agent is technically feasible for declarative assets, which comprise the vast majority of developer extensions today.
By establishing a Canonical Package Format and an adapter layer, developers can author skills, coding rules, prompt workflows, and MCP configurations once, deploying them reliably across heterogeneous AI agents. While full cross-agent execution of in-process imperative code remains limited by differing runtime architectures, focusing on a declarative synthesis engine delivers immediate value to the multi-agent CLI ecosystem.
Works cited
1. Create plugins - Claude Code Docs, https://code.claude.com/docs/en/plugins 2. Plugins - OpenCode, https://opencode.ai/v2/docs/build/plugins 3. codex/codex-rs/skills/src/assets/samples/plugin-creator/references/plugin-json-spec.md at main - GitHub, https://github.com/openai/codex/blob/main/codex-rs/skills/src/assets/samples/plugin-creator/references/plugin-json-spec.md 4. Features - Google Antigravity Docs, https://antigravity.google/docs/cli/features 5. pi/packages/coding-agent/README.md at main · earendil-works/pi - GitHub, https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/README.md 6. Plugins - Google Antigravity Docs, https://antigravity.google/docs/plugins 7. MCP - Google Antigravity Docs, https://antigravity.google/docs/mcp 8. vercel-labs/skills: The open agent skills tool - npx skills - GitHub, https://github.com/vercel-labs/skills 9. Plugins reference - Claude Code Docs, https://code.claude.com/docs/en/plugins-reference 10. agentplugins/agent-plugins-spec - GitHub, https://github.com/agentplugins/agent-plugins-spec 11. 10 OpenCode Skills Worth Installing in 2026 - Firecrawl, https://www.firecrawl.dev/blog/best-opencode-skills 12. pi/packages/coding-agent/examples/extensions/commands.ts at main · earendil-works/pi, https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/examples/extensions/commands.ts 13. Plugin install: support symlinks per the cross-agent marketplace contract #24770 - GitHub, https://github.com/openai/codex/issues/24770 14. pi/packages/coding-agent/docs/settings.md at main · earendil-works/pi - GitHub, https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/settings.md?plain=1 15. claude-code/plugins/plugin-dev/skills/plugin-structure/SKILL.md at main - GitHub, https://github.com/anthropics/claude-code/blob/main/plugins/plugin-dev/skills/plugin-structure/SKILL.md 16. codex-plugin-cc/plugins/codex/commands/review.md at main - GitHub, https://github.com/openai/codex-plugin-cc/blob/main/plugins/codex/commands/review.md 17. codex/codex-rs/skills/src/assets/samples/plugin-creator/SKILL.md at main - GitHub, https://github.com/openai/codex/blob/main/codex-rs/skills/src/assets/samples/plugin-creator/SKILL.md 18. Codex flattens a valid plugin skill path and exposes internal recovery details · Issue #35648, https://github.com/openai/codex/issues/35648 19. Plugin cache install silently drops symlinks from local plugin sources #18863 - GitHub, https://github.com/openai/codex/issues/18863 20. Clarify/support plugin-root relative paths in plugin-provided .mcp.json · Issue #22842 · openai/codex - GitHub, https://github.com/openai/codex/issues/22842 21. Overview - Google Antigravity Docs, https://antigravity.google/docs/agent 22. Skills - Google Antigravity Docs, https://antigravity.google/docs/skills 23. Rules - Google Antigravity Docs, https://antigravity.google/docs/rules-workflows 24. gemini-cli/docs/extensions/releasing.md at main · google-gemini, https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/releasing.md 25. RFC: Agent Event Bus Pi Extension for Cross-Session Coordination · Issue #2714 - GitHub, https://github.com/badlogic/pi-mono/issues/2714 26. pi/packages/coding-agent/docs/rpc.md at main · earendil-works/pi - GitHub, https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/rpc.md 27. skills/skills/find-skills/SKILL.md at main · vercel-labs/skills - GitHub, https://github.com/vercel-labs/skills/blob/main/skills/find-skills/SKILL.md 28. [Bug]: "npx skills add" installs to ~/.agents/skills/ but does not create symlinks in ~/.claude/skills/ · Issue #744 · vercel-labs/skills - GitHub, https://github.com/vercel-labs/skills/issues/744 29. Agent Plugins - GitHub, https://github.com/agentplugins 30. README.md - agentplugins/agent-plugins-spec - GitHub, https://github.com/agentplugins/agent-plugins-spec/blob/main/README.md 31. skills-manager · GitHub Topics, https://github.com/topics/skills-manager?o=desc&s=updated 32. skill-manager · GitHub Topics, https://github.com/topics/skill-manager 33. rohitg00/awesome-claude-code-toolkit - GitHub, https://github.com/rohitg00/awesome-claude-code-toolkit 34. [FEATURE]: Support loading MCP configs from separate files (mcps/*.json) #10737 - GitHub, https://github.com/anomalyco/opencode/issues/10737 35. Explore the .claude directory - Claude Code Docs, https://code.claude.com/docs/en/claude-directory 36. claude-code/plugins/plugin-dev/skills/mcp-integration/SKILL.md at main - GitHub, https://github.com/anthropics/claude-code/blob/main/plugins/plugin-dev/skills/mcp-integration/SKILL.md?plain=1
