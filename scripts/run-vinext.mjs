// Set the log path without relying on POSIX shell environment assignments.
// Keep the CLI in this process so arguments, Ctrl+C and exit codes are preserved.
process.env.WRANGLER_LOG_PATH = ".wrangler/wrangler.log";
await import("../node_modules/vinext/dist/cli.js");
