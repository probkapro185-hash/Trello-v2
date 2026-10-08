export function GET() {
  // Liveness only; never expose configuration, credentials or tenant data.
  return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
