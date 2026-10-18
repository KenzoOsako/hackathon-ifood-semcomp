// Bateria de qualidade do RECONHECIMENTO de fala em português com o vocabulário do Guide.
// Gera cada frase com vozes brasileiras da conta (TTS), devolve ao STT (Scribe) com e sem palavras-chave e mede
// o erro por palavra (WER) e o acerto das palavras do domínio. LIMITAÇÃO: voz sintética é limpa; não mede ruído
// de sala nem sotaques reais. Serve para comparar configurações (com/sem palavras-chave, modelos), não como prova final.
//
// Uso: node scripts/voice-eval.mjs [--voices=4] [--model=scribe_v2]   (lê ELEVENLABS_* do .env; gasta poucos créditos)
import fs from "node:fs";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const MODEL = args.model || "scribe_v2";
const VOICES_N = Number(args.voices || 4);

const env = Object.fromEntries(fs.readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.split("=")[0], l.slice(l.indexOf("=") + 1).trim()]));
const H = { "xi-api-key": env.ELEVENLABS_API_KEY };

// Mesmas palavras-chave fixas de src/voice/keyterms.ts.
const KEYTERMS = ["Guide", "iFood", "calabresa", "margherita", "espetinho", "açaí", "smash", "cheddar", "X-Burger", "Pizzaria Nonna", "Forno e Cia", "Mercado do Bairro", "Mercado Central", "Lanchonete da Praça", "Burger do Zé", "Gourmet Smash", "Casa e Sabor", "Gamer Center", "Livraria Central", "pipoca de micro-ondas", "refrigerante", "lembrancinha"];

// [frase, palavras do domínio que precisam aparecer]
const CORPUS = [
  ["Quero uma pizza calabresa grande, pede logo.", ["calabresa"]],
  ["Escolhe a calabresa da Forno e Cia.", ["calabresa", "forno e cia"]],
  ["Hoje é aniversário de um amigo, vamos comer pizza em casa e ver um filme.", ["aniversário"]],
  ["Umas seis pessoas, mais ou menos.", []],
  ["Pode escolher por mim.", []],
  ["Tanto faz, só faz isso logo.", []],
  ["Quero algo mais barato.", ["barato"]],
  ["E o mais bem avaliado?", ["avaliado"]],
  ["A pipoca do Mercado do Bairro chega mais rápido?", ["pipoca", "mercado do bairro"]],
  ["Prefiro a Pizzaria Nonna, a margherita grande.", ["pizzaria nonna", "margherita"]],
  ["Troca o refrigerante por um suco de laranja.", ["refrigerante", "suco"]],
  ["Tem espetinho de carne com mandioca?", ["espetinho", "mandioca"]],
  ["Quero um açaí de quinhentos mililitros.", ["açaí"]],
  ["O X-Burger da Lanchonete da Praça ainda está em promoção?", ["x-burger", "lanchonete da praça", "promoção"]],
  ["Me indica um presente até cem reais.", ["presente"]],
  ["Esse fone bluetooth da Gamer Center chega amanhã?", ["bluetooth", "gamer center"]],
  ["Aprovo o plano, versão dois.", ["aprovo", "plano"]],
  ["Cancela tudo e começa de novo.", ["cancela"]],
  ["Sem cebola e sem lactose, por favor.", ["cebola", "lactose"]],
  ["Minha mãe é alérgica a camarão.", ["alérgica", "camarão"]],
  ["Qual é o total com o frete?", ["total", "frete"]],
  ["Quanto tempo leva para chegar?", []],
  ["Quero uma lembrancinha para as crianças.", ["lembrancinha"]],
  ["Esse smash duplo com cheddar da Gourmet Smash é bom?", ["smash", "cheddar", "gourmet smash"]],
  ["O livro de culinária da Livraria Central chega em dois dias.", ["livraria central", "culinária"]],
  ["Pode repetir só o nome?", []],
  ["Não, a outra, a calabresa.", ["calabresa"]],
  ["Preciso de copos descartáveis e refrigerante de dois litros.", ["descartáveis", "refrigerante"]],
];

const strip = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const words = (s) => strip(s).split(" ").filter(Boolean);

function wer(ref, hyp) {
  const r = words(ref), h = words(hyp);
  const d = Array.from({ length: r.length + 1 }, (_, i) => [i, ...new Array(h.length).fill(0)]);
  for (let j = 1; j <= h.length; j++) d[0][j] = j;
  for (let i = 1; i <= r.length; i++) {
    for (let j = 1; j <= h.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
    }
  }
  return { errors: d[r.length][h.length], n: r.length };
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let i = 0;
  const runWorker = async () => {
    const k = i++;
    if (k >= items.length) {
      return;
    }
    out[k] = await fn(items[k], k);
    await runWorker();
  };
  await Promise.all(Array.from({ length: size }, () => runWorker()));
  return out;
}

