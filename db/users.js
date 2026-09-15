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

// Отмечает первое открытие меню материалов (для воронки в статистике).
async function markMaterialsOpened(telegramId) {
    await pool.query(
        `UPDATE users
         SET opened_materials_at = NOW()
         WHERE telegram_id = $1 AND opened_materials_at IS NULL`,
        [telegramId]
    );
}

// Отмечает первый успешно подтверждённый факт подписки (для воронки).
async function markSubscribed(telegramId) {
    await pool.query(
        `UPDATE users
         SET subscribed_at = NOW()
         WHERE telegram_id = $1 AND subscribed_at IS NULL`,
        [telegramId]
    );
}

// Статистика для админ-панели
async function getStats() {
    const totalRes = await pool.query(
        'SELECT COUNT(*)::int AS count FROM users'
    );

    const todayRes = await pool.query(`
        SELECT COUNT(*)::int AS count
        FROM users
        WHERE created_at >= date_trunc('day', now())
    `);

    const openedRes = await pool.query(`
        SELECT COUNT(*)::int AS count
        FROM users
        WHERE opened_materials_at IS NOT NULL
    `);

    const subscribedRes = await pool.query(`
        SELECT COUNT(*)::int AS count
        FROM users
        WHERE subscribed_at IS NOT NULL
    `);

    const total = totalRes.rows[0].count;
    const subscribed = subscribedRes.rows[0].count;

    return {
        total,
        today: todayRes.rows[0].count,
        openedMaterials: openedRes.rows[0].count,
        subscribed,
        conversion: total > 0 ? (subscribed / total) * 100 : 0,
    };
}

async function getSourceStats() {
    const { rows } = await pool.query(`
        SELECT COALESCE(source, 'direct') AS source, COUNT(*)::int AS count
        FROM users
        GROUP BY source
        ORDER BY count DESC
    `);

    return rows;
}

async function getAllUserIds() {
    const { rows } = await pool.query(
        'SELECT telegram_id FROM users'
    );

    return rows.map((row) => row.telegram_id);
}

module.exports = {
    findUserByTelegramId,
    createUser,
    registerUser,
    markMaterialsOpened,
    markSubscribed,
    getStats,
    getSourceStats,
    getAllUserIds,
};
