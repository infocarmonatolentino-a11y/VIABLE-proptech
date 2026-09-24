/* =========================================================================
   REGISTRO DE ERRORES
   -------------------------------------------------------------------------
   Sustituye a js/error-logger.js y al bloque equivalente que estaba copiado
   dentro de Dashboard_v4.html. Un solo archivo para las dos páginas: antes
   eran dos copias del mismo código que podían desincronizarse.

   QUÉ CAMBIA DE VERDAD

   Los loggers anteriores solo capturaban window.onerror y las promesas no
   controladas, es decir, los fallos de programación. Pero la mayoría de lo
   que le sale mal a un delegado un martes por la tarde no lanza ninguna
   excepción: es una respuesta de error de Supabase que el código maneja
   educadamente con

       if(error){ console.error(error); showToast('No se pudo guardar.'); }

   Ese patrón aparece por todo el panel y por bridge.js. Permisos, políticas
   RLS, red caída, conflictos de clave única. Nada de eso llegaba nunca a la
   base de datos, así que la pantalla de errores habría estado casi vacía
   mientras los clientes se quejaban.

   Por eso lo importante de este archivo no es el capturador automático: es
   reportar(), pensada para llamarla a mano en cada uno de esos sitios.

       const { error } = await sb.from('estudios').update(payload).eq('id', id);
       if(error){
         reportar('guardar estudio', error);      // <-- una línea
         toast('No se ha podido guardar.', 'error');
         return;
       }

   El primer argumento es el CONTEXTO: qué se estaba intentando hacer. Es lo
   que convierte "TypeError: x is null" en "al guardar un estudio". Y es lo
   que agrupa la tabla, junto con el mensaje.

   Cargar ANTES que el resto de scripts, en las dos páginas.
   ========================================================================= */

