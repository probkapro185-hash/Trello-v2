const uuid = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const allowedNext = new RegExp(`^(?:/workspaces(?:/${uuid})?|/my-tasks|/profile|/invite/[a-f0-9]{64})$`);

export function safeNext(value: unknown): string {
  return typeof value === "string" && allowedNext.test(value) ? value : "/workspaces";
}

export function authHref(route: "sign-in" | "sign-up", next: string) {
  return `/${route}?next=${encodeURIComponent(safeNext(next))}`;
}
