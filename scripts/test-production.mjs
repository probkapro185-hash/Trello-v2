import { strict as assert } from "node:assert";
import { contentSecurityPolicy } from "../src/lib/security.ts";
import { validCronAuthorization } from "../src/lib/cron-auth.ts";
import { validateOrigin, validatePublicKey, validateServerKey } from "../src/lib/env.ts";
import { cleanupStorage } from "../src/lib/storage-cleanup.ts";

const policy = contentSecurityPolicy("testnonce", "https://project.supabase.co", false);
assert(policy.includes("'nonce-testnonce'"));
assert(!policy.includes("unsafe-eval"));
assert(policy.includes("wss://project.supabase.co"));
assert(policy.includes("frame-ancestors 'none'"));
assert(!policy.split("script-src")[1].split(";")[0].includes("unsafe-inline"));
assert(contentSecurityPolicy("nonce", "http://127.0.0.1:54321", true).includes("unsafe-eval"));
assert.equal(validateOrigin("https://app.example.com", "APP", true), "https://app.example.com");
for (const bad of ["http://example.com", "http://localhost:3000", "https://user:pass@example.com", "https://example.com/path", "https://example.com?x=1"]) assert.throws(() => validateOrigin(bad, "APP", true));
assert.doesNotThrow(() => validatePublicKey("sb_publishable_test_public_key"));
const jwt = (role) => `header.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;
assert.doesNotThrow(() => validatePublicKey(jwt("anon")));
for (const bad of [jwt("service_role"), "sb_secret_test", "invalid", ""]) assert.throws(() => validatePublicKey(bad));
assert.doesNotThrow(() => validateServerKey(jwt("service_role")));
assert.throws(() => validateServerKey(jwt("anon")));
const secret = "a".repeat(48);
assert(validCronAuthorization(`Bearer ${secret}`, secret));
for (const header of [null, "", "Bearer wrong", `Basic ${secret}`, `Bearer ${"b".repeat(48)}`]) assert(!validCronAuthorization(header, secret));
assert(!validCronAuthorization("Bearer short", "short"));
assert(!validCronAuthorization(`Bearer ${secret}`, undefined));

const completed = [];
const client = {
  rpc: async (name, args) => name === "claim_storage_cleanup" ? { data: [{ path: "good", lease: "1" }, { path: "failed", lease: "2" }, { path: "thrown", lease: "3" }], error: null } : (completed.push(args.object_path), { error: null }),
  storage: { from: () => ({ remove: async ([path]) => { if (path === "thrown") throw new Error("offline"); return { error: path === "failed" ? { message: "offline" } : null }; } }) },
};
assert.deepEqual(await cleanupStorage(client), { claimed: 3, removed: 1, failed: 2, deferred: 0 });
assert.deepEqual(completed, ["good"]); // Never acknowledge failed deletions.
assert.deepEqual(await cleanupStorage(client, -1), { claimed: 3, removed: 0, failed: 0, deferred: 3 });
await assert.rejects(() => cleanupStorage({ rpc: async () => ({ error: true }) }));
console.log("PASS: CSP, environment/key checks, cron authentication, cleanup retries and deadline");

if (process.env.TEST_APP_URL) {
  const origin = validateOrigin(process.env.TEST_APP_URL, "TEST_APP_URL");
  const times = [];
  let previousNonce;
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    const response = await fetch(`${origin}/sign-in`);
    const html = await response.text();
    times.push(performance.now() - start);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert(response.headers.get("cache-control").includes("no-store"));
    const csp = response.headers.get("content-security-policy");
    assert(csp && !csp.includes("unsafe-eval"));
    const nonce = csp.match(/'nonce-([^']+)'/)[1];
    assert.notEqual(nonce, previousNonce);
    previousNonce = nonce;
    const scripts = [...html.matchAll(/<script\b([^>]*)>/g)];
    assert(scripts.length > 0);
    for (const script of scripts) assert(script[1].includes(`nonce="${nonce}"`), "Every Next script needs the response nonce");
  }
  const protectedPage = await fetch(`${origin}/my-tasks`, { redirect: "manual" });
  // Next can stream the shell before the auth guard resolves, then send a meta redirect.
  if (protectedPage.status === 200) assert(/<meta[^>]+http-equiv="refresh"[^>]+content="1;url=\/sign-in\?next=%2F(?:my-tasks|workspaces)"/.test(await protectedPage.text()));
  else { assert.equal(protectedPage.status, 307); assert(protectedPage.headers.get("location").includes("/sign-in")); }
  assert.equal((await fetch(`${origin}/api/cron/storage-cleanup`)).status, 401);
  assert.deepEqual(await (await fetch(`${origin}/api/health`)).json(), { status: "ok" });
  console.log(`PASS: production HTTP headers, fresh script nonces, auth guard, protected cron, health; sign-in median ${Math.round(times.sort((a,b)=>a-b)[2])}ms (local, 5 requests)`);
}
