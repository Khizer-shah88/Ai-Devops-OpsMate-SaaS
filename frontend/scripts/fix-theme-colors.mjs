import fs from "fs";
import path from "path";

const root = path.resolve(".");
const exts = new Set([".tsx", ".ts", ".css"]);

const pairs = [
  [/text-cyan-50(?![0-9a-zA-Z-])/g, "text-sky-900 dark:text-cyan-50"],
  [/text-cyan-100(?![0-9a-zA-Z-])/g, "text-sky-800 dark:text-cyan-100"],
  [/text-cyan-200(?![0-9a-zA-Z-])/g, "text-sky-700 dark:text-cyan-200"],
  [/text-cyan-300(?![0-9a-zA-Z-])/g, "text-sky-700 dark:text-cyan-300"],
  [/text-cyan-400(?![0-9a-zA-Z-])/g, "text-sky-600 dark:text-cyan-400"],
  [/text-emerald-200(?![0-9a-zA-Z-])/g, "text-emerald-800 dark:text-emerald-200"],
  [/text-emerald-300(?![0-9a-zA-Z-])/g, "text-emerald-700 dark:text-emerald-300"],
  [/text-emerald-400(?![0-9a-zA-Z-])/g, "text-emerald-600 dark:text-emerald-400"],
  [/text-amber-200(?![0-9a-zA-Z-])/g, "text-amber-800 dark:text-amber-200"],
  [/text-amber-300(?![0-9a-zA-Z-])/g, "text-amber-700 dark:text-amber-300"],
  [/text-amber-400(?![0-9a-zA-Z-])/g, "text-amber-600 dark:text-amber-400"],
  [/text-rose-300(?![0-9a-zA-Z-])/g, "text-rose-700 dark:text-rose-300"],
  [/text-rose-400(?![0-9a-zA-Z-])/g, "text-rose-600 dark:text-rose-400"],
  [/text-red-300(?![0-9a-zA-Z-])/g, "text-red-700 dark:text-red-300"],
  [/text-red-400(?![0-9a-zA-Z-])/g, "text-red-600 dark:text-red-400"],
  [/text-violet-300(?![0-9a-zA-Z-])/g, "text-violet-700 dark:text-violet-300"],
  [/text-violet-400(?![0-9a-zA-Z-])/g, "text-violet-600 dark:text-violet-400"],
  [/text-blue-400(?![0-9a-zA-Z-])/g, "text-blue-600 dark:text-blue-400"],
  [/text-sky-300(?![0-9a-zA-Z-])/g, "text-sky-700 dark:text-sky-300"],
  [/text-sky-400(?![0-9a-zA-Z-])/g, "text-sky-600 dark:text-sky-400"],
];

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".next" || ent.name === "scripts") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (exts.has(path.extname(ent.name))) out.push(p);
  }
  return out;
}

let changed = 0;
for (const file of walk(root)) {
  const text = fs.readFileSync(file, "utf8");
  let next = text;
  for (const [re, rep] of pairs) {
    next = next.replace(re, (match, offset, full) => {
      const around = full.slice(Math.max(0, offset - 40), offset + match.length + 40);
      if (around.includes(`dark:${match}`) || around.includes(`${match} dark:`)) return match;
      if (/dark:text-(sky|cyan|emerald|amber|rose|red|violet|blue)-\d+/.test(around) && around.includes(match)) {
        // already dual-mode nearby; still replace bare token carefully
      }
      return rep;
    });
  }
  // collapse accidental triple dark: chains
  next = next.replace(
    /(text-(?:sky|cyan|emerald|amber|rose|red|violet|blue)-\d+\s+dark:text-(?:sky|cyan|emerald|amber|rose|red|violet|blue)-\d+)(?:\s+dark:text-(?:sky|cyan|emerald|amber|rose|red|violet|blue)-\d+)+/g,
    "$1",
  );
  if (next !== text) {
    fs.writeFileSync(file, next);
    changed += 1;
    console.log("updated", path.relative(root, file));
  }
}
console.log(`files_changed=${changed}`);
