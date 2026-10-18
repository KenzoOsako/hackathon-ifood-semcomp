// MUTATION TESTING próprio (sem dependência nova). Quebra o código de propósito e roda os testes: teste que continua
// passando com o código quebrado ("mutante sobrevivente") não protege aquilo. Por que não o Stryker: com o Vitest 5 o
// processo filho cai e os mutantes não são ativados (medido em 18/10), e um placar em que não dá para confiar é pior que nenhum.
//
//   node scripts/mutacao.mjs src/agent/relevancia.ts src/agent/especificidade.ts
//   node scripts/mutacao.mjs --todos                  # módulos críticos (lista abaixo)
//   node scripts/mutacao.mjs src/x.ts --limite 40     # amostra determinística de 40 mutantes
//   node scripts/mutacao.mjs --todos --piso           # falha se algum placar cair abaixo de quality/mutacao-base.json
//   node scripts/mutacao.mjs --todos --atualizar-piso # grava o placar atual como novo piso (só deve subir)
//
// Operadores (os mesmos que importam num agente): fronteira (> >= < <=), igualdade, && ||, aritmética, ! removido,
// true/false, número +1, ?: e if forçados, métodos opostos (some/every, min/max, startsWith/endsWith), instrução
// removida e alternativa removida de regex (cada palavra de uma lista proibida precisa de teste próprio).
import ts from "typescript";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const CRITICOS = [
  "src/agent/relevancia.ts", "src/agent/especificidade.ts", "src/agent/limites.ts",
  "src/agent/domain-mcp/index.ts", "src/agent/orchestrator/index.ts", "src/agent/proposals.ts",
  "src/agent/visitor-session.ts", "src/agent/http.ts", "src/prompts/responder.ts",
  "src/voice/guard.ts", "src/voice/speakable.ts", "src/voice/rate-limit.ts", "src/voice/budget.ts",
  "src/voice/http-guard.ts", "src/voice/keyterms.ts", "src/voice/converse-client.ts",
];
const PISO = "quality/mutacao-base.json";
const TIMEOUT_MS = 90_000;

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const valor = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const arquivos = flag("--todos") ? CRITICOS : args.filter((a, i) => a.endsWith(".ts") && args[i - 1] !== "--limite");
const limite = valor("--limite") ? Number(valor("--limite")) : Infinity;
if (arquivos.length === 0) { console.error("Uso: node scripts/mutacao.mjs <arquivo.ts>... | --todos"); process.exit(2); }

// ---------- geração de mutantes (AST) ----------
const TROCA_BIN = { ">": ">=", ">=": ">", "<": "<=", "<=": "<", "===": "!==", "!==": "===", "==": "!=", "!=": "==", "&&": "||", "||": "&&", "+": "-", "-": "+", "*": "/", "/": "*" };
const TROCA_METODO = { some: "every", every: "some", startsWith: "endsWith", endsWith: "startsWith", min: "max", max: "min", shift: "pop", pop: "shift" };

function alternativasRegex(corpo) {
  // Acha cada grupo (e o nível raiz) com 2+ alternativas separadas por "|", devolvendo os trechos [ini, fim) de cada alternativa.
  const pilha = [{ ini: 0, cortes: [] }];
  const grupos = [];
  let classe = false;
  for (let i = 0; i < corpo.length; i++) {
    const c = corpo[i];
    if (c === "\\") { i++; continue; }
    if (classe) { if (c === "]") classe = false; continue; }
    if (c === "[") classe = true;
    else if (c === "(") pilha.push({ ini: i + 1, cortes: [] });
    else if (c === "|") pilha[pilha.length - 1].cortes.push(i);
    else if (c === ")" && pilha.length > 1) { const g = pilha.pop(); g.fim = i; grupos.push(g); }
  }
  const raiz = pilha[0]; raiz.fim = corpo.length; grupos.push(raiz);
  return grupos.filter((g) => g.cortes.length >= 1).map((g) => {
    const lim = [g.ini - 1, ...g.cortes, g.fim]; // cada alternativa fica entre dois limites
    return lim.slice(0, -1).map((a, k) => [a + 1, lim[k + 1]]);
  });
}

