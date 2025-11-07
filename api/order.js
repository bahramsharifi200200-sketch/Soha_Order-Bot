export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method Not Allowed" });
  }

  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return res.status(500).json({
      ok: false,
      message: "⚠️ مقادیر TELEGRAM_BOT_TOKEN و TELEGRAM_CHAT_ID تنظیم نشده‌اند.",
    });
  }

  const { name, phone, address, postalCode, products = [], notes } = req.body || {};

  // ✅ تاریخ و زمان واقعی ایران به صورت لوکس
  const now = new Date().toLocaleString("fa-IR", {
    timeZone: "Asia/Tehran",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  const escape = s => String(s || "").replace(/[<&>]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));

  // ✅ نوع بسته‌بندی: cartن → کارتن | pack → بسته
  const typeLabel = (t) => t === "carton" ? "کارتن" : (t === "pack" ? "بسته" : "—");

  // ✅ ساخت لیست VIP محصولات
  let productList = "";
  products.forEach((p) => {
    const qty = Number(p.quantity || 0);
    if (qty > 0) {
      productList += `▫️ <b>${escape(p.title)}</b> — <b>${qty} ${typeLabel(p.choice)}</b>\n`;
    }
  });
  if (!productList.trim()) productList = "— هیچ محصولی انتخاب نشده —";

  // ✅ نسخه لوکس پیام
  const text =
`💎 <b>سفارش جدید مشتری</b>

📍 <b>زمان ثبت:</b> ${escape(now)}

👤 <b>مشخصات مشتری:</b>
• نام: <b>${escape(name)}</b>
• موبایل: <b>${escape(phone)}</b>
• آدرس: ${escape(address || "-")}
• کد پستی: ${escape(postalCode || "-")}

🍃 <b>اقلام سفارش:</b>
${productList}

📝 <b>توضیحات مشتری:</b>
${escape(notes || "—")}

━━━━━━━━━━━━━━
🌿 <b>سها | هدیه‌ای از دل طبیعت</b>`;

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: "HTML",
      }),
    });

    const result = await tgRes.json();
    if (!result.ok) {
      return res.status(500).json({ ok: false, message: result.description });
    }

    return res.status(200).json({ ok: true, message: "✅ سفارش با موفقیت ثبت شد" });

  } catch (err) {
    return res.status(500).json({ ok: false, message: "❌ خطا در ارتباط با تلگرام" });
  }
}
