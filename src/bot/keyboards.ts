import { InlineKeyboard } from 'grammy';

export class Keyboards {
  static adminMain() {
    return new InlineKeyboard()
      .text('📺 Управление каналами', 'admin_channels')
      .row()
      .text('🎁 Управление розыгрышами', 'admin_raffles')
      .row()
      .text('📱 Социальные сети', 'admin_social')
      .row()
      .text('📢 Рассылки', 'admin_mailings')
      .row()
      .text('📊 Статистика', 'admin_stats')
      .row()
      .text('⚙️ Настройки', 'admin_settings')
      .row()
      .text('🏠 Главное меню', 'back_to_main');
  }

  static adminChannels() {
    return new InlineKeyboard()
      .text('➕ Добавить канал', 'channels_add')
      .row()
      .text('📋 Список каналов', 'channels_list')
      .row()
      .text('🗑️ Удалить канал', 'channels_delete')
      .row()
      .text('📢 Управление официальным каналом', 'admin_official_channel')
      .row()
      .text('🔙 Назад в админ-панель', 'back_admin')
      .row()
      .text('🏠 Главное меню', 'back_to_main');
  }

  static adminRaffles() {
    return new InlineKeyboard()
      .text('🎁 Создать розыгрыш', 'raffles_create')
      .row()
      .text('📋 Активные розыгрыши', 'raffles_active')
      .row()
      .text('✅ Завершенные розыгрыши', 'raffles_finished')
      .row()
      .text('🗑️ Удалить розыгрыш', 'raffles_delete')
      .row()
      .text('📢 Опубликовать розыгрыш', 'publish_raffle')
      .row()
      .text('🔙 Назад в админ-панель', 'back_admin')
      .row()
      .text('🏠 Главное меню', 'back_to_main');
  }

  static adminMailings() {
    return new InlineKeyboard()
      .text('📝 Создать рассылку', 'mailings_create')
      .row()
      .text('📋 Список рассылок', 'mailings_list')
      .row()
      .text('🗑️ Удалить рассылку', 'mailings_delete')
      .row()
      .text('🔙 Назад в админ-панель', 'back_admin')
      .row()
      .text('🏠 Главное меню', 'back_to_main');
  }

  static mailingTypeSelection() {
    return new InlineKeyboard()
      .text('👥 Всем пользователям', 'mailing_type_all_users')
      .row()
      .text('🎁 Участникам розыгрыша', 'mailing_type_raffle_participants')
      .row()
      .text('❌ Отмена', 'cancel_action')
      .row()
      .text('🏠 Главное меню', 'back_to_main');
  }

  static mailingScheduleSelection() {
    return new InlineKeyboard()
      .text('🚀 Отправить сейчас', 'mailing_schedule_now')
      .row()
      .text('📅 Запланировать время', 'mailing_schedule_custom')
      .row()
      .text('❌ Отмена', 'cancel_action')
      .row()
      .text('🏠 Главное меню', 'back_to_main');
  }

  static mailingMediaSelection() {
    return new InlineKeyboard()
      .text('🖼️ Добавить фото', 'mailing_add_photo')
      .row()
      .text('📹 Добавить видео', 'mailing_add_video')
      .row()
      .text('⏭️ Пропустить', 'mailing_skip_media')
      .row()
      .text('❌ Отмена', 'cancel_action')
      .row()
      .text('🏠 Главное меню', 'back_to_main');
  }

  static raffleMediaSelection() {
    return new InlineKeyboard()
      .text('🖼️ Добавить фото приза', 'raffle_add_photo')
      .row()
      .row()
      .text('📹 Добавить видео приза', 'raffle_add_video')
      .row()
      .text('⏭️ Пропустить', 'raffle_skip_media')
      .row()
      .text('❌ Отмена', 'cancel_action')
      .row()
      .text('🏠 Главное меню', 'back_to_main');
  }

