export class UserService {
    db;
    constructor(db) {
        this.db = db;
    }
    async createUser(telegramId, firstName, lastName, username) {
        const adminIds = process.env.ADMIN_IDS?.split(',').map(id => parseInt(id)) || [];
        const isAdmin = adminIds.includes(telegramId);
        // Сначала проверяем, существует ли пользователь
        const existingUser = await this.getUserByTelegramId(telegramId);
        if (existingUser) {
            // Обновляем существующего пользователя
            await this.db.run(`UPDATE users SET first_name = ?, last_name = ?, username = ?, is_admin = ? 
         WHERE telegram_id = ?`, [firstName, lastName, username, isAdmin, telegramId]);
            return {
                ...existingUser,
                first_name: firstName,
                last_name: lastName,
                username: username,
                is_admin: isAdmin
            };
        }
        else {
            // Создаем нового пользователя
            const result = await this.db.run(`INSERT INTO users (telegram_id, first_name, last_name, username, is_admin) 
         VALUES (?, ?, ?, ?, ?)`, [telegramId, firstName, lastName, username, isAdmin]);
            return {
                id: result.lastID,
                telegram_id: telegramId,
                first_name: firstName,
                last_name: lastName,
                username: username,
                is_admin: isAdmin,
                joined_at: new Date()
            };
        }
    }
    async getUserByTelegramId(telegramId) {
        return await this.db.get('SELECT * FROM users WHERE telegram_id = ?', [telegramId]);
    }
    async getAllUsers() {
        return await this.db.all('SELECT * FROM users ORDER BY joined_at DESC');
    }
    async getUsersCount() {
        const result = await this.db.get('SELECT COUNT(*) as count FROM users');
        return result?.count || 0;
    }
    async updateAdminStatus(telegramId, isAdmin) {
        await this.db.run('UPDATE users SET is_admin = ? WHERE telegram_id = ?', [isAdmin, telegramId]);
    }
}
//# sourceMappingURL=userService.js.map