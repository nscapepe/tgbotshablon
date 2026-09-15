require('dotenv').config();

const CHANNEL = process.env.CHANNEL;
const CHANNEL_URL = process.env.CHANNEL_URL;
const TELEGRAM_URL = process.env.TELEGRAM_URL;
const COOPERATION_URL = process.env.COOPERATION_URL;

// Поддержка нескольких админов через запятую: ADMIN_ID=123456789,987654321
const ADMIN_IDS = (process.env.ADMIN_ID || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .map(Number);

function isAdmin(userId) {
    return ADMIN_IDS.includes(userId);
}

module.exports = {
    CHANNEL,
    CHANNEL_URL,
    TELEGRAM_URL,
    COOPERATION_URL,
    ADMIN_IDS,
    isAdmin,
}