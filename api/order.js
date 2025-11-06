export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method Not Allowed" });
  }

  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!TOKEN || !CHAT_ID) {
    return res.status(500).json({ ok: false, message: "توکن یا چت آیدی تنظیم نشده است" });
  }

  const { name, phone, address, postalCode, products = [], notes } = req.body;

  // تبدیل نام محصولات به نسخه مختصر
  const normalizeProductName = (title = "") => {
    return title
      .replace("بسته ۵۰۰ گرمی سبز سها", "۵۰۰ گرمی سبز سها")
      .replace("جعبه ۲۵۰ گرمی ساشه‌ی سها", "۲۵۰ گرمی ساشه")
      .replace("بسته یک کیلویی معمولی", "یک کیلویی معمولی")
      .replace("بسته یک کیلویی باکس پوچ", "یک کیلویی باکس پوچ")
      .replace("بسته ۵۰۰ گرمی پاکت طلایی پنجره دار", "۵۰۰ گرمی پاکت طلایی پنجره‌دار");
  };

  // ساخت لیست سفارشات مرتب
  let details = "";
  products.forEach(p => {
    const q = Number(p.quantity || 0);
    if (q > 0) {
      details += `• ${q} ${p.choice || ""} ${normalizeProductName(p.title)}\n`;
    }
  });

  if (!details.trim()) details = "- هیچ محصولی انتخاب نشده -";

  // زمان واقعی
  const now = new Date();
  const fa = new Intl.DateTimeFormat("fa-IR", { dateStyle: "full" }).format(now);
  const time = now.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });

  const message = 
`🟢 سفارش جدید ثبت شد

👤 نام مشتری:
${name || "-"}

📞 شماره تماس:
${phone || "-"}

🏠 آدرس:
${address || "-"}

📮 کد پستی:
${postalCode || "-"}

━━━━━━━━━━━━━━
📦 جزئیات سفارش:
${details}
━━━━━━━━━━━━━━

📝 توضیحات:
${notes || "-"}

⏱ زمان ثبت:
${fa} | ساعت ${time}
`;

  try {
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: "HTML"
      })
    });

    return res.status(200).json({ ok: true, message: "OK" });
  } catch (e) {
    return res.status(500).json({ ok: false, message: "خطا در ارسال پیام" });
  }
}
