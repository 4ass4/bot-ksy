import Database from './dist/database/database.js';
import { RaffleService } from './dist/services/raffleService.js';
import { UserService } from './dist/services/userService.js';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_PATH = process.env.DATABASE_PATH || './database/bot.db';

async function testNormalRaffle() {
  const db = new Database(DATABASE_PATH);
  const raffleService = new RaffleService(db);
  const userService = new UserService(db);

  try {
    console.log('🧪 Тестирование обычного розыгрыша (без рефералов)...\n');

    // 1. Создаем тестовых пользователей
    console.log('👥 Создаем тестовых пользователей...');
    const testUsers = [];
    for (let i = 1; i <= 5; i++) {
      const user = await userService.createUser(
        2000000 + i,
        `Обычный${i}`,
        'Пользователь',
        `normaluser${i}`
      );
      testUsers.push(user);
      console.log(`✅ Создан пользователь: ${user.first_name} (ID: ${user.id})`);
    }

    // 2. Создаем обычный розыгрыш (без рефералов)
    console.log('\n🎁 Создаем обычный розыгрыш...');
    const raffle = await raffleService.createRaffle(
      'Обычный приз без рефералов', // prizeDescription
      2, // winnersCount
      new Date(Date.now() + 60000), // endDate
      [], // channelIds
      undefined, // photoFileId
      undefined, // videoFileId
      false, // referralRequirement (БЕЗ рефералов)
      0, // minReferrals
      0, // maxReferrals
      undefined, // referralBonus
      1.0 // bonusMultiplier
    );
    console.log(`✅ Создан розыгрыш: ${raffle.prize_description} (ID: ${raffle.id})`);

    // 3. Добавляем участников (все с 0 рефералов)
    console.log('\n📝 Добавляем участников...');
    for (let i = 0; i < testUsers.length; i++) {
      await raffleService.addParticipant(testUsers[i].id, raffle.id, true, 0);
      console.log(`✅ Добавлен участник: ${testUsers[i].first_name} (0 рефералов)`);
    }

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
    const winners = raffleService.selectWinnersWithWeights(participants, 2);
    
    console.log('\n🏆 Победители:');
    winners.forEach((winner, index) => {
      const user = testUsers.find(u => u.id === winner.user_id);
      const multiplier = raffleService.calculateBonusMultiplier(winner.referral_count);
      console.log(`${index + 1}. ${user.first_name} (${winner.referral_count} рефералов, множитель ${multiplier}x)`);
    });

    console.log('\n✅ Тестирование обычного розыгрыша завершено!');

  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error);
  } finally {
    await db.close();
  }
}

// Запускаем тест
testNormalRaffle().catch(console.error); 