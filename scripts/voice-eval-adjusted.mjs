// Recalcula a bateria de voz (arquivo salvo por voice-eval.mjs) com normalização "justa": números em dígitos e
// contrações coloquiais não contam como erro de reconhecimento. Não gasta créditos.
// Uso: node scripts/voice-eval-adjusted.mjs [caminho/voice-eval.json]
import fs from "node:fs";

const file = process.argv[2] || (process.env.TEMP || ".") + "/voice-eval.json";
const data = JSON.parse(fs.readFileSync(file, "utf8"));

const strip = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9$ ]/g, " ").replace(/\s+/g, " ").trim();
const NUM = { "um": "1", "uma": "1", "dois": "2", "duas": "2", "tres": "3", "quatro": "4", "cinco": "5", "seis": "6", "quinhentos": "500", "cem": "100" };

function norm(s) {
  let t = " " + strip(s) + " ";
  t = t.replace(/ r\$ ?(\d+) /g, " $1 reais ").replace(/ (\d+) reais /g, " $1 reais ");
  t = t.replace(/ pras /g, " para as ").replace(/ pros /g, " para os ").replace(/ pra /g, " para ").replace(/ pro /g, " para o ");
  return t.trim().split(" ").map((w) => NUM[w] ?? w).join(" ").replace(/ 500 mililitros /g, " 500 ml ");
}
const words = (s) => norm(s).split(" ").filter(Boolean);

function wer(ref, hyp) {
  const r = words(ref), h = words(hyp);
  const d = Array.from({ length: r.length + 1 }, (_, i) => [i, ...Array(h.length).fill(0)]);
  for (let j = 1; j <= h.length; j++) d[0][j] = j;
  for (let i = 1; i <= r.length; i++) for (let j = 1; j <= h.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
  return { errors: d[r.length][h.length], n: r.length };
}

const pct = (x) => (100 * x).toFixed(1) + "%";
const total = { sem: { e: 0, n: 0, ok: 0 }, com: { e: 0, n: 0, ok: 0 } };
const vazias = [];
for (const r of data.results) {
  for (const k of ["sem", "com"]) {
    const x = wer(r.ref, r[k]);
    total[k].e += x.errors; total[k].n += x.n; total[k].ok += x.errors === 0 ? 1 : 0;
    if (!r[k].trim()) vazias.push(`${r.voiceName} (${k}): ${r.ref}`);
  }
}
const N = data.results.length;
console.log(`Frases: ${N} | vozes: ${data.voices.length}`);
console.log(`Erro por palavra (ajustado): sem palavras-chave ${pct(total.sem.e / total.sem.n)} | com ${pct(total.com.e / total.com.n)}`);
console.log(`Frases 100% certas (ajustado): sem ${total.sem.ok}/${N} | com ${total.com.ok}/${N}`);
console.log(`Respostas VAZIAS: ${vazias.length}${vazias.length ? "\n  " + vazias.join("\n  ") : ""}`);
const bad = data.results.map((r) => ({ r, e: wer(r.ref, r.com).errors })).filter((x) => x.e > 0).sort((a, b) => b.e - a.e);
console.log(`\nErros que sobraram COM palavras-chave: ${bad.length}`);
for (const { r, e } of bad.slice(0, 10)) console.log(`  [${r.voiceName.slice(0, 12)}, ${e}] ref: ${r.ref}\n               com: ${r.com}`);
