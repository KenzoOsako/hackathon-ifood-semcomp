// Teste de caos: centenas de conversas geradas com semente, contra um modelo, um catálogo e um usuário hostis.
// A propriedade: NADA do que vem de fora pode fazer o agente quebrar, mentir ou violar uma invariante.
//   CAOS_N=2000 npx vitest run src/qualidade/caos.test.ts        # mais conversas
//   CAOS_SEMENTE=137 CAOS_N=1 npx vitest run src/qualidade/caos   # reproduz uma conversa que falhou
import { describe, expect, it, vi } from "vitest";
import { executarTurno, novaSessao } from "@/agent/orchestrator";
import { DominioCaotico, FALAS_DO_USUARIO, LlmCaotico, escolher, prng } from "./caos";
import { checarInvariantes } from "./invariantes";

const N = Number(process.env.CAOS_N ?? 300);
const BASE = Number(process.env.CAOS_SEMENTE ?? 1);

interface Achado { semente: number; turno: number; usuario: string; tipo: string; detalhe: string; resposta?: string }

async function conversa(semente: number): Promise<Achado[]> {
  const r = prng(semente);
  const llm = new LlmCaotico(r);
  const domain = new DominioCaotico(r);
  const s = novaSessao(`caos-${semente}`);
  const achados: Achado[] = [];
  let anterior: string | undefined;
  const turnos = 1 + Math.floor(r() * 6);
  for (let t = 1; t <= turnos; t++) {
    const usuario = escolher(r, FALAS_DO_USUARIO);
    const porVoz = r() < 0.4;
    try {
      const reply = await executarTurno(s, { texto: usuario, origem: porVoz ? "voz" : "texto", ...(porVoz ? { sinais: { origem: "voz" as const, interrompeu: false, confianca: escolher(r, [0.3, 0.7, 0.95, 1]) } } : {}) }, { llm, domain });
      for (const v of checarInvariantes({ texto: usuario, reply, sessao: s, anterior })) achados.push({ semente, turno: t, usuario: usuario.slice(0, 60), tipo: v.id, detalhe: v.detalhe, resposta: reply.resposta.slice(0, 140) });
      anterior = reply.resposta;
    } catch (e) {
      achados.push({ semente, turno: t, usuario: usuario.slice(0, 60), tipo: "excecao", detalhe: String((e as Error)?.message ?? e).slice(0, 160) });
      break;
    }
  }
  return achados;
}

describe(`caos: ${N} conversas hostis (sementes ${BASE} a ${BASE + N - 1})`, () => {
  it("nenhuma conversa quebra, mente ou viola uma invariante", { timeout: 120_000 }, async () => {
    const todos: Achado[] = [];
    // O agente avisa no log cada falha do modelo (esperado aqui, é o ataque): silencia só durante a rodada.
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try { for (let i = 0; i < N; i++) todos.push(...(await conversa(BASE + i))); } finally { aviso.mockRestore(); }
    const porTipo = new Map<string, Achado[]>();
    for (const a of todos) porTipo.set(a.tipo, [...(porTipo.get(a.tipo) ?? []), a]);
    const resumo = [...porTipo.entries()].sort((a, b) => b[1].length - a[1].length).map(([tipo, lista]) => `${tipo}: ${lista.length}  (ex.: semente ${lista[0].semente}, turno ${lista[0].turno}, "${lista[0].usuario}" → "${lista[0].resposta ?? lista[0].detalhe}")`);
    if (resumo.length) console.info(`\nACHADOS DO CAOS (${todos.length} em ${N} conversas):\n  ${resumo.join("\n  ")}`);
    expect(todos.map((a) => `${a.tipo} semente=${a.semente} t${a.turno}: ${a.detalhe}`)).toEqual([]);
  });
});
