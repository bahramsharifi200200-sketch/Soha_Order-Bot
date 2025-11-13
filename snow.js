// ❄️ snow.js — حالت برف درخشان و طبیعی برای صفحه اول (startScreen)

document.addEventListener("DOMContentLoaded", () => {
  const startScreen = document.getElementById("startScreen");

  // ایجاد canvas برای نمایش برف
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.style.position = "absolute";
  canvas.style.top = 0;
  canvas.style.left = 0;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none"; // تا با دکمه‌ها تداخلی نداشته باشد
  canvas.style.zIndex = 1; // زیر نوشته‌ها و دکمه‌ها
  startScreen.appendChild(canvas);

  // تنظیم اندازه بوم
  function resizeCanvas() {
    canvas.width = startScreen.clientWidth;
    canvas.height = startScreen.clientHeight;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // تنظیمات برف
  const snowflakes = [];
  const numFlakes = 90; // تعداد دانه‌ها
  const colors = ["#ffffff", "#e0f7ff", "#b3ecff"]; // طیف رنگی سفید تا آبی ملایم

  for (let i = 0; i < numFlakes; i++) {
    snowflakes.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 3 + 1, // اندازه دانه
      d: Math.random() * numFlakes, // چگالی
      color: colors[Math.floor(Math.random() * colors.length)],
      opacity: Math.random() * 0.5 + 0.5,
      speed: Math.random() * 1 + 0.5,
    });
  }

  let angle = 0;

  // ترسیم دانه‌های برف
  function drawSnow() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.shadowBlur = 8; // ایجاد درخشش
    ctx.shadowColor = "rgba(255,255,255,0.9)";

    for (let i = 0; i < numFlakes; i++) {
      const flake = snowflakes[i];
      ctx.beginPath();
      ctx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${hexToRgb(flake.color)},${flake.opacity})`;
      ctx.fill();
    }
    updateSnow();
  }

  // حرکت برف‌ها
  function updateSnow() {
    angle += 0.01;
    for (let i = 0; i < snowflakes.length; i++) {
      const flake = snowflakes[i];
      flake.y += Math.cos(angle + flake.d) + flake.speed;
      flake.x += Math.sin(angle) * 0.4;

      // بازگرداندن دانه‌ها به بالا پس از خروج از پایین
      if (flake.y > canvas.height) {
        snowflakes[i] = {
          ...flake,
          x: Math.random() * canvas.width,
          y: 0,
        };
      }
    }
  }

  // انیمیشن
  function animateSnow() {
    drawSnow();
    requestAnimationFrame(animateSnow);
  }
  animateSnow();

  // تبدیل رنگ hex به RGB
  function hexToRgb(hex) {
    const c = hex.replace("#", "");
    const bigint = parseInt(c, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `${r},${g},${b}`;
  }
});
