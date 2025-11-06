export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method Not Allowed" });
  }

  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  const { name, phone, address, postalCode, products = [], notes } = req.body;

  // زمان ایران دقیق
  const date = new Date();
  const fa = new Intl.DateTimeFormat("fa-IR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Tehran"
  }).format(date);

  const time = new Intl.DateTimeFormat("fa-IR", {
    timeStyle: "short",
    timeZone: "Asia/Tehran"
  }).format(date);

  const datetime = `${fa}  |  ساعت  ${time}`;

  // مختصر کردن نام محصولات
  const shortNames = {
    "جعبه ۲۵۰ گرمی ساشه‌ی سها": "۲۵۰ گرمی ساشه",
    "بسته ۵۰۰ گرم پاکت طلایی پنجره دار": "۵۰۰ گرمی پاکت طلایی",
    "بسته یک کیلویی باکس پوچ": "۱ کیلویی باکس پوچ",
    "بسته یک کیلویی معمولی": "۱ کیلویی معمولی",
    "بسته ۵۰۰ گرمی سبز سها": "۵۰۰ گرمی سبز سها"
  };

  let productList = "";
  products.forEach(p => {
    if (Number(p.quantity) > 0) {
      const cleanName = shortNames[p.title] || p.title;
      const typeText = p.choice === "carton" ? "کارتن" : "بسته";
      productList += `• ${p.quantity} ${typeText} ${cleanName}\n`;
    }
  });

  if (!productList.trim()) productList = "— هیچ محصولی انتخاب نشده —";

  // پیام نهایی با HTML + فاصله‌دهی استاندارد و بدون به‌هم‌ریختگی
  const message = `
<pre>
╔══════════════🌿══════════════╗
           🧾 سفارش جدید ثبت شد
╚══════════════🌿══════════════╝
</pre>

<b>👤 نام مشتری:</b>
${name}

<b>📞 شماره تماس:</b>
${phone}

<b>🏠 آدرس:</b>
${address || "—"}

<b>📮 کد پستی:</b>
${postalCode || "—"}

<b>━━━ جزئیات سفارش ━━━</b>
${productList.trim()}

<b>💬 توضیحات:</b>
${notes || "—"}

<b>⏱ زمان ثبت:</b>
${datetime}
  `.trim();

  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: message,
      parse_mode: "HTML"
    })
  });

  return res.status(200).json({ ok: true, message: "✅ ارسال شد" });
}
