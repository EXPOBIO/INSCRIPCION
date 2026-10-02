/**
 * concurso-biodex.js — lógica del formulario de inscripción al BioDex y
 * BioDex Junior (cachimbos).
 *
 * Requiere common.js (leerArchivoComoBase64) y los elementos marcados en
 * concurso-biodex.html.
 *
 * Modalidades (toggle):
 *  - 'biodex'  : temática ANP del Cusco / Bacterias.
 *  - 'junior'  : solo cachimbos (ingresantes 2026-I y 2026-II); temática
 *                por sorteo; además sube constancia de inscripción EXPOBIO.
 *
 * Flujo:
 *  1. Se llena el DNI de los 4 integrantes y se presiona "Verificar" en cada
 *     uno. Se consulta el estado en la hoja de Inscripciones.
 *  2. Se elige al representante con los radios (por defecto el 1º).
 *     En 'junior' cada integrante declara su semestre de ingreso (2026-I/II).
 *  3. Solo si los 4 están aprobados se habilita el registro final.
 */

// URL de la Web App de concursos (Apps Script independiente).
// Se reemplaza al desplegar el backend. Solo se usa fuera de Apps Script.
const TOTAL_INTEGRANTES = 4;

// Estado de la modalidad actual: 'biodex' | 'junior'.
let modalidad = 'biodex';

// Resultado de la verificación por índice: { dni, nombres }.
const verificados = [];

// --------------------------------------------------------
// envío al backend de concursos. Dentro de Apps Script usa
// google.script.run; fuera (GitHub Pages / archivo local) usa
// la Web App vía fetch. common.js provee el fallback de fetch.
// --------------------------------------------------------
async function enviarAConcursos(payload) {
  if (typeof google !== 'undefined' && google.script && typeof google.script.run !== 'undefined') {
    return new Promise(function (resolve, reject) {
      google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).registrarInscripcion(payload);
    });
  }
  return enviarVerifConcurso(payload);
}

// --------------------------------------------------------
// render de los 4 bloques de integrante
// --------------------------------------------------------
function renderIntegrantes() {
  const contenedor = document.getElementById('contenedor-integrantes');
  let html = '';
  for (let i = 0; i < TOTAL_INTEGRANTES; i++) {
    const semestreHtml = modalidad === 'junior'
      ? `<div class="campo-form">
          <label for="semestre-${i}">Semestre de ingreso (cachimbo)</label>
          <select id="semestre-${i}">
            <option value="">Seleccione</option>
            <option value="2026-I">2026-I</option>
            <option value="2026-II">2026-II</option>
          </select>
         </div>`
      : '';
    html += `
      <div class="integrante-form" data-indice="${i}">
        <p class="etiqueta-integrante">Integrante ${i + 1}</p>
        <div class="fila-dni">
          <div class="campo-form">
            <label for="dni-${i}">DNI</label>
            <input type="text" id="dni-${i}" maxlength="8" pattern="[0-9]{8}"
              inputmode="numeric" placeholder="8 dígitos" required>
          </div>
          <button type="button" class="btn-verificar-integrante" data-boton="${i}">Verificar</button>
        </div>
        ${semestreHtml}
        <div class="radio-representante">
          <label class="rep-opcion">
            <input type="radio" name="representante" value="${i}" ${i === 0 ? 'checked' : ''}>
            <span>Representante (líder)</span>
          </label>
        </div>
        <div class="verif-estado" id="estado-${i}"></div>
      </div>`;
  }
  contenedor.innerHTML = html;

  contenedor.querySelectorAll('.btn-verificar-integrante').forEach(function (btn) {
    btn.addEventListener('click', function () {
      verificarIntegrante(parseInt(btn.dataset.boton, 10));
    });
  });
}

