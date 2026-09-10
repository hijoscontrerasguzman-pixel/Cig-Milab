
const FIREBASE_URL = "https://simaps-cig-default-rtdb.firebaseio.com/";

/* Nodo de la base de datos donde el ESP32 guarda los datos */
const NODO = "/sensores/actual";


/* ============================================================
   REFERENCIAS A ELEMENTOS DEL BANNER DE ESTADO
   El banner aparece arriba si hay error o éxito de conexión
   ============================================================ */
const banner  = document.getElementById('firebase-banner');
const bannerM = document.getElementById('banner-msg');
const bannerI = document.getElementById('banner-icon');


/* ============================================================
   MOSTRAR BANNER
   tipo: 'ok'   → verde, desaparece solo después de 4 segundos
   tipo: 'warn' → naranja, queda visible
   tipo: otro   → rojo, queda visible
   ============================================================ */
function mostrarBanner(msg, tipo) {
  bannerM.textContent = msg;
  bannerI.textContent = tipo === 'ok' ? '✅' : '⚠️';
  banner.className    = 'firebase-banner visible' + (tipo === 'ok' ? ' ok' : '');
  if (tipo === 'ok') setTimeout(() => banner.classList.remove('visible'), 4000);
}


/* ============================================================
   MAPEAR DATOS DE FIREBASE
   Convierte el objeto guardado por el ESP32 al formato que
   espera la función window.actualizarSensores() en ui.js

   Campos que guarda el ESP32 en Firebase:
     temperatura, humedad, co2, luz, agua, presion,
     metano, sonido, ubicacion, timestamp
     (contaminacion/aqi/sensacion/tempMin/tempMax son opcionales:
      solo se usan si algún día agregas un sensor de PM2.5)

   Campos que espera actualizarSensores():
     temperatura, temperaturaMin, temperaturaMax,
     sensacionTermica, humedad, contaminacion, co2,
     presion, aqi, luz, agua, ubicacion
   ============================================================ */
function mapearDatos(d) {
  return {
    temperatura:      d.temperatura,
    /* Si el ESP32 no envió min/max, se estiman a ±3/4°C */
    temperaturaMin:   d.tempMin      != null ? d.tempMin     : d.temperatura - 3,
    temperaturaMax:   d.tempMax      != null ? d.tempMax     : d.temperatura + 4,
    sensacionTermica: d.sensacion    != null ? d.sensacion   : d.temperatura - 1,
    humedad:          d.humedad,
    contaminacion:    d.contaminacion,
    co2:              d.co2,
    presion:          d.presion,
    aqi:              d.aqi,
    luz:              d.luz,
    agua:             d.agua,
    ubicacion:        d.ubicacion    || 'Estación Principal',
  };
}


/* ============================================================
   LECTURA INICIAL
   Al cargar la página hace un fetch() para mostrar los últimos
   datos guardados sin esperar al próximo envío del ESP32
   ============================================================ */
function leerDatosIniciales() {
  const url = `${FIREBASE_URL}${NODO}.json`;

  fetch(url)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(datos => {
      if (datos) {
        window.actualizarSensores(mapearDatos(datos));
        mostrarBanner('Conectado a Firebase correctamente', 'ok');
      } else {
        /* Firebase responde pero el nodo está vacío */
        mostrarBanner('Firebase conectado — sin datos aún. Enciende el ESP32.', 'warn');
      }
    })
    .catch(err => {
      console.error('Error leyendo Firebase:', err);
      mostrarBanner('No se pudo conectar a Firebase. Verifica la URL en firebase.js', 'error');
      document.getElementById('signal-dot').classList.add('offline');
    });
}


/* ============================================================
   ESCUCHA EN TIEMPO REAL (SERVER-SENT EVENTS)
   Firebase Realtime Database soporta SSE de forma nativa.
   Cada vez que el ESP32 escribe datos, Firebase envía un evento
   "put" que llega aquí y actualiza la pantalla automáticamente.

   Si la conexión se pierde, reintenta cada 10 segundos.
   ============================================================ */
