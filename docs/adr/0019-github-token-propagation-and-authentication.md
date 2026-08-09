# 19. GitHub Token Propagation and Authentication

- Status: Accepted
- Date: 2026-08-10

## Context and Problem Statement

`plugins find` queries GitHub's REST search API, and `Acquirer` fetches repositories from GitHub. Unauthenticated requests are limited to 60 requests per hour per IP address, causing API throttling for active users. Private repositories also fail to clone without token propagation.

## Decision Drivers

- **Rate Limit Resilience**: Prevent API rate limiting failures during discovery and package acquisition.
- **Private Repository Support**: Support seamless installation of private organization and personal agent plugins.
- **Zero-Config Overhead**: Utilize standard developer environment variables (`GITHUB_TOKEN`, `GH_TOKEN`) without introducing custom config files.

## Considered Options

1. **Unauthenticated REST API Calls (Previous Behavior)**: Send requests without authorization headers.
   - *Trade-off*: Throttled at 60 req/hr; fails on private repos.
2. **Environment Token Propagation (`GITHUB_TOKEN` / `GH_TOKEN`) [Chosen]**: Detect `process.env.GITHUB_TOKEN` or `process.env.GH_TOKEN`. Automatically attach `Authorization: Bearer <token>` to REST API headers and inject credentials into Git clone environments when fetching private repositories.

## Decision Outcome

Chosen option: **"Environment Token Propagation (`GITHUB_TOKEN` / `GH_TOKEN`)"**, ensuring rate-limit immunity and full private repository compatibility.
