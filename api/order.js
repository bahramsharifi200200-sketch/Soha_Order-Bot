import fetch from "node-fetch";
import moment from "moment-jalaali";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method Not Allowed" });
  }

  try {
    const {
      name,
      phone,
      address,
      postal,
      p250_carton,
      p250_pack,
      p500_gold_pack,
      p500_gold_carton,
      onekilo_box_pack,
      onekilo_box_carton,
      onekilo_simple_pack,
      onekilo_simple_carton,
      notes,
    } = req.body;

    // توکن و چت آی‌دی که تو ویرسل گذاشتی
    const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    // زمان شمسی دقیق
    moment.loadPersian({usePersianDigits:true});
    const nowDate = moment().format("jYYYY/jMM/jDD");
    const nowPretty = moment().format("jD jMMMM jYYYY");
    const weekday = moment().format("dddd");
    const timeNow = moment().format("HH:mm");

    // تبدیل سفارش‌ها به مجموعه لیست مرتب
    const orders = [];

    const add = (count, label) => {
      if (count && Number(count) > 0) orders.push(`• ${count} ${label}`);
    };

    add(p250_carton, "کارتن ۲۵۰ گرمی ساشه");
    add(p250_pack, "بسته ۲۵۰ گرمی ساشه");
    add(p500_gold_pack, "بسته ۵۰۰ گرمی پاکت طلایی");
    add(p500_gold_carton, "کارتن ۵۰۰ گرمی پاکت طلایی");
    add(onekilo_box_pack, "بسته ۱ کیلویی باکس پوچ");
    add(onekilo_box_carton, "کارتن ۱ کیلویی باکس پوچ");
    add(onekilo_simple_pack, "بسته ۱ کیلویی معمولی");
    add(onekilo_simple_carton, "کارتن ۱ کیلویی معمولی");

    const orderText = orders.length > 0 ? orders.join("\n") : "— ثبت نشده";

    // پیام نهایی **لوکس و منظم**
    const message = `
┏━━━━━━━━━━━━🌿━━━━━━━━━━━┓
           🧾 سفارش جدید ثبت شد
┗━━━━━━━━━━━━🌿━━━━━━━━━━━┛

👤 نام مشتری:
${name}

📞 شماره تماس:
${phone}

🏠 آدرس:
${address}

📮 کد پستی:
${postal || "—"}

━━ جزئیات سفارش ━━
${orderText}

💬 توضیحات:
${notes || "—"}

⏱ زمان ثبت:
${weekday}  ${nowPretty}  /  ${nowDate}
ساعت ${timeNow}
    `.trim();

    // ارسال پیام به تلگرام
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: "HTML"
      }),
    });

    return res.json({ ok: true, message: "Success" });

  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ ok: false, message: "Server Error" });
  }
}
