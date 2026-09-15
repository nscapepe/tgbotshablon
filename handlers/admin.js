const { Markup } = require('telegraf');

const { isAdmin } = require('../config');
const { getStats, getAllUserIds } = require('../db/users');
const {
    getMaterialStats,
    getAllMaterials,
    getMaterialByKey,
    createMaterial,
    updateMaterial,
    deleteMaterial,
} = require('../db/materials');

const ADMIN_TITLE = '⚙️ АДМИН-ПАНЕЛЬ';

// Подписи материалов в блоке статистики (фиксированный порядок и эмодзи,
// независимо от того, что сейчас лежит в таблице materials).
const STATS_MATERIAL_LABELS = [
    { key: 'fonts', emoji: '🔤', label: 'шрифты' },
    { key: 'sfx', emoji: '💥', label: 'sfx' },
    { key: 'music', emoji: '🎵', label: 'музыка' },
];

// Админы, которые сейчас должны прислать сообщение для рассылки.
const awaitingBroadcast = new Set();

// Админы в процессе добавления/изменения материала:
// telegram_id -> { action: 'add' } | { action: 'edit', key }
const materialFlow = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getAdminMenu() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('📊 Статистика', 'admin:stats')],
        [Markup.button.callback('📦 Материалы', 'admin:materials')],
        [Markup.button.callback('📢 Рассылка', 'admin:broadcast')],
    ]);
}

function getBackMenu() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Назад', 'admin:menu')],
    ]);
}

function getMaterialsMenu() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('➕ Добавить', 'admin:material_add')],
        [Markup.button.callback('✏️ Изменить', 'admin:material_edit')],
        [Markup.button.callback('🗑 Удалить', 'admin:material_delete')],
        [Markup.button.callback('⬅️ Назад', 'admin:menu')],
    ]);
}

function getCancelMenu(callbackData) {
    return Markup.inlineKeyboard([
        [Markup.button.callback('Отмена', callbackData)],
    ]);
}

// ---------- Форматирование ----------

function formatStats(stats, materialStats) {
    const countByKey = {};
    materialStats.forEach((row) => {
        countByKey[row.material_key] = row.count;
    });

    let text = '📊 статистика\n\n';
    text += `👥 пользователей: ${stats.total}\n`;
    text += `🆕 сегодня: ${stats.today}\n\n`;
    text += `📥 открыли материалы: ${stats.openedMaterials}\n`;
    text += `✅ подписались: ${stats.subscribed}\n\n`;
    text += `📈 конверсия: ${stats.conversion.toFixed(1)}%\n\n`;
    text += 'материалы:\n';

    STATS_MATERIAL_LABELS.forEach((item) => {
        const count = countByKey[item.key] || 0;
        text += `${item.emoji} ${item.label} — ${count}\n`;
    });

    return text.trim();
}

function formatMaterialsMenu(materials) {
    let text = '📦 материалы\n\n';

    if (materials.length === 0) {
        text += 'Пока нет ни одного материала.';
        return text;
    }

    materials.forEach((material) => {
        text += `${material.emoji} ${material.label}\n`;
    });

    return text.trim();
}

function parseParts(text, expectedCount) {
    const parts = (text || '')
        .split('|')
        .map((part) => part.trim())
        .filter(Boolean);

    if (parts.length !== expectedCount) {
        return null;
    }

    return parts;
}

function isValidUrl(url) {
    return /^https?:\/\//i.test(url);
}

// ---------- Главное меню админки ----------

async function adminCommandHandler(ctx) {
    if (!isAdmin(ctx.from.id)) {
        return;
    }

    await ctx.reply(ADMIN_TITLE, getAdminMenu());
}

function adminMenuActionHandler() {
    return async (ctx) => {
        if (!isAdmin(ctx.from.id)) {
            await ctx.answerCbQuery();
            return;
        }

        materialFlow.delete(ctx.from.id);
        awaitingBroadcast.delete(ctx.from.id);

        await ctx.answerCbQuery();
        await ctx.editMessageText(ADMIN_TITLE, getAdminMenu());
    };
}

// ---------- Статистика ----------

