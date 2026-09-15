import { getPublicEnv } from "./env.client";
import { readDatabaseUrl } from "./database-env";

describe("environment validation", () => {
  it("returns a directed error for missing public configuration", () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    try {
      expect(() => getPublicEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    } finally {
      restoreEnvironment("NEXT_PUBLIC_SUPABASE_URL", originalUrl);
      restoreEnvironment("NEXT_PUBLIC_SUPABASE_ANON_KEY", originalKey);
    }
  });

  it("rejects a non-PostgreSQL database URL with a directed message", () => {
    const originalUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "https://example.com/database";

    try {
      expect(() => readDatabaseUrl()).toThrow(/postgres:\/\/ atau postgresql:\/\//);
    } finally {
      restoreEnvironment("DATABASE_URL", originalUrl);
    }
  });
});

function restoreEnvironment(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
