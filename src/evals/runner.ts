import { FakeDomain } from "@/agent/domain-fake";
import { executarTurno, novaSessao } from "@/agent/orchestrator";
import type { AgentReply, AgentSession, LlmPort } from "@/agent/types";
import { falaRespeitaSnapshot } from "@/prompts/responder";
import type { Cenario } from "./cenarios";

export interface ResultadoTurno { usuario: string; resposta: string; falhas: string[]; totalMs: number }
export interface ResultadoCenario { id: string; passou: boolean; turnos: ResultadoTurno[] }

type Esperado = Cenario["turnos"][number]["esperado"];

function checarEstadoENivel(r: AgentReply, s: AgentSession, e: Esperado, falhas: string[]) {
  if (e.estado && r.estado !== e.estado) falhas.push(`estado ${r.estado} ≠ ${e.estado}`);
  if (e.nivel && r.nivel !== e.nivel) falhas.push(`nível ${r.nivel} ≠ ${e.nivel}`);
  if (e.maxPerguntas !== undefined && s.perguntasFeitas > e.maxPerguntas) {
    falhas.push(`${s.perguntasFeitas} perguntas > ${e.maxPerguntas}`);
  }
}

function checarPlanoEFala(r: AgentReply, e: Esperado, falhas: string[]) {
  if (e.temPlano !== undefined && Boolean(r.tela) !== e.temPlano) {
    falhas.push(e.temPlano ? "sem plano" : "plano inesperado");
  }
  if (e.minBlocos !== undefined && (r.tela?.plano.blocos.length ?? 0) < e.minBlocos) {
    falhas.push(`blocos < ${e.minBlocos}`);
  }
  if (e.aprovacao !== undefined && Boolean(r.aprovacao) !== e.aprovacao) {
    falhas.push(e.aprovacao ? "sem evento de aprovação" : "aprovação indevida");
  }
  if (e.contem && !e.contem.test(r.resposta)) falhas.push(`não contém ${e.contem}`);
  if (e.naoContem?.test(r.resposta)) falhas.push(`contém ${e.naoContem}`);
  // Regra de ouro: número falado precisa existir no snapshot.
  if (r.tela && !falaRespeitaSnapshot(r.resposta, r.tela.plano)) falhas.push("número fora do snapshot");
}

export async function rodarCenario(c: Cenario, llm: LlmPort): Promise<ResultadoCenario> {
  const s = novaSessao(`eval-${c.id}`);
  const domain = new FakeDomain();
  const turnos = await c.turnos.reduce<Promise<ResultadoTurno[]>>(async (accPromise, t) => {
    const acc = await accPromise;
    const r = await executarTurno(s, { texto: t.usuario, origem: "texto" }, { llm, domain });
    const falhas: string[] = [];
    checarEstadoENivel(r, s, t.esperado, falhas);
    checarPlanoEFala(r, t.esperado, falhas);
    acc.push({ usuario: t.usuario, resposta: r.resposta, falhas, totalMs: r.tempos.totalMs });
    return acc;
  }, Promise.resolve([]));
  return { id: c.id, passou: turnos.every((t) => t.falhas.length === 0), turnos };
}