// --------------------------------------------------------
// verificación de un integrante por DNI
// --------------------------------------------------------
async function verificarIntegrante(indice) {
  const input = document.getElementById('dni-' + indice);
  const estadoDiv = document.getElementById('estado-' + indice);
  const boton = document.querySelector('[data-boton="' + indice + '"]');
  const dni = (input.value || '').trim();

  estadoDiv.className = 'verif-estado';
  estadoDiv.textContent = '';
  verificados[indice] = null;

  if (!/^\d{8}$/.test(dni)) {
    estadoDiv.className = 'verif-estado mal visible';
    estadoDiv.textContent = 'Ingresa un DNI válido de 8 dígitos.';
    input.classList.add('campo-invalido-form');
    return;
  }

  if (hayDniRepetido(dni, indice)) {
    estadoDiv.className = 'verif-estado mal visible';
    estadoDiv.textContent = 'Este DNI ya lo registraste en otro integrante del equipo.';
    input.classList.add('campo-invalido-form');
    return;
  }

  boton.disabled = true;
  boton.textContent = 'Verificando...';
  estadoDiv.className = 'verif-estado visible';
  estadoDiv.textContent = 'Consultando tu inscripción...';

  try {
    const respuesta = await enviarAConcursos({ tipo: 'verificarParticipante', dni: dni.replace(/\./g, '') });
    if (!respuesta.ok) {
      throw new Error(respuesta.mensaje || 'No se pudo verificar el DNI.');
    }

    if (!respuesta.encontrado) {
      estadoDiv.className = 'verif-estado mal visible';
      estadoDiv.textContent = 'Este DNI no está inscrito en el EXPOBIO 2026. Primero inscríbete al evento.';
      input.classList.add('campo-invalido-form');
      return;
    }

    if (respuesta.estado !== 'aprobado') {
      estadoDiv.className = 'verif-estado pendiente visible';
      estadoDiv.textContent = 'Su inscripción figura como "' + (respuesta.estado || 'sin validar') +
        '". Solo pueden concursar los inscritos aprobados.';
      input.classList.add('campo-invalido-form');
      return;
    }

    verificados[indice] = { dni: dni, nombres: respuesta.nombres || '' };
    const esOrg = respuesta.esOrganizador ? ' (organizador)' : '';
    estadoDiv.className = 'verif-estado bien visible';
    estadoDiv.textContent = '✓ Inscrito y aprobado' + esOrg + '. ' + (verificados[indice].nombres || '');
    input.classList.remove('campo-invalido-form');
  } catch (err) {
    estadoDiv.className = 'verif-estado mal visible';
    estadoDiv.textContent = 'Error: ' + (err && err.message ? err.message : 'intenta de nuevo');
    input.classList.add('campo-invalido-form');
  } finally {
    boton.disabled = false;
    boton.textContent = 'Verificar';
  }
}

function hayDniRepetido(dni, excepto) {
  for (let i = 0; i < TOTAL_INTEGRANTES; i++) {
    if (i !== excepto) {
      const otro = document.getElementById('dni-' + i);
      if (otro && (otro.value || '').trim() === dni) return true;
    }
  }
  return false;
}

function integranteVerificado(i) {
  return verificados[i] && verificados[i].dni;
}

function representanteSel() {
  const radio = document.querySelector('input[name="representante"]:checked');
  return radio ? parseInt(radio.value, 10) : 0;
}

// --------------------------------------------------------
// switch de modalidad
// --------------------------------------------------------
function aplicarModalidad() {
  const esJunior = modalidad === 'junior';
  const titulo = document.getElementById('titulo-concurso');
  const subtitulo = document.getElementById('subtitulo-concurso');
  const nota = document.getElementById('nota-modalidad');
  const seccionTematica = document.getElementById('seccion-tematica');
  const seccionSorteo = document.getElementById('seccion-sorteo');
  const btnEnviar = document.getElementById('btn-enviar');
  const inputArchivoMatricula = document.getElementById('archivo-matricula');

  if (esJunior) {
    titulo.textContent = 'Concurso BioDex Junior';
    subtitulo.textContent = 'Conocimientos en Ciencias Biológicas / Solo cachimbos (ingresantes 2026-I y 2026-II)';
    nota.innerHTML =
      'Equipo de 4 integrantes, todos cachimbos (ingresantes 2026-I o 2026-II), y líder/representante. ' +
      'Los 4 deben estar inscritos en el EXPOBIO 2026 con estado <strong>aprobado</strong>.';
    seccionTematica.classList.add('oculto-form');
    seccionSorteo.classList.remove('oculto-form');
    inputArchivoMatricula.required = true;
    btnEnviar.textContent = 'Inscribir equipo al BioDex Junior';
  } else {
    titulo.textContent = 'Concurso BioDex';
    subtitulo.textContent = 'Conocimientos en Ciencias Biológicas / Áreas Naturales Protegidas del Cusco · Bacterias';
    nota.innerHTML =
      'Equipo de 4 integrantes y líder/representante. Los 4 deben estar inscritos en el EXPOBIO 2026 ' +
      'con estado <strong>aprobado</strong>; se valida el DNI de cada uno al presionar "Verificar".';
    seccionTematica.classList.remove('oculto-form');
    seccionSorteo.classList.add('oculto-form');
    inputArchivoMatricula.required = true;
    btnEnviar.textContent = 'Inscribir equipo al BioDex';
  }

  verificados.length = 0;
  renderIntegrantes();
}

function cambiarModalidad(nueva) {
  if (nueva !== 'biodex' && nueva !== 'junior') return;
  modalidad = nueva;
  document.getElementById('toggle-concurso')
    .querySelectorAll('.btn-toggle-concurso')
    .forEach(function (btn) {
      btn.classList.toggle('activo', btn.dataset.modalidad === nueva);
    });
  aplicarModalidad();
}

