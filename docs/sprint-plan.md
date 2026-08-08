# Sprint Plan: `agentpm` Hardening & Adapter MVP

- **Sprint Goal:** Secure `agentpm` against critical vulnerabilities (path traversal & flag injection) and establish real materialization in `AntigravityAdapter`.
- **Target Completion:** 5 Days / 9 Points

---

## 1. Capacity & Allocation

| Person | Available Days | Allocation | Notes |
|--------|---------------|------------|-------|
| Pair (User + AI) | 5 Days | 9 Points | Focused on security hardening & MVP materialization |
| **Total** | **5 Days** | **9 Points** | Buffer reserved for testing edge cases |

---

## 2. Sprint Backlog

| Priority | Category | Item | Estimate | Owner | Dependencies |
|----------|----------|------|----------|-------|--------------|
| **P0** | Security | **SEC-01**: Sanitize `namespace` & `pluginName` against Path Traversal (`src/core/store.ts`) | 1 pt | Pair | None |
| **P0** | Security | **SEC-02**: Validate `ref` to prevent Git flag injection (`src/core/fetcher.ts`) | 1 pt | Pair | None |
| **P0** | Correctness | **BUG-01**: Support commit SHAs in `downloadPlugin` without `git clone --branch` error (`src/core/fetcher.ts`) | 1 pt | Pair | SEC-02 |
| **P1** | Edge Case | **BUG-02**: Handle trailing slashes in repository URLs in `parseRepoIdentifier` (`src/core/store.ts`) | 1 pt | Pair | SEC-01 |
| **P1** | Error Handling | **ERR-01**: Wrap `enableCommand` in `try/catch` block (`src/commands/enable.ts`) | 1 pt | Pair | None |
| **P2** | Feature | **FEAT-01**: Real `.agents` symlinking & detection in `AntigravityAdapter` (`src/adapters/antigravity.ts`) | 2 pts | Pair | P0 Items |
| **P2** | Feature | **FEAT-02**: Real `.claudecode` symlinking in `ClaudeCodeAdapter` (`src/adapters/claudecode.ts`) | 2 pts | Pair | FEAT-01 |

---

## 3. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Path traversal check too restrictive | Valid GitHub org names rejected | Use standard alphanumeric regex (`/^[a-zA-Z0-9_.-]+$/`) |
| Commit SHA shallow clone fails | Partial clones missing ref | Perform shallow clone first, then `git checkout <sha>` if ref is 40-char SHA |
| Windows symlink permissions | `fs.symlink` fails on non-admin Windows | Test junction points or copy fallback if symlink fails |

---

## 4. Definition of Done
- [ ] All P0 critical security issues resolved and verified with tests
- [ ] No regression on `agentpm install` or `agentpm enable`
- [ ] `npm run build` (`tsc`) passes cleanly without warnings
- [ ] Code committed to Git repository

---

## 5. Execution Timeline

- **Day 1**: Implement P0 Security fixes (SEC-01, SEC-02) and BUG-01.
- **Day 2**: Implement P1 Robustness fixes (BUG-02, ERR-01).
- **Day 3-4**: Implement FEAT-01 (`AntigravityAdapter` real symlinking logic).
- **Day 5**: Implement FEAT-02 (`ClaudeCodeAdapter`), verify end-to-end flow.
