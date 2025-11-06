export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method Not Allowed" });
  }

  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!TOKEN || !CHAT_ID) {
    return res.status(500).json({ ok: false, message: "توکن یا چت آیدی تنظیم نشده" });
  }

  const { name, phone, address, postalCode, products = [], notes } = req.body;

  // نام‌ های مختصر محصولات
  const mapNames = {
    "جعبه ۲۵۰ گرمی ساشه‌ی سها": "۲۵۰ گرمی ساشه",
    "بسته ۵۰۰ گرم پاکت طلایی پنجره دار": "۵۰۰ گرمی پاکت طلایی",
    "بسته یک کیلویی باکس پوچ": "۱ کیلویی باکس پوچ",
    "بسته یک کیلویی معمولی": "۱ کیلویی معمولی",
    "بسته ۵۰۰ گرمی سبز سها": "۵۰۰ گرمی سبز سها"
  };

  // لیست سفارش‌ها
  let details = "";
  products.forEach(p => {
    const qty = Number(p.quantity || 0);
    if (qty > 0) {
      const type = p.choice === "carton" ? "کارتن" : "بسته";
      const nameShort = mapNames[p.title] || p.title;
      details += `• ${qty} ${type} ${nameShort}\n`;
    }
  });

  if (!details.trim()) details = "— ثبت نشده —";

  // زمان دقیق
  const now = new Date();
  const dateFa = new Intl.DateTimeFormat("fa-IR", { dateStyle: "full" }).format(now);
  const timeFa = new Intl.DateTimeFormat("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(now);

  const message = 
`┏━━━━━━━━━━━🌿━━━━━━━━━━━┓
       سفارش جدید ثبت شد
┗━━━━━━━━━━━🌿━━━━━━━━━━━┛

👤 نام مشتری:
${name || "-"}

📞 شماره تماس:
${phone || "-"}

🏠 آدرس:
${address || "-"}

📮 کد پستی:
${postalCode || "-"}

━━━━━━━━━━━━━━━━━━
📦 جزئیات سفارش:
${details.trim()}
━━━━━━━━━━━━━━━━━━

📝 توضیحات:
${notes || "-"}

⏱ زمان ثبت:
${dateFa} | ساعت ${timeFa}
`;

  try {
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message
      })
    });

    return res.status(200).json({ ok: true, message: "✅ ارسال شد" });

  } catch (error) {
    return res.status(500).json({ ok: false, message: "خطا در ارسال", error });
  }
}
