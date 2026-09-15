const { Markup } = require('telegraf');
const path = require('path');

const CONTENT = require('../content');
const { getMainMenu } = require('./start');

function musicMainMenuHandler() {
    return async (ctx) => {
        await ctx.answerCbQuery();

        await ctx.editMessageCaption(
            CONTENT.description,
            getMainMenu()
        );
    };
}

function getCategoriesMenu() {
    return Markup.inlineKeyboard([
        [
            Markup.button.callback('Шрифты', 'material:fonts'),
            Markup.button.callback('Музыка', 'material:music'),
            Markup.button.callback('SFX', 'material:sfx'),
        ],
    ]);
}

function getSubscriptionMenu(materialKey) {
    return Markup.inlineKeyboard([
        [
            Markup.button.url(
                'Подписаться ↗️',
                process.env.CHANNEL_URL
            ),
        ],
        [
            Markup.button.callback(
                'Проверить подписку',
                `check:${materialKey}`
            ),
        ],
    ]);
}

function getAfterDownloadMenu() {
    return Markup.inlineKeyboard([
        [
            Markup.button.callback(
                'Другие материалы',
                'materials'
            ),
            Markup.button.callback(
                'Главное меню',
                'main_menu'
            ),
        ],
    ]);
}

async function isSubscribed(bot, userId) {
    const member = await bot.telegram.getChatMember(
        process.env.CHANNEL,
        userId
    );

    return (
        member.status === 'member' ||
        member.status === 'administrator' ||
        member.status === 'creator'
    );
}



async function showSubscriptionMessage(ctx, materialKey) {
    await ctx.editMessageCaption(
        'Почти готово\n\n' +
        'Материалы доступны подписчикам моего Telegram-канала',
        getSubscriptionMenu(materialKey)
    );
}

async function sendMaterial(ctx, materialKey) {
    const material = CONTENT.materials[materialKey];

    if (!material) {
        await ctx.reply('Материал не найден.');
        return;
    }

    const message = ctx.callbackQuery.message;

    // Меняем главное сообщение на "забирай ↓"
    if (message.photo) {
        await ctx.editMessageCaption('забирай ↓');
    } else {
        await ctx.editMessageText('забирай ↓');
    }

    // Отправляем ссылку
    await ctx.reply(
        'ссылка готова',
        Markup.inlineKeyboard([
            [
                Markup.button.url(
                    material.title,
                    material.url
                )
            ]
        ])
    );

    // Кнопки после получения материала
    await ctx.reply(
        'Выбери, что дальше:',
        getAfterDownloadMenu()
    );
}

async function materialHandler(bot) {
    return async (ctx) => {
        try {
            await ctx.answerCbQuery();

            const materialKey =
                ctx.callbackQuery.data.split(':')[1];

            const material =
                CONTENT.materials[materialKey];

            if (!material) {
                await ctx.answerCbQuery('Материал не найден');
                return;
            }

            const subscribed =
                await isSubscribed(bot, ctx.from.id);

            if (!subscribed) {
                await showSubscriptionMessage(
                    ctx,
                    materialKey
                );
                return;
            }

            await sendMaterial(
                ctx,
                materialKey
            );

        } catch (error) {
            console.error(
                'MATERIAL ERROR:',
                error
            );
        }
    };
}

function materialHandler(bot) {
    return async (ctx) => {
        try {
            await ctx.answerCbQuery();

            const materialKey =
                ctx.callbackQuery.data.split(':')[1];

            const material =
                CONTENT.materials[materialKey];

            if (!material) {
                const message = ctx.callbackQuery.message;

                if (message.photo) {
                    await ctx.editMessageCaption(
                        'Материал не найден.',
                        getMainMenu()
                    );
                } else {
                    await ctx.editMessageText(
                        'Материал не найден.',
                        getMainMenu()
                    );
                }

                return;
            }

            const subscribed = await isSubscribed(
                bot,
                ctx.from.id
            );

            if (subscribed !== true) {
                await showSubscriptionMessage(
                    ctx,
                    materialKey
                );

                return;
            }

            await sendMaterial(
                ctx,
                materialKey
            );

        } catch (error) {
            console.error(
                'MATERIAL ERROR:',
                error
            );
        }
    };
}

function checkSubscriptionHandler(bot) {
    return async (ctx) => {
        try {
            const materialKey =
                ctx.callbackQuery.data.split(':')[1];

            const material =
                CONTENT.materials[materialKey];

            if (!material) {
                await ctx.answerCbQuery(
                    'Материал не найден'
                );

                return;
            }

            const subscribed =
                await isSubscribed(
                    bot,
                    ctx.from.id
                );

            if (subscribed !== true) {
                await ctx.answerCbQuery(
                    'Пока не вижу подписку 👀'
                );

                await ctx.editMessageCaption(
                    'пока не вижу подписку 👀\n\n' +
                    'подпишись и нажми «Проверить» ещё раз',
                    getSubscriptionMenu(materialKey)
                );

                return;
            }

            await ctx.answerCbQuery(
                'Подписка найдена ✅'
            );

            await sendMaterial(
                ctx,
                materialKey
            );

        } catch (error) {
            console.error(
                'CHECK SUBSCRIPTION ERROR:',
                error
            );
        }
    };
}

function materialsMenuHandler() {
    return async (ctx) => {
        try {
            await ctx.answerCbQuery();

            const message = ctx.callbackQuery.message;
            const keyboard = getCategoriesMenu();
            const text = 'Выбери, что хочешь забрать 👇';

            if (message.photo) {
                await ctx.editMessageCaption(
                    text,
                    keyboard
                );
            } else {
                await ctx.editMessageText(
                    text,
                    keyboard
                );
            }

        } catch (error) {
            console.error(
                'MATERIALS MENU ERROR:',
                error
            );
        }
    };
}

function mainMenuHandler() {
    return async (ctx) => {
        try {
            await ctx.answerCbQuery();

            await ctx.replyWithPhoto(
                {
                    source: path.join(
                        __dirname,
                        '..',
                        CONTENT.cover
                    ),
                },
                {
                    caption: CONTENT.description,
                    ...getMainMenu(),
                }
            );
        } catch (error) {
            console.error(
                'MAIN MENU ERROR:',
                error
            );
        }
    };
}

module.exports = {
    materialHandler,
    checkSubscriptionHandler,
    materialsMenuHandler,
    mainMenuHandler,
    musicMainMenuHandler,
};