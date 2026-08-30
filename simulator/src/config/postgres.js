const { Pool } = require("pg");
const config = require("./env");

const pool = new Pool({
    host: config.postgres.host,
    port: config.postgres.port,
    database: config.postgres.database,
    user: config.postgres.user,
    password: config.postgres.password
});

async function testPostgresConnection() {
    const result = await pool.query("SELECT NOW() AS current_time");

    console.log(
        "PostgreSQL connected:",
        result.rows[0].current_time
    );
}

module.exports = {
    pool,
    testPostgresConnection
};