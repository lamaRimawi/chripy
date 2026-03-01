import process from "node:process";
import type { MigrationConfig } from "drizzle-orm/migrator";

process.loadEnvFile();

function envOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

export type DBConfig = {
  url: string;
  migrationConfig: MigrationConfig;
};

export type APIConfig = {
  fileserverHits: number;
  platform: string; // إضافة حقل المنصة
  jwtSecret: string; // إضافة هذا الحقل
  polkaKey: string; // الحقل الجديد
};

export type Config = {
  api: APIConfig;
  db: DBConfig;
};

export const config: Config = {
  api: {
    fileserverHits: 0,
    platform: process.env.PLATFORM || "dev", // القيمة الافتراضية dev
    jwtSecret: envOrThrow("JWT_SECRET"), // تحميل السر من البيئة
    polkaKey: envOrThrow("POLKA_KEY"), // تحميل 
},
  db: {
    url: envOrThrow("DB_URL"),
    migrationConfig: {
      migrationsFolder: "./src/db/migrations",
    },
  },
};
