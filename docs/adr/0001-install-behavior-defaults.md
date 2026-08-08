# 1. Default Install Behavior is 'Install Only'

- Status: Accepted
- Date: 2026-08-08

## Context and Problem Statement
When a user runs `agentpm install user/repo`, the tool needs to decide whether to simply download the package into the global store or to automatically enable/materialize it for detected AI agents on the system.

## Decision Drivers
- Security: Automatically enabling plugins for all agents might inadvertently expose capabilities or trigger multiple security warnings.
- Predictability: Users should understand what a command does without side-effects in host agent configurations.
- Scripting: Non-interactive CI environments need a predictable installation step.

## Considered Options
1. Install Only (Chosen)
2. Install & Enable Globally
3. Install & Interactive Prompt

## Decision Outcome
Chosen option: "Install Only", because it provides a secure and explicit workflow. The package is downloaded to the global store (`~/.agentplugins/plugins/`), but no host agent configurations are mutated until the user explicitly runs `agentpm enable <plugin>`.
