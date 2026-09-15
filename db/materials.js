const { pool } = require('./index');

async function logMaterialClaim(telegramId, materialKey) {
    await pool.query(
        `INSERT INTO material_claims (telegram_id, material_key)
         VALUES ($1, $2)`,
        [telegramId, materialKey]
    );
}

// Уникальные люди на материал (а не количество скачиваний).
async function getMaterialStats() {
    const { rows } = await pool.query(`
        SELECT material_key, COUNT(DISTINCT telegram_id)::int AS count
        FROM material_claims
        GROUP BY material_key
        ORDER BY count DESC
    `);

    return rows;
}

async function getAllMaterials() {
    const { rows } = await pool.query(
        'SELECT * FROM materials ORDER BY sort_order ASC, id ASC'
    );

    return rows;
}

async function getMaterialByKey(key) {
    const { rows } = await pool.query(
        'SELECT * FROM materials WHERE key = $1',
        [key]
    );

    return rows[0] || null;
}

async function createMaterial({ key, emoji, label, url }) {
    const nextOrderRes = await pool.query(
        'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM materials'
    );
    const sortOrder = nextOrderRes.rows[0].next;

    const { rows } = await pool.query(
        `INSERT INTO materials (key, emoji, label, url, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [key, emoji, label, url, sortOrder]
    );

    return rows[0];
}

async function updateMaterial(key, { emoji, label, url }) {
    const { rows } = await pool.query(
        `UPDATE materials
         SET emoji = $2, label = $3, url = $4
         WHERE key = $1
         RETURNING *`,
        [key, emoji, label, url]
    );

    return rows[0] || null;
}

async function deleteMaterial(key) {
    await pool.query('DELETE FROM materials WHERE key = $1', [key]);
}

// Заполняет таблицу текущими тремя материалами один раз,
// если она ещё пустая (первый деплой после переезда на БД).
async function seedMaterialsIfEmpty() {
    const { rows } = await pool.query(
        'SELECT COUNT(*)::int AS count FROM materials'
    );

    if (rows[0].count > 0) {
        return;
    }

    const seed = [
        {
            key: 'fonts',
            emoji: '🔤',
            label: 'Шрифты',
            url: 'https://disk.yandex.ru/d/-0djg021aNllcA',
            sortOrder: 1,
        },
        {
            key: 'sfx',
            emoji: '💥',
            label: 'SFX',
            url: 'https://disk.yandex.ru/d/ju6M7P2ClozJaw',
            sortOrder: 2,
        },
        {
            key: 'music',
            emoji: '🎵',
            label: 'Музыка',
            url: 'https://disk.yandex.ru/d/Cb0mDbhxRkZH8g',
            sortOrder: 3,
        },
    ];

    for (const material of seed) {
        await pool.query(
            `INSERT INTO materials (key, emoji, label, url, sort_order)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (key) DO NOTHING`,
            [
                material.key,
                material.emoji,
                material.label,
                material.url,
                material.sortOrder,
            ]
        );
    }

    console.log('БД: материалы заполнены стартовыми значениями (шрифты/sfx/музыка)');
}

module.exports = {
    logMaterialClaim,
    getMaterialStats,
    getAllMaterials,
    getMaterialByKey,
    createMaterial,
    updateMaterial,
    deleteMaterial,
    seedMaterialsIfEmpty,
};
