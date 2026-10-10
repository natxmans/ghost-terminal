// Faux code : le plan (totalement fictif et ridicule) d'un super-méchant de film qui veut
// déclencher la fin du monde. Les noms, codes et étapes sont tirés au hasard : chaque fois que
// le code a été entièrement tapé, un nouveau plan est inventé.
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
  const EXTRAS = [
    ["desactiver_super_heros", "Super-héros désactivés"],
    ["couper_internet_mondial", "Internet coupé (adieu les memes)"],
    ["nourrir_les_requins", "Requins nourris et motivés"],
    ["lancer_rire_machiavelique", "MOUAHAHAHA !"],
    ["envoyer_ultimatum", "Ultimatum envoyé au Conseil des Héros"],
    ["allumer_lumieres_rouges", "Lumières rouges qui clignotent : OK"],
    ["evacuer_le_chat", "Le chat est en sécurité"],
    ["pirater_les_satellites", "Satellites sous contrôle"],
    ["brouiller_les_radars", "Radars brouillés"],
    ["activer_musique_dramatique", "Musique dramatique : ON"],
  ];
  const FINS = [
    "FIN DU MONDE. GAME OVER.",
    "Planète Terre : erreur 404, introuvable.",
    "BOUM. Plus jamais de lundis.",
    "Le monde a été effacé. Merci d'avoir choisi Apocalypse Inc.",
    "Fin du monde terminée à 100 %.",
  ];

  function model() {
    const [mechant, mechantNom] = pick(MECHANTS);
    const [bombe, bombeNom] = pick(BOMBES);
    const projet = pick(PROJETS);
    return {
      projet, low: projet.toLowerCase(),
      mechant, mechantNom, bombe, bombeNom,
      base: pick(BASES),
      code: pick(CODES),
      ogives: rnd(3, 9),
      delai: pick([10, 13, 30, 42, 60, 99]),
      puissance: rnd(100, 999),
      version: `${rnd(1, 9)}.${rnd(0, 9)}.${rnd(0, 9)}`,
      extras: shuffle(EXTRAS).slice(0, 3),
      fin: pick(FINS),
      cle: hex(8),
    };
  }

  // ===== Un rendu par langage =====
  const RENDER = {
    c: (m) => `/*
 * operation_${m.low}.c — Protocole de fin du monde v${m.version}
 * Auteur : ${m.mechantNom} · Base : ${m.base}
 * Arme : ${m.bombeNom}
 * ATTENTION : ne pas appuyer sur le gros bouton rouge.
 * (100 % fictif : aucune vraie bombe dans ce fichier, juste des blagues.)
 */

#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include "apocalypse.h"

#define CODE_LANCEMENT  "${m.code}"
#define NB_OGIVES       ${m.ogives}
#define DELAI_SECONDES  ${m.delai}
#define CLE_MAITRESSE   0x${m.cle}
#define CIBLE           "PLANETE_TERRE"

typedef enum { EN_VEILLE, ARMEE, LANCEE } etat_t;

typedef struct {
	int id;
	int puissance;
	etat_t etat;
} ogive_t;

static ogive_t arsenal[NB_OGIVES];

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
${m.extras.map(([fn, msg]) => `
static void ${fn}(void)
{
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

${m.extras.map(([fn]) => `	${fn}();\n`).join("")}	armer_ogives();
	compte_a_rebours(DELAI_SECONDES);
	fin_du_monde();
	return 0;
}

`,

    python: (m) => `#!/usr/bin/env python3
# operation_${m.low}.py — Protocole de fin du monde v${m.version}
# Auteur : ${m.mechantNom} · Base : ${m.base} · Arme : ${m.bombeNom}
# (100 % fictif : aucune vraie bombe ici, juste des blagues.)

import time
from apocalypse import Monde, BoutonRouge

CODE_LANCEMENT = "${m.code}"
NB_OGIVES = ${m.ogives}
DELAI = ${m.delai}
CIBLE = "PLANETE_TERRE"


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

${m.extras.map(([fn, msg]) => `
def ${fn}():
    print("[+] ${msg}")
`).join("")}

def compte_a_rebours(secondes):
    for t in range(secondes, 0, -1):
        print(f"Lancement dans {t}...")
        time.sleep(1)


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
${m.extras.map(([fn]) => `    ${fn}()\n`).join("")}    arsenal = [Ogive(i + 1, ${m.puissance}) for i in range(NB_OGIVES)]
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
// (100 % fictif : aucune vraie bombe ici, juste des blagues.)

"use strict";

const { Monde, BoutonRouge } = require("./apocalypse");

const CODE_LANCEMENT = "${m.code}";
const NB_OGIVES = ${m.ogives};
const DELAI = ${m.delai};
const CIBLE = "PLANETE_TERRE";

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
${m.extras.map(([fn, msg]) => `
function ${camel(fn)}() {
  console.log("[+] ${msg}");
}
`).join("")}
async function compteARebours(secondes) {
  for (let t = secondes; t > 0; t--) {
    console.log("Lancement dans " + t + "...");
    await pause(1000);
  }
}

function finDuMonde(arsenal) {
  arsenal.forEach((ogive) => (ogive.etat = "LANCEE"));
  new Monde(CIBLE).detruire();
  console.log("${m.fin}");
}

async function main() {
  if (!verifierIdentite("${m.mechant}", CODE_LANCEMENT)) return;
  if (!tournerLesCles(true, true)) return;
${m.extras.map(([fn]) => `  ${camel(fn)}();\n`).join("")}  const arsenal = Array.from({ length: NB_OGIVES }, (_, i) => new Ogive(i + 1, ${m.puissance}));
  arsenal.forEach((ogive) => ogive.armer());
  await BoutonRouge.attendreAppui();
  await compteARebours(DELAI);
  finDuMonde(arsenal);
}

main();

`,

    rust: (m) => `// src/main.rs — Opération ${m.projet} : protocole de fin du monde v${m.version}
// Auteur : ${m.mechantNom} · Base : ${m.base} · Arme : ${m.bombeNom}
// (100 % fictif : aucune vraie bombe ici, juste des blagues.)

use std::thread::sleep;
use std::time::Duration;

const CODE_LANCEMENT: &str = "${m.code}";
const NB_OGIVES: u32 = ${m.ogives};
const DELAI: u32 = ${m.delai};
const CIBLE: &str = "PLANETE_TERRE";

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
${m.extras.map(([fn, msg]) => `
fn ${fn}() {
    println!("[+] ${msg}");
}
`).join("")}
fn compte_a_rebours(secondes: u32) {
    for t in (1..=secondes).rev() {
        println!("Lancement dans {}...", t);
        sleep(Duration::from_secs(1));
    }
}

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
${m.extras.map(([fn]) => `    ${fn}();\n`).join("")}    let mut arsenal: Vec<Ogive> = (1..=NB_OGIVES)
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
// (100 % fictif : aucune vraie bombe ici, juste des blagues.)

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
${m.extras.map(([fn, msg]) => `
func ${camel(fn)}() {
	fmt.Println("[+] ${msg}")
}
`).join("")}
func compteARebours(secondes int) {
	for t := secondes; t > 0; t-- {
		fmt.Printf("Lancement dans %d...\\n", t)
		time.Sleep(time.Second)
	}
}

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
${m.extras.map(([fn]) => `	${camel(fn)}()\n`).join("")}	arsenal := make([]*Ogive, NbOgives)
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
; (100 % fictif : aucune vraie bombe ici, juste des blagues.)
; nasm -f elf64 operation_${m.low}.asm && ld -o ${m.low} operation_${m.low}.o

[BITS 64]

%define NB_OGIVES   ${m.ogives}
%define DELAI       ${m.delai}
%define SYS_WRITE   1
%define SYS_EXIT    60

section .data
    code_lancement  db "${m.code}", 0
    msg_bienvenue   db "Bienvenue, ${m.mechantNom}.", 10
    len_bienvenue   equ $ - msg_bienvenue
${m.extras.map(([, msg], i) => `    msg_bonus_${i + 1}     db "[+] ${msg}", 10\n    len_bonus_${i + 1}     equ $ - msg_bonus_${i + 1}\n`).join("")}    msg_ogive       db "[+] ${m.bombeNom} armée", 10
    len_ogive       equ $ - msg_ogive
    msg_fin         db "${m.fin}", 10
    len_fin         equ $ - msg_fin

section .bss
    arsenal         resb NB_OGIVES

section .text
global _start

_start:
    mov     rsi, msg_bienvenue
    mov     rdx, len_bienvenue
    call    afficher

    call    verifier_code
    test    rax, rax
    jz      quitter
${m.extras.map((_, i) => `
    mov     rsi, msg_bonus_${i + 1}
    mov     rdx, len_bonus_${i + 1}
    call    afficher
`).join("")}
    mov     rcx, NB_OGIVES
    xor     rbx, rbx
armer_ogives:
    mov     byte [arsenal + rbx], 1
    push    rcx
    mov     rsi, msg_ogive
    mov     rdx, len_ogive
    call    afficher
    pop     rcx
    inc     rbx
    loop    armer_ogives

    mov     rcx, DELAI
compte_a_rebours:
    nop                         ; tic... tac...
    loop    compte_a_rebours

    mov     rsi, msg_fin
    mov     rdx, len_fin
    call    afficher
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
# (100 % fictif : aucune vraie bombe ici, juste des blagues.)

set -euo pipefail

CODE_LANCEMENT="${m.code}"
NB_OGIVES=${m.ogives}
DELAI=${m.delai}
CIBLE="PLANETE_TERRE"

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
${m.extras.map(([fn, msg]) => `
${fn}() { log "${msg}"; }
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

fin_du_monde() {
  log "Cible $CIBLE : détruite."
  log "${m.fin}"
}

main() {
  verifier_identite "${m.mechant}" "$CODE_LANCEMENT" || exit 1
  tourner_les_cles 1 1 || exit 2
${m.extras.map(([fn]) => `  ${fn}\n`).join("")}  armer_ogives
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

  // Invente un nouveau plan pour ce langage (appelé quand tout le code a été tapé)
  window.regenerateSnippet = (lang) => {
    if (!RENDER[lang]) return false;
    window.SNIPPETS[lang].code = generate(lang);
    return true;
  };
})();
