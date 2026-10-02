// ==========================================================
// common.js — lógica compartida entre datosEstudiante.html,
// datosGrupo.html y datosEgresado.html
// ==========================================================

// URL de la Web App de Apps Script. Solo se usa cuando el
// formulario corre fuera de Apps Script (ej. GitHub Pages).
const API_URL = 'https://script.google.com/macros/s/AKfycbxp_uzyu5wjZhY0FYmuU5Hazw-CvluEMoAgyuOwKVTvZePvetP1WKGKlxUYY1j5krpU/exec';

function ejecutandoEnAppsScript() {
  return typeof google !== 'undefined' &&
         google.script &&
         typeof google.script.run !== 'undefined';
}

function enviarInscripcion(datos) {
  if (ejecutandoEnAppsScript()) {
    // ---------- Modo Apps Script ----------
    return new Promise(function (resolve, reject) {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)
        .registrarInscripcion(datos);
    });
  }

  // ---------- Modo GitHub Pages ----------
  return fetch(API_URL, {
    method: 'POST',
    // text/plain evita el preflight OPTIONS (Apps Script no lo maneja).
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(datos)
  }).then(function (r) {
    if (!r.ok) throw new Error('Error de red: ' + r.status);
    return r.json();
  });
}

function leerArchivoComoBase64(archivo) {
  return new Promise(function (resolve, reject) {
    if (!archivo) return resolve(null);
    const lector = new FileReader();
    lector.onload = function () { resolve(lector.result); };
    lector.onerror = reject;
    lector.readAsDataURL(archivo);
  });
}

// El comprobante debe ser una imagen o un PDF. Devuelve un mensaje
// de error si el archivo elegido no lo es, o null si es válido.
function errorSiVoucherNoEsImagen(archivo) {
  if (!archivo) return null; // el <input> es required; se valida en el form
  if (archivo.type && archivo.type.indexOf('image/') !== 0 && archivo.type !== 'application/pdf') {
    return 'El comprobante debe ser una imagen (foto o captura en JPG, PNG o WEBP) o un PDF.';
  }
  return null;
}

// ==========================================================
// Envío al backend único de INSCRIPCION (verificación de DNI y
// registro de concursos). Mismo AppScript que las inscripciones.
// ==========================================================
const API_CONCURSOS_URL = API_URL;

async function enviarVerifConcurso(payload) {
  const resp = await fetch(API_CONCURSOS_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  if (!resp.ok) throw new Error('Error de red: ' + resp.status);
  return resp.json();
}

// Verifica por DNI si la persona puede participar en un concurso:
// inscrito aprobado o integrante de la comisión organizadora.
async function verificarDniConcurso(dni) {
  const respuesta = await enviarVerifConcurso({ tipo: 'verificarParticipante', dni: dni.replace(/\./g, '') });
  if (!respuesta.ok) throw new Error(respuesta.mensaje || 'No se pudo verificar el DNI.');
  return respuesta;
}

// Marca en rojo los campos requeridos que están vacíos (ignora los que
// están dentro de un bloque oculto) y hace scroll al primero.
function formularioTieneEspaciosVacios(form) {
  const campos = form.querySelectorAll('input[required], select[required]');
  let primerCampoInvalido = null;

  campos.forEach(function (campo) {
    if (campo.closest('.oculto-form')) {
      campo.classList.remove('campo-invalido-form');
      return;
    }
    const vacio = campo.value.trim() === '';
    campo.classList.toggle('campo-invalido-form', vacio);
    if (vacio && !primerCampoInvalido) primerCampoInvalido = campo;
  });

  if (primerCampoInvalido) {
    primerCampoInvalido.scrollIntoView({ behavior: 'smooth', block: 'center' });
    primerCampoInvalido.focus();
    return true;
  }
  return false;
}

// Quita el estado de "inválido" apenas el usuario empieza a corregir el campo.
function activarLimpiezaDeErrores(form) {
  form.addEventListener('input', function (e) {
    const campo = e.target;
    if (campo.classList.contains('campo-invalido-form') && campo.value.trim() !== '') {
      campo.classList.remove('campo-invalido-form');
    }
  });
}

function reiniciarFormularioGenerico(form, pantallaExito) {
  pantallaExito.classList.remove('visible');
  form.style.display = 'block';
  form.reset();
}