export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method Not Allowed" });
  }

  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return res.status(500).json({
      ok: false,
      message: "⚠️ تنظیمات ربات انجام نشده است.",
    });
  }

  const { name, phone, address, postalCode, products = [], notes } = req.body || {};

  const escape = (t = "") =>
    String(t).replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // ——— ساخت تاریخ دقیق شمسی با فرمت زیبا ———
  const now = new Date();
  const weekday = now.toLocaleDateString("fa-IR", { weekday: "long" });
  const day = now.toLocaleDateString("fa-IR", { day: "numeric" });
  const month = now.toLocaleDateString("fa-IR", { month: "long" });
  const year = now.toLocaleDateString("fa-IR", { year: "numeric" });
  const time = now.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });

  const finalDate = `${weekday} ، ${day} ${month} ، ${year} / ساعت ${time}`;

  // ——— ساخت لیست محصولات ———
  let productList = "";
  products.forEach((p) => {
    if (Number(p.quantity) > 0) {
      productList += `• ${escape(p.title)}\n  تعداد: ${p.quantity}\n  نوع بسته‌بندی: ${escape(p.choice || "-")}\n\n`;
    }
  });

  // ——— متن نهایی تلگرام ———
  const text =
`╔══════════════🌿══════════════╗
          📦 سفارش جدید ثبت شد
╚══════════════🌿══════════════╝

👤 نام مشتری:
${escape(name || "-")}

📞 شماره تماس:
${escape(phone || "-")}

🏠 آدرس:
${escape(address || "-")}

📮 کد پستی:
${escape(postalCode || "-")}

━━━━━━━━━━━ جزئیات سفارش ━━━━━━━━━━━
${productList.trim() || "• هیچ محصولی ثبت نشده"}

💬 توضیحات مشتری:
${escape(notes || "—")}

⏱ زمان ثبت سفارش:
${finalDate}
`;

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: "Markdown",
      }),
    });

    return res.status(200).json({ ok: true, message: "✅ سفارش ارسال شد" });

  } catch (err) {
    return res.status(500).json({ ok: false, message: "خطای ارسال پیام به تلگرام" });
  }
}
