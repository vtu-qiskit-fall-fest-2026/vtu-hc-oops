// One command for the whole stack, no extra npm dependency.
//   node scripts/dev.mjs            quantum service + backend + frontend
//   node scripts/dev.mjs quantum    only the QAOA service on :8000
//   node scripts/dev.mjs pytest     quantum tests
//   node scripts/dev.mjs setup      create quantum/.venv and install requirements.txt
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const win = process.platform === "win32";
const venvPython = join(root, "quantum", ".venv", win ? "Scripts/python.exe" : "bin/python");

function python() {
  if (existsSync(venvPython)) return venvPython;
  console.error("quantum/.venv not found. Run `npm run setup` first.");
  process.exit(1);
}

const quantum = () => [python(), ["-W", "ignore", "-m", "uvicorn", "qlogistics.service:app", "--port", "8000"], join(root, "quantum")];
const mode = process.argv[2] || "all";

if (mode === "setup") {
  if (!existsSync(venvPython)) {
    const r = spawnSync(win ? "python" : "python3", ["-m", "venv", join(root, "quantum", ".venv")], { stdio: "inherit" });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }
  const r = spawnSync(venvPython, ["-m", "pip", "install", "-r", join(root, "requirements.txt")], { stdio: "inherit" });
  process.exit(r.status ?? 1);
}

if (mode === "pytest") {
  const r = spawnSync(python(), ["-m", "pytest", "-q"], { cwd: join(root, "quantum"), stdio: "inherit" });
  process.exit(r.status ?? 1);
}

const jobs = mode === "quantum"
  ? { quantum: quantum() }
  : {
      quantum: quantum(),
      backend: ["npm run dev", null, join(root, "backend")],
      frontend: ["npm run dev", null, join(root, "frontend")],
    };

const children = Object.entries(jobs).map(([name, [cmd, args, cwd]]) => {
  // npm is a .cmd shim on Windows and needs a shell; a fixed command string avoids Node's
  // DEP0190 warning about shell + args.
  const child = args ? spawn(cmd, args, { cwd }) : spawn(cmd, { cwd, shell: true });
  const tag = `[${name}]`.padEnd(11);
  for (const stream of [child.stdout, child.stderr]) {
    stream.on("data", (buf) => buf.toString().split(/\r?\n/).filter(Boolean).forEach((l) => console.log(tag, l)));
  }
  child.on("exit", (code) => console.log(tag, `exited (${code})`));
  return child;
});

const stop = () => { children.forEach((c) => c.kill()); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
console.log("Starting", Object.keys(jobs).join(", "), "- app at http://localhost:5173 (Ctrl+C stops all)");
