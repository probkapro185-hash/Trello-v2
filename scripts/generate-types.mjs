import { spawnSync } from "node:child_process";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";

const result = spawnSync("supabase", ["gen", "types", "typescript", "--local", "--schema", "public"], {
  encoding: "utf8",
});
if (result.error || result.status !== 0 || !result.stdout.includes("export type Database")) {
  console.error(result.error?.message ?? result.stderr ?? "Database type generation failed");
  process.exit(1);
}
mkdirSync("src/types", { recursive: true });
writeFileSync("src/types/database.ts.tmp", result.stdout);
renameSync("src/types/database.ts.tmp", "src/types/database.ts");
console.log("Database types regenerated from the local schema.");
