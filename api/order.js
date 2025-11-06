export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    name,
    phone,
    address,
    postalCode,
    products,
    notes,
  } = req.body;

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!BOT_TOKEN || !CHAT_ID) {
    return res.status(500).json({ error: "Bot token or chat id missing" });
  }

  // تبدیل تاریخ به شمسی
  const now = new Date();
  const dateFa = now.toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  const timeFa = now.toLocaleTimeString("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // ساخت لیست سفارشات
  let list = "";
  products.forEach((p) => {
    if (p.count && p.count !== "0") {
      let typeLabel = p.type === "carton" ? "کارتن" : "بسته";
      list += `• ${p.count} ${typeLabel} ${p.title}\n`;
    }
  });

  if (!list.trim()) {
    list = "—";
  }

  // پیام نهایی (طرح سوم)
  const msg =
`┏━━━━━━━━━━━━━━━┓
   ✨ سفارش جدید ثبت شد ✨
┗━━━━━━━━━━━━━━━┛

👤 نام مشتری:
${name || "-"}

📞 شماره تماس:
${phone || "-"}

🏠 آدرس:
${address || "-"}

📮 کد پستی:
${postalCode || "-"}

━━━━━━━━━━━━━━━━
📦 جزئیات سفارش:
${list.trim()}
━━━━━━━━━━━━━━━━

📝 توضیحات:
${notes?.trim() || "—"}

⏱ زمان ثبت:
${dateFa} | ساعت ${timeFa}
`;

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: msg,
      parse_mode: "HTML",
    }),
  });

  return res.json({ ok: true });
}
