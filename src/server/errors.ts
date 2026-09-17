import { logServerEvent } from "./observability";

/* Kegagalan repository dipetakan service menjadi hasil typed. Satu definisi untuk seluruh fase. */
export class RepositoryConflictError extends Error {}
export class RepositoryUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("Repository unavailable", { cause });
  }
}

/* PostgreSQL melaporkan pelanggaran unique constraint lewat SQLSTATE 23505, termasuk di dalam cause. */
export function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === "23505") return true;
  return "cause" in error && isUniqueViolation(error.cause);
}

export function toRepositoryError(error: unknown): never {
  if (isUniqueViolation(error)) throw new RepositoryConflictError();
  logServerEvent("error", "repository.unavailable", { message: error instanceof Error ? error.message : String(error) });
  throw new RepositoryUnavailableError(error);
}
