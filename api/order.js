export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method Not Allowed" });
  }

  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return res.status(500).json({
      ok: false,
      message: "⚠️ TELEGRAM_BOT_TOKEN یا TELEGRAM_CHAT_ID تنظیم نشده‌اند.",
    });
  }

  const { name, phone, address, postalCode, products = [], notes } = req.body || {};

  const escape = (txt = "") =>
    String(txt).replace(/</g, "&lt;").replace(/>/g, "&gt;");

  let productList = "";
  products.forEach((p) => {
    if (Number(p.quantity) > 0) {
      productList += `• ${escape(p.title)} (${escape(p.choice || "-")}) — تعداد: ${p.quantity}\n`;
    }
  });

  const text =
`╔══════════════🌿══════════════╗
          📦 سفارش جدید ثبت شد
╚══════════════🌿══════════════╝

👤 نام مشتری:
*${escape(name || "-")}*

📞 شماره تماس:
*${escape(phone || "-")}*

🏠 آدرس:
*${escape(address || "-")}*

📮 کد پستی:
*${escape(postalCode || "-")}*

━━━━━━━━ جزئیات سفارش ━━━━━━━━
${productList || "• هیچ محصولی ثبت نشده است"}

💬 توضیحات مشتری:
${escape(notes || "—")}

⏱ زمان ثبت سفارش:
${new Date().toLocaleString("fa-IR")}
`;

  try {
    const tg = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: "Markdown",
      }),
    });

    const json = await tg.json();
    if (!json.ok) return res.status(500).json({ ok: false, message: json.description });

    return res.status(200).json({ ok: true, message: "✅ سفارش با موفقیت ارسال شد" });

  } catch (e) {
    return res.status(500).json({ ok: false, message: "خطا در ارسال به تلگرام" });
  }
}
