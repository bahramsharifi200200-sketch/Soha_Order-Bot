export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method Not Allowed" });
  }

  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return res.status(500).json({
      ok: false,
      message: "⚠️ TELEGRAM_BOT_TOKEN یا TELEGRAM_CHAT_ID در Vercel تنظیم نشده‌اند.",
    });
  }

  let body;
  try {
    body = req.body || {};
  } catch (err) {
    return res.status(400).json({ ok: false, message: "Bad request body" });
  }

  const { name, phone, address, postalCode, products = [], notes } = body;

  // تابع ساده برای جلوگیری از مشکل کاراکترهای خاص در HTML
  const escapeHtml = (s = "") =>
    String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");

  // ساخت لیست محصولات فقط اگر تعداد بیشتر از 0 باشد
  let productList = "";
  products.forEach((p) => {
    const qty = Number(p.quantity || 0);
    if (qty > 0) {
      productList += `• ${escapeHtml(p.title)}\nتعداد: ${qty}\nنوع بسته‌بندی: ${escapeHtml(p.choice || "-")}\n\n`;
    }
  });

  const text = `<b>📦 سفارش جدید ثبت شد</b>\n\n` +
    `<b>👤 نام:</b> ${escapeHtml(name || "-")}\n` +
    `<b>📱 شماره تماس:</b> ${escapeHtml(phone || "-")}\n` +
    `<b>🏠 آدرس:</b> ${escapeHtml(address || "-")}\n` +
    `<b>✉️ کد پستی:</b> ${escapeHtml(postalCode || "-")}\n\n` +
    `<b>🍃 محصولات:</b>\n${productList ? escapeHtml(productList) : "- هیچ محصولی انتخاب نشده -"}\n` +
    `\n<b>📝 توضیحات:</b>\n${escapeHtml(notes || "-")}`;

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const tgRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: "HTML",
      }),
    });

    const tgJson = await tgRes.json();
    if (!tgJson.ok) {
      // پاسخ تلگرام خطا داده
      return res.status(500).json({ ok: false, message: "Telegram error: " + (tgJson.description || "unknown") });
    }

    return res.status(200).json({ ok: true, message: "✅ سفارش با موفقیت ارسال شد" });
  } catch (err) {
    console.error("Send to Telegram error:", err);
    return res.status(500).json({ ok: false, message: "خطا در ارسال به تلگرام" });
  }
}
