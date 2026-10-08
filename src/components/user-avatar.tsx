import Image from "next/image";

export function UserAvatar({ name, url }: { name: string; url?: string | null }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
  return <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-xs font-medium text-muted-foreground">
    {url ? <Image src={url} alt={name} width={36} height={36} unoptimized /> : <span aria-label={name}>{initials}</span>}
  </span>;
}
