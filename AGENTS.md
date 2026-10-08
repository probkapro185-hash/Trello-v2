<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project workflow

Read `PROJECT_PROGRESS.md` and `docs/ARCHITECTURE.md` before continuing.
The user requires one stage at a time: stop after the current stage and wait for
an explicit request before starting the next. Do not add later-stage UI/features.
Keep database types generated from migrations, keep secrets out of source, and
record actual validation results in `docs/VERIFICATION.md` and the progress file.
