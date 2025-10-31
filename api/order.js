require('dotenv').config();
const express = require('express');
const ExcelJS = require('exceljs');
const Database = require('better-sqlite3');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

const app = express();

const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID || process.env.TELEGRAM_CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  console.error('❌ لطفاً BOT_TOKEN و CHAT_ID را در تنظیمات Vercel تعریف کنید.');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

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
  const sheet = workbook.addWorksheet('سفارش مشتری');

  sheet.mergeCells('A1:F1');
  const title = sheet.getCell('A1');
  title.value = '📦 فاکتور ثبت سفارش محصولات سُها';
  title.font = { bold: true, size: 14 };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 30;

  sheet.addRow(['نام و نام خانوادگی', 'شماره تماس', 'آدرس گیرنده', 'کد پستی', 'توضیحات', 'تاریخ ثبت']);
  sheet.getRow(2).font = { bold: true };
  sheet.getRow(2).alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(2).height = 22;

  const infoRow = [
    order.name,
    order.phone,
    order.address,
    order.postal_code || '—',
    order.notes || '—',
    toPersianDateTime(order.created_at)
  ];
  sheet.addRow(infoRow);

  sheet.addRow([]);
  const productsTitleRow = sheet.addRow(['محصولات سفارش‌شده']);
  productsTitleRow.font = { bold: true, size: 12 };
  sheet.mergeCells(`A${sheet.lastRow.number}:F${sheet.lastRow.number}`);
  productsTitleRow.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.addRow([]);

  sheet.addRow(['ردیف', 'نام محصول', 'تعداد', 'واحد']);
  sheet.getRow(sheet.lastRow.number).font = { bold: true };
  sheet.getRow(sheet.lastRow.number).alignment = { horizontal: 'center' };

  let products = [];
  try {
    products = JSON.parse(order.products_json || '[]');
    if (!Array.isArray(products)) products = [];
  } catch {
    products = [];
  }

  products.forEach((p, i) => {
    if (Number(p.quantity) > 0) {
      sheet.addRow([i + 1, p.name, p.quantity, p.unit]);
    }
  });

  sheet.addRow([]);
  sheet.addRow(['کد سفارش', order.order_code]);
  sheet.getRow(sheet.lastRow.number).font = { bold: true };

  sheet.columns = [
    { width: 8 },
    { width: 35 },
    { width: 12 },
    { width: 12 },
    { width: 25 },
    { width: 25 }
  ];

  sheet.eachRow(row => {
    row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    row.height = 24;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

// ✅ فقط پیام تلگرام اصلاح شده (اضافه شدن کد پستی)
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
  lines.push(`👤 نام: ${order.name}`);
  lines.push(`📞 تماس: ${order.phone}`);
  lines.push(`🏠 آدرس: ${order.address}`);
  if (order.postal_code) lines.push(`📮 کد پستی: ${order.postal_code}`);
  lines.push('');
  lines.push('🧾 سفارش:');
  products.forEach(p => {
    if (Number(p.quantity) > 0) {
      lines.push(`_ ${p.name} – ${p.quantity} ${p.unit}`);
    }
  });
  lines.push('');
  if (order.notes) {
    lines.push('📝 توضیحات:');
    lines.push(order.notes);
    lines.push('');
  }

  lines.push(`🕓 زمان ثبت: ${toPersianDateTime(order.created_at)}`);
  lines.push(`🔢 کد سفارش: ${order.order_code}`);

  return lines.join('\n');
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

    const excelBuffer = await generateExcelBuffer(saved);
    const messageText = buildTelegramMessage(saved);

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

module.exports = (req, res) => {
  app(req, res);
};
