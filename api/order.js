export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ ok: false, message: "Method Not Allowed" });

  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return res.status(500).json({
      ok: false,
      message: "⚠️ توکن یا چت آیدی تلگرام تنظیم نشده!",
    });
  }

  const { name, phone, address, postalCode, products, notes } = req.body;

  let productList = "";
  products.forEach((p) => {
    if (p.quantity > 0) {
      productList += `• ${p.title}
  تعداد: ${p.quantity}
  نوع بسته‌بندی: ${p.choice ? p.choice : "-"}\n\n`;
    }
  });

  const text = `
📦 *سفارش جدید ثبت شد* ✅

👤 *نام:* ${name}
📱 *شماره تماس:* ${phone}
🏠 *آدرس:* ${address || "-"}
✉️ *کد پستی:* ${postalCode || "-"}

🍃 *محصولات سفارش داده شده:* 
${productList || "بدون انتخاب محصول"}

📝 *توضیحات:* ${notes || "-"}
  `;

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: "Markdown",
    }),
  });

  return res.status(200).json({ ok: true, message: "✅ سفارش ثبت و ارسال شد" });
}
￼Enter
