# 18. SemVer Version Sorting for Latest Resolution

- Status: Accepted
- Date: 2026-08-10

## Context and Problem Statement

When resolving requested plugin versions with `version = 'latest'`, `GlobalStore.findPluginPath()` previously picked `validVersions[0]` directly from `fs.readdir()`.

Because directory listings return strings in unsorted or ASCII alphabetical order, raw string sorting misorders version strings (e.g. `"v1.2.0"` sorts after `"v1.10.0"` alphabetically). This led to older versions being selected as `latest`.

## Decision Drivers

- **Semantic Versioning Integrity**: `latest` must reliably resolve to the highest valid SemVer release tag according to `semver` specification rules.
- **Branch Tag Compatibility**: Non-SemVer branch folders (`main`, `master`, `latest`) should remain accessible when explicitly requested or as fallbacks when no SemVer tag exists.

## Considered Options

1. **Unsorted First-Match (`validVersions[0]`) (Previous Behavior)**: Take the first entry returned by `fs.readdir()`.
   - *Trade-off*: Unpredictable and non-deterministic across OS filesystems.
2. **Semantic Version Sorting (`semver.rcompare`) [Chosen]**: Parse available version entries with SemVer rules, filter out dotfiles, sort valid SemVer tags descending using `semver.rcompare`, and fall back to branch names (`main`/`master`) only if no valid SemVer tag exists.

## Decision Outcome

Chosen option: **"Semantic Version Sorting (`semver.rcompare`)"**, ensuring that `'latest'` resolution accurately resolves the highest semantic release version across all store queries.
