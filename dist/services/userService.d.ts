import Database from '../database/database.js';
import { User } from '../types/index.js';
export declare class UserService {
    private db;
    constructor(db: Database);
    createUser(telegramId: number, firstName: string, lastName?: string, username?: string): Promise<User>;
    getUserByTelegramId(telegramId: number): Promise<User | undefined>;
    getAllUsers(): Promise<User[]>;
    getUsersCount(): Promise<number>;
    updateAdminStatus(telegramId: number, isAdmin: boolean): Promise<void>;
}
//# sourceMappingURL=userService.d.ts.map