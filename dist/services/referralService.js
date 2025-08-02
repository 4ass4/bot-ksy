import crypto from 'crypto';
export class ReferralService {
    db;
    constructor(db) {
        this.db = db;
    }
    // Генерация уникального реферального кода
    generateReferralCode() {
        return crypto.randomBytes(4).toString('hex').toUpperCase();
    }
    // Создание реферального кода для пользователя
    async createReferralCode(userId) {
        let code;
        let attempts = 0;
        // Генерируем уникальный код
        do {
            code = this.generateReferralCode();
            attempts++;
            if (attempts > 10) {
                throw new Error('Не удалось создать уникальный реферальный код');
            }
        } while (await this.isCodeExists(code));
        const result = await this.db.run('INSERT INTO referral_codes (user_id, code) VALUES (?, ?)', [userId, code]);
        return {
            id: result.lastID,
            user_id: userId,
            code,
            usage_count: 0,
            max_usage: 0,
            is_active: true,
            created_at: new Date()
        };
    }
    // Проверка существования кода
    async isCodeExists(code) {
        const result = await this.db.get('SELECT id FROM referral_codes WHERE code = ?', [code]);
        return !!result;
    }
    // Получение реферального кода пользователя
    async getReferralCode(userId) {
        const result = await this.db.get('SELECT * FROM referral_codes WHERE user_id = ?', [userId]);
        if (!result)
            return null;
        return {
            ...result,
            created_at: new Date(result.created_at)
        };
    }
    // Создание или получение реферального кода
    async getOrCreateReferralCode(userId) {
        let code = await this.getReferralCode(userId);
        if (!code) {
            code = await this.createReferralCode(userId);
        }
        return code;
    }
    // Обработка реферального кода
    async processReferralCode(userId, newUserId) {
        // Проверяем, что пользователь существует
        const referrer = await this.db.get('SELECT id FROM users WHERE id = ?', [userId]);
        if (!referrer) {
            return false;
        }
        // Проверяем, что пользователь не регистрируется сам по своему коду
        if (parseInt(userId) === newUserId) {
            return false;
        }
        // Проверяем, что пользователь еще не был привлечен по реферальной системе
        const existingReferral = await this.db.get('SELECT id FROM referrals WHERE referred_id = ?', [newUserId]);
        if (existingReferral) {
            return false;
        }
        // Создаем реферальную связь
        await this.db.run('INSERT INTO referrals (referrer_id, referred_id, referral_code) VALUES (?, ?, ?)', [parseInt(userId), newUserId, `REF${userId}`]);
        // Увеличиваем счетчик использования кода (если есть)
        const referralCode = await this.db.get('SELECT id FROM referral_codes WHERE user_id = ?', [parseInt(userId)]);
        if (referralCode) {
            await this.db.run('UPDATE referral_codes SET usage_count = usage_count + 1 WHERE id = ?', [referralCode.id]);
        }
        return true;
    }
    // Получение статистики рефералов пользователя
    async getUserReferralStats(userId) {
        const referralCode = await this.getReferralCode(userId);
        const code = referralCode?.code || '';
        const stats = await this.db.get(`
      SELECT 
        COUNT(*) as total_referrals,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_referrals,
        SUM(CASE WHEN bonus_claimed = 1 THEN 1 ELSE 0 END) as bonus_claimed
      FROM referrals 
      WHERE referrer_id = ?
    `, [userId]);
        return {
            totalReferrals: stats?.total_referrals || 0,
            activeReferrals: stats?.active_referrals || 0,
            bonusClaimed: stats?.bonus_claimed || 0,
            referralCode: code
        };
    }
    // Получение списка рефералов пользователя
    async getUserReferrals(userId) {
        const results = await this.db.all(`
      SELECT r.*, u.first_name, u.username 
      FROM referrals r
      JOIN users u ON r.referred_id = u.id
      WHERE r.referrer_id = ?
      ORDER BY r.created_at DESC
    `, [userId]);
        return results.map(result => ({
            ...result,
            created_at: new Date(result.created_at)
        }));
    }
    // Отметка бонуса как полученного
    async claimReferralBonus(referralId) {
        await this.db.run('UPDATE referrals SET bonus_claimed = TRUE WHERE id = ?', [referralId]);
    }
    // Получение реферальной ссылки
    getReferralLink(userId) {
        const botUsername = process.env.BOT_USERNAME || 'your_bot_username';
        return `https://t.me/${botUsername}?start=REF${userId}`;
    }
    // Обработка start параметра с реферальным кодом
    async processStartParameter(startParam, userId) {
        if (startParam.startsWith('REF')) {
            const code = startParam.replace('REF', '');
            const success = await this.processReferralCode(code, userId);
            if (success) {
                // Автоматически проверяем и зачисляем участие в розыгрышах
                await this.checkAndAutoEnrollInRaffles(userId);
            }
            return success;
        }
        return false;
    }
    // Автоматическая проверка и зачисление в розыгрыши
    async checkAndAutoEnrollInRaffles(userId) {
        try {
            // Получаем все активные розыгрыши с реферальными требованиями
            const raffles = await this.db.all(`
        SELECT r.*, 
               (SELECT COUNT(*) FROM raffle_participants rp WHERE rp.raffle_id = r.id AND rp.user_id = ?) as is_participating
        FROM raffles r 
        WHERE r.is_active = 1 
          AND r.referral_requirement = 1 
          AND r.end_date > datetime('now')
      `, [userId]);
            for (const raffle of raffles) {
                if (raffle.is_participating)
                    continue; // Уже участвует
                // Проверяем реферальные требования
                const referralRequirements = await this.checkUserReferralRequirements(userId, raffle.id);
                if (referralRequirements.hasEnoughReferrals) {
                    // Автоматически зачисляем участие
                    await this.db.run('INSERT INTO raffle_participants (user_id, raffle_id, is_confirmed) VALUES (?, ?, 1)', [userId, raffle.id]);
                    console.log(`✅ Автоматическое зачисление: пользователь ${userId} в розыгрыш ${raffle.id}`);
                }
            }
        }
        catch (error) {
            console.error('❌ Ошибка при автоматической проверке розыгрышей:', error);
        }
    }
    // Проверка реферальных требований для пользователя
    async checkUserReferralRequirements(userId, raffleId) {
        const raffle = await this.db.get('SELECT min_referrals FROM raffles WHERE id = ?', [raffleId]);
        if (!raffle || !raffle.min_referrals) {
            return {
                hasEnoughReferrals: true,
                currentReferrals: 0,
                requiredReferrals: 0
            };
        }
        const userReferrals = await this.db.get('SELECT COUNT(*) as count FROM referrals WHERE referrer_id = ? AND is_active = 1', [userId]);
        const currentReferrals = userReferrals?.count || 0;
        const requiredReferrals = raffle.min_referrals;
        return {
            hasEnoughReferrals: currentReferrals >= requiredReferrals,
            currentReferrals,
            requiredReferrals
        };
    }
}
//# sourceMappingURL=referralService.js.map