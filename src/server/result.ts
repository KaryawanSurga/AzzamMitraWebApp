import type { ZodError } from "zod";
import { RepositoryConflictError } from "./errors";

export type AppErrorCode = "validation" | "unauthorized" | "not_found" | "conflict" | "retryable";
export type AppResult<T> = { ok: true; data: T } | { ok: false; error: { code: AppErrorCode; message: string; fields?: Record<string, string[]> } };

export const unauthorizedResult = (): AppResult<never> => ({ ok: false, error: { code: "unauthorized", message: "Sesi berakhir atau akun owner tidak valid. Silakan masuk kembali." } });

export const validationFailure = (error: ZodError): AppResult<never> => ({ ok: false, error: { code: "validation", message: "Periksa kembali data yang diisi.", fields: error.flatten().fieldErrors } });

export const fieldFailure = (field: string, message: string): AppResult<never> => ({ ok: false, error: { code: "validation", message, fields: { [field]: [message] } } });

export const notFoundFailure = (message: string): AppResult<never> => ({ ok: false, error: { code: "not_found", message } });

export const repositoryFailure = (error: unknown): AppResult<never> =>
  error instanceof RepositoryConflictError
    ? { ok: false, error: { code: "conflict", message: "Data dengan nomor atau kunci yang sama sudah tersimpan." } }
    : { ok: false, error: { code: "retryable", message: "Data belum dapat disimpan. Silakan coba lagi." } };
