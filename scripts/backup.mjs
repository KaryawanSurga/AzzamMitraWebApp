import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL belum diisi. Jalankan dengan .env.local atau environment eksplisit.");
  process.exit(1);
}

const timestamp = new Date().toISOString().replaceAll(":", "-").replace(/\..+$/, "");
const directory = join(process.cwd(), "backups");
mkdirSync(directory, { recursive: true });
const target = join(directory, `azzam-mitra-${timestamp}.dump`);

const result = spawnSync("pg_dump", ["--format=custom", "--no-owner", `--file=${target}`, databaseUrl], { stdio: "inherit", shell: process.platform === "win32" });
if (result.error) {
  console.error("pg_dump tidak ditemukan. Pasang PostgreSQL client dan pastikan ada di PATH.");
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Backup tersimpan: ${target}`);