function adminStatsActionHandler() {
    return async (ctx) => {
        try {
            if (!isAdmin(ctx.from.id)) {
                await ctx.answerCbQuery();
                return;
            }

            await ctx.answerCbQuery();

            const stats = await getStats();
            const materialStats = await getMaterialStats();

            await ctx.editMessageText(
                formatStats(stats, materialStats),
                getBackMenu()
            );
        } catch (error) {
            console.error('ADMIN STATS ERROR:', error);
        }
    };
}

// ---------- Материалы: меню ----------

function adminMaterialsActionHandler() {
    return async (ctx) => {
        try {
            if (!isAdmin(ctx.from.id)) {
                await ctx.answerCbQuery();
                return;
            }

            await ctx.answerCbQuery();

            const materials = await getAllMaterials();

            await ctx.editMessageText(
                formatMaterialsMenu(materials),
                getMaterialsMenu()
            );
        } catch (error) {
            console.error('ADMIN MATERIALS ERROR:', error);
        }
    };
}

// ---------- Материалы: добавить ----------

function adminMaterialAddActionHandler() {
    return async (ctx) => {
        if (!isAdmin(ctx.from.id)) {
            await ctx.answerCbQuery();
            return;
        }

        await ctx.answerCbQuery();

        materialFlow.set(ctx.from.id, { action: 'add' });

        await ctx.editMessageText(
            '➕ Новый материал\n\n' +
            'Пришли одним сообщением через вертикальную черту:\n' +
            'ключ | эмодзи | название | ссылка\n\n' +
            'Например:\n' +
            'presets | 🎬 | Пресеты | https://disk.yandex.ru/d/xxxxx\n\n' +
            'Ключ — короткое слово латиницей, без пробелов и двоеточий, для внутреннего использования.',
            getCancelMenu('admin:material_cancel')
        );
    };
}

// ---------- Материалы: изменить ----------

function adminMaterialEditActionHandler() {
    return async (ctx) => {
        try {
            if (!isAdmin(ctx.from.id)) {
                await ctx.answerCbQuery();
                return;
            }

            await ctx.answerCbQuery();

            const materials = await getAllMaterials();

            if (materials.length === 0) {
                await ctx.editMessageText(
                    'Пока нечего изменять — сначала добавь материал.',
                    getMaterialsMenu()
                );
                return;
            }

            const buttons = materials.map((material) => [
                Markup.button.callback(
                    `${material.emoji} ${material.label}`,
                    `admin:material_edit_pick:${material.key}`
                ),
            ]);

            buttons.push([
                Markup.button.callback('Отмена', 'admin:material_cancel'),
            ]);

            await ctx.editMessageText(
                'Какой материал изменить?',
                Markup.inlineKeyboard(buttons)
            );
        } catch (error) {
            console.error('ADMIN MATERIAL EDIT ERROR:', error);
        }
    };
}

function adminMaterialEditPickActionHandler() {
    return async (ctx) => {
        try {
            if (!isAdmin(ctx.from.id)) {
                await ctx.answerCbQuery();
                return;
            }

            const key = ctx.callbackQuery.data.split(':')[2];
            const material = await getMaterialByKey(key);

            if (!material) {
                await ctx.answerCbQuery('Материал не найден');
                return;
            }

            await ctx.answerCbQuery();

            materialFlow.set(ctx.from.id, { action: 'edit', key });

            await ctx.editMessageText(
                `✏️ Изменение: ${material.emoji} ${material.label}\n\n` +
                'Пришли новые данные через вертикальную черту:\n' +
                'эмодзи | название | ссылка\n\n' +
                'Например:\n' +
                `${material.emoji} | ${material.label} | ${material.url}`,
                getCancelMenu('admin:material_cancel')
            );
        } catch (error) {
            console.error('ADMIN MATERIAL EDIT PICK ERROR:', error);
        }
    };
}

// ---------- Материалы: удалить ----------

function adminMaterialDeleteActionHandler() {
    return async (ctx) => {
        try {
            if (!isAdmin(ctx.from.id)) {
                await ctx.answerCbQuery();
                return;
            }

            await ctx.answerCbQuery();

            const materials = await getAllMaterials();

            if (materials.length === 0) {
                await ctx.editMessageText(
                    'Удалять нечего — материалов пока нет.',
                    getMaterialsMenu()
                );
                return;
            }

            const buttons = materials.map((material) => [
                Markup.button.callback(
                    `${material.emoji} ${material.label}`,
                    `admin:material_delete_pick:${material.key}`
                ),
            ]);

            buttons.push([
                Markup.button.callback('Отмена', 'admin:material_cancel'),
            ]);

            await ctx.editMessageText(
                'Какой материал удалить?',
                Markup.inlineKeyboard(buttons)
            );
        } catch (error) {
            console.error('ADMIN MATERIAL DELETE ERROR:', error);
        }
    };
}

function adminMaterialDeletePickActionHandler() {
    return async (ctx) => {
        try {
            if (!isAdmin(ctx.from.id)) {
                await ctx.answerCbQuery();
                return;
            }

            const key = ctx.callbackQuery.data.split(':')[2];
            const material = await getMaterialByKey(key);

            if (!material) {
                await ctx.answerCbQuery('Материал не найден');
                return;
            }

            await ctx.answerCbQuery();

            await ctx.editMessageText(
                `Точно удалить «${material.emoji} ${material.label}»? Это нельзя отменить.`,
                Markup.inlineKeyboard([
                    [
                        Markup.button.callback(
                            '🗑 Да, удалить',
                            `admin:material_delete_confirm:${key}`
                        ),
                    ],
                    [
                        Markup.button.callback(
                            'Отмена',
                            'admin:material_cancel'
                        ),
                    ],
                ])
            );
        } catch (error) {
            console.error('ADMIN MATERIAL DELETE PICK ERROR:', error);
        }
    };
}

function adminMaterialDeleteConfirmActionHandler() {
    return async (ctx) => {
        try {
            if (!isAdmin(ctx.from.id)) {
                await ctx.answerCbQuery();
                return;
            }

            const key = ctx.callbackQuery.data.split(':')[2];
            await deleteMaterial(key);

            await ctx.answerCbQuery('Удалено');

            const materials = await getAllMaterials();
            await ctx.editMessageText(
                formatMaterialsMenu(materials),
                getMaterialsMenu()
            );
        } catch (error) {
            console.error('ADMIN MATERIAL DELETE CONFIRM ERROR:', error);
        }
    };
}

// ---------- Материалы: отмена add/edit/delete-выбора ----------

function adminMaterialCancelActionHandler() {
    return async (ctx) => {
        try {
            if (!isAdmin(ctx.from.id)) {
                await ctx.answerCbQuery();
                return;
            }

            materialFlow.delete(ctx.from.id);

            await ctx.answerCbQuery('Отменено');

            const materials = await getAllMaterials();
            await ctx.editMessageText(
                formatMaterialsMenu(materials),
                getMaterialsMenu()
            );
        } catch (error) {
            console.error('ADMIN MATERIAL CANCEL ERROR:', error);
        }
    };
}

// ---------- Обработка текстовых сообщений в режиме add/edit ----------

async function handleMaterialAddMessage(ctx) {
    const parts = parseParts(ctx.message.text, 4);

    if (!parts) {
        await ctx.reply(
            'Не понял формат. Пришли так:\n' +
            'ключ | эмодзи | название | ссылка'
        );
        return;
    }

    const [key, emoji, label, url] = parts;

    if (key.includes(':') || /\s/.test(key)) {
        await ctx.reply(
            'Ключ не должен содержать пробелов и двоеточий. Попробуй ещё раз.'
        );
        return;
    }

    if (!isValidUrl(url)) {
        await ctx.reply(
            'Ссылка должна начинаться с http:// или https://. Попробуй ещё раз.'
        );
        return;
    }

    const existing = await getMaterialByKey(key);
    if (existing) {
        await ctx.reply(
            `Материал с ключом «${key}» уже есть. Придумай другой ключ или используй «✏️ Изменить».`
        );
        return;
    }

    materialFlow.delete(ctx.from.id);
    await createMaterial({ key, emoji, label, url });

    await ctx.reply(`Готово, материал «${emoji} ${label}» добавлен ✅`);

    const materials = await getAllMaterials();
    await ctx.reply(formatMaterialsMenu(materials), getMaterialsMenu());
}

async function handleMaterialEditMessage(ctx, key) {
    const parts = parseParts(ctx.message.text, 3);

    if (!parts) {
        await ctx.reply(
            'Не понял формат. Пришли так:\n' +
            'эмодзи | название | ссылка'
        );
        return;
    }

    const [emoji, label, url] = parts;

    if (!isValidUrl(url)) {
        await ctx.reply(
            'Ссылка должна начинаться с http:// или https://. Попробуй ещё раз.'
        );
        return;
    }

    materialFlow.delete(ctx.from.id);
    await updateMaterial(key, { emoji, label, url });

    await ctx.reply('Материал обновлён ✅');

    const materials = await getAllMaterials();
    await ctx.reply(formatMaterialsMenu(materials), getMaterialsMenu());
}

// ---------- Рассылка ----------

function adminBroadcastActionHandler() {
    return async (ctx) => {
        try {
            if (!isAdmin(ctx.from.id)) {
                await ctx.answerCbQuery();
                return;
            }

            await ctx.answerCbQuery();

            awaitingBroadcast.add(ctx.from.id);

            await ctx.editMessageText(
                '📢 Пришли сообщение (текст, фото, видео — что угодно), ' +
                'и я разошлю его всем пользователям бота.',
                getCancelMenu('admin:broadcast_cancel')
            );
        } catch (error) {
            console.error('ADMIN BROADCAST START ERROR:', error);
        }
    };
}

function adminBroadcastCancelActionHandler() {
    return async (ctx) => {
        if (!isAdmin(ctx.from.id)) {
            await ctx.answerCbQuery();
            return;
        }

        awaitingBroadcast.delete(ctx.from.id);

        await ctx.answerCbQuery('Рассылка отменена');
        await ctx.editMessageText(ADMIN_TITLE, getAdminMenu());
    };
}

async function runBroadcast(ctx) {
    awaitingBroadcast.delete(ctx.from.id);

    try {
        const userIds = await getAllUserIds();

        await ctx.reply(
            `Начинаю рассылку на ${userIds.length} пользователей...`
        );

        let success = 0;
        let failed = 0;

        for (const telegramId of userIds) {
            try {
                await ctx.telegram.copyMessage(
                    telegramId,
                    ctx.chat.id,
                    ctx.message.message_id
                );
                success++;
            } catch (error) {
                failed++;
            }

            await sleep(40);
        }

        await ctx.reply(
            `Рассылка завершена ✅\n` +
            `Доставлено: ${success}\n` +
            `Не доставлено: ${failed} (заблокировали бота / удалили чат)`,
            getAdminMenu()
        );
    } catch (error) {
        console.error('BROADCAST ERROR:', error);
        await ctx.reply('Что-то пошло не так во время рассылки.');
    }
}

// ---------- Единая точка приёма текстовых сообщений от админа ----------
// Ловит: (1) контент для рассылки, (2) данные для добавления/изменения материала.

function adminTextCaptureHandler() {
    return async (ctx) => {
        const userId = ctx.from && ctx.from.id;

        if (!userId || !isAdmin(userId)) {
            return;
        }

        if (awaitingBroadcast.has(userId)) {
            await runBroadcast(ctx);
            return;
        }

        const flow = materialFlow.get(userId);

        if (!flow) {
            return;
        }

        try {
            if (flow.action === 'add') {
                await handleMaterialAddMessage(ctx);
            } else if (flow.action === 'edit') {
                await handleMaterialEditMessage(ctx, flow.key);
            }
        } catch (error) {
            console.error('ADMIN MATERIAL FLOW ERROR:', error);
            await ctx.reply('Что-то пошло не так, попробуй ещё раз.');
        }
    };
}

module.exports = {
    adminCommandHandler,
    adminMenuActionHandler,
    adminStatsActionHandler,
    adminMaterialsActionHandler,
    adminMaterialAddActionHandler,
    adminMaterialEditActionHandler,
    adminMaterialEditPickActionHandler,
    adminMaterialDeleteActionHandler,
    adminMaterialDeletePickActionHandler,
    adminMaterialDeleteConfirmActionHandler,
    adminMaterialCancelActionHandler,
    adminBroadcastActionHandler,
    adminBroadcastCancelActionHandler,
    adminTextCaptureHandler,
};
