// Applique le thème choisi avant le premier affichage (fichier séparé : la CSP interdit les scripts en ligne).
try {
  var t = localStorage.getItem("sf-theme");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch (e) {}
