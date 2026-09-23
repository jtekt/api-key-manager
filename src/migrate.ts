import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

// Applies pending migrations from ./drizzle, then exits.
// Run before the server starts, e.g. as a Kubernetes init container.

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
await pool.end();

console.log("Migrations applied");
