import cron from 'node-cron';
import { Bot } from 'grammy';
import { RaffleService } from '../services/raffleService.js';
import { UserService } from '../services/userService.js';
import { MailingService } from '../services/mailingService.js';
import { RaffleStatus, MailingStatus, MailingType } from '../types/index.js';

export class Scheduler {
  constructor(
    private bot: Bot,
    private raffleService: RaffleService,
    private userService: UserService,
    private mailingService: MailingService
  ) {}

  start() {
    // Проверяем завершившиеся розыгрыши каждую минуту
    cron.schedule('* * * * *', async () => {
      await this.checkExpiredRaffles();
    });

    // Проверяем запланированные рассылки каждую минуту
    cron.schedule('* * * * *', async () => {
      await this.checkScheduledMailings();
    });

    // Проверяем рассылки для немедленной отправки каждые 10 секунд
    cron.schedule('*/10 * * * * *', async () => {
      await this.checkSendingMailings();
    });

    console.log('📅 Планировщик задач запущен');
  }

  private async checkExpiredRaffles() {
    try {
      const expiredRaffles = await this.raffleService.getExpiredRaffles();
      
      for (const raffle of expiredRaffles) {
        await this.finishRaffle(raffle.id);
      }
    } catch (error) {
      console.error('Ошибка при проверке завершившихся розыгрышей:', error);
    }
  }

  private async finishRaffle(raffleId: number) {
    try {
      console.log(`🎁 Завершаем розыгрыш #${raffleId}`);
      
      const raffle = await this.raffleService.getRaffleById(raffleId);
      if (!raffle) return;

      // Получаем всех подходящих участников
      const eligibleParticipants = await this.raffleService.getEligibleParticipants(raffleId);
      
      if (eligibleParticipants.length === 0) {
        console.log(`❌ В розыгрыше #${raffleId} нет подходящих участников`);
        await this.raffleService.updateRaffleStatus(raffleId, RaffleStatus.FINISHED);
        return;
      }

      // Выбираем победителей случайным образом
      const winnersCount = Math.min(raffle.winners_count, eligibleParticipants.length);
      const shuffled = [...eligibleParticipants].sort(() => 0.5 - Math.random());
      const winners = shuffled.slice(0, winnersCount);

      // Сохраняем победителей в базу
      for (const winner of winners) {
        await this.raffleService.addWinner(raffleId, winner.user_id);
      }

      // Обновляем статус розыгрыша
      await this.raffleService.updateRaffleStatus(raffleId, RaffleStatus.FINISHED);

      // Отправляем результаты (если есть канал для результатов)
      await this.sendRaffleResults(raffle, winners);

      // Уведомляем победителей лично
      await this.notifyWinners(raffle, winners);

      console.log(`✅ Розыгрыш #${raffleId} завершен, выбрано ${winners.length} победителей`);
    } catch (error) {
      console.error(`Ошибка при завершении розыгрыша #${raffleId}:`, error);
    }
  }

  private async sendRaffleResults(raffle: any, winners: any[]) {
    try {
      const resultsChannelId = process.env.RESULTS_CHANNEL_ID;
      if (!resultsChannelId) return;

      let resultText = `🎉 *Результаты розыгрыша*\n\n`;
      resultText += `🎁 Приз: ${raffle.prize_description}\n\n`;

      if (winners.length === 0) {
        resultText += `❌ К сожалению, не было найдено участников, выполнивших все условия.`;
      } else {
        resultText += `🏆 Победители:\n\n`;
        
        for (let i = 0; i < winners.length; i++) {
          const winner = winners[i];
          const user = await this.userService.getUserByTelegramId(winner.user_id);
          if (user) {
            const userMention = user.username ? `@${user.username}` : user.first_name;
            resultText += `${i + 1}. ${userMention}\n`;
          }
        }
        
        resultText += `\n🎊 Поздравляем победителей!`;
      }

      await this.bot.api.sendMessage(resultsChannelId, resultText, {
        parse_mode: 'Markdown'
      });
    } catch (error) {
      console.error('Ошибка при отправке результатов розыгрыша:', error);
    }
  }

