

/* ============================================================
   RELOJ EN TIEMPO REAL
   Actualiza la fecha y hora en la cabecera cada minuto
   ============================================================ */
function actualizarFecha() {
  const ahora = new Date();
  const opts  = { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' };
  document.getElementById('current-date').textContent =
    ahora.toLocaleDateString('es-ES', opts);
}
actualizarFecha();
setInterval(actualizarFecha, 60000);


/* ============================================================
   CLASIFICADORES DE ESTADO
   Devuelven [textoInsignia, claseCSS] según el valor del sensor
   ============================================================ */

/* Humedad relativa en % */
function estadoHumedad(v) {
  if (v < 30) return ['Baja',   'badge-warn'];
  if (v > 70) return ['Alta',   'badge-alert'];
  return ['Óptima', 'badge-ok'];
}

/* Contaminación PM2.5 en µg/m³ (límites OMS) */
function estadoContaminacion(v) {
  if (v <= 12) return ['Buena',    'badge-ok'];
  if (v <= 35) return ['Moderada', 'badge-warn'];
  return ['Dañina', 'badge-alert'];
}

/* Dióxido de carbono en ppm (niveles de interiores) */
function estadoCO2(v) {
  if (v < 1000) return ['Normal',    'badge-ok'];
  if (v < 2000) return ['Elevado',   'badge-warn'];
  return ['Peligroso', 'badge-alert'];
}

/* Presión atmosférica en hPa */
function estadoPresion(v) {
  if (v < 1000) return ['Baja',   'badge-warn'];
  if (v > 1025) return ['Alta',   'badge-info'];
  return ['Normal', 'badge-ok'];
}

/* Intensidad luminosa en lux (pensado para interior/invernadero) */
function estadoLuz(v) {
  if (v < 200)   return ['Baja',      'badge-warn'];
  if (v > 10000) return ['Muy alta',  'badge-info'];
  return ['Buena', 'badge-ok'];
}

/* Agua disponible en litros, relativa a la capacidad del tanque.
   *** EDITA ESTA LÍNEA *** con la capacidad real de tu tanque */
const CAPACIDAD_TANQUE_L = 20;

function estadoAgua(v) {
  const pct = (v / CAPACIDAD_TANQUE_L) * 100;
  if (pct < 20) return ['Baja',  'badge-alert'];
  if (pct > 80) return ['Llena', 'badge-info'];
  return ['Normal', 'badge-ok'];
}


/* ============================================================
   ANIMACIÓN DE NÚMEROS
   Hace que un número se cuente suavemente desde su valor actual
   hasta el valor nuevo usando easing cúbico
   ============================================================ */
function animarNumero(el, valorFinal, decimales, duracion) {
  const inicio = parseFloat(el.textContent) || 0;
  const t0     = performance.now();

  function paso(t) {
    const prog = Math.min((t - t0) / duracion, 1);
    /* Ease-out cúbico: rápido al inicio, lento al final */
    const ease = 1 - Math.pow(1 - prog, 3);
    el.textContent = (inicio + (valorFinal - inicio) * ease).toFixed(decimales);
    if (prog < 1) requestAnimationFrame(paso);
  }

  requestAnimationFrame(paso);
}


/* ============================================================
   ACTUALIZAR GAUGE (BARRA DE NIVEL)
   Ajusta el ancho de la barra de progreso de cada tarjeta
   ============================================================ */
function actualizarGauge(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = Math.max(0, Math.min(100, pct)) + '%';
}


/* ============================================================
   ACTUALIZAR BADGE DE ESTADO
   Cambia el texto y la clase de color de la insignia
   ============================================================ */
function actualizarBadge(id, texto, clase) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = texto;
  el.className   = 'card-badge ' + clase;
}


/* ============================================================
   LED DE SENSOR ONLINE
   Cambia el LED de rojo a verde cuando llegan datos del sensor
   ============================================================ */
function ledOnline(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('offline');
}


/* ============================================================
   FUNCIÓN PÚBLICA: window.actualizarSensores(datos)

   Esta función recibe los datos del ESP32 (vía firebase.js)
   y actualiza toda la interfaz con animaciones suaves.

   Formato del objeto "datos":
   {
     temperatura:      número en °C
     temperaturaMin:   número en °C  (opcional)
     temperaturaMax:   número en °C  (opcional)
     sensacionTermica: número en °C  (opcional)
     humedad:          número en %
     contaminacion:    número en µg/m³ PM2.5
     co2:              número en ppm
     presion:          número en hPa  (opcional)
     aqi:              número 0–500
     ubicacion:        texto          (opcional)
   }
   ============================================================ */
