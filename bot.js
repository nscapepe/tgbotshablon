require('dotenv').config();

const { Telegraf } = require('telegraf');

const { initDb } = require('./db');
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
    adminStatsActionHandler,
} = require('./handlers/admin');

const bot = new Telegraf(
    process.env.BOT_TOKEN
);

bot.start(startHandler);

bot.command('admin', adminCommandHandler);

bot.action(
    'admin:stats',
    adminStatsActionHandler()
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

async function main() {
    await initDb();
    await bot.launch();
    console.log('Бот запущен');
}

main().catch((error) => {
    console.error('STARTUP ERROR:', error);
    process.exit(1);
});