  private async notifyWinners(raffle: any, winners: any[]) {
    for (const winner of winners) {
      try {
        const user = await this.userService.getUserByTelegramId(winner.user_id);
        if (!user) continue;

        const message = `🎉 *Поздравляем!*

Вы стали победителем в розыгрыше!

🎁 *Приз:* ${raffle.prize_description}

Администраторы свяжутся с вами в ближайшее время для получения приза.

Спасибо за участие! 🎊`;

        await this.bot.api.sendMessage(user.telegram_id, message, {
          parse_mode: 'Markdown'
        });
      } catch (error) {
        console.error(`Ошибка при уведомлении победителя ${winner.user_id}:`, error);
      }
    }
  }

  private async checkScheduledMailings() {
    try {
      const scheduledMailings = await this.mailingService.getScheduledMailings();
      
      for (const mailing of scheduledMailings) {
        await this.executeMailing(mailing.id);
      }
    } catch (error) {
      console.error('Ошибка при проверке запланированных рассылок:', error);
    }
  }

  private async checkSendingMailings() {
    try {
      const sendingMailings = await this.mailingService.getSendingMailings();
      
      for (const mailing of sendingMailings) {
        await this.executeMailing(mailing.id);
      }
    } catch (error) {
      console.error('Ошибка при проверке рассылок для отправки:', error);
    }
  }

  private async executeMailing(mailingId: number) {
    try {
      console.log(`📢 Выполняем рассылку #${mailingId}`);
      
      // Обновляем статус на "отправляется"
      await this.mailingService.updateMailingStatus(mailingId, MailingStatus.SENDING);
      
      // Получаем информацию о рассылке
      const mailings = await this.mailingService.getAllMailings();
      const mailing = mailings.find(m => m.id === mailingId);
      if (!mailing) {
        console.error(`Рассылка #${mailingId} не найдена`);
        return;
      }

      let users: any[] = [];
      
      // Определяем получателей в зависимости от типа рассылки
      if (mailing.mailing_type === MailingType.ALL_USERS) {
        // Всем пользователям
        users = await this.userService.getAllUsers();
        console.log(`📢 Рассылка всем пользователям (${users.length} получателей)`);
      } else if (mailing.mailing_type === MailingType.RAFFLE_PARTICIPANTS && mailing.target_raffle_id) {
        // Участникам конкретного розыгрыша
        const participants = await this.raffleService.getEligibleParticipants(mailing.target_raffle_id);
        users = await Promise.all(
          participants.map(async (participant) => {
            return await this.userService.getUserByTelegramId(participant.user_id);
          })
        );
        users = users.filter(user => user !== null);
        console.log(`📢 Рассылка участникам розыгрыша #${mailing.target_raffle_id} (${users.length} получателей)`);
      } else {
        console.error(`Неизвестный тип рассылки: ${mailing.mailing_type}`);
        return;
      }

      let sentCount = 0;
      let failedCount = 0;

              // Отправляем сообщения
        for (const user of users) {
          try {
            if (mailing.photo_file_id) {
              // Отправляем фото с текстом
              await this.bot.api.sendPhoto(user.telegram_id, mailing.photo_file_id, {
                caption: mailing.message_text,
                parse_mode: 'Markdown'
              });
            } else if (mailing.video_file_id) {
              // Отправляем видео с текстом
              await this.bot.api.sendVideo(user.telegram_id, mailing.video_file_id, {
                caption: mailing.message_text,
                parse_mode: 'Markdown'
              });
            } else {
              // Отправляем только текст
              await this.bot.api.sendMessage(user.telegram_id, mailing.message_text, {
                parse_mode: 'Markdown'
              });
            }
            sentCount++;
            
            // Небольшая задержка между сообщениями
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (error) {
            console.error(`Ошибка отправки сообщения пользователю ${user.telegram_id}:`, error);
            failedCount++;
          }
        }

      // Обновляем статистику
      await this.mailingService.updateMailingStats(mailingId, sentCount, failedCount);
      
      // Обновляем статус на "завершено"
      await this.mailingService.updateMailingStatus(mailingId, MailingStatus.COMPLETED);
      
      console.log(`✅ Рассылка #${mailingId} завершена. Отправлено: ${sentCount}, Ошибок: ${failedCount}`);
    } catch (error) {
      console.error(`Ошибка при выполнении рассылки #${mailingId}:`, error);
    }
  }
}