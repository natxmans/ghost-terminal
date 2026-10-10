// Coloration syntaxique : on calcule une seule fois la "couleur" de chaque caractère du faux code.
window.Highlighter = (() => {
  // index → classe CSS
  const CLASSES = ["", "t-kw", "t-str", "t-num", "t-com", "t-fn", "t-type", "t-pre", "t-const"];
  const KW = 1, STR = 2, NUM = 3, COM = 4, FN = 5, TYPE = 6, PRE = 7, CONST = 8;

  const KEYWORDS = {
    c: "if else for while do return static inline struct const unsigned int long char void sizeof goto break continue switch case default typedef enum extern volatile",
    python: "def class return if elif else for while in not and or is None True False import from as with try except finally raise async await lambda yield pass break continue global del assert",
    javascript: "const let var function return if else for of in while do class new this extends super async await try catch finally throw typeof instanceof null undefined true false switch case break continue default import export from static",
    rust: "fn let mut const static struct enum impl trait for in while loop if else match return use mod pub self Self as ref move where type unsafe true false crate dyn",
    bash: "if then else elif fi for in do done while until case esac function return local set exit echo printf read export shift",
    go: "package import func return if else for range go defer var const type struct map chan select switch case default break continue nil true false make append len close",
    asm: "mov xor or and not cli sti call ret jmp jc jz jnz jne je int in out lodsb stosw rep cmp hlt lgdt push pop inc dec add sub db dw dd dq equ dword byte word",
    custom: "if else elif for while do return function func def fn let const var class struct new this self import from package public private static void int char long bool true false null None nil try catch except finally throw raise async await switch case break continue default end then",
  };

  const TYPES = {
    c: "uint8_t uint16_t uint32_t uint64_t int8_t size_t spinlock_t atomic_t",
    python: "str int float bool list dict tuple set print",
    javascript: "Array Math Map Set Object Promise Number String JSON console process",
    rust: "u8 u16 u32 u64 usize i32 i64 f64 bool String Vec HashMap Duration Instant Option Result",
    bash: "",
    go: "int string bool error byte float64 time Duration",
    asm: "ax bx cx dx si di sp bp ah al bh bl ch cl dh dl eax ebx ecx edx esi edi esp ebp cr0 ds es ss cs fs gs",
    custom: "",
  };

  function build(code, lang) {
    const cls = new Uint8Array(code.length);
    const kw = new Set((KEYWORDS[lang] || "").split(" "));
    const ty = new Set((TYPES[lang] || "").split(" ").filter(Boolean));

    const alts = [];
    if (lang === "c") alts.push("(?<pre>^[ \\t]*#\\w+[^\\n]*)");
    if (lang === "rust") alts.push("(?<pre>#!?\\[[^\\]\\n]*\\])");
    if (lang === "asm") alts.push("(?<pre>%\\w+|\\[(?:BITS|ORG)[^\\]\\n]*\\])");
    const COMMENTS = {
      python: "#[^\\n]*",
      bash: "#[^\\n]*",
      asm: ";[^\\n]*",
      custom: "\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/|#[^\\n]*",
    };
    alts.push(`(?<com>${COMMENTS[lang] || "\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/"})`);
    alts.push("(?<str>\"(?:\\\\.|[^\"\\\\\\n])*\"|'(?:\\\\.|[^'\\\\\\n])*')");
    if (lang === "bash") alts.push("(?<vr>\\$[A-Za-z_@#?0-9][A-Za-z0-9_]*)");
    alts.push("(?<num>\\b(?:0x[0-9a-fA-F_]+|\\d[\\d_]*(?:\\.\\d+)?)(?:ULL|UL|u8|u32|u64|usize|f64|b)?\\b)");
    alts.push("(?<id>[A-Za-z_][A-Za-z0-9_]*)");

    const re = new RegExp(alts.join("|"), "gm");
    let m;
    while ((m = re.exec(code))) {
      const g = m.groups;
      let c = 0;
      if (g.pre) c = PRE;
      else if (g.com) c = COM;
      else if (g.str) c = STR;
      else if (g.vr) c = TYPE;
      else if (g.num) c = NUM;
      else if (g.id) {
        const w = g.id;
        const after = code.slice(re.lastIndex, re.lastIndex + 3);
        if (kw.has(w)) c = KW;
        else if (ty.has(w)) c = TYPE;
        else if (/^\s*\(/.test(after) || (lang === "rust" && /^![([]/.test(after)) || (lang === "asm" && after[0] === ":")) c = FN;
        else if (/^[A-Z][A-Z0-9_]+$/.test(w)) c = CONST;
        else if (/^[A-Z]/.test(w)) c = TYPE;
      }
      if (c) cls.fill(c, m.index, m.index + m[0].length);
    }
    return cls;
  }

  return { build, CLASSES };
})();
