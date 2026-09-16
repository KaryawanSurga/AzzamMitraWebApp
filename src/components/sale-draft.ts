export const SALE_DRAFT_KEY = "azzam-mitra:sale-draft";
export const SALE_DRAFT_VERSION = 1;
export const SALE_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
export type SaleDraft<T> = { version: number; expiresAt: number; value: T };
export function encodeSaleDraft<T>(value: T, now = Date.now()): string { return JSON.stringify({ version: SALE_DRAFT_VERSION, expiresAt: now + SALE_DRAFT_TTL_MS, value }); }
export function decodeSaleDraft<T>(raw: string | null, now = Date.now()): T | null { if (!raw) return null; try { const parsed = JSON.parse(raw) as SaleDraft<T>; return parsed.version === SALE_DRAFT_VERSION && parsed.expiresAt > now ? parsed.value : null; } catch { return null; } }
