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

    // На случай, если users уже существовала без этих колонок (миграция).
    await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS opened_materials_at TIMESTAMPTZ;
    `);

    await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS subscribed_at TIMESTAMPTZ;
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS material_claims (
            id BIGSERIAL PRIMARY KEY,
            telegram_id BIGINT NOT NULL,
            material_key TEXT NOT NULL,
            claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS materials (
            id BIGSERIAL PRIMARY KEY,
            key TEXT UNIQUE NOT NULL,
            emoji TEXT NOT NULL DEFAULT '📁',
            label TEXT NOT NULL,
            url TEXT NOT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);

    console.log('БД: таблицы готовы (users, material_claims, materials)');
}

module.exports = {
    pool,
    initDb,
};
