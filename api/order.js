require('dotenv').config();
const express = require('express');
const ExcelJS = require('exceljs');
const Database = require('better-sqlite3');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

const app = express();

// 🧩 پشتیبانی از هر دو نوع نام متغیر (BOT_TOKEN یا TELEGRAM_BOT_TOKEN)
const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID || process.env.TELEGRAM_CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  console.error('❌ لطفاً BOT_TOKEN و CHAT_ID را در تنظیمات Vercel تعریف کنید.');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

// 🗓 تابع تبدیل تاریخ میلادی به شمسی
function toPersianDateTime(dateStr) {
  const date = new Date(dateStr);
  const faDate = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    dateStyle: 'medium'
  }).format(date);
  const faTime = new Intl.DateTimeFormat('fa-IR', {
    timeStyle: 'short'
  }).format(date);
  return `${faDate}، ${faTime}`;
}

// دیتابیس SQLite (در محیط سرورهای serverless موقت است)
const db = new Database(path.join('/tmp', 'orders.db'));
db.exec(`
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_code TEXT UNIQUE,
  name TEXT,
  phone TEXT,
  address TEXT,
  postal_code TEXT,
  products_json TEXT,
  notes TEXT,
  created_at TEXT
);
`);

// توابع کمکی
function formatOrderCode(num) {
  return 'ORD-' + String(num).padStart(6, '0');
}

function createOrder(data) {
  const created_at = new Date().toISOString();
  const insertTemp = db.prepare(`
    INSERT INTO orders (order_code, name, phone, address, postal_code, products_json, notes, created_at)
    VALUES (NULL, @name, @phone, @address, @postal_code, @products_json, @notes, @created_at)
  `);
  const info = insertTemp.run({
    name: data.name,
    phone: data.phone,
    address: data.address,
    postal_code: data.postal_code || '',
    products_json: data.products_json,
    notes: data.notes || '',
    created_at
  });

  const id = info.lastInsertRowid;
  const order_code = formatOrderCode(id);
  db.prepare(`UPDATE orders SET order_code = ? WHERE id = ?`).run(order_code, id);
  const row = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id);
  return row;
}

async function generateExcelBuffer(order) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Order');

  sheet.addRow(['Order Code', order.order_code]);
  sheet.addRow(['Created At', order.created_at]);
  sheet.addRow([]);
  sheet.addRow(['Name', order.name]);
  sheet.addRow(['Phone', order.phone]);
  sheet.addRow(['Address', order.address]);
  sheet.addRow(['Postal Code', order.postal_code || '']);
  sheet.addRow([]);
  sheet.addRow(['Products']);
  sheet.addRow(['Qty', 'Unit', 'Product Name']);

  let products = [];
  try {
    products = JSON.parse(order.products_json || '[]');
    if (!Array.isArray(products)) products = [];
  } catch {
    products = [];
  }

  products.forEach(p => {
    if (Number(p.quantity) > 0) {
      sheet.addRow([p.quantity, p.unit, p.name]);
    }
  });

  sheet.addRow([]);
  sheet.addRow(['Notes', order.notes || '']);

  // ✅ خروجی اکسل در حافظه (Buffer)
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

function buildTelegramMessage(order) {
  let products = [];
  try {
    products = JSON.parse(order.products_json || '[]');
    if (!Array.isArray(products)) products = [];
  } catch {
    products = [];
  }

  const lines = [];
  lines.push('🟢 سفارش جدید ثبت شد!');
  lines.push('');
  lines.push(`👤 نام و نام خانوادگی: ${order.name}`);
  lines.push(`📞 شماره تماس: ${order.phone}`);
  lines.push(`🏠 آدرس گیرنده: ${order.address}`);
  if (order.postal_code) lines.push(`📨 کد پستی: ${order.postal_code}`);
  lines.push('');
  lines.push('🧾 محصولات سفارش‌شده:');
  products.forEach(p => {
    if (Number(p.quantity) > 0) {
      lines.push(`${p.name} – ${p.quantity} ${p.unit}`);
    }
  });
  lines.push('');
  if (order.notes) {
    lines.push('📝 توضیحات:');
    lines.push(order.notes);
    lines.push('');
  }

  // ⏰ تاریخ ثبت به شمسی
  lines.push(`⏰ زمان ثبت: ${toPersianDateTime(order.created_at)}`);
  lines.push(`🔢 کد سفارش: ${order.order_code}`);

  return lines.join('\n');
}

// پارسر JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 📦 مسیر API
app.post('/api/order', async (req, res) => {
  try {
    const body = req.body;
    const name = body.name || '';
    const phone = body.phone || '';
    const address = body.address || '';
    const postal_code = body.postal_code || '';
    const notes = body.note || '';

    const products = [
      { name: 'سها ۵۰۰ گرمی سبز', quantity: Number(body.saha500_qty || 0), unit: body.saha500_unit || '' },
      { name: 'سها ۲۵۰ گرمی ساشه', quantity: Number(body.saha250_qty || 0), unit: body.saha250_unit || '' },
      { name: 'باکس پوچ یک کیلویی', quantity: Number(body.box1kg_qty || 0), unit: body.box1kg_unit || '' },
      { name: 'پاکت طلایی پنجره‌دار', quantity: Number(body.goldPack_qty || 0), unit: body.goldPack_unit || '' },
      { name: 'پاکت یک کیلویی ساده', quantity: Number(body.plainPack_qty || 0), unit: body.plainPack_unit || '' }
    ].filter(p => p.quantity > 0);

    const saved = createOrder({
      name,
      phone,
      address,
      postal_code,
      products_json: JSON.stringify(products),
      notes
    });

    // تولید اکسل در حافظه
    const excelBuffer = await generateExcelBuffer(saved);
    const messageText = buildTelegramMessage(saved);

    // ارسال پیام و فایل به گروه تلگرام
    await bot.sendMessage(CHAT_ID, messageText);
    await bot.sendDocument(CHAT_ID, excelBuffer, {}, {
      filename: `order-${saved.order_code}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    res.json({ ok: true, order_code: saved.order_code });
  } catch (err) {
    console.error('❌ خطا در پردازش سفارش:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ✅ مخصوص Vercel
module.exports = (req, res) => {
  app(req, res);
};
