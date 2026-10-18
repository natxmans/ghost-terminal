// Filtre anti-gros mots pour « Mon code » : les mots vulgaires collés par le joueur sont
// remplacés par des symboles (#@!%…), comme les jurons dans les bandes dessinées.
// Attention aux faux positifs : du vrai code contient « const », « console », « fichier »,
// « calcul », « computer » ou « technique ». On vérifie donc surtout des mots entiers.
window.HT_FILTRE = (() => {
  "use strict";

  // Bloqués même collés à d'autres lettres (« fuckThis », « emmerder », « putaindecode ») :
  // seulement des mots qu'on ne trouve dans aucun mot normal
  const PARTOUT = [
    "fuck", "shit", "bitch", "asshole", "cunt",
    "putain", "merde", "encul", "salope", "salaud", "connard", "connasse", "batard", "paff",
    "petasse", "enfoire", "pouffiasse", "couill", "branleur",
  ];

  // Bloqués seulement quand c'est le mot entier (au pluriel et au féminin aussi)
  const MOTS = [
    "pute", "bite", "cul", "chier", "nique", "niquer", "ntm", "fdp", "ftg", "bordel", "conne", "foutre",
    "branler", "nichon", "dick", "cock", "pussy", "whore", "slut", "bastard", "wtf", "stfu", "fck",
  ];

  // Insultes racistes et homophobes : écrites en ROT13 (chaque lettre décalée de 13)
  // pour ne pas apparaître en clair dans le code du jeu
  const rot13 = (s) => s.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 84) % 26) + 97));
  const INSULTES = ["avttre", "avttn", "arter", "obhtabhyr", "ovpbg", "lbhcva", "crqr", "gncrggr", "tbhvar", "snt", "snttbg", "puvargbdhr", "onzobhyn"].map(rot13);

  const ENTIERS = new Set([...MOTS, ...INSULTES]);

  // « Sh1t », « FUUUCK », « pütain » : minuscules, sans accents, chiffres-lettres, lettres répétées
  const LEET = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", "@": "a", $: "s" };
  const normaliser = (mot) => mot.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[013457@$]/g, (c) => LEET[c])
    .replace(/(.)\1{2,}/g, "$1");

  function estVulgaire(mot) {
    const n = normaliser(mot);
    if (PARTOUT.some((w) => n.includes(w))) return true;
    return [n, n.replace(/s$/, ""), n.replace(/e?s$/, ""), n.replace(/e$/, "")].some((b) => ENTIERS.has(b));
  }

  // Un juron de BD de la même longueur que le mot, pour garder l'alignement du code
  const BD = "#@!%&$*";
  const juron = (n) => Array.from({ length: n }, (_, i) => BD[i % BD.length]).join("");

  // Renvoie le texte nettoyé et le nombre de mots bloqués
  function nettoyer(texte) {
    let nb = 0;
    const propre = String(texte).replace(/[A-Za-zÀ-ÖØ-öø-ÿ0-9@$]+/g, (bloc) =>
      // « monGrosMot » et « mon_gros_mot » sont coupés en mots séparés
      bloc.split(/(?<=[a-zà-ÿ0-9])(?=[A-ZÀ-Þ])/).map((mot) => {
        if (!estVulgaire(mot)) return mot;
        nb++;
        return juron(mot.length);
      }).join(""));
    return { texte: propre, nb };
  }

  return { nettoyer };
})();
