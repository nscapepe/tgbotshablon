const { pool } = require('./index');

async function findUserByTelegramId(telegramId) {
    const { rows } = await pool.query(
        'SELECT * FROM users WHERE telegram_id = $1',
        [telegramId]
    );

    return rows[0] || null;
}

async function createUser({ telegramId, username, firstName, source }) {
    const { rows } = await pool.query(
        `INSERT INTO users (telegram_id, username, first_name, source)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [telegramId, username || null, firstName || null, source || 'direct']
    );

    return rows[0];
}

// Шаг 2 + Шаг 4: регистрирует юзера при /start и пишет источник из deep link.
// ctx.startPayload — это и есть Шаг 3: Telegraf сам парсит /start <payload>.
async function registerUser(ctx) {
    const telegramId = ctx.from.id;

    const existing = await findUserByTelegramId(telegramId);
    if (existing) {
        return { user: existing, isNew: false };
    }

    const source = ctx.startPayload || 'direct';

    const user = await createUser({
        telegramId,
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        source,
    });

    return { user, isNew: true };
}

// Шаг 5: статистика
async function getStats() {
    const totalRes = await pool.query(
        'SELECT COUNT(*)::int AS count FROM users'
    );

    const todayRes = await pool.query(`
        SELECT COUNT(*)::int AS count
        FROM users
        WHERE created_at >= NOW() - INTERVAL '24 hours'
    `);

    const weekRes = await pool.query(`
        SELECT COUNT(*)::int AS count
        FROM users
        WHERE created_at >= NOW() - INTERVAL '7 days'
    `);

    const bySourceRes = await pool.query(`
        SELECT COALESCE(source, 'direct') AS source, COUNT(*)::int AS count
        FROM users
        GROUP BY source
        ORDER BY count DESC
    `);

    return {
        total: totalRes.rows[0].count,
        last24h: todayRes.rows[0].count,
        last7d: weekRes.rows[0].count,
        bySource: bySourceRes.rows,
    };
}

module.exports = {
    findUserByTelegramId,
    createUser,
    registerUser,
    getStats,
};
