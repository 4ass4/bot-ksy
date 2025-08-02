import { InlineKeyboard } from 'grammy';
import { Keyboards } from '../keyboards.js';
import { MailingType, RaffleStatus } from '../../types/index.js';
export class AdminHandlers {
    bot;
    userService;
    channelService;
    raffleService;
    mailingService;
    adminStates = {};
    constructor(bot, userService, channelService, raffleService, mailingService) {
        this.bot = bot;
        this.userService = userService;
        this.channelService = channelService;
        this.raffleService = raffleService;
        this.mailingService = mailingService;
    }
    register() {
        // Команда входа в админ-панель
        this.bot.command('admin', async (ctx) => {
            console.log(`🔧 Команда /admin от пользователя ${ctx.from.id}`);
            const user = await this.userService.getUserByTelegramId(ctx.from.id);
            if (!user?.is_admin) {
                console.log(`❌ Пользователь ${ctx.from.id} не является админом`);
                return ctx.reply('❌ У вас нет доступа к админ-панели.');
            }
            console.log(`✅ Пользователь ${ctx.from.id} получил доступ к админ-панели`);
            await ctx.reply('🔧 *Админ-панель*\n\nВыберите раздел для управления:', {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.mainAdmin()
            });
        });
        // Обработка нажатий кнопок админ-панели
        this.bot.on('callback_query:data', async (ctx) => {
            const data = ctx.callbackQuery.data;
            console.log(`🔘 Нажата кнопка: ${data} от пользователя ${ctx.from.id}`);
            const user = await this.userService.getUserByTelegramId(ctx.from.id);
            if (!user?.is_admin) {
                console.log(`❌ Пользователь ${ctx.from.id} не является админом`);
                return ctx.answerCallbackQuery('❌ Нет доступа');
            }
            console.log(`✅ Обработка кнопки админа ${ctx.from.id}: ${data}`);
            await ctx.answerCallbackQuery();
            try {
                switch (data) {
                    case 'back_admin':
                        console.log(`🔄 Обработка кнопки back_admin`);
                        await this.showMainAdminMenu(ctx);
                        break;
                    case 'admin_channels':
                        console.log(`📺 Обработка кнопки admin_channels`);
                        await this.showChannelsMenu(ctx);
                        break;
                    case 'admin_raffles':
                        console.log(`🎁 Обработка кнопки admin_raffles`);
                        await this.showRafflesMenu(ctx);
                        break;
                    case 'admin_mailings':
                        console.log(`📢 Обработка кнопки admin_mailings`);
                        await this.showMailingsMenu(ctx);
                        break;
                    case 'admin_stats':
                        console.log(`📊 Обработка кнопки admin_stats`);
                        await this.showStats(ctx);
                        break;
                    case 'admin_settings':
                        console.log(`⚙️ Обработка кнопки admin_settings`);
                        await this.showSettings(ctx);
                        break;
                    case 'channels_add':
                        console.log(`➕ Обработка кнопки channels_add`);
                        await this.startAddChannel(ctx);
                        break;
                    case 'channels_list':
                        console.log(`📋 Обработка кнопки channels_list`);
                        await this.showChannelsList(ctx);
                        break;
                    case 'raffles_create':
                        console.log(`🎁 Обработка кнопки raffles_create`);
                        await this.startCreateRaffle(ctx);
                        break;
                    case 'raffles_active':
                        console.log(`📋 Обработка кнопки raffles_active`);
                        await this.showActiveRaffles(ctx);
                        break;
                    case 'raffles_finished':
                        console.log(`✅ Обработка кнопки raffles_finished`);
                        await this.showFinishedRaffles(ctx);
                        break;
                    case 'mailings_create':
                        console.log(`📝 Обработка кнопки mailings_create`);
                        await this.startCreateMailing(ctx);
                        break;
                    case 'mailings_list':
                        console.log(`📋 Обработка кнопки mailings_list`);
                        await this.showMailingsList(ctx);
                        break;
                    case 'cancel_action':
                        console.log(`❌ Обработка кнопки cancel_action`);
                        await this.cancelAction(ctx);
                        break;
                    case 'publish_raffle':
                        console.log(`📢 Обработка кнопки publish_raffle`);
                        await this.startPublishRaffle(ctx);
                        break;
                    case 'create_raffle_final':
                        console.log(`✅ Обработка кнопки create_raffle_final`);
                        await this.handleCreateRaffleFinal(ctx);
                        break;
                    default:
                        if (data.startsWith('publish_raffle_')) {
                            const raffleIndex = parseInt(data.replace('publish_raffle_', ''));
                            console.log(`📢 Обработка кнопки publish_raffle_${raffleIndex}`);
                            await this.publishRaffleToChannels(ctx, raffleIndex);
                        }
                        else if (data.startsWith('select_channel_')) {
                            const channelId = parseInt(data.replace('select_channel_', ''));
                            console.log(`📺 Обработка кнопки select_channel_${channelId}`);
                            await this.handleSelectChannel(ctx, channelId);
                        }
                        else {
                            console.log(`❓ Неизвестная кнопка: ${data}`);
                        }
                        break;
                }
            }
            catch (error) {
                console.error(`❌ Ошибка при обработке кнопки ${data}:`, error);
                await ctx.editMessageText('❌ Произошла ошибка при обработке команды. Попробуйте еще раз.', {
                    reply_markup: Keyboards.backToAdmin()
                });
            }
        });
        // Обработка текстовых сообщений для админов (только если есть активное состояние)
        this.bot.on('message:text', async (ctx) => {
            // Пропускаем команды - они обрабатываются отдельно
            if (ctx.message?.text?.startsWith('/')) {
                console.log(`🚫 Пропускаем команду: ${ctx.message.text}`);
                return;
            }
            console.log(`📨 Получено текстовое сообщение от ${ctx.from.id}: "${ctx.message?.text}"`);
            const user = await this.userService.getUserByTelegramId(ctx.from.id);
            if (!user?.is_admin) {
                console.log(`🚫 Пользователь ${ctx.from.id} не является админом`);
                return;
            }
            const state = this.adminStates[ctx.from.id];
            if (!state) {
                console.log(`📝 У пользователя ${ctx.from.id} нет активного состояния админа`);
                return;
            }
            console.log(`✅ Обработка текстового сообщения админа ${ctx.from.id} с состоянием:`, state);
            // Обрабатываем только если есть активное состояние админа
            await this.handleTextMessage(ctx, state);
        });
    }
    async handleTextMessage(ctx, state) {
        const text = ctx.message?.text;
        if (!text)
            return;
        console.log(`📝 Обработка текстового сообщения: step=${state.step}, text=${text}`);
        switch (state.step) {
            case 'add_channel':
                console.log(`➕ Обработка добавления канала`);
                await this.handleAddChannel(ctx, text);
                break;
            case 'create_raffle_title':
                console.log(`📝 Обработка названия розыгрыша`);
                await this.handleCreateRaffleTitle(ctx, text);
                break;
            case 'create_raffle_prize':
                console.log(`🎁 Обработка создания приза`);
                await this.handleCreateRafflePrize(ctx, text);
                break;
            case 'create_raffle_winners':
                console.log(`🏆 Обработка количества победителей`);
                await this.handleCreateRaffleWinners(ctx, text);
                break;
            case 'create_raffle_duration':
                console.log(`⏰ Обработка длительности розыгрыша`);
                await this.handleCreateRaffleDuration(ctx, text);
                break;
            case 'create_mailing_text':
                console.log(`📢 Обработка текста рассылки`);
                await this.handleCreateMailingText(ctx, text);
                break;
            default:
                console.log(`❓ Неизвестный шаг: ${state.step}`);
                break;
        }
    }
    async handleAddChannel(ctx, text) {
        try {
            console.log(`🔍 Попытка добавления канала: ${text}`);
            // Парсим ссылку на канал
            let channelId = '';
            let inviteLink = '';
            if (text.startsWith('@')) {
                channelId = text;
                inviteLink = `https://t.me/${text.substring(1)}`;
            }
            else if (text.startsWith('https://t.me/')) {
                const username = text.replace('https://t.me/', '');
                channelId = `@${username}`;
                inviteLink = text;
            }
            else if (text.startsWith('t.me/')) {
                const username = text.replace('t.me/', '');
                channelId = `@${username}`;
                inviteLink = `https://t.me/${username}`;
            }
            else {
                await ctx.reply('❌ Неверный формат ссылки. Используйте @channel_name или https://t.me/channel_name');
                return;
            }
            console.log(`📺 Парсинг канала: ID=${channelId}, Link=${inviteLink}`);
            // Получаем информацию о канале
            try {
                const chat = await this.bot.api.getChat(channelId);
                console.log(`📋 Информация о канале:`, chat);
                try {
                    const channel = await this.channelService.createChannel(channelId, chat.title || chat.username || 'Неизвестный канал', inviteLink);
                    console.log(`✅ Канал создан в БД:`, channel);
                    await ctx.reply(`✅ Канал успешно добавлен!\n\n📺 Название: ${channel.name}\n🔗 Ссылка: \`${channel.invite_link}\``, {
                        parse_mode: 'Markdown',
                        reply_markup: Keyboards.backToAdmin()
                    });
                    delete this.adminStates[ctx.from.id];
                }
                catch (dbError) {
                    if (dbError.code === 'SQLITE_CONSTRAINT') {
                        console.log(`⚠️ Канал уже существует: ${channelId}`);
                        await ctx.reply(`⚠️ Канал уже добавлен в базу данных!\n\n📺 Название: ${chat.title || chat.username}\n🔗 Ссылка: \`${inviteLink}\``, {
                            parse_mode: 'Markdown',
                            reply_markup: Keyboards.backToAdmin()
                        });
                        delete this.adminStates[ctx.from.id];
                    }
                    else {
                        console.error(`❌ Ошибка базы данных:`, dbError);
                        await ctx.reply('❌ Ошибка при сохранении канала в базу данных.');
                    }
                }
            }
            catch (error) {
                console.error(`❌ Ошибка получения информации о канале:`, error);
                await ctx.reply('❌ Не удалось получить информацию о канале. Убедитесь, что бот добавлен в канал.');
            }
        }
        catch (error) {
            console.error(`❌ Общая ошибка при добавлении канала:`, error);
            await ctx.reply('❌ Ошибка при добавлении канала.');
        }
        finally {
            // Удаляем состояние только если операция завершена успешно
            if (!this.adminStates[ctx.from.id] || this.adminStates[ctx.from.id].step !== 'add_channel') {
                delete this.adminStates[ctx.from.id];
            }
        }
    }
    async handleCreateRaffleTitle(ctx, text) {
        this.adminStates[ctx.from.id] = {
            step: 'create_raffle_prize',
            tempData: { title: text }
        };
        await ctx.reply(`✅ Название: ${text}\n\n📝 *Шаг 2 из 5: Описание приза*\n\nВведите подробное описание приза:`, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.cancelAction()
        });
    }
    async handleCreateRafflePrize(ctx, text) {
        this.adminStates[ctx.from.id] = {
            step: 'create_raffle_winners',
            tempData: {
                title: this.adminStates[ctx.from.id].tempData.title,
                prize: text
            }
        };
        await ctx.reply(`✅ Приз: ${text}\n\n📝 *Шаг 3 из 5: Количество победителей*\n\nВведите количество победителей (например: 1, 3, 5):`, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.cancelAction()
        });
    }
    async handleCreateRaffleWinners(ctx, text) {
        const winnersCount = parseInt(text);
        if (isNaN(winnersCount) || winnersCount < 1) {
            await ctx.reply('❌ Введите корректное число победителей (минимум 1):');
            return;
        }
        this.adminStates[ctx.from.id] = {
            step: 'create_raffle_duration',
            tempData: {
                title: this.adminStates[ctx.from.id].tempData.title,
                prize: this.adminStates[ctx.from.id].tempData.prize,
                winnersCount
            }
        };
        await ctx.reply(`✅ Победителей: ${winnersCount}\n\n📝 *Шаг 4 из 5: Длительность розыгрыша*\n\nВведите длительность розыгрыша в часах (например, 24 для суток):`, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.cancelAction()
        });
    }
    async handleCreateRaffleDuration(ctx, text) {
        const hours = parseInt(text);
        if (isNaN(hours) || hours < 1) {
            await ctx.reply('❌ Введите корректное количество часов (минимум 1):');
            return;
        }
        const endDate = new Date();
        endDate.setHours(endDate.getHours() + hours);
        // Сохраняем данные розыгрыша и переходим к выбору каналов
        this.adminStates[ctx.from.id] = {
            step: 'create_raffle_channels',
            tempData: {
                title: this.adminStates[ctx.from.id].tempData.title,
                prize: this.adminStates[ctx.from.id].tempData.prize,
                winnersCount: this.adminStates[ctx.from.id].tempData.winnersCount,
                endDate: endDate
            }
        };
        // Получаем список доступных каналов
        const channels = await this.channelService.getAllChannels();
        if (channels.length === 0) {
            await ctx.reply(`✅ Данные розыгрыша сохранены!\n\n📝 Название: ${this.adminStates[ctx.from.id].tempData.title}\n🎁 Приз: ${this.adminStates[ctx.from.id].tempData.prize}\n🏆 Победителей: ${this.adminStates[ctx.from.id].tempData.winnersCount}\n⏰ Длительность: ${hours} часов\n\n❌ *Нет доступных каналов!*\n\nСначала добавьте каналы в разделе "Управление каналами", затем создайте розыгрыш заново.`, {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.backToAdmin()
            });
            delete this.adminStates[ctx.from.id];
            return;
        }
        let channelsText = `✅ Данные розыгрыша сохранены!\n\n📝 Название: ${this.adminStates[ctx.from.id].tempData.title}\n🎁 Приз: ${this.adminStates[ctx.from.id].tempData.prize}\n🏆 Победителей: ${this.adminStates[ctx.from.id].tempData.winnersCount}\n⏰ Длительность: ${hours} часов\n\n📺 *Выберите каналы для розыгрыша:*\n\n`;
        channels.forEach((channel, index) => {
            channelsText += `${index + 1}. ${channel.name}\n`;
        });
        channelsText += `\n💡 *Инструкция:*\n`;
        channelsText += `• Нажмите номера каналов для выбора\n`;
        channelsText += `• Повторное нажатие отменит выбор\n`;
        channelsText += `• Нажмите "✅ Создать розыгрыш" для завершения`;
        const keyboard = new InlineKeyboard();
        // Добавляем кнопки для каждого канала
        channels.forEach((channel, index) => {
            keyboard.text(`${index + 1}`, `select_channel_${channel.id}`);
            if ((index + 1) % 3 === 0)
                keyboard.row();
        });
        keyboard.row().text('✅ Создать розыгрыш', 'create_raffle_final');
        keyboard.row().text('❌ Отмена', 'cancel_action');
        await ctx.reply(channelsText, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    async handleSelectChannel(ctx, channelId) {
        const state = this.adminStates[ctx.from.id];
        if (!state || state.step !== 'create_raffle_channels') {
            await ctx.answerCallbackQuery('❌ Неверное состояние');
            return;
        }
        // Инициализируем массив выбранных каналов, если его нет
        if (!state.tempData.selectedChannels) {
            state.tempData.selectedChannels = [];
        }
        const channelIndex = state.tempData.selectedChannels.indexOf(channelId);
        if (channelIndex === -1) {
            // Добавляем канал
            state.tempData.selectedChannels.push(channelId);
            await ctx.answerCallbackQuery('✅ Канал добавлен');
        }
        else {
            // Удаляем канал
            state.tempData.selectedChannels.splice(channelIndex, 1);
            await ctx.answerCallbackQuery('❌ Канал удален');
        }
        // Обновляем сообщение с текущим состоянием
        await this.updateChannelSelectionMessage(ctx);
    }
    async updateChannelSelectionMessage(ctx) {
        const state = this.adminStates[ctx.from.id];
        if (!state || state.step !== 'create_raffle_channels')
            return;
        const channels = await this.channelService.getAllChannels();
        const selectedChannels = state.tempData.selectedChannels || [];
        let text = `✅ Данные розыгрыша сохранены!\n\n📝 Название: ${state.tempData.title}\n🎁 Приз: ${state.tempData.prize}\n🏆 Победителей: ${state.tempData.winnersCount}\n⏰ Длительность: ${Math.round((state.tempData.endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60))} часов\n\n📺 *Выберите каналы для розыгрыша:*\n\n`;
        channels.forEach((channel, index) => {
            const isSelected = selectedChannels.includes(channel.id);
            const status = isSelected ? '✅' : '❌';
            text += `${index + 1}. ${status} ${channel.name}\n`;
        });
        text += `\n💡 *Инструкция:*\n`;
        text += `• Нажмите номера каналов для выбора\n`;
        text += `• Повторное нажатие отменит выбор\n`;
        text += `• Нажмите "✅ Создать розыгрыш" для завершения`;
        const keyboard = new InlineKeyboard();
        // Добавляем кнопки для каждого канала
        channels.forEach((channel, index) => {
            keyboard.text(`${index + 1}`, `select_channel_${channel.id}`);
            if ((index + 1) % 3 === 0)
                keyboard.row();
        });
        keyboard.row().text('✅ Создать розыгрыш', 'create_raffle_final');
        keyboard.row().text('❌ Отмена', 'cancel_action');
        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    async handleCreateRaffleFinal(ctx) {
        const state = this.adminStates[ctx.from.id];
        if (!state || state.step !== 'create_raffle_channels') {
            await ctx.answerCallbackQuery('❌ Неверное состояние');
            return;
        }
        const selectedChannels = state.tempData.selectedChannels || [];
        try {
            const raffle = await this.raffleService.createRaffle(state.tempData.prize, state.tempData.winnersCount, state.tempData.endDate, selectedChannels);
            const successText = `🎉 *Розыгрыш успешно создан!*

📝 Название: ${state.tempData.title}
🎁 Приз: ${raffle.prize_description}
🏆 Победителей: ${raffle.winners_count}
⏰ Завершение: ${raffle.end_date.toLocaleString('ru-RU')}
📺 Каналов: ${selectedChannels.length}

💡 *Следующие шаги:*
1. Опубликуйте розыгрыш в разделе "Опубликовать розыгрыш"`;
            await ctx.editMessageText(successText, {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.backToAdmin()
            });
        }
        catch (error) {
            console.error('❌ Ошибка при создании розыгрыша:', error);
            await ctx.editMessageText('❌ Ошибка при создании розыгрыша.', {
                reply_markup: Keyboards.backToAdmin()
            });
        }
        finally {
            delete this.adminStates[ctx.from.id];
        }
    }
    async handleCreateMailingText(ctx, text) {
        try {
            const mailing = await this.mailingService.createMailing(MailingType.ALL_USERS, text);
            await ctx.reply(`✅ Рассылка создана!\n\n📢 Текст: ${mailing.message_text.substring(0, 100)}${mailing.message_text.length > 100 ? '...' : ''}`, { reply_markup: Keyboards.backToAdmin() });
        }
        catch (error) {
            await ctx.reply('❌ Ошибка при создании рассылки.');
        }
        finally {
            delete this.adminStates[ctx.from.id];
        }
    }
    async cancelAction(ctx) {
        delete this.adminStates[ctx.from.id];
        await this.showMainAdminMenu(ctx);
    }
    async showMainAdminMenu(ctx) {
        await ctx.editMessageText('🔧 *Админ-панель*\n\nВыберите раздел для управления:', {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.mainAdmin()
        });
    }
    async showChannelsMenu(ctx) {
        await ctx.editMessageText('📺 *Управление каналами*\n\nВыберите действие:', {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.channelsMenu()
        });
    }
    async showRafflesMenu(ctx) {
        await ctx.editMessageText('🎁 *Управление розыгрышами*\n\nВыберите действие:', {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.rafflesMenu()
        });
    }
    async showMailingsMenu(ctx) {
        await ctx.editMessageText('📢 *Рассылки*\n\nВыберите действие:', {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.mailingsMenu()
        });
    }
    async showStats(ctx) {
        const usersCount = await this.userService.getUsersCount();
        const allRaffles = await this.raffleService.getAllRaffles();
        const activeRaffles = allRaffles.filter(r => r.status === 'ACTIVE');
        const finishedRaffles = allRaffles.filter(r => r.status === 'FINISHED');
        const channels = await this.channelService.getAllChannels();
        const statsText = `📊 *Статистика бота*

👥 Всего пользователей: ${usersCount}
📺 Каналов-партнеров: ${channels.length}

🎁 Розыгрыши:
• Активные: ${activeRaffles.length}
• Завершенные: ${finishedRaffles.length}
• Всего: ${allRaffles.length}

📢 Рассылки: Доступны`;
        await ctx.editMessageText(statsText, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.backToAdmin()
        });
    }
    async showSettings(ctx) {
        const settingsText = `⚙️ *Настройки бота*

🔧 *Доступные настройки:*
• 📊 Статистика и аналитика
• 🔔 Уведомления
• 🎁 Автоматические розыгрыши
• 📢 Рассылки

💡 *Функции в разработке:*
• Автоматическая проверка подписок
• Интеграция с внешними сервисами
• Расширенная аналитика

🛠️ *Техническая информация:*
• Версия бота: 1.0.0
• База данных: SQLite
• Статус: Активен`;
        await ctx.editMessageText(settingsText, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.backToAdmin()
        });
    }
    async startAddChannel(ctx) {
        console.log(`➕ Начало добавления канала для пользователя ${ctx.from.id}`);
        this.adminStates[ctx.from.id] = {
            step: 'add_channel',
            tempData: {}
        };
        console.log(`📝 Установлено состояние:`, this.adminStates[ctx.from.id]);
        await ctx.editMessageText('➕ *Добавление канала*\n\nОтправьте ссылку на канал (например, @channel_name или https://t.me/channel_name)', {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.cancelAction()
        });
    }
    async showChannelsList(ctx) {
        const channels = await this.channelService.getAllChannels();
        if (channels.length === 0) {
            await ctx.editMessageText('📺 *Список каналов*\n\nКаналы не добавлены.', {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.backToAdmin()
            });
            return;
        }
        let text = '📺 *Список каналов:*\n\n';
        channels.forEach((channel, index) => {
            text += `${index + 1}. *${channel.name}*\n`;
            text += `   \`${channel.invite_link}\`\n\n`;
        });
        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.backToAdmin()
        });
    }
    async startCreateRaffle(ctx) {
        this.adminStates[ctx.from.id] = {
            step: 'create_raffle_title',
            tempData: {}
        };
        await ctx.editMessageText('🎁 *Создание розыгрыша*\n\n📝 *Шаг 1 из 5: Название розыгрыша*\n\nВведите название розыгрыша (например: "Розыгрыш iPhone 15"):', {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.cancelAction()
        });
    }
    async showActiveRaffles(ctx) {
        const activeRaffles = await this.raffleService.getRafflesByStatus(RaffleStatus.ACTIVE);
        if (activeRaffles.length === 0) {
            await ctx.editMessageText('🎁 *Активные розыгрыши*\n\nНет активных розыгрышей.', {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.backToAdmin()
            });
            return;
        }
        let text = '🎁 *Активные розыгрыши:*\n\n';
        activeRaffles.forEach((raffle, index) => {
            text += `${index + 1}. ${raffle.prize_description}\n`;
            text += `   Победителей: ${raffle.winners_count}\n`;
            text += `   Завершение: ${raffle.end_date.toLocaleString('ru-RU')}\n\n`;
        });
        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.backToAdmin()
        });
    }
    async showFinishedRaffles(ctx) {
        const finishedRaffles = await this.raffleService.getRafflesByStatus(RaffleStatus.FINISHED);
        if (finishedRaffles.length === 0) {
            await ctx.editMessageText('✅ *Завершенные розыгрыши*\n\nНет завершенных розыгрышей.', {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.backToAdmin()
            });
            return;
        }
        let text = '✅ *Завершенные розыгрыши:*\n\n';
        finishedRaffles.slice(0, 10).forEach((raffle, index) => {
            text += `${index + 1}. ${raffle.prize_description}\n`;
            text += `   Победителей: ${raffle.winners_count}\n`;
            text += `   Завершен: ${raffle.end_date.toLocaleString('ru-RU')}\n\n`;
        });
        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.backToAdmin()
        });
    }
    async startCreateMailing(ctx) {
        this.adminStates[ctx.from.id] = {
            step: 'create_mailing_text',
            tempData: {}
        };
        await ctx.editMessageText('📢 *Создание рассылки*\n\nВведите текст рассылки:', {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.cancelAction()
        });
    }
    async showMailingsList(ctx) {
        const mailings = await this.mailingService.getAllMailings();
        if (mailings.length === 0) {
            await ctx.editMessageText('📢 *Список рассылок*\n\nРассылки не созданы.', {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.backToAdmin()
            });
            return;
        }
        let text = '📢 *Список рассылок:*\n\n';
        mailings.slice(0, 10).forEach((mailing, index) => {
            text += `${index + 1}. ${mailing.message_text.substring(0, 50)}...\n`;
            text += `   Статус: ${mailing.status}\n`;
            text += `   Отправлено: ${mailing.sent_count}\n\n`;
        });
        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.backToAdmin()
        });
    }
    async startPublishRaffle(ctx) {
        const activeRaffles = await this.raffleService.getActiveRafflesWithChannels();
        if (activeRaffles.length === 0) {
            await ctx.editMessageText('🎁 *Публикация розыгрышей*\n\nНет активных розыгрышей для публикации.', {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.backToAdmin()
            });
            return;
        }
        let text = '🎁 *Публикация розыгрышей*\n\nВыберите розыгрыш для публикации:\n\n';
        for (let i = 0; i < activeRaffles.length; i++) {
            const { raffle, channels } = activeRaffles[i];
            text += `${i + 1}. ${raffle.prize_description}\n`;
            text += `   Победителей: ${raffle.winners_count}\n`;
            text += `   Завершение: ${raffle.end_date.toLocaleString('ru-RU')}\n`;
            text += `   Каналов: ${channels.length}\n\n`;
        }
        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.rafflesToPublish(activeRaffles.map((_, index) => index))
        });
    }
    async publishRaffleToChannels(ctx, raffleIndex) {
        const activeRaffles = await this.raffleService.getActiveRafflesWithChannels();
        const selectedRaffle = activeRaffles[raffleIndex];
        if (!selectedRaffle) {
            await ctx.editMessageText('❌ Розыгрыш не найден.');
            return;
        }
        const { raffle, channels } = selectedRaffle;
        if (channels.length === 0) {
            await ctx.editMessageText('❌ У этого розыгрыша нет связанных каналов. Сначала добавьте каналы.', {
                reply_markup: Keyboards.backToAdmin()
            });
            return;
        }
        let successCount = 0;
        let failCount = 0;
        for (const channel of channels) {
            try {
                const messageText = `🎉 *РОЗЫГРЫШ!*

🎁 *Приз:* ${raffle.prize_description}
🏆 *Победителей:* ${raffle.winners_count}
⏰ *Завершение:* ${raffle.end_date.toLocaleString('ru-RU')}

🎯 *Как участвовать:*
1. Нажмите кнопку "Участвовать" ниже
2. Подпишитесь на все указанные каналы
3. Дождитесь результатов розыгрыша

Удачи! 🍀`;
                await this.bot.api.sendMessage(channel.telegram_channel_id, messageText, {
                    parse_mode: 'Markdown',
                    reply_markup: Keyboards.participateInRaffle(raffle.id)
                });
                successCount++;
            }
            catch (error) {
                console.error(`Ошибка публикации в канал ${channel.name}:`, error);
                failCount++;
            }
        }
        await ctx.editMessageText(`✅ *Публикация завершена*\n\n📊 Результаты:\n• Успешно: ${successCount}\n• Ошибок: ${failCount}`, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.backToAdmin()
        });
    }
}
//# sourceMappingURL=adminHandlers.js.map