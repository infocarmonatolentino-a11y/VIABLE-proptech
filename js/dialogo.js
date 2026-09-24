/* =========================================================================
   DIÁLOGOS Y AVISOS
   -------------------------------------------------------------------------
   Sustituye a las 44 llamadas a alert() / confirm() / prompt() repartidas por
   el panel y la app de viabilidad.

   POR QUÉ, más allá de que queden feos:

   · Bloquean el hilo del navegador entero mientras están abiertos.
   · En el móvil salen con el nombre del dominio delante, lo que hace que la
     app parezca una web sospechosa justo en el momento de confirmar algo.
   · Y lo importante: cuando el usuario marca la casilla "impedir que esta
     página cree cuadros de diálogo" que Chrome y Firefox ofrecen tras el
     segundo o tercero seguido, confirm() pasa a devolver false SIEMPRE y
     prompt() devuelve null. A partir de ahí, para esa persona, la app deja
     de poder crear estudios, eliminar filas o recuperar borradores. Sin
     error, sin aviso y sin nada que registrar. Hay secuencias en el código
     con dos y tres diálogos seguidos, así que la casilla va a aparecer.

   CÓMO SE USA
   Todo devuelve promesas, así que la migración es línea por línea:

       if(confirm('¿Seguro?')) { … }
       -->
       if(await confirmar({ titulo:'¿Seguro?' })) { … }     (función async)

       const n = prompt('Nombre:', 'Estudio');
       -->
       const n = await pedirTexto({ titulo:'Nombre', valor:'Estudio' });

       alert('Guardado.');
       -->
       toast('Guardado.', 'ok');        // si es informativo
       await avisar({ titulo:'…' });    // si hay que pararse a leerlo

   No hay que reescribir ninguna lógica: el valor que devuelven es el mismo
   que devolvían los nativos (booleano, o texto/null).

   Está construido sobre el <dialog> nativo, que regala el atrapado de foco,
   el cierre con Escape y el fondo modal sin tener que programarlos.

   Cargar ANTES que el resto de scripts de la app, en las dos páginas.
   ========================================================================= */

