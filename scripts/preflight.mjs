import { validateOrigin, validatePublicKey, validateServerKey } from "../src/lib/env.ts";
const errors = [];
for (const name of ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SUPABASE_URL"]) {
  try { validateOrigin(process.env[name] ?? "", name, true); }
  catch { errors.push(`${name}: configure a remote HTTPS origin without a path or credentials`); }
}
try { validatePublicKey(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ""); }
catch { errors.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishable/anon key required, never service role"); }
try { validateServerKey(process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""); }
catch { errors.push("SUPABASE_SERVICE_ROLE_KEY: a secret/service-role key is required for the server-only worker"); }
if (!process.env.CRON_SECRET || process.env.CRON_SECRET.length < 32 || process.env.CRON_SECRET.length > 256) errors.push("CRON_SECRET: use a random 32–256 character secret");
for (const [name, value] of Object.entries(process.env)) {
  if (name.startsWith("NEXT_PUBLIC_") && value && (value.startsWith("sb_secret_") || /SERVICE_ROLE|CRON_SECRET/.test(name))) errors.push(`${name}: private credential must not be public`);
  if (name.startsWith("NEXT_PUBLIC_") && value?.split(".").length === 3) {
    try { validateServerKey(value); errors.push(`${name}: privileged JWT must not be public`); } catch { /* Non-secret value. */ }
  }
}
if (errors.length) { errors.forEach((error) => console.error(error)); process.exitCode = 1; }
else console.log("PASS: production environment shape (values redacted). Verify account access, SMTP, redirects and migrations before deploying.");
