// ❄️ snow.js - ایجاد حالت برف نرم و طبیعی فقط برای صفحه اول

document.addEventListener("DOMContentLoaded", () => {
  const startScreen = document.getElementById("startScreen");

  // ایجاد بوم (canvas) برای برف
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.style.position = "absolute";
  canvas.style.top = 0;
  canvas.style.left = 0;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none"; // جلوگیری از تداخل با دکمه‌ها
  canvas.style.zIndex = 1; // زیر نوشته‌ها و دکمه‌ها
  startScreen.appendChild(canvas);

  // تنظیم اندازه بوم
  function resizeCanvas() {
    canvas.width = startScreen.clientWidth;
    canvas.height = startScreen.clientHeight;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // ❄️ تولید دانه‌های برف
  const snowflakes = [];
  const numFlakes = 70; // تعداد دانه‌ها

  for (let i = 0; i < numFlakes; i++) {
    snowflakes.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 3 + 1, // اندازه دانه
      d: Math.random() * numFlakes, // چگالی
    });
  }

  let angle = 0;

  function drawSnow() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.beginPath();
    for (let i = 0; i < numFlakes; i++) {
      const flake = snowflakes[i];
      ctx.moveTo(flake.x, flake.y);
      ctx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2, true);
    }
    ctx.fill();
    updateSnow();
  }

  function updateSnow() {
    angle += 0.01;
    for (let i = 0; i < numFlakes; i++) {
      const flake = snowflakes[i];
      flake.y += Math.cos(angle + flake.d) + 1 + flake.r / 2;
      flake.x += Math.sin(angle) * 0.5;

      // اگر برف از پایین رفت، دوباره از بالا ظاهر شود
      if (flake.y > canvas.height) {
        snowflakes[i] = {
          x: Math.random() * canvas.width,
          y: 0,
          r: flake.r,
          d: flake.d,
        };
      }
    }
  }

  // اجرای انیمیشن
  function animateSnow() {
    drawSnow();
    requestAnimationFrame(animateSnow);
  }
  animateSnow();
});
