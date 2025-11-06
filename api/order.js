export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method Not Allowed" });
  }

  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return res.status(500).json({
      ok: false,
      message: "⚠️ توکن یا چت آیدی در Vercel تنظیم نشده"
    });
  }

  const { name, phone, address, postalCode, products = [], notes } = req.body;

  // فرمت زمان واقعی ایران
  const datetime = new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Tehran"
  }).format(new Date());

  let productText = "";

  products.forEach(p => {
    if (Number(p.quantity) > 0) {
      productText += `🔹 *${p.quantity}×* ${p.title} (${p.choice === "carton" ? "کارتن" : "بسته"})\n`;
    }
  });

  if (!productText) productText = "‌— هیچ محصولی انتخاب نشده —";

  const text = `
🟢 *سفارش جدید ثبت شد*

👤 *نام:* ${name}
📞 *تماس:* ${phone}
🏠 *آدرس:* ${address}
📮 *کد پستی:* ${postalCode}

🛍 *جزئیات سفارش:*
${productText}

📝 *توضیحات:* ${notes || "—"}
⏱ *زمان ثبت:* ${datetime}
`.trim();

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const send = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: "Markdown"
      })
    });

    const result = await send.json();
    
    if (!result.ok) {
      return res.status(500).json({ ok: false, message: "Telegram Error", error: result });
    }

    return res.status(200).json({ ok: true, message: "✅ سفارش با موفقیت ارسال شد" });

  } catch (err) {
    return res.status(500).json({ ok: false, message: "خطای اتصال به تلگرام", error: err });
  }
}