function gerar(arquivo) {
  const texto = readFileSync(arquivo, "utf8");
  const sf = ts.createSourceFile(arquivo, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const muts = [];
  const add = (ini, fim, novo, operador, no) => {
    if (texto.slice(ini, fim) === novo) return;
    const { line } = sf.getLineAndCharacterOfPosition(ini);
    muts.push({ arquivo, ini, fim, novo, operador, linha: line + 1, original: texto.slice(ini, fim).slice(0, 80), no: no?.kind });
  };
  const emConsole = (n) => { for (let p = n; p; p = p.parent) if (ts.isCallExpression(p) && /^console\./.test(p.expression.getText(sf))) return true; return false; };
  const visitar = (n) => {
    if (ts.isImportDeclaration(n) || ts.isTypeNode(n) || ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n)) return;
    if (emConsole(n)) return;
    if (ts.isBinaryExpression(n)) {
      const op = n.operatorToken.getText(sf);
      if (TROCA_BIN[op]) add(n.operatorToken.getStart(sf), n.operatorToken.getEnd(), TROCA_BIN[op], `binario ${op}→${TROCA_BIN[op]}`);
    } else if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.ExclamationToken) {
      add(n.getStart(sf), n.getEnd(), n.operand.getText(sf), "negação removida");
    } else if (n.kind === ts.SyntaxKind.TrueKeyword || n.kind === ts.SyntaxKind.FalseKeyword) {
      add(n.getStart(sf), n.getEnd(), n.kind === ts.SyntaxKind.TrueKeyword ? "false" : "true", "booleano invertido");
    } else if (ts.isNumericLiteral(n) && !ts.isPropertyAssignment(n.parent)) {
      const v = Number(n.text);
      add(n.getStart(sf), n.getEnd(), String(v === 0 ? 1 : v + (Number.isInteger(v) ? 1 : 0.1)), `número ${n.text}`);
    } else if (ts.isConditionalExpression(n)) {
      add(n.condition.getStart(sf), n.condition.getEnd(), "true", "ternário sempre verdadeiro");
      add(n.condition.getStart(sf), n.condition.getEnd(), "false", "ternário sempre falso");
    } else if (ts.isIfStatement(n)) {
      add(n.expression.getStart(sf), n.expression.getEnd(), "true", "if sempre verdadeiro");
      add(n.expression.getStart(sf), n.expression.getEnd(), "false", "if sempre falso");
    } else if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && TROCA_METODO[n.expression.name.text]) {
      add(n.expression.name.getStart(sf), n.expression.name.getEnd(), TROCA_METODO[n.expression.name.text], `método ${n.expression.name.text}`);
    } else if (ts.isExpressionStatement(n) && (ts.isCallExpression(n.expression) || ts.isAwaitExpression(n.expression) || (ts.isBinaryExpression(n.expression) && n.expression.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && n.expression.operatorToken.kind <= ts.SyntaxKind.LastAssignment))) {
      add(n.getStart(sf), n.getEnd(), ";", "instrução removida");
    } else if (ts.isRegularExpressionLiteral(n)) {
      const m = n.text.match(/^\/(.*)\/([a-z]*)$/s);
      if (m) {
        let feitos = 0;
        for (const alts of alternativasRegex(m[1])) {
          for (const [a, b] of alts) {
            if (feitos >= 6 || alts.length < 2) continue;
            // Remove a alternativa e UM separador vizinho.
            const sepAntes = a > 0 && m[1][a - 1] === "|";
            const ini = sepAntes ? a - 1 : a; const fim = sepAntes ? b : (m[1][b] === "|" ? b + 1 : b);
            const novoCorpo = m[1].slice(0, ini) + m[1].slice(fim);
            if (novoCorpo.length === 0) continue;
            add(n.getStart(sf), n.getEnd(), `/${novoCorpo}/${m[2]}`, `regex sem "${m[1].slice(a, b).slice(0, 24)}"`);
            feitos++;
          }
        }
      }
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return { texto, muts };
}

