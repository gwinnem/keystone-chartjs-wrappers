# Security Policy

## Supported versions

Only the latest published version of each package is actively supported.
Older versions receive no security fixes.

| Package | Supported |
|---|---|
| `keystone-chartjs-vue` (latest) | ✅ |
| `keystone-chartjs-react` (latest) | ✅ |
| `keystone-chartjs-angular` (latest) | ✅ |
| Any older version | ❌ |

## Reporting a vulnerability

**Please do not report security vulnerabilities via public GitHub issues.**

Report a vulnerability privately via GitHub's own
[Security Advisories](https://github.com/gwinnem/keystone-chartjs-wrappers/security/advisories/new)
feature, or by emailing **geirr@winnem.tech** directly.

Please include:

- A clear description of the vulnerability.
- Steps to reproduce, or a minimal proof-of-concept if available.
- The affected package(s) and version(s).
- Any potential impact you've identified.

## Response time

You can expect an acknowledgment within **5 business days** and a status
update (confirmed, not applicable, or resolved) within **14 business days**.

## Scope

This policy covers the published packages in this repository
(`keystone-chartjs-vue`, `keystone-chartjs-react`,
`keystone-chartjs-angular`). Vulnerabilities in upstream dependencies
(Chart.js, Vue, React, Angular, and the ecosystem extension packages) should
be reported directly to those projects. We will upgrade affected dependencies
promptly once upstream fixes are published.
