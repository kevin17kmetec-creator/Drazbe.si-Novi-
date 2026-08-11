const fs = require("fs");
// read translations.ts directly
const transContent = fs.readFileSync("./src/lib/translations.ts", "utf8");

const extractKeys = (lang) => {
  const start = transContent.indexOf(`${lang}: {`);
  if (start === -1) return new Set();
  const sub = transContent.substring(start);
  const end = sub.indexOf("\n  },") !== -1 ? sub.indexOf("\n  },") : sub.indexOf("\n};");
  const block = sub.substring(0, end);
  const keys = new Set();
  const matches = block.matchAll(/^\s*([a-zA-Z0-9_]+)\s*:/gm);
  for (const m of matches) {
    keys.add(m[1]);
  }
  return keys;
};

const sloKeys = extractKeys("SLO");
const enKeys = extractKeys("EN");
const deKeys = extractKeys("DE");

const files = ["App.tsx", ...fs.readdirSync("./src/components").map(f => "./src/components/" + f)];
const keysUsed = new Set();

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, "utf8");
  const matches = content.matchAll(/t\s*\(\s*["']([^"']+)["']\s*\)/g);
  for (const m of matches) {
    keysUsed.add(m[1]);
  }
});

const missingSLO = [...keysUsed].filter(k => !sloKeys.has(k));
const missingEN = [...keysUsed].filter(k => !enKeys.has(k));
const missingDE = [...keysUsed].filter(k => !deKeys.has(k));

console.log("Missing SLO:", missingSLO);
console.log("Missing EN:", missingEN);
console.log("Missing DE:", missingDE);
