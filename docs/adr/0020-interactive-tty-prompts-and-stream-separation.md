# 20. Interactive TTY Prompts and Unix Stream Separation

- Status: Accepted
- Date: 2026-08-10

## Context and Problem Statement

Commands like `plugins remove` or `plugins enable` previously printed static log strings when required positional arguments were omitted. Additionally, progress banners and status notices were logged to `stdout`, corrupting piped outputs (e.g. `plugins list --json | jq .`).

## Decision Drivers

- **Human-First, Machine-Ready UX**: Human interactive sessions should be intuitive and helpful; automated script/CI sessions must produce clean, parseable data stream outputs.
- **Terminal Composability**: Adhere to Unix terminal standards by isolating diagnostics to `stderr` and data payloads to `stdout`.

## Considered Options

1. **Static Error Logs on Missing Arguments (Previous Behavior)**: Print static text to `stdout` and exit.
   - *Trade-off*: Clunky UX for interactive terminal users; pollutes `stdout`.
2. **Interactive TTY Prompts & Strict Stream Separation [Chosen]**: 
   - When required arguments are omitted in interactive TTY environments (`process.stdin.isTTY === true`), invoke interactive selection prompts via `@clack/prompts`.
   - In non-TTY environments (CI/scripts), fail cleanly with usage instructions and exit code `1`.
   - Direct all human-readable diagnostic messages, spinners, and progress headers to `stderr`, leaving `stdout` dedicated strictly to data payloads (JSON, raw output).

## Decision Outcome

Chosen option: **"Interactive TTY Prompts & Strict Stream Separation"**, elevating terminal UX for human users while guaranteeing composability for shell automation and scripts.
