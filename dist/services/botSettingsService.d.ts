import Database from '../database/database.js';
import { BotSettings } from '../types/index.js';
export declare class BotSettingsService {
    private db;
    constructor(db: Database);
    getSettings(): Promise<BotSettings>;
    updateWelcomeMessage(message: string): Promise<void>;
    updateCoverPhoto(fileId: string): Promise<void>;
    removeCoverPhoto(): Promise<void>;
}
//# sourceMappingURL=botSettingsService.d.ts.map