const { Markup } = require('telegraf');
const path = require('path');

const CONTENT = require('../content');
const { getMainMenu } = require('./start');
const {
    logMaterialClaim,
    getAllMaterials,
    getMaterialByKey,
} = require('../db/materials');
const { markMaterialsOpened, markSubscribed } = require('../db/users');

function musicMainMenuHandler() {
    return async (ctx) => {
        await ctx.answerCbQuery();

        await ctx.editMessageCaption(
            CONTENT.description,
            getMainMenu()
        );
    };
}

// Кнопки категорий строятся динамически из таблицы materials,
// чтобы админ мог добавлять/убирать материалы без изменения кода.
async function getCategoriesMenu() {
    const materials = await getAllMaterials();

    const buttons = materials.map((material) =>
        Markup.button.callback(
            `${material.emoji} ${material.label}`,
            `material:${material.key}`
        )
    );

    const rows = [];
    for (let i = 0; i < buttons.length; i += 3) {
        rows.push(buttons.slice(i, i + 3));
    }

    return Markup.inlineKeyboard(rows);
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
    const message = ctx.callbackQuery.message;
    const text =
        'Почти готово\n\n' +
        'Материалы доступны подписчикам моего Telegram-канала';
    const keyboard = getSubscriptionMenu(materialKey);

    if (message.photo) {
        await ctx.editMessageCaption(text, keyboard);
    } else {
        await ctx.editMessageText(text, keyboard);
    }
}

async function sendMaterial(ctx, materialKey) {
    const material = await getMaterialByKey(materialKey);

    if (!material) {
        await ctx.reply('Материал не найден.');
        return;
    }

    try {
        await logMaterialClaim(ctx.from.id, materialKey);
        await markSubscribed(ctx.from.id);
    } catch (error) {
        console.error('LOG MATERIAL CLAIM ERROR:', error);
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
                    `${material.emoji} ${material.label}`,
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

function materialHandler(bot) {
    return async (ctx) => {
        try {
            await ctx.answerCbQuery();

            const materialKey =
                ctx.callbackQuery.data.split(':')[1];

            const material = await getMaterialByKey(materialKey);

            if (!material) {
                const message = ctx.callbackQuery.message;
                const text = 'Материал не найден.';

                if (message.photo) {
                    await ctx.editMessageCaption(text, getMainMenu());
                } else {
                    await ctx.editMessageText(text, getMainMenu());
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

            const material = await getMaterialByKey(materialKey);

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

                const message = ctx.callbackQuery.message;
                const text =
                    'пока не вижу подписку 👀\n\n' +
                    'подпишись и нажми «Проверить» ещё раз';
                const keyboard = getSubscriptionMenu(materialKey);

                if (message.photo) {
                    await ctx.editMessageCaption(text, keyboard);
                } else {
                    await ctx.editMessageText(text, keyboard);
                }

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

            await markMaterialsOpened(ctx.from.id);

            const message = ctx.callbackQuery.message;
            const keyboard = await getCategoriesMenu();
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
