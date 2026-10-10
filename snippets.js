// Faux code affiché à l'écran. Rien de tout ça ne fait quoi que ce soit : c'est du décor.
// String.raw garde les "\n" et autres antislashs tels quels.

window.SNIPPETS = {
  c: {
    name: "C (noyau)",
    code: String.raw`/*
 * mainframe/core/quantum_sched.c
 * Ordonnanceur quantique du noyau NEXUS-9
 */

#include <nexus/kernel.h>
#include <nexus/crypto.h>
#include <nexus/netlink.h>
#include <asm/atomic.h>

#define MAX_NODES        4096
#define CIPHER_ROUNDS    64
#define FIREWALL_MAGIC   0xDEADC0DE

static struct node_table *nodes;
static atomic_t breach_count = ATOMIC_INIT(0);
static spinlock_t gate_lock;

struct packet_hdr {
	uint32_t magic;
	uint16_t flags;
	uint16_t len;
	uint8_t  payload[];
} __attribute__((packed));

static inline uint64_t rotl64(uint64_t x, int r)
{
	return (x << r) | (x >> (64 - r));
}

static uint64_t scramble_key(uint64_t seed, int rounds)
{
	uint64_t k = seed ^ 0x9E3779B97F4A7C15ULL;
	int i;

	for (i = 0; i < rounds; i++) {
		k = rotl64(k, 13) ^ (k >> 7);
		k *= 0xBF58476D1CE4E5B9ULL;
	}
	return k;
}

int gate_open(struct node *n, const struct packet_hdr *hdr)
{
	unsigned long flags;
	int ret = -EACCES;

	if (unlikely(hdr->magic != FIREWALL_MAGIC)) {
		pr_warn("gate: signature invalide sur le noeud %u\n", n->id);
		return -EINVAL;
	}

	spin_lock_irqsave(&gate_lock, flags);
	if (n->state == NODE_STANDBY) {
		n->session = scramble_key(n->id, CIPHER_ROUNDS);
		n->state = NODE_LINKED;
		atomic_inc(&breach_count);
		ret = 0;
	}
	spin_unlock_irqrestore(&gate_lock, flags);

	return ret;
}

static void sync_all_nodes(void)
{
	struct node *n;
	int linked = 0;

	list_for_each_entry(n, &nodes->list, link) {
		if (gate_open(n, n->last_hdr) == 0)
			linked++;
		cpu_relax();
	}
	pr_info("sync: %d/%d noeuds synchronises\n", linked, MAX_NODES);
}

static int __init quantum_init(void)
{
	nodes = kzalloc(sizeof(*nodes), GFP_KERNEL);
	if (!nodes)
		return -ENOMEM;

	spin_lock_init(&gate_lock);
	INIT_LIST_HEAD(&nodes->list);
	netlink_register(&quantum_ops);

	pr_info("quantum_sched: module charge, %d tours de chiffrement\n",
		CIPHER_ROUNDS);
	sync_all_nodes();
	return 0;
}

static void __exit quantum_exit(void)
{
	netlink_unregister(&quantum_ops);
	kfree(nodes);
	pr_info("quantum_sched: module decharge\n");
}

module_init(quantum_init);
module_exit(quantum_exit);
MODULE_LICENSE("GPL");
MODULE_AUTHOR("Zero Cool");

`
  },

  python: {
    name: "Python",
    code: String.raw`#!/usr/bin/env python3
# satlink/uplink.py — Liaison montante vers le satellite ORION-7

import asyncio
import hashlib
import random
from dataclasses import dataclass, field

FREQ_MHZ = 2483.5
HANDSHAKE_TIMEOUT = 3.0
SECTORS = ["ALPHA", "BRAVO", "CHARLIE", "DELTA", "ECHO"]


@dataclass
class Transponder:
    ident: str
    sector: str
    signal: float = 0.0
    locked: bool = False
    log: list = field(default_factory=list)

    def checksum(self) -> str:
        raw = f"{self.ident}:{self.sector}:{self.signal:.4f}"
        return hashlib.sha256(raw.encode()).hexdigest()[:16]


class Uplink:
    def __init__(self, callsign: str):
        self.callsign = callsign
        self.transponders: dict[str, Transponder] = {}
        self.attempts = 0

    async def scan(self) -> list[Transponder]:
        print(f"[*] Balayage des secteurs sur {FREQ_MHZ} MHz...")
        found = []
        for sector in SECTORS:
            await asyncio.sleep(0.05)
            t = Transponder(ident=f"ORN-{random.randint(100, 999)}", sector=sector)
            t.signal = random.uniform(0.2, 1.0)
            found.append(t)
            self.transponders[t.ident] = t
        return sorted(found, key=lambda t: t.signal, reverse=True)

    async def handshake(self, t: Transponder) -> bool:
        self.attempts += 1
        try:
            await asyncio.wait_for(self._negotiate(t), HANDSHAKE_TIMEOUT)
        except asyncio.TimeoutError:
            t.log.append("timeout")
            return False
        t.locked = True
        t.log.append(f"verrouille ({t.checksum()})")
        return True

    async def _negotiate(self, t: Transponder):
        for phase in ("SYN", "SYN-ACK", "KEY-EXCHANGE", "ACK"):
            await asyncio.sleep(0.02 / max(t.signal, 0.1))
            t.log.append(phase)

    def report(self):
        locked = [t for t in self.transponders.values() if t.locked]
        print(f"[+] {len(locked)}/{len(self.transponders)} transpondeurs verrouilles")
        for t in locked:
            bar = "#" * int(t.signal * 20)
            print(f"    {t.ident:<8} {t.sector:<8} [{bar:<20}] {t.checksum()}")


async def main():
    link = Uplink(callsign="GHOST-RIDER")
    candidates = await link.scan()

    for t in candidates:
        ok = await link.handshake(t)
        status = "OK" if ok else "ECHEC"
        print(f"    -> {t.ident} ({t.sector}) : {status}")

    link.report()
    print("[*] Liaison etablie. Telemetrie en direct.")


if __name__ == "__main__":
    asyncio.run(main())

`
  },

  javascript: {
    name: "JavaScript",
    code: String.raw`// grid/neural-proxy.js — Proxy neuronal du réseau GRID

"use strict";

const LAYERS = [128, 64, 32, 8];
const LEARNING_RATE = 0.0042;
const NODES = new Map();

class Neuron {
  constructor(inputs) {
    this.weights = Array.from({ length: inputs }, () => Math.random() * 2 - 1);
    this.bias = Math.random() * 2 - 1;
    this.output = 0;
  }

  activate(values) {
    const sum = values.reduce((acc, v, i) => acc + v * this.weights[i], this.bias);
    this.output = 1 / (1 + Math.exp(-sum));
    return this.output;
  }
}

class Layer {
  constructor(size, inputs) {
    this.neurons = Array.from({ length: size }, () => new Neuron(inputs));
  }

  forward(values) {
    return this.neurons.map((n) => n.activate(values));
  }
}

class NeuralProxy {
  constructor(shape) {
    this.layers = [];
    for (let i = 1; i < shape.length; i++) {
      this.layers.push(new Layer(shape[i], shape[i - 1]));
    }
    this.packets = 0;
  }

  route(signal) {
    this.packets++;
    return this.layers.reduce((data, layer) => layer.forward(data), signal);
  }

  fingerprint() {
    let h = 0x811c9dc5;
    for (const layer of this.layers) {
      for (const n of layer.neurons) {
        h ^= Math.floor(n.bias * 1e6);
        h = Math.imul(h, 0x01000193) >>> 0;
      }
    }
    return h.toString(16).padStart(8, "0");
  }
}

async function bootstrap() {
  console.log("[GRID] Initialisation du proxy neuronal...");
  const proxy = new NeuralProxy(LAYERS);

  for (let node = 0; node < 16; node++) {
    const signal = Array.from({ length: LAYERS[0] }, () => Math.random());
    const out = proxy.route(signal);
    const best = out.indexOf(Math.max(...out));
    NODES.set("node-" + node, { route: best, load: out[best].toFixed(3) });
    await new Promise((r) => setTimeout(r, 10));
  }

  console.log("[GRID] Empreinte : 0x" + proxy.fingerprint());
  console.table(Object.fromEntries(NODES));
  console.log("[GRID] " + proxy.packets + " paquets routes. Systeme en ligne.");
}

bootstrap().catch((err) => {
  console.error("[GRID] Erreur critique :", err.message);
  process.exit(1);
});

`
  },

  rust: {
    name: "Rust",
    code: String.raw`// cipher/src/main.rs — Moteur de chiffrement BLACKICE

use std::collections::HashMap;
use std::fmt;
use std::time::{Duration, Instant};

const BLOCK_SIZE: usize = 32;
const ROUNDS: u32 = 24;

#[derive(Debug, Clone, Copy, PartialEq)]
enum Status {
    Idle,
    Encrypting,
    Locked,
}

struct Vault {
    id: u64,
    blocks: Vec<[u8; BLOCK_SIZE]>,
    status: Status,
    key: u64,
}

impl Vault {
    fn new(id: u64, size: usize) -> Self {
        Vault {
            id,
            blocks: vec![[0u8; BLOCK_SIZE]; size],
            status: Status::Idle,
            key: id.wrapping_mul(0x9E37_79B9_7F4A_7C15),
        }
    }

    fn mix(&mut self) {
        self.status = Status::Encrypting;
        for round in 0..ROUNDS {
            for block in self.blocks.iter_mut() {
                for (i, byte) in block.iter_mut().enumerate() {
                    let k = (self.key >> ((i % 8) * 8)) as u8;
                    *byte = byte.rotate_left(3) ^ k ^ (round as u8);
                }
            }
            self.key = self.key.rotate_left(17) ^ 0xA5A5_A5A5_A5A5_A5A5;
        }
        self.status = Status::Locked;
    }

    fn digest(&self) -> u32 {
        self.blocks
            .iter()
            .flat_map(|b| b.iter())
            .fold(0x811C_9DC5u32, |h, &b| (h ^ b as u32).wrapping_mul(0x0100_0193))
    }
}

impl fmt::Display for Vault {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "VAULT-{:04} [{:?}] digest=0x{:08x}", self.id, self.status, self.digest())
    }
}

fn main() {
    println!(">> BLACKICE v3.1 - initialisation");
    let start = Instant::now();
    let mut vaults: HashMap<u64, Vault> = HashMap::new();

    for id in 1..=12 {
        let mut v = Vault::new(id, 64);
        v.mix();
        vaults.insert(id, v);
    }

    let mut ids: Vec<_> = vaults.keys().copied().collect();
    ids.sort();
    for id in ids {
        println!("   {}", vaults[&id]);
    }

    let elapsed: Duration = start.elapsed();
    println!(">> {} coffres scelles en {:.2?}", vaults.len(), elapsed);
}

`
  },

  go: {
    name: "Go",
    code: String.raw`// darknet/relay/main.go — Relais chiffré du réseau DARKNET

package main

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math/rand"
	"sync"
	"time"
)

const (
	MaxRelays   = 64
	HopsPerPath = 7
	KeySize     = 32
)

type Relay struct {
	ID      int
	Region  string
	Latency time.Duration
	Online  bool
}

type Circuit struct {
	mu    sync.Mutex
	hops  []*Relay
	key   [KeySize]byte
	ready bool
}

func NewRelay(id int, region string) *Relay {
	return &Relay{
		ID:      id,
		Region:  region,
		Latency: time.Duration(rand.Intn(90)+10) * time.Millisecond,
		Online:  rand.Float64() > 0.1,
	}
}

func (c *Circuit) Build(pool []*Relay) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	for _, r := range pool {
		if !r.Online {
			continue
		}
		c.hops = append(c.hops, r)
		if len(c.hops) == HopsPerPath {
			break
		}
	}
	if len(c.hops) < HopsPerPath {
		return fmt.Errorf("circuit incomplet : %d/%d relais", len(c.hops), HopsPerPath)
	}
	seed := fmt.Sprintf("%v-%d", c.hops, time.Now().UnixNano())
	c.key = sha256.Sum256([]byte(seed))
	c.ready = true
	return nil
}

func (c *Circuit) Latency() time.Duration {
	var total time.Duration
	for _, h := range c.hops {
		total += h.Latency
	}
	return total
}

func main() {
	regions := []string{"PAR", "TYO", "NYC", "SYD", "RIO", "OSL", "SIN", "CPT"}
	pool := make([]*Relay, 0, MaxRelays)
	for i := 0; i < MaxRelays; i++ {
		pool = append(pool, NewRelay(i, regions[i%len(regions)]))
	}

	var wg sync.WaitGroup
	results := make(chan string, 4)

	for n := 1; n <= 4; n++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			local := append([]*Relay(nil), pool...)
			rand.Shuffle(len(local), func(i, j int) { local[i], local[j] = local[j], local[i] })
			c := &Circuit{}
			if err := c.Build(local); err != nil {
				results <- fmt.Sprintf("[circuit %d] ECHEC : %v", id, err)
				return
			}
			results <- fmt.Sprintf("[circuit %d] OK  cle=%s  latence=%v",
				id, hex.EncodeToString(c.key[:6]), c.Latency())
		}(n)
	}

	wg.Wait()
	close(results)
	for line := range results {
		fmt.Println(line)
	}
	fmt.Println(">> Relais DARKNET operationnel.")
}

`
  },

  asm: {
    name: "Assembleur x86",
    code: String.raw`; boot/stage2.asm — Chargeur d'amorçage du système NEXUS
; nasm -f bin stage2.asm -o stage2.bin

[BITS 16]
[ORG 0x7E00]

%define VIDEO_MEM   0xB8000
%define KERNEL_SEG  0x1000
%define MAGIC       0x4E455855

start:
    cli
    xor     ax, ax
    mov     ds, ax
    mov     es, ax
    mov     ss, ax
    mov     sp, 0x7C00
    sti

    mov     si, msg_boot
    call    print_string

    call    enable_a20
    call    load_kernel
    jc      disk_error

    lgdt    [gdt_descriptor]
    mov     eax, cr0
    or      eax, 1
    mov     cr0, eax
    jmp     CODE_SEG:protected_mode

print_string:
    lodsb
    or      al, al
    jz      .done
    mov     ah, 0x0E
    int     0x10
    jmp     print_string
.done:
    ret

enable_a20:
    in      al, 0x92
    or      al, 2
    out     0x92, al
    ret

load_kernel:
    mov     ax, KERNEL_SEG
    mov     es, ax
    xor     bx, bx
    mov     ah, 0x02
    mov     al, 32
    mov     ch, 0
    mov     cl, 3
    mov     dh, 0
    int     0x13
    ret

disk_error:
    mov     si, msg_error
    call    print_string
    hlt

[BITS 32]
protected_mode:
    mov     ax, DATA_SEG
    mov     ds, ax
    mov     ss, ax
    mov     esp, 0x90000

    mov     edi, VIDEO_MEM
    mov     ecx, 80 * 25
    mov     ax, 0x0A20
    rep     stosw

    cmp     dword [KERNEL_SEG * 16], MAGIC
    jne     .halt
    jmp     KERNEL_SEG * 16 + 4
.halt:
    hlt
    jmp     .halt

gdt_start:
    dq      0
gdt_code:
    dw      0xFFFF, 0
    db      0, 10011010b, 11001111b, 0
gdt_data:
    dw      0xFFFF, 0
    db      0, 10010010b, 11001111b, 0
gdt_end:

gdt_descriptor:
    dw      gdt_end - gdt_start - 1
    dd      gdt_start

CODE_SEG equ gdt_code - gdt_start
DATA_SEG equ gdt_data - gdt_start

msg_boot    db "NEXUS stage2 : passage en mode protege...", 13, 10, 0
msg_error   db "Erreur disque. Systeme arrete.", 13, 10, 0

`
  },

  bash: {
    name: "Bash",
    code: String.raw`#!/usr/bin/env bash
# ops/deploy_ghost.sh — Déploiement de la flotte GHOST

set -euo pipefail

FLEET="ghost"
REGIONS="eu-west us-east ap-south sa-east"
LOG="/var/log/ghost/deploy.log"
VERSION="4.2.0"

log()  { printf "[%s] %s\n" "$(date +%H:%M:%S)" "$*" | tee -a "$LOG"; }
fail() { log "ERREUR: $*"; exit 1; }

check_deps() {
  for bin in ssh rsync jq openssl; do
    command -v "$bin" >/dev/null 2>&1 || fail "$bin introuvable"
  done
  log "Dependances OK"
}

gen_token() {
  openssl rand -hex 16
}

deploy_region() {
  local region="$1"
  local token
  token="$(gen_token)"

  log "Region $region : ouverture du tunnel (jeton $token)"
  for node in $(seq -w 1 8); do
    host="$FLEET-$region-$node"
    printf "  -> %-22s " "$host"
    sleep 0.05
    echo "[ OK ]"
  done
  log "Region $region : 8 noeuds a jour (v$VERSION)"
}

health_report() {
  log "Rapport de sante :"
  for region in "$@"; do
    load=$(( RANDOM % 60 + 20 ))
    bar=$(printf "%0.s#" $(seq 1 $(( load / 5 ))))
    printf "  %-10s %-20s %3d%%\n" "$region" "$bar" "$load"
  done
}

main() {
  log "=== Deploiement $FLEET v$VERSION ==="
  check_deps

  for region in $REGIONS; do
    deploy_region "$region"
  done

  health_report $REGIONS
  log "=== Termine. Flotte operationnelle. ==="
}

main "$@"

`
  }
};
