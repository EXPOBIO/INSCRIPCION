// ==========================================================
// common.js — lógica compartida entre datosEstudiante.html,
// datosGrupo.html y datosEgresado.html
// ==========================================================

// URL de la Web App de Apps Script. Solo se usa cuando el
// formulario corre fuera de Apps Script (ej. GitHub Pages).
const API_URL = 'https://script.google.com/macros/s/AKfycbyo7fnNAYPplA7rrccdjbQXWZfVowJUNZYvhP48UrqkHciE7-UglNM2lNAo7y1-6Rid2w/exec';

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