(function (global) {
  'use strict';

  /* ---------------------------------------------------------------------
     Estilos. Se inyectan desde aquí para que el módulo funcione en las dos
     páginas sin tocar ninguna hoja de estilos. Se apoya en las variables
     que ya existen en ambas (--ink, --line, --brick, --moss, --steel) y
     lleva un valor de respaldo por si se usa en una tercera página.
     --------------------------------------------------------------------- */
  var CSS = `
  .dlg{
    border:none; padding:0; border-radius:12px; max-width:min(92vw, 460px); width:100%;
    background:var(--panel, #fff); color:var(--ink, #16233A);
    font-family:inherit; font-size:14.5px; line-height:1.55;
    box-shadow:0 18px 50px rgba(10,20,35,.28), 0 2px 8px rgba(10,20,35,.12);
  }
  .dlg::backdrop{ background:rgba(12,20,32,.44); backdrop-filter:blur(2px); }
  .dlg-cuerpo{ padding:24px 26px 20px; }
  .dlg-icono{
    width:38px; height:38px; border-radius:50%; display:flex; align-items:center;
    justify-content:center; font-size:19px; margin-bottom:14px; flex-shrink:0;
  }
  .dlg-icono.pregunta{ background:var(--steel-bg, #E4EBF3); color:var(--steel, #3A6EA5); }
  .dlg-icono.peligro { background:#F6E4DC; color:var(--brick, #A34E2C); }
  .dlg-icono.aviso   { background:#F4EBD6; color:var(--amber, #8F6516); }
  .dlg-icono.info    { background:#E4EBF3; color:var(--steel, #3A6EA5); }
  .dlg h2{
    margin:0 0 7px; font-size:17.5px; line-height:1.3; font-weight:600;
    font-family:inherit; color:var(--ink, #16233A);
  }
  .dlg p{ margin:0 0 4px; color:var(--ink-soft, #4B5D68); white-space:pre-line; }
  .dlg p + p{ margin-top:10px; }
  .dlg-campo{ margin-top:16px; }
  .dlg-campo label{
    display:block; font-size:12.5px; font-weight:600; margin-bottom:5px;
    color:var(--ink-soft, #4B5D68);
  }
  .dlg-campo input, .dlg-campo select, .dlg-campo textarea{
    width:100%; padding:10px 12px; border:1px solid var(--line, #DCE2E4);
    border-radius:7px; font-family:inherit; font-size:14.5px;
    background:var(--panel, #fff); color:var(--ink, #16233A);
  }
  .dlg-campo input:focus, .dlg-campo select:focus, .dlg-campo textarea:focus{
    outline:2px solid var(--steel, #1E6E8C); outline-offset:1px; border-color:transparent;
  }
  .dlg-campo .dlg-ayuda{ font-size:12px; color:var(--ink-soft, #6B7480); margin-top:5px; }
  .dlg-error{
    font-size:12.5px; color:var(--brick, #A34E2C); margin-top:7px; min-height:17px;
  }
  .dlg-pie{
    display:flex; gap:9px; justify-content:flex-end; padding:15px 26px 20px;
    border-top:1px solid var(--line-soft, #EAEDEE); flex-wrap:wrap;
  }
  .dlg-btn{
    font-family:inherit; font-size:14px; font-weight:500; padding:9px 17px;
    border-radius:7px; border:1px solid var(--line, #DCE2E4);
    background:var(--panel, #fff); color:var(--ink, #16233A); cursor:pointer;
  }
  .dlg-btn:hover{ background:var(--paper-soft, #F3F5F6); }
  .dlg-btn:focus-visible{ outline:2px solid var(--steel, #1E6E8C); outline-offset:2px; }
  .dlg-btn.principal{
    background:var(--ink, #16233A); border-color:var(--ink, #16233A); color:#fff;
  }
  .dlg-btn.principal:hover{ opacity:.9; background:var(--ink, #16233A); }
  .dlg-btn.peligro{
    background:var(--brick, #A34E2C); border-color:var(--brick, #A34E2C); color:#fff;
    margin-left:auto;
  }
  .dlg-btn.peligro:hover{ opacity:.9; background:var(--brick, #A34E2C); }
  .dlg-btn[disabled]{ opacity:.5; cursor:not-allowed; }

  /* Avisos efímeros */
  .dlg-toasts{
    position:fixed; left:50%; transform:translateX(-50%);
    bottom:calc(22px + env(safe-area-inset-bottom, 0px));
    display:flex; flex-direction:column-reverse; gap:8px; align-items:center;
    z-index:9999; pointer-events:none; width:max-content; max-width:92vw;
  }
  .dlg-toast{
    display:flex; align-items:flex-start; gap:9px;
    background:var(--ink, #16233A); color:#fff;
    padding:11px 16px; border-radius:9px; font-size:13.5px; line-height:1.45;
    box-shadow:0 8px 26px rgba(0,0,0,.26);
    opacity:0; transform:translateY(12px);
    transition:opacity .18s ease, transform .18s ease;
    pointer-events:auto; max-width:min(90vw, 460px); border-left:3px solid transparent;
  }
  .dlg-toast.visible{ opacity:1; transform:translateY(0); }
  .dlg-toast.ok{ border-left-color:#4E9E78; }
  .dlg-toast.error{ border-left-color:#D2704B; }
  .dlg-toast.aviso{ border-left-color:#D2A44B; }
  .dlg-toast .dlg-toast-x{
    background:none; border:none; color:#9FB0C6; cursor:pointer; font-size:15px;
    line-height:1; padding:1px 0 0 4px; margin-left:4px; flex-shrink:0;
  }
  .dlg-toast .dlg-toast-x:hover{ color:#fff; }

  @media (prefers-reduced-motion: reduce){
    .dlg-toast{ transition:none; }
  }
  @media (max-width:480px){
    .dlg-pie{ flex-direction:column-reverse; }
    .dlg-pie .dlg-btn{ width:100%; }
    .dlg-btn.peligro{ margin-left:0; }
  }
  `;

  function inyectarEstilos() {
    if (document.getElementById('dlg-estilos')) return;
    var st = document.createElement('style');
    st.id = 'dlg-estilos';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function esc(x) {
    return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* =====================================================================
     AVISOS EFÍMEROS (toast)
     Para lo que se lee de reojo y no requiere decidir nada. Si el mensaje
     obliga a parar y leer, no es un toast: es avisar().
     ===================================================================== */
  var hostToasts = null;

  function toast(mensaje, tipo, opciones) {
    inyectarEstilos();
    opciones = opciones || {};
    if (!hostToasts) {
      hostToasts = document.createElement('div');
      hostToasts.className = 'dlg-toasts';
      hostToasts.setAttribute('role', 'status');
      hostToasts.setAttribute('aria-live', 'polite');
      document.body.appendChild(hostToasts);
    }
    var el = document.createElement('div');
    el.className = 'dlg-toast' + (tipo ? ' ' + tipo : '');
    el.innerHTML = '<span>' + esc(mensaje) + '</span>' +
      '<button type="button" class="dlg-toast-x" aria-label="Cerrar aviso">&times;</button>';
    hostToasts.appendChild(el);
    // Fuerza un reflow para que la transición de entrada se vea.
    void el.offsetWidth;
    el.classList.add('visible');

    var duracion = opciones.duracion != null ? opciones.duracion
                 : (tipo === 'error' ? 6500 : 3200);   // los errores, más tiempo
    var temporizador = null;
    function cerrar() {
      clearTimeout(temporizador);
      el.classList.remove('visible');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
    }
    el.querySelector('.dlg-toast-x').addEventListener('click', cerrar);
    if (duracion > 0) temporizador = setTimeout(cerrar, duracion);
    // Si el ratón está encima, no se va: da tiempo a leer un error largo.
    el.addEventListener('mouseenter', function () { clearTimeout(temporizador); });
    el.addEventListener('mouseleave', function () {
      if (duracion > 0) temporizador = setTimeout(cerrar, 1200);
    });
    return cerrar;
  }

  /* =====================================================================
     MODAL BASE
     ===================================================================== */
  function abrirModal(config) {
    inyectarEstilos();
    var focoPrevio = document.activeElement;

    var dlg = document.createElement('dialog');
    dlg.className = 'dlg';
    dlg.innerHTML =
      '<div class="dlg-cuerpo">' +
        (config.icono ? '<div class="dlg-icono ' + config.icono + '" aria-hidden="true">' + config.simbolo + '</div>' : '') +
        '<h2>' + esc(config.titulo) + '</h2>' +
        (config.texto ? '<p>' + esc(config.texto) + '</p>' : '') +
        (config.html || '') +
      '</div>' +
      '<div class="dlg-pie">' + config.botones + '</div>';

    document.body.appendChild(dlg);

    var resolver;
    var promesa = new Promise(function (r) { resolver = r; });
    var yaResuelto = false;

    function terminar(valor) {
      if (yaResuelto) return;
      yaResuelto = true;
      // close() puede disparar el evento 'close', de ahí la guarda de arriba.
      if (dlg.open) dlg.close();
      if (dlg.parentNode) dlg.parentNode.removeChild(dlg);
      // Devolver el foco a donde estaba: si no, al cerrar se pierde y el
      // teclado vuelve al principio de la página.
      if (focoPrevio && typeof focoPrevio.focus === 'function') {
        try { focoPrevio.focus(); } catch (e) { /* el elemento ya no existe */ }
      }
      resolver(valor);
    }

    // Escape y el botón de cierre del navegador: equivalen a cancelar.
    dlg.addEventListener('cancel', function (ev) {
      ev.preventDefault();
      terminar(config.valorCancelar);
    });
    // Clic en el fondo oscuro: también cancela.
    dlg.addEventListener('click', function (ev) {
      if (ev.target === dlg) terminar(config.valorCancelar);
    });

    dlg.showModal();
    if (config.alAbrir) config.alAbrir(dlg, terminar);
    return { dlg: dlg, promesa: promesa, terminar: terminar };
  }

  /* =====================================================================
     avisar() — sustituye a alert() cuando hay que pararse a leer
     ===================================================================== */
  function avisar(opciones) {
    if (typeof opciones === 'string') opciones = { titulo: opciones };
    opciones = opciones || {};
    // `html` es un escape a propósito para contenido ya compuesto por quien
    // llama (por ejemplo, una lista de casos de un error). Quien lo use es
    // responsable de escapar los datos variables con esc() antes de montarlo;
    // aquí no se vuelve a escapar porque, si no, no se podría meter marcado.
    var m = abrirModal({
      icono: opciones.tipo === 'error' ? 'peligro' : (opciones.tipo === 'aviso' ? 'aviso' : 'info'),
      simbolo: opciones.tipo === 'error' ? '!' : (opciones.tipo === 'aviso' ? '!' : 'i'),
      titulo: opciones.titulo || 'Aviso',
      texto: opciones.texto || '',
      html: opciones.html || '',
      botones: '<button type="button" class="dlg-btn principal" data-aceptar>' +
               esc(opciones.aceptar || 'Entendido') + '</button>',
      valorCancelar: undefined,
      alAbrir: function (dlg, terminar) {
        var b = dlg.querySelector('[data-aceptar]');
        b.addEventListener('click', function () { terminar(undefined); });
        b.focus();
      }
    });
    return m.promesa;
  }

  /* =====================================================================
     confirmar() — sustituye a confirm()
     `peligroso: true` para lo que no tiene vuelta atrás: cambia el color
     del botón y lo separa del de cancelar, para que no se pulse de carrerilla.
     ===================================================================== */
  function confirmar(opciones) {
    if (typeof opciones === 'string') opciones = { titulo: opciones };
    opciones = opciones || {};
    var peligroso = !!opciones.peligroso;
    var m = abrirModal({
      icono: peligroso ? 'peligro' : 'pregunta',
      simbolo: peligroso ? '!' : '?',
      titulo: opciones.titulo || '¿Continuar?',
      texto: opciones.texto || '',
      botones:
        '<button type="button" class="dlg-btn" data-cancelar>' +
          esc(opciones.cancelar || 'Cancelar') + '</button>' +
        '<button type="button" class="dlg-btn ' + (peligroso ? 'peligro' : 'principal') + '" data-aceptar>' +
          esc(opciones.aceptar || (peligroso ? 'Eliminar' : 'Continuar')) + '</button>',
      valorCancelar: false,
      alAbrir: function (dlg, terminar) {
        dlg.querySelector('[data-aceptar]').addEventListener('click', function () { terminar(true); });
        dlg.querySelector('[data-cancelar]').addEventListener('click', function () { terminar(false); });
        // En lo destructivo, el foco arranca en Cancelar: pulsar Enter sin
        // leer no debe borrar nada.
        dlg.querySelector(peligroso ? '[data-cancelar]' : '[data-aceptar]').focus();
      }
    });
    return m.promesa;
  }

  /* =====================================================================
     pedirTexto() — sustituye a prompt()
     ===================================================================== */
  function pedirTexto(opciones) {
    if (typeof opciones === 'string') opciones = { titulo: opciones };
    opciones = opciones || {};
    return pedirCampos({
      titulo: opciones.titulo || 'Escribe un valor',
      texto: opciones.texto || '',
      aceptar: opciones.aceptar || 'Aceptar',
      campos: [{
        clave: 'valor',
        etiqueta: opciones.etiqueta || '',
        valor: opciones.valor || '',
        marcador: opciones.marcador || '',
        ayuda: opciones.ayuda || '',
        requerido: opciones.requerido !== false
      }]
    }).then(function (res) {
      return res === null ? null : res.valor;
    });
  }

  /* =====================================================================
     pedirCampos() — varios datos de una vez
     Pensado para reemplazar las cadenas de dos y tres prompt() seguidos,
     como la de "+ Nuevo estudio", que hoy pregunta el nombre en un cuadro
     y la ubicación en otro.

       await pedirCampos({
         titulo:'Nuevo estudio',
         campos:[
           { clave:'nombre',    etiqueta:'Nombre del estudio', requerido:true },
           { clave:'ubicacion', etiqueta:'Ubicación', ayuda:'Puedes dejarlo en blanco' }
         ]
       });
       // -> { nombre:'…', ubicacion:'…' }  o  null si se cancela
     ===================================================================== */
  function pedirCampos(opciones) {
    opciones = opciones || {};
    var campos = opciones.campos || [];

    var html = campos.map(function (c, i) {
      var id = 'dlg-c-' + i;
      var control;
      if (c.tipo === 'select') {
        control = '<select id="' + id + '" data-clave="' + esc(c.clave) + '">' +
          (c.opciones || []).map(function (o) {
            var v = (o && o.valor !== undefined) ? o.valor : o;
            var t = (o && o.texto !== undefined) ? o.texto : o;
            return '<option value="' + esc(v) + '"' + (v === c.valor ? ' selected' : '') + '>' + esc(t) + '</option>';
          }).join('') + '</select>';
      } else if (c.tipo === 'textarea') {
        control = '<textarea id="' + id + '" rows="3" data-clave="' + esc(c.clave) + '" placeholder="' +
          esc(c.marcador || '') + '">' + esc(c.valor || '') + '</textarea>';
      } else {
        control = '<input id="' + id + '" type="' + esc(c.tipo || 'text') + '" data-clave="' + esc(c.clave) +
          '" value="' + esc(c.valor || '') + '" placeholder="' + esc(c.marcador || '') + '"' +
          (c.requerido ? ' data-requerido="1"' : '') + '>';
      }
      return '<div class="dlg-campo">' +
        (c.etiqueta ? '<label for="' + id + '">' + esc(c.etiqueta) + '</label>' : '') +
        control +
        (c.ayuda ? '<div class="dlg-ayuda">' + esc(c.ayuda) + '</div>' : '') +
        '</div>';
    }).join('') + '<div class="dlg-error" data-error></div>';

    var m = abrirModal({
      titulo: opciones.titulo || 'Datos',
      texto: opciones.texto || '',
      html: html,
      botones:
        '<button type="button" class="dlg-btn" data-cancelar>' + esc(opciones.cancelar || 'Cancelar') + '</button>' +
        '<button type="button" class="dlg-btn principal" data-aceptar>' + esc(opciones.aceptar || 'Guardar') + '</button>',
      valorCancelar: null,
      alAbrir: function (dlg, terminar) {
        var elError = dlg.querySelector('[data-error]');

        function recoger() {
          var salida = {};
          var falta = null;
          dlg.querySelectorAll('[data-clave]').forEach(function (el) {
            var v = el.value.trim();
            salida[el.dataset.clave] = v;
            if (!falta && el.dataset.requerido && !v) falta = el;
          });
          if (falta) {
            var etiqueta = dlg.querySelector('label[for="' + falta.id + '"]');
            elError.textContent = 'Falta rellenar «' + (etiqueta ? etiqueta.textContent : 'este campo') + '».';
            falta.focus();
            return null;
          }
          return salida;
        }

        dlg.querySelector('[data-aceptar]').addEventListener('click', function () {
          var r = recoger();
          if (r) terminar(r);
        });
        dlg.querySelector('[data-cancelar]').addEventListener('click', function () { terminar(null); });

        // Enter acepta, salvo dentro de un textarea, donde hace salto de línea.
        dlg.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' && ev.target.tagName !== 'TEXTAREA') {
            ev.preventDefault();
            var r = recoger();
            if (r) terminar(r);
          }
        });
        // Al escribir, se limpia el mensaje de error: no debe quedarse fijo.
        dlg.querySelectorAll('[data-clave]').forEach(function (el) {
          el.addEventListener('input', function () { elError.textContent = ''; });
        });

        var primero = dlg.querySelector('[data-clave]');
        if (primero) { primero.focus(); if (primero.select) primero.select(); }
      }
    });
    return m.promesa;
  }

  /* =====================================================================
     confirmarEscribiendo() — para lo irreversible de verdad
     Obliga a teclear el nombre de lo que se va a destruir. No lo uses para
     todo: solo donde equivocarse de fila cuesta caro (eliminar la empresa,
     vaciar la papelera, dar de baja a alguien con estudios sin reasignar).
     ===================================================================== */
  function confirmarEscribiendo(opciones) {
    opciones = opciones || {};
    var esperado = String(opciones.confirmacion || '').trim();
    var m = abrirModal({
      icono: 'peligro',
      simbolo: '!',
      titulo: opciones.titulo || '¿Seguro?',
      texto: opciones.texto || '',
      html: '<div class="dlg-campo">' +
              '<label for="dlg-conf">Escribe «' + esc(esperado) + '» para confirmar</label>' +
              '<input id="dlg-conf" type="text" autocomplete="off">' +
            '</div><div class="dlg-error" data-error></div>',
      botones:
        '<button type="button" class="dlg-btn" data-cancelar>Cancelar</button>' +
        '<button type="button" class="dlg-btn peligro" data-aceptar disabled>' +
          esc(opciones.aceptar || 'Eliminar definitivamente') + '</button>',
      valorCancelar: false,
      alAbrir: function (dlg, terminar) {
        var input = dlg.querySelector('#dlg-conf');
        var btn = dlg.querySelector('[data-aceptar]');
        input.addEventListener('input', function () {
          btn.disabled = input.value.trim() !== esperado;
        });
        btn.addEventListener('click', function () {
          if (input.value.trim() === esperado) terminar(true);
        });
        dlg.querySelector('[data-cancelar]').addEventListener('click', function () { terminar(false); });
        input.focus();
      }
    });
    return m.promesa;
  }

  /* =====================================================================
     Exportación
     Se publica como objeto Dialogo y también como funciones sueltas, para
     que la migración desde alert/confirm/prompt sea un cambio de nombre y
     nada más.
     ===================================================================== */
  var API = {
    toast: toast,
    avisar: avisar,
    confirmar: confirmar,
    pedirTexto: pedirTexto,
    pedirCampos: pedirCampos,
    confirmarEscribiendo: confirmarEscribiendo
  };

  global.Dialogo = API;
  global.toast = global.toast || toast;
  global.avisar = avisar;
  global.confirmar = confirmar;
  global.pedirTexto = pedirTexto;
  global.pedirCampos = pedirCampos;
  global.confirmarEscribiendo = confirmarEscribiendo;

  /* El panel ya tenía su propio showToast(). Se mantiene el nombre para no
     tener que tocar sus 20 llamadas, pero pasa por aquí: así los dos sitios
     usan el mismo aviso y se puede borrar el <div id="toast"> del HTML. */
  global.showToast = function (mensaje, tipo) { return toast(mensaje, tipo); };

})(window);
