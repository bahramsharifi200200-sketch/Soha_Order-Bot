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

  // ✅ زمان واقعی ایران
  const now = new Date();
  const fa = new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran",
    weekday: "long",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(now);

  let weekday = fa.find(p => p.type === "weekday")?.value || "";
  let year = fa.find(p => p.type === "year")?.value || "";
  let month = fa.find(p => p.type === "month")?.value || "";
  let day = fa.find(p => p.type === "day")?.value || "";
  let hour = fa.find(p => p.type === "hour")?.value || "";
  let minute = fa.find(p => p.type === "minute")?.value || "";

  const timeString = `${weekday}  #  ${year}/${month}/${day}  #  ساعت ${hour}:${minute}`;

  // ✅ اسم کوتاه محصولات
  const rename = (title) => {
    return title
      .replace("بسته ۵۰۰ گرمی سبز سها", "۵۰۰ گرمی سبز سها")
      .replace("جعبه ۲۵۰ گرمی ساشه‌ی سها", "جعبه ۲۵۰ گرمی سها")
      .replace("بسته یک کیلویی باکس پوچ", "یک کیلویی باکس پوچ")
      .replace("بسته ۵۰۰ گرمی پاکت طلایی پنجره دار", "۵۰۰ گرمی پاکت طلایی")
      .replace("بسته یک کیلویی معمولی (ساده)", "یک کیلویی معمولی");
  };

  const typeLabel = t => t === "carton" ? "کارتن" : t === "pack" ? "بسته" : "";

  const escape = s => String(s || "").replace(/[<&>]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));

  // ✅ لیست محصولات شیشه‌ای و مینیمال
  let productList = "";
  products.forEach((p) => {
    const qty = Number(p.quantity || 0);
    if (qty > 0) {
      productList += `◽ ${escape(rename(p.title))} — <b>${qty} ${typeLabel(p.choice)}</b>\n`;
    }
  });
  if (!productList.trim()) productList = "— محصولی انتخاب نشده —";

  // ✅ پیام شیشه‌ای لوکس
  const text =
`<b>✦ سفارش جدید ثبت شد ✦</b>

<b>👤 مشخصات مشتری</b>
╰ نام: <b>${escape(name)}</b>
╰ موبایل: <b>${escape(phone)}</b>
╰ آدرس: ${escape(address || "—")}
╰ کد پستی: ${escape(postalCode || "—")}

<b>🍃 اقلام سفارش</b>
${productList}

<b>📝 توضیحات</b>
${escape(notes || "—")}

━━━━━━━━━━━━━━
<b>⏱ زمان ثبت سفارش</b>
${timeString}

<b>❖ سها | هدیه‌ای از دل طبیعت ❖</b>`;

  try {
    const tg = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: "HTML",
      }),
    });

    const out = await tg.json();
    if (!out.ok) return res.status(500).json({ ok: false, message: out.description });

    return res.status(200).json({ ok: true, message: "✅ سفارش با موفقیت ثبت شد" });

  } catch {
    return res.status(500).json({ ok: false, message: "❌ خطا در ارسال به تلگرام" });
  }
}
