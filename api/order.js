let orderCounter = 0; // شمارنده سفارش‌ها

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

  const { name, phone, address, postalCode, products = [], notes } = req.body;

  // شمارنده واقعی +1
  orderCounter++;

  // تاریخ و روز هفته شمسی
  const now = new Date();
  const dateFa = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);

  const weekdayFa = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    weekday: "long",
  }).format(now);

  // ساخت متن محصولات
  let productList = "";
  products.forEach((p) => {
    if (p.quantity > 0) {
      const type =
        p.choice === "carton" ? "کارتن 📦" :
        p.choice === "pack" ? "بسته 🛍" : "";
      productList += `• _${p.quantity} ${type} از ${p.title}_\n`;
    }
  });

  if (!productList.trim()) productList = "_هیچ محصولی انتخاب نشده_";

  // متن پیام نهایی برای تلگرام
  const text =
`🎉 <b>سفارش جدید ثبت شد</b> 🎉

👤 <b>نام:</b> ${name || "-"}
📞 <b>تماس:</b> ${phone || "-"}
🏡 <b>آدرس:</b> ${address || "-"}
📮 <b>کد پستی:</b> ${postalCode || "-"}

🛒 <b>محصولات سفارش داده شده:</b>
${productList}

📝 <b>توضیحات:</b>
${notes || "-"}

⏱ <b>زمان ثبت سفارش:</b>
${dateFa} - ${weekdayFa}

🔢 <b>شماره سفارش:</b> ${orderCounter}
`;

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
      return res.status(500).json({ ok: false, message: "Telegram error" });
    }

    return res.status(200).json({ ok: true, message: "✅ سفارش با موفقیت ارسال شد" });
  } catch (err) {
    return res.status(500).json({ ok: false, message: "خطا در ارسال به تلگرام" });
  }
}
￼Enter