function escucharCambios() {
  const url = `${FIREBASE_URL}${NODO}.json`;
  let sse;

  function conectar() {
    sse = new EventSource(url);

    /* Evento "put": datos nuevos o reemplazados por completo */
    sse.addEventListener('put', function (evento) {
      try {
        const payload = JSON.parse(evento.data);
        if (payload && payload.data) {
          window.actualizarSensores(mapearDatos(payload.data));
          cargarHistorialReciente(); /* el ESP32 acaba de enviar datos: refresca la tabla */
        }
      } catch (e) {
        console.error('Error procesando evento "put" de Firebase:', e);
      }
    });

    /* Evento "patch": actualización parcial de uno o más campos */
    sse.addEventListener('patch', function (evento) {
      try {
        const payload = JSON.parse(evento.data);
        if (payload && payload.data) {
          window.actualizarSensores(mapearDatos(payload.data));
          cargarHistorialReciente();
        }
      } catch (e) {
        console.error('Error procesando evento "patch" de Firebase:', e);
      }
    });

    /* Error de conexión SSE: cierra y reintenta en 10 segundos */
    sse.onerror = function () {
      console.warn('Conexión SSE perdida. Reintentando en 10 s…');
      mostrarBanner('Reconectando a Firebase…', 'warn');
      sse.close();
      setTimeout(conectar, 10000);
    };
  }

  conectar();
}


/* ============================================================
   CONVERTIR UN REGISTRO CRUDO DE FIREBASE A FILA DE TABLA
   Separa el timestamp (milisegundos) en fecha y hora legibles
   ============================================================ */
function convertirRegistro(r) {
  const f = new Date(r.timestamp);
  return {
    fecha: f.toLocaleDateString('sv-SE'), /* truco: 'sv-SE' da formato AAAA-MM-DD */
    hora:  f.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    temperatura: r.temperatura,
    humedad:     r.humedad,
    co2:         r.co2,
    luz:         r.luz,
    agua:        r.agua,
  };
}


/* ============================================================
   HISTORIAL RECIENTE (para la tabla visible del panel)
   Trae solo las últimas 15 lecturas. orderBy="$key" no necesita
   ningún índice especial en las reglas de Firebase porque las
   claves que genera Firebase (push) ya vienen ordenadas por
   fecha de creación.
   ============================================================ */
async function cargarHistorialReciente() {
  const url = `${FIREBASE_URL}/sensores/historial.json?orderBy="$key"&limitToLast=15`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const datos = await res.json();
    if (!datos) { window.actualizarHistorial([]); return; }

    const lista = Object.values(datos)
      .filter(r => r && r.timestamp)
      .sort((a, b) => b.timestamp - a.timestamp) /* más reciente primero */
      .map(convertirRegistro);

    window.actualizarHistorial(lista);
  } catch (e) {
    console.error('Error cargando historial reciente:', e);
  }
}


/* ============================================================
   HISTORIAL COMPLETO (usado por js/exportar.js)
   Trae TODOS los registros guardados, ordenados del más viejo
   al más nuevo, listos para escribirse en el Excel.
   ============================================================ */
async function obtenerHistorialCompleto() {
  const url = `${FIREBASE_URL}/sensores/historial.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const datos = await res.json();
  if (!datos) return [];

  return Object.values(datos)
    .filter(r => r && r.timestamp)
    .sort((a, b) => a.timestamp - b.timestamp) /* más viejo primero */
    .map(convertirRegistro);
}
window.obtenerHistorialCompleto = obtenerHistorialCompleto;


/* ============================================================
   INICIO
   Ejecuta la lectura inicial y abre la escucha en tiempo real
   cuando el DOM está listo
   ============================================================ */
leerDatosIniciales();
escucharCambios();
cargarHistorialReciente();
