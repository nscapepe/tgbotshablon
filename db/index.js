const { Pool } = require('pg');

// Railway сам прокидывает DATABASE_URL, если в проекте подключён Postgres-плагин.
// rejectUnauthorized: false нужен, т.к. Railway использует self-signed сертификат.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function initDb() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id BIGSERIAL PRIMARY KEY,
            telegram_id BIGINT UNIQUE NOT NULL,
            username TEXT,
            first_name TEXT,
            source TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);

    console.log('БД: таблица users готова');
}

module.exports = {
    pool,
    initDb,
};
