const fs = require("fs");
const path = require("path");
const { pool } = require("../../config/postgres");

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../migrations");

async function ensureMigrationTable(client) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            migration_id VARCHAR(255) PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            execution_time_ms INTEGER NOT NULL
        );
    `);
}

async function getAppliedMigrations(client) {
    const res = await client.query("SELECT migration_id FROM schema_migrations ORDER BY migration_id ASC");
    return new Set(res.rows.map(r => r.migration_id));
}

async function baselineExistingTablesIfEmpty(client, appliedSet) {
    if (appliedSet.size > 0) {
        return;
    }

    // Check if initial tables already exist from manual/prior execution
    const tableCheck = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name IN ('accounts', 'merchants', 'beneficiaries', 'transactions', 'ledger_entries')
    `);

    if (tableCheck.rows.length === 5) {
        console.log("Existing schema detected. Baselining migrations 001 through 005 into schema_migrations...");
        const baselineMigrations = [
            "001_create_accounts.sql",
            "002_create_merchants.sql",
            "003_create_beneficiaries.sql",
            "004_create_transactions.sql",
            "005_create_ledger_entries.sql"
        ];

        for (const migrationId of baselineMigrations) {
            await client.query(
                "INSERT INTO schema_migrations (migration_id, execution_time_ms) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                [migrationId, 0]
            );
            appliedSet.add(migrationId);
            console.log(`  [BASELINED] ${migrationId}`);
        }
    }
}

async function runMigrations() {
    console.log("==================================================");
    console.log("          AIPAYSEC POSTGRESQL MIGRATOR            ");
    console.log("==================================================");
    console.log(`Scanning migrations in: ${MIGRATIONS_DIR}`);

    if (!fs.existsSync(MIGRATIONS_DIR)) {
        throw new Error(`Migrations directory does not exist: ${MIGRATIONS_DIR}`);
    }

    const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith(".sql"))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

    console.log(`Found ${files.length} migration file(s).`);

    const client = await pool.connect();

    try {
        await ensureMigrationTable(client);
        const appliedSet = await getAppliedMigrations(client);

        await baselineExistingTablesIfEmpty(client, appliedSet);

        let appliedCount = 0;

        for (const file of files) {
            if (appliedSet.has(file)) {
                console.log(`  [SKIP] ${file} (already applied)`);
                continue;
            }

            console.log(`  [APPLYING] ${file}...`);
            const filePath = path.join(MIGRATIONS_DIR, file);
            const sql = fs.readFileSync(filePath, "utf-8");

            const startTime = Date.now();
            await client.query("BEGIN");
            try {
                await client.query(sql);
                const duration = Date.now() - startTime;

                await client.query(
                    "INSERT INTO schema_migrations (migration_id, execution_time_ms) VALUES ($1, $2)",
                    [file, duration]
                );
                await client.query("COMMIT");
                console.log(`  [SUCCESS]  ${file} (took ${duration}ms)`);
                appliedSet.add(file);
                appliedCount++;
            } catch (migrationError) {
                await client.query("ROLLBACK");
                console.error(`\n[MIGRATION FAILED] Error executing ${file}:`, migrationError.message);
                throw migrationError;
            }
        }

        console.log("==================================================");
        console.log(`Migration run complete. Applied ${appliedCount} new migration(s).`);
        console.log("==================================================");
    } finally {
        client.release();
    }
}

if (require.main === module) {
    runMigrations()
        .then(async () => {
            await pool.end();
            process.exit(0);
        })
        .catch(async (err) => {
            console.error("Migration fatal error:", err);
            await pool.end();
            process.exit(1);
        });
}

module.exports = {
    runMigrations
};
