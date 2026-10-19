// Faux code : le plan (totalement fictif et ridicule) d'un membre du Club des Méchants qui veut
// déclencher la fin du monde. Les étapes du plan sont inventées mot par mot à partir du sac de
// mots de mots.js : chaque mot est choisi parmi ceux qui vont le mieux avec les précédents.
// Chaque fois que le code a été entièrement tapé, un nouveau plan est inventé.
(() => {
  "use strict";

  const rnd = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
  const hex = (n) => Array.from({ length: n }, () => "0123456789ABCDEF"[rnd(0, 15)]).join("");
  const camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

  // ===== Mots tirés au hasard =====
  const PROJETS = ["RAGNAROK", "ARMAGEDDON", "APOCALYPSE", "OMEGA", "CREPUSCULE", "NEMESIS", "GRAND_FINAL", "DERNIER_JOUR", "BIG_BADABOUM"];
  const MECHANTS = [
    ["Dr_Mechant", "Dr Méchant"], ["Baron_Noir", "Baron Noir"], ["Professeur_Chaos", "Professeur Chaos"],
    ["Comtesse_Ombre", "Comtesse Ombre"], ["General_Pingouin", "Général Pingouin"], ["Lord_Grincheux", "Lord Grincheux"],
  ];
  const BASES = ["volcan_secret", "base_lunaire", "ile_du_crane", "sous_marin_jaune", "station_orbitale", "bunker_sous_la_mer"];
  const CODES = ["FROMAGE-42", "CROISSANT-666", "BAGUETTE-007", "RACLETTE-9000", "PATATE-1337", "LICORNE-404", "CAMEMBERT-13"];
  const BOMBES = [
    ["ogive_omega", "Ogive Oméga"], ["machine_fin_du_monde", "Machine de fin du monde"],
    ["bombe_ragnarok", "Bombe Ragnarök"], ["reacteur_nemesis", "Réacteur Némésis"],
  ];
  const FINS = [
    "FIN DU MONDE. GAME OVER.",
    "Planète Terre : erreur 404, introuvable.",
    "BOUM. Plus jamais de lundis.",
    "Le monde a été effacé. Le Club des Méchants vous remercie.",
    "Fin du monde terminée à 100 %.",
  ];

  // Étapes écrites à la main : [fonction, titre, message de fin, sous-étapes, phase]
  // Quelques-unes se glissent dans chaque plan, au milieu des étapes inventées.
  const STEPS = [
    ["preparer_les_sbires", "Préparation des sbires", "Sbires prêts (et motivés)", ["Réveiller les sbires", "Distribuer les casques ridicules", "Compter les sbires (encore)", "Vérifier qu'aucun sbire n'est un espion"], 1],
    ["charger_carburant_malefique", "Chargement du carburant maléfique", "Réservoir plein", ["Ouvrir le réservoir", "Verser le carburant maléfique", "Ne pas en renverser sur le tapis", "Refermer le réservoir"], 2],
    ["calibrer_rayon_laser", "Calibrage du rayon laser", "Rayon laser calibré", ["Allumer le laser", "Viser le mur (pas le chat)", "Régler la puissance sur ÉNORME", "Prendre une photo souvenir"], 3],
    ["desactiver_super_heros", "Neutralisation des super-héros", "Super-héros désactivés", ["Cacher toutes les capes", "Remplacer leurs céréales par des brocolis", "Bloquer les cabines téléphoniques", "Annuler leurs abonnements"], 3],
    ["couper_internet_mondial", "Coupure d'internet", "Internet coupé (adieu les memes)", ["Débrancher la box du monde", "Attendre que ça redémarre", "Couper le wifi des voisins", "Vérifier que les memes ont disparu"], 3],
    ["nourrir_les_requins", "Repas des requins", "Requins nourris et motivés", ["Ouvrir la trappe de l'aquarium", "Servir les croquettes premium", "Brosser les dents des requins", "Leur souhaiter bonne nuit"], 1],
    ["lancer_rire_machiavelique", "Échauffement du rire machiavélique", "MOUAHAHAHA !", ["Mouah", "Mouahaha", "Mouahahaha (plus fort)", "Boire un verre d'eau"], 4],
    ["envoyer_ultimatum", "Envoi de l'ultimatum", "Ultimatum envoyé au Conseil des Héros", ["Écrire la lettre de menace", "Ajouter des paillettes", "Corriger les fautes d'orthographe", "Poster la lettre (sans timbre)"], 4],
    ["allumer_lumieres_rouges", "Ambiance de base secrète", "Lumières rouges qui clignotent : OK", ["Allumer les lumières rouges", "Activer la sirène", "Lancer la fumée dramatique", "Baisser le chauffage du volcan"], 2],
    ["evacuer_le_chat", "Mise à l'abri du chat", "Le chat est en sécurité", ["Trouver le chat", "Ouvrir une boîte de thon", "Installer le chat dans la capsule", "Lancer la capsule vers la Lune"], 4],
    ["pirater_les_satellites", "Piratage des satellites", "Satellites sous contrôle", ["Pointer l'antenne vers le ciel", "Taper le mot de passe : 1234", "Tourner les satellites vers la base", "Dire bonjour aux astronautes"], 3],
    ["brouiller_les_radars", "Brouillage des radars", "Radars brouillés", ["Lâcher des ballons argentés", "Taper sur une casserole", "Diffuser de la musique d'ascenseur", "Repeindre la base en vert camouflage"], 3],
    ["activer_musique_dramatique", "Bande-son dramatique", "Musique dramatique : ON", ["Accorder l'orgue", "Lancer les violons", "Monter le volume à 11", "Ajouter des tambours"], 4],
    ["inspecter_bouton_rouge", "Inspection du gros bouton rouge", "Bouton rouge : brillant", ["Dépoussiérer le bouton", "Vérifier qu'il est bien rouge", "Interdire au Pingouin d'y toucher", "Lustrer le bouton"], 4],
    ["preparer_sous_marin", "Préparation du sous-marin de fuite", "Sous-marin prêt pour la fuite", ["Faire le plein", "Charger les sandwichs", "Installer le siège du Pingouin", "Tester le klaxon"], 2],
    ["installer_compte_a_rebours", "Installation du compte à rebours", "Compte à rebours installé", ["Choisir une police de caractères menaçante", "Régler les chiffres rouges", "Ajouter des bips stressants", "Tester avec 3, 2, 1… non, pas encore"], 2],
  ];

  const JOURNAL = [
    [1, "achat d'un volcan d'occasion. Il fume un peu."],
    [4, "le Général Pingouin a mangé la moitié des plans."],
    [9, "les requins refusent de porter des lasers sur la tête."],
    [13, "quelqu'un a mis du fromage dans le réacteur. Odeur persistante."],
    [21, "le bouton rouge a été repeint en rouge. Encore plus rouge."],
    [34, "la Comtesse veut une ogive avec des paillettes."],
    [42, "ÉCHO ? Qui est ÉCHO ? (à surveiller)"],
    [47, "le Général Pingouin a encore vidé le frigo de sardines. Son plat préféré, paraît-il."],
    [66, "note du Pingouin : pour entrer dans mon repaire secret, tapez au clavier mon plat préféré. Chut. Coin."],
    [55, "l'agent Kane rôde autour de la base. Changer les codes."],
    [68, "le sous-marin de fuite a une fuite. Ironique."],
    [77, "réunion du Club des Méchants. Personne n'a apporté les croissants."],
    [90, "tout est prêt. MOUAHAHA."],
  ];

  const SBIRES = ["Bob", "Gérard", "Josiane", "Kevin", "Brigitte", "Igor", "Ginette", "Tony la Clé", "Sacha", "Marcel", "Nadia", "Jojo"];
  const ROLES = ["porte-clés", "goûteur de café", "gardien du bouton rouge", "nourrisseur de requins", "comptable du mal", "pilote de sous-marin", "DJ du rire machiavélique", "testeur de pièges", "repasseur de capes", "souffleur de fumée"];

  // ===== Choix des mots (le sac de mots est dans mots.js) =====
  const MOTS = window.HT_MOTS;
  const sansDanger = (s) => s.replace(/["\\$`{}%]/g, ""); // le texte part dans du code
  const themes = (t) => t.split(" ");

  // Masculin / féminin, singulier / pluriel, d'après l'article
  function genre(txt, g) {
    if (txt.startsWith("les ")) return { f: g === "f", p: true };
    if (txt.startsWith("la ")) return { f: true, p: false };
    return { f: g === "f", p: false };
  }
  const VERBES = MOTS.VERBES.map(([inf, pp, nom, t, phase]) => ({ inf, pp, nom, tags: themes(t), phase }));
  const OBJETS = MOTS.OBJETS.map(([txt, t, g]) => ({ txt: sansDanger(txt), tags: themes(t), ...genre(txt, g) }));
  const COMPLEMENTS = MOTS.COMPLEMENTS.map(([txt, t]) => ({ txt: sansDanger(txt), tags: themes(t) }));
  const QUEUES = MOTS.QUEUES.map(([txt, t]) => ({ txt: sansDanger(txt), tags: themes(t) }));

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  // « le rayon laser » → « du rayon laser », « les requins » → « des requins », sinon « de … »
  const de = (txt) => (txt.startsWith("le ") ? "du " + txt.slice(3) : txt.startsWith("les ") ? "des " + txt.slice(4) : "de " + txt);
  const sansArticle = (txt) => txt.replace(/^(le |la |les |l')/, "");
  // Accord du participe : calibré, calibrée, calibrés, calibrées
  const accorder = (pp, o) => {
    const w = pp + (o.f ? "e" : "");
    return o.p && !/[sx]$/.test(w) ? w + "s" : w;
  };
  // Nom de fonction : sans accents, sans petits mots, en minuscules_avec_tirets
  const PETITS = new Set(["le", "la", "les", "l", "de", "du", "des", "d", "a", "au", "aux", "en", "pour"]);
  const slug = (s, max = 3) => s.replace(/œ/g, "oe").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .split(/[^a-z0-9]+/).filter((w) => w && !PETITS.has(w)).slice(0, max).join("_");

  // Note d'un mot : combien de ses thèmes se retrouvent dans le contexte (les mots déjà choisis)
  function note(mot, ctx) {
    let s = 0;
    for (const t of mot.tags) for (const c of ctx) if (t === c) s++;
    return s;
  }
  // Tire un mot au hasard, en favorisant très fortement ceux qui vont le mieux avec le contexte
  function choisir(liste, ctx, exclus) {
    let cands = exclus ? liste.filter((m) => !exclus.has(m)) : liste;
    if (!cands.length) cands = liste;
    const poids = cands.map((m) => {
      const s = note(m, ctx);
      return s ? s ** 3 : m.tags.includes("tout") ? 0.6 : 0;
    });
    const total = poids.reduce((a, b) => a + b, 0);
    if (!total) return pick(cands);
    let r = Math.random() * total;
    for (let i = 0; i < cands.length; i++) {
      r -= poids[i];
      if (r <= 0) return cands[i];
    }
    return cands[cands.length - 1];
  }
  // Les objets qu'un verbe peut avoir (un verbe « tout » les accepte tous)
  const objetsPour = (v) => (v.tags.includes("tout") ? OBJETS : OBJETS.filter((o) => o.tags.some((t) => v.tags.includes(t))));

  // Une étape inventée : un verbe de la bonne phase, un objet qui va avec, puis des sous-étapes
  // qui tournent autour de cet objet. « avant » = l'étape précédente, pour garder le fil du plan.
  function etapeInventee(phase, avant, pris) {
    const fil = avant ? avant.objet.tags : [];
    const verbe = choisir(VERBES.filter((v) => v.phase === phase), fil, pris.verbes);
    pris.verbes.add(verbe);
    const objet = choisir(objetsPour(verbe), [...verbe.tags, ...verbe.tags, ...fil], pris.objets);
    pris.objets.add(objet);
    const fnPris = pris.fn;

    let fn = `${slug(verbe.inf, 1)}_${slug(objet.txt)}`;
    while (fnPris.has(fn)) fn += "_bis";
    fnPris.add(fn);

    const subs = [];
    const verbesPris = new Set([verbe]), complementsPris = new Set();
    for (let i = rnd(4, 7); i > 0; i--) {
      const sv = choisir(VERBES, objet.tags, verbesPris);
      verbesPris.add(sv);
      const possibles = objetsPour(sv);
      const so = possibles.includes(objet) && Math.random() < 0.5 ? objet : choisir(possibles, [...objet.tags, ...sv.tags]);
      const comp = Math.random() < 0.75 ? choisir(COMPLEMENTS, [...so.tags, ...sv.tags], complementsPris) : null;
      if (comp) complementsPris.add(comp);
      subs.push(`${cap(sv.inf)} ${so.txt}${comp ? " " + comp.txt : ""}`);
    }

    const queue = Math.random() < 0.4 ? " " + choisir(QUEUES, objet.tags).txt : "";
    const etape = [
      fn,
      `${verbe.nom} ${de(objet.txt)}`,
      `${cap(objet.txt)} ${objet.p ? "sont" : "est"} ${accorder(verbe.pp, objet)}${queue}`,
      subs,
      phase,
    ];
    etape.verbe = verbe;
    etape.objet = objet;
    return etape;
  }

  // Le plan complet : 4 phases de 4 étapes inventées, plus 4 étapes écrites à la main
  const PHASES = ["PRÉPARATION", "CONSTRUCTION", "RÉGLAGES", "LANCEMENT"];
  function planEtapes() {
    // Ce qui a déjà servi dans ce plan : chaque verbe et chaque objet principal ne sert qu'une fois
    const pris = {
      verbes: new Set(),
      objets: new Set(),
      fn: new Set(["armer_ogives", "compte_a_rebours", "fin_du_monde", "appeler_les_sbires", "faire_inventaire", "verifier_identite", "tourner_les_cles", "main"]),
    };
    const manuelles = shuffle(STEPS).slice(0, 4);
    manuelles.forEach((s) => pris.fn.add(s[0]));
    const plan = [];
    let avant = null;
    for (let phase = 1; phase <= PHASES.length; phase++) {
      const bloc = [];
      for (let k = 0; k < 4; k++) {
        avant = etapeInventee(phase, avant, pris);
        bloc.push(avant);
      }
      for (const s of manuelles.filter((m) => m[4] === phase)) bloc.splice(rnd(0, bloc.length), 0, s);
      plan.push(...bloc);
    }
    return plan;
  }

  // Le journal de bord mélange des notes écrites à la main et des notes sur les étapes du plan
  function journalDuPlan(steps) {
    const notes = shuffle(JOURNAL).slice(0, 5);
    const jours = new Set(notes.map(([j]) => j));
    for (const e of shuffle(steps.filter((s) => s.objet)).slice(0, 5)) {
      let j;
      do j = rnd(2, 89); while (jours.has(j));
      jours.add(j);
      const comp = choisir(COMPLEMENTS, [...e.objet.tags, ...e.verbe.tags]);
      notes.push([j, `${e.objet.txt} ${e.objet.p ? "ont" : "a"} été ${accorder(e.verbe.pp, e.objet)} ${comp.txt}.`]);
    }
    return notes.sort((a, b) => a[0] - b[0]);
  }

  // L'inventaire de la base : des objets qui vont avec les thèmes du plan
  function inventaireDuPlan(steps) {
    const ctx = steps.filter((s) => s.objet).flatMap((s) => s.objet.tags);
    const pris = new Set();
    const liste = [];
    for (let i = rnd(10, 13); i > 0; i--) {
      const o = choisir(OBJETS, ctx, pris);
      pris.add(o);
      liste.push([sansArticle(o.txt), o.p ? pick([rnd(2, 12), rnd(13, 99), 42, 1000, 9000]) : pick([1, 1, 1, 2, 3])]);
    }
    return liste;
  }

  function model() {
    const [mechant, mechantNom] = pick(MECHANTS);
    const [bombe, bombeNom] = pick(BOMBES);
    const projet = pick(PROJETS);
    const steps = planEtapes();
    return {
      projet, low: projet.toLowerCase(),
      mechant, mechantNom, bombe, bombeNom,
      base: pick(BASES),
      code: pick(CODES),
      ogives: rnd(3, 9),
      delai: pick([10, 13, 30, 42, 60, 99]),
      puissance: rnd(100, 999),
      version: `${rnd(1, 9)}.${rnd(0, 9)}.${rnd(0, 9)}`,
      steps,
      journal: journalDuPlan(steps),
      inventaire: inventaireDuPlan(steps),
      sbires: shuffle(SBIRES).slice(0, 6).map((nom) => [nom, pick(ROLES)]),
      fin: pick(FINS),
      cle: hex(8),
    };
  }

  // Appels des étapes dans le programme principal, avec un commentaire au début de chaque phase
  const appels = (m, indent, com, appel) => m.steps.map((s, i) => {
    const titre = i === 0 || m.steps[i - 1][4] !== s[4] ? `${i ? "\n" : ""}${indent}${com} --- Phase ${s[4]} : ${PHASES[s[4] - 1]} ---\n` : "";
    return `${titre}${indent}${appel(s[0])}\n`;
  }).join("");

  // Journal de bord du méchant, en commentaires (le symbole dépend du langage)
  const journal = (p, m) => [
    `${p} ===== JOURNAL DE BORD : ${m.mechantNom.toUpperCase()} =====`,
    ...m.journal.map(([jour, txt]) => `${p} Jour ${jour} : ${txt}`),
    `${p} ${"=".repeat(44)}`,
  ].join("\n");

  // ===== Un rendu par langage =====
  const RENDER = {
    c: (m) => `/*
 * operation_${m.low}.c — Protocole de fin du monde v${m.version}
 * Auteur : ${m.mechantNom} · Base : ${m.base}
 * Arme : ${m.bombeNom}
 * Document du CLUB DES MÉCHANTS, intercepté par ÉCHO. La Division Zéro ne doit pas le voir.
 * ATTENTION : ne pas appuyer sur le gros bouton rouge.
 * (100 % fictif : aucune vraie bombe dans ce fichier, juste des blagues.)
 */

${journal("//", m)}

#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include "apocalypse.h"

#define CODE_LANCEMENT  "${m.code}"
#define NB_OGIVES       ${m.ogives}
#define DELAI_SECONDES  ${m.delai}
#define CLE_MAITRESSE   0x${m.cle}
#define CIBLE           "PLANETE_TERRE"
#define NB_SBIRES       ${m.sbires.length}

typedef enum { EN_VEILLE, ARMEE, LANCEE } etat_t;

typedef struct {
	int id;
	int puissance;
	etat_t etat;
} ogive_t;

typedef struct {
	const char *nom;
	const char *role;
} sbire_t;

typedef struct {
	const char *objet;
	int quantite;
} article_t;

static ogive_t arsenal[NB_OGIVES];

static const sbire_t equipe[NB_SBIRES] = {
${m.sbires.map(([n, r]) => `\t{ "${n}", "${r}" },`).join("\n")}
};

static const article_t inventaire[] = {
${m.inventaire.map(([o, q]) => `\t{ "${o}", ${q} },`).join("\n")}
};

static int verifier_identite(const char *nom, const char *code)
{
	if (strcmp(nom, "${m.mechant}") != 0) {
		puts("ACCES REFUSE : vous n'etes pas assez mechant.");
		return 0;
	}
	return strcmp(code, CODE_LANCEMENT) == 0;
}

static int tourner_les_cles(int cle_gauche, int cle_droite)
{
	/* Les deux cles doivent tourner exactement en meme temps */
	return cle_gauche == 1 && cle_droite == 1;
}

static void appeler_les_sbires(void)
{
	puts("[*] Appel des sbires du Club des Méchants...");
	for (int i = 0; i < NB_SBIRES; i++)
		printf("    - %-12s : %s\\n", equipe[i].nom, equipe[i].role);
}

static void faire_inventaire(void)
{
	puts("[*] Inventaire de la base...");
	for (size_t i = 0; i < sizeof(inventaire) / sizeof(inventaire[0]); i++)
		printf("    %-30s x%d\\n", inventaire[i].objet, inventaire[i].quantite);
}
${m.steps.map(([fn, title, msg, subs]) => `
static void ${fn}(void)
{
	static const char *etapes[] = {
${subs.map((s) => `\t\t"${s}",`).join("\n")}
	};
	puts("[*] ${title}...");
	for (size_t i = 0; i < sizeof(etapes) / sizeof(etapes[0]); i++) {
		printf("    %zu. %s\\n", i + 1, etapes[i]);
		usleep(150000);
	}
	puts("[+] ${msg}");
}
`).join("")}
static void armer_ogives(void)
{
	for (int i = 0; i < NB_OGIVES; i++) {
		arsenal[i].id = i + 1;
		arsenal[i].puissance = ${m.puissance};
		arsenal[i].etat = ARMEE;
		printf("[+] ${m.bombeNom} %d/%d armee\\n", i + 1, NB_OGIVES);
	}
}

static void compte_a_rebours(int secondes)
{
	for (int t = secondes; t > 0; t--) {
		printf("Lancement dans %d...\\n", t);
		sleep(1);
	}
}

/* [ÉCHO] Je surveille ce plan. Continue de taper : je vais le saboter de l'intérieur. */
static void fin_du_monde(void)
{
	for (int i = 0; i < NB_OGIVES; i++)
		arsenal[i].etat = LANCEE;
	monde_detruire(CIBLE, CLE_MAITRESSE);
	puts("${m.fin}");
}

int main(void)
{
	if (!verifier_identite("${m.mechant}", CODE_LANCEMENT))
		return 1;
	if (!tourner_les_cles(1, 1))
		return 2;

	appeler_les_sbires();
	faire_inventaire();

${appels(m, "\t", "//", (fn) => `${fn}();`)}
	armer_ogives();
	compte_a_rebours(DELAI_SECONDES);
	fin_du_monde();
	return 0;
}

`,

    python: (m) => `#!/usr/bin/env python3
# operation_${m.low}.py — Protocole de fin du monde v${m.version}
# Auteur : ${m.mechantNom} · Base : ${m.base} · Arme : ${m.bombeNom}
# Document du CLUB DES MÉCHANTS, intercepté par ÉCHO.
# (100 % fictif : aucune vraie bombe ici, juste des blagues.)

${journal("#", m)}

import time
from apocalypse import Monde, BoutonRouge

CODE_LANCEMENT = "${m.code}"
NB_OGIVES = ${m.ogives}
DELAI = ${m.delai}
CIBLE = "PLANETE_TERRE"

SBIRES = [
${m.sbires.map(([n, r]) => `    ("${n}", "${r}"),`).join("\n")}
]

INVENTAIRE = {
${m.inventaire.map(([o, q]) => `    "${o}": ${q},`).join("\n")}
}


class Ogive:
    def __init__(self, numero, puissance):
        self.numero = numero
        self.puissance = puissance
        self.armee = False

    def armer(self):
        self.armee = True
        print(f"[+] ${m.bombeNom} {self.numero}/{NB_OGIVES} armée")


def verifier_identite(nom, code):
    if nom != "${m.mechant}":
        raise PermissionError("Vous n'êtes pas assez méchant.")
    return code == CODE_LANCEMENT


def tourner_les_cles(gauche, droite):
    # Les deux clés doivent tourner exactement en même temps
    return gauche and droite


def appeler_les_sbires():
    print("[*] Appel des sbires du Club des Méchants...")
    for nom, role in SBIRES:
        print(f"    - {nom:<12} : {role}")


def faire_inventaire():
    print("[*] Inventaire de la base...")
    for objet, quantite in INVENTAIRE.items():
        print(f"    {objet:<30} x{quantite}")
${m.steps.map(([fn, title, msg, subs]) => `

def ${fn}():
    print("[*] ${title}...")
    etapes = [
${subs.map((s) => `        "${s}",`).join("\n")}
    ]
    for i, etape in enumerate(etapes, start=1):
        print(f"    {i}. {etape}")
        time.sleep(0.15)
    print("[+] ${msg}")`).join("")}


def compte_a_rebours(secondes):
    for t in range(secondes, 0, -1):
        print(f"Lancement dans {t}...")
        time.sleep(1)


# [ÉCHO] Je surveille ce plan. Continue de taper : je vais le saboter.
def fin_du_monde(arsenal):
    for ogive in arsenal:
        ogive.lancee = True
    Monde(CIBLE).detruire()
    print("${m.fin}")


def main():
    if not verifier_identite("${m.mechant}", CODE_LANCEMENT):
        return
    if not tourner_les_cles(True, True):
        return
    appeler_les_sbires()
    faire_inventaire()

${appels(m, "    ", "#", (fn) => `${fn}()`)}
    arsenal = [Ogive(i + 1, ${m.puissance}) for i in range(NB_OGIVES)]
    for ogive in arsenal:
        ogive.armer()
    if input("Êtes-vous VRAIMENT sûr ? (o/n) ") == "o":
        compte_a_rebours(DELAI)
        fin_du_monde(arsenal)


if __name__ == "__main__":
    main()

`,

    javascript: (m) => `// operation-${m.low}.js — Protocole de fin du monde v${m.version}
// Auteur : ${m.mechantNom} · Base : ${m.base} · Arme : ${m.bombeNom}
// Document du CLUB DES MÉCHANTS, intercepté par ÉCHO.
// (100 % fictif : aucune vraie bombe ici, juste des blagues.)

${journal("//", m)}

"use strict";

const { Monde, BoutonRouge } = require("./apocalypse");

const CODE_LANCEMENT = "${m.code}";
const NB_OGIVES = ${m.ogives};
const DELAI = ${m.delai};
const CIBLE = "PLANETE_TERRE";

const SBIRES = [
${m.sbires.map(([n, r]) => `  ["${n}", "${r}"],`).join("\n")}
];

const INVENTAIRE = new Map([
${m.inventaire.map(([o, q]) => `  ["${o}", ${q}],`).join("\n")}
]);

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

class Ogive {
  constructor(numero, puissance) {
    this.numero = numero;
    this.puissance = puissance;
    this.etat = "EN_VEILLE";
  }

  armer() {
    this.etat = "ARMEE";
    console.log("[+] ${m.bombeNom} " + this.numero + "/" + NB_OGIVES + " armée");
  }
}

function verifierIdentite(nom, code) {
  if (nom !== "${m.mechant}") throw new Error("Pas assez méchant.");
  return code === CODE_LANCEMENT;
}

function tournerLesCles(gauche, droite) {
  // Les deux clés doivent tourner exactement en même temps
  return gauche && droite;
}

function appelerLesSbires() {
  console.log("[*] Appel des sbires du Club des Méchants...");
  for (const [nom, role] of SBIRES) console.log("    - " + nom.padEnd(12) + " : " + role);
}

function faireInventaire() {
  console.log("[*] Inventaire de la base...");
  for (const [objet, quantite] of INVENTAIRE) console.log("    " + objet.padEnd(30) + " x" + quantite);
}
${m.steps.map(([fn, title, msg, subs]) => `
async function ${camel(fn)}() {
  console.log("[*] ${title}...");
  const etapes = [
${subs.map((s) => `    "${s}",`).join("\n")}
  ];
  for (const [i, etape] of etapes.entries()) {
    console.log("    " + (i + 1) + ". " + etape);
    await pause(150);
  }
  console.log("[+] ${msg}");
}
`).join("")}
async function compteARebours(secondes) {
  for (let t = secondes; t > 0; t--) {
    console.log("Lancement dans " + t + "...");
    await pause(1000);
  }
}

// [ÉCHO] Je surveille ce plan. Continue de taper : je vais le saboter.
function finDuMonde(arsenal) {
  arsenal.forEach((ogive) => (ogive.etat = "LANCEE"));
  new Monde(CIBLE).detruire();
  console.log("${m.fin}");
}

async function main() {
  if (!verifierIdentite("${m.mechant}", CODE_LANCEMENT)) return;
  if (!tournerLesCles(true, true)) return;
  appelerLesSbires();
  faireInventaire();

${appels(m, "  ", "//", (fn) => `await ${camel(fn)}();`)}
  const arsenal = Array.from({ length: NB_OGIVES }, (_, i) => new Ogive(i + 1, ${m.puissance}));
  arsenal.forEach((ogive) => ogive.armer());
  await BoutonRouge.attendreAppui();
  await compteARebours(DELAI);
  finDuMonde(arsenal);
}

main();

`,

    rust: (m) => `// src/main.rs — Opération ${m.projet} : protocole de fin du monde v${m.version}
// Auteur : ${m.mechantNom} · Base : ${m.base} · Arme : ${m.bombeNom}
// Document du CLUB DES MÉCHANTS, intercepté par ÉCHO.
// (100 % fictif : aucune vraie bombe ici, juste des blagues.)

${journal("//", m)}

use std::thread::sleep;
use std::time::Duration;

const CODE_LANCEMENT: &str = "${m.code}";
const NB_OGIVES: u32 = ${m.ogives};
const DELAI: u32 = ${m.delai};
const CIBLE: &str = "PLANETE_TERRE";

const SBIRES: [(&str, &str); ${m.sbires.length}] = [
${m.sbires.map(([n, r]) => `    ("${n}", "${r}"),`).join("\n")}
];

const INVENTAIRE: [(&str, u32); ${m.inventaire.length}] = [
${m.inventaire.map(([o, q]) => `    ("${o}", ${q}),`).join("\n")}
];

#[derive(Debug, PartialEq)]
enum Etat {
    EnVeille,
    Armee,
    Lancee,
}

struct Ogive {
    numero: u32,
    puissance: u32,
    etat: Etat,
}

impl Ogive {
    fn armer(&mut self) {
        self.etat = Etat::Armee;
        println!("[+] ${m.bombeNom} {}/{} armée", self.numero, NB_OGIVES);
    }
}

fn verifier_identite(nom: &str, code: &str) -> bool {
    nom == "${m.mechant}" && code == CODE_LANCEMENT
}

fn tourner_les_cles(gauche: bool, droite: bool) -> bool {
    // Les deux clés doivent tourner exactement en même temps
    gauche && droite
}

fn appeler_les_sbires() {
    println!("[*] Appel des sbires du Club des Méchants...");
    for (nom, role) in SBIRES.iter() {
        println!("    - {:<12} : {}", nom, role);
    }
}

fn faire_inventaire() {
    println!("[*] Inventaire de la base...");
    for (objet, quantite) in INVENTAIRE.iter() {
        println!("    {:<30} x{}", objet, quantite);
    }
}
${m.steps.map(([fn, title, msg, subs]) => `
fn ${fn}() {
    println!("[*] ${title}...");
    let etapes = [
${subs.map((s) => `        "${s}",`).join("\n")}
    ];
    for (i, etape) in etapes.iter().enumerate() {
        println!("    {}. {}", i + 1, etape);
        sleep(Duration::from_millis(150));
    }
    println!("[+] ${msg}");
}
`).join("")}
fn compte_a_rebours(secondes: u32) {
    for t in (1..=secondes).rev() {
        println!("Lancement dans {}...", t);
        sleep(Duration::from_secs(1));
    }
}

// [ÉCHO] Je surveille ce plan. Continue de taper : je vais le saboter.
fn fin_du_monde(arsenal: &mut Vec<Ogive>) {
    for ogive in arsenal.iter_mut() {
        ogive.etat = Etat::Lancee;
    }
    println!("Cible {} : détruite.", CIBLE);
    println!("${m.fin}");
}

fn main() {
    if !verifier_identite("${m.mechant}", CODE_LANCEMENT) {
        panic!("ACCÈS REFUSÉ : pas assez méchant.");
    }
    assert!(tourner_les_cles(true, true), "Les clés ne tournent pas !");
    appeler_les_sbires();
    faire_inventaire();

${appels(m, "    ", "//", (fn) => `${fn}();`)}
    let mut arsenal: Vec<Ogive> = (1..=NB_OGIVES)
        .map(|n| Ogive { numero: n, puissance: ${m.puissance}, etat: Etat::EnVeille })
        .collect();
    for ogive in arsenal.iter_mut() {
        ogive.armer();
    }
    compte_a_rebours(DELAI);
    fin_du_monde(&mut arsenal);
}

`,

    go: (m) => `// operation_${m.low}/main.go — Protocole de fin du monde v${m.version}
// Auteur : ${m.mechantNom} · Base : ${m.base} · Arme : ${m.bombeNom}
// Document du CLUB DES MÉCHANTS, intercepté par ÉCHO.
// (100 % fictif : aucune vraie bombe ici, juste des blagues.)

${journal("//", m)}

package main

import (
	"errors"
	"fmt"
	"time"
)

const (
	CodeLancement = "${m.code}"
	NbOgives      = ${m.ogives}
	Delai         = ${m.delai}
	Cible         = "PLANETE_TERRE"
)

var sbires = [][2]string{
${m.sbires.map(([n, r]) => `\t{"${n}", "${r}"},`).join("\n")}
}

var inventaire = []struct {
	Objet    string
	Quantite int
}{
${m.inventaire.map(([o, q]) => `\t{"${o}", ${q}},`).join("\n")}
}

type Ogive struct {
	Numero    int
	Puissance int
	Armee     bool
}

func (o *Ogive) Armer() {
	o.Armee = true
	fmt.Printf("[+] ${m.bombeNom} %d/%d armée\\n", o.Numero, NbOgives)
}

func verifierIdentite(nom, code string) error {
	if nom != "${m.mechant}" {
		return errors.New("pas assez méchant")
	}
	if code != CodeLancement {
		return errors.New("code de lancement invalide")
	}
	return nil
}

func tournerLesCles(gauche, droite bool) bool {
	// Les deux clés doivent tourner exactement en même temps
	return gauche && droite
}

func appelerLesSbires() {
	fmt.Println("[*] Appel des sbires du Club des Méchants...")
	for _, s := range sbires {
		fmt.Printf("    - %-12s : %s\\n", s[0], s[1])
	}
}

func faireInventaire() {
	fmt.Println("[*] Inventaire de la base...")
	for _, a := range inventaire {
		fmt.Printf("    %-30s x%d\\n", a.Objet, a.Quantite)
	}
}
${m.steps.map(([fn, title, msg, subs]) => `
func ${camel(fn)}() {
	fmt.Println("[*] ${title}...")
	etapes := []string{
${subs.map((s) => `\t\t"${s}",`).join("\n")}
	}
	for i, etape := range etapes {
		fmt.Printf("    %d. %s\\n", i+1, etape)
		time.Sleep(150 * time.Millisecond)
	}
	fmt.Println("[+] ${msg}")
}
`).join("")}
func compteARebours(secondes int) {
	for t := secondes; t > 0; t-- {
		fmt.Printf("Lancement dans %d...\\n", t)
		time.Sleep(time.Second)
	}
}

// [ÉCHO] Je surveille ce plan. Continue de taper : je vais le saboter.
func finDuMonde(arsenal []*Ogive) {
	for _, o := range arsenal {
		o.Armee = false
	}
	fmt.Println("Cible", Cible, ": détruite.")
	fmt.Println("${m.fin}")
}

func main() {
	if err := verifierIdentite("${m.mechant}", CodeLancement); err != nil {
		panic(err)
	}
	if !tournerLesCles(true, true) {
		return
	}
	appelerLesSbires()
	faireInventaire()

${appels(m, "\t", "//", (fn) => `${camel(fn)}()`)}
	arsenal := make([]*Ogive, NbOgives)
	for i := range arsenal {
		arsenal[i] = &Ogive{Numero: i + 1, Puissance: ${m.puissance}}
		arsenal[i].Armer()
	}
	compteARebours(Delai)
	finDuMonde(arsenal)
}

`,

    asm: (m) => `; operation_${m.low}.asm — Protocole de fin du monde v${m.version}
; Auteur : ${m.mechantNom} · Base : ${m.base} · Arme : ${m.bombeNom}
; Document du CLUB DES MÉCHANTS, intercepté par ÉCHO.
; (100 % fictif : aucune vraie bombe ici, juste des blagues.)
; nasm -f elf64 operation_${m.low}.asm && ld -o ${m.low} operation_${m.low}.o

${journal(";", m)}

[BITS 64]

%define NB_OGIVES   ${m.ogives}
%define DELAI       ${m.delai}
%define SYS_WRITE   1
%define SYS_EXIT    60

; Affiche un message et sa longueur (étiquette + len_étiquette)
%macro AFFICHER 1
    mov     rsi, %1
    mov     rdx, len_%1
    call    afficher
%endmacro

section .data
    code_lancement  db "${m.code}", 0
    msg_bienvenue   db "Bienvenue, ${m.mechantNom}.", 10
    len_msg_bienvenue equ $ - msg_bienvenue
    msg_sbires      db "[*] Appel des sbires du Club des Méchants...", 10
    len_msg_sbires  equ $ - msg_sbires
${m.sbires.map(([n, r], i) => `    sbire_${i + 1}         db "    - ${n} : ${r}", 10\n    len_sbire_${i + 1}     equ $ - sbire_${i + 1}\n`).join("")}    msg_inventaire  db "[*] Inventaire de la base...", 10
    len_msg_inventaire equ $ - msg_inventaire
${m.inventaire.map(([o, q], i) => `    inv_${i + 1}           db "    - ${o} x${q}", 10\n    len_inv_${i + 1}       equ $ - inv_${i + 1}\n`).join("")}${m.steps.map(([, title, msg, subs], k) => `    etape${k + 1}_titre   db "[*] ${title}...", 10
    len_etape${k + 1}_titre equ $ - etape${k + 1}_titre
${subs.map((s, j) => `    etape${k + 1}_${j + 1}       db "    ${j + 1}. ${s}", 10\n    len_etape${k + 1}_${j + 1}   equ $ - etape${k + 1}_${j + 1}\n`).join("")}    etape${k + 1}_ok      db "[+] ${msg}", 10
    len_etape${k + 1}_ok  equ $ - etape${k + 1}_ok
`).join("")}    msg_ogive       db "[+] ${m.bombeNom} armée", 10
    len_msg_ogive   equ $ - msg_ogive
    msg_fin         db "${m.fin}", 10
    len_msg_fin     equ $ - msg_fin

section .bss
    arsenal         resb NB_OGIVES

section .text
global _start

_start:
    AFFICHER msg_bienvenue
    call    verifier_code
    test    rax, rax
    jz      quitter

    AFFICHER msg_sbires
${m.sbires.map((_, i) => `    AFFICHER sbire_${i + 1}\n`).join("")}
    AFFICHER msg_inventaire
${m.inventaire.map((_, i) => `    AFFICHER inv_${i + 1}\n`).join("")}${m.steps.map(([, title, , subs, phase], k) => `${k === 0 || m.steps[k - 1][4] !== phase ? `
    ; ===== Phase ${phase} : ${PHASES[phase - 1]} =====` : ""}
    ; --- ${title} ---
    AFFICHER etape${k + 1}_titre
${subs.map((_, j) => `    AFFICHER etape${k + 1}_${j + 1}\n`).join("")}    AFFICHER etape${k + 1}_ok
`).join("")}
    mov     rcx, NB_OGIVES
    xor     rbx, rbx
armer_ogives:
    mov     byte [arsenal + rbx], 1
    push    rcx
    AFFICHER msg_ogive
    pop     rcx
    inc     rbx
    loop    armer_ogives

    mov     rcx, DELAI
compte_a_rebours:
    nop                         ; tic... tac...
    loop    compte_a_rebours

    ; [ÉCHO] Je surveille ce plan. Continue de taper : je vais le saboter.
    AFFICHER msg_fin
    jmp     quitter

verifier_code:
    mov     rax, 1              ; le code est toujours bon (on est un méchant)
    ret

afficher:
    mov     rax, SYS_WRITE
    mov     rdi, 1
    syscall
    ret

quitter:
    mov     rax, SYS_EXIT
    xor     rdi, rdi
    syscall

`,

    bash: (m) => `#!/usr/bin/env bash
# operation_${m.low}.sh — Protocole de fin du monde v${m.version}
# Auteur : ${m.mechantNom} · Base : ${m.base} · Arme : ${m.bombeNom}
# Document du CLUB DES MÉCHANTS, intercepté par ÉCHO.
# (100 % fictif : aucune vraie bombe ici, juste des blagues.)

${journal("#", m)}

set -euo pipefail

CODE_LANCEMENT="${m.code}"
NB_OGIVES=${m.ogives}
DELAI=${m.delai}
CIBLE="PLANETE_TERRE"

SBIRES=(
${m.sbires.map(([n, r]) => `  "${n}:${r}"`).join("\n")}
)

declare -A INVENTAIRE=(
${m.inventaire.map(([o, q]) => `  ["${o}"]=${q}`).join("\n")}
)

log() { printf "[%s] %s\\n" "$(date +%H:%M:%S)" "$*"; }

verifier_identite() {
  if [ "$1" != "${m.mechant}" ]; then
    log "ACCES REFUSE : pas assez méchant"
    exit 1
  fi
  [ "$2" = "$CODE_LANCEMENT" ]
}

tourner_les_cles() {
  # Les deux clés doivent tourner exactement en même temps
  [ "$1" = "1" ] && [ "$2" = "1" ]
}

appeler_les_sbires() {
  log "Appel des sbires du Club des Méchants..."
  for sbire in "\${SBIRES[@]}"; do
    log "  - \${sbire%%:*} : \${sbire#*:}"
  done
}

faire_inventaire() {
  log "Inventaire de la base..."
  for objet in "\${!INVENTAIRE[@]}"; do
    log "  - $objet x\${INVENTAIRE[$objet]}"
  done
}
${m.steps.map(([fn, title, msg, subs]) => `
${fn}() {
  log "${title}..."
  local etapes=(
${subs.map((s) => `    "${s}"`).join("\n")}
  )
  local i=1
  for etape in "\${etapes[@]}"; do
    log "  $i. $etape"
    i=$((i + 1))
    sleep 0.15
  done
  log "[+] ${msg}"
}
`).join("")}
armer_ogives() {
  for i in $(seq 1 "$NB_OGIVES"); do
    log "${m.bombeNom} $i/$NB_OGIVES armée"
    sleep 0.2
  done
}

compte_a_rebours() {
  for t in $(seq "$1" -1 1); do
    log "Lancement dans $t..."
    sleep 1
  done
}

# [ÉCHO] Je surveille ce plan. Continue de taper : je vais le saboter.
fin_du_monde() {
  log "Cible $CIBLE : détruite."
  log "${m.fin}"
}

main() {
  verifier_identite "${m.mechant}" "$CODE_LANCEMENT" || exit 1
  tourner_les_cles 1 1 || exit 2
  appeler_les_sbires
  faire_inventaire

${appels(m, "  ", "#", (fn) => fn)}
  armer_ogives
  read -r -p "Êtes-vous VRAIMENT sûr ? (o/n) " reponse
  [ "$reponse" = "o" ] || exit 0
  compte_a_rebours "$DELAI"
  fin_du_monde
}

main "$@"

`,
  };

  const NAMES = {
    c: "C", python: "Python", javascript: "JavaScript", rust: "Rust",
    go: "Go", asm: "Assembleur x86", bash: "Bash",
  };

  const generate = (lang) => RENDER[lang](model());

  window.SNIPPETS = Object.fromEntries(Object.keys(RENDER).map((k) => [k, { name: NAMES[k], code: generate(k) }]));

  // L'univers partagé avec les effets, les missions et l'histoire
  window.HT_LORE = {
    MECHANTS: MECHANTS.map(([, nom]) => nom),
    BASES,
    BOMBES: BOMBES.map(([, nom]) => nom),
    CODES,
  };

  // Invente un nouveau plan pour ce langage (appelé quand tout le code a été tapé)
  window.regenerateSnippet = (lang) => {
    if (!RENDER[lang]) return false;
    window.SNIPPETS[lang].code = generate(lang);
    return true;
  };
})();
