# Развертывание Telegram-бота для розыгрышей

## 🚀 Варианты развертывания

### 1. Локальное развертывание

#### Требования
- Node.js 18+
- npm или yarn
- SQLite3

#### Шаги
1. Клонируйте репозиторий
2. Установите зависимости: `npm install`
3. Настройте `.env` файл
4. Запустите миграции: `npm run migrate`
5. Запустите бота: `npm start`

### 2. Docker развертывание

#### Создание Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

#### Docker Compose

```yaml
version: '3.8'
services:
  telegram-bot:
    build: .
    restart: unless-stopped
    environment:
      - BOT_TOKEN=${BOT_TOKEN}
      - ADMIN_IDS=${ADMIN_IDS}
      - RESULTS_CHANNEL_ID=${RESULTS_CHANNEL_ID}
    volumes:
      - ./database:/app/database
    networks:
      - bot-network

networks:
  bot-network:
    driver: bridge
```

### 3. VPS развертывание

#### Ubuntu/Debian

```bash
# Обновляем систему
sudo apt update && sudo apt upgrade -y

# Устанавливаем Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Клонируем проект
git clone <repository-url>
cd telegram-raffle-bot

# Устанавливаем зависимости
npm install

# Настраиваем .env
cp .env.example .env
nano .env

# Выполняем миграции
npm run migrate

# Собираем проект
npm run build

# Устанавливаем PM2 для управления процессом
sudo npm install -g pm2

# Запускаем бота
pm2 start dist/index.js --name telegram-bot

# Настраиваем автозапуск
pm2 startup
pm2 save
```

## 🔧 Настройка продакшен окружения

### 1. Переменные окружения для продакшена

```env
NODE_ENV=production
BOT_TOKEN=your_production_bot_token
ADMIN_IDS=admin_id_1,admin_id_2
RESULTS_CHANNEL_ID=-100channel_id
DATABASE_PATH=/app/data/bot.db
LOG_LEVEL=info
```

### 2. Настройка логирования

Для продакшена рекомендуется настроить централизованное логирование:

```bash
# Логи PM2
pm2 logs telegram-bot

# Настройка ротации логов
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

### 3. Мониторинг

#### Настройка PM2 мониторинга

```bash
# Установка PM2 Plus для мониторинга
pm2 link <secret_key> <public_key>

# Настройка алертов
pm2 set pm2:autodump true
pm2 set pm2:watch true
```

### 4. Резервное копирование

#### Скрипт для backup базы данных

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/path/to/backups"
DB_PATH="/app/database/bot.db"
DATE=$(date +%Y%m%d_%H%M%S)

# Создаем backup
sqlite3 $DB_PATH ".backup $BACKUP_DIR/bot_backup_$DATE.db"

# Удаляем старые backup'ы (старше 30 дней)
find $BACKUP_DIR -name "bot_backup_*.db" -mtime +30 -delete

echo "Backup completed: bot_backup_$DATE.db"
```

#### Настройка cron для автоматического backup

```bash
# Добавляем в crontab
crontab -e

# Backup каждый день в 3:00
0 3 * * * /path/to/backup.sh
```

## 🛡️ Безопасность

### 1. Настройка файрвола

```bash
# UFW (Ubuntu)
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
```

### 2. SSL сертификаты (если используется веб-интерфейс)

```bash
# Let's Encrypt
sudo apt install certbot
sudo certbot --nginx -d yourdomain.com
```

### 3. Ограничение доступа к базе данных

```bash
# Ограничиваем права на файл базы данных
chmod 600 /app/database/bot.db
chown app:app /app/database/bot.db
```

## 📊 Мониторинг и оптимизация

### 1. Мониторинг ресурсов

```bash
# Проверка использования ресурсов
pm2 monit

# Системная информация
htop
df -h
free -h
```

### 2. Оптимизация производительности

#### Настройка Node.js

```bash
# Увеличиваем лимит памяти для Node.js
export NODE_OPTIONS="--max-old-space-size=2048"
```

#### PM2 кластер режим

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'telegram-bot',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    }
  }]
}
```

### 3. Алерты и уведомления

#### Настройка Telegram уведомлений для админов

```bash
# Скрипт для отправки алертов
#!/bin/bash
# alert.sh

BOT_TOKEN="your_bot_token"
CHAT_ID="admin_chat_id"
MESSAGE="🚨 Alert: $1"

curl -s -X POST "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
  -d chat_id="$CHAT_ID" \
  -d text="$MESSAGE"
```

## 🔄 Обновления

### 1. Безопасное обновление

```bash
# Создаем backup перед обновлением
./backup.sh

# Получаем обновления
git pull origin main

# Устанавливаем новые зависимости
npm install

# Выполняем миграции (если есть)
npm run migrate

# Пересобираем проект
npm run build

# Перезапускаем с нулевым временем простоя
pm2 reload telegram-bot
```

### 2. Rollback план

```bash
# В случае проблем - откатываемся
git reset --hard HEAD~1
npm run build
pm2 reload telegram-bot

# Восстанавливаем базу данных из backup
cp /path/to/backups/bot_backup_latest.db /app/database/bot.db
```

## 🆘 Troubleshooting

### Частые проблемы

1. **Бот не отвечает**
   ```bash
   pm2 logs telegram-bot
   pm2 restart telegram-bot
   ```

2. **Проблемы с базой данных**
   ```bash
   sqlite3 /app/database/bot.db ".schema"
   npm run migrate
   ```

3. **Недостаток места на диске**
   ```bash
   df -h
   pm2 flush  # Очистка логов
   ```

4. **Высокая нагрузка на CPU**
   ```bash
   pm2 monit
   # Возможно стоит ограничить количество одновременных запросов
   ```

---

Следуя этому руководству, вы сможете развернуть бота в продакшен окружении с обеспечением надежности, безопасности и производительности.