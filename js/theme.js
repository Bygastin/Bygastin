// Se carga en el <head>: marca que hay JS y aplica el tema guardado antes de pintar.
(function () {
  document.documentElement.classList.add('js');
  try {
    var t = localStorage.getItem('gr-theme');
    // Solo se aceptan los dos valores conocidos
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  } catch (e) { /* almacenamiento bloqueado: se usa el tema por defecto */ }
})();
