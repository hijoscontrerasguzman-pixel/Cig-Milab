/* ============================================================
   js/exportar.js
   Botón "Exportar a Excel"
   ── Lee TODO el historial guardado en Firebase (firebase.js)
   ── Genera un .xlsx con ExcelJS, con el mismo estilo visual
      que la plantilla original del proyecto (título verde,
      encabezados celestes con filtro, filas verdes)
   ── Descarga el archivo directamente en el navegador
      (no necesita servidor ni backend)
   ============================================================ */


/* ============================================================
   *** EDITA ESTA LÍNEA SI QUIERES ***
   Texto que aparece en la fila 1 del Excel exportado
   ============================================================ */
const TITULO_EXPORT = '🌱 REGISTRO DE DATOS METEOROLÓGICOS — ESTACIÓN AMBIENTAL';

/* Columnas del Excel, en el mismo orden que la plantilla original */
const COLUMNAS_EXPORT = [
  { header: 'Fecha',                     campo: 'fecha',       width: 13 },
  { header: 'Hora',                      campo: 'hora',        width: 9  },
  { header: 'Temperatura (°C)',          campo: 'temperatura', width: 17 },
  { header: 'Humedad (%)',               campo: 'humedad',     width: 13 },
  { header: 'CO2 (ppm)',                 campo: 'co2',         width: 11 },
  { header: 'Intensidad Luminosa (lux)', campo: 'luz',         width: 23 },
  { header: 'Agua disponible (L)',       campo: 'agua',        width: 17 },
];


async function exportarExcel() {
  const boton = document.getElementById('btn-exportar');
  if (!boton) return;
  const textoOriginal = boton.textContent;

  try {
    boton.textContent = 'Generando…';
    boton.disabled = true;

    if (typeof ExcelJS === 'undefined') {
      throw new Error('ExcelJS no cargó. Revisa tu conexión a internet (se descarga desde un CDN).');
    }

    const historial = await window.obtenerHistorialCompleto(); // definido en firebase.js

    if (!historial.length) {
      alert('Todavía no hay datos guardados en Firebase (/sensores/historial).\nEnciende el ESP32 y espera al menos un envío antes de exportar.');
      return;
    }

    const libro = new ExcelJS.Workbook();
    libro.creator = 'Monitor Ambiental';
    const hoja = libro.addWorksheet('Registro');

    /* ── Fila 1: título combinado, fondo verde oscuro ── */
    hoja.mergeCells(1, 1, 1, COLUMNAS_EXPORT.length);
    const celdaTitulo = hoja.getCell(1, 1);
    celdaTitulo.value = TITULO_EXPORT;
    celdaTitulo.font = { bold: true, size: 14, name: 'Arial', color: { argb: 'FFFFFFFF' } };
    celdaTitulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF38761D' } };
    celdaTitulo.alignment = { vertical: 'middle', horizontal: 'left' };
    hoja.getRow(1).height = 26;

    /* ── Fila 2: encabezados de columna, fondo celeste + filtro ── */
    const filaEncabezado = hoja.getRow(2);
    COLUMNAS_EXPORT.forEach((col, i) => {
      const celda = filaEncabezado.getCell(i + 1);
      celda.value = col.header;
      celda.font = { bold: true, size: 10, name: 'Arial' };
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCFE2F3' } };
      celda.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      celda.border = bordeFino('FFB7B7B7');
    });
    filaEncabezado.height = 32;
    hoja.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: COLUMNAS_EXPORT.length } };

    /* ── Filas de datos, fondo verde claro ── */
    historial.forEach((registro, idx) => {
      const fila = hoja.getRow(3 + idx);
      COLUMNAS_EXPORT.forEach((col, i) => {
        const celda = fila.getCell(i + 1);
        celda.value = registro[col.campo] != null ? registro[col.campo] : '';
        celda.font = { size: 10, name: 'Arial' };
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };
        celda.alignment = { vertical: 'middle', horizontal: i < 2 ? 'left' : 'center' };
        celda.border = bordeFino('FFCC0000');
      });
    });

    hoja.columns = COLUMNAS_EXPORT.map(c => ({ width: c.width }));

    // Que las 7 columnas quepan en una sola página si alguien lo imprime
    hoja.pageSetup.orientation = 'landscape';
    hoja.pageSetup.fitToPage = true;
    hoja.pageSetup.fitToWidth = 1;
    hoja.pageSetup.fitToHeight = 0;

    const buffer = await libro.xlsx.writeBuffer();
    descargarArchivo(buffer, `registro_meteorologico_${nombreFecha()}.xlsx`);

  } catch (err) {
    console.error('Error exportando a Excel:', err);
    alert('No se pudo generar el Excel. Abre la consola del navegador (F12) para ver el detalle del error.');
  } finally {
    boton.textContent = textoOriginal;
    boton.disabled = false;
  }
}


function bordeFino(colorHex) {
  const estilo = { style: 'thin', color: { argb: colorHex } };
  return { top: estilo, left: estilo, bottom: estilo, right: estilo };
}

function descargarArchivo(buffer, nombreArchivo) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function nombreFecha() {
  return new Date().toISOString().slice(0, 10); // AAAA-MM-DD
}


const botonExportar = document.getElementById('btn-exportar');
if (botonExportar) botonExportar.addEventListener('click', exportarExcel);
