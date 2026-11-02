/* Alterna IA — acceso rápido: botón flotante que lleva a la página dedicada (ia.html). */
(function () {
    const fab = document.createElement("a");
    fab.className = "aai-fab"; fab.href = "ia.html"; fab.title = "Alterna IA"; fab.setAttribute("aria-label", "Abrir Alterna IA");
    fab.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2zm7 11l.9 2.6L22.5 16.5l-2.6.9L19 20l-.9-2.6-2.6-.9 2.6-.9L19 13zM5 14l.7 2 2 .7-2 .7L5 19.5l-.7-2.1-2-.7 2-.7L5 14z"/></svg>';
    document.body.appendChild(fab);
})();
