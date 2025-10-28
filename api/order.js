// api/order.js
import XLSX from "xlsx";

const BOT_TOKEN = process.env.BOT_TOKEN;   // توکن ربات تلگرام از تنظیمات Vercel
const CHAT_ID = process.env.CHAT_ID;       // آیدی گروه تلگرام از تنظیمات Vercel

// 📌 دریافت پیام پین‌شده برای خواندن آخرین شماره سفارش
async function getPinnedOrderNumber() {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/getChat?chat_id=${CHAT_ID}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!json.ok) return { lastNumber: 0, pinnedId: null };

  const pinned = json.result?.pinned_message;
  if (!pinned || !pinned.text) return { lastNumber: 0, pinnedId: null };

  const match = pinned.text.match(/(\d+)/);
  const lastNumber = match ? parseInt(match[1]) : 0;
  return { lastNumber, pinnedId: pinned.message_id };
}

// 📌 بروزرسانی پیام پین‌شده با شماره جدید
async function updatePinnedMessage(messageId, newNumber) {
  const text = `🔢 آخرین کد سفارش: ${newNumber}`;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      message_id: messageId,
      text
    })
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ ok: false, message: "Method Not Allowed" });

  try {
    const data = req.body;

    // 1️⃣ دریافت آخرین شماره سفارش از تلگرام
    const { lastNumber, pinnedId } = await getPinnedOrderNumber();
    const newNumber = lastNumber + 1;
    const orderCode = `ORD-${String(newNumber).padStart(6, "0")}`;

    // 2️⃣ ساخت متن پیام سفارش برای تلگرام
    const msg =
`📦 سفارش جدید ثبت شد!
🔢 کد سفارش: ${orderCode}

👤 نام: ${data.name || "-"}
📞 شماره: ${data.phone || "-"}
🛍 محصولات:
${data.products || "-"}
${data.notes ? `📝 توضیحات: ${data.notes}\n` : ""}
📅 تاریخ ثبت: ${new Date().toLocaleString("fa-IR")}`;

    // 3️⃣ ارسال پیام سفارش به گروه تلگرام
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: msg
      })
    });

    // 4️⃣ بروزرسانی پیام پین‌شده با شماره جدید
    if (pinnedId) {
      await updatePinnedMessage(pinnedId, newNumber);
    }

    // 5️⃣ ساخت فایل اکسل از سفارش
    const row = [{
      orderCode,
      name: data.name,
      phone: data.phone,
      products: data.products,
      notes: data.notes || "",
      created_at: new Date().toISOString()
    }];
    const ws = XLSX.utils.json_to_sheet(row);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");
    const wbout = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const base64 = Buffer.from(wbout).toString("base64");
    const downloadLink = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;

    // 6️⃣ پاسخ به مرورگر
    return res.status(200).json({
      ok: true,
      order_code: orderCode,
      download: downloadLink
    });

  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({
      ok: false,
      message: "Internal Server Error",
      error: String(error)
    });
  }
}