window.actualizarSensores = function (datos) {
  if (!datos) return;

  /* Nombre de la estación en la cabecera */
  if (datos.ubicacion)
    document.getElementById('location-name').textContent = datos.ubicacion;

  /* ── Temperatura ─────────────────────────────────────── */
  if (datos.temperatura != null) {
    animarNumero(document.getElementById('temp-value'), datos.temperatura, 1, 900);

    /* Barra de nivel: rango de -10°C a 45°C mapeado a 0–100% */
    const pct = Math.min(100, Math.max(0, ((datos.temperatura + 10) / 55) * 100));
    document.getElementById('hero-bar').style.width = pct + '%';

    ledOnline('led-temp');
  }

  if (datos.temperaturaMin != null)
    animarNumero(document.getElementById('temp-min'), datos.temperaturaMin, 1, 700);

  if (datos.temperaturaMax != null)
    animarNumero(document.getElementById('temp-max'), datos.temperaturaMax, 1, 700);

  if (datos.sensacionTermica != null) {
    const el = document.getElementById('temp-feels');
    animarNumero(el, datos.sensacionTermica, 1, 700);
    /* Agrega el símbolo ° al terminar la animación */
    setTimeout(() => { if (!el.textContent.includes('°')) el.textContent += '°'; }, 750);
  }

  /* ── Humedad ─────────────────────────────────────────── */
  if (datos.humedad != null) {
    animarNumero(document.getElementById('humidity-value'), datos.humedad, 0, 900);
    actualizarGauge('gauge-humidity', datos.humedad); /* 0–100% directo */
    const [txt, cls] = estadoHumedad(datos.humedad);
    actualizarBadge('badge-humidity', txt, cls);
    ledOnline('led-humidity');
  }

  /* ── Contaminación PM2.5 ─────────────────────────────── */
  if (datos.contaminacion != null) {
    animarNumero(document.getElementById('pollution-value'), datos.contaminacion, 1, 900);
    /* Gauge: 0–100 µg/m³ mapeado a 0–100% */
    actualizarGauge('gauge-pollution', (datos.contaminacion / 100) * 100);
    const [txt, cls] = estadoContaminacion(datos.contaminacion);
    actualizarBadge('badge-pollution', txt, cls);
    ledOnline('led-pollution');
  }

  /* ── Dióxido de Carbono ──────────────────────────────── */
  if (datos.co2 != null) {
    animarNumero(document.getElementById('co2-value'), datos.co2, 0, 900);
    /* Gauge: 0–2500 ppm mapeado a 0–100% */
    actualizarGauge('gauge-co2', Math.min(100, (datos.co2 / 2500) * 100));
    const [txt, cls] = estadoCO2(datos.co2);
    actualizarBadge('badge-co2', txt, cls);
    ledOnline('led-co2');
  }

  /* ── Presión atmosférica ─────────────────────────────── */
  if (datos.presion != null) {
    animarNumero(document.getElementById('pressure-value'), datos.presion, 0, 900);
    /* Gauge: rango 970–1030 hPa mapeado a 0–100% */
    actualizarGauge('gauge-pressure', Math.min(100, ((datos.presion - 970) / 60) * 100));
    const [txt, cls] = estadoPresion(datos.presion);
    actualizarBadge('badge-pressure', txt, cls);
  }

  /* ── Intensidad luminosa ──────────────────────────────── */
  if (datos.luz != null) {
    animarNumero(document.getElementById('luz-value'), datos.luz, 0, 900);
    /* Gauge: 0–10 000 lux mapeado a 0–100% */
    actualizarGauge('gauge-luz', Math.min(100, (datos.luz / 10000) * 100));
    const [txt, cls] = estadoLuz(datos.luz);
    actualizarBadge('badge-luz', txt, cls);
    ledOnline('led-luz');
  }

  /* ── Agua disponible ──────────────────────────────────── */
  if (datos.agua != null) {
    animarNumero(document.getElementById('agua-value'), datos.agua, 1, 900);
    actualizarGauge('gauge-agua', (datos.agua / CAPACIDAD_TANQUE_L) * 100);
    const [txt, cls] = estadoAgua(datos.agua);
    actualizarBadge('badge-agua', txt, cls);
    ledOnline('led-agua');
  }

  /* ── Índice de Calidad del Aire (AQI) ───────────────── */
  if (datos.aqi != null) {
    animarNumero(document.getElementById('aqi-value'), datos.aqi, 0, 900);
    /* Puntero: AQI 0–300 mapeado a 2–98% (evita salir de la barra) */
    const pctAqi = Math.min(98, Math.max(2, (datos.aqi / 300) * 100));
    setTimeout(() => {
      document.getElementById('aqi-pointer').style.left = pctAqi + '%';
    }, 100);
  }

  /* ── Reloj de última actualización ──────────────────── */
  const ahora = new Date();
  document.getElementById('last-update').textContent =
    ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  document.getElementById('update-status').textContent = 'Datos recibidos del ESP32';

  /* Punto de señal de cabecera: verde = online */
  document.getElementById('signal-dot').classList.remove('offline');
};


/* ============================================================
   FUNCIÓN PÚBLICA: window.actualizarHistorial(lista)
   Dibuja las últimas lecturas guardadas en /sensores/historial
   dentro de la tabla de la sección "Historial reciente".
   lista = [{fecha, hora, temperatura, humedad, co2, luz, agua}, …]
   ============================================================ */
window.actualizarHistorial = function (lista) {
  const cuerpo = document.getElementById('historial-tbody');
  if (!cuerpo) return;

  if (!lista || !lista.length) {
    cuerpo.innerHTML = '<tr><td colspan="7" class="historial-vacio">Aún no hay registros guardados. Esperando al ESP32…</td></tr>';
    return;
  }

  cuerpo.innerHTML = lista.map(r => `
    <tr>
      <td>${r.fecha}</td>
      <td>${r.hora}</td>
      <td>${formatoNumero(r.temperatura, 1)}</td>
      <td>${formatoNumero(r.humedad, 0)}</td>
      <td>${formatoNumero(r.co2, 0)}</td>
      <td>${formatoNumero(r.luz, 0)}</td>
      <td>${formatoNumero(r.agua, 1)}</td>
    </tr>
  `).join('');
};

function formatoNumero(v, decimales) {
  return (v == null || isNaN(v)) ? '—' : Number(v).toFixed(decimales);
}
