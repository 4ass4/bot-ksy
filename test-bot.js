#!/usr/bin/env node

// Простой тест для проверки работы бота
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Тестирование Telegram-бота для розыгрышей...\n');

// Проверяем наличие необходимых файлов
const requiredFiles = [
  'package.json',
  'src/index.ts',
  'src/database/migrate.ts',
  'env.example'
];

console.log('📁 Проверка файлов проекта:');
  requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`✅ ${file}`);
    } else {
      console.log(`❌ ${file} - НЕ НАЙДЕН`);
    }
  });

// Проверяем зависимости
console.log('\n📦 Проверка зависимостей:');
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const requiredDeps = ['grammy', 'sqlite3', 'node-cron', 'dotenv'];
const requiredDevDeps = ['typescript', 'tsx', '@types/node'];

requiredDeps.forEach(dep => {
  if (packageJson.dependencies && packageJson.dependencies[dep]) {
    console.log(`✅ ${dep} (${packageJson.dependencies[dep]})`);
  } else {
    console.log(`❌ ${dep} - НЕ НАЙДЕНА`);
  }
});

requiredDevDeps.forEach(dep => {
  if (packageJson.devDependencies && packageJson.devDependencies[dep]) {
    console.log(`✅ ${dep} (${packageJson.devDependencies[dep]})`);
  } else {
    console.log(`❌ ${dep} - НЕ НАЙДЕНА`);
  }
});

// Проверяем скрипты
console.log('\n🔧 Проверка скриптов:');
const scripts = ['build', 'start', 'dev', 'migrate'];
scripts.forEach(script => {
  if (packageJson.scripts && packageJson.scripts[script]) {
    console.log(`✅ ${script}: ${packageJson.scripts[script]}`);
  } else {
    console.log(`❌ ${script} - НЕ НАЙДЕН`);
  }
});

console.log('\n🎯 Рекомендации для запуска:');
console.log('1. Скопируйте env.example в .env');
console.log('2. Заполните BOT_TOKEN и ADMIN_IDS в .env');
console.log('3. Установите зависимости: npm install');
console.log('4. Выполните миграции: npm run migrate');
console.log('5. Запустите бота: npm run dev');

console.log('\n✅ Тест завершен!'); 