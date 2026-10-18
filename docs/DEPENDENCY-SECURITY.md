# Dependency security

`npm run audit:production` rejects all moderate, high, and critical findings in runtime dependencies. `npm run audit:tooling` rejects unreviewed high and critical findings across the complete lockfile and fails if the registry audit is unavailable.

## Temporary development-only exception

- Advisory: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), stack exhaustion in deeply nested brace patterns.
- Reviewed version: `braces@3.0.3`; upstream has no published patched version as of October 18, 2026.
- Exposure: repository glob processing in ESLint and Vinext through `micromatch` and `fast-glob`. These packages are development dependencies and are absent from the production dependency tree. Orbit does not pass document contents or model input to these glob processors.
- Precaution: run development tooling on trusted checkouts and configurations. The exception does not authorize processing attacker-supplied glob patterns.
- Review deadline: **November 17, 2026**. The audit check rejects this finding from that date until the dependency is patched or the risk is reviewed again.

The check accepts only this advisory, this installed version, and the named development dependency chains in `scripts/audit-tooling.mjs`. New advisories, production reachability, missing lockfile entries, and expired reviews fail the check. Its regression tests cover those boundaries. Remove the exception when an upstream fix is available.
