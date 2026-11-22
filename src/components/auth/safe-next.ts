// Where to go after signing in. Only same-site paths are allowed, so a link like
// /login?next=https://evil.example can't bounce users to another site
// (an "open redirect"). "//evil.example" is also rejected: browsers treat it as
// another host.
export function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}