// Amostra determinística (para limitar o tempo sem escolher a dedo).
function amostrar(lista, n) {
  if (lista.length <= n) return lista;
  let s = 7;
  const aleatorio = () => (s = (s * 48271) % 2147483647) / 2147483647;
  return [...lista].map((m) => ({ m, k: aleatorio() })).sort((a, b) => a.k - b.k).slice(0, n).map((x) => x.m).sort((a, b) => a.ini - b.ini);
}

// ---------- execução ----------
const vitest = ["node_modules/vitest/vitest.mjs"];
function testes(arquivo) {
  const r = spawnSync(process.execPath, [...vitest, "related", arquivo, "--run", "--reporter=dot", "--bail", "1"], { encoding: "utf8", timeout: TIMEOUT_MS, env: { ...process.env, EVAL_REAL: "" } });
  return { ok: r.status === 0, timeout: Boolean(r.error), saida: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

const piso = existsSync(PISO) ? JSON.parse(readFileSync(PISO, "utf8")) : {};
const relatorio = {};
let falhouPiso = false;

for (const arquivo of arquivos) {
  const { texto, muts } = gerar(arquivo);
  const lista = amostrar(muts, limite);
  console.log(`\n=== ${arquivo}: ${muts.length} mutantes${lista.length < muts.length ? ` (amostra de ${lista.length})` : ""}`);
  const base = testes(arquivo);
  if (!base.ok) { console.log("  testes relacionados JÁ falham sem mutação: pulando"); relatorio[arquivo] = { erro: "base falha" }; continue; }
  let mortos = 0, validos = 0; const sobreviventes = [];
  try {
    for (const [i, m] of lista.entries()) {
      writeFileSync(arquivo, texto.slice(0, m.ini) + m.novo + texto.slice(m.fim));
      const r = testes(arquivo);
      writeFileSync(arquivo, texto);
      // Mutante que nem compila (erro de sintaxe/transformação) não é mutante: sai da conta.
      if (!r.ok && /Transform failed|SyntaxError|Unexpected token|Expected/.test(r.saida) && !/AssertionError|expected/.test(r.saida)) continue;
      validos++;
      if (!r.ok) mortos++; else sobreviventes.push(m);
      process.stdout.write(r.ok ? "S" : ".");
      if ((i + 1) % 60 === 0) process.stdout.write(` ${i + 1}/${lista.length}\n`);
    }
  } finally { writeFileSync(arquivo, texto); }
  const placar = validos ? Math.round((mortos / validos) * 1000) / 10 : 100;
  relatorio[arquivo] = { placar, mortos, validos, sobreviventes: sobreviventes.map((m) => ({ linha: m.linha, operador: m.operador, original: m.original, novo: m.novo.slice(0, 80) })) };
  console.log(`\n  placar ${placar}% (${mortos}/${validos} mortos), ${sobreviventes.length} sobreviventes`);
  for (const s of sobreviventes) console.log(`   [${s.linha}] ${s.operador}: ${s.original.replace(/\s+/g, " ")}  →  ${s.novo.replace(/\s+/g, " ").slice(0, 60)}`);
  if (flag("--piso") && piso[arquivo] !== undefined && placar < piso[arquivo]) { falhouPiso = true; console.log(`   PISO: ${placar}% < ${piso[arquivo]}%`); }
}

mkdirSync("reports/mutation", { recursive: true });
writeFileSync("reports/mutation/resumo.json", JSON.stringify({ geradoEm: new Date().toISOString(), relatorio }, null, 2));
if (flag("--atualizar-piso")) {
  mkdirSync("quality", { recursive: true });
  const novo = { ...piso };
  for (const [a, r] of Object.entries(relatorio)) if (typeof r.placar === "number") novo[a] = Math.max(novo[a] ?? 0, r.placar);
  writeFileSync(PISO, JSON.stringify(novo, null, 2) + "\n");
  console.log(`\nPiso atualizado em ${PISO}`);
}
console.log("\nResumo:"); for (const [a, r] of Object.entries(relatorio)) console.log(`  ${r.placar ?? "-"}%  ${a}`);
process.exitCode = falhouPiso ? 1 : 0;
