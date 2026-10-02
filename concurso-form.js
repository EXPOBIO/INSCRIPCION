// ==========================================================
// concurso-form.js — lógica compartida por los formularios de
// concursos (concurso-biodex.html, concurso-danza.html, ...)
//
// Antes de incluir este script, cada página debe definir:
//   window.CONCURSO = {
//     nombre: 'Fotografía',
//     titulo: 'Concurso de Fotografía',
//     subtitulo: '...',
//     campos: [ { clave, etiqueta, tipo, ayuda?, opciones? }, ... ],
//     archivo: { etiqueta, accept }   |   null
//   };
// ==========================================================

function inicializarConcursoForm() {
  const def = window.CONCURSO;

  const form = document.getElementById('form-concurso');
  const btnEnviar = document.getElementById('btn-enviar');
  const mensaje = document.getElementById('mensaje-form');
  const pantallaExito = document.getElementById('pantalla-exito');
  const textoExito = document.getElementById('texto-exito');
  const seccionCampos = document.getElementById('seccion-campos');
  const seccionArchivo = document.getElementById('seccion-archivo');
  const camposConcurso = document.getElementById('campos-concurso');
  const archivoEtiqueta = document.getElementById('archivo-etiqueta');
  const inputArchivo = document.getElementById('archivo');

  // DNI y estado de verificación (obligatorio para todos los concursos).
  const inputDni = document.getElementById('dni');
  const btnVerificar = document.getElementById('btn-verificar');
  const estadoDni = document.getElementById('estado-dni');
  let dniVerificado = null; // { dni, nombres, esOrganizador }

  // Renderiza los campos específicos del concurso.
  const html = def.campos.map(function (campo) {
    let control;
    if (campo.tipo === 'textarea') {
      control = '<textarea id="' + campo.clave + '" name="' + campo.clave + '" rows="4" required></textarea>';
    } else if (campo.tipo === 'select') {
      const opciones = campo.opciones.map(function (o) {
        return '<option value="' + o + '">' + o + '</option>';
      }).join('');
      control = '<select id="' + campo.clave + '" name="' + campo.clave + '" required><option value="">Seleccione una opción</option>' + opciones + '</select>';
    } else {
      control = '<input type="text" id="' + campo.clave + '" name="' + campo.clave + '" required>';
    }
    return '<div class="campo-form">' +
      '<label for="' + campo.clave + '">' + campo.etiqueta + '</label>' +
      control +
      (campo.ayuda ? '<div class="ayuda-form">' + campo.ayuda + '</div>' : '') +
      '</div>';
  }).join('');
  camposConcurso.innerHTML = html;

  // Sección de archivo: solo si el concurso lo pide.
  if (def.archivo) {
    seccionArchivo.classList.remove('oculto-form');
    archivoEtiqueta.textContent = def.archivo.etiqueta;
    inputArchivo.setAttribute('accept', def.archivo.accept);
    inputArchivo.required = true;
  } else {
    seccionArchivo.classList.add('oculto-form');
    inputArchivo.required = false;
    inputArchivo.removeAttribute('accept');
  }

  activarLimpiezaDeErrores(form);

  // Verificación del representante por DNI.
  btnVerificar.addEventListener('click', async function () {
    const dni = (inputDni.value || '').trim();
    estadoDni.className = 'verif-estado';
    estadoDni.textContent = '';
    dniVerificado = null;
    inputDni.classList.remove('campo-invalido-form');

    if (!/^\d{8}$/.test(dni)) {
      estadoDni.className = 'verif-estado mal visible';
      estadoDni.textContent = 'Ingresa un DNI válido de 8 dígitos.';
      inputDni.classList.add('campo-invalido-form');
      return;
    }

    btnVerificar.disabled = true;
    btnVerificar.textContent = 'Verificando...';
    try {
      const respuesta = await verificarDniConcurso(dni);
      if (!respuesta.encontrado) {
        estadoDni.className = 'verif-estado mal visible';
        estadoDni.textContent = 'Este DNI no está inscrito en el EXPOBIO 2026. Primero inscríbete al evento.';
        inputDni.classList.add('campo-invalido-form');
        return;
      }
      if (respuesta.estado !== 'aprobado') {
        estadoDni.className = 'verif-estado pendiente visible';
        estadoDni.textContent = 'Su inscripción figura como "' + (respuesta.estado || 'sin validar') +
          '". Solo pueden concursar los inscritos aprobados.';
        inputDni.classList.add('campo-invalido-form');
        return;
      }
      dniVerificado = { dni: dni, nombres: respuesta.nombres || '', esOrganizador: !!respuesta.esOrganizador };
      estadoDni.className = 'verif-estado bien visible';
      estadoDni.textContent = '✓ Inscrito y aprobado' + (dniVerificado.esOrganizador ? ' (organizador)' : '') +
        '. ' + dniVerificado.nombres;
      inputDni.classList.remove('campo-invalido-form');
    } catch (err) {
      estadoDni.className = 'verif-estado mal visible';
      estadoDni.textContent = 'Error: ' + (err && err.message ? err.message : 'intenta de nuevo');
      inputDni.classList.add('campo-invalido-form');
    } finally {
      btnVerificar.disabled = false;
      btnVerificar.textContent = 'Verificar';
    }
  });

  // Al corregir el DNI se borra el estado de verificación anterior.
  inputDni.addEventListener('input', function () {
    inputDni.classList.remove('campo-invalido-form');
    dniVerificado = null;
    estadoDni.className = 'verif-estado';
    estadoDni.textContent = '';
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    if (!dniVerificado) {
      mensaje.className = 'error';
      mensaje.textContent = 'Presiona "Verificar" con tu DNI antes de inscribirte.';
      return;
    }

    if (formularioTieneEspaciosVacios(form)) {
      mensaje.className = 'error';
      mensaje.textContent = 'Hay campos sin completar (marcados en rojo). Revisa que no queden vacíos.';
      return;
    }

    if (def.archivo) {
      const archivo = inputArchivo.files[0];
      if (!archivo) {
        mensaje.className = 'error';
        mensaje.textContent = 'Adjunta el archivo de participación.';
        return;
      }
      const esImagen = archivo.type && archivo.type.indexOf('image/') === 0;
      const esPdf = archivo.type === 'application/pdf';
      if (!esImagen && !esPdf) {
        mensaje.className = 'error';
        mensaje.textContent = 'El archivo debe ser una imagen o un PDF, según lo que pide el concurso.';
        return;
      }
    }

    btnEnviar.disabled = true;
    btnEnviar.textContent = 'Enviando...';
    mensaje.className = '';

    const detalles = {};
    def.campos.forEach(function (campo) {
      const el = document.getElementById(campo.clave);
      if (el) detalles[campo.etiqueta] = el.value.trim();
    });

    let archivoBase64 = null;
    let archivoNombre = '';
    if (def.archivo && inputArchivo.files[0]) {
      archivoBase64 = await leerArchivoComoBase64(inputArchivo.files[0]);
      archivoNombre = inputArchivo.files[0].name;
    }

    const datos = {
      tipo: 'Concurso',
      dni: dniVerificado.dni,
      concurso: def.nombre,
      archivoBase64: archivoBase64,
      archivoNombre: archivoNombre,
      nombres: dniVerificado.nombres,
      detalles: JSON.stringify(detalles)
    };

    enviarInscripcion(datos)
      .then(function (respuesta) {
        btnEnviar.disabled = false;
        btnEnviar.textContent = 'Inscribirme al concurso';
        if (respuesta.ok) {
          textoExito.textContent = respuesta.mensaje;
          form.style.display = 'none';
          pantallaExito.classList.add('visible');
        } else {
          mensaje.className = 'error';
          mensaje.textContent = respuesta.mensaje;
        }
      })
      .catch(function (error) {
        btnEnviar.disabled = false;
        btnEnviar.textContent = 'Inscribirme al concurso';
        mensaje.className = 'error';
        mensaje.textContent = 'Error: ' + error.message;
      });
  });
}