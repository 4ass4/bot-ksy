import Database from './dist/database/database.js';
import { RaffleService } from './dist/services/raffleService.js';
import { ReferralService } from './dist/services/referralService.js';
import { UserService } from './dist/services/userService.js';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_PATH = process.env.DATABASE_PATH || './database/bot.db';

async function testWinnerSelection() {
  const db = new Database(DATABASE_PATH);
  const raffleService = new RaffleService(db);
  const referralService = new ReferralService(db);
  const userService = new UserService(db);

  try {
    console.log('🧪 Тестирование системы выбора победителей...\n');

         // 1. Создаем тестовых пользователей
     console.log('👥 Создаем тестовых пользователей...');
     const testUsers = [];
     for (let i = 1; i <= 10; i++) {
       const user = await userService.createUser(
         1000000 + i,
         `Тест${i}`,
         'Пользователь',
         `testuser${i}`
       );
       testUsers.push(user);
       console.log(`✅ Создан пользователь: ${user.first_name} (ID: ${user.id})`);
     }

         // 2. Создаем тестовый розыгрыш
     console.log('\n🎁 Создаем тестовый розыгрыш...');
     const raffle = await raffleService.createRaffle(
       'Тестовый приз для проверки системы', // prizeDescription
       3, // winnersCount
       new Date(Date.now() + 60000), // endDate (завершится через 1 минуту)
       [], // channelIds (пустой массив)
       undefined, // photoFileId
       undefined, // videoFileId
       true, // referralRequirement
       1, // minReferrals
       5, // maxReferrals
       'Увеличенные шансы на победу', // referralBonus
       2.0 // bonusMultiplier
     );
    console.log(`✅ Создан розыгрыш: ${raffle.prize_description} (ID: ${raffle.id})`);

    // 3. Добавляем участников с разным количеством рефералов
    console.log('\n📝 Добавляем участников с разным количеством рефералов...');
    
    // Участники с 0 рефералов (базовые шансы)
    await raffleService.addParticipant(testUsers[0].id, raffle.id, true, 0);
    await raffleService.addParticipant(testUsers[1].id, raffle.id, true, 0);
    console.log(`✅ Добавлены участники с 0 рефералов: ${testUsers[0].first_name}, ${testUsers[1].first_name}`);

    // Участники с 1 рефералом (+25% шансов)
    await raffleService.addParticipant(testUsers[2].id, raffle.id, true, 1);
    await raffleService.addParticipant(testUsers[3].id, raffle.id, true, 1);
    console.log(`✅ Добавлены участники с 1 рефералом: ${testUsers[2].first_name}, ${testUsers[3].first_name}`);

    // Участники с 2 рефералами (+50% шансов)
    await raffleService.addParticipant(testUsers[4].id, raffle.id, true, 2);
    await raffleService.addParticipant(testUsers[5].id, raffle.id, true, 2);
    console.log(`✅ Добавлены участники с 2 рефералами: ${testUsers[4].first_name}, ${testUsers[5].first_name}`);

    // Участники с 3 рефералами (+75% шансов)
    await raffleService.addParticipant(testUsers[6].id, raffle.id, true, 3);
    console.log(`✅ Добавлен участник с 3 рефералами: ${testUsers[6].first_name}`);

    // Участники с 4 рефералами (+100% шансов)
    await raffleService.addParticipant(testUsers[7].id, raffle.id, true, 4);
    await raffleService.addParticipant(testUsers[8].id, raffle.id, true, 4);
    console.log(`✅ Добавлены участники с 4 рефералами: ${testUsers[7].first_name}, ${testUsers[8].first_name}`);

    // Участник с 5 рефералами (+100% шансов)
    await raffleService.addParticipant(testUsers[9].id, raffle.id, true, 5);
    console.log(`✅ Добавлен участник с 5 рефералами: ${testUsers[9].first_name}`);

    // 4. Получаем всех участников
    console.log('\n📊 Получаем всех участников...');
    const participants = await raffleService.getEligibleParticipants(raffle.id);
    console.log(`📈 Всего участников: ${participants.length}`);

    // 5. Показываем статистику участников
    console.log('\n📋 Статистика участников:');
    participants.forEach((participant, index) => {
      const user = testUsers.find(u => u.id === participant.user_id);
      const multiplier = raffleService.calculateBonusMultiplier(participant.referral_count);
      console.log(`${index + 1}. ${user.first_name}: ${participant.referral_count} рефералов → множитель ${multiplier}x`);
    });

    // 6. Тестируем выбор победителей
    console.log('\n🎯 Тестируем выбор победителей...');
    const winners = raffleService.selectWinnersWithWeights(participants, 3);
    
    console.log('\n🏆 Победители:');
    winners.forEach((winner, index) => {
      const user = testUsers.find(u => u.id === winner.user_id);
      const multiplier = raffleService.calculateBonusMultiplier(winner.referral_count);
      console.log(`${index + 1}. ${user.first_name} (${winner.referral_count} рефералов, множитель ${multiplier}x)`);
    });

    // 7. Статистика по рефералам
    console.log('\n📊 Статистика рефералов:');
    const referralStats = await referralService.getRaffleReferralStats(raffle.id);
    console.log(`Всего участников: ${referralStats.totalParticipants}`);
    console.log(`Участников с рефералами: ${referralStats.participantsWithReferrals}`);
    console.log(`Общее количество рефералов: ${referralStats.totalReferrals}`);
    console.log(`Среднее количество рефералов: ${referralStats.averageReferrals.toFixed(2)}`);
    console.log(`Максимальное количество рефералов: ${referralStats.maxReferrals}`);
    
    console.log('\n📈 Распределение по количеству рефералов:');
    Object.entries(referralStats.referralDistribution).forEach(([count, participants]) => {
      console.log(`  ${count} рефералов: ${participants} участников`);
    });

    console.log('\n✅ Тестирование завершено!');

  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error);
  } finally {
    await db.close();
  }
}

// Запускаем тест
testWinnerSelection().catch(console.error); 