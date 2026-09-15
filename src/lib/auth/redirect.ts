const DEFAULT_REDIRECT = "/dashboard";

export function safeInternalRedirect(value: string | null | undefined, fallback = DEFAULT_REDIRECT): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    const parsed = new URL(value, "http://internal.local");
    return parsed.origin === "http://internal.local" ? `${parsed.pathname}${parsed.search}${parsed.hash}` : fallback;
  } catch { return fallback; }
}

export function authRedirectFor(pathname: string, hasUser: boolean): string | null {
  if (pathname === "/login" && hasUser) return "/dashboard";
  const publicRoute = pathname === "/login" || pathname === "/forgot-password" || pathname === "/auth/callback";
  if (!publicRoute && !hasUser) return `/login?next=${encodeURIComponent(pathname)}`;
  return null;
}
