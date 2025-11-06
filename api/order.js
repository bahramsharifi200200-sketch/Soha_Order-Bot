export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method Not Allowed" });
  }

  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  const { name, phone, address, postalCode, products = [], notes } = req.body;

  const datetime = new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Tehran"
  }).format(new Date());

  // ✅ نقشه‌ی نام محصولات به نسخه کوتاه و رسمی
  const shortNames = {
    "بسته ۵۰۰ گرمی سبز سها": "۵۰۰ گرمی سبز سها",
    "جعبه ۲۵۰ گرمی ساشه‌ی سها": "۲۵۰ گرمی ساشه",
    "بسته ۵۰۰ گرم پاکت طلایی پنجره دار": "پاکت طلایی پنجره دار",
    "بسته یک کیلویی باکس پوچ": "۱ کیلویی باکس پوچ",
    "بسته یک کیلویی معمولی": "۱ کیلویی معمولی"
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

  const message = `
╔══════════════════╗
     📦 *سفارش جدید ثبت شد*
╚══════════════════╝

👤 *نام مشتری:* ${name}
📞 *تماس:* ${phone}
🏠 *آدرس:* ${address || "—"}
📮 *کد پستی:* ${postalCode || "—"}

━━━ *جزئیات سفارش* ━━━
${productList.trim()}

━━━ *توضیحات* ━━━
${notes || "—"}

⏱ *زمان ثبت:* 
${datetime}
`.trim();

  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: message,
      parse_mode: "Markdown"
    })
  });

  return res.status(200).json({ ok: true, message: "✅ ثبت و ارسال موفق" });
}
