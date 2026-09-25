"use strict";

document.getElementById("retry").addEventListener("click", () => location.reload());
// Voltou a internet: abre o site sozinho.
window.addEventListener("online", () => { location.href = "index.html"; });
