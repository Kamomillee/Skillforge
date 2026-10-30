// Télécharge la distribution Pyodide officielle (GitHub Releases) et en extrait
// uniquement le noyau + les paquets utilisés par les exercices, dans public/pyodide/.
// Les fichiers sont auto-hébergés : aucun CDN n'est requis à l'exécution.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const VERSION = "314.0.7"; // doit correspondre à la version du paquet npm `pyodide`
// Paquets nécessaires aux exercices (les dépendances sont résolues via pyodide-lock.json).
const WANTED = ["numpy", "pandas", "scikit-learn"];

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "pyodide");
const cacheDir = process.env.PYODIDE_CACHE_DIR ?? join(homedir(), ".cache", "pyodide");
const tarball = join(cacheDir, `pyodide-${VERSION}.tar.bz2`);
const url = `https://github.com/pyodide/pyodide/releases/download/${VERSION}/pyodide-${VERSION}.tar.bz2`;

const marker = join(out, ".version");
if (existsSync(marker) && readFileSync(marker, "utf8").trim() === VERSION && !process.argv.includes("--force")) {
  console.log(`Pyodide ${VERSION} déjà présent dans public/pyodide`);
  process.exit(0);
}

mkdirSync(cacheDir, { recursive: true });
if (!existsSync(tarball) || statSync(tarball).size < 1e8) {
  console.log(`Téléchargement de ${url} (~330 Mo, une seule fois)…`);
  execFileSync("curl", ["-fSL", "--retry", "4", "-o", tarball, url], { stdio: "inherit" });
}

const core = [
  "pyodide.mjs", "pyodide.js", "pyodide.asm.mjs", "pyodide.asm.wasm",
  "python_stdlib.zip", "pyodide-lock.json", "package.json",
];
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const tmp = join(cacheDir, `extract-${VERSION}`);
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
execFileSync("tar", ["xjf", tarball, "-C", tmp, ...core.map((f) => `pyodide/${f}`)], { stdio: "inherit" });

const lock = JSON.parse(readFileSync(join(tmp, "pyodide", "pyodide-lock.json"), "utf8"));
const needed = new Set();
const visit = (name) => {
  const key = name.toLowerCase();
  const pkg = lock.packages[key];
  if (!pkg) throw new Error(`Paquet introuvable dans pyodide-lock.json : ${name}`);
  if (needed.has(key)) return;
  needed.add(key);
  for (const dep of pkg.depends ?? []) visit(dep);
};
WANTED.forEach(visit);
const files = [...needed].map((k) => `pyodide/${lock.packages[k].file_name}`);
execFileSync("tar", ["xjf", tarball, "-C", tmp, ...files], { stdio: "inherit" });
execFileSync("sh", ["-c", `cp -r "${join(tmp, "pyodide")}/." "${out}/"`]);
rmSync(tmp, { recursive: true, force: true });
writeFileSync(marker, VERSION + "\n");
console.log(`Pyodide ${VERSION} prêt : noyau + ${needed.size} paquets (${[...needed].sort().join(", ")})`);
