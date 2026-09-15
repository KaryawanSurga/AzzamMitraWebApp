export type AppErrorCode = "validation" | "unauthorized" | "not_found" | "conflict" | "retryable";
export type AppResult<T> = { ok: true; data: T } | { ok: false; error: { code: AppErrorCode; message: string; fields?: Record<string, string[]> } };

export const unauthorizedResult = (): AppResult<never> => ({ ok: false, error: { code: "unauthorized", message: "Sesi berakhir atau akun owner tidak valid. Silakan masuk kembali." } });
