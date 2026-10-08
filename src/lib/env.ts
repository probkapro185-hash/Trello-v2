export function validateOrigin(value: string, name: string, production = false) {
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
    !(url.protocol === "https:" || !production && local && url.protocol === "http:") || production && local) {
    throw new Error(`${name} must be a secure origin (HTTP allowed only for local development).`);
  }
  return url.origin;
}

export function validatePublicKey(key: string) {
  if (key.startsWith("sb_publishable_") && key.length > 20) return;
  try {
    const segment = key.split(".")[1];
    if (key.split(".").length === 3 && segment && JSON.parse(atob(segment.replace(/-/g, "+").replace(/_/g, "/"))).role === "anon") return;
  } catch { /* Never include credentials in the error. */ }
  throw new Error("Use a Supabase publishable or legacy anon key; secret/service-role keys are forbidden in public environment.");
}

export function validateServerKey(key: string) {
  if (key.startsWith("sb_secret_") && key.length > 20) return;
  try {
    const segment = key.split(".")[1];
    if (key.split(".").length === 3 && segment && JSON.parse(atob(segment.replace(/-/g, "+").replace(/_/g, "/"))).role === "service_role") return;
  } catch { /* Credentials must never appear in diagnostics. */ }
  throw new Error("The cleanup worker requires a server-only Supabase secret/service-role key.");
}

export function getSupabaseEnvironment() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Supabase is not configured. Follow docs/SUPABASE_SETUP.md.");
  }

  validateOrigin(url, "NEXT_PUBLIC_SUPABASE_URL");
  validatePublicKey(publishableKey);

  return { url, publishableKey };
}

export function getAppOrigin() {
  const value = process.env.NEXT_PUBLIC_APP_URL;
  if (!value) throw new Error("NEXT_PUBLIC_APP_URL is required.");
  return validateOrigin(value, "NEXT_PUBLIC_APP_URL");
}
