import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Docker Desktop cannot always bind files inside macOS Downloads/Documents.
// Keep a stable runtime copy in the OS temp directory; named database/storage
// volumes still use the original project_id. Never copy .env or user secrets.
const source = resolve("supabase");
const fingerprint = createHash("sha256").update(source).digest("hex").slice(0, 12);
const runtime = join(tmpdir(), `contour-supabase-${fingerprint}`);
mkdirSync(join(runtime, "supabase"), { recursive: true });
for (const item of ["config.toml", "migrations", "templates", "seed.sql"]) {
  cpSync(join(source, item), join(runtime, "supabase", item), { recursive: true, force: true });
}
const config = readFileSync(join(source, "config.toml"), "utf8");
writeFileSync(join(runtime, "supabase", "config.toml"), config);
const result = spawnSync("supabase", ["start", "--workdir", runtime], { stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
