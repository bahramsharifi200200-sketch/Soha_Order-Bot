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

  // ✅ تاریخ و زمان دقیق ایران
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

  const weekday = fa.find(p => p.type === "weekday")?.value || "";
  const year = fa.find(p => p.type === "year")?.value || "";
  const month = fa.find(p => p.type === "month")?.value || "";
  const day = fa.find(p => p.type === "day")?.value || "";
  const hour = fa.find(p => p.type === "hour")?.value || "";
  const minute = fa.find(p => p.type === "minute")?.value || "";
  const timeString = `${weekday}  |  ${year}/${month}/${day}  |  ساعت ${hour}:${minute}`;

  // ✅ نام محصولات کوتاه
  const rename = (title) =>
    title
      .replace("بسته ۵۰۰ گرمی سبز سها", "۵۰۰ گرمی سبز سها")
      .replace("جعبه ۲۵۰ گرمی ساشه‌ی سها", "جعبه ۲۵۰ گرمی سها")
      .replace("بسته یک کیلویی باکس پوچ", "یک کیلویی باکس پوچ")
      .replace("بسته ۵۰۰ گرمی پاکت طلایی پنجره دار", "۵۰۰ گرمی پاکت طلایی")
      .replace("بسته یک کیلویی معمولی (ساده)", "یک کیلویی معمولی");

  // ✅ نوع بسته‌بندی
  const typeLabel = t => t === "carton" ? "کارتن" : t === "pack" ? "بسته" : "";

  // ✅ جلوگیری از مشکل کاراکترهای HTML
  const escape = (s) => String(s || "").replace(/[<&>]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));

  // ✅ محصولات تک‌خطی + شیک
  let productList = "";
  products.forEach((p) => {
    const qty = Number(p.quantity || 0);
    if (qty > 0) {
      productList += `• ${escape(rename(p.title))} — ${qty} ${typeLabel(p.choice)}\n`;
    }
  });
  if (!productList.trim()) productList = "— هیچ محصولی انتخاب نشده —";

  // ✅ قالب (Glass UI)
  const text =
`┌──────────────────────────────┐
        💎<b> سفارش جدید ثبت شد </b>💎
└──────────────────────────────┘

<b>👤 اطلاعات مشتری</b>
• نام: <b>${escape(name)}</b>
• تماس: <b>${escape(phone)}</b>
• آدرس: ${escape(address || "—")}
• کد پستی: ${escape(postalCode || "—")}

<b>🛍 سبد خرید مشتری</b>
${productList}

<b>📝 توضیحات مشتری</b>
${escape(notes || "—")}

<b>⏱ زمان ثبت سفارش</b>
${timeString}

꧁  <b>سـهـا | از دل طبیعت تا جان شما</b>  ꧂`;

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
