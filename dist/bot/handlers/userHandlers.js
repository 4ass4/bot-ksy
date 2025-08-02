import { InlineKeyboard } from 'grammy';
import { MailingType, RaffleStatus, AnalyticsEventType } from '../../types/index.js';
import { Keyboards } from '../keyboards.js';
export class UnifiedHandlers {
    bot;
    userService;
    raffleService;
    channelService;
    mailingService;
    officialChannelService;
    botSettingsService;
    referralService;
    analyticsService;
    socialService;
    socialAccountService;
    adminStates = {};
    adminIds;
    // Универсальный метод для отправки сообщений с fallback
    async sendMessage(ctx, text, options = {}) {
        try {
            await ctx.editMessageText(text, options);
        }
        catch (error) {
            if (error.description && error.description.includes('message is not modified')) {
                // Сообщение не изменилось, это нормально
                console.log('ℹ️ Сообщение не изменилось, пропускаем ошибку');
                return;
            }
            console.log('⚠️ Не удалось отредактировать сообщение, отправляем новое:', error.message);
            await ctx.reply(text, options);
        }
    }
    constructor(bot, userService, raffleService, channelService, mailingService, officialChannelService, botSettingsService, referralService, analyticsService, socialService, socialAccountService) {
        this.bot = bot;
        this.userService = userService;
        this.raffleService = raffleService;
        this.channelService = channelService;
        this.mailingService = mailingService;
        this.officialChannelService = officialChannelService;
        this.botSettingsService = botSettingsService;
        this.referralService = referralService;
        this.analyticsService = analyticsService;
        this.socialService = socialService;
        this.socialAccountService = socialAccountService;
        // Получаем ID админов из переменных окружения
        const adminIds = process.env.ADMIN_IDS || '';
        this.adminIds = adminIds.split(',').map(id => parseInt(id.trim())).filter(id => id > 0);
        console.log(`🔧 Загружены ID админов: ${this.adminIds.join(', ')}`);
    }
    register() {
        // Команда старт
        this.bot.command('start', async (ctx) => {
            if (!ctx.from)
                return;
            console.log(`🚀 Команда /start от пользователя ${ctx.from.id}`);
            const user = ctx.from;
            // Регистрируем или обновляем пользователя
            const createdUser = await this.userService.createUser(user.id, user.first_name || '', user.last_name || '', user.username || '');
            // Обрабатываем реферальный код, если есть
            const startParam = ctx.match;
            let autoEnrolledRaffles = [];
            if (startParam) {
                const isReferral = await this.referralService.processStartParameter(startParam, createdUser.id);
                if (isReferral) {
                    console.log(`📢 Пользователь ${user.id} пришел по реферальной ссылке`);
                    await this.analyticsService.trackEvent(AnalyticsEventType.REFERRAL_CREATED, createdUser.id, undefined, undefined, startParam);
                    // Проверяем, в какие розыгрыши пользователь был автоматически зачислен
                    autoEnrolledRaffles = await this.getAutoEnrolledRaffles(createdUser.id);
                }
            }
            // Отслеживаем регистрацию
            await this.analyticsService.trackEvent(AnalyticsEventType.USER_REGISTERED, createdUser.id);
            let welcomeText = `👋 Добро пожаловать в бот для розыгрышей!

🎁 Здесь вы можете участвовать в различных розыгрышах и конкурсах.

💡 Выберите действие из меню ниже:`;
            // Если пользователь был автоматически зачислен в розыгрыши, показываем уведомление
            if (autoEnrolledRaffles.length > 0) {
                welcomeText += `\n\n🎉 *Отличные новости!*\n`;
                welcomeText += `Вы были автоматически зачислены в ${autoEnrolledRaffles.length} розыгрыш${autoEnrolledRaffles.length > 1 ? 'ей' : ''}!\n`;
                welcomeText += `Проверьте раздел "🎁 Мои розыгрыши" для подробностей.`;
            }
            await ctx.reply(welcomeText, {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.mainUser()
            });
        });
        // Команда админ панели
        this.bot.command('admin', async (ctx) => {
            if (!ctx.from)
                return;
            if (!this.adminIds.includes(ctx.from.id)) {
                await ctx.reply('❌ У вас нет доступа к админ-панели.');
                return;
            }
            console.log(`🔧 Команда /admin от пользователя ${ctx.from.id}`);
            console.log(`✅ Пользователь ${ctx.from.id} получил доступ к админ-панели`);
            const adminText = `🔧 *Админ-панель*

Выберите действие:`;
            await ctx.reply(adminText, {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.adminMain()
            });
        });
        // Команда помощи
        this.bot.command('help', async (ctx) => {
            await this.showHelp(ctx);
        });
        // Команда просмотра участий
        this.bot.command('my_raffles', async (ctx) => {
            await this.showUserRaffles(ctx);
        });
        // Обработка всех callback query
        this.bot.on('callback_query:data', async (ctx) => {
            const data = ctx.callbackQuery?.data;
            if (!ctx.from || !data)
                return;
            const userId = ctx.from.id;
            console.log(`🔘 Нажата кнопка: ${data} от пользователя ${userId}`);
            // Обрабатываем все кнопки в едином обработчике
            await this.handleCallback(ctx, data);
            await ctx.answerCallbackQuery();
        });
        // Обработка текстовых сообщений
        this.bot.on('message:text', async (ctx) => {
            if (!ctx.from)
                return;
            const userId = ctx.from.id;
            const text = ctx.message?.text;
            if (!text)
                return;
            // Пропускаем команды
            if (text.startsWith('/')) {
                console.log(`🚫 Пропускаем команду: ${text}`);
                return;
            }
            // Проверяем, является ли пользователь админом
            const isAdmin = this.adminIds.includes(userId);
            if (isAdmin) {
                console.log(`📨 Получено текстовое сообщение от ${userId}: "${text}"`);
                await this.handleAdminText(ctx, text);
            }
        });
        // Обработка медиа-сообщений (фото и видео)
        this.bot.on('message:photo', async (ctx) => {
            if (!ctx.from)
                return;
            const userId = ctx.from.id;
            const isAdmin = this.adminIds.includes(userId);
            if (isAdmin) {
                console.log(`🖼️ Получено фото от ${userId}`);
                await this.handleAdminMedia(ctx);
            }
        });
        this.bot.on('message:video', async (ctx) => {
            if (!ctx.from)
                return;
            const userId = ctx.from.id;
            const isAdmin = this.adminIds.includes(userId);
            if (isAdmin) {
                console.log(`📹 Получено видео от ${userId}`);
                await this.handleAdminMedia(ctx);
            }
        });
    }
    // ===== ЕДИНЫЙ ОБРАБОТЧИК ВСЕХ КНОПОК =====
    async handleCallback(ctx, data) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        const isAdmin = this.adminIds.includes(userId);
        // Админские кнопки - только для админов
        // Исключаем пользовательские кнопки реферальной системы
        const isUserReferralButton = data === 'referral_system' ||
            data === 'referral_link' ||
            data === 'referral_stats' ||
            data === 'referral_list' ||
            data === 'referral_top' ||
            data === 'referral_copy_link' ||
            data === 'referral_share' ||
            data.startsWith('referral_system_') ||
            data.startsWith('referral_link_') ||
            data.startsWith('referral_stats_') ||
            data.startsWith('referral_list_') ||
            data.startsWith('referral_top_') ||
            data.startsWith('check_referrals_');
        if (!isUserReferralButton && ((data.startsWith('admin_') && data !== 'admin_panel') || data.startsWith('back_admin') ||
            data.startsWith('channels_') || data.startsWith('raffles_') ||
            data.startsWith('mailings_') || data.startsWith('cancel_action') ||
            data.startsWith('publish_raffle') || data.startsWith('edit_raffle') ||
            data.startsWith('select_channel_') || data.startsWith('create_raffle_final') ||
            data.startsWith('delete_channel_') || data.startsWith('delete_raffle_') ||
            data.startsWith('delete_raffles_') || data.startsWith('official_channel_') ||
            data.startsWith('mailing_type_') || data.startsWith('mailing_schedule_') ||
            data.startsWith('mailing_add_') || data.startsWith('mailing_skip_') ||
            data.startsWith('raffle_add_') || data.startsWith('raffle_skip_') ||
            data.startsWith('raffle_type_') || data.startsWith('referral_requirement_') ||
            data.startsWith('delete_mailing_') || data.startsWith('settings_') ||
            data.startsWith('social_') || data.startsWith('select_social_'))) {
            if (!isAdmin) {
                console.log(`🚫 Пользователь ${userId} не является админом для кнопки: ${data}`);
                await ctx.answerCallbackQuery('❌ У вас нет доступа к этой функции');
                return;
            }
            console.log(`✅ Обработка админской кнопки ${userId}: ${data}`);
            await this.handleAdminCallback(ctx, data);
            return;
        }
        // Пользовательские кнопки - для всех
        console.log(`🔘 Обработка пользовательской кнопки ${userId}: ${data}`);
        await this.handleUserCallback(ctx, data);
    }
    async handleUserCallback(ctx, data) {
        if (!ctx.from)
            return;
        if (data.startsWith('participate_')) {
            const raffleId = parseInt(data.replace('participate_', ''));
            await this.handleParticipation(ctx, raffleId);
        }
        else if (data.startsWith('subscribe_')) {
            const channelId = parseInt(data.replace('subscribe_', ''));
            await this.handleSubscribeToChannel(ctx, channelId);
        }
        else if (data.startsWith('check_subscription_')) {
            const raffleId = parseInt(data.replace('check_subscription_', ''));
            await this.checkSubscriptionAndParticipate(ctx, raffleId);
        }
        else if (data.startsWith('check_subs_')) {
            const raffleId = parseInt(data.replace('check_subs_', ''));
            await this.checkSubscriptions(ctx, raffleId);
        }
        else if (data.startsWith('check_social_subscription_')) {
            const raffleId = parseInt(data.replace('check_social_subscription_', ''));
            await this.checkSocialSubscriptions(ctx, raffleId);
        }
        else if (data.startsWith('check_combined_subscription_')) {
            const raffleId = parseInt(data.replace('check_combined_subscription_', ''));
            await this.checkCombinedSubscriptions(ctx, raffleId);
        }
        else if (data === 'my_raffles') {
            await this.showUserRaffles(ctx);
        }
        else if (data === 'active_raffles') {
            await this.showActiveRaffles(ctx);
        }
        else if (data.startsWith('view_raffle_')) {
            const raffleId = parseInt(data.replace('view_raffle_', ''));
            await this.showRaffleDetails(ctx, raffleId);
        }
        else if (data === 'help_command') {
            await this.showHelp(ctx);
        }
        else if (data === 'official_channel') {
            await this.showOfficialChannel(ctx);
        }
        else if (data === 'admin_panel') {
            await this.handleAdminPanelAccess(ctx);
        }
        else if (data === 'back_to_main') {
            await this.showMainMenu(ctx);
        }
        else if (data === 'referral_system') {
            await this.showReferralSystem(ctx);
        }
        else if (data.startsWith('referral_system_')) {
            const raffleId = parseInt(data.replace('referral_system_', ''));
            await this.showReferralSystemWithContext(ctx, raffleId);
        }
        else if (data.startsWith('check_referrals_')) {
            const raffleId = parseInt(data.replace('check_referrals_', ''));
            await this.checkReferralRequirements(ctx, raffleId);
        }
        else if (data === 'referral_link') {
            await this.showReferralLink(ctx);
        }
        else if (data === 'referral_stats') {
            await this.showReferralStats(ctx);
        }
        else if (data === 'referral_list') {
            await this.showReferralList(ctx);
        }
        else if (data === 'referral_top') {
            await this.showReferralTop(ctx);
        }
        else if (data === 'referral_copy_link') {
            await this.copyReferralLink(ctx);
        }
        else if (data === 'referral_share') {
            await this.shareReferralLink(ctx);
        }
        // Обработчики для реферальной системы с контекстом
        else if (data.startsWith('referral_link_')) {
            const raffleId = parseInt(data.replace('referral_link_', ''));
            await this.showReferralLinkWithContext(ctx, raffleId);
        }
        else if (data.startsWith('referral_stats_')) {
            const raffleId = parseInt(data.replace('referral_stats_', ''));
            await this.showReferralStatsWithContext(ctx, raffleId);
        }
        else if (data.startsWith('referral_list_')) {
            const raffleId = parseInt(data.replace('referral_list_', ''));
            await this.showReferralListWithContext(ctx, raffleId);
        }
        else if (data.startsWith('referral_top_')) {
            const raffleId = parseInt(data.replace('referral_top_', ''));
            await this.showReferralTopWithContext(ctx, raffleId);
        }
        else {
            console.log(`❓ Неизвестная пользовательская кнопка: ${data}`);
        }
    }
    // ===== АДМИНСКИЕ ОБРАБОТЧИКИ =====
    async handleAdminCallback(ctx, data) {
        if (!ctx.from)
            return;
        switch (data) {
            case 'admin_raffles':
                console.log('🎁 Обработка кнопки admin_raffles');
                await this.showAdminRaffles(ctx);
                break;
            case 'admin_channels':
                console.log('📺 Обработка кнопки admin_channels');
                await this.showAdminChannels(ctx);
                break;
            case 'admin_mailings':
                console.log('📢 Обработка кнопки admin_mailings');
                await this.showAdminMailings(ctx);
                break;
            case 'admin_stats':
                console.log('📊 Обработка кнопки admin_stats');
                await this.showAdminStats(ctx);
                break;
            case 'admin_settings':
                console.log('⚙️ Обработка кнопки admin_settings');
                await this.showBotSettings(ctx);
                break;
            case 'back_admin':
                console.log('🔄 Обработка кнопки back_admin');
                await this.showAdminMain(ctx);
                break;
            case 'back_to_main':
                console.log('🏠 Обработка кнопки back_to_main');
                await this.showMainMenu(ctx);
                break;
            case 'raffles_create':
                console.log('🎁 Обработка кнопки raffles_create');
                await this.startCreateRaffle(ctx);
                break;
            case 'raffles_active':
                console.log('📋 Обработка кнопки raffles_active');
                await this.showActiveRafflesAdmin(ctx);
                break;
            case 'channels_list':
                console.log('📋 Обработка кнопки channels_list');
                await this.showChannelsList(ctx);
                break;
            case 'channels_add':
                console.log('➕ Обработка кнопки channels_add');
                await this.startAddChannel(ctx);
                break;
            case 'mailings_create':
                console.log('📢 Обработка кнопки mailings_create');
                await this.startCreateMailing(ctx);
                break;
            case 'mailings_list':
                console.log('📋 Обработка кнопки mailings_list');
                await this.showMailingsList(ctx);
                break;
            case 'mailings_delete':
                console.log('🗑️ Обработка кнопки mailings_delete');
                await this.showMailingsToDelete(ctx);
                break;
            case 'mailing_type_all_users':
                console.log('👥 Обработка выбора типа рассылки: всем пользователям');
                await this.handleSelectMailingType(ctx, MailingType.ALL_USERS);
                break;
            case 'mailing_type_raffle_participants':
                console.log('🎁 Обработка выбора типа рассылки: участникам розыгрыша');
                await this.handleSelectMailingType(ctx, MailingType.RAFFLE_PARTICIPANTS);
                break;
            case 'mailing_schedule_now':
                console.log('🚀 Обработка выбора времени: отправить сейчас');
                await this.handleSelectMailingSchedule(ctx, 'now');
                break;
            case 'mailing_schedule_custom':
                console.log('📅 Обработка выбора времени: запланировать');
                await this.handleSelectMailingSchedule(ctx, 'custom');
                break;
            case 'mailing_add_photo':
                console.log('🖼️ Обработка добавления фото к рассылке');
                await this.handleAddMailingPhoto(ctx);
                break;
            case 'mailing_add_video':
                console.log('📹 Обработка добавления видео к рассылке');
                await this.handleAddMailingVideo(ctx);
                break;
            case 'mailing_skip_media':
                console.log('⏭️ Пропуск медиа для рассылки');
                await this.handleSkipMailingMedia(ctx);
                break;
            case 'raffle_add_photo':
                console.log('🖼️ Обработка добавления фото к розыгрышу');
                await this.handleAddRafflePhoto(ctx);
                break;
            case 'raffle_add_video':
                console.log('📹 Обработка добавления видео к розыгрышу');
                await this.handleAddRaffleVideo(ctx);
                break;
            case 'raffle_skip_media':
                console.log('⏭️ Пропуск медиа для розыгрыша');
                await this.handleSkipRaffleMedia(ctx);
                break;
            case (data.match(/^delete_mailing_(\d+)$/) ? data : null):
                const mailingId = parseInt(data.replace('delete_mailing_', ''));
                console.log(`🗑️ Обработка удаления рассылки #${mailingId}`);
                await this.handleDeleteMailing(ctx, mailingId);
                break;
            case 'create_raffle_final':
                console.log('✅ Обработка кнопки create_raffle_final');
                await this.handleCreateRaffleFinal(ctx);
                break;
            case 'cancel_action':
                console.log('❌ Обработка кнопки cancel_action');
                await this.cancelAdminAction(ctx);
                break;
            case 'channels_delete':
                console.log('🗑️ Обработка кнопки channels_delete');
                await this.showChannelsToDelete(ctx);
                break;
            case 'raffles_delete':
                console.log('🗑️ Обработка кнопки raffles_delete');
                await this.showRafflesToDelete(ctx);
                break;
            case 'delete_raffles_active':
                console.log('🟢 Обработка кнопки delete_raffles_active');
                await this.showActiveRafflesToDelete(ctx);
                break;
            case 'delete_raffles_finished':
                console.log('🔴 Обработка кнопки delete_raffles_finished');
                await this.showFinishedRafflesToDelete(ctx);
                break;
            case 'admin_official_channel':
                console.log('📢 Обработка кнопки admin_official_channel');
                await this.showAdminOfficialChannel(ctx);
                break;
            case 'official_channel_add':
                console.log('➕ Обработка кнопки official_channel_add');
                await this.startAddOfficialChannel(ctx);
                break;
            case 'official_channel_info':
                console.log('📋 Обработка кнопки official_channel_info');
                await this.showOfficialChannelInfo(ctx);
                break;
            case 'official_channel_delete':
                console.log('🗑️ Обработка кнопки official_channel_delete');
                await this.deleteOfficialChannel(ctx);
                break;
            case 'official_channel_edit_description':
                console.log('✏️ Обработка кнопки official_channel_edit_description');
                await this.startEditOfficialChannelDescription(ctx);
                break;
            case 'settings_welcome_message':
                console.log('✏️ Обработка кнопки settings_welcome_message');
                await this.startEditWelcomeMessage(ctx);
                break;
            case 'settings_cover_photo':
                console.log('🖼️ Обработка кнопки settings_cover_photo');
                await this.startAddCoverPhoto(ctx);
                break;
            case 'settings_remove_cover':
                console.log('🗑️ Обработка кнопки settings_remove_cover');
                await this.removeCoverPhoto(ctx);
                break;
            case 'settings_view':
                console.log('📋 Обработка кнопки settings_view');
                await this.showBotSettings(ctx);
                break;
            case 'raffle_type_normal':
                console.log('🎯 Обработка выбора обычного розыгрыша');
                await this.handleRaffleTypeSelection(ctx, 'normal');
                break;
            case 'raffle_type_referral':
                console.log('👥 Обработка выбора розыгрыша с рефералами');
                await this.handleRaffleTypeSelection(ctx, 'referral');
                break;
            case 'referral_requirement_both':
                console.log('👥 Обработка выбора: подписка + рефералы');
                await this.handleReferralRequirementSelection(ctx, 'both');
                break;
            case 'referral_requirement_subscription':
                console.log('📺 Обработка выбора: только подписка');
                await this.handleReferralRequirementSelection(ctx, 'subscription');
                break;
            case 'referral_requirement_referrals':
                console.log('👥 Обработка выбора: только рефералы');
                await this.handleReferralRequirementSelection(ctx, 'referrals');
                break;
            case 'admin_social':
                console.log('📱 Обработка кнопки admin_social');
                await this.showAdminSocial(ctx);
                break;
            case 'social_add':
                console.log('➕ Обработка кнопки social_add');
                await this.startAddSocialAccount(ctx);
                break;
            case 'social_list':
                console.log('📋 Обработка кнопки social_list');
                await this.showSocialAccountsList(ctx);
                break;
            case 'social_stats':
                console.log('📊 Обработка кнопки social_stats');
                await this.showSocialAccountsStats(ctx);
                break;
            case 'social_platform_instagram':
                console.log('📸 Обработка выбора платформы: Instagram');
                await this.handleSocialPlatformSelection(ctx, 'INSTAGRAM');
                break;
            case 'social_platform_tiktok':
                console.log('🎵 Обработка выбора платформы: TikTok');
                await this.handleSocialPlatformSelection(ctx, 'TIKTOK');
                break;
            case 'social_platform_twitter':
                console.log('🐦 Обработка выбора платформы: Twitter');
                await this.handleSocialPlatformSelection(ctx, 'TWITTER');
                break;
            case 'social_platform_facebook':
                console.log('📘 Обработка выбора платформы: Facebook');
                await this.handleSocialPlatformSelection(ctx, 'FACEBOOK');
                break;
            case 'social_platform_youtube':
                console.log('📺 Обработка выбора платформы: YouTube');
                await this.handleSocialPlatformSelection(ctx, 'YOUTUBE');
                break;
            case 'social_verified_yes':
                console.log('✅ Обработка выбора: аккаунт верифицирован');
                await this.handleSocialVerifiedSelection(ctx, true);
                break;
            case 'social_verified_no':
                console.log('❌ Обработка выбора: аккаунт не верифицирован');
                await this.handleSocialVerifiedSelection(ctx, false);
                break;
            default:
                if (data.startsWith('select_social_')) {
                    const socialAccountId = parseInt(data.replace('select_social_', ''));
                    console.log(`📱 Обработка выбора социального аккаунта ${socialAccountId}`);
                    await this.handleSelectSocialAccount(ctx, socialAccountId);
                }
                else if (data.startsWith('edit_raffle_')) {
                    const raffleId = parseInt(data.replace('edit_raffle_', ''));
                    console.log(`✏️ Обработка редактирования розыгрыша ${raffleId}`);
                    await this.startEditRaffle(ctx, raffleId);
                }
                else if (data.startsWith('publish_raffle_')) {
                    const raffleId = parseInt(data.replace('publish_raffle_', ''));
                    console.log(`📢 Обработка публикации розыгрыша ${raffleId}`);
                    await this.publishRaffle(ctx, raffleId);
                }
                else if (data.startsWith('select_channel_')) {
                    const channelId = parseInt(data.replace('select_channel_', ''));
                    await this.handleSelectChannel(ctx, channelId);
                }
                else if (data.startsWith('delete_channel_')) {
                    const channelId = parseInt(data.replace('delete_channel_', ''));
                    await this.handleDeleteChannel(ctx, channelId);
                }
                else if (data.startsWith('delete_raffle_')) {
                    const raffleId = parseInt(data.replace('delete_raffle_', ''));
                    await this.handleDeleteRaffle(ctx, raffleId);
                }
                else {
                    console.log(`❓ Неизвестная кнопка: ${data}`);
                }
                break;
        }
    }
    async handleAdminText(ctx, text) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        const state = this.adminStates[userId];
        if (!state) {
            console.log(`❓ Пользователь ${userId} не имеет активного состояния`);
            return;
        }
        console.log(`✅ Обработка текстового сообщения админа ${userId} с состоянием:`, state);
        console.log(`📝 Обработка текстового сообщения: step=${state.step}, text=${text}`);
        switch (state.step) {
            case 'create_raffle_title':
                console.log('🎁 Обработка названия розыгрыша');
                await this.handleCreateRaffleTitle(ctx, text);
                break;
            case 'create_raffle_prize':
                console.log('🎁 Обработка приза розыгрыша');
                await this.handleCreateRafflePrize(ctx, text);
                break;
            case 'create_raffle_winners':
                console.log('🏆 Обработка количества победителей');
                await this.handleCreateRaffleWinners(ctx, text);
                break;
            case 'create_raffle_duration':
                console.log('⏰ Обработка длительности розыгрыша');
                await this.handleCreateRaffleDuration(ctx, text);
                break;
            case 'add_channel':
                console.log('📺 Обработка добавления канала');
                await this.handleAddChannel(ctx, text);
                break;
            case 'create_mailing_text':
                console.log('📢 Обработка текста рассылки');
                await this.handleCreateMailingText(ctx, text);
                break;
            case 'create_mailing_custom_time':
                console.log('📅 Обработка времени рассылки');
                await this.handleCreateMailingCustomTime(ctx, text);
                break;
            case 'create_mailing_photo':
                console.log('🖼️ Обработка фото для рассылки');
                await this.handleMailingPhoto(ctx);
                break;
            case 'create_mailing_video':
                console.log('📹 Обработка видео для рассылки');
                await this.handleMailingVideo(ctx);
                break;
            case 'create_raffle_photo':
                console.log('🖼️ Обработка фото для розыгрыша');
                await this.handleRafflePhoto(ctx);
                break;
            case 'create_raffle_video':
                console.log('📹 Обработка видео для розыгрыша');
                await this.handleRaffleVideo(ctx);
                break;
            case 'add_cover_photo':
                console.log('🖼️ Обработка фото для обложки бота');
                await this.handleCoverPhoto(ctx);
                break;
            case 'select_channel':
                console.log('📺 Обработка выбора каналов');
                // Игнорируем текст, так как выбор каналов происходит через кнопки
                break;
            case 'add_official_channel':
                console.log('➕ Обработка добавления официального канала');
                await this.handleAddOfficialChannel(ctx, text);
                break;
            case 'edit_official_channel_description':
                console.log('✏️ Обработка редактирования описания официального канала');
                await this.handleEditOfficialChannelDescription(ctx, text);
                break;
            case 'edit_welcome_message':
                console.log('✏️ Обработка редактирования приветственного сообщения');
                await this.handleEditWelcomeMessageText(ctx, text);
                break;
            case 'create_raffle_referral_count':
                console.log('👥 Обработка количества рефералов для розыгрыша');
                await this.handleCreateRaffleReferralCount(ctx, text);
                break;
            case 'add_social_username':
                console.log('📱 Обработка username социального аккаунта');
                await this.handleSocialUsernameInput(ctx, text);
                break;
            case 'add_social_display_name':
                console.log('📝 Обработка display_name социального аккаунта');
                await this.handleSocialDisplayNameInput(ctx, text);
                break;
            case 'add_social_profile_url':
                console.log('🔗 Обработка profile_url социального аккаунта');
                await this.handleSocialProfileUrlInput(ctx, text);
                break;
            case 'add_social_follower_count':
                console.log('👥 Обработка follower_count социального аккаунта');
                await this.handleSocialFollowerCountInput(ctx, text);
                break;
            default:
                console.log(`❓ Неизвестный шаг: ${state.step}`);
                break;
        }
    }
    async handleAdminMedia(ctx) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        const state = this.adminStates[userId];
        if (!state) {
            console.log(`❓ Пользователь ${userId} не имеет активного состояния`);
            return;
        }
        console.log(`✅ Обработка медиа-сообщения админа ${userId} с состоянием:`, state);
        switch (state.step) {
            case 'create_mailing_photo':
                console.log('🖼️ Обработка фото для рассылки');
                await this.handleMailingPhoto(ctx);
                break;
            case 'create_mailing_video':
                console.log('📹 Обработка видео для рассылки');
                await this.handleMailingVideo(ctx);
                break;
            case 'create_raffle_photo':
                console.log('🖼️ Обработка фото для розыгрыша');
                await this.handleRafflePhoto(ctx);
                break;
            case 'create_raffle_video':
                console.log('📹 Обработка видео для розыгрыша');
                await this.handleRaffleVideo(ctx);
                break;
            case 'add_cover_photo':
                console.log('🖼️ Обработка фото для обложки бота');
                await this.handleCoverPhoto(ctx);
                break;
            default:
                console.log(`❓ Неизвестный шаг для медиа: ${state.step}`);
                break;
        }
    }
    // ===== АДМИНСКИЕ МЕТОДЫ =====
    async showAdminMain(ctx) {
        const adminText = `🔧 *Админ-панель*

Выберите действие:`;
        await ctx.editMessageText(adminText, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.adminMain()
        });
    }
    async showAdminRaffles(ctx) {
        const text = `🎁 *Управление розыгрышами*

Выберите действие:`;
        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.adminRaffles()
        });
    }
    async showAdminChannels(ctx) {
        const text = `�� *Управление каналами*

Выберите действие:`;
        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.adminChannels()
        });
    }
    async showAdminMailings(ctx) {
        const text = `📢 *Управление рассылками*

Выберите действие:`;
        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.adminMailings()
        });
    }
    async showAdminStats(ctx) {
        const stats = await this.getAdminStats();
        const text = `📊 *Статистика бота*

👥 *Пользователи:*
• Всего: ${stats.totalUsers}
• За сегодня: ${stats.usersToday}

🎁 *Розыгрыши:*
• Активных: ${stats.activeRaffles}
• Всего: ${stats.totalRaffles}

📺 *Каналы:*
• Всего: ${stats.totalChannels}

📢 *Рассылки:*
• Всего: ${stats.totalMailings}`;
        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.backToAdmin()
        });
    }
    async showBotSettings(ctx) {
        console.log('⚙️ Показываем настройки бота');
        // Получаем текущие настройки
        const settings = await this.botSettingsService.getSettings();
        const text = `⚙️ *Настройки бота*

🔧 *Текущие настройки:*
• Приветственное сообщение: ${settings.welcome_message.length > 50 ? settings.welcome_message.substring(0, 50) + '...' : settings.welcome_message}
• Обложка бота: ${settings.cover_photo_file_id ? '✅ Установлена' : '❌ Не установлена'}
• Админ ID: ${this.adminIds.join(', ')}
• Статус: Активен
• Версия: 1.0.0

💡 Выберите действие для изменения настроек:`;
        await this.sendMessage(ctx, text, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.botSettings()
        });
    }
    async startCreateRaffle(ctx) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        this.adminStates[userId] = {
            step: 'create_raffle_type',
            tempData: {}
        };
        await ctx.editMessageText('🎯 Выберите тип розыгрыша:', {
            reply_markup: Keyboards.raffleCreationType()
        });
    }
    async handleCreateRaffleTitle(ctx, text) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        this.adminStates[userId].tempData.title = text;
        this.adminStates[userId].step = 'create_raffle_prize';
        await ctx.reply('🎁 Введите описание приза:');
    }
    async handleCreateRafflePrize(ctx, text) {
        const userId = ctx.from.id;
        this.adminStates[userId].tempData.prize = text;
        this.adminStates[userId].step = 'create_raffle_media';
        try {
            await ctx.editMessageText('🎁 *Описание приза:* ' + text + '\n\nТеперь выберите медиа для приза:', {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.raffleMediaSelection()
            });
        }
        catch (error) {
            await ctx.reply('🎁 *Описание приза:* ' + text + '\n\nТеперь выберите медиа для приза:', {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.raffleMediaSelection()
            });
        }
    }
    async handleCreateRaffleWinners(ctx, text) {
        const winnersCount = parseInt(text);
        if (isNaN(winnersCount) || winnersCount < 1) {
            await ctx.reply('❌ Введите корректное число победителей (минимум 1):');
            return;
        }
        const userId = ctx.from.id;
        this.adminStates[userId].tempData.winnersCount = winnersCount;
        this.adminStates[userId].step = 'create_raffle_duration';
        await ctx.reply('⏰ Введите длительность розыгрыша в часах:');
    }
    async handleCreateRaffleDuration(ctx, text) {
        const durationHours = parseInt(text);
        if (isNaN(durationHours) || durationHours < 1) {
            await ctx.reply('❌ Введите корректную длительность в часах (минимум 1):');
            return;
        }
        const userId = ctx.from.id;
        this.adminStates[userId].tempData.durationHours = durationHours;
        this.adminStates[userId].step = 'create_raffle_channels';
        // Переходим к выбору каналов
        await this.showChannelSelection(ctx);
    }
    // Методы для обработки медиа в розыгрышах
    async handleAddRafflePhoto(ctx) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        this.adminStates[userId].step = 'create_raffle_photo';
        try {
            await ctx.editMessageText('📸 Отправьте фото приза:', {
                reply_markup: Keyboards.cancelAction()
            });
        }
        catch (error) {
            await ctx.reply('📸 Отправьте фото приза:', {
                reply_markup: Keyboards.cancelAction()
            });
        }
    }
    async handleAddRaffleVideo(ctx) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        this.adminStates[userId].step = 'create_raffle_video';
        try {
            await ctx.editMessageText('🎥 Отправьте видео приза:', {
                reply_markup: Keyboards.cancelAction()
            });
        }
        catch (error) {
            await ctx.reply('🎥 Отправьте видео приза:', {
                reply_markup: Keyboards.cancelAction()
            });
        }
    }
    async handleSkipRaffleMedia(ctx) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        this.adminStates[userId].step = 'create_raffle_winners';
        await ctx.reply('🏆 Введите количество победителей:');
    }
    async handleRafflePhoto(ctx) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        const photo = ctx.message?.photo;
        if (!photo || photo.length === 0) {
            await ctx.reply('❌ Не удалось получить фото. Попробуйте еще раз.');
            return;
        }
        const fileId = photo[photo.length - 1].file_id;
        this.adminStates[userId].tempData.photoFileId = fileId;
        this.adminStates[userId].step = 'create_raffle_winners';
        await ctx.reply('✅ Фото приза добавлено! 🏆 Введите количество победителей:');
    }
    async handleRaffleVideo(ctx) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        const video = ctx.message?.video;
        if (!video) {
            await ctx.reply('❌ Не удалось получить видео. Попробуйте еще раз.');
            return;
        }
        const fileId = video.file_id;
        this.adminStates[userId].tempData.videoFileId = fileId;
        this.adminStates[userId].step = 'create_raffle_winners';
        await ctx.reply('✅ Видео приза добавлено! 🏆 Введите количество победителей:');
    }
    async showChannelSelection(ctx) {
        const channels = await this.channelService.getAllChannels();
        const socialAccounts = await this.socialAccountService.getAllSocialAccounts();
        if (channels.length === 0 && socialAccounts.length === 0) {
            await ctx.reply('⚠️ Нет доступных каналов или социальных аккаунтов. Сначала добавьте их в соответствующих разделах.', {
                reply_markup: Keyboards.backToAdmin()
            });
            return;
        }
        const userId = ctx.from.id;
        this.adminStates[userId].tempData.selectedChannels = [];
        this.adminStates[userId].tempData.selectedSocialAccounts = [];
        this.adminStates[userId].tempData.availableChannels = channels;
        this.adminStates[userId].tempData.availableSocialAccounts = socialAccounts;
        await this.updateChannelSelectionMessage(ctx);
    }
    async updateChannelSelectionMessage(ctx) {
        const userId = ctx.from.id;
        const state = this.adminStates[userId];
        const channels = state.tempData.availableChannels || [];
        const socialAccounts = state.tempData.availableSocialAccounts || [];
        const selectedChannels = state.tempData.selectedChannels || [];
        const selectedSocialAccounts = state.tempData.selectedSocialAccounts || [];
        let text = `📺 Выберите каналы и социальные сети для подписки:\n\n`;
        text += `🎁 Розыгрыш: ${state.tempData.title}\n`;
        text += `🏆 Победителей: ${state.tempData.winnersCount}\n`;
        text += `⏰ Длительность: ${state.tempData.durationHours} часов\n\n`;
        // Показываем Telegram каналы
        if (channels.length > 0) {
            text += `📺 Telegram каналы:\n\n`;
            channels.forEach((channel, index) => {
                const isSelected = selectedChannels.includes(channel.id);
                const status = isSelected ? '✅' : '❌';
                text += `${index + 1}. ${status} ${channel.name}\n`;
                text += `   ${channel.invite_link}\n\n`;
            });
        }
        // Показываем социальные аккаунты
        if (socialAccounts.length > 0) {
            text += `📱 Социальные сети:\n\n`;
            socialAccounts.forEach((account, index) => {
                const isSelected = selectedSocialAccounts.includes(account.id);
                const status = isSelected ? '✅' : '❌';
                const platformIcon = this.getPlatformIcon(account.platform);
                const verifiedBadge = account.is_verified ? '✅' : '';
                text += `${channels.length + index + 1}. ${status} ${platformIcon} @${account.username}${verifiedBadge}\n`;
                text += `   📝 ${account.display_name}\n`;
                text += `   🔗 ${account.profile_url}\n\n`;
            });
        }
        text += `💡 Нажмите на номер, чтобы выбрать/отменить выбор`;
        const keyboard = new InlineKeyboard();
        // Кнопки для Telegram каналов
        channels.forEach((channel, index) => {
            const isSelected = selectedChannels.includes(channel.id);
            const buttonText = isSelected ? `✅ ${channel.name}` : `❌ ${channel.name}`;
            keyboard.text(buttonText, `select_channel_${channel.id}`);
            if ((index + 1) % 2 === 0)
                keyboard.row();
        });
        // Кнопки для социальных аккаунтов
        socialAccounts.forEach((account, index) => {
            const isSelected = selectedSocialAccounts.includes(account.id);
            const platformIcon = this.getPlatformIcon(account.platform);
            const verifiedBadge = account.is_verified ? '✅' : '';
            const buttonText = isSelected ? `✅ ${platformIcon} @${account.username}${verifiedBadge}` : `❌ ${platformIcon} @${account.username}`;
            keyboard.text(buttonText, `select_social_${account.id}`);
            if ((channels.length + index + 1) % 2 === 0)
                keyboard.row();
        });
        keyboard.row().text('✅ Создать розыгрыш', 'create_raffle_final');
        keyboard.row().text('❌ Отмена', 'cancel_action');
        await ctx.reply(text, {
            reply_markup: keyboard
        });
    }
    async handleSelectChannel(ctx, channelId) {
        const userId = ctx.from.id;
        const state = this.adminStates[userId];
        const selectedChannels = state.tempData.selectedChannels || [];
        // Переключаем состояние канала
        if (selectedChannels.includes(channelId)) {
            state.tempData.selectedChannels = selectedChannels.filter((id) => id !== channelId);
        }
        else {
            state.tempData.selectedChannels = [...selectedChannels, channelId];
        }
        await this.updateChannelSelectionMessage(ctx);
    }
    async handleSelectSocialAccount(ctx, socialAccountId) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        const state = this.adminStates[userId];
        const selectedSocialAccounts = state.tempData.selectedSocialAccounts || [];
        // Переключаем состояние социального аккаунта
        if (selectedSocialAccounts.includes(socialAccountId)) {
            state.tempData.selectedSocialAccounts = selectedSocialAccounts.filter((id) => id !== socialAccountId);
        }
        else {
            state.tempData.selectedSocialAccounts = [...selectedSocialAccounts, socialAccountId];
        }
        await this.updateChannelSelectionMessage(ctx);
    }
    async handleCreateRaffleFinal(ctx) {
        const userId = ctx.from.id;
        const state = this.adminStates[userId];
        const tempData = state.tempData;
        // Создаем розыгрыш
        const endDate = new Date();
        endDate.setHours(endDate.getHours() + tempData.durationHours);
        const raffle = await this.raffleService.createRaffle(tempData.prize, tempData.winnersCount, endDate, tempData.selectedChannels || [], tempData.photoFileId, tempData.videoFileId, tempData.referralRequirement || false, tempData.minReferrals || 0, tempData.maxReferrals || 0, tempData.referralBonus);
        // Добавляем социальные аккаунты к розыгрышу
        const selectedSocialAccounts = tempData.selectedSocialAccounts || [];
        for (const socialAccountId of selectedSocialAccounts) {
            await this.socialAccountService.addSocialRequirementToRaffle(raffle.id, socialAccountId, 'FOLLOW');
        }
        // Очищаем состояние
        delete this.adminStates[userId];
        const channelCount = tempData.selectedChannels?.length || 0;
        const socialAccountCount = tempData.selectedSocialAccounts?.length || 0;
        const channelText = channelCount === 1 ? 'канал' :
            channelCount >= 2 && channelCount <= 4 ? 'канала' : 'каналов';
        const socialText = socialAccountCount === 1 ? 'аккаунт' :
            socialAccountCount >= 2 && socialAccountCount <= 4 ? 'аккаунта' : 'аккаунтов';
        let raffleInfo = `✅ Розыгрыш "${tempData.title}" успешно создан!\n\n` +
            `🎁 Приз: ${tempData.prize}\n` +
            `🏆 Победителей: ${tempData.winnersCount}\n` +
            `⏰ Длительность: ${tempData.durationHours} часов\n` +
            `📺 Связано каналов: ${channelCount} ${channelText}`;
        if (socialAccountCount > 0) {
            raffleInfo += `\n📱 Связано соцсетей: ${socialAccountCount} ${socialText}`;
        }
        // Добавляем информацию о реферальных требованиях
        if (tempData.referralRequirement) {
            raffleInfo += `\n👥 Реферальные требования: ${tempData.minReferrals} рефералов`;
            if (tempData.referralBonus) {
                raffleInfo += `\n🎁 Бонус: ${tempData.referralBonus}`;
            }
        }
        raffleInfo += `\n\n💡 Выберите действие:`;
        await ctx.editMessageText(raffleInfo, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.raffleCreatedActions(raffle.id)
        });
    }
    async cancelAdminAction(ctx) {
        const userId = ctx.from.id;
        delete this.adminStates[userId];
        await ctx.editMessageText('❌ Действие отменено.', {
            reply_markup: Keyboards.backToAdmin()
        });
    }
    async showActiveRafflesAdmin(ctx) {
        const raffles = await this.raffleService.getActiveRaffles();
        if (raffles.length === 0) {
            await ctx.editMessageText('📭 Активных розыгрышей нет.', {
                reply_markup: Keyboards.backToAdmin()
            });
            return;
        }
        let text = `📋 *Активные розыгрыши:*\n\n`;
        raffles.forEach((raffle, index) => {
            text += `${index + 1}. *${raffle.prize_description}*\n`;
            text += `   🎁 Приз: ${raffle.prize_description}\n`;
            text += `   👥 Победителей: ${raffle.winners_count}\n`;
            text += `   ⏰ Завершение: ${new Date(raffle.end_date).toLocaleDateString('ru-RU')}\n\n`;
        });
        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.backToAdmin()
        });
    }
    async showChannelsList(ctx) {
        const channels = await this.channelService.getAllChannels();
        if (channels.length === 0) {
            await ctx.editMessageText('📭 Каналы не найдены.', {
                reply_markup: Keyboards.backToAdmin()
            });
            return;
        }
        let text = `📺 *Список каналов:*\n\n`;
        channels.forEach((channel, index) => {
            text += `${index + 1}. *${channel.name}*\n`;
            text += `   \`${channel.invite_link}\`\n\n`;
        });
        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.backToAdmin()
        });
    }
    async startAddChannel(ctx) {
        const userId = ctx.from.id;
        this.adminStates[userId] = {
            step: 'add_channel',
            tempData: {}
        };
        console.log(`➕ Начало добавления канала для пользователя ${userId}`);
        console.log(`📝 Установлено состояние:`, this.adminStates[userId]);
        await ctx.editMessageText('📺 Введите ссылку на канал:', {
            reply_markup: Keyboards.cancelAction()
        });
    }
    async handleAddChannel(ctx, text) {
        console.log(`➕ Обработка добавления канала`);
        console.log(`�� Попытка добавления канала: ${text}`);
        try {
            // Парсим ссылку на канал
            const channelMatch = text.match(/https:\/\/t\.me\/([^\/\s]+)/);
            if (!channelMatch) {
                await ctx.reply('❌ Неверный формат ссылки. Используйте: https://t.me/channel_name');
                return;
            }
            const channelUsername = channelMatch[1];
            console.log(`📺 Парсинг канала: ID=@${channelUsername}, Link=${text}`);
            // Получаем информацию о канале
            const chat = await this.bot.api.getChat(`@${channelUsername}`);
            console.log(`📋 Информация о канале:`, chat);
            // Добавляем канал в базу данных
            await this.channelService.createChannel(chat.id.toString(), chat.title || 'Unknown Channel', text);
            const userId = ctx.from.id;
            delete this.adminStates[userId];
            await ctx.reply(`✅ Канал "${chat.title}" успешно добавлен!`, {
                reply_markup: Keyboards.backToAdmin()
            });
        }
        catch (error) {
            console.error(`❌ Ошибка получения информации о канале:`, error);
            if (error.code === 'SQLITE_CONSTRAINT') {
                await ctx.reply('⚠️ Этот канал уже добавлен в базу данных.', {
                    reply_markup: Keyboards.backToAdmin()
                });
            }
            else {
                await ctx.reply('❌ Ошибка при добавлении канала. Проверьте ссылку и попробуйте снова.', {
                    reply_markup: Keyboards.backToAdmin()
                });
            }
        }
    }
    async startEditRaffle(ctx, raffleId) {
        console.log(`✏️ Начинаем редактирование розыгрыша ${raffleId}`);
        try {
            // Получаем розыгрыш
            const raffle = await this.raffleService.getRaffleById(raffleId);
            if (!raffle) {
                await ctx.editMessageText('❌ Розыгрыш не найден.', {
                    reply_markup: Keyboards.backToAdmin()
                });
                return;
            }
            // Проверяем, есть ли участники
            const participants = await this.raffleService.getParticipantsByRaffleId(raffleId);
            const hasParticipants = participants.length > 0;
            const userId = ctx.from.id;
            // Устанавливаем состояние для редактирования
            this.adminStates[userId] = {
                step: 'edit_raffle_select_field',
                tempData: {
                    raffleId: raffleId,
                    hasParticipants: hasParticipants,
                    currentRaffle: raffle
                }
            };
            const participantsWarning = hasParticipants ?
                '\n⚠️ *Внимание:* У розыгрыша есть участники. Некоторые изменения могут быть ограничены.' : '';
            const text = `✏️ *Редактирование розыгрыша*

🎁 *Название:* ${raffle.prize_description}
🏆 *Приз:* ${raffle.prize_description}
👥 *Победителей:* ${raffle.winners_count}
⏰ *Длительность:* ${Math.floor((new Date(raffle.end_date).getTime() - new Date(raffle.created_at).getTime()) / (1000 * 60 * 60))} часов
👤 *Участников:* ${participants.length}${participantsWarning}

💡 Выберите что хотите изменить:`;
            await ctx.editMessageText(text, {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.editRaffleFields(hasParticipants)
            });
        }
        catch (error) {
            console.error('❌ Ошибка при начале редактирования розыгрыша:', error);
            await ctx.editMessageText('❌ Ошибка при загрузке розыгрыша.', {
                reply_markup: Keyboards.backToAdmin()
            });
        }
    }
    async publishRaffle(ctx, raffleId) {
        console.log(`📢 Публикуем розыгрыш ${raffleId}`);
        try {
            // Получаем розыгрыш
            const raffle = await this.raffleService.getRaffleById(raffleId);
            if (!raffle) {
                await ctx.editMessageText('❌ Розыгрыш не найден.', {
                    reply_markup: Keyboards.backToAdmin()
                });
                return;
            }
            // Публикуем розыгрыш (устанавливаем статус ACTIVE)
            await this.raffleService.updateRaffleStatus(raffleId, RaffleStatus.ACTIVE);
            const successText = `✅ *Розыгрыш успешно опубликован!*

🎁 *Название:* ${raffle.prize_description}
🏆 *Приз:* ${raffle.prize_description}
👥 *Победителей:* ${raffle.winners_count}
⏰ *Завершение:* ${new Date(raffle.end_date).toLocaleDateString('ru-RU')}

💡 Теперь пользователи могут участвовать в розыгрыше!`;
            await ctx.editMessageText(successText, {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.backToAdmin()
            });
        }
        catch (error) {
            console.error('❌ Ошибка при публикации розыгрыша:', error);
            await ctx.editMessageText('❌ Ошибка при публикации розыгрыша.', {
                reply_markup: Keyboards.backToAdmin()
            });
        }
    }
    async startCreateMailing(ctx) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        this.adminStates[userId] = {
            step: 'select_mailing_type',
            tempData: {}
        };
        await ctx.editMessageText('📢 *Создание рассылки*\n\nВыберите тип рассылки:', {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.mailingTypeSelection()
        });
    }
    async handleSelectMailingType(ctx, mailingType) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        this.adminStates[userId].tempData.mailingType = mailingType;
        this.adminStates[userId].step = 'create_mailing_text';
        let text = '📢 *Создание рассылки*\n\n';
        if (mailingType === MailingType.ALL_USERS) {
            text += '📝 Введите текст рассылки для всех пользователей:';
        }
        else {
            text += '📝 Введите текст рассылки для участников розыгрыша:';
        }
        try {
            await ctx.editMessageText(text, {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.cancelAction()
            });
        }
        catch (error) {
            // Если не удается отредактировать, отправляем новое сообщение
            await ctx.reply(text, {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.cancelAction()
            });
        }
    }
    async handleCreateMailingText(ctx, text) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        const state = this.adminStates[userId];
        state.tempData.messageText = text;
        state.step = 'create_mailing_media';
        try {
            await ctx.editMessageText('🖼️ *Медиа для рассылки*\n\nВыберите что добавить к рассылке:', {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.mailingMediaSelection()
            });
        }
        catch (error) {
            // Если не удается отредактировать, отправляем новое сообщение
            await ctx.reply('🖼️ *Медиа для рассылки*\n\nВыберите что добавить к рассылке:', {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.mailingMediaSelection()
            });
        }
    }
    async handleSelectMailingSchedule(ctx, scheduleType) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        const state = this.adminStates[userId];
        if (scheduleType === 'now') {
            // Отправляем сейчас
            await this.createMailingFinal(ctx, undefined);
        }
        else if (scheduleType === 'custom') {
            state.step = 'create_mailing_custom_time';
            try {
                await ctx.editMessageText('📅 *Настройка времени*\n\nВведите время отправки в формате:\n\n`ДД.ММ.ГГГГ ЧЧ:ММ`\n\nНапример: `25.12.2024 15:30`', {
                    parse_mode: 'Markdown',
                    reply_markup: Keyboards.cancelAction()
                });
            }
            catch (error) {
                await ctx.reply('📅 *Настройка времени*\n\nВведите время отправки в формате:\n\n`ДД.ММ.ГГГГ ЧЧ:ММ`\n\nНапример: `25.12.2024 15:30`', {
                    parse_mode: 'Markdown',
                    reply_markup: Keyboards.cancelAction()
                });
            }
        }
    }
    async handleCreateMailingCustomTime(ctx, timeText) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        try {
            // Парсим время
            const [datePart, timePart] = timeText.split(' ');
            const [day, month, year] = datePart.split('.');
            const [hour, minute] = timePart.split(':');
            const scheduleTime = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
            if (scheduleTime <= new Date()) {
                await ctx.editMessageText('❌ Время отправки должно быть в будущем!', {
                    reply_markup: Keyboards.cancelAction()
                });
                return;
            }
            await this.createMailingFinal(ctx, scheduleTime);
        }
        catch (error) {
            await ctx.editMessageText('❌ Неверный формат времени! Используйте формат: `ДД.ММ.ГГГГ ЧЧ:ММ`', {
                reply_markup: Keyboards.cancelAction()
            });
        }
    }
    async handleAddMailingPhoto(ctx) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        const state = this.adminStates[userId];
        state.step = 'create_mailing_photo';
        try {
            await ctx.editMessageText('🖼️ *Добавление фото*\n\nОтправьте фото для рассылки:', {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.cancelAction()
            });
        }
        catch (error) {
            await ctx.reply('🖼️ *Добавление фото*\n\nОтправьте фото для рассылки:', {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.cancelAction()
            });
        }
    }
    async handleAddMailingVideo(ctx) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        const state = this.adminStates[userId];
        state.step = 'create_mailing_video';
        try {
            await ctx.editMessageText('📹 *Добавление видео*\n\nОтправьте видео для рассылки:', {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.cancelAction()
            });
        }
        catch (error) {
            await ctx.reply('📹 *Добавление видео*\n\nОтправьте видео для рассылки:', {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.cancelAction()
            });
        }
    }
    async handleSkipMailingMedia(ctx) {
        await this.showMailingScheduleSelection(ctx);
    }
    async showMailingScheduleSelection(ctx) {
        try {
            await ctx.editMessageText('📅 *Планирование рассылки*\n\nВыберите когда отправить рассылку:', {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.mailingScheduleSelection()
            });
        }
        catch (error) {
            await ctx.reply('📅 *Планирование рассылки*\n\nВыберите когда отправить рассылку:', {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.mailingScheduleSelection()
            });
        }
    }
    async createMailingFinal(ctx, scheduleTime) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        const state = this.adminStates[userId];
        try {
            const mailing = await this.mailingService.createMailing(state.tempData.mailingType, state.tempData.messageText, state.tempData.targetRaffleId, state.tempData.photoFileId, // photoFileId
            state.tempData.videoFileId, // videoFileId
            undefined, // inlineKeyboardJson
            scheduleTime);
            delete this.adminStates[userId];
            const scheduleText = scheduleTime
                ? `📅 Запланирована на: ${scheduleTime.toLocaleString('ru-RU')}`
                : '🚀 Отправляется немедленно';
            const successText = `✅ *Рассылка успешно создана!*\n\n${scheduleText}\n\n📝 Текст: ${state.tempData.messageText.substring(0, 100)}...`;
            try {
                await ctx.editMessageText(successText, {
                    parse_mode: 'Markdown',
                    reply_markup: Keyboards.backToAdmin()
                });
            }
            catch (error) {
                await ctx.reply(successText, {
                    parse_mode: 'Markdown',
                    reply_markup: Keyboards.backToAdmin()
                });
            }
        }
        catch (error) {
            console.error('❌ Ошибка при создании рассылки:', error);
            try {
                await ctx.editMessageText('❌ Ошибка при создании рассылки.', {
                    reply_markup: Keyboards.backToAdmin()
                });
            }
            catch (editError) {
                await ctx.reply('❌ Ошибка при создании рассылки.', {
                    reply_markup: Keyboards.backToAdmin()
                });
            }
        }
    }
    async showMailingsList(ctx) {
        const mailings = await this.mailingService.getAllMailings();
        if (mailings.length === 0) {
            await ctx.editMessageText('📭 Рассылок не найдено.', {
                reply_markup: Keyboards.backToAdmin()
            });
            return;
        }
        let text = `📢 *Список рассылок:*\n\n`;
        mailings.forEach((mailing, index) => {
            const statusEmoji = mailing.status === 'COMPLETED' ? '✅' :
                mailing.status === 'SENDING' ? '📤' :
                    mailing.status === 'SCHEDULED' ? '⏰' : '❌';
            const typeText = mailing.mailing_type === 'ALL_USERS' ? '👥 Всем' : '🎁 Участникам';
            text += `${index + 1}. ${statusEmoji} *${mailing.message_text.substring(0, 50)}...*\n`;
            text += `   📊 Статус: ${this.getMailingStatusText(mailing.status)}\n`;
            text += `   👥 Тип: ${typeText}\n`;
            text += `   📈 Отправлено: ${mailing.sent_count}, Ошибок: ${mailing.failed_count}\n`;
            text += `   📅 Создана: ${new Date(mailing.created_at).toLocaleDateString('ru-RU')}\n`;
            if (mailing.schedule_time) {
                text += `   ⏰ Запланирована: ${new Date(mailing.schedule_time).toLocaleString('ru-RU')}\n`;
            }
            text += `\n`;
        });
        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.backToAdmin()
        });
    }
    getMailingStatusText(status) {
        switch (status) {
            case 'SCHEDULED': return '⏰ Запланирована';
            case 'SENDING': return '📤 Отправляется';
            case 'COMPLETED': return '✅ Завершена';
            case 'CANCELED': return '❌ Отменена';
            default: return status;
        }
    }
    async showChannelsToDelete(ctx) {
        const channels = await this.channelService.getAllChannels();
        if (channels.length === 0) {
            await ctx.editMessageText('📭 Каналов не найдено.', {
                reply_markup: Keyboards.backToAdmin()
            });
            return;
        }
        const text = `🗑️ *Выберите канал для удаления:*\n\n💡 Нажмите на канал, который хотите удалить.`;
        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.channelsToDelete(channels)
        });
    }
    async showRafflesToDelete(ctx) {
        const text = `🗑️ *Выберите тип розыгрышей для удаления:*\n\n💡 Выберите категорию розыгрышей, из которой хотите удалить розыгрыш.`;
        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.raffleTypeSelection()
        });
    }
    async showActiveRafflesToDelete(ctx) {
        const raffles = await this.raffleService.getRafflesByStatus(RaffleStatus.ACTIVE);
        if (raffles.length === 0) {
            await ctx.editMessageText('📭 Активных розыгрышей не найдено.', {
                reply_markup: Keyboards.backToAdmin()
            });
            return;
        }
        const text = `🗑️ *Выберите активный розыгрыш для удаления:*\n\n💡 Нажмите на розыгрыш, который хотите удалить.\n🟢 - активный розыгрыш`;
        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.rafflesToDelete(raffles)
        });
    }
    async showFinishedRafflesToDelete(ctx) {
        const raffles = await this.raffleService.getRafflesByStatus(RaffleStatus.FINISHED);
        if (raffles.length === 0) {
            await ctx.editMessageText('📭 Завершенных розыгрышей не найдено.', {
                reply_markup: Keyboards.backToAdmin()
            });
            return;
        }
        const text = `🗑️ *Выберите завершенный розыгрыш для удаления:*\n\n💡 Нажмите на розыгрыш, который хотите удалить.\n🔴 - завершенный розыгрыш`;
        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.rafflesToDelete(raffles)
        });
    }
    async handleDeleteChannel(ctx, channelId) {
        try {
            const channel = await this.channelService.getChannelById(channelId);
            if (!channel) {
                await ctx.answerCallbackQuery('❌ Канал не найден');
                return;
            }
            // Удаляем канал
            await this.channelService.deleteChannel(channelId);
            await ctx.answerCallbackQuery('✅ Канал успешно удален');
            await ctx.editMessageText(`🗑️ *Канал удален:*\n\n📺 Название: ${channel.name}\n🔗 Ссылка: \`${channel.invite_link}\`\n\n✅ Канал успешно удален из базы данных.`, {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.backToAdmin()
            });
        }
        catch (error) {
            console.error('❌ Ошибка при удалении канала:', error);
            await ctx.answerCallbackQuery('❌ Ошибка при удалении канала');
            await ctx.editMessageText('❌ Произошла ошибка при удалении канала.', {
                reply_markup: Keyboards.backToAdmin()
            });
        }
    }
    async handleDeleteRaffle(ctx, raffleId) {
        try {
            const raffle = await this.raffleService.getRaffleById(raffleId);
            if (!raffle) {
                await ctx.answerCallbackQuery('❌ Розыгрыш не найден');
                return;
            }
            // Удаляем розыгрыш
            await this.raffleService.deleteRaffle(raffleId);
            await ctx.answerCallbackQuery('✅ Розыгрыш успешно удален');
            await ctx.editMessageText(`🗑️ *Розыгрыш удален:*\n\n🎁 Приз: ${raffle.prize_description}\n👥 Победителей: ${raffle.winners_count}\n📅 Статус: ${this.getStatusText(raffle.status)}\n\n✅ Розыгрыш успешно удален из базы данных.`, {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.backToAdmin()
            });
        }
        catch (error) {
            console.error('❌ Ошибка при удалении розыгрыша:', error);
            await ctx.answerCallbackQuery('❌ Ошибка при удалении розыгрыша');
            await ctx.editMessageText('❌ Произошла ошибка при удалении розыгрыша.', {
                reply_markup: Keyboards.backToAdmin()
            });
        }
    }
    async getAdminStats() {
        const totalUsers = await this.userService.getAllUsers();
        const activeRaffles = await this.raffleService.getActiveRaffles();
        const totalRaffles = await this.raffleService.getAllRaffles();
        const totalChannels = await this.channelService.getAllChannels();
        const totalMailings = await this.mailingService.getAllMailings();
        return {
            totalUsers: totalUsers.length,
            usersToday: 0, // Можно добавить логику подсчета пользователей за сегодня
            activeRaffles: activeRaffles.length,
            totalRaffles: totalRaffles.length,
            totalChannels: totalChannels.length,
            totalMailings: totalMailings.length
        };
    }
    async handleParticipation(ctx, raffleId) {
        const user = await this.userService.getUserByTelegramId(ctx.from.id);
        if (!user)
            return;
        const raffle = await this.raffleService.getRaffleById(raffleId);
        if (!raffle || raffle.status !== 'ACTIVE') {
            await ctx.editMessageText('❌ Розыгрыш недоступен или завершен.', {
                reply_markup: Keyboards.backToMain()
            });
            return;
        }
        // Отслеживаем попытку участия в розыгрыше
        await this.analyticsService.trackEvent(AnalyticsEventType.USER_JOINED_RAFFLE, user.id, raffleId);
        // Проверяем, не участвует ли пользователь уже в этом розыгрыше
        const isAlreadyParticipating = await this.raffleService.isUserParticipating(user.id, raffleId);
        if (isAlreadyParticipating) {
            console.log(`🔄 Пользователь ${user.id} уже участвует в розыгрыше ${raffleId}`);
            const alreadyParticipatingText = `🎉 *Вы уже участвуете в этом розыгрыше!*

🎁 Приз: ${raffle.prize_description}
🏆 Количество победителей: ${raffle.winners_count}
⏰ Завершение: ${raffle.end_date.toLocaleDateString('ru-RU')}
📅 Время: ${raffle.end_date.toLocaleTimeString('ru-RU')}

✅ *Ваше участие подтверждено*
📊 Результаты будут объявлены автоматически после завершения розыгрыша

🍀 Удачи! Надеемся, что именно вы станете победителем!`;
            await ctx.editMessageText(alreadyParticipatingText, {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.backToMain()
            });
            return;
        }
        // Получаем каналы для этого розыгрыша
        const channels = await this.channelService.getChannelsByRaffleId(raffleId);
        // Получаем социальные аккаунты для этого розыгрыша
        const socialAccounts = await this.socialAccountService.getSocialRequirementsForRaffle(raffleId);
        // Проверяем все требования для участия
        const hasChannelRequirements = channels.length > 0;
        const hasSocialRequirements = socialAccounts.length > 0;
        const hasReferralRequirements = raffle.referral_requirement;
        // Проверяем реферальные требования только если они есть
        let referralRequirements = null;
        if (hasReferralRequirements) {
            referralRequirements = await this.raffleService.checkUserReferralRequirements(user.id, raffleId);
        }
        // Если нет никаких требований, сразу регистрируем участие
        if (!hasChannelRequirements && !hasSocialRequirements && !hasReferralRequirements) {
            console.log(`📝 Регистрируем участие: user.id=${user.id}, raffleId=${raffleId} (без требований)`);
            await this.raffleService.addParticipant(user.id, raffleId, true);
            console.log(`✅ Участие зарегистрировано для пользователя ${user.id} в розыгрыше ${raffleId}`);
            const successText = `🎉 *Поздравляем! Вы успешно зарегистрированы в розыгрыше!*

🎁 Приз: ${raffle.prize_description}
🏆 Количество победителей: ${raffle.winners_count}
⏰ Завершение: ${raffle.end_date.toLocaleDateString('ru-RU')}
📅 Время: ${raffle.end_date.toLocaleTimeString('ru-RU')}

✅ *Ваше участие подтверждено*
📊 Результаты будут объявлены автоматически после завершения розыгрыша

🍀 Удачи! Надеемся, что именно вы станете победителем!`;
            await ctx.editMessageText(successText, {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.backToMain()
            });
            return;
        }
        // Если есть каналы для подписки, показываем их в первую очередь
        if (hasChannelRequirements && !hasSocialRequirements) {
            await this.showSubscriptionChannels(ctx, raffle, channels);
            return;
        }
        // Если есть только социальные требования
        if (hasSocialRequirements && !hasChannelRequirements) {
            await this.showSocialAccounts(ctx, raffle, socialAccounts);
            return;
        }
        // Если есть и каналы, и социальные сети, показываем комбинированный интерфейс
        if (hasChannelRequirements && hasSocialRequirements) {
            await this.showCombinedRequirements(ctx, raffle, channels, socialAccounts);
            return;
        }
        // Если есть только реферальные требования (без каналов)
        if (hasReferralRequirements && referralRequirements && !referralRequirements.hasEnoughReferrals) {
            const referralText = `👥 *Для участия в розыгрыше пригласите друзей!*

🎁 Приз: ${raffle.prize_description}
🏆 Победителей: ${raffle.winners_count}
⏰ Завершение: ${raffle.end_date.toLocaleDateString('ru-RU')}

📊 *Ваша статистика:*
👥 Приглашено друзей: ${referralRequirements.currentReferrals}/${referralRequirements.requiredReferrals}
🎯 Требуется: ${referralRequirements.requiredReferrals} рефералов

💡 *Как пригласить друзей:*
1️⃣ Скопируйте вашу реферальную ссылку
2️⃣ Отправьте её друзьям
3️⃣ **Как только они зарегистрируются - вы автоматически станете участником!**

🎯 *Множитель шансов:* +${Math.round((this.raffleService.calculateBonusMultiplier(referralRequirements.requiredReferrals) - 1) * 100)}% к вероятности победы

🔗 *Ваша реферальная ссылка:*
\`https://t.me/${ctx.me.username}?start=REF${user.id}\``;
            await ctx.editMessageText(referralText, {
                parse_mode: 'Markdown',
                reply_markup: new InlineKeyboard()
                    .text('👥 Пригласить друзей', 'referral_system')
                    .row()
                    .text('🔍 Проверить снова', `participate_${raffleId}`)
                    .row()
                    .text('🔙 Назад', 'back_to_main')
            });
            return;
        }
        // Если есть только требования по каналам, показываем их
        if (hasChannelRequirements && !hasReferralRequirements) {
            await this.showSubscriptionChannels(ctx, raffle, channels);
            return;
        }
        // Если есть и каналы, и рефералы, но рефералы выполнены, показываем каналы
        if (hasChannelRequirements && hasReferralRequirements && referralRequirements && referralRequirements.hasEnoughReferrals) {
            // Добавляем информацию о выполненных реферальных требованиях
            const channelText = channels.length === 1 ? 'канал' : 'каналы';
            let text = `📺 *Для участия в розыгрыше подпишитесь на ${channelText}:*

🎁 Приз: ${raffle.prize_description}
🏆 Победителей: ${raffle.winners_count}
⏰ Завершение: ${raffle.end_date.toLocaleDateString('ru-RU')}

✅ *Реферальные требования выполнены:* ${referralRequirements.currentReferrals}/${referralRequirements.requiredReferrals}
🎯 *Множитель шансов:* +${Math.round((this.raffleService.calculateBonusMultiplier(referralRequirements.currentReferrals) - 1) * 100)}% к вероятности победы

📺 *Каналы для подписки:*\n`;
            channels.forEach((channel, index) => {
                text += `${index + 1}. *${channel.name}*\n`;
                text += `   \`${channel.invite_link}\`\n\n`;
            });
            text += `💡 *Инструкция:*\n`;
            text += `1️⃣ Нажмите кнопки "Подписаться" ниже\n`;
            text += `2️⃣ Перейдите в канал и подпишитесь\n`;
            text += `3️⃣ Вернитесь в бот\n`;
            text += `4️⃣ Нажмите "🔍 Проверить подписку"\n`;
            text += `5️⃣ Получите подтверждение участия`;
            const keyboard = new InlineKeyboard();
            // Добавляем URL-кнопки для каждого канала
            channels.forEach((channel, index) => {
                keyboard.url(`📺 Подписаться на ${channel.name}`, channel.invite_link);
                if ((index + 1) % 2 === 0)
                    keyboard.row();
            });
            keyboard.row().text('🔍 Проверить подписку', `check_subscription_${raffle.id}`);
            keyboard.row().text('🔙 Назад к розыгрышам', 'active_raffles');
            await ctx.editMessageText(text, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
            return;
        }
        // Если есть только реферальные требования и они выполнены
        if (!hasChannelRequirements && hasReferralRequirements && referralRequirements.hasEnoughReferrals) {
            console.log(`📝 Регистрируем участие: user.id=${user.id}, raffleId=${raffleId} (рефералы выполнены)`);
            await this.raffleService.addParticipant(user.id, raffleId, true);
            console.log(`✅ Участие зарегистрировано для пользователя ${user.id} в розыгрыше ${raffleId}`);
            const successText = `🎉 *Поздравляем! Вы успешно зарегистрированы в розыгрыше!*

🎁 Приз: ${raffle.prize_description}
🏆 Количество победителей: ${raffle.winners_count}
⏰ Завершение: ${raffle.end_date.toLocaleDateString('ru-RU')}
📅 Время: ${raffle.end_date.toLocaleTimeString('ru-RU')}

✅ *Ваше участие подтверждено*
👥 Реферальные требования выполнены: ${referralRequirements.currentReferrals}/${referralRequirements.requiredReferrals}
📊 Результаты будут объявлены автоматически после завершения розыгрыша

🍀 Удачи! Надеемся, что именно вы станете победителем!`;
            await ctx.editMessageText(successText, {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.backToMain()
            });
            return;
        }
    }
    async showSubscriptionChannels(ctx, raffle, channels) {
        const channelText = channels.length === 1 ? 'канал' : 'каналы';
        let text = `📺 *Для участия в розыгрыше подпишитесь на ${channelText}:*

🎁 Приз: ${raffle.prize_description}
🏆 Победителей: ${raffle.winners_count}
⏰ Завершение: ${raffle.end_date.toLocaleDateString('ru-RU')}`;
        // Добавляем информацию о реферальных требованиях, если они есть
        if (raffle.referral_requirement) {
            const user = await this.userService.getUserByTelegramId(ctx.from.id);
            if (user) {
                const referralRequirements = await this.raffleService.checkUserReferralRequirements(user.id, raffle.id);
                text += `\n\n👥 *Реферальные требования:* ${referralRequirements.currentReferrals}/${referralRequirements.requiredReferrals} друзей`;
                text += `\n🎯 *Множитель шансов:* +${Math.round((this.raffleService.calculateBonusMultiplier(referralRequirements.requiredReferrals) - 1) * 100)}% к вероятности победы`;
                text += `\n💡 *Как это работает:* Чем больше друзей вы пригласите, тем выше ваш шанс на победу!`;
            }
        }
        text += `\n\n📺 *Каналы для подписки:*\n`;
        channels.forEach((channel, index) => {
            text += `${index + 1}. *${channel.name}*\n`;
            text += `   \`${channel.invite_link}\`\n\n`;
        });
        text += `💡 *Инструкция:*\n`;
        text += `1️⃣ Нажмите кнопки "Подписаться" ниже\n`;
        text += `2️⃣ Перейдите в канал и подпишитесь\n`;
        text += `3️⃣ Вернитесь в бот\n`;
        text += `4️⃣ Нажмите "🔍 Проверить подписку"\n`;
        if (raffle.referral_requirement) {
            text += `5️⃣ После проверки подписки сможете приглашать друзей`;
        }
        else {
            text += `5️⃣ После проверки подписки получите подтверждение участия`;
        }
        const keyboard = new InlineKeyboard();
        // Добавляем URL-кнопки для каждого канала
        channels.forEach((channel, index) => {
            keyboard.url(`📺 Подписаться на ${channel.name}`, channel.invite_link);
            if ((index + 1) % 2 === 0)
                keyboard.row();
        });
        keyboard.row().text('🔍 Проверить подписку', `check_subscription_${raffle.id}`);
        keyboard.row().text('🔙 Назад к розыгрышам', 'active_raffles');
        await ctx.editMessageText(text, {
            reply_markup: keyboard
        });
    }
    async handleSubscribeToChannel(ctx, channelId) {
        console.log(`📺 Обработка подписки на канал ${channelId} для пользователя ${ctx.from.id}`);
        const user = await this.userService.getUserByTelegramId(ctx.from.id);
        const channel = await this.channelService.getChannelById(channelId);
        if (!channel) {
            await ctx.answerCallbackQuery('❌ Канал не найден');
            return;
        }
        // Отслеживаем подписку на канал
        if (user) {
            await this.analyticsService.trackEvent(AnalyticsEventType.USER_SUBSCRIBED_CHANNEL, user.id, undefined, channelId);
        }
        // Создаем кнопку для перехода в канал
        const keyboard = new InlineKeyboard();
        keyboard.url(`📺 Подписаться на ${channel.name}`, channel.invite_link);
        keyboard.row().text('🔍 Проверить подписку', `check_subscription_${channelId}`);
        keyboard.row().text('🔙 Назад к розыгрышам', 'active_raffles');
        await ctx.editMessageText(`📺 *Подписка на канал*

🎯 Канал: *${channel.name}*
🔗 Ссылка: \`${channel.invite_link}\`

💡 *Инструкция:*
1️⃣ Нажмите кнопку "📺 Подписаться на ${channel.name}" ниже
2️⃣ Перейдите в канал и подпишитесь
3️⃣ Вернитесь в бот и нажмите "🔍 Проверить подписку"`, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    async checkSubscriptionAndParticipate(ctx, raffleId) {
        console.log(`🔍 Проверка подписки для розыгрыша ${raffleId} пользователем ${ctx.from.id}`);
        const user = await this.userService.getUserByTelegramId(ctx.from.id);
        if (!user) {
            await ctx.answerCallbackQuery('❌ Пользователь не найден');
            return;
        }
        const raffle = await this.raffleService.getRaffleById(raffleId);
        if (!raffle || raffle.status !== 'ACTIVE') {
            await ctx.editMessageText('❌ Розыгрыш недоступен или завершен.', {
                reply_markup: Keyboards.backToMain()
            });
            return;
        }
        // Проверяем подписки на каналы
        const channels = await this.channelService.getChannelsByRaffleId(raffleId);
        const unsubscribedChannels = [];
        for (const channel of channels) {
            try {
                const member = await this.bot.api.getChatMember(channel.telegram_channel_id, ctx.from.id);
                if (!['member', 'administrator', 'creator'].includes(member.status)) {
                    unsubscribedChannels.push(channel);
                }
            }
            catch (error) {
                console.error(`Ошибка проверки подписки на канал ${channel.name}:`, error);
                unsubscribedChannels.push(channel);
            }
        }
        if (unsubscribedChannels.length > 0) {
            let text = `❌ *Вы не подписаны на все каналы:*

🎁 Приз: ${raffle.prize_description}
🏆 Победителей: ${raffle.winners_count}

📺 *Не подписаны на:*\n`;
            unsubscribedChannels.forEach((channel, index) => {
                text += `${index + 1}. *${channel.name}*\n`;
                text += `   \`${channel.invite_link}\`\n\n`;
            });
            text += `💡 *Пожалуйста:*\n`;
            text += `1️⃣ Подпишитесь на все каналы выше\n`;
            text += `2️⃣ Нажмите "🔍 Проверить подписку" снова`;
            const keyboard = new InlineKeyboard();
            unsubscribedChannels.forEach((channel, index) => {
                keyboard.text(`📺 Подписаться на ${channel.name}`, `subscribe_${channel.id}`);
                if ((index + 1) % 2 === 0)
                    keyboard.row();
            });
            keyboard.row().text('🔍 Проверить подписку', `check_subscription_${raffle.id}`);
            keyboard.row().text('🔙 Назад к розыгрышам', 'active_raffles');
            await ctx.editMessageText(text, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
            return;
        }
        // Все подписки проверены, проверяем реферальные требования
        if (raffle.referral_requirement) {
            const referralRequirements = await this.raffleService.checkUserReferralRequirements(user.id, raffleId);
            if (!referralRequirements.hasEnoughReferrals) {
                // Показываем реферальные требования
                const referralText = `✅ *Подписка на каналы подтверждена!*

🎁 Приз: ${raffle.prize_description}
🏆 Победителей: ${raffle.winners_count}
⏰ Завершение: ${raffle.end_date.toLocaleDateString('ru-RU')}

📊 *Ваша статистика:*
👥 Приглашено друзей: ${referralRequirements.currentReferrals}/${referralRequirements.requiredReferrals}
🎯 Требуется: ${referralRequirements.requiredReferrals} рефералов

💡 *Следующий шаг:*
1️⃣ Скопируйте вашу реферальную ссылку
2️⃣ Отправьте её друзьям
3️⃣ **Как только они зарегистрируются - вы автоматически станете участником!**

🎯 *Множитель шансов:* +${Math.round((this.raffleService.calculateBonusMultiplier(referralRequirements.requiredReferrals) - 1) * 100)}% к вероятности победы
💡 *Как это работает:* Чем больше друзей вы пригласите, тем выше ваш шанс на победу!

🔗 *Ваша реферальная ссылка:*
\`https://t.me/${ctx.me.username}?start=REF${user.id}\``;
                await ctx.editMessageText(referralText, {
                    parse_mode: 'Markdown',
                    reply_markup: new InlineKeyboard()
                        .text('👥 Пригласить друзей', `referral_system_${raffleId}`)
                        .row()
                        .text('🔍 Проверить рефералы', `check_referrals_${raffleId}`)
                        .row()
                        .text('🔙 Назад', 'back_to_main')
                });
                return;
            }
            else {
                // Реферальные требования выполнены, регистрируем участие
                console.log(`📝 Регистрируем участие: user.id=${user.id}, raffleId=${raffleId} (подписка + рефералы выполнены)`);
                await this.raffleService.addParticipant(user.id, raffleId, true);
                console.log(`✅ Участие зарегистрировано для пользователя ${user.id} в розыгрыше ${raffleId}`);
                const successText = `🎉 *Поздравляем! Вы успешно зарегистрированы в розыгрыше!*

🎁 Приз: ${raffle.prize_description}
🏆 Количество победителей: ${raffle.winners_count}
⏰ Завершение: ${raffle.end_date.toLocaleDateString('ru-RU')}
📅 Время: ${raffle.end_date.toLocaleTimeString('ru-RU')}

✅ *Ваше участие подтверждено*
👥 Реферальные требования выполнены: ${referralRequirements.currentReferrals}/${referralRequirements.requiredReferrals}
🎯 *Множитель шансов:* +${Math.round((this.raffleService.calculateBonusMultiplier(referralRequirements.currentReferrals) - 1) * 100)}% к вероятности победы
💡 *Как это работает:* Чем больше друзей вы пригласите, тем выше ваш шанс на победу!
📊 Результаты будут объявлены автоматически после завершения розыгрыша

🍀 Удачи! Надеемся, что именно вы станете победителем!`;
                await ctx.editMessageText(successText, {
                    parse_mode: 'Markdown',
                    reply_markup: Keyboards.backToMain()
                });
                return;
            }
        }
        else {
            // Нет реферальных требований, просто регистрируем участие
            console.log(`📝 Регистрируем участие: user.id=${user.id}, raffleId=${raffleId} (только подписка)`);
            await this.raffleService.addParticipant(user.id, raffleId, true);
            console.log(`✅ Участие зарегистрировано для пользователя ${user.id} в розыгрыше ${raffleId}`);
            const successText = `🎉 *Поздравляем! Вы успешно зарегистрированы в розыгрыше!*

🎁 Приз: ${raffle.prize_description}
🏆 Количество победителей: ${raffle.winners_count}
⏰ Завершение: ${raffle.end_date.toLocaleDateString('ru-RU')}
📅 Время: ${raffle.end_date.toLocaleTimeString('ru-RU')}

✅ *Ваше участие подтверждено*
📊 Результаты будут объявлены автоматически после завершения розыгрыша

🍀 Удачи! Надеемся, что именно вы станете победителем!`;
            await ctx.editMessageText(successText, {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.backToMain()
            });
        }
    }
    async checkSubscriptions(ctx, raffleId) {
        await this.handleParticipation(ctx, raffleId);
    }
    async checkSocialSubscriptions(ctx, raffleId) {
        console.log(`🔍 Проверяем подписки на социальные аккаунты для розыгрыша ${raffleId}`);
        const user = await this.userService.getUserByTelegramId(ctx.from.id);
        if (!user)
            return;
        const raffle = await this.raffleService.getRaffleById(raffleId);
        if (!raffle)
            return;
        const socialAccounts = await this.socialAccountService.getSocialRequirementsForRaffle(raffleId);
        if (socialAccounts.length === 0)
            return;
        // Проверяем подписки на социальные аккаунты
        let allSubscribed = true;
        const subscriptionResults = [];
        for (const requirement of socialAccounts) {
            try {
                // Пока что возвращаем true для всех аккаунтов (заглушка)
                // В реальной реализации здесь будет проверка через API социальных сетей
                const subscribed = await this.socialAccountService.checkSocialSubscription(requirement.social_account.platform, requirement.social_account.username, user.telegram_id);
                subscriptionResults.push({ account: requirement.social_account, subscribed });
                if (!subscribed)
                    allSubscribed = false;
            }
            catch (error) {
                console.log(`❌ Ошибка проверки подписки на социальный аккаунт ${requirement.social_account.display_name}:`, error);
                subscriptionResults.push({ account: requirement.social_account, subscribed: false });
                allSubscribed = false;
            }
        }
        if (allSubscribed) {
            // Все подписки выполнены, регистрируем участие
            await this.raffleService.addParticipant(user.id, raffleId, true);
            const successText = `✅ *Подписка на социальные аккаунты подтверждена!*

🎁 Приз: ${raffle.prize_description}
🏆 Победителей: ${raffle.winners_count}
⏰ Завершение: ${raffle.end_date.toLocaleDateString('ru-RU')}

✅ *Ваше участие подтверждено*
📊 Результаты будут объявлены автоматически после завершения розыгрыша

🍀 Удачи! Надеемся, что именно вы станете победителем!`;
            await ctx.editMessageText(successText, {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.backToMain()
            });
        }
        else {
            // Не все подписки выполнены
            let resultText = `❌ *Не все подписки выполнены*

🎁 Приз: ${raffle.prize_description}
🏆 Победителей: ${raffle.winners_count}
⏰ Завершение: ${raffle.end_date.toLocaleDateString('ru-RU')}

📊 *Результаты проверки:*\n`;
            subscriptionResults.forEach((result, index) => {
                const status = result.subscribed ? '✅' : '❌';
                const icon = this.getPlatformIcon(result.account.platform);
                resultText += `${status} ${icon} ${result.account.display_name}\n`;
            });
            resultText += `\n💡 *Для участия необходимо подписаться на все социальные аккаунты*`;
            await ctx.editMessageText(resultText, {
                parse_mode: 'Markdown',
                reply_markup: new InlineKeyboard()
                    .text('🔍 Проверить снова', `check_social_subscription_${raffleId}`)
                    .row()
                    .text('🔙 Назад к розыгрышам', 'active_raffles')
            });
        }
    }
    async checkCombinedSubscriptions(ctx, raffleId) {
        console.log(`🔍 Проверяем комбинированные подписки для розыгрыша ${raffleId}`);
        const user = await this.userService.getUserByTelegramId(ctx.from.id);
        if (!user)
            return;
        const raffle = await this.raffleService.getRaffleById(raffleId);
        if (!raffle)
            return;
        const channels = await this.channelService.getChannelsByRaffleId(raffleId);
        const socialAccounts = await this.socialAccountService.getSocialRequirementsForRaffle(raffleId);
        // Проверяем подписки на каналы
        let allChannelsSubscribed = true;
        const channelResults = [];
        for (const channel of channels) {
            try {
                const isSubscribed = await this.bot.api.getChatMember(channel.telegram_channel_id, ctx.from.id);
                const subscribed = isSubscribed.status !== 'left' && isSubscribed.status !== 'kicked';
                channelResults.push({ channel, subscribed });
                if (!subscribed)
                    allChannelsSubscribed = false;
            }
            catch (error) {
                console.log(`❌ Ошибка проверки подписки на канал ${channel.name}:`, error);
                channelResults.push({ channel, subscribed: false });
                allChannelsSubscribed = false;
            }
        }
        // Проверяем подписки на социальные аккаунты
        let allSocialSubscribed = true;
        const socialResults = [];
        for (const requirement of socialAccounts) {
            try {
                const subscribed = await this.socialAccountService.checkSocialSubscription(requirement.social_account.platform, requirement.social_account.username, user.telegram_id);
                socialResults.push({ account: requirement.social_account, subscribed });
                if (!subscribed)
                    allSocialSubscribed = false;
            }
            catch (error) {
                console.log(`❌ Ошибка проверки подписки на социальный аккаунт ${requirement.social_account.display_name}:`, error);
                socialResults.push({ account: requirement.social_account, subscribed: false });
                allSocialSubscribed = false;
            }
        }
        if (allChannelsSubscribed && allSocialSubscribed) {
            // Все подписки выполнены, регистрируем участие
            await this.raffleService.addParticipant(user.id, raffleId, true);
            const successText = `✅ *Все подписки подтверждены!*

🎁 Приз: ${raffle.prize_description}
🏆 Победителей: ${raffle.winners_count}
⏰ Завершение: ${raffle.end_date.toLocaleDateString('ru-RU')}

✅ *Ваше участие подтверждено*
📊 Результаты будут объявлены автоматически после завершения розыгрыша

🍀 Удачи! Надеемся, что именно вы станете победителем!`;
            await ctx.editMessageText(successText, {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.backToMain()
            });
        }
        else {
            // Не все подписки выполнены
            let resultText = `❌ *Не все подписки выполнены*

🎁 Приз: ${raffle.prize_description}
🏆 Победителей: ${raffle.winners_count}
⏰ Завершение: ${raffle.end_date.toLocaleDateString('ru-RU')}

📊 *Результаты проверки:*\n`;
            if (channels.length > 0) {
                resultText += `📺 *Каналы:*\n`;
                channelResults.forEach((result, index) => {
                    const status = result.subscribed ? '✅' : '❌';
                    resultText += `${status} ${result.channel.name}\n`;
                });
                resultText += `\n`;
            }
            if (socialAccounts.length > 0) {
                resultText += `📱 *Социальные сети:*\n`;
                socialResults.forEach((result, index) => {
                    const status = result.subscribed ? '✅' : '❌';
                    const icon = this.getPlatformIcon(result.account.platform);
                    resultText += `${status} ${icon} ${result.account.display_name}\n`;
                });
            }
            resultText += `\n💡 *Для участия необходимо подписаться на все каналы и социальные аккаунты*`;
            await ctx.editMessageText(resultText, {
                parse_mode: 'Markdown',
                reply_markup: new InlineKeyboard()
                    .text('🔍 Проверить снова', `check_combined_subscription_${raffleId}`)
                    .row()
                    .text('🔙 Назад к розыгрышам', 'active_raffles')
            });
        }
    }
    async showUserRaffles(ctx) {
        console.log(`📋 Показываем участия пользователя ${ctx.from.id}`);
        const user = await this.userService.getUserByTelegramId(ctx.from.id);
        if (!user) {
            console.log(`❌ Пользователь ${ctx.from.id} не найден`);
            return;
        }
        console.log(`✅ Пользователь найден: id=${user.id}, telegram_id=${user.telegram_id}`);
        const userRaffles = await this.raffleService.getUserParticipatedRaffles(user.id);
        console.log(`📊 Найдено ${userRaffles.length} участий для пользователя ${ctx.from.id}`);
        if (userRaffles.length === 0) {
            const text = `📭 *Мои участия в розыгрышах*

Вы пока не участвуете ни в одном розыгрыше.

🎁 Чтобы участвовать в розыгрышах:
1. Перейдите в раздел "Активные розыгрыши"
2. Выберите интересующий розыгрыш
3. Подпишитесь на все указанные каналы
4. Нажмите "Участвовать"`;
            await ctx.editMessageText(text, {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.backToMain()
            });
            return;
        }
        let text = `📋 *Мои участия в розыгрышах:*\n\n`;
        userRaffles.slice(0, 10).forEach((raffle, index) => {
            const statusEmoji = raffle.status === 'ACTIVE' ? '🟢' :
                raffle.status === 'FINISHED' ? '✅' : '⏸️';
            text += `${index + 1}. ${statusEmoji} *${raffle.prize_description}*\n`;
            text += `   📅 Статус: ${this.getStatusText(raffle.status)}\n`;
            text += `   ⏰ Завершение: ${raffle.end_date.toLocaleDateString('ru-RU')}\n`;
            text += `   🎁 Приз: ${raffle.prize_description}\n\n`;
        });
        if (userRaffles.length > 10) {
            text += `📄 Показано ${userRaffles.length} из ${userRaffles.length} участий\n\n`;
        }
        text += `💡 Результаты розыгрышей будут объявлены автоматически после их завершения.`;
        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.backToMain()
        });
    }
    getStatusText(status) {
        switch (status) {
            case 'ACTIVE': return 'Активный';
            case 'FINISHED': return 'Завершен';
            case 'SCHEDULED': return 'Запланирован';
            case 'CANCELED': return 'Отменен';
            default: return status;
        }
    }
    async showActiveRaffles(ctx) {
        console.log(`🎁 Показываем активные розыгрыши для пользователя ${ctx.from.id}`);
        const user = await this.userService.getUserByTelegramId(ctx.from.id);
        const activeRaffles = await this.raffleService.getActiveRaffles();
        if (activeRaffles.length === 0) {
            const noRafflesText = `📭 Активных розыгрышей пока нет.

🎉 Следите за нашими каналами - новые розыгрыши появляются регулярно!`;
            await this.sendMessage(ctx, noRafflesText, {
                reply_markup: Keyboards.backToMain()
            });
            return;
        }
        let rafflesText = `🎁 *Активные розыгрыши:*\n\n`;
        for (let i = 0; i < activeRaffles.length; i++) {
            const raffle = activeRaffles[i];
            // Получаем каналы для этого розыгрыша
            const channels = await this.channelService.getChannelsByRaffleId(raffle.id);
            // Получаем социальные аккаунты для этого розыгрыша
            const socialAccounts = await this.socialAccountService.getSocialRequirementsForRaffle(raffle.id);
            // Проверяем, участвует ли пользователь в этом розыгрыше
            let participationStatus = '';
            if (user) {
                const isParticipating = await this.raffleService.isUserParticipating(user.id, raffle.id);
                participationStatus = isParticipating ? ' ✅ Вы участвуете' : ' 🆕 Доступен для участия';
            }
            rafflesText += `${i + 1}. *${raffle.prize_description}*${participationStatus}\n`;
            rafflesText += `   🎁 Приз: ${raffle.prize_description}\n`;
            rafflesText += `   👥 Победителей: ${raffle.winners_count}\n`;
            rafflesText += `   ⏰ Завершение: ${new Date(raffle.end_date).toLocaleDateString('ru-RU')}\n`;
            if (channels.length > 0) {
                rafflesText += `   📺 Каналы для подписки: ${channels.length}\n`;
            }
            if (socialAccounts.length > 0) {
                rafflesText += `   📱 Социальные сети: ${socialAccounts.length}\n`;
            }
            if (raffle.referral_requirement) {
                rafflesText += `   👥 Рефералы: ${raffle.min_referrals} друзей\n`;
            }
            rafflesText += `\n`;
        }
        rafflesText += `💡 *Для участия:*\n`;
        rafflesText += `1️⃣ Нажмите номер розыгрыша\n`;
        rafflesText += `2️⃣ Выполните все условия\n`;
        rafflesText += `3️⃣ Пройдите проверку\n`;
        rafflesText += `4️⃣ Получите подтверждение участия`;
        const keyboard = new InlineKeyboard();
        activeRaffles.forEach((raffle, index) => {
            keyboard.text(`${index + 1}`, `view_raffle_${raffle.id}`);
            if ((index + 1) % 3 === 0)
                keyboard.row();
        });
        keyboard.row().text('🔙 Назад', 'back_to_main');
        await this.sendMessage(ctx, rafflesText, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
    async showRaffleDetails(ctx, raffleId) {
        console.log(`🎁 Показываем детали розыгрыша ${raffleId} для пользователя ${ctx.from.id}`);
        const user = await this.userService.getUserByTelegramId(ctx.from.id);
        const raffle = await this.raffleService.getRaffleById(raffleId);
        if (!raffle) {
            await ctx.editMessageText('❌ Розыгрыш не найден.', {
                reply_markup: Keyboards.backToMain()
            });
            return;
        }
        // Получаем каналы для этого розыгрыша
        const channels = await this.channelService.getChannelsByRaffleId(raffle.id);
        // Получаем социальные аккаунты для этого розыгрыша
        const socialAccounts = await this.socialAccountService.getSocialRequirementsForRaffle(raffle.id);
        // Проверяем, участвует ли пользователь в этом розыгрыше
        let participationStatus = '';
        if (user) {
            const isParticipating = await this.raffleService.isUserParticipating(user.id, raffle.id);
            participationStatus = isParticipating ? ' ✅ Вы участвуете' : ' 🆕 Доступен для участия';
        }
        let raffleText = `🎁 *Розыгрыш: ${raffle.prize_description}*${participationStatus}\n\n`;
        raffleText += `🎁 *Приз:* ${raffle.prize_description}\n`;
        raffleText += `👥 *Победителей:* ${raffle.winners_count}\n`;
        raffleText += `⏰ *Завершение:* ${new Date(raffle.end_date).toLocaleDateString('ru-RU')}\n`;
        // Добавляем информацию о требованиях
        if (channels.length > 0) {
            raffleText += `📺 *Каналы для подписки:* ${channels.length}\n`;
        }
        if (socialAccounts.length > 0) {
            raffleText += `📱 *Социальные сети:* ${socialAccounts.length}\n`;
        }
        if (raffle.referral_requirement) {
            raffleText += `👥 *Реферальные требования:* ${raffle.min_referrals} друзей\n`;
        }
        // Определяем требования для участия
        let requirementsText = '';
        const hasChannels = channels.length > 0;
        const hasSocialAccounts = socialAccounts.length > 0;
        const hasReferrals = raffle.referral_requirement;
        if (hasReferrals && hasChannels && hasSocialAccounts) {
            // Розыгрыш с рефералами, каналами и социальными сетями
            requirementsText = `💡 *Для участия:*\n`;
            requirementsText += `1️⃣ Подпишитесь на ${channels.length} каналов\n`;
            requirementsText += `2️⃣ Подпишитесь на ${socialAccounts.length} социальных аккаунтов\n`;
            requirementsText += `3️⃣ Пригласите ${raffle.min_referrals} друзей\n`;
            requirementsText += `4️⃣ **Автоматическое зачисление при регистрации друзей**\n`;
            requirementsText += `5️⃣ Участие подтверждается автоматически`;
        }
        else if (hasReferrals && hasChannels && !hasSocialAccounts) {
            // Розыгрыш с рефералами и подпиской на каналы
            requirementsText = `💡 *Для участия:*\n`;
            requirementsText += `1️⃣ Подпишитесь на ${channels.length} каналов\n`;
            requirementsText += `2️⃣ Пригласите ${raffle.min_referrals} друзей\n`;
            requirementsText += `3️⃣ **Автоматическое зачисление при регистрации друзей**\n`;
            requirementsText += `4️⃣ Участие подтверждается автоматически`;
        }
        else if (hasReferrals && !hasChannels && hasSocialAccounts) {
            // Розыгрыш с рефералами и социальными сетями
            requirementsText = `💡 *Для участия:*\n`;
            requirementsText += `1️⃣ Подпишитесь на ${socialAccounts.length} социальных аккаунтов\n`;
            requirementsText += `2️⃣ Пригласите ${raffle.min_referrals} друзей\n`;
            requirementsText += `3️⃣ **Автоматическое зачисление при регистрации друзей**\n`;
            requirementsText += `4️⃣ Участие подтверждается автоматически`;
        }
        else if (hasReferrals && !hasChannels && !hasSocialAccounts) {
            // Розыгрыш только с рефералами
            requirementsText = `💡 *Для участия:*\n`;
            requirementsText += `1️⃣ Пригласите ${raffle.min_referrals} друзей\n`;
            requirementsText += `2️⃣ **Автоматическое зачисление при регистрации друзей**\n`;
            requirementsText += `3️⃣ Получите подтверждение участия`;
        }
        else if (!hasReferrals && hasChannels && hasSocialAccounts) {
            // Розыгрыш с каналами и социальными сетями
            requirementsText = `💡 *Для участия:*\n`;
            requirementsText += `1️⃣ Подпишитесь на ${channels.length} каналов\n`;
            requirementsText += `2️⃣ Подпишитесь на ${socialAccounts.length} социальных аккаунтов\n`;
            requirementsText += `3️⃣ Пройдите проверку подписок\n`;
            requirementsText += `4️⃣ Получите подтверждение участия`;
        }
        else if (!hasReferrals && hasChannels && !hasSocialAccounts) {
            // Обычный розыгрыш с подпиской на каналы
            requirementsText = `💡 *Для участия:*\n`;
            requirementsText += `1️⃣ Подпишитесь на ${channels.length} каналов\n`;
            requirementsText += `2️⃣ Пройдите проверку подписки\n`;
            requirementsText += `3️⃣ Получите подтверждение участия`;
        }
        else if (!hasReferrals && !hasChannels && hasSocialAccounts) {
            // Розыгрыш только с социальными сетями
            requirementsText = `💡 *Для участия:*\n`;
            requirementsText += `1️⃣ Подпишитесь на ${socialAccounts.length} социальных аккаунтов\n`;
            requirementsText += `2️⃣ Пройдите проверку подписок\n`;
            requirementsText += `3️⃣ Получите подтверждение участия`;
        }
        else {
            // Розыгрыш без требований
            requirementsText = `💡 *Для участия:*\n`;
            requirementsText += `1️⃣ Нажмите "Участвовать"\n`;
            requirementsText += `2️⃣ Получите подтверждение участия`;
        }
        // Добавляем информацию о бонусе и множителе шансов для реферальных розыгрышей
        if (hasReferrals) {
            if (raffle.referral_bonus) {
                requirementsText += `\n\n🎁 *Бонус:* ${raffle.referral_bonus}`;
            }
            const multiplier = this.raffleService.calculateBonusMultiplier(raffle.min_referrals);
            const bonusPercent = Math.round((multiplier - 1) * 100);
            requirementsText += `\n\n🎯 *Множитель шансов:* +${bonusPercent}% к вероятности победы`;
            requirementsText += `\n💡 *Как это работает:* Чем больше друзей вы пригласите, тем выше ваш шанс на победу!`;
        }
        raffleText += `\n${requirementsText}`;
        const keyboard = new InlineKeyboard();
        // Кнопка участия
        if (user) {
            const isParticipating = await this.raffleService.isUserParticipating(user.id, raffle.id);
            if (!isParticipating) {
                keyboard.text('🎯 Участвовать', `participate_${raffle.id}`);
            }
            else {
                keyboard.text('✅ Вы участвуете', `participate_${raffle.id}`);
            }
        }
        keyboard.row().text('🔙 К списку розыгрышей', 'active_raffles');
        keyboard.row().text('🏠 Главное меню', 'back_to_main');
        // Если есть фото приза, отправляем с фото
        if (raffle.photo_file_id) {
            try {
                await ctx.replyWithPhoto(raffle.photo_file_id, {
                    caption: raffleText,
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            }
            catch (error) {
                console.log('❌ Ошибка при отправке фото:', error);
                await ctx.reply(raffleText, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            }
        }
        // Если есть видео приза, отправляем с видео
        else if (raffle.video_file_id) {
            try {
                await ctx.replyWithVideo(raffle.video_file_id, {
                    caption: raffleText,
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            }
            catch (error) {
                console.log('❌ Ошибка при отправке видео:', error);
                await ctx.reply(raffleText, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            }
        }
        // Если нет медиа, отправляем обычное сообщение
        else {
            await ctx.reply(raffleText, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        }
    }
    async showHelp(ctx) {
        console.log(`❓ Показываем справку для пользователя ${ctx.from.id}`);
        const helpText = `❓ *Справка по боту*

🎁 *Как участвовать в розыгрышах:*
1. Найдите активный розыгрыш в меню
2. Нажмите кнопку "Участвовать"
3. Подпишитесь на все указанные каналы
4. Дождитесь результатов розыгрыша

📋 *Возможности бота:*
• 🎁 Просмотр активных розыгрышей
• 📋 Отслеживание своих участий
• 📢 Информация о наших каналах
• ❓ Справка по использованию

💡 *Важно:* Для участия в розыгрыше необходимо быть подписанным на все указанные каналы-партнеры.`;
        await this.sendMessage(ctx, helpText, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.backToMain()
        });
    }
    async showOfficialChannel(ctx) {
        console.log(`📢 Показываем официальный канал для пользователя ${ctx.from.id}`);
        const officialChannel = await this.officialChannelService.getOfficialChannel();
        if (!officialChannel) {
            const noChannelText = `📭 Официальный канал пока не настроен.

🎉 Следите за обновлениями!`;
            await this.sendMessage(ctx, noChannelText, {
                reply_markup: Keyboards.backToMain()
            });
            return;
        }
        const text = `📢 *Наш официальный канал*

🎯 *${officialChannel.name}*

💬 Подписывайтесь на наш канал, чтобы не пропустить новые розыгрыши!

🔗 \`${officialChannel.invite_link}\`

${officialChannel.description ? `📝 ${officialChannel.description}\n\n` : ''}💡 Нажмите на ссылку выше, чтобы перейти в канал`;
        await this.sendMessage(ctx, text, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.backToMain()
        });
    }
    async showMainMenu(ctx) {
        console.log(`🏠 Показываем главное меню для пользователя ${ctx.from.id}`);
        // Получаем настройки бота
        const settings = await this.botSettingsService.getSettings();
        // Получаем количество активных розыгрышей
        const activeRaffles = await this.raffleService.getActiveRaffles();
        const activeCount = activeRaffles.length;
        // Получаем количество участий пользователя в активных розыгрышах
        const user = await this.userService.getUserByTelegramId(ctx.from.id);
        let participationCount = 0;
        if (user) {
            const userRaffles = await this.raffleService.getUserParticipatedRaffles(user.id);
            // Фильтруем только активные розыгрыши
            const activeUserRaffles = userRaffles.filter((raffle) => raffle.status === 'ACTIVE' && new Date(raffle.end_date) > new Date());
            participationCount = activeUserRaffles.length;
        }
        const welcomeText = `${settings.welcome_message}

📊 *Статистика:*
• 🎁 Активных розыгрышей: ${activeCount}
• 📋 Ваших участий в активных: ${participationCount}

💡 Выберите действие из меню ниже:`;
        // Если есть обложка, отправляем с фото
        if (settings.cover_photo_file_id) {
            try {
                await ctx.replyWithPhoto(settings.cover_photo_file_id, {
                    caption: welcomeText,
                    parse_mode: 'Markdown',
                    reply_markup: Keyboards.mainUser(activeCount, participationCount)
                });
            }
            catch (error) {
                console.log('❌ Ошибка при отправке обложки:', error);
                await this.sendMessage(ctx, welcomeText, {
                    parse_mode: 'Markdown',
                    reply_markup: Keyboards.mainUser(activeCount, participationCount)
                });
            }
        }
        else {
            await this.sendMessage(ctx, welcomeText, {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.mainUser(activeCount, participationCount)
            });
        }
    }
    async handleAdminPanelAccess(ctx) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        // Проверяем, является ли пользователь администратором
        if (this.adminIds.includes(userId)) {
            console.log(`🔧 Пользователь ${userId} получил доступ к админ-панели`);
            const adminText = `🔧 *Админ-панель*

Выберите действие:`;
            await this.sendMessage(ctx, adminText, {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.adminMain()
            });
        }
        else {
            console.log(`❌ Пользователь ${userId} попытался получить доступ к админ-панели`);
            const accessDeniedText = `❌ *Доступ запрещен*

Вы не являетесь администратором этого бота.

💡 Если вы считаете, что это ошибка, обратитесь к администратору.`;
            await this.sendMessage(ctx, accessDeniedText, {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.backToMain()
            });
        }
    }
    async showAdminOfficialChannel(ctx) {
        const text = `📢 *Управление официальным каналом*

Выберите действие:`;
        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.adminOfficialChannel()
        });
    }
    async startAddOfficialChannel(ctx) {
        const userId = ctx.from.id;
        // Устанавливаем состояние для добавления официального канала
        this.adminStates[userId] = {
            step: 'add_official_channel',
            tempData: {}
        };
        const text = `➕ *Добавление официального канала*

📝 Отправьте ссылку на ваш официальный канал в формате:
\`https://t.me/channel_name\`

💡 Это будет основной канал, который будет отображаться пользователям в меню "Наш официальный канал"`;
        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.cancelAction()
        });
    }
    async showOfficialChannelInfo(ctx) {
        const officialChannel = await this.officialChannelService.getOfficialChannel();
        if (!officialChannel) {
            const text = `📭 *Официальный канал не настроен*

💡 Добавьте официальный канал, чтобы пользователи могли подписываться на него.`;
            await ctx.editMessageText(text, {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.backToAdmin()
            });
            return;
        }
        const text = `📋 *Информация об официальном канале*

🎯 *Название:* ${officialChannel.name}
🔗 *Ссылка:* \`${officialChannel.invite_link}\`
📅 *Добавлен:* ${new Date(officialChannel.created_at).toLocaleString('ru-RU')}
${officialChannel.description ? `📝 *Описание:* ${officialChannel.description}\n` : ''}

💡 Этот канал отображается пользователям в меню "Наш официальный канал"`;
        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.backToAdmin()
        });
    }
    async deleteOfficialChannel(ctx) {
        await this.officialChannelService.deleteOfficialChannel();
        const text = `✅ *Официальный канал удален*

📭 Теперь пользователи не увидят кнопку "Наш официальный канал" в меню.

💡 Добавьте новый официальный канал, если необходимо.`;
        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.backToAdmin()
        });
    }
    async handleAddOfficialChannel(ctx, text) {
        console.log('➕ Обработка добавления официального канала');
        console.log('🔍 Попытка добавления официального канала:', text);
        try {
            // Парсим ссылку на канал
            const channelMatch = text.match(/https:\/\/t\.me\/([^\/\s]+)/);
            if (!channelMatch) {
                await ctx.reply('❌ Неверный формат ссылки. Используйте формат: `https://t.me/channel_name`', {
                    parse_mode: 'Markdown',
                    reply_markup: Keyboards.cancelAction()
                });
                return;
            }
            const channelUsername = channelMatch[1];
            console.log('📺 Парсинг официального канала: Username=@' + channelUsername + ', Link=' + text);
            // Получаем информацию о канале через Telegram API
            const chat = await this.bot.api.getChat(`@${channelUsername}`);
            console.log('📋 Информация об официальном канале:', chat);
            if (chat.type !== 'channel') {
                await ctx.reply('❌ Указанная ссылка не является каналом.', {
                    reply_markup: Keyboards.cancelAction()
                });
                return;
            }
            // Создаем официальный канал
            await this.officialChannelService.createOfficialChannel(chat.id.toString(), chat.title || 'Unknown Channel', text, chat.description);
            // Очищаем состояние админа
            delete this.adminStates[ctx.from.id];
            const successText = `✅ *Официальный канал успешно добавлен!*

🎯 *Название:* ${chat.title}
🔗 *Ссылка:* \`${text}\`
${chat.description ? `📝 *Описание:* ${chat.description}\n` : ''}

💡 Теперь пользователи смогут подписываться на ваш официальный канал через меню "Наш официальный канал"`;
            await ctx.reply(successText, {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.backToAdmin()
            });
        }
        catch (error) {
            console.error('❌ Ошибка при добавлении официального канала:', error);
            let errorMessage = '❌ Ошибка при добавлении канала.';
            if (error instanceof Error) {
                if (error.message.includes('chat not found')) {
                    errorMessage = '❌ Канал не найден. Проверьте ссылку и убедитесь, что канал существует и публичный.';
                }
                else if (error.message.includes('Forbidden')) {
                    errorMessage = '❌ Нет доступа к каналу. Убедитесь, что канал публичный и бот может получить к нему доступ.';
                }
                else {
                    errorMessage = `❌ Ошибка: ${error.message}`;
                }
            }
            await ctx.reply(errorMessage, {
                reply_markup: Keyboards.cancelAction()
            });
        }
    }
    async startEditOfficialChannelDescription(ctx) {
        const officialChannel = await this.officialChannelService.getOfficialChannel();
        if (!officialChannel) {
            const text = `❌ *Официальный канал не настроен*

💡 Сначала добавьте официальный канал, а затем сможете редактировать его описание.`;
            await ctx.editMessageText(text, {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.backToAdmin()
            });
            return;
        }
        const userId = ctx.from.id;
        // Устанавливаем состояние для редактирования описания
        this.adminStates[userId] = {
            step: 'edit_official_channel_description',
            tempData: {
                channelId: officialChannel.id
            }
        };
        const currentDescription = officialChannel.description || 'Описание не задано';
        const text = `✏️ *Редактирование описания официального канала*

🎯 *Текущий канал:* ${officialChannel.name}
📝 *Текущее описание:* ${currentDescription}

💬 Отправьте новое описание для официального канала:

💡 Описание будет отображаться пользователям при просмотре официального канала.`;
        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.cancelAction()
        });
    }
    async handleEditOfficialChannelDescription(ctx, text) {
        console.log('✏️ Обработка редактирования описания официального канала');
        console.log('📝 Новое описание:', text);
        try {
            const userId = ctx.from.id;
            const state = this.adminStates[userId];
            const channelId = state.tempData.channelId;
            // Получаем текущий канал
            const officialChannel = await this.officialChannelService.getOfficialChannel();
            if (!officialChannel || officialChannel.id !== channelId) {
                await ctx.reply('❌ Официальный канал не найден или был изменен.', {
                    reply_markup: Keyboards.backToAdmin()
                });
                return;
            }
            // Обновляем описание канала
            await this.officialChannelService.updateOfficialChannel(officialChannel.id, officialChannel.telegram_channel_id, officialChannel.name, officialChannel.invite_link, text);
            // Очищаем состояние админа
            delete this.adminStates[userId];
            const successText = `✅ *Описание официального канала обновлено!*

🎯 *Канал:* ${officialChannel.name}
📝 *Новое описание:* ${text}

💡 Теперь пользователи увидят новое описание при просмотре официального канала.`;
            await ctx.reply(successText, {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.backToAdmin()
            });
        }
        catch (error) {
            console.error('❌ Ошибка при обновлении описания официального канала:', error);
            await ctx.reply('❌ Ошибка при обновлении описания. Попробуйте еще раз.', {
                reply_markup: Keyboards.cancelAction()
            });
        }
    }
    async showMailingsToDelete(ctx) {
        const mailings = await this.mailingService.getAllMailings();
        if (mailings.length === 0) {
            await ctx.editMessageText('📭 Рассылок не найдено.', {
                reply_markup: Keyboards.backToAdmin()
            });
            return;
        }
        const text = `🗑️ *Выберите рассылку для удаления:*\n\n💡 Нажмите на рассылку, которую хотите удалить.\n\n📊 Статусы:\n⏰ - Запланирована\n📤 - Отправляется\n✅ - Завершена\n❌ - Отменена`;
        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.mailingsToDelete(mailings)
        });
    }
    async handleDeleteMailing(ctx, mailingId) {
        try {
            const mailing = await this.mailingService.getMailingById(mailingId);
            if (!mailing) {
                await ctx.answerCallbackQuery('❌ Рассылка не найдена');
                return;
            }
            // Удаляем рассылку
            await this.mailingService.deleteMailing(mailingId);
            await ctx.answerCallbackQuery('✅ Рассылка успешно удалена');
            const statusEmoji = mailing.status === 'COMPLETED' ? '✅' :
                mailing.status === 'SENDING' ? '📤' :
                    mailing.status === 'SCHEDULED' ? '⏰' : '❌';
            await ctx.editMessageText(`🗑️ *Рассылка удалена:*\n\n${statusEmoji} *${mailing.message_text.substring(0, 100)}...*\n\n📊 Статус: ${this.getMailingStatusText(mailing.status)}\n📈 Отправлено: ${mailing.sent_count}, Ошибок: ${mailing.failed_count}\n📅 Создана: ${new Date(mailing.created_at).toLocaleDateString('ru-RU')}\n\n✅ Рассылка успешно удалена из базы данных.`, {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.backToAdmin()
            });
        }
        catch (error) {
            console.error('❌ Ошибка при удалении рассылки:', error);
            await ctx.answerCallbackQuery('❌ Ошибка при удалении рассылки');
            await ctx.editMessageText('❌ Произошла ошибка при удалении рассылки.', {
                reply_markup: Keyboards.backToAdmin()
            });
        }
    }
    async handleMailingPhoto(ctx) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        const state = this.adminStates[userId];
        // Проверяем, есть ли фото в сообщении
        if (!ctx.message?.photo || ctx.message.photo.length === 0) {
            await ctx.reply('❌ Пожалуйста, отправьте фото!', {
                reply_markup: Keyboards.cancelAction()
            });
            return;
        }
        // Берем самое большое фото (лучшее качество)
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        state.tempData.photoFileId = photo.file_id;
        await ctx.reply('✅ Фото добавлено! Теперь выберите время отправки:', {
            reply_markup: Keyboards.mailingScheduleSelection()
        });
    }
    async handleMailingVideo(ctx) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        const state = this.adminStates[userId];
        // Проверяем, есть ли видео в сообщении
        if (!ctx.message?.video) {
            await ctx.reply('❌ Пожалуйста, отправьте видео!', {
                reply_markup: Keyboards.cancelAction()
            });
            return;
        }
        state.tempData.videoFileId = ctx.message.video.file_id;
        await ctx.reply('✅ Видео добавлено! Теперь выберите время отправки:', {
            reply_markup: Keyboards.mailingScheduleSelection()
        });
    }
    // Методы для работы с настройками бота
    async startEditWelcomeMessage(ctx) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        this.adminStates[userId] = {
            step: 'edit_welcome_message',
            tempData: {}
        };
        await this.sendMessage(ctx, '✏️ *Редактирование приветственного сообщения*\n\n📝 Введите новое приветственное сообщение для главного меню:', {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.cancelAction()
        });
    }
    async startAddCoverPhoto(ctx) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        this.adminStates[userId] = {
            step: 'add_cover_photo',
            tempData: {}
        };
        await this.sendMessage(ctx, '🖼️ *Добавление обложки бота*\n\n📸 Отправьте фото, которое будет отображаться в главном меню:', {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.cancelAction()
        });
    }
    async removeCoverPhoto(ctx) {
        try {
            await this.botSettingsService.removeCoverPhoto();
            await ctx.answerCallbackQuery('✅ Обложка бота успешно удалена');
            await this.sendMessage(ctx, '🗑️ *Обложка удалена*\n\n✅ Обложка бота успешно удалена.\n\n💡 Теперь в главном меню будет отображаться только текст без изображения.', {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.backToAdmin()
            });
        }
        catch (error) {
            console.error('❌ Ошибка при удалении обложки:', error);
            await ctx.answerCallbackQuery('❌ Ошибка при удалении обложки');
            await this.sendMessage(ctx, '❌ Произошла ошибка при удалении обложки.', {
                reply_markup: Keyboards.backToAdmin()
            });
        }
    }
    async handleEditWelcomeMessageText(ctx, text) {
        try {
            await this.botSettingsService.updateWelcomeMessage(text);
            await ctx.reply('✅ *Приветственное сообщение обновлено!*\n\n📝 Новое сообщение:\n\n' + text, {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.backToAdmin()
            });
            // Очищаем состояние
            if (ctx.from) {
                delete this.adminStates[ctx.from.id];
            }
        }
        catch (error) {
            console.error('❌ Ошибка при обновлении приветственного сообщения:', error);
            await ctx.reply('❌ Произошла ошибка при обновлении приветственного сообщения.', {
                reply_markup: Keyboards.cancelAction()
            });
        }
    }
    async handleCoverPhoto(ctx) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        // Проверяем, есть ли фото в сообщении
        if (!ctx.message?.photo || ctx.message.photo.length === 0) {
            await ctx.reply('❌ Пожалуйста, отправьте фото!', {
                reply_markup: Keyboards.cancelAction()
            });
            return;
        }
        try {
            // Берем самое большое фото (лучшее качество)
            const photo = ctx.message.photo[ctx.message.photo.length - 1];
            // Сохраняем file_id в настройках
            await this.botSettingsService.updateCoverPhoto(photo.file_id);
            await ctx.reply('✅ *Обложка бота успешно обновлена!*\n\n🖼️ Новое фото будет отображаться в главном меню.', {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.backToAdmin()
            });
            // Очищаем состояние
            delete this.adminStates[userId];
        }
        catch (error) {
            console.error('❌ Ошибка при обновлении обложки бота:', error);
            await ctx.reply('❌ Произошла ошибка при обновлении обложки бота.', {
                reply_markup: Keyboards.cancelAction()
            });
        }
    }
    // Методы для работы с реферальными розыгрышами
    async handleRaffleTypeSelection(ctx, type) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        this.adminStates[userId].tempData.raffleType = type;
        if (type === 'referral') {
            // Если выбран розыгрыш с рефералами, показываем выбор требований
            this.adminStates[userId].step = 'create_raffle_referral_requirements';
            await ctx.editMessageText('👥 Выберите требования для участия в розыгрыше:', {
                reply_markup: Keyboards.referralRequirementSelection()
            });
        }
        else {
            // Для обычного розыгрыша переходим к вводу названия
            this.adminStates[userId].step = 'create_raffle_title';
            await ctx.editMessageText('📝 Введите название розыгрыша:', {
                reply_markup: Keyboards.cancelAction()
            });
        }
    }
    async handleReferralRequirementSelection(ctx, requirement) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        this.adminStates[userId].tempData.referralRequirement = requirement;
        // Настраиваем параметры в зависимости от выбора
        switch (requirement) {
            case 'both':
                this.adminStates[userId].tempData.referralRequirement = true;
                this.adminStates[userId].tempData.minReferrals = 1;
                this.adminStates[userId].tempData.maxReferrals = 5;
                this.adminStates[userId].tempData.referralBonus = 'Дополнительный шанс на победу';
                break;
            case 'subscription':
                this.adminStates[userId].tempData.referralRequirement = false;
                this.adminStates[userId].tempData.minReferrals = 0;
                this.adminStates[userId].tempData.maxReferrals = 0;
                break;
            case 'referrals':
                this.adminStates[userId].tempData.referralRequirement = true;
                this.adminStates[userId].tempData.minReferrals = 2;
                this.adminStates[userId].tempData.maxReferrals = 10;
                this.adminStates[userId].tempData.referralBonus = 'VIP статус и приоритет';
                break;
        }
        // Переходим к настройке количества рефералов
        this.adminStates[userId].step = 'create_raffle_referral_count';
        await ctx.editMessageText(`👥 Введите минимальное количество рефералов для участия (рекомендуется: ${this.adminStates[userId].tempData.minReferrals}):`, {
            reply_markup: Keyboards.cancelAction()
        });
    }
    async handleCreateRaffleReferralCount(ctx, text) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        const minReferrals = parseInt(text);
        if (isNaN(minReferrals) || minReferrals < 0) {
            await ctx.reply('❌ Введите корректное количество рефералов (минимум 0):');
            return;
        }
        this.adminStates[userId].tempData.minReferrals = minReferrals;
        // Переходим к вводу названия розыгрыша
        this.adminStates[userId].step = 'create_raffle_title';
        await ctx.reply('📝 Введите название розыгрыша:');
    }
    // Методы для реферальной системы
    async showReferralSystem(ctx) {
        if (!ctx.from)
            return;
        await ctx.editMessageText('👥 *Реферальная система*\n\n🎁 Приглашайте друзей и получайте бонусы!\n\n💡 Выберите действие:', {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.referralMain()
        });
    }
    // Реферальная система с контекстом розыгрыша
    async showReferralSystemWithContext(ctx, raffleId) {
        if (!ctx.from)
            return;
        const raffle = await this.raffleService.getRaffleById(raffleId);
        if (!raffle) {
            await ctx.editMessageText('❌ Розыгрыш не найден.', {
                reply_markup: Keyboards.backToMain()
            });
            return;
        }
        await ctx.editMessageText(`👥 *Реферальная система*\n\n🎁 Приглашайте друзей и получайте бонусы!\n\n🎯 *Розыгрыш:* ${raffle.prize_description}\n💡 Выберите действие:`, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.referralMainWithContext(raffleId)
        });
    }
    async showReferralLink(ctx) {
        if (!ctx.from)
            return;
        const user = await this.userService.getUserByTelegramId(ctx.from.id);
        if (!user)
            return;
        const referralCode = await this.referralService.getOrCreateReferralCode(user.id);
        const link = this.referralService.getReferralLink(user.id);
        await ctx.editMessageText(`🔗 *Ваша реферальная ссылка*\n\n📋 Код: \`${referralCode.code}\`\n🔗 Ссылка: \`${link}\`\n\n👥 Приглашено: ${referralCode.usage_count} друзей\n\n💡 Отправьте эту ссылку друзьям!`, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.referralLink(referralCode.code, link)
        });
    }
    async showReferralStats(ctx) {
        if (!ctx.from)
            return;
        const user = await this.userService.getUserByTelegramId(ctx.from.id);
        if (!user)
            return;
        const stats = await this.referralService.getUserReferralStats(user.id);
        // Показываем уведомление с актуальной статистикой
        await ctx.answerCallbackQuery(`📊 Статистика: ${stats.totalReferrals} рефералов`);
        await ctx.editMessageText(`📊 *Ваша реферальная статистика*\n\n👥 Всего приглашено: ${stats.totalReferrals}\n✅ Активных рефералов: ${stats.activeReferrals}\n🎁 Получено бонусов: ${stats.bonusClaimed}\n\n🔗 Ваш код: \`${stats.referralCode}\``, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.referralStats(stats)
        });
    }
    async showReferralList(ctx) {
        if (!ctx.from)
            return;
        const user = await this.userService.getUserByTelegramId(ctx.from.id);
        if (!user)
            return;
        const referrals = await this.referralService.getUserReferrals(user.id);
        // Показываем уведомление с количеством рефералов
        await ctx.answerCallbackQuery(`👥 Список: ${referrals.length} рефералов`);
        if (referrals.length === 0) {
            await ctx.editMessageText('📭 У вас пока нет рефералов.\n\n💡 Пригласите друзей по вашей реферальной ссылке!', {
                reply_markup: Keyboards.referralList()
            });
            return;
        }
        let text = '👥 *Ваши рефералы:*\n\n';
        referrals.forEach((referral, index) => {
            const status = referral.is_active ? '✅' : '❌';
            const bonus = referral.bonus_claimed ? '🎁' : '';
            text += `${index + 1}. ${status} ${referral.first_name} ${bonus}\n`;
            text += `   📅 ${referral.created_at.toLocaleDateString('ru-RU')}\n\n`;
        });
        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.referralList()
        });
    }
    async showReferralTop(ctx) {
        // Показываем уведомление о том, что топ обновлен
        await ctx.answerCallbackQuery('🏆 Топ рефералов обновлен');
        const topReferrers = await this.analyticsService.getReferralStats();
        let text = '🏆 *Топ рефералов:*\n\n';
        topReferrers.topReferrers.forEach((referrer, index) => {
            text += `${index + 1}. ${referrer.name} - ${referrer.referrals} рефералов\n`;
        });
        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.referralTop()
        });
    }
    async copyReferralLink(ctx) {
        await ctx.answerCallbackQuery('📋 Ссылка скопирована в буфер обмена!');
    }
    async shareReferralLink(ctx) {
        await ctx.answerCallbackQuery('📤 Функция поделиться будет доступна в следующем обновлении!');
    }
    // Проверка реферальных требований для розыгрыша
    async checkReferralRequirements(ctx, raffleId) {
        const user = await this.userService.getUserByTelegramId(ctx.from.id);
        if (!user)
            return;
        const raffle = await this.raffleService.getRaffleById(raffleId);
        if (!raffle) {
            await ctx.editMessageText('❌ Розыгрыш не найден.', {
                reply_markup: Keyboards.backToMain()
            });
            return;
        }
        const referralRequirements = await this.raffleService.checkUserReferralRequirements(user.id, raffleId);
        // Показываем уведомление с результатом проверки
        const statusText = referralRequirements.hasEnoughReferrals
            ? `✅ Достаточно рефералов: ${referralRequirements.currentReferrals}/${referralRequirements.requiredReferrals}`
            : `⏳ Недостаточно рефералов: ${referralRequirements.currentReferrals}/${referralRequirements.requiredReferrals}`;
        await ctx.answerCallbackQuery(statusText);
        if (referralRequirements.hasEnoughReferrals) {
            // Реферальные требования выполнены, регистрируем участие
            console.log(`📝 Регистрируем участие: user.id=${user.id}, raffleId=${raffleId} (рефералы выполнены)`);
            await this.raffleService.addParticipant(user.id, raffleId, true);
            console.log(`✅ Участие зарегистрировано для пользователя ${user.id} в розыгрыше ${raffleId}`);
            const successText = `🎉 *Поздравляем! Вы успешно зарегистрированы в розыгрыше!*

🎁 Приз: ${raffle.prize_description}
🏆 Количество победителей: ${raffle.winners_count}
⏰ Завершение: ${raffle.end_date.toLocaleDateString('ru-RU')}
📅 Время: ${raffle.end_date.toLocaleTimeString('ru-RU')}

✅ *Ваше участие подтверждено*
👥 Реферальные требования выполнены: ${referralRequirements.currentReferrals}/${referralRequirements.requiredReferrals}
🎯 *Множитель шансов:* +${Math.round((this.raffleService.calculateBonusMultiplier(referralRequirements.currentReferrals) - 1) * 100)}% к вероятности победы
📊 Результаты будут объявлены автоматически после завершения розыгрыша

🍀 Удачи! Надеемся, что именно вы станете победителем!`;
            await ctx.editMessageText(successText, {
                parse_mode: 'Markdown',
                reply_markup: Keyboards.backToMain()
            });
        }
        else {
            // Реферальные требования не выполнены, показываем текущий статус
            const referralText = `✅ *Подписка на каналы подтверждена!*

🎁 Приз: ${raffle.prize_description}
🏆 Победителей: ${raffle.winners_count}
⏰ Завершение: ${raffle.end_date.toLocaleDateString('ru-RU')}

📊 *Ваша статистика:*
👥 Приглашено друзей: ${referralRequirements.currentReferrals}/${referralRequirements.requiredReferrals}
🎯 Требуется: ${referralRequirements.requiredReferrals} рефералов

💡 *Следующий шаг:*
1️⃣ Скопируйте вашу реферальную ссылку
2️⃣ Отправьте её друзьям
3️⃣ **Как только они зарегистрируются - вы автоматически станете участником!**

🎯 *Множитель шансов:* +${Math.round((this.raffleService.calculateBonusMultiplier(referralRequirements.requiredReferrals) - 1) * 100)}% к вероятности победы
💡 *Как это работает:* Чем больше друзей вы пригласите, тем выше ваш шанс на победу!

🔗 *Ваша реферальная ссылка:*
\`https://t.me/${ctx.me.username}?start=REF${user.id}\``;
            await this.sendMessage(ctx, referralText, {
                parse_mode: 'Markdown',
                reply_markup: new InlineKeyboard()
                    .text('👥 Пригласить друзей', 'referral_system')
                    .row()
                    .text('🔍 Проверить рефералы', `check_referrals_${raffleId}`)
                    .row()
                    .text('🔙 Назад', 'back_to_main')
            });
        }
    }
    // Получение списка розыгрышей, в которые пользователь был автоматически зачислен
    async getAutoEnrolledRaffles(userId) {
        try {
            // Получаем все розыгрыши пользователя
            const userRaffles = await this.raffleService.getUserParticipatedRaffles(userId);
            // Фильтруем только активные розыгрыши
            const autoEnrolledRaffles = userRaffles.filter(raffle => raffle.status === 'ACTIVE' &&
                new Date(raffle.end_date) > new Date());
            return autoEnrolledRaffles;
        }
        catch (error) {
            console.error('❌ Ошибка при получении автоматически зачисленных розыгрышей:', error);
            return [];
        }
    }
    // Методы для реферальной системы с контекстом
    async showReferralLinkWithContext(ctx, raffleId) {
        if (!ctx.from)
            return;
        const user = await this.userService.getUserByTelegramId(ctx.from.id);
        if (!user)
            return;
        const referralCode = await this.referralService.getOrCreateReferralCode(user.id);
        const link = this.referralService.getReferralLink(user.id);
        await this.sendMessage(ctx, `🔗 *Ваша реферальная ссылка*\n\n📋 Код: \`${referralCode.code}\`\n🔗 Ссылка: \`${link}\`\n\n👥 Приглашено: ${referralCode.usage_count} друзей\n\n💡 Отправьте эту ссылку друзьям!`, {
            parse_mode: 'Markdown',
            reply_markup: new InlineKeyboard()
                .text('📋 Скопировать ссылку', 'referral_copy_link')
                .row()
                .text('📤 Поделиться', 'referral_share')
                .row()
                .text('🔙 Назад к розыгрышу', `check_referrals_${raffleId}`)
        });
    }
    async showReferralStatsWithContext(ctx, raffleId) {
        if (!ctx.from)
            return;
        const user = await this.userService.getUserByTelegramId(ctx.from.id);
        if (!user)
            return;
        // Показываем уведомление о том, что статистика обновлена
        await ctx.answerCallbackQuery('📊 Статистика обновлена');
        const stats = await this.referralService.getUserReferralStats(user.id);
        await this.sendMessage(ctx, `📊 *Ваша реферальная статистика*\n\n👥 Всего приглашено: ${stats.totalReferrals}\n✅ Активных рефералов: ${stats.activeReferrals}\n🎁 Получено бонусов: ${stats.bonusClaimed}\n\n🔗 Ваш код: \`${stats.referralCode}\``, {
            parse_mode: 'Markdown',
            reply_markup: new InlineKeyboard()
                .text('🔄 Обновить', `referral_stats_${raffleId}`)
                .row()
                .text('🔙 Назад к розыгрышу', `check_referrals_${raffleId}`)
        });
    }
    async showReferralListWithContext(ctx, raffleId) {
        if (!ctx.from)
            return;
        const user = await this.userService.getUserByTelegramId(ctx.from.id);
        if (!user)
            return;
        // Показываем уведомление о том, что список обновлен
        await ctx.answerCallbackQuery('👥 Список рефералов обновлен');
        const referrals = await this.referralService.getUserReferrals(user.id);
        if (referrals.length === 0) {
            await this.sendMessage(ctx, '📭 У вас пока нет рефералов.\n\n💡 Пригласите друзей по вашей реферальной ссылке!', {
                reply_markup: new InlineKeyboard()
                    .text('🔄 Обновить', `referral_list_${raffleId}`)
                    .row()
                    .text('🔙 Назад к розыгрышу', `check_referrals_${raffleId}`)
            });
            return;
        }
        let text = '👥 *Ваши рефералы:*\n\n';
        referrals.forEach((referral, index) => {
            const status = referral.is_active ? '✅' : '❌';
            const bonus = referral.bonus_claimed ? '🎁' : '';
            text += `${index + 1}. ${status} ${referral.first_name} ${bonus}\n`;
            text += `   📅 ${referral.created_at.toLocaleDateString('ru-RU')}\n\n`;
        });
        await this.sendMessage(ctx, text, {
            parse_mode: 'Markdown',
            reply_markup: new InlineKeyboard()
                .text('🔄 Обновить', `referral_list_${raffleId}`)
                .row()
                .text('🔙 Назад к розыгрышу', `check_referrals_${raffleId}`)
        });
    }
    async showReferralTopWithContext(ctx, raffleId) {
        // Показываем уведомление о том, что топ обновлен
        await ctx.answerCallbackQuery('🏆 Топ рефералов обновлен');
        const topReferrers = await this.analyticsService.getReferralStats();
        let text = '🏆 *Топ рефералов:*\n\n';
        topReferrers.topReferrers.forEach((referrer, index) => {
            text += `${index + 1}. ${referrer.name} - ${referrer.referrals} рефералов\n`;
        });
        await this.sendMessage(ctx, text, {
            parse_mode: 'Markdown',
            reply_markup: new InlineKeyboard()
                .text('🔄 Обновить', `referral_top_${raffleId}`)
                .row()
                .text('🔙 Назад к розыгрышу', `check_referrals_${raffleId}`)
        });
    }
    // ===== МЕТОДЫ ДЛЯ СОЦИАЛЬНЫХ СЕТЕЙ =====
    async showAdminSocial(ctx) {
        if (!ctx.from)
            return;
        const message = `📱 Управление социальными сетями\n\n` +
            `Здесь вы можете управлять аккаунтами в социальных сетях, ` +
            `которые будут использоваться в розыгрышах для привлечения трафика.\n\n` +
            `Выберите действие:`;
        await this.sendMessage(ctx, message, {
            reply_markup: Keyboards.adminSocial()
        });
    }
    async startAddSocialAccount(ctx) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        this.adminStates[userId] = {
            step: 'add_social_platform',
            tempData: {}
        };
        const message = `📱 Добавление социального аккаунта\n\n` +
            `Выберите платформу для добавления:`;
        await this.sendMessage(ctx, message, {
            reply_markup: Keyboards.socialPlatformSelection()
        });
    }
    async showSocialAccountsList(ctx) {
        if (!ctx.from)
            return;
        const accounts = await this.socialAccountService.getAllSocialAccounts();
        if (accounts.length === 0) {
            const message = `📱 Список социальных аккаунтов\n\n` +
                `❌ Пока нет добавленных аккаунтов.\n\n` +
                `Нажмите "➕ Добавить аккаунт" для создания первого аккаунта.`;
            await this.sendMessage(ctx, message, {
                reply_markup: Keyboards.adminSocial()
            });
            return;
        }
        let message = `📱 Список социальных аккаунтов\n\n`;
        accounts.forEach((account, index) => {
            const platformIcon = this.getPlatformIcon(account.platform);
            const verifiedBadge = account.is_verified ? '✅' : '';
            const followerCount = account.follower_count ? ` (${account.follower_count.toLocaleString()} подписчиков)` : '';
            message += `${index + 1}. ${platformIcon} @${account.username}${verifiedBadge}\n`;
            message += `   📝 ${account.display_name}${followerCount}\n`;
            message += `   🔗 ${account.profile_url}\n\n`;
        });
        await this.sendMessage(ctx, message, {
            reply_markup: Keyboards.socialAccountsList(accounts)
        });
    }
    async showSocialAccountsStats(ctx) {
        if (!ctx.from)
            return;
        const stats = await this.socialAccountService.getSocialAccountsStats();
        let message = `📊 Статистика социальных сетей\n\n`;
        message += `📱 Всего аккаунтов: ${stats.totalAccounts}\n`;
        message += `✅ Верифицированных: ${stats.verifiedAccounts}\n`;
        message += `👥 Общее количество подписчиков: ${stats.totalFollowers.toLocaleString()}\n\n`;
        if (stats.accountsByPlatform.length > 0) {
            message += `📈 По платформам:\n`;
            stats.accountsByPlatform.forEach(platform => {
                const icon = this.getPlatformIcon(platform.platform);
                message += `${icon} ${platform.platform}: ${platform.count} аккаунтов\n`;
            });
        }
        await this.sendMessage(ctx, message, {
            reply_markup: Keyboards.adminSocial()
        });
    }
    async showSocialAccounts(ctx, raffle, socialAccounts) {
        console.log(`📱 Показываем социальные аккаунты для участия в розыгрыше ${raffle.id}`);
        let text = `📱 Для участия в розыгрыше подпишитесь на социальные аккаунты:

🎁 Приз: ${raffle.prize_description}
🏆 Победителей: ${raffle.winners_count}
⏰ Завершение: ${raffle.end_date.toLocaleDateString('ru-RU')}

📱 Социальные аккаунты:\n`;
        socialAccounts.forEach((account, index) => {
            const icon = this.getPlatformIcon(account.platform);
            text += `${index + 1}. ${icon} ${account.display_name}\n`;
            text += `   @${account.username}\n`;
            text += `   ${account.profile_url}\n\n`;
        });
        text += `💡 Инструкция:\n`;
        text += `1️⃣ Нажмите кнопки "Подписаться" ниже\n`;
        text += `2️⃣ Перейдите в аккаунт и подпишитесь\n`;
        text += `3️⃣ Вернитесь в бот\n`;
        text += `4️⃣ Нажмите "🔍 Проверить подписки"\n`;
        text += `5️⃣ Получите подтверждение участия`;
        const keyboard = new InlineKeyboard();
        // Добавляем URL-кнопки для каждого социального аккаунта
        socialAccounts.forEach((account, index) => {
            const icon = this.getPlatformIcon(account.platform);
            keyboard.url(`${icon} Подписаться на ${account.display_name}`, account.profile_url);
            if ((index + 1) % 2 === 0)
                keyboard.row();
        });
        keyboard.row().text('🔍 Проверить подписки', `check_social_subscription_${raffle.id}`);
        keyboard.row().text('🔙 Назад к розыгрышам', 'active_raffles');
        await ctx.editMessageText(text, {
            reply_markup: keyboard
        });
    }
    async showCombinedRequirements(ctx, raffle, channels, socialAccounts) {
        console.log(`📱 Показываем комбинированные требования для розыгрыша ${raffle.id}`);
        let text = `📱 Для участия в розыгрыше подпишитесь на каналы и социальные аккаунты:

🎁 Приз: ${raffle.prize_description}
🏆 Победителей: ${raffle.winners_count}
⏰ Завершение: ${raffle.end_date.toLocaleDateString('ru-RU')}

📺 Каналы для подписки:\n`;
        channels.forEach((channel, index) => {
            text += `${index + 1}. ${channel.name}\n`;
            text += `   ${channel.invite_link}\n\n`;
        });
        text += `📱 Социальные аккаунты:\n`;
        socialAccounts.forEach((requirement, index) => {
            const icon = this.getPlatformIcon(requirement.social_account.platform);
            text += `${index + 1}. ${icon} ${requirement.social_account.display_name}\n`;
            text += `   @${requirement.social_account.username}\n`;
            text += `   ${requirement.social_account.profile_url}\n\n`;
        });
        text += `💡 Инструкция:\n`;
        text += `1️⃣ Подпишитесь на все каналы и социальные аккаунты\n`;
        text += `2️⃣ Вернитесь в бот\n`;
        text += `3️⃣ Нажмите "🔍 Проверить все подписки"\n`;
        text += `4️⃣ Получите подтверждение участия`;
        const keyboard = new InlineKeyboard();
        // Добавляем URL-кнопки для каналов
        channels.forEach((channel, index) => {
            keyboard.url(`📺 ${channel.name}`, channel.invite_link);
            if ((index + 1) % 2 === 0)
                keyboard.row();
        });
        // Добавляем URL-кнопки для социальных аккаунтов
        socialAccounts.forEach((requirement, index) => {
            const icon = this.getPlatformIcon(requirement.social_account.platform);
            keyboard.url(`${icon} ${requirement.social_account.display_name}`, requirement.social_account.profile_url);
            if ((index + 1) % 2 === 0)
                keyboard.row();
        });
        keyboard.row().text('🔍 Проверить все подписки', `check_combined_subscription_${raffle.id}`);
        keyboard.row().text('🔙 Назад к розыгрышам', 'active_raffles');
        await ctx.editMessageText(text, {
            reply_markup: keyboard
        });
    }
    getPlatformIcon(platform) {
        const icons = {
            'INSTAGRAM': '📸',
            'TIKTOK': '🎵',
            'TWITTER': '🐦',
            'FACEBOOK': '📘',
            'YOUTUBE': '📺',
            'TELEGRAM': '📱'
        };
        return icons[platform] || '📱';
    }
    async handleSocialPlatformSelection(ctx, platform) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        const state = this.adminStates[userId];
        if (!state || state.step !== 'add_social_platform') {
            console.log(`❓ Неожиданное состояние для выбора платформы: ${state?.step}`);
            return;
        }
        // Сохраняем выбранную платформу и переходим к следующему шагу
        state.step = 'add_social_username';
        state.tempData = { ...state.tempData, platform };
        const platformIcon = this.getPlatformIcon(platform);
        const message = `📱 Добавление аккаунта ${platformIcon} ${platform}\n\n` +
            `Введите username аккаунта (без @):\n\n` +
            `Пример: mychannel`;
        await this.sendMessage(ctx, message, {
            reply_markup: new InlineKeyboard()
                .text('❌ Отмена', 'cancel_action')
                .row()
                .text('🏠 Главное меню', 'back_to_main')
        });
    }
    async handleSocialUsernameInput(ctx, username) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        const state = this.adminStates[userId];
        if (!state || state.step !== 'add_social_username') {
            console.log(`❓ Неожиданное состояние для ввода username: ${state?.step}`);
            return;
        }
        // Сохраняем username и переходим к следующему шагу
        state.step = 'add_social_display_name';
        state.tempData = { ...state.tempData, username };
        const message = `📝 Введите отображаемое имя аккаунта:\n\n` +
            `Пример: Моя компания`;
        await this.sendMessage(ctx, message, {
            reply_markup: new InlineKeyboard()
                .text('❌ Отмена', 'cancel_action')
                .row()
                .text('🏠 Главное меню', 'back_to_main')
        });
    }
    async handleSocialDisplayNameInput(ctx, displayName) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        const state = this.adminStates[userId];
        if (!state || state.step !== 'add_social_display_name') {
            console.log(`❓ Неожиданное состояние для ввода display_name: ${state?.step}`);
            return;
        }
        // Сохраняем display_name и переходим к следующему шагу
        state.step = 'add_social_profile_url';
        state.tempData = { ...state.tempData, display_name: displayName };
        const message = `🔗 Введите ссылку на профиль:\n\n` +
            `Пример: https://instagram.com/mychannel`;
        await this.sendMessage(ctx, message, {
            reply_markup: new InlineKeyboard()
                .text('❌ Отмена', 'cancel_action')
                .row()
                .text('🏠 Главное меню', 'back_to_main')
        });
    }
    async handleSocialProfileUrlInput(ctx, profileUrl) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        const state = this.adminStates[userId];
        if (!state || state.step !== 'add_social_profile_url') {
            console.log(`❓ Неожиданное состояние для ввода profile_url: ${state?.step}`);
            return;
        }
        // Сохраняем profile_url и переходим к следующему шагу
        state.step = 'add_social_follower_count';
        state.tempData = { ...state.tempData, profile_url: profileUrl };
        const message = `👥 Введите количество подписчиков (или 0, если неизвестно):\n\n` +
            `Пример: 1000`;
        await this.sendMessage(ctx, message, {
            reply_markup: new InlineKeyboard()
                .text('❌ Отмена', 'cancel_action')
                .row()
                .text('🏠 Главное меню', 'back_to_main')
        });
    }
    async handleSocialFollowerCountInput(ctx, followerCountText) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        const state = this.adminStates[userId];
        if (!state || state.step !== 'add_social_follower_count') {
            console.log(`❓ Неожиданное состояние для ввода follower_count: ${state?.step}`);
            return;
        }
        const followerCount = parseInt(followerCountText) || 0;
        // Сохраняем follower_count и переходим к финальному шагу
        state.step = 'add_social_verified';
        state.tempData = { ...state.tempData, follower_count: followerCount };
        const message = `✅ Аккаунт верифицирован?\n\n` +
            `Выберите статус верификации:`;
        await this.sendMessage(ctx, message, {
            reply_markup: new InlineKeyboard()
                .text('✅ Да', 'social_verified_yes')
                .row()
                .text('❌ Нет', 'social_verified_no')
                .row()
                .text('❌ Отмена', 'cancel_action')
                .row()
                .text('🏠 Главное меню', 'back_to_main')
        });
    }
    async handleSocialVerifiedSelection(ctx, isVerified) {
        if (!ctx.from)
            return;
        const userId = ctx.from.id;
        const state = this.adminStates[userId];
        if (!state || state.step !== 'add_social_verified') {
            console.log(`❓ Неожиданное состояние для выбора верификации: ${state?.step}`);
            return;
        }
        try {
            // Создаем социальный аккаунт
            const socialAccount = await this.socialAccountService.createSocialAccount(state.tempData.platform, state.tempData.username, state.tempData.display_name, state.tempData.profile_url, state.tempData.follower_count, isVerified);
            // Очищаем состояние
            delete this.adminStates[userId];
            const platformIcon = this.getPlatformIcon(socialAccount.platform);
            const verifiedBadge = socialAccount.is_verified ? '✅' : '';
            const followerCount = socialAccount.follower_count ? ` (${socialAccount.follower_count.toLocaleString()} подписчиков)` : '';
            const message = `✅ Социальный аккаунт успешно добавлен!\n\n` +
                `${platformIcon} @${socialAccount.username}${verifiedBadge}\n` +
                `📝 ${socialAccount.display_name}${followerCount}\n` +
                `🔗 ${socialAccount.profile_url}`;
            await this.sendMessage(ctx, message, {
                reply_markup: new InlineKeyboard()
                    .text('➕ Добавить еще', 'social_add')
                    .row()
                    .text('📋 Список аккаунтов', 'social_list')
                    .row()
                    .text('🔙 Назад', 'admin_social')
                    .row()
                    .text('🏠 Главное меню', 'back_to_main')
            });
        }
        catch (error) {
            console.error('❌ Ошибка при создании социального аккаунта:', error);
            await this.sendMessage(ctx, '❌ Ошибка при создании аккаунта. Попробуйте еще раз.', {
                reply_markup: new InlineKeyboard()
                    .text('🔄 Попробовать снова', 'social_add')
                    .row()
                    .text('🔙 Назад', 'admin_social')
                    .row()
                    .text('🏠 Главное меню', 'back_to_main')
            });
        }
    }
}
//# sourceMappingURL=userHandlers.js.map