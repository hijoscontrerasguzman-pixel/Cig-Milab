/* ============================================================
   js/fondo.js
   Animaciones del fondo del Monitor Ambiental
   ── Aurora boreal: ondas orgánicas de color con Canvas API
   ── Partículas flotantes: puntos que suben como aerosoles
   ============================================================ */


/* ============================================================
   AURORA BOREAL
   Dibuja capas de ondas sinusoidales superpuestas
   en el canvas #aurora-canvas con colores de aurora
   ============================================================ */
(function () {
  const canvas = document.getElementById('aurora-canvas');
  const ctx    = canvas.getContext('2d');
  let W, H, t  = 0;

  /* Ajusta el canvas al tamaño real de la ventana */
  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  /* Definición de cada capa de aurora:
     color   → RGB de la onda
     alpha   → transparencia (muy baja para efecto sutil)
     speed   → velocidad de movimiento horizontal
     amp     → amplitud de la onda (fracción del alto de pantalla)
     freq    → frecuencia espacial de la onda
     yBase   → posición vertical base (fracción del alto de pantalla) */
  const capas = [
    { color: [56,  189, 248], alpha: 0.040, speed: 0.0008, amp: 0.12, freq: 1.2, yBase: 0.35 },
    { color: [129, 140, 248], alpha: 0.035, speed: 0.0012, amp: 0.10, freq: 0.9, yBase: 0.42 },
    { color: [52,  211, 153], alpha: 0.025, speed: 0.0006, amp: 0.08, freq: 1.5, yBase: 0.28 },
    { color: [251, 113, 133], alpha: 0.020, speed: 0.0010, amp: 0.07, freq: 0.7, yBase: 0.55 },
  ];

  /* Dibuja un frame de la aurora y pide el siguiente */
  function dibujar() {
    ctx.clearRect(0, 0, W, H);

    capas.forEach(c => {
      const yc  = H * c.yBase;
      const amp = H * c.amp;

      ctx.beginPath();

      for (let x = 0; x <= W; x += 4) {
        const nx    = x / W;
        /* Dos ondas superpuestas para movimiento orgánico */
        const onda1 = Math.sin(nx * Math.PI * c.freq + t * c.speed * 1000) * amp;
        const onda2 = Math.sin(nx * Math.PI * c.freq * 2.1 + t * c.speed * 700) * amp * 0.4;
        const y     = yc + onda1 + onda2;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }

      /* Cierra la forma hacia abajo para rellenar */
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();

      const [r, g, b] = c.color;
      ctx.fillStyle = `rgba(${r},${g},${b},${c.alpha})`;
      ctx.fill();
    });

    t++;
    requestAnimationFrame(dibujar);
  }

  dibujar();
})();


/* ============================================================
   PARTÍCULAS FLOTANTES
   Puntos pequeños que suben lentamente por la pantalla
   como aerosoles o partículas en el aire
   ============================================================ */
(function () {
  const canvas = document.getElementById('particles-canvas');
  const ctx    = canvas.getContext('2d');
  let W, H;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  /* Colores disponibles para las partículas (RGB) */
  const COLORES = ['56,189,248', '129,140,248', '52,211,153', '251,191,36'];

  /* Crea 40 partículas con propiedades aleatorias iniciales */
  const particulas = Array.from({ length: 40 }, () => ({
    x:       Math.random() * 1000,
    y:       Math.random() * 800,
    r:       Math.random() * 1.5 + 0.5,   /* radio: 0.5 – 2 px */
    vx:      (Math.random() - 0.5) * 0.25, /* deriva horizontal leve */
    vy:      -(Math.random() * 0.3 + 0.1), /* sube suavemente */
    alpha:   Math.random() * 0.35 + 0.1,
    color:   COLORES[Math.floor(Math.random() * COLORES.length)],
    vida:    Math.random() * 300,
    maxVida: 250 + Math.random() * 150,
  }));

  /* Anima las partículas con fade-in y fade-out en los bordes */
  function animar() {
    ctx.clearRect(0, 0, W, H);

    particulas.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vida++;

      /* Cuando una partícula sale por arriba, renace por abajo */
      if (p.vida > p.maxVida || p.y < -10) {
        p.x    = Math.random() * W;
        p.y    = H + 10;
        p.vida = 0;
      }

      /* Fade-in al nacer, fade-out al morir */
      const fade = Math.min(p.vida / 40, 1) * Math.min((p.maxVida - p.vida) / 40, 1);

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color},${p.alpha * fade})`;
      ctx.fill();
    });

    requestAnimationFrame(animar);
  }

  animar();
})();
