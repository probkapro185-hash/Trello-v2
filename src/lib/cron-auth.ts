import { timingSafeEqual } from "node:crypto";

export function validCronAuthorization(header: string | null, secret: string | undefined) {
  if (!secret || secret.length < 32 || secret.length > 256 || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
