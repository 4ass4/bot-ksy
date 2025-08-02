import Database from '../database/database.js';
import { User } from '../types/index.js';

export class UserService {
  constructor(private db: Database) {}

  async createUser(telegramId: number, firstName: string, lastName?: string, username?: string): Promise<User> {
    const adminIds = process.env.ADMIN_IDS?.split(',').map(id => parseInt(id)) || [];
    const isAdmin = adminIds.includes(telegramId);

    // Сначала проверяем, существует ли пользователь
    const existingUser = await this.getUserByTelegramId(telegramId);
    
    if (existingUser) {
      // Обновляем существующего пользователя
      await this.db.run(
        `UPDATE users SET first_name = ?, last_name = ?, username = ?, is_admin = ? 
         WHERE telegram_id = ?`,
        [firstName, lastName, username, isAdmin, telegramId]
      );
      
      return {
        ...existingUser,
        first_name: firstName,
        last_name: lastName,
        username: username,
        is_admin: isAdmin
      };
    } else {
      // Создаем нового пользователя
      const result = await this.db.run(
        `INSERT INTO users (telegram_id, first_name, last_name, username, is_admin) 
         VALUES (?, ?, ?, ?, ?)`,
        [telegramId, firstName, lastName, username, isAdmin]
      );

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

  async getUserByTelegramId(telegramId: number): Promise<User | undefined> {
    return await this.db.get<User>(
      'SELECT * FROM users WHERE telegram_id = ?',
      [telegramId]
    );
  }

  async getAllUsers(): Promise<User[]> {
    return await this.db.all<User>('SELECT * FROM users ORDER BY joined_at DESC');
  }

  async getUsersCount(): Promise<number> {
    const result = await this.db.get<{ count: number }>('SELECT COUNT(*) as count FROM users');
    return result?.count || 0;
  }

  async updateAdminStatus(telegramId: number, isAdmin: boolean): Promise<void> {
    await this.db.run(
      'UPDATE users SET is_admin = ? WHERE telegram_id = ?',
      [isAdmin, telegramId]
    );
  }
}