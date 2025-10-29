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


// مسیر فایل ذخیره شمارنده سفارش‌ها
const counterFile = path.join('/tmp', 'order_count.txt');

// تابع دریافت عدد بعدی کد سفارش (افزایشی واقعی)
function getNextOrderNumber() {
  let count = 0;
  try {
    if (fs.existsSync(counterFile)) {
      count = parseInt(fs.readFileSync(counterFile, 'utf8')) || 0;
    }
  } catch {}
  count++;
  fs.writeFileSync(counterFile, String(count));
  return count;
}

// تبدیل به فرمت شمسی
function toPersianDateTime(dateStr) {
  const date = new Date(dateStr);
  const faDate = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    dateStyle: 'medium',
  }).format(date);
  const faTime = new Intl.DateTimeFormat('fa-IR', {
    timeStyle: 'short',
  }).format(date);
  return `${faDate} - ${faTime}`;
}

// تولید فایل اکسل منظم
async function generateExcelBuffer(order) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('سفارش جدید');

  sheet.columns = [
    { header: 'عنوان', key: 'field', width: 25 },
    { header: 'مقدار', key: 'value', width: 45 }
  ];

  const rows = [
    ['کد سفارش', order.order_code],
    ['تاریخ ثبت (شمسی)', toPersianDateTime(order.created_at)],
    ['نام و نام خانوادگی', order.name],
    ['شماره تماس', order.phone],
    ['آدرس گیرنده', order.address],
    ['کد پستی', order.postal_code || '—'],
    ['توضیحات', order.notes || '—'],
    [],
    ['محصولات سفارش‌شده', '']
  ];

  rows.forEach(r => sheet.addRow({ field: r[0], value: r[1] }));

  let products = [];
  try {
    products = JSON.parse(order.products_json || '[]');
  } catch {
    products = [];
  }

  sheet.addRow({ field: 'تعداد', value: 'نام محصول' });
  products.forEach(p => {
    if (Number(p.quantity) > 0)
      sheet.addRow({ field: `${p.quantity} ${p.unit}`, value: p.name });
  });

  sheet.getRow(1).font = { bold: true };
  sheet.getColumn('field').alignment = { horizontal: 'right' };
  sheet.getColumn('value').alignment = { horizontal: 'left' };
  sheet.eachRow(r => (r.height = 22));

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

// ساخت پیام تلگرام زیبا
function buildTelegramMessage(order) {
  let products = [];
  try {
    products = JSON.parse(order.products_json || '[]');
  } catch {
    products = [];
  }

  const lines = [];
  lines.push('📦 سفارش جدید محصولات سُها');
  lines.push('');
  lines.push(`👤 نام: ${order.name}`);
  lines.push(`📞 تماس: ${order.phone}`);
  lines.push(`🏠 آدرس: ${order.address}`);
  if (order.postal_code) lines.push(`📮 کد پستی: ${order.postal_code}`);
  lines.push('');
  lines.push('🧾 محصولات سفارش‌شده:');
  products.forEach(p => {
    if (Number(p.quantity) > 0)
      lines.push(`• ${p.name} – ${p.quantity} ${p.unit}`);
  });
  lines.push('');
  lines.push(`🕓 تاریخ ثبت: ${toPersianDateTime(order.created_at)}`);
  lines.push(`🔢 کد سفارش: ${order.order_code}`);

  return lines.join('\n');
}

// تنظیم پارسر برای JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// دریافت سفارش از فرم HTML
app.post('/api/order', async (req, res) => {
  try {
    const body = req.body;

    const order_code = 'ORD-' + String(getNextOrderNumber()).padStart(6, '0');
    const created_at = new Date().toISOString();

    const order = {
      order_code,
      name: body.name || '',
      phone: body.phone || '',
      address: body.address || '',
      postal_code: body.postal_code || '',
      notes: body.note || '',
      products_json: JSON.stringify([
        { name: 'سها ۵۰۰ گرمی سبز', quantity: Number(body.saha500_qty || 0), unit: body.saha500_unit || '' },
        { name: 'سها ۲۵۰ گرمی ساشه', quantity: Number(body.saha250_qty || 0), unit: body.saha250_unit || '' },
        { name: 'باکس پوچ یک کیلویی', quantity: Number(body.box1kg_qty || 0), unit: body.box1kg_unit || '' },
        { name: 'پاکت طلایی پنجره‌دار', quantity: Number(body.goldPack_qty || 0), unit: body.goldPack_unit || '' },
        { name: 'پاکت یک کیلویی ساده', quantity: Number(body.plainPack_qty || 0), unit: body.plainPack_unit || '' }
      ].filter(p => p.quantity > 0)),
      created_at
    };
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
