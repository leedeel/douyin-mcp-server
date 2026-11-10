# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Automated Douyin (TikTok China) video publishing via Puppeteer. One core automation class (`DouyinUploader`) is exposed through three front ends:

| Front end | Location | Consumer |
|---|---|---|
| MCP server (stdio) | `mcp-server/index.ts` | Claude Code / MCP clients — 5 tools |
| CLI scripts | `scripts/{login,upload,manage}.ts` | Humans / agents via `npx tsx` |
| Agent Skill bundle | `skills/douyin/` | OpenClaw / Claude Code skills (self-contained JS) |

Code comments, log output, and docs are mixed Chinese/English — **match the existing bilingual style** when editing.

## Commands

All real work happens in `mcp-server/`; root `package.json` just proxies into it.

```bash
npm install && cd mcp-server && npm install   # setup

npm run build          # tsc -> mcp-server/dist/
npm test               # vitest run (14 tests, no browser launched)
npm run lint           # eslint . --ext .ts
npm run lint:fix
npm run format         # prettier --write "**/*.{ts,json}"
npm run dev            # tsx watch index.ts

# Run the MCP server (MUST be direct node — see Gotchas)
node mcp-server/dist/mcp-server/index.js

# Single test / single test file
cd mcp-server && npx vitest run __tests__/config.test.ts
cd mcp-server && npx vitest run -t "should return exists: false"

# CLI entry points
npx tsx scripts/login.ts                       # opens browser, manual login, saves cookies
npx tsx scripts/upload.ts --video <abs-path> --title "t" [--description d] [--tags a,b] [--no-publish]
npx tsx scripts/manage.ts check|info|clear
```

ESLint/Prettier configs live only in `mcp-server/` (`.eslintrc.cjs`, `.prettierrc`).

## Architecture

### `DouyinUploader` (mcp-server/douyin-uploader.ts)

The single source of truth for all browser automation. All methods return a result object with `success`/`error` rather than throwing, so callers never need try/catch.

- `login(headless, timeout)` — polls `page.url()` every 5s until it matches a logged-in creator URL, then writes cookies to disk with `chmod 0600`.
- `checkLogin(headless)` — replays saved cookies into a fresh page and checks whether the URL redirects to `/login`.
- `uploadVideo(params)` — the main workflow: load cookies → goto `creator-micro/content/upload` → `uploadFile()` → wait proportional to file size → fill title (with DOM-eval fallback) → fill description/tags into the `contenteditable` div → `setCover()` → click 发布 → handle SMS verification → publish.
- `getCookiesInfo()` / `clearData()` — local-only, no browser launch.

All timing constants live in the exported `CONFIG` object (`TIMEOUTS.*`, `UPLOAD_WAIT_MULTIPLIER`); `__tests__/config.test.ts` asserts on them, so change them there rather than inlining sleeps.

### Selection fragility

The uploader drives Douyin's SPA by scraping Chinese UI text (`发布`, `立即发布`, `选择封面`, `确认`, `验证码`). Every button lookup is a text match over `button` elements and CSS class substrings like `[class*="cover"]`. Douyin class names are minified and change without notice, so **selectors are the most likely thing to break**; when an upload fails, run it non-headless and watch the browser.

### Cookie & browser-data locations (path-dependent!)

`cookiesPath` is resolved relative to the *compiled file's* `__dirname`, so it differs per entry point:

| Entry point | Cookies | Browser data |
|---|---|---|
| `scripts/*.ts` via tsx | `<repo>/douyin-cookies.json` | `<repo>/chrome-user-data/` |
| `mcp-server/dist/mcp-server/index.js` | `<repo>/mcp-server/dist/douyin-cookies.json` | `.../dist/chrome-user-data/` |
| `skills/douyin/` bundle | `<repo>/skills/douyin/douyin-cookies.json` | `skills/douyin/chrome-user-data/` |

A login performed via the CLI is therefore **not** visible to the compiled MCP server. `douyin-cookies.json` and `chrome-user-data/` are gitignored.

### MCP server (mcp-server/index.ts)

Low-level `Server` + `StdioServerTransport` (no `McpServer` helper). Each tool is declared twice — once in the `ListToolsRequestSchema` handler as a hand-written JSON schema, and once as a Zod schema used to parse arguments in the `CallToolRequestSchema` handler. **Adding a tool means updating both**, or the client sees a schema the server rejects.

Tools: `douyin_login`, `douyin_check_login`, `douyin_upload_video`, `douyin_get_cookies`, `douyin_clear_cookies`.

### `skills/douyin/` is a hand-synced compiled copy

The skill bundle (`douyin-uploader.js` + `scripts/*.js`) is the tsc output of the TS sources with one deliberate edit: the cookie path drops the `../` so files land next to the skill. **There is no build script that regenerates it** — past commits updated it by hand alongside the TS change.

So: when you change `mcp-server/douyin-uploader.ts` or `scripts/*.ts`, you must also mirror the change into `skills/douyin/` or the skill silently ships stale behavior. Verify with:

```bash
cd mcp-server && npx tsc && diff <(sed 's/[[:space:]]\+/ /g' dist/mcp-server/douyin-uploader.js) \
  <(sed 's/[[:space:]]\+/ /g' ../skills/douyin/douyin-uploader.js)
```
(the only expected differences are the two `cookiesPath` / `userDataDir` lines, where the skill drops the `../`).

## Gotchas

- **First upload after login triggers SMS verification.** The code is read from `process.stdin` via `readline` in `uploadVideo()`. This conflicts with the MCP server's `StdioServerTransport`, which owns the same stdin channel — in MCP mode the readline prompt will consume JSON-RPC bytes. Uploads that hit SMS verification are reliable via the **CLI** (`scripts/upload.ts`) and the skill bundle, not via MCP.
- **Never launch the MCP server via `npm start` — npm's banner goes to stdout and corrupts the JSON-RPC stream.** The banner (`> douyin-mcp-server@2.0.0 start`) is printed on stdout, so the client tries to parse it as JSON. MCP clients must invoke node directly:
  ```bash
  claude mcp add douyin --scope local -- node /abs/path/to/mcp-server/dist/mcp-server/index.js
  ```
  `npm start --silent` also works, but direct `node` is the canonical form.
- **`tsc` output nests one level deep.** `mcp-server/tsconfig.json` sets `rootDir: ".."` because the root-level `scripts/*.ts` must be compiled too, so the real paths are `dist/mcp-server/index.js` and `dist/scripts/*.js`. `package.json` `main`/`start` were fixed to match; the `bin` entries (`dist/scripts/*.js`) were already correct.
- **`examples/simple-upload.js` is stale** — it imports `../mcp-server/dist/douyin-uploader.js`, but the compiled path is `dist/mcp-server/douyin-uploader.js`.
- **`npm run lint` currently reports 1 pre-existing error** (unused `selectors` in `douyin-uploader.ts`) plus 3 `any` warnings in tests. Don't attribute these to your change.
- **Root `.gitignore` ignores `*.js` globally**; `skills/douyin/.gitignore` re-includes the bundled JS. New JS files elsewhere in the repo stay untracked.
- The published `.claude-plugin/manifest.json` lists skill paths (`skills/douyin-login`, etc.) that don't exist — the repo now has a single `skills/douyin/` skill.
- `npm run build` also compiles `scripts/*.ts` and the test files into `dist/`; the compiled tests are not run by vitest.