async function tts(text, voice) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/stream?output_format=mp3_44100_64`, { method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify({ text, model_id: env.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5", language_code: "pt" }) });
  if (!r.ok) throw new Error("TTS " + r.status);
  return Buffer.from(await r.arrayBuffer());
}

async function stt(buf, withTerms) {
  const fd = new FormData();
  fd.append("model_id", MODEL); fd.append("language_code", "por"); fd.append("tag_audio_events", "false");
  if (withTerms) {
    for (const k of KEYTERMS) {
      fd.append("keyterms", k);
    }
  }
  fd.append("file", new Blob([buf], { type: "audio/mpeg" }), "f.mp3");
  const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: H, body: fd });
  if (!r.ok) throw new Error("STT " + r.status + " " + (await r.text()).slice(0, 120));
  const j = await r.json();
  return { text: (j.text || "").trim(), secs: j.audio_duration_secs || 0 };
}

try {
  const vr = await (await fetch("https://api.elevenlabs.io/v1/voices", { headers: H })).json();
  const br = vr.voices.filter((v) => v.labels?.accent === "brazilian").slice(0, VOICES_N);
  if (br.length === 0) throw new Error("Nenhuma voz brasileira na conta");
  console.log(`Vozes (${br.length}): ${br.map((v) => v.name.split(" - ")[0] + "/" + (v.labels.gender || "?")).join(", ")} | modelo STT: ${MODEL} | frases: ${CORPUS.length}`);

  const jobs = br.flatMap((v) => CORPUS.map(([ref, kw]) => ({ voice: v, ref, kw })));
  let secs = 0;
  const results = await pool(jobs, 4, async (j) => {
    const audio = await tts(j.ref, j.voice.voice_id);
    const [a, b] = await Promise.all([stt(audio, false), stt(audio, true)]);
    secs += a.secs;
    return { ...j, voiceName: j.voice.name.split(" - ")[0], sem: a.text, com: b.text };
  });

  const agg = (key) => {
    const by = {};
    for (const r of results) {
      const e = wer(r.ref, r[key]);
      const kwHit = r.kw.length ? r.kw.filter((k) => strip(r[key]).includes(strip(k))).length : 0;
      for (const g of ["TOTAL", r.voiceName]) {
        by[g] ??= { err: 0, n: 0, kwHit: 0, kwN: 0, exact: 0, cnt: 0 };
        by[g].err += e.errors; by[g].n += e.n; by[g].kwHit += kwHit; by[g].kwN += r.kw.length; by[g].exact += e.errors === 0 ? 1 : 0; by[g].cnt++;
      }
    }
    return by;
  };
  const A = agg("sem"), B = agg("com");
  const pct = (x) => (100 * x).toFixed(1) + "%";
  console.log("\nGrupo        | erro por palavra (sem → com) | acerto de palavras do domínio (sem → com) | frases 100% certas (sem → com)");
  for (const g of Object.keys(A)) console.log(`${g.padEnd(12)} | ${pct(A[g].err / A[g].n)} → ${pct(B[g].err / B[g].n)}`.padEnd(46) + `| ${pct(A[g].kwHit / A[g].kwN)} → ${pct(B[g].kwHit / B[g].kwN)}`.padEnd(40) + `| ${A[g].exact}/${A[g].cnt} → ${B[g].exact}/${B[g].cnt}`);

  const worst = results.map((r) => ({ r, e: wer(r.ref, r.com).errors })).filter((x) => x.e > 0).sort((a, b) => b.e - a.e).slice(0, 8);
  console.log(`\nPiores casos COM palavras-chave (${worst.length} mostrados):`);
  for (const { r, e } of worst) console.log(`  [${r.voiceName}, ${e} erro(s)]\n    ref: ${r.ref}\n    com: ${r.com}\n    sem: ${r.sem}`);
  const out = ".voice-eval.json";
  fs.writeFileSync(out, JSON.stringify({ model: MODEL, voices: br.map((v) => v.name), results }, null, 1));
  console.log(`\nÁudio total reconhecido (sem palavras-chave): ${secs.toFixed(0)} s | detalhes em ${out}`);
} catch (e) {
  console.error("ERRO:", e.message);
  process.exit(1);
}
