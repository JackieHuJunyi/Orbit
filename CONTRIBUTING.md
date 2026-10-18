# Contributing to Orbit

Thanks for helping improve Orbit. Open an issue first for substantial changes so we can agree on the user task and expected behavior.

## Development

Use Node.js 22.13+ and run `npm ci` from the repository root. Start the desktop app with `npm run desktop:dev`, or the browser development server with `npm run dev`.

Before opening a pull request, run:

```bash
npm test
npm run lint
npm run typecheck
npm run format:check
```

Run `npm run test:e2e` when changing the workbench or preview. Keep changes focused, explain the user-visible behavior, and update documentation when a capability changes. The [architecture](docs/ARCHITECTURE.md) and [decision records](docs/decisions/) describe Orbit's source, review, and persistence boundaries.

Do not include real customer files, credentials, or private pilot evidence in issues or pull requests. Use synthetic examples instead.
