// order.js
require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer'); // برای دریافت فرم multipart (اگر لازم باشه)
const ExcelJS = require('exceljs');
const Database = require('better-sqlite3');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const upload = multer(); // بدون storage (روش ساده برای دریافت form-data)
const PORT = process.env.PORT || 3000;
const EXPORT_DIR = process.env.EXPORT_DIR || path.join(__dirname, 'exports');

if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
  console.error('لطفاً TELEGRAM_BOT_TOKEN و TELEGRAM_CHAT_ID را در .env تنظیم کن.');
  process.exit(1);
}

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

// پوشه‌ی خروجی اکسل
if (!fs.existsSync(EXPORT_DIR)) fs.mkdirSync(EXPORT_DIR, { recursive: true });

// راه‌اندازی SQLite (فایل local)
const db = new Database(path.join(__dirname, 'orders.db'));

// ایجاد جدول‌ها (یک‌بار)
db.exec(`
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_code TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  address TEXT,
  postal_code TEXT,
  products_json TEXT,
  notes TEXT,
  created_at TEXT
);
`);

// تابع کمکی برای ساختن کد ORD-000001
function formatOrderCode(num) {
  return 'ORD-' + String(num).padStart(6, '0');
}

// ذخیره سفارش و گرفتن id جدید به صورت اتمیک
function createOrder(data) {
  const created_at = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO orders (order_code, first_name, last_name, phone, address, postal_code, products_json, notes, created_at)
    VALUES (@order_code, @first_name, @last_name, @phone, @address, @postal_code, @products_json, @notes, @created_at)
  `);

  // برای گرفتن شماره افزایشی از AUTOINCREMENT پایگاه استفاده می‌کنیم:
  // ابتدا یک ردیف موقت با order_code=NULL ثبت می‌کنیم تا id اختصاص یابد،
  // سپس order_code را بر اساس id بروز می‌کنیم.
  const insertTemp = db.prepare(`INSERT INTO orders (order_code, first_name, last_name, phone, address, postal_code, products_json, notes, created_at)
    VALUES (NULL, @first_name, @last_name, @phone, @address, @postal_code, @products_json, @notes, @created_at)`);
  const info = insertTemp.run({
    first_name: data.first_name,
    last_name: data.last_name,
    phone: data.phone,
    address: data.address,
    postal_code: data.postal_code || '',
    products_json: data.products_json,
    notes: data.notes || '',
    created_at
  });

  const id = info.lastInsertRowid;
  const order_code = formatOrderCode(id);

  const update = db.prepare(`UPDATE orders SET order_code = ? WHERE id = ?`);
  update.run(order_code, id);

  // برگشت اطلاعات کامل
  const row = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id);
  return row;
}

// تولید فایل اکسل برای هر سفارش
async function generateExcel(order) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Order');

  sheet.addRow(['Order Code', order.order_code]);
  sheet.addRow(['Created At', order.created_at]);
  sheet.addRow([]);
  sheet.addRow(['First Name', order.first_name]);
  sheet.addRow(['Last Name', order.last_name]);
  sheet.addRow(['Phone', order.phone]);
  sheet.addRow(['Address', order.address]);
  sheet.addRow(['Postal Code', order.postal_code || '']);
  sheet.addRow([]);
  sheet.addRow(['Products']);
  // products_json را parse کن و فقط مواردی که مقدار >0 دارند بنویس
  let products;
  try {
    products = JSON.parse(order.products_json || '[]');
    if (!Array.isArray(products)) products = [];
  } catch (e) {
    products = [];
  }

  // header
  sheet.addRow(['Qty', 'Unit', 'Product Name', 'Extra Info']);
  products.forEach(p => {
    // انتظار: { name, quantity, unit, extra }
    const qty = p.quantity ?? '';
    const unit = p.unit ?? '';
    const name = p.name ?? '';
    const extra = p.extra ?? '';
    if (qty !== '' && Number(qty) === 0) {
      // اگر تعداد صفر است نادیده بگیر
      return;
    }
    sheet.addRow([qty, unit, name, extra]);
  });

  sheet.addRow([]);
  sheet.addRow(['Notes', order.notes || '']);

  const filename = `order-${order.order_code}.xlsx`;
  const filepath = path.join(EXPORT_DIR, filename);
  await workbook.xlsx.writeFile(filepath);
  return filepath;
}

// قالب متن تلگرام
function buildTelegramMessage(order) {
  let products;
  try {
    products = JSON.parse(order.products_json || '[]');
    if (!Array.isArray(products)) products = [];
  } catch (e) {
    products = [];
  }

  const lines = [];
  lines.push('سفارش جدید ثبت شد !');
  lines.push('');
  lines.push(`${order.first_name || ''} ${order.last_name || ''}`);
  lines.push(`شماره تماس: ${order.phone || ''}`);
  lines.push(`آدرس گیرنده: ${order.address || ''}`);
  if (order.postal_code) lines.push(`کد پستی: ${order.postal_code}`);
  lines.push('');
  lines.push('محصولات سفارش شده؛');
  products.forEach(p => {
    // نمایش فقط مواردی که quantity > 0 یا وجود دارد
    const q = p.quantity ?? '';
    if (q === '' || Number(q) === 0) return;
    // مثال نمایش: "۵۰۰ گرمی سها   50 کارتن"
    const quantityStr = String(q);
    const unit = p.unit ? ` ${p.unit}` : '';
    const name = p.name || '';
    const extra = p.extra ? ` ${p.extra}` : '';
    lines.push(`${quantityStr}${unit} ${name}${extra}`);
  });
  lines.push('');
  if (order.notes) {
    lines.push('توضیحات:');
    lines.push(order.notes);
    lines.push('');
  }
  lines.push(`زمان ثبت سفارش: ${order.created_at}`);
  lines.push(`کد سفارش: ${order.order_code}`);
  return lines.join('\n');
}

// endpoint دریافت سفارش
// فرض می‌کنیم فرم با application/x-www-form-urlencoded یا multipart/form-data ارسال می‌شود.
// محصولات را به صورت JSON در فیلد "products" ارسال کن (مثال پایین)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// POST /order
app.post('/order', upload.none(), async (req, res) => {
  try {
    // فیلدها را از req.body بگیر
    const {
      firstName, lastName, phone, address, postalCode, products, notes
    } = req.body;

    // products ممکنه JSON رشته‌ای باشه یا قبلاً آرایه
    let productsArr = [];
    if (!products) productsArr = [];
    else if (typeof products === 'string') {
      try { productsArr = JSON.parse(products); }
      catch (e) {
        // اگر parse نشد، ممکنه فرستادن چند فیلد با نام products باشد
        // در این نمونه ساده فرض می‌کنیم JSON فرستاده شده
        productsArr = [];
      }
    } else if (Array.isArray(products)) {
      productsArr = products;
    }

    const saved = createOrder({
      first_name: firstName || '',
      last_name: lastName || '',
      phone: phone || '',
      address: address || '',
      postal_code: postalCode || '',
      products_json: JSON.stringify(productsArr),
      notes: notes || ''
    });

    // تولید اکسل
    const excelPath = await generateExcel(saved);

    // ساخت پیام
    const messageText = buildTelegramMessage(saved);

    // ارسال پیام متنی
    await bot.sendMessage(process.env.TELEGRAM_CHAT_ID, messageText);

    // ارسال فایل اکسل به گروه (در صورتی که بات اجازه ارسال فایل داشته باشد)
    // node-telegram-bot-api امکان ارسال فایل از مسیر را دارد
    await bot.sendDocument(process.env.TELEGRAM_CHAT_ID, excelPath, {}, {
      filename: path.basename(excelPath),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    // پاسخ به فرانت‌اند
    res.json({
      ok: true,
      message: 'Order received',
      order_code: saved.order_code,
      excel: `/exports/${path.basename(excelPath)}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// برای دانلود فایل‌های اکسل (مسیر ساده)
app.use('/exports', express.static(EXPORT_DIR));

app.listen(PORT, () => {
  console.log(`Order server listening on port ${PORT}`);
});