  static mailingsToDelete(mailings: any[]) {
    const keyboard = new InlineKeyboard();
    
    mailings.forEach((mailing, index) => {
      const statusEmoji = mailing.status === 'COMPLETED' ? '✅' : 
                         mailing.status === 'SENDING' ? '📤' : 
                         mailing.status === 'SCHEDULED' ? '⏰' : '❌';
      
      keyboard.text(`${statusEmoji} ${mailing.message_text.substring(0, 30)}...`, `delete_mailing_${mailing.id}`);
      if ((index + 1) % 2 === 0) keyboard.row();
    });
    
    keyboard.row().text('🔙 Назад', 'back_admin');
    keyboard.row().text('🏠 Главное меню', 'back_to_main');
    return keyboard;
  }

  static participateInRaffle(raffleId: number) {
    return new InlineKeyboard()
      .text('🎉 Участвовать в розыгрыше', `participate_${raffleId}`);
  }

  static checkSubscriptions(raffleId: number) {
    return new InlineKeyboard()
      .text('🔄 Проверить подписки заново', `check_subs_${raffleId}`)
      .row()
      .text('🔙 Назад в главное меню', 'back_to_main');
  }

  static confirmAction(actionData: string) {
    return new InlineKeyboard()
      .text('✅ Подтвердить', `confirm_${actionData}`)
      .text('❌ Отмена', 'cancel_action');
  }

  static backToAdmin() {
    return new InlineKeyboard()
      .text('🔙 Назад в админ-панель', 'back_admin');
  }

  static backToMain() {
    return new InlineKeyboard()
      .text('🔙 Назад в главное меню', 'back_to_main');
  }

  static cancelAction() {
    return new InlineKeyboard()
      .text('❌ Отмена', 'cancel_action');
  }

  static mainUser(activeCount?: number, participationCount?: number) {
    const keyboard = new InlineKeyboard();
    
    const activeText = activeCount && activeCount > 0 
      ? `🎁 Активные розыгрыши (${activeCount})` 
      : '🎁 Активные розыгрыши';
    
    const participationText = participationCount && participationCount > 0 
      ? `📋 Мои участия (${participationCount})` 
      : '📋 Мои участия';
    
    keyboard.text(activeText, 'active_raffles')
      .row()
      .text(participationText, 'my_raffles')
      .row()
      .text('👥 Пригласить друзей', 'referral_system')
      .row()
      .text('❓ Помощь', 'help_command')
      .row()
      .text('📢 Наш официальный канал', 'official_channel')
      .row()
      .text('🔧 Панель администратора', 'admin_panel');
    
    return keyboard;
  }

  static myRaffles() {
    return new InlineKeyboard()
      .text('🎁 Мои розыгрыши', 'my_raffles');
  }

  static rafflesToPublish(raffleIndexes: number[]) {
    const keyboard = new InlineKeyboard();
    
    raffleIndexes.forEach((index, i) => {
      keyboard.text(`Розыгрыш ${index + 1}`, `publish_raffle_${index}`);
      if ((i + 1) % 2 === 0) keyboard.row();
    });
    
    keyboard.row().text('🔙 Назад', 'back_admin');
    keyboard.row().text('🏠 Главное меню', 'back_to_main');
    return keyboard;
  }

  static channelsToDelete(channels: any[]) {
    const keyboard = new InlineKeyboard();
    
    channels.forEach((channel, index) => {
      keyboard.text(`🗑️ ${channel.name}`, `delete_channel_${channel.id}`);
      if ((index + 1) % 2 === 0) keyboard.row();
    });
    
    keyboard.row().text('🔙 Назад', 'back_admin');
    keyboard.row().text('🏠 Главное меню', 'back_to_main');
    return keyboard;
  }

  static rafflesToDelete(raffles: any[]) {
    const keyboard = new InlineKeyboard();
    
    raffles.forEach((raffle, index) => {
      const status = raffle.status === 'ACTIVE' ? '🟢' : '🔴';
      keyboard.text(`${status} ${raffle.prize_description}`, `delete_raffle_${raffle.id}`);
      if ((index + 1) % 2 === 0) keyboard.row();
    });
    
    keyboard.row().text('🔙 Назад', 'back_admin');
    keyboard.row().text('🏠 Главное меню', 'back_to_main');
    return keyboard;
  }

