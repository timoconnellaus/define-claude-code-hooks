# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript library that provides type-safe hook definitions for Claude Code with automatic settings management. It allows users to define hooks that run at various points in Claude Code's lifecycle without manually editing settings.json files.

## Build Commands

```bash
# Build the TypeScript project
bun run build

# Watch mode for development
bun run dev

# Install dependencies
bun install
```

## Architecture

### Key Concepts

1. **Self-Executing Hooks**: Hook files act as both the hook definition and the runner. When `defineHooks` is called, it checks if it's being run as a CLI and handles two modes:

   - `__generate_settings`: Outputs JSON information about defined hooks
   - `__run_hook`: Executes the appropriate hook handler

2. **No Separate Runner**: Unlike traditional approaches, there's no separate runner.js. The hooks file itself is executed directly by the generated commands in settings.json.

3. **Smart Settings Generation**: The CLI only creates settings entries for hooks that are actually defined:
   - For PreToolUse/PostToolUse: One entry per matcher
   - For other hooks (Stop, Notification, SubagentStop): One entry only if handlers exist

4. **Multiple Hook Files**: The system supports three different hook files, all located in `.claude/hooks/`:
   - `hooks.ts` - Project hooks (updates `.claude/settings.json`)
   - `hooks.local.ts` - Local hooks (updates `.claude/settings.local.json`)
   - `hooks.user.ts` - User hooks (updates `~/.claude/settings.json`)
   
   The CLI automatically detects which files exist and updates the corresponding settings files.

### Core Components

- **src/index.ts**: Exports `defineHooks` and `defineHook` functions. Contains the self-execution logic that makes hooks files act as their own runners.

- **src/cli.ts**: The CLI that updates settings.json files. It automatically detects which hook files exist (hooks.ts, hooks.local.ts, hooks.user.ts) and updates the corresponding settings files.

- **src/types.ts**: TypeScript type definitions for all hook types, inputs, and outputs. Key distinction between tool hooks (PreToolUse/PostToolUse) that have matchers and non-tool hooks.

- **src/hooks/**: Predefined hook utilities for common logging scenarios (logToolUseEvents, logStopEvents, logNotificationEvents)

### Hook Definition Structure

Tool hooks (PreToolUse/PostToolUse):

```typescript
{
  matcher: string,  // Regex pattern for tool names
  handler: async (input) => { /* ... */ }
}
```

Non-tool hooks (Stop, Notification, SubagentStop):

```typescript
async (input) => {
  /* ... */
};
```

### Settings.json Generation

The CLI removes all hooks marked with `__managed_by_define_claude_code_hooks__` and regenerates them based on what's defined in the hooks file. Commands are generated in the format:

```json
{
  "command": "node -r ts-node/register --no-warnings /path/to/hooks.ts __run_hook PreToolUse \"Bash\" \"0\" # __managed_by_define_claude_code_hooks__"
}
```

## Development Notes

- TypeScript compilation outputs to the `dist/` directory
- The CLI binary is defined in package.json as `define-claude-code-hooks`
- Hook files are all located in `.claude/hooks/`:
  - `hooks.ts` (project-wide hooks)
  - `hooks.local.ts` (local-only hooks, not committed to git)
  - `hooks.user.ts` (user-specific hooks that update ~/.claude/settings.json)
- Compatible with npm, yarn, pnpm, and bun package managers
- The CLI no longer requires flags - it automatically detects which hook files exist and updates the appropriate settings files

## Release Process

The project uses automated releases via GitHub Actions. To release a new version:

1. **Ensure all changes are committed** and tests pass: `bun run test:run`

2. **Run the release script** based on the type of change:
   - Patch release (bug fixes): `npm run release:patch`
   - Minor release (new features): `npm run release:minor`
   - Major release (breaking changes): `npm run release:major`

   These scripts will:
   - Update the version in `package.json`
   - Create a git commit with the version number
   - Create a git tag (e.g., `v1.0.2`)
   - Push the commit and tag to GitHub

3. **GitHub Actions will automatically**:
   - Build the project
   - Run type checking
   - Publish to npm registry with provenance

The package is published under the `@timoaus` scope as `@timoaus/define-claude-code-hooks`.

Note: The repository must have the `NPM_TOKEN` secret configured for publishing.
