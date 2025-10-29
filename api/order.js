require('dotenv').config();
const express = require('express');
const ExcelJS = require('exceljs');
const Database = require('better-sqlite3');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const moment = require('moment-jalaali'); // 📅 تاریخ شمسی

const app = express();

const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID || process.env.TELEGRAM_CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  console.error('❌ لطفاً BOT_TOKEN و CHAT_ID را در تنظیمات Vercel تعریف کنید.');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

// دیتابیس SQLite (در حافظه‌ی Vercel /tmp/)
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

function formatOrderCode(num) {
  return 'ORD-' + String(num).padStart(6, '0');
}

function createOrder(data) {
  const created_at = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO orders (order_code, name, phone, address, postal_code, products_json, notes, created_at)
    VALUES (NULL, @name, @phone, @address, @postal_code, @products_json, @notes, @created_at)
  `);
  const info = insert.run(data);
  const id = info.lastInsertRowid;
  const order_code = formatOrderCode(id);
  db.prepare(`UPDATE orders SET order_code = ? WHERE id = ?`).run(order_code, id);
  return db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id);
}

async function generateExcelBuffer(order) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Order');

  sheet.columns = [
    { header: 'فیلد', key: 'field', width: 25 },
    { header: 'مقدار', key: 'value', width: 45 }
  ];

  sheet.addRow({ field: 'کد سفارش', value: order.order_code });
  sheet.addRow({ field: 'زمان ثبت (میلادی)', value: order.created_at });
  sheet.addRow({ field: 'نام و نام خانوادگی', value: order.name });
  sheet.addRow({ field: 'شماره تماس', value: order.phone });
  sheet.addRow({ field: 'آدرس', value: order.address });
  sheet.addRow({ field: 'کد پستی', value: order.postal_code || '—' });
  sheet.addRow({ field: 'توضیحات', value: order.notes || '—' });
  sheet.addRow({});
  sheet.addRow({ field: 'محصولات سفارش‌شده:', value: '' });
  sheet.addRow({ field: 'تعداد', value: 'محصول' });

  let products = [];
  try {
    products = JSON.parse(order.products_json || '[]');
    if (!Array.isArray(products)) products = [];
  } catch {
    products = [];
  }

  products.forEach(p => {
    if (Number(p.quantity) > 0) {
      sheet.addRow({ field: `${p.quantity} ${p.unit}`, value: p.name });
    }
  });

  // 🎨 زیباسازی
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(2).font = { bold: true };
  sheet.getColumn(1).alignment = { vertical: 'middle', horizontal: 'right' };
  sheet.getColumn(2).alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.eachRow(row => {
    row.height = 22;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

function buildTelegramMessage(order) {
  const faDate = moment(order.created_at).format('jYYYY/jMM/jDD');
  const faTime = moment(order.created_at).format('HH:mm');

  let products = [];
  try {
    products = JSON.parse(order.products_json || '[]');
    if (!Array.isArray(products)) products = [];
  } catch {
    products = [];
  }

  const lines = [];
  lines.push('📦 سفارش جدید محصولات سُها\n');
  lines.push(`👤 نام: ${order.name}`);
  lines.push(`📞 تماس: ${order.phone}`);
  lines.push(`🏠 آدرس: ${order.address}`);
  if (order.postal_code) lines.push(`📮 کد پستی: ${order.postal_code}`);
  lines.push('');
  lines.push('🧾 محصولات سفارش‌شده:');
  products.forEach(p => {
    if (Number(p.quantity) > 0) {
      lines.push(`• ${p.name} – ${p.quantity} ${p.unit}`);
    }
  });
  lines.push('');
  lines.push(`🕓 تاریخ ثبت: ${faDate} – ساعت ${faTime}`);
  lines.push(`🔢 کد سفارش: ${order.order_code}`);
  return lines.join('\n');
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/api/order', async (req, res) => {
  try {
    const body = req.body;
    const order = createOrder({
      name: body.name || '',
      phone: body.phone || '',
      address: body.address || '',
      postal_code: body.postal_code || '',
      products_json: JSON.stringify([
        { name: 'سها ۵۰۰ گرمی سبز', quantity: Number(body.saha500_qty || 0), unit: body.saha500_unit || '' },
        { name: 'سها ۲۵۰ گرمی ساشه', quantity: Number(body.saha250_qty || 0), unit: body.saha250_unit || '' },
        { name: 'باکس پوچ یک کیلویی', quantity: Number(body.box1kg_qty || 0), unit: body.box1kg_unit || '' },
        { name: 'پاکت طلایی پنجره‌دار', quantity: Number(body.goldPack_qty || 0), unit: body.goldPack_unit || '' },
        { name: 'پاکت یک کیلویی ساده', quantity: Number(body.plainPack_qty || 0), unit: body.plainPack_unit || '' }
      ].filter(p => p.quantity > 0)),
      notes: body.note || ''
    });

    const excelBuffer = await generateExcelBuffer(order);
    const msg = buildTelegramMessage(order);

    await bot.sendMessage(CHAT_ID, msg);
    await bot.sendDocument(CHAT_ID, excelBuffer, {}, {
      filename: `order-${order.order_code}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    res.json({ ok: true, order_code: order.order_code });
  } catch (err) {
    console.error('❌ خطا در پردازش سفارش:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = (req, res) => app(req, res);