  static raffleTypeSelection() {
    return new InlineKeyboard()
      .text('🟢 Активные розыгрыши', 'delete_raffles_active')
      .row()
      .text('🔴 Завершенные розыгрыши', 'delete_raffles_finished')
      .row()
      .text('🔙 Назад', 'back_admin')
      .row()
      .text('🏠 Главное меню', 'back_to_main');
  }

  static raffleCreationType() {
    return new InlineKeyboard()
      .text('🎯 Обычный розыгрыш', 'raffle_type_normal')
      .row()
      .text('👥 Розыгрыш с рефералами', 'raffle_type_referral')
      .row()
      .text('🔙 Назад', 'back_admin')
      .row()
      .text('🏠 Главное меню', 'back_to_main');
  }

  static referralRequirementSelection() {
    return new InlineKeyboard()
      .text('👥 Подписка + рефералы', 'referral_requirement_both')
      .row()
      .text('📺 Только подписка', 'referral_requirement_subscription')
      .row()
      .text('👥 Только рефералы', 'referral_requirement_referrals')
      .row()
      .text('🔙 Назад', 'raffles_create')
      .row()
      .text('🏠 Главное меню', 'back_to_main');
  }

  static adminOfficialChannel() {
    return new InlineKeyboard()
      .text('➕ Добавить официальный канал', 'official_channel_add')
      .row()
      .text('📋 Информация о канале', 'official_channel_info')
      .row()
      .text('✏️ Редактировать описание', 'official_channel_edit_description')
      .row()
      .text('🗑️ Удалить канал', 'official_channel_delete')
      .row()
      .text('🔙 Назад в админ-панель', 'back_admin')
      .row()
      .text('🏠 Главное меню', 'back_to_main');
  }

  static raffleCreatedActions(raffleId: number) {
    return new InlineKeyboard()
      .text('✏️ Редактировать розыгрыш', `edit_raffle_${raffleId}`)
      .row()
      .text('📢 Опубликовать розыгрыш', `publish_raffle_${raffleId}`)
      .row()
      .text('🔙 Назад в админ-панель', 'back_admin')
      .row()
      .text('🏠 Главное меню', 'back_to_main');
  }

  static editRaffleFields(hasParticipants: boolean) {
    const keyboard = new InlineKeyboard()
      .text('✏️ Изменить название', 'edit_raffle_title')
      .row()
      .text('🎁 Изменить приз', 'edit_raffle_prize')
      .row()
      .text('👥 Изменить количество победителей', 'edit_raffle_winners')
      .row()
      .text('⏰ Изменить длительность', 'edit_raffle_duration')
      .row()
      .text('📺 Управление каналами', 'edit_raffle_channels')
      .row()
      .text('🔙 Назад', 'back_admin')
      .row()
      .text('🏠 Главное меню', 'back_to_main');

    // Если есть участники, ограничиваем некоторые изменения
    if (hasParticipants) {
      // Можно добавить предупреждения или отключить некоторые кнопки
    }

    return keyboard;
  }

  static botSettings() {
    return new InlineKeyboard()
      .text('✏️ Редактировать приветствие', 'settings_welcome_message')
      .row()
      .text('🖼️ Добавить обложку бота', 'settings_cover_photo')
      .row()
      .text('🗑️ Удалить обложку', 'settings_remove_cover')
      .row()
      .text('📋 Текущие настройки', 'settings_view')
      .row()
      .text('🔙 Назад в админ-панель', 'back_admin')
      .row()
      .text('🏠 Главное меню', 'back_to_main');
  }

  // Клавиатуры для реферальной системы
  static referralMain() {
    return new InlineKeyboard()
      .text('🔗 Моя реферальная ссылка', 'referral_link')
      .row()
      .text('📊 Моя статистика', 'referral_stats')
      .row()
      .text('👥 Мои рефералы', 'referral_list')
      .row()
      .text('🏆 Топ рефералов', 'referral_top')
      .row()
      .text('🔙 Назад', 'back_to_main');
  }

