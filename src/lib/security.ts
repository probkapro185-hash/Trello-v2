export function contentSecurityPolicy(nonce: string, supabaseUrl: string, development: boolean) {
  const origin = new URL(supabaseUrl).origin;
  const socket = origin.replace(/^http/, "ws");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    // dnd-kit positions cards with style attributes; scripts still require a nonce.
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self' ${origin} ${socket}${development ? " ws://localhost:* ws://127.0.0.1:*" : ""}`,
    `img-src 'self' ${origin} blob: data:`,
    "font-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
  ].join("; ");
}
