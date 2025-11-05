// api/order.js

let orderCount = 0; // شمارنده سفارش‌ها (اگر ریست نشود بهتر در DB ذخیره شود)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { name, phone, address, postalCode, products, notes } = req.body;

  // شمارنده سفارش +1
  orderCount++;

  // زمان واقعی ایران
  const date = new Date().toLocaleString("fa-IR", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit"
  });

  // ساخت متن سفارش محصولات
  const productsText = products
    .filter(p => p.quantity && p.choice)
    .map(p => `${p.title} → تعداد ${p.quantity} (${p.choice === "carton" ? "کارتن" : "بسته"})`)
    .join("\n");

  // متن نهایی برای تلگرام
  const message = `
💁 سفارش جدید ثبت شد

👤 نام: ${name}
📱 تماس: ${phone}
🏠 آدرس گیرنده: ${address || "—"}
✉️ کد پستی: ${postalCode || "—"}

🛍 سفارش‌ها:
${productsText || "هیچ مورد انتخاب نشده"}

📝 توضیحات:
${notes || "—"}

⏱ زمان ثبت: ${date}
#️⃣ شماره سفارش: ${orderCount}
  `.trim();


  //  ✅ ارسال به تلگرام
  try {
    await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        chat_id: process.env.CHAT_ID,
        text: message
      })
    });
  } catch (err) {
    console.error("خطا در ارسال پیام به تلگرام:", err);
  }

  return res.status(200).json({
    ok: true,
    message: "✅ سفارش با موفقیت ثبت و ارسال شد",
    orderNumber: orderCount
  });
}