// --------------------------------------------------------
// envío del equipo al backend
// --------------------------------------------------------
async function enviarEquipo() {
  const mensaje = document.getElementById('mensaje-form');
  const btnEnviar = document.getElementById('btn-enviar');
  const inputArchivoMatricula = document.getElementById('archivo-matricula');
  const nombreEquipo = document.getElementById('nombre-equipo').value.trim();
  const esJunior = modalidad === 'junior';
  const tematica = esJunior ? '' : document.getElementById('tematica').value;

  if (!nombreEquipo) {
    mensaje.className = 'error';
    mensaje.textContent = 'Ponle un nombre a tu equipo.';
    return;
  }
  if (!esJunior && !tematica) {
    mensaje.className = 'error';
    mensaje.textContent = 'Elige una temática para el equipo.';
    return;
  }

  // Integrantes: DNI verificado + semestre (solo Junior).
  const integrantes = [];
  for (let i = 0; i < TOTAL_INTEGRANTES; i++) {
    if (!integranteVerificado(i)) {
      mensaje.className = 'error';
      mensaje.textContent = 'Los 4 integrantes deben estar verificados y aprobados antes de inscribir al equipo.';
      return;
    }
    if (esJunior) {
      const sem = document.getElementById('semestre-' + i).value;
      if (!sem) {
        mensaje.className = 'error';
        mensaje.textContent = 'Indica el semestre de ingreso (2026-I o 2026-II) del integrante ' + (i + 1) + '.';
        return;
      }
      integrantes.push({
        dni: verificados[i].dni,
        nombres: verificados[i].nombres,
        semestre: sem,
        esRepresentante: i === representanteSel()
      });
    } else {
      integrantes.push({
        dni: verificados[i].dni,
        nombres: verificados[i].nombres,
        esRepresentante: i === representanteSel()
      });
    }
  }

  // Archivos.
  if (!inputArchivoMatricula.files[0]) {
    mensaje.className = 'error';
    mensaje.textContent = 'Adjunta la constancia de matrícula de los 4 integrantes en un solo PDF.';
    return;
  }
  const constanciaMatricula = inputArchivoMatricula.files[0];
  if (constanciaMatricula.type && constanciaMatricula.type !== 'application/pdf') {
    mensaje.className = 'error';
    mensaje.textContent = 'La constancia de matrícula debe adjuntarse como un archivo PDF.';
    return;
  }

  btnEnviar.disabled = true;
  btnEnviar.textContent = 'Inscribiendo equipo...';
  mensaje.className = '';

  try {
    const matriculaBase64 = await leerArchivoComoBase64(constanciaMatricula);

    const datos = {
      tipo: 'registroBioDex',
      modalidad: modalidad,
      nombreEquipo: nombreEquipo,
      tematica: tematica,
      integrantes: integrantes,
      constanciaMatriculaBase64: matriculaBase64,
      constanciaMatriculaNombre: constanciaMatricula.name
    };
    const respuesta = await enviarAConcursos(datos);

    if (!respuesta.ok) {
      throw new Error(respuesta.mensaje || 'No se pudo inscribir el equipo.');
    }

    const nombreConcurso = esJunior ? 'BioDex Junior' : 'BioDex';
    document.getElementById('texto-exito').textContent =
      '¡' + nombreEquipo + ' quedó inscrito en el ' + nombreConcurso + '!' +
      (esJunior ? '' : ' (temática: ' + tematica + ')');
    document.getElementById('form-concurso').style.display = 'none';
    document.getElementById('pantalla-exito').classList.add('visible');
  } catch (err) {
    mensaje.className = 'error';
    mensaje.textContent = 'Error: ' + (err && err.message ? err.message : 'intenta de nuevo');
  } finally {
    btnEnviar.disabled = false;
    btnEnviar.textContent = esJunior ? 'Inscribir equipo al BioDex Junior' : 'Inscribir equipo al BioDex';
  }
}

function reiniciarBiodex() {
  document.getElementById('pantalla-exito').classList.remove('visible');
  document.getElementById('form-concurso').style.display = 'block';
  document.getElementById('form-concurso').reset();
  verificados.length = 0;
  aplicarModalidad();
  const mensaje = document.getElementById('mensaje-form');
  mensaje.className = '';
  mensaje.textContent = '';
}

document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('toggle-concurso')
    .querySelectorAll('.btn-toggle-concurso')
    .forEach(function (btn) {
      btn.addEventListener('click', function () {
        cambiarModalidad(btn.dataset.modalidad);
      });
    });

  renderIntegrantes();

  document.getElementById('form-concurso').addEventListener('submit', function (e) {
    e.preventDefault();
    enviarEquipo();
  });

  // Limpia el estado de error al corregir el DNI.
  document.getElementById('contenedor-integrantes').addEventListener('input', function (e) {
    if (e.target && e.target.id && e.target.id.indexOf('dni-') === 0) {
      e.target.classList.remove('campo-invalido-form');
      const i = parseInt(e.target.id.split('-')[1], 10);
      const estadoDiv = document.getElementById('estado-' + i);
      verificados[i] = null;
      if (estadoDiv) {
        estadoDiv.className = 'verif-estado';
        estadoDiv.textContent = '';
      }
    }
  });
});