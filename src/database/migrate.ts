import Database from './database.js';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_PATH = process.env.DATABASE_PATH || './database/bot.db';

async function migrate() {
  const db = new Database(DATABASE_PATH);

  try {
    console.log('🚀 Начинаем миграцию базы данных...');

    // Таблица пользователей
    await db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id INTEGER UNIQUE NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT,
        username TEXT,
        is_admin BOOLEAN DEFAULT FALSE,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица каналов (партнерские каналы для розыгрышей)
    await db.run(`
      CREATE TABLE IF NOT EXISTS channels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_channel_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        invite_link TEXT NOT NULL
      )
    `);

    // Таблица официального канала
    await db.run(`
      CREATE TABLE IF NOT EXISTS official_channel (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_channel_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        invite_link TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица розыгрышей
    await db.run(`
      CREATE TABLE IF NOT EXISTS raffles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prize_description TEXT NOT NULL,
        photo_file_id TEXT,
        video_file_id TEXT,
        winners_count INTEGER NOT NULL,
        end_date DATETIME NOT NULL,
        status TEXT CHECK(status IN ('SCHEDULED', 'ACTIVE', 'FINISHED', 'CANCELED')) DEFAULT 'SCHEDULED',
        result_message_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Связующая таблица розыгрыши-каналы
    await db.run(`
      CREATE TABLE IF NOT EXISTS raffle_channels (
        raffle_id INTEGER,
        channel_id INTEGER,
        PRIMARY KEY (raffle_id, channel_id),
        FOREIGN KEY (raffle_id) REFERENCES raffles(id) ON DELETE CASCADE,
        FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
      )
    `);

    // Таблица участников
    await db.run(`
      CREATE TABLE IF NOT EXISTS participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        raffle_id INTEGER,
        is_eligible BOOLEAN DEFAULT FALSE,
        referral_count INTEGER DEFAULT 0,
        participated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, raffle_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (raffle_id) REFERENCES raffles(id) ON DELETE CASCADE
      )
    `);

    // Таблица победителей
    await db.run(`
      CREATE TABLE IF NOT EXISTS winners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        raffle_id INTEGER,
        user_id INTEGER,
        prize_won TEXT,
        won_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (raffle_id) REFERENCES raffles(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Таблица рассылок
    await db.run(`
      CREATE TABLE IF NOT EXISTS mailings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mailing_type TEXT CHECK(mailing_type IN ('ALL_USERS', 'RAFFLE_PARTICIPANTS')) NOT NULL,
        target_raffle_id INTEGER,
        message_text TEXT NOT NULL,
        photo_file_id TEXT,
        video_file_id TEXT,
        inline_keyboard_json TEXT,
        schedule_time DATETIME,
        status TEXT CHECK(status IN ('SCHEDULED', 'SENDING', 'COMPLETED', 'CANCELED')) DEFAULT 'SCHEDULED',
        sent_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (target_raffle_id) REFERENCES raffles(id) ON DELETE SET NULL
      )
    `);

    // Добавляем новые колонки для медиа в таблицу розыгрышей (если их нет)
    try {
      await db.run(`ALTER TABLE raffles ADD COLUMN photo_file_id TEXT`);
    } catch (error) {
      console.log('ℹ️ Колонка photo_file_id уже существует');
    }
    
    try {
      await db.run(`ALTER TABLE raffles ADD COLUMN video_file_id TEXT`);
    } catch (error) {
      console.log('ℹ️ Колонка video_file_id уже существует');
    }

    // Добавляем колонки для реферальных требований
    try {
      await db.run(`ALTER TABLE raffles ADD COLUMN referral_requirement BOOLEAN DEFAULT FALSE`);
    } catch (error) {
      console.log('ℹ️ Колонка referral_requirement уже существует');
    }
    
    try {
      await db.run(`ALTER TABLE raffles ADD COLUMN min_referrals INTEGER DEFAULT 0`);
    } catch (error) {
      console.log('ℹ️ Колонка min_referrals уже существует');
    }
    
    try {
      await db.run(`ALTER TABLE raffles ADD COLUMN max_referrals INTEGER DEFAULT 0`);
    } catch (error) {
      console.log('ℹ️ Колонка max_referrals уже существует');
    }
    
    try {
      await db.run(`ALTER TABLE raffles ADD COLUMN referral_bonus TEXT`);
    } catch (error) {
      console.log('ℹ️ Колонка referral_bonus уже существует');
    }
    
    try {
      await db.run(`ALTER TABLE raffles ADD COLUMN bonus_multiplier REAL DEFAULT 1.0`);
    } catch (error) {
      console.log('ℹ️ Колонка bonus_multiplier уже существует');
    }

    // Создаем таблицу настроек бота
    await db.run(`
      CREATE TABLE IF NOT EXISTS bot_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        welcome_message TEXT DEFAULT '👋 Добро пожаловать в бот для розыгрышей!

🎁 Здесь вы можете участвовать в различных розыгрышах и конкурсах.',
        cover_photo_file_id TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Добавляем запись по умолчанию, если таблица пустая
    await db.run(`
      INSERT OR IGNORE INTO bot_settings (id, welcome_message) VALUES (1, '👋 Добро пожаловать в бот для розыгрышей!

🎁 Здесь вы можете участвовать в различных розыгрышах и конкурсах.')
    `);

    // Таблица рефералов
    await db.run(`
      CREATE TABLE IF NOT EXISTS referrals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        referrer_id INTEGER NOT NULL,
        referred_id INTEGER UNIQUE NOT NULL,
        referral_code TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        bonus_claimed BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (referred_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Таблица реферальных кодов
    await db.run(`
      CREATE TABLE IF NOT EXISTS referral_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        code TEXT UNIQUE NOT NULL,
        usage_count INTEGER DEFAULT 0,
        max_usage INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Таблица аналитики
    await db.run(`
      CREATE TABLE IF NOT EXISTS analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        user_id INTEGER,
        raffle_id INTEGER,
        channel_id INTEGER,
        referral_code TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (raffle_id) REFERENCES raffles(id) ON DELETE SET NULL,
        FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE SET NULL
      )
    `);

    // Таблица интеграций с соцсетями
    await db.run(`
      CREATE TABLE IF NOT EXISTS social_integrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT NOT NULL,
        access_token TEXT,
        refresh_token TEXT,
        user_id TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица социальных аккаунтов
    await db.run(`
      CREATE TABLE IF NOT EXISTS social_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT CHECK(platform IN ('TELEGRAM', 'INSTAGRAM', 'TIKTOK', 'TWITTER', 'FACEBOOK', 'YOUTUBE')) NOT NULL,
        username TEXT NOT NULL,
        display_name TEXT NOT NULL,
        profile_url TEXT NOT NULL,
        follower_count INTEGER,
        is_verified BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(platform, username)
      )
    `);

    // Таблица требований к социальным сетям для розыгрышей
    await db.run(`
      CREATE TABLE IF NOT EXISTS raffle_social_requirements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        raffle_id INTEGER NOT NULL,
        social_account_id INTEGER NOT NULL,
        requirement_type TEXT CHECK(requirement_type IN ('FOLLOW', 'LIKE', 'SHARE', 'COMMENT')) DEFAULT 'FOLLOW',
        is_required BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (raffle_id) REFERENCES raffles(id) ON DELETE CASCADE,
        FOREIGN KEY (social_account_id) REFERENCES social_accounts(id) ON DELETE CASCADE
      )
    `);

    // Таблица постов в соцсети
    await db.run(`
      CREATE TABLE IF NOT EXISTS social_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT NOT NULL,
        post_type TEXT NOT NULL,
        content TEXT,
        media_file_id TEXT,
        raffle_id INTEGER,
        status TEXT CHECK(status IN ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED')) DEFAULT 'DRAFT',
        scheduled_at DATETIME,
        published_at DATETIME,
        external_post_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (raffle_id) REFERENCES raffles(id) ON DELETE SET NULL
      )
    `);

    // Добавляем колонку referral_count в таблицу participants (если её нет)
    try {
      await db.run(`ALTER TABLE participants ADD COLUMN referral_count INTEGER DEFAULT 0`);
      console.log('✅ Колонка referral_count добавлена в таблицу participants');
    } catch (error: any) {
      if (error.message.includes('duplicate column name')) {
        console.log('ℹ️ Колонка referral_count уже существует');
      } else {
        console.log('ℹ️ Колонка referral_count уже существует');
      }
    }

    // Создаем индексы для оптимизации
    await db.run(`CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_participants_raffle_id ON participants(raffle_id)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_participants_user_id ON participants(user_id)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_participants_referral_count ON participants(referral_count)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_raffles_status ON raffles(status)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_raffles_end_date ON raffles(end_date)`);
    
    // Индексы для реферальной системы
    await db.run(`CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON referrals(referred_id)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_referral_codes_user_id ON referral_codes(user_id)`);
    
    // Индексы для аналитики
    await db.run(`CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics(event_type)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics(created_at)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics(user_id)`);
    
    // Индексы для соцсетей
    await db.run(`CREATE INDEX IF NOT EXISTS idx_social_posts_platform ON social_posts(platform)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled_at ON social_posts(scheduled_at)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_accounts(platform)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_social_accounts_username ON social_accounts(username)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_raffle_social_requirements_raffle_id ON raffle_social_requirements(raffle_id)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_raffle_social_requirements_social_account_id ON raffle_social_requirements(social_account_id)`);

    console.log('✅ Миграция завершена успешно');
  } catch (error) {
    console.error('❌ Ошибка при миграции:', error);
    throw error;
  } finally {
    await db.close();
  }
}

// Запускаем миграцию если файл запущен напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
  migrate().catch(console.error);
}

export default migrate;