import { Pool, neonConfig } from "@neondatabase/serverless";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run migrations");
}

const migrationsDirectory = resolve(process.cwd(), "migrations");
const migrationFiles = (await readdir(migrationsDirectory))
  .filter((file) => file.endsWith(".sql"))
  .sort();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  for (const file of migrationFiles) {
    const sql = await readFile(resolve(migrationsDirectory, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("COMMIT");
      console.log(`Applied ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(`Migration ${file} failed`, { cause: error });
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}