  static referralLink(code: string, link: string) {
    return new InlineKeyboard()
      .text('📋 Скопировать ссылку', 'referral_copy_link')
      .row()
      .text('📤 Поделиться', 'referral_share')
      .row()
      .text('🔙 Назад', 'referral_system');
  }

  static referralStats(stats: any) {
    return new InlineKeyboard()
      .text('🔄 Обновить', 'referral_stats')
      .row()
      .text('🔙 Назад', 'referral_system');
  }

  static referralList() {
    return new InlineKeyboard()
      .text('🔄 Обновить', 'referral_list')
      .row()
      .text('🔙 Назад', 'referral_system');
  }

  static referralTop() {
    return new InlineKeyboard()
      .text('🔄 Обновить', 'referral_top')
      .row()
      .text('🔙 Назад', 'referral_system');
  }

  // Реферальная система с контекстом розыгрыша
  static referralMainWithContext(raffleId: number) {
    return new InlineKeyboard()
      .text('🔗 Моя реферальная ссылка', `referral_link_${raffleId}`)
      .row()
      .text('📊 Моя статистика', `referral_stats_${raffleId}`)
      .row()
      .text('👥 Мои рефералы', `referral_list_${raffleId}`)
      .row()
      .text('🏆 Топ рефералов', `referral_top_${raffleId}`)
      .row()
      .text('🔙 Назад к розыгрышу', `check_referrals_${raffleId}`);
  }

  // Клавиатуры для управления социальными сетями
  static adminSocial() {
    return new InlineKeyboard()
      .text('➕ Добавить аккаунт', 'social_add')
      .row()
      .text('📋 Список аккаунтов', 'social_list')
      .row()
      .text('✏️ Редактировать аккаунт', 'social_edit')
      .row()
      .text('🗑️ Удалить аккаунт', 'social_delete')
      .row()
      .text('📊 Статистика соцсетей', 'social_stats')
      .row()
      .text('🔙 Назад в админ-панель', 'back_admin')
      .row()
      .text('🏠 Главное меню', 'back_to_main');
  }

  static socialPlatformSelection() {
    return new InlineKeyboard()
      .text('📸 Instagram', 'social_platform_instagram')
      .row()
      .text('🎵 TikTok', 'social_platform_tiktok')
      .row()
      .text('🐦 Twitter/X', 'social_platform_twitter')
      .row()
      .text('📘 Facebook', 'social_platform_facebook')
      .row()
      .text('📺 YouTube', 'social_platform_youtube')
      .row()
      .text('❌ Отмена', 'cancel_action')
      .row()
      .text('🏠 Главное меню', 'back_to_main');
  }

  static socialAccountsList(accounts: any[]) {
    const keyboard = new InlineKeyboard();
    
    accounts.forEach((account, index) => {
      const platformIcon = this.getPlatformIcon(account.platform);
      keyboard.text(`${platformIcon} @${account.username}`, `social_account_${account.id}`);
      if ((index + 1) % 2 === 0) keyboard.row();
    });
    
    keyboard.row()
      .text('🔙 Назад', 'admin_social')
      .row()
      .text('🏠 Главное меню', 'back_to_main');
    
    return keyboard;
  }

  static socialAccountActions(accountId: number) {
    return new InlineKeyboard()
      .text('✏️ Редактировать', `social_edit_${accountId}`)
      .row()
      .text('🗑️ Удалить', `social_delete_${accountId}`)
      .row()
      .text('🔙 Назад', 'social_list')
      .row()
      .text('🏠 Главное меню', 'back_to_main');
  }

  private static getPlatformIcon(platform: string): string {
    const icons: { [key: string]: string } = {
      'INSTAGRAM': '📸',
      'TIKTOK': '🎵',
      'TWITTER': '🐦',
      'FACEBOOK': '📘',
      'YOUTUBE': '📺',
      'TELEGRAM': '📱'
    };
    return icons[platform] || '📱';
  }
}