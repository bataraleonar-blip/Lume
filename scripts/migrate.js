const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const dir = path.join(process.cwd(), "db");
    const files = fs.readdirSync(dir)
      .filter(f => /^\d+_.*\.sql$/.test(f))
      .sort();

    for (const file of files) {
      const version = file.split("_")[0];
      const exists = await client.query(
        "SELECT 1 FROM schema_migrations WHERE version=$1",
        [version]
      );
      if (exists.rowCount) {
        console.log(`SKIP ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(dir, file), "utf8");
      console.log(`APPLY ${file}`);

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations(version) VALUES($1)",
          [version]
        );
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed: ${err.message}`);
      }
    }

    console.log("MIGRATIONS_OK");
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error("MIGRATIONS_FAILED:", err.message);
  process.exit(1);
});
