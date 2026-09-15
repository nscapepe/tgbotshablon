require('dotenv').config();

const { Telegraf } = require('telegraf');

const { initDb } = require('./db');
const { seedMaterialsIfEmpty } = require('./db/materials');
const { startHandler } = require('./handlers/start');

const {
    materialHandler,
    checkSubscriptionHandler,
    materialsMenuHandler,
    mainMenuHandler,
    musicMainMenuHandler,
} = require('./handlers/material');

const {
    adminCommandHandler,
    adminMenuActionHandler,
    adminStatsActionHandler,
    adminDeepLinksActionHandler,
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
} = require('./handlers/admin');

const bot = new Telegraf(
    process.env.BOT_TOKEN
);

bot.start(startHandler);

bot.command('admin', adminCommandHandler);

bot.action(
    'admin:menu',
    adminMenuActionHandler()
);

bot.action(
    'admin:stats',
    adminStatsActionHandler()
);

bot.action(
    'admin:deeplinks',
    adminDeepLinksActionHandler()
);

bot.action(
    'admin:materials',
    adminMaterialsActionHandler()
);

bot.action(
    'admin:material_add',
    adminMaterialAddActionHandler()
);

bot.action(
    'admin:material_edit',
    adminMaterialEditActionHandler()
);

bot.action(
    /^admin:material_edit_pick:(.+)$/,
    adminMaterialEditPickActionHandler()
);

bot.action(
    'admin:material_delete',
    adminMaterialDeleteActionHandler()
);

bot.action(
    /^admin:material_delete_pick:(.+)$/,
    adminMaterialDeletePickActionHandler()
);

bot.action(
    /^admin:material_delete_confirm:(.+)$/,
    adminMaterialDeleteConfirmActionHandler()
);

bot.action(
    'admin:material_cancel',
    adminMaterialCancelActionHandler()
);

bot.action(
    'admin:broadcast',
    adminBroadcastActionHandler()
);

bot.action(
    'admin:broadcast_cancel',
    adminBroadcastCancelActionHandler()
);

bot.action(
    'materials',
    materialsMenuHandler()
);

bot.action(
    /^material:(.+)$/,
    materialHandler(bot)
);

bot.action(
    /^check:(.+)$/,
    checkSubscriptionHandler(bot)
);

bot.action(
    'main_menu',
    mainMenuHandler()
);

bot.action(
    'music_main_menu',
    musicMainMenuHandler()
);

// Должен идти последним: ловит сообщение админа только если он
// сейчас в процессе рассылки или добавления/изменения материала.
bot.on(
    'message',
    adminTextCaptureHandler()
);

async function main() {
    await initDb();
    await seedMaterialsIfEmpty();
    await bot.launch();
    console.log('Бот запущен');
}

main().catch((error) => {
    console.error('STARTUP ERROR:', error);
    process.exit(1);
});