(function (global) {
  'use strict';

  /* Número de versión de la app. Va con cada error registrado, y es lo que
     permite saber si un fallo que creías arreglado ha vuelto. Súbelo en cada
     publicación, y usa el mismo valor en el ?v= de los <script> del HTML
     para que los navegadores no se queden con la versión vieja en caché. */
  var VERSION_APP = '1.3.1';

  /* Límites para que el registro no se convierta él mismo en el problema:
     un error dentro de un bucle de renderizado podría generar miles de
     inserciones por minuto. */
  var MAX_POR_CARGA = 20;
  var enviados = 0;
  var yaVistos = new Set();

  var _cliente = null;    // cliente de supabase-js
  var _usuarioId = null;
  var _organizacionId = null;
  var _app = 'desconocida';

  /* Errores ocurridos antes de que haya sesión: se guardan y se envían en
     cuanto la haya. Antes se perdían, y justo ahí es donde están los fallos
     de arranque, que son los peores. */
  var pendientes = [];

  /**
   * Arranca el registro. Llamar en cuanto se tenga sesión.
   *   iniciarRegistro({ cliente: sb, app: 'dashboard',
   *                     usuarioId: session.user.id,
   *                     organizacionId: miPerfil.organizacion_id });
   */
  function iniciarRegistro(opciones) {
    opciones = opciones || {};
    _cliente = opciones.cliente || _cliente;
    _app = opciones.app || _app;
    _usuarioId = opciones.usuarioId || _usuarioId;
    _organizacionId = opciones.organizacionId != null ? opciones.organizacionId : _organizacionId;

    // Vaciar lo que se acumuló antes de tener sesión.
    var cola = pendientes;
    pendientes = [];
    cola.forEach(function (p) { enviar(p.contexto, p.mensaje, p.detalle); });
  }

  function textoDeError(error) {
    if (!error) return '';
    if (typeof error === 'string') return error;
    // Los errores de supabase-js traen message, y a veces code, details y hint.
    // Todos ayudan a entender qué pasó, sobre todo `code`: 23505 es clave
    // duplicada, 42501 es permiso denegado por RLS, PGRST116 es fila no
    // encontrada. Perderlos deja el error sin diagnóstico.
    if (error.message) {
      var partes = [error.message];
      if (error.code) partes.push('[' + error.code + ']');
      return partes.join(' ');
    }
    try { return JSON.stringify(error); } catch (e) { return String(error); }
  }

  function detalleDeError(error) {
    if (!error || typeof error === 'string') return null;
    var trozos = [];
    if (error.stack) trozos.push(error.stack);
    if (error.details) trozos.push('details: ' + error.details);
    if (error.hint) trozos.push('hint: ' + error.hint);
    return trozos.length ? trozos.join('\n') : null;
  }

  function enviar(contexto, mensaje, detalle) {
    // Nunca bloquear ni lanzar: un fallo del registro de errores no puede
    // convertirse en un error nuevo. Toda esta función es best-effort.
    try {
      if (!_cliente || !_usuarioId) {
        // Sin sesión todavía: se guarda para enviarlo al arrancar.
        if (pendientes.length < MAX_POR_CARGA) {
          pendientes.push({ contexto: contexto, mensaje: mensaje, detalle: detalle });
        }
        return;
      }
      if (enviados >= MAX_POR_CARGA) return;

      var clave = (contexto || '') + '|' + String(mensaje || '').slice(0, 200);
      if (!mensaje || yaVistos.has(clave)) return;   // no repetir el mismo una y otra vez
      yaVistos.add(clave);
      enviados++;

      _cliente.from('logs_errores').insert({
        organizacion_id: _organizacionId || null,
        usuario_id: _usuarioId,
        app: _app,
        contexto: contexto ? String(contexto).slice(0, 120) : null,
        mensaje: String(mensaje).slice(0, 500),
        detalle: detalle ? String(detalle).slice(0, 4000) : null,
        url: location.href,
        user_agent: navigator.userAgent ? navigator.userAgent.slice(0, 400) : null,
        version_app: VERSION_APP
      }).then(function (res) {
        // Si el propio registro falla, que al menos se vea en la consola del
        // navegador. Un catch mudo aquí fue exactamente lo que hizo que no se
        // notara que la tabla no existía.
        if (res && res.error) console.warn('No se pudo registrar el error:', res.error.message);
      }, function (e) {
        console.warn('No se pudo registrar el error:', e);
      });
    } catch (e) {
      console.warn('Fallo del propio registro de errores:', e);
    }
  }

  /**
   * Registra un error con su contexto. Esta es la que hay que llamar a mano
   * en cada `if(error){ … }` del código.
   *
   *   reportar('compartir estudio', error);
   *   reportar('cargar configuración maestra', error);
   *
   * Siempre saca el error por consola también, para no perder el
   * comportamiento de depuración que ya había.
   */
  function reportar(contexto, error) {
    console.error('[' + contexto + ']', error);
    enviar(contexto, textoDeError(error), detalleDeError(error));
  }

  /**
   * Envoltorio para las llamadas a Supabase, para no repetir el mismo
   * if(error) en 40 sitios. Devuelve los datos, o null si falló.
   *
   *   const datos = await intentar('cargar estudios',
   *     () => sb.from('estudios').select('*'),
   *     'No se han podido cargar los estudios.');
   *   if(!datos) return;
   */
  async function intentar(contexto, operacion, mensajeUsuario) {
    try {
      var res = await operacion();
      if (res && res.error) {
        reportar(contexto, res.error);
        if (mensajeUsuario && global.toast) global.toast(mensajeUsuario, 'error');
        return null;
      }
      return res ? res.data : null;
    } catch (e) {
      reportar(contexto, e);
      if (mensajeUsuario && global.toast) global.toast(mensajeUsuario, 'error');
      return null;
    }
  }

  /* ---------- Capturadores automáticos ---------- */
  global.addEventListener('error', function (ev) {
    // Los errores de carga de recursos (una imagen rota, un script que no
    // baja) también llegan aquí, pero sin ev.error. Interesan igual: un CDN
    // caído deja la app sin supabase-js y no hay forma de enterarse.
    if (ev.error) {
      enviar('error no capturado', ev.message, ev.error.stack);
    } else if (ev.target && ev.target.src) {
      enviar('recurso no cargado', 'No se pudo cargar: ' + ev.target.src, null);
    }
  }, true);   // en fase de captura, que es donde llegan los fallos de recursos

  global.addEventListener('unhandledrejection', function (ev) {
    var razon = ev.reason;
    enviar('promesa no controlada', textoDeError(razon) || String(razon), detalleDeError(razon));
  });

  /* ---------- Exportación ---------- */
  global.iniciarRegistro = iniciarRegistro;
  global.reportar = reportar;
  global.intentar = intentar;
  global.VERSION_APP = VERSION_APP;

  global.Registro = {
    iniciar: iniciarRegistro,
    reportar: reportar,
    intentar: intentar,
    version: VERSION_APP
  };

})(window);
