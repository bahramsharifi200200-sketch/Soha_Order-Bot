export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { name, phone, address, postalCode, products, notes } = req.body;

  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  const URL = `https://api.telegram.org/bot${TOKEN}/sendMessage`;

  // تاریخ و زمان واقعی تهران
  const formatter = new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Tehran"
  });
  const datetime = formatter.format(new Date());

  // ساخت بخش سفارشات
  const productLines = products
    .filter(p => p.qty > 0 || p.quantity > 0)
    .map(p => {
      const qty = p.qty || p.quantity;
      const choice = p.type || p.choice;
      return `🔹 ${qty} × ${p.name || p.title} (${choice === "carton" ? "کارتن" : "بسته"})`;
    })
    .join("\n");

  const msg = `
╔══════════════════════╗
   🌿 *سفارش جدید ثبت شد* 🌿
╚══════════════════════╝

👤 *نام مشتری:*  ${name}
📱 *شماره تماس:*  ${phone}
🏠 *آدرس:*  ${address || "—"}
📮 *کد پستی:*  ${postalCode || "—"}

━━━━━━━━━━━━━━

🛒 *جزئیات سفارش:*
${productLines || "بدون انتخاب"}

━━━━━━━━━━━━━━

📝 *توضیحات مشتری:*
${notes || "—"}

⏱ *زمان ثبت:*  
${datetime}

#سفارش_جدید ✅
`.trim();

  try {
    await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: msg,
        parse_mode: "Markdown"
      })
    });

    return res.status(200).json({ message: "✅ سفارش با موفقیت ارسال شد" });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "❌ خطا در ارسال پیام به تلگرام" });
  }
}
