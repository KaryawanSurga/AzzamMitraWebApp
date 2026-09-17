import { spawnSync } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL;
const file = process.argv[2];

if (!file) {
  console.error("Pemakaian: npm run db:restore -- backups/azzam-mitra-<waktu>.dump");
  process.exit(1);
}
if (!databaseUrl) {
  console.error("DATABASE_URL belum diisi. Jalankan dengan .env.local atau environment eksplisit.");
  process.exit(1);
}
if (process.env.CONFIRM_RESTORE !== "yes") {
  console.error("Restore menimpa data pada DATABASE_URL. Ulangi dengan CONFIRM_RESTORE=yes bila yakin.");
  process.exit(1);
}

const result = spawnSync("pg_restore", ["--clean", "--if-exists", "--no-owner", `--dbname=${databaseUrl}`, file], { stdio: "inherit", shell: process.platform === "win32" });
if (result.error) {
  console.error("pg_restore tidak ditemukan. Pasang PostgreSQL client dan pastikan ada di PATH.");
  process.exit(1);
}
process.exit(result.status ?? 1);
