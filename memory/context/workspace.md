# Workspace Context

## System & Environment
- **OS**: Mac
- **Target Runtime**: Node.js (ESM / NodeNext)
- **Language**: TypeScript 5+

## Code Conventions
- Imports: Standard library modules must use the `node:` prefix (e.g. `import path from 'node:path'`).
- Local relative imports: Must include explicit `.js` extensions (e.g. `import { GlobalStore } from '../core/store.js'`).
- Command Error Handling: Wrap async handlers in try/catch and set `process.exitCode = 1` on error.
- Path Isolation: Validate all inputs against path traversal using `GlobalStore.validatePathComponent`.

## Verification Commands
- `npm run build`
- `npx tsx src/index.ts --help`
