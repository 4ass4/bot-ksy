import dotenv from 'dotenv';
import { Bot } from 'grammy';
import Database from './database/database.js';
import { UserService } from './services/userService.js';
import { ChannelService } from './services/channelService.js';
import { RaffleService } from './services/raffleService.js';
import { MailingService } from './services/mailingService.js';
import { OfficialChannelService } from './services/officialChannelService.js';
import { BotSettingsService } from './services/botSettingsService.js';
import { ReferralService } from './services/referralService.js';
import { AnalyticsService } from './services/analyticsService.js';
import { SocialService } from './services/socialService.js';
import { SocialAccountService } from './services/socialAccountService.js';
import { UnifiedHandlers } from './bot/handlers/userHandlers.js';
import { Scheduler } from './bot/scheduler.js';
import migrate from './database/migrate.js';
// Загружаем переменные окружения
dotenv.config();
// Проверяем обязательные переменные
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN не найден в переменных окружения');
    process.exit(1);
}
const DATABASE_PATH = process.env.DATABASE_PATH || './database/bot.db';
async function startBot() {
    try {
        console.log('🚀 Запуск Telegram-бота для розыгрышей...');
        // Выполняем миграцию базы данных
        console.log('📦 Выполнение миграции базы данных...');
        await migrate();
        // Инициализируем базу данных и сервисы
        const database = new Database(DATABASE_PATH);
        const userService = new UserService(database);
        const channelService = new ChannelService(database);
        const raffleService = new RaffleService(database);
        const mailingService = new MailingService(database);
        const officialChannelService = new OfficialChannelService(database);
        const botSettingsService = new BotSettingsService(database);
        const referralService = new ReferralService(database);
        const analyticsService = new AnalyticsService(database);
        const socialService = new SocialService(database);
        const socialAccountService = new SocialAccountService(database);
        // Создаем бота
        const bot = new Bot(BOT_TOKEN);
        // Устанавливаем команды бота
        await bot.api.setMyCommands([
            { command: 'start', description: 'Начать работу с ботом' },
            { command: 'help', description: 'Справка по боту' },
            { command: 'my_raffles', description: 'Мои розыгрыши' },
            { command: 'admin', description: 'Админ-панель (только для админов)' }
        ]);
        // Регистрируем единый обработчик
        const unifiedHandlers = new UnifiedHandlers(bot, userService, raffleService, channelService, mailingService, officialChannelService, botSettingsService, referralService, analyticsService, socialService, socialAccountService);
        unifiedHandlers.register();
        // Обработка ошибок
        bot.catch((err) => {
            const ctx = err.ctx;
            console.error(`Ошибка при обработке обновления ${ctx.update.update_id}:`, err.error);
        });
        // Запускаем планировщик задач
        const scheduler = new Scheduler(bot, raffleService, userService, mailingService);
        scheduler.start();
        // Запускаем бота
        await bot.start();
        console.log('✅ Бот успешно запущен и готов к работе!');
        // Обработка завершения процесса
        process.once('SIGINT', async () => {
            console.log('🛑 Получен сигнал SIGINT, останавливаем бота...');
            await bot.stop();
            await database.close();
            process.exit(0);
        });
        process.once('SIGTERM', async () => {
            console.log('🛑 Получен сигнал SIGTERM, останавливаем бота...');
            await bot.stop();
            await database.close();
            process.exit(0);
        });
    }
    catch (error) {
        console.error('❌ Критическая ошибка при запуске бота:', error);
        process.exit(1);
    }
}
// Запускаем бота
startBot();
//# sourceMappingURL=index.js.map