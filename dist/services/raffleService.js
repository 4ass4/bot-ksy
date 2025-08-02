import { RaffleStatus } from '../types/index.js';
export class RaffleService {
    db;
    constructor(db) {
        this.db = db;
    }
    async createRaffle(prizeDescription, winnersCount, endDate, channelIds, photoFileId, videoFileId, referralRequirement = false, minReferrals = 0, maxReferrals = 0, referralBonus, bonusMultiplier = 1.0) {
        const result = await this.db.run('INSERT INTO raffles (prize_description, photo_file_id, video_file_id, winners_count, end_date, status, referral_requirement, min_referrals, max_referrals, referral_bonus, bonus_multiplier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [prizeDescription, photoFileId || null, videoFileId || null, winnersCount, endDate.toISOString(), RaffleStatus.ACTIVE, referralRequirement, minReferrals, maxReferrals, referralBonus || null, bonusMultiplier]);
        const raffleId = result.lastID;
        // Связываем розыгрыш с каналами
        for (const channelId of channelIds) {
            await this.db.run('INSERT INTO raffle_channels (raffle_id, channel_id) VALUES (?, ?)', [raffleId, channelId]);
        }
        return {
            id: raffleId,
            prize_description: prizeDescription,
            photo_file_id: photoFileId,
            video_file_id: videoFileId,
            winners_count: winnersCount,
            end_date: endDate,
            status: RaffleStatus.ACTIVE,
            referral_requirement: referralRequirement,
            min_referrals: minReferrals,
            max_referrals: maxReferrals,
            referral_bonus: referralBonus,
            bonus_multiplier: bonusMultiplier,
            created_at: new Date()
        };
    }
    async getRaffleById(id) {
        const raffle = await this.db.get('SELECT * FROM raffles WHERE id = ?', [id]);
        if (!raffle)
            return undefined;
        return {
            ...raffle,
            end_date: new Date(raffle.end_date),
            created_at: new Date(raffle.created_at)
        };
    }
    async getAllRaffles() {
        const raffles = await this.db.all('SELECT * FROM raffles ORDER BY created_at DESC');
        return raffles.map(raffle => ({
            ...raffle,
            end_date: new Date(raffle.end_date),
            created_at: new Date(raffle.created_at)
        }));
    }
    async getRafflesByStatus(status) {
        const raffles = await this.db.all('SELECT * FROM raffles WHERE status = ? ORDER BY created_at DESC', [status]);
        return raffles.map(raffle => ({
            ...raffle,
            end_date: new Date(raffle.end_date),
            created_at: new Date(raffle.created_at)
        }));
    }
    async getActiveRaffles() {
        return this.getRafflesByStatus(RaffleStatus.ACTIVE);
    }
    async updateRaffleStatus(id, status) {
        await this.db.run('UPDATE raffles SET status = ? WHERE id = ?', [status, id]);
    }
    async addParticipant(userId, raffleId, isEligible, referralCount = 0) {
        console.log(`📝 Добавляем участника: userId=${userId}, raffleId=${raffleId}, isEligible=${isEligible}, referralCount=${referralCount}`);
        await this.db.run('INSERT OR REPLACE INTO participants (user_id, raffle_id, is_eligible, referral_count) VALUES (?, ?, ?, ?)', [userId, raffleId, isEligible, referralCount]);
        console.log(`✅ Участник добавлен в базу данных`);
    }
    async getParticipantsByRaffleId(raffleId) {
        const participants = await this.db.all('SELECT * FROM participants WHERE raffle_id = ?', [raffleId]);
        return participants.map(p => ({
            ...p,
            participated_at: new Date(p.participated_at)
        }));
    }
    async getEligibleParticipants(raffleId) {
        const participants = await this.db.all('SELECT * FROM participants WHERE raffle_id = ? AND is_eligible = TRUE', [raffleId]);
        return participants.map(p => ({
            ...p,
            referral_count: p.referral_count || 0,
            participated_at: new Date(p.participated_at)
        }));
    }
    async addWinner(raffleId, userId, prizeWon) {
        await this.db.run('INSERT INTO winners (raffle_id, user_id, prize_won) VALUES (?, ?, ?)', [raffleId, userId, prizeWon]);
    }
    async getWinnersByRaffleId(raffleId) {
        const winners = await this.db.all('SELECT * FROM winners WHERE raffle_id = ?', [raffleId]);
        return winners.map(w => ({
            ...w,
            won_at: new Date(w.won_at)
        }));
    }
    async getExpiredRaffles() {
        const now = new Date().toISOString();
        const raffles = await this.db.all('SELECT * FROM raffles WHERE status = ? AND end_date <= ?', [RaffleStatus.ACTIVE, now]);
        return raffles.map(raffle => ({
            ...raffle,
            end_date: new Date(raffle.end_date),
            created_at: new Date(raffle.created_at)
        }));
    }
    async getUserParticipatedRaffles(userId) {
        console.log(`🔍 Ищем участия для пользователя userId=${userId}`);
        const raffles = await this.db.all(`SELECT r.* FROM raffles r 
       JOIN participants p ON r.id = p.raffle_id 
       WHERE p.user_id = ? AND p.is_eligible = 1
       ORDER BY r.created_at DESC`, [userId]);
        console.log(`📊 Найдено ${raffles.length} розыгрышей для пользователя ${userId}`);
        return raffles.map(raffle => ({
            ...raffle,
            end_date: new Date(raffle.end_date),
            created_at: new Date(raffle.created_at)
        }));
    }
    async isUserParticipating(userId, raffleId) {
        const participant = await this.db.get('SELECT * FROM participants WHERE user_id = ? AND raffle_id = ? AND is_eligible = 1', [userId, raffleId]);
        return !!participant;
    }
    async getRaffleWithChannels(raffleId) {
        const raffle = await this.getRaffleById(raffleId);
        if (!raffle)
            return undefined;
        const channels = await this.db.all(`SELECT c.* FROM channels c 
       JOIN raffle_channels rc ON c.id = rc.channel_id 
       WHERE rc.raffle_id = ?`, [raffleId]);
        return { raffle, channels };
    }
    async getActiveRafflesWithChannels() {
        const raffles = await this.getRafflesByStatus(RaffleStatus.ACTIVE);
        const result = [];
        for (const raffle of raffles) {
            const channels = await this.db.all(`SELECT c.* FROM channels c 
         JOIN raffle_channels rc ON c.id = rc.channel_id 
         WHERE rc.raffle_id = ?`, [raffle.id]);
            result.push({ raffle, channels });
        }
        return result;
    }
    async addChannelToRaffle(raffleId, channelId) {
        await this.db.run('INSERT OR IGNORE INTO raffle_channels (raffle_id, channel_id) VALUES (?, ?)', [raffleId, channelId]);
    }
    async removeChannelFromRaffle(raffleId, channelId) {
        await this.db.run('DELETE FROM raffle_channels WHERE raffle_id = ? AND channel_id = ?', [raffleId, channelId]);
    }
    async deleteRaffle(id) {
        // Сначала удаляем связанные записи
        await this.db.run('DELETE FROM raffle_channels WHERE raffle_id = ?', [id]);
        await this.db.run('DELETE FROM participants WHERE raffle_id = ?', [id]);
        await this.db.run('DELETE FROM winners WHERE raffle_id = ?', [id]);
        // Затем удаляем сам розыгрыш
        await this.db.run('DELETE FROM raffles WHERE id = ?', [id]);
    }
    // Методы для работы с реферальными требованиями
    async checkUserReferralRequirements(userId, raffleId) {
        const raffle = await this.getRaffleById(raffleId);
        if (!raffle || !raffle.referral_requirement) {
            return {
                hasEnoughReferrals: true,
                currentReferrals: 0,
                requiredReferrals: 0,
                maxReferrals: 0
            };
        }
        // Получаем количество рефералов пользователя
        const userReferrals = await this.db.get('SELECT COUNT(*) as count FROM referrals WHERE referrer_id = ? AND is_active = TRUE', [userId]);
        const currentReferrals = userReferrals?.count || 0;
        const hasEnoughReferrals = currentReferrals >= raffle.min_referrals;
        return {
            hasEnoughReferrals,
            currentReferrals,
            requiredReferrals: raffle.min_referrals,
            maxReferrals: raffle.max_referrals
        };
    }
    // Расчет множителя шансов на основе количества рефералов
    calculateBonusMultiplier(referralCount) {
        if (referralCount >= 4)
            return 2.0; // +100% шансов
        if (referralCount >= 3)
            return 1.75; // +75% шансов
        if (referralCount >= 2)
            return 1.5; // +50% шансов
        if (referralCount >= 1)
            return 1.25; // +25% шансов
        return 1.0; // Базовые шансы
    }
    // Взвешенный выбор победителей с учетом реферальных бонусов
    selectWinnersWithWeights(participants, winnersCount) {
        console.log(`🎯 Выбираем ${winnersCount} победителей из ${participants.length} участников`);
        if (participants.length === 0) {
            console.log('❌ Нет участников для выбора победителей');
            return [];
        }
        if (participants.length <= winnersCount) {
            console.log('✅ Участников меньше или равно количеству победителей, возвращаем всех');
            return participants;
        }
        // Создаем массив с весами для каждого участника
        const weightedParticipants = participants.map(participant => {
            const multiplier = this.calculateBonusMultiplier(participant.referral_count);
            return {
                participant,
                weight: multiplier,
                originalWeight: multiplier
            };
        });
        console.log('📊 Веса участников:');
        weightedParticipants.forEach((wp, index) => {
            console.log(`  ${index + 1}. Участник ${wp.participant.user_id}: ${wp.participant.referral_count} рефералов → множитель ${wp.weight}x`);
        });
        const winners = [];
        const totalWeight = weightedParticipants.reduce((sum, wp) => sum + wp.weight, 0);
        console.log(`📈 Общий вес всех участников: ${totalWeight}`);
        for (let i = 0; i < winnersCount; i++) {
            if (weightedParticipants.length === 0)
                break;
            // Выбираем случайное число от 0 до общего веса
            const randomValue = Math.random() * totalWeight;
            let currentWeight = 0;
            let selectedIndex = -1;
            // Находим участника по случайному весу
            for (let j = 0; j < weightedParticipants.length; j++) {
                currentWeight += weightedParticipants[j].weight;
                if (randomValue <= currentWeight) {
                    selectedIndex = j;
                    break;
                }
            }
            if (selectedIndex === -1) {
                selectedIndex = weightedParticipants.length - 1;
            }
            // Добавляем выбранного участника в победители
            const winner = weightedParticipants[selectedIndex];
            winners.push(winner.participant);
            console.log(`🏆 Выбран победитель ${i + 1}: Участник ${winner.participant.user_id} (${winner.participant.referral_count} рефералов, вес: ${winner.originalWeight}x)`);
            // Удаляем выбранного участника из списка
            weightedParticipants.splice(selectedIndex, 1);
            // Пересчитываем общий вес
            const newTotalWeight = weightedParticipants.reduce((sum, wp) => sum + wp.weight, 0);
            console.log(`📊 Осталось участников: ${weightedParticipants.length}, новый общий вес: ${newTotalWeight}`);
        }
        console.log(`✅ Выбрано ${winners.length} победителей`);
        return winners;
    }
    async getRaffleRequirements(raffleId) {
        const raffle = await this.getRaffleById(raffleId);
        if (!raffle) {
            throw new Error('Розыгрыш не найден');
        }
        const channels = await this.db.all('SELECT c.* FROM channels c JOIN raffle_channels rc ON c.id = rc.channel_id WHERE rc.raffle_id = ?', [raffleId]);
        return {
            hasReferralRequirement: raffle.referral_requirement,
            minReferrals: raffle.min_referrals,
            maxReferrals: raffle.max_referrals,
            referralBonus: raffle.referral_bonus,
            channels
        };
    }
}
//# sourceMappingURL=raffleService.js.map