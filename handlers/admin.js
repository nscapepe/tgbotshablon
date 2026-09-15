const { Markup } = require('telegraf');

const { isAdmin } = require('../config');
const { getStats } = require('../db/users');

function getAdminMenu() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('📊 Статистика', 'admin:stats')],
    ]);
}

function formatStats(stats) {
    let text = '📊 Статистика бота\n\n';
    text += `Всего пользователей: ${stats.total}\n`;
    text += `За 24 часа: ${stats.last24h}\n`;
    text += `За 7 дней: ${stats.last7d}\n\n`;
    text += 'По источникам (deep link):\n';

    if (stats.bySource.length === 0) {
        text += '—';
    } else {
        stats.bySource.forEach((row) => {
            text += `• ${row.source}: ${row.count}\n`;
        });
    }

    return text;
}

// Команда /admin
async function adminCommandHandler(ctx) {
    if (!isAdmin(ctx.from.id)) {
        return; // молча игнорируем — не палим, что команда вообще существует
    }

    await ctx.reply('Админ-панель', getAdminMenu());
}

// Кнопка "Статистика" внутри админ-панели
function adminStatsActionHandler() {
    return async (ctx) => {
        try {
            if (!isAdmin(ctx.from.id)) {
                await ctx.answerCbQuery();
                return;
            }

            await ctx.answerCbQuery();

            const stats = await getStats();
            await ctx.reply(formatStats(stats), getAdminMenu());
        } catch (error) {
            console.error('ADMIN STATS ERROR:', error);
        }
    };
}

module.exports = {
    adminCommandHandler,
    adminStatsActionHandler,
};
