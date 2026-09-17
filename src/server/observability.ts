import "server-only";

type Level = "info" | "warn" | "error";

const sensitiveKey = /(password|token|secret|authorization|api[-_]?key|service[-_]?role|cookie)/i;

/* Log terstruktur tanpa data sensitif. Ganti dengan Sentry SDK saat DSN produksi tersedia. */
export function logServerEvent(level: Level, event: string, data: Record<string, unknown> = {}): void {
  const safe = Object.fromEntries(Object.entries(data).filter(([key]) => !sensitiveKey.test(key)));
  const line = JSON.stringify({ at: new Date().toISOString(), level, event, ...safe });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
