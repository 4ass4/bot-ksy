declare class Database {
    private db;
    constructor(dbPath: string);
    run(sql: string, params?: any[]): Promise<{
        lastID: number;
        changes: number;
    }>;
    get<T>(sql: string, params?: any[]): Promise<T | undefined>;
    all<T>(sql: string, params?: any[]): Promise<T[]>;
    close(): Promise<void>;
}
export default Database;
//# sourceMappingURL=database.d.ts.map