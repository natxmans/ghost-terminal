// Protection anti-copie : bloque la sélection, la copie, le clic droit, le glisser-déposer
// et les raccourcis qui servent à récupérer le code (copier, tout sélectionner, enregistrer,
// afficher la source, imprimer, outils de développement).
(() => {
  "use strict";

  const isField = (el) => el instanceof Element && el.closest("input, select, textarea");
  let lastNotice = 0;

  function blocked(e, msg = "🔒 Copie interdite") {
    e.preventDefault();
    e.stopImmediatePropagation();
    const t = Date.now();
    if (t - lastNotice > 1500) {
      lastNotice = t;
      window.dispatchEvent(new CustomEvent("ht-blocked", { detail: msg }));
    }
  }

  // Clic droit
  document.addEventListener("contextmenu", (e) => blocked(e, "🔒 Clic droit désactivé"), true);

  // Sélection et glisser-déposer
  document.addEventListener("selectstart", (e) => { if (!isField(e.target)) e.preventDefault(); }, true);
  document.addEventListener("dragstart", (e) => e.preventDefault(), true);

  // Copier / couper : on remplace le contenu du presse-papiers
  for (const type of ["copy", "cut"]) {
    document.addEventListener(type, (e) => {
      if (isField(e.target)) return; // ton propre texte dans les réglages : autorisé
      if (e.clipboardData) e.clipboardData.setData("text/plain", "🔒 Ghost Terminal : copie interdite.");
      blocked(e);
    }, true);
  }

  // Raccourcis clavier
  window.addEventListener("keydown", (e) => {
    const k = (e.key || "").toLowerCase();
    const mod = e.ctrlKey || e.metaKey;

    if (k === "f12") return blocked(e, "🔒 Outils de développement désactivés");
    // Ctrl+Maj+I / J / C / K (Chrome, Edge, Firefox) et Cmd+Option+I / J / C (Mac)
    if (mod && (e.shiftKey || e.altKey) && ["i", "j", "c", "k"].includes(k)) {
      return blocked(e, "🔒 Outils de développement désactivés");
    }
    if (mod && !e.shiftKey && !e.altKey) {
      if (["c", "x", "a"].includes(k)) {
        if (isField(document.activeElement)) return;
        return blocked(e);
      }
      if (k === "s") return blocked(e, "🔒 Enregistrement désactivé");
      if (k === "u") return blocked(e, "🔒 Code source protégé");
      if (k === "p") return blocked(e, "🔒 Impression désactivée");
    }
  }, true);

  // Si quelque chose a quand même été sélectionné, on l'efface
  document.addEventListener("selectionchange", () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && !sel.isCollapsed && !isField(document.activeElement)) sel.removeAllRanges();
  });
})();
