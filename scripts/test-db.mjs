import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const config = readFileSync("supabase/config.toml", "utf8");
const projectId = config.match(/^project_id\s*=\s*"([a-zA-Z0-9_-]+)"/m)?.[1];
if (!projectId) throw new Error("Missing local Supabase project_id");

function sqlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sqlFiles(path) : path.endsWith(".test.sql") ? [path] : [];
  }).sort();
}

const files = sqlFiles("supabase/tests/database");
if (files.length === 0) throw new Error("No database tests found");
let total = 0;
for (const file of files) {
  // Feed SQL over stdin: no host bind mount, local psql install or extra image.
  const result = spawnSync("docker", [
    "exec", "-i", `supabase_db_${projectId}`, "psql", "-U", "postgres", "-d", "postgres",
    "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1",
  ], { encoding: "utf8", input: readFileSync(file, "utf8"), maxBuffer: 8 * 1024 * 1024 });
  const output = result.stdout ?? "";
  const plans = [...output.matchAll(/^1\.\.(\d+)$/gm)];
  const passed = [...output.matchAll(/^ok (\d+)(?:\s|$)/gm)];
  const expected = Number(plans[0]?.[1] ?? 0);
  const sequential = passed.every((match, index) => Number(match[1]) === index + 1);
  if (result.error || result.status !== 0 || plans.length !== 1 || expected === 0 ||
      /^not ok|^Bail out!/m.test(output) || passed.length !== expected || !sequential) {
    console.error(`${file}: FAILED\n${output}\n${result.stderr ?? ""}`);
    if (result.error) console.error(result.error.message);
    process.exit(1);
  }
  total += passed.length;
  console.log(`${file}: ${passed.length} assertions passed`);
}
console.log(`PASS: ${files.length} file(s), ${total} assertions`);
