#!/usr/bin/env node

// Отладочный скрипт для проверки работы бота
const fs = require('fs');
const path = require('path');

console.log('🔍 Отладка Telegram-бота для розыгрышей...\n');

// Проверяем наличие .env файла
if (!fs.existsSync('.env')) {
  console.log('❌ Файл .env не найден!');
  console.log('💡 Скопируйте env.example в .env и заполните переменные:');
  console.log('   cp env.example .env');
  console.log('   # Затем отредактируйте .env и добавьте:');
  console.log('   # BOT_TOKEN=your_bot_token_here');
  console.log('   # ADMIN_IDS=your_telegram_id_here');
  process.exit(1);
}

// Проверяем содержимое .env
const envContent = fs.readFileSync('.env', 'utf8');
const botToken = envContent.match(/BOT_TOKEN=(.+)/)?.[1];
const adminIds = envContent.match(/ADMIN_IDS=(.+)/)?.[1];

console.log('📋 Проверка конфигурации:');
console.log(`✅ BOT_TOKEN: ${botToken ? 'Установлен' : 'НЕ НАЙДЕН'}`);
console.log(`✅ ADMIN_IDS: ${adminIds ? 'Установлен' : 'НЕ НАЙДЕН'}`);

if (!botToken || botToken === 'your_bot_token_here') {
  console.log('\n❌ BOT_TOKEN не настроен!');
  console.log('💡 Получите токен у @BotFather и добавьте в .env');
}

if (!adminIds || adminIds === 'your_telegram_id_here') {
  console.log('\n❌ ADMIN_IDS не настроен!');
  console.log('💡 Получите ваш ID у @userinfobot и добавьте в .env');
}

// Проверяем зависимости
console.log('\n📦 Проверка зависимостей:');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredDeps = ['grammy', 'sqlite3', 'node-cron', 'dotenv'];
  
  requiredDeps.forEach(dep => {
    if (packageJson.dependencies && packageJson.dependencies[dep]) {
      console.log(`✅ ${dep}: ${packageJson.dependencies[dep]}`);
    } else {
      console.log(`❌ ${dep}: НЕ НАЙДЕН`);
    }
  });
} catch (error) {
  console.log('❌ Ошибка чтения package.json');
}

// Проверяем базу данных
console.log('\n🗄️ Проверка базы данных:');
const dbPath = './database/bot.db';
if (fs.existsSync(dbPath)) {
  console.log(`✅ База данных существует: ${dbPath}`);
} else {
  console.log(`❌ База данных не найдена: ${dbPath}`);
  console.log('💡 Запустите миграции: npm run migrate');
}

// Проверяем скомпилированные файлы
console.log('\n🔧 Проверка скомпилированных файлов:');
const distPath = './dist';
if (fs.existsSync(distPath)) {
  console.log('✅ Папка dist существует');
  const distFiles = fs.readdirSync(distPath);
  console.log(`📁 Файлы в dist: ${distFiles.join(', ')}`);
} else {
  console.log('❌ Папка dist не найдена');
  console.log('💡 Соберите проект: npm run build');
}

console.log('\n🎯 Рекомендации:');
console.log('1. Убедитесь, что .env настроен правильно');
console.log('2. Установите зависимости: npm install');
console.log('3. Выполните миграции: npm run migrate');
console.log('4. Соберите проект: npm run build');
console.log('5. Запустите бота: npm run dev');

console.log('\n✅ Отладка завершена!'); 