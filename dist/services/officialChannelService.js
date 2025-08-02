export class OfficialChannelService {
    db;
    constructor(db) {
        this.db = db;
    }
    async getOfficialChannel() {
        const result = await this.db.get('SELECT * FROM official_channel ORDER BY id DESC LIMIT 1');
        return result;
    }
    async createOfficialChannel(telegramChannelId, name, inviteLink, description) {
        // Удаляем предыдущий официальный канал (может быть только один)
        await this.db.run('DELETE FROM official_channel');
        const result = await this.db.run('INSERT INTO official_channel (telegram_channel_id, name, invite_link, description) VALUES (?, ?, ?, ?)', [telegramChannelId, name, inviteLink, description]);
        return result.lastID;
    }
    async updateOfficialChannel(id, telegramChannelId, name, inviteLink, description) {
        await this.db.run('UPDATE official_channel SET telegram_channel_id = ?, name = ?, invite_link = ?, description = ? WHERE id = ?', [telegramChannelId, name, inviteLink, description, id]);
    }
    async deleteOfficialChannel() {
        await this.db.run('DELETE FROM official_channel');
    }
    async hasOfficialChannel() {
        const result = await this.db.get('SELECT COUNT(*) as count FROM official_channel');
        return (result?.count || 0) > 0;
    }
}
//# sourceMappingURL=officialChannelService.js.map