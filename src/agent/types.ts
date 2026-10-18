// Contratos internos do agente (frente Hyago). O plano de ocasião aqui é provisório
// até o contrato oficial do domínio (K-3, Kenzo); manter as assinaturas de
// docs/AGENTE_CONVERSA_E_FLUXO.md §4.2 para a troca ser só de implementação.
import { z } from "zod";
import { VoiceSignalsSchema } from "@/voice/signals";

export const VerticalSchema = z.enum(["RESTAURANT", "GROCERIES", "SHOPPING"]);
export type Vertical = z.infer<typeof VerticalSchema>;

export const OcasiaoSchema = z.object({
  tipo: z.string().max(60).optional(),
  pessoas: z.number().int().min(1).max(50).optional(),
  quando: z.string().max(60).optional(),
  local: z.string().max(60).optional(),
});
export type Ocasiao = z.infer<typeof OcasiaoSchema>;

export const NecessidadeSchema = z.object({
  id: z.string().min(1).max(40),
  vertical: VerticalSchema,
  categoria: z.string().min(1).max(60),
  restricoes: z.array(z.string().max(60)).max(10).default([]),
  orcamento: z.object({ max: z.number().positive(), tipo: z.enum(["teto", "flexivel"]) }).optional(),
});
export type Necessidade = z.infer<typeof NecessidadeSchema>;

export const CriterioSchema = z.enum(["mais_barata", "mais_rapida", "melhor_avaliada", "favorita", "outra"]);
export type Criterio = z.infer<typeof CriterioSchema>;

// Saída do LLM em cada turno. Estado completo (não delta): o código valida e substitui.
export const TurnoInterpretadoSchema = z.object({
  intencao: z.enum(["pedido", "responder", "consentir", "ajustar", "aprovar", "fora_escopo", "incerto", "conversa"]),
  nivel: z.enum(["L0", "L1", "L2"]),
  ocasiao: OcasiaoSchema.default({}),
  necessidades: z.array(NecessidadeSchema).max(5).default([]),
  pergunta: z.string().max(240).optional(),
  confirmacao: z.string().max(240).optional(),
  ajuste: z.object({ categoria: z.string().max(60).optional(), criterio: CriterioSchema }).optional(),
  assumido: z.array(z.string().max(120)).max(5).default([]),
  resposta: z.string().max(400).optional(),
});
export type TurnoInterpretado = z.infer<typeof TurnoInterpretadoSchema>;

// Entrada do /api/converse. Sinais e hipóteses chegam quando a voz for conectada.
export const ConverseInputSchema = z.strictObject({
  texto: z.string().trim().min(1).max(2000),
  origem: z.enum(["voz", "texto"]).default("texto"),
  sinais: VoiceSignalsSchema.optional(),
  hipoteses: z.array(z.string().max(200)).max(5).optional(),
});
export type ConverseInput = z.infer<typeof ConverseInputSchema>;

export type Origem = "simulado" | "real";

export interface OpcaoPlano {
  ref: string;
  loja: string;
  item: string;
  precoCents: number;
  freteCents?: number;
  prazo?: string;
  nota?: number;
  rotulo: string;   // vem do ranking do domínio, nunca do LLM
  motivo: string;   // idem
  origem: Origem;
}

export interface BlocoPlano {
  necessidadeId: string;
  vertical: Vertical;
  categoria: string;
  quantidade: number;
  principal: OpcaoPlano;
  alternativas: OpcaoPlano[];
}

export interface PlanoSnapshot {
  planoId: string;
  versao: number;
  blocos: BlocoPlano[];
  naoAtendidas: { categoria: string; motivo: string }[];
  pendencias: string[];
  origem: Origem;
}

export type EventoFeedback =
  | { tipo: "opcoes_exibidas"; planoId: string; versao: number; blocos: number; origem: Origem }
  | { tipo: "reacao"; planoId: string; reacao: "ajustou" | "aceitou" | "rejeitou"; motivo: Criterio | "outro" }
  | { tipo: "necessidade_nao_atendida"; categoria: string; causa: string }
  | { tipo: "friccao"; perguntas: number; nivel: Nivel; turnos: number };

// Ferramentas do domínio que o agente pode chamar. Nenhuma compra, aprova ou paga.
export interface DomainPort {
  buscarNecessidade(n: Necessidade, ocasiao: Ocasiao): Promise<OpcaoPlano[]>;
  montarPlano(input: { subjectRef: string; ocasiao: Ocasiao; itens: { necessidade: Necessidade; opcoes: OpcaoPlano[] }[] }): Promise<PlanoSnapshot>;
  ajustarPlano(input: { subjectRef: string; planoId: string; versao: number; categoria?: string; criterio: Criterio }): Promise<PlanoSnapshot>;
  registrarEvento(subjectRef: string, evento: EventoFeedback): Promise<void>;
}

export type Nivel = "L0" | "L1" | "L2";
export type Estado = "S0" | "S1" | "S2" | "S3" | "S4" | "S5" | "S6" | "S7";

export interface Mensagem { role: "user" | "agent"; text: string }

export interface AgentSession {
  subjectRef: string;
  estado: Estado;
  nivel?: Nivel;
  perguntasFeitas: number;
  confirmacoesSeguidas: number;
  restricoes: string[];   // rígidas, valem para toda necessidade de comida/mercado; só somam
  turnos: number;
  ultimaFala?: string;
  encaminhado: boolean;
  history: Mensagem[];
  ocasiao: Ocasiao;
  necessidades: Necessidade[];
  plano?: PlanoSnapshot;
}

export interface InterpretarInput {
  texto: string;
  hipoteses?: string[];
  pressaDetectada: boolean;
  session: Pick<AgentSession, "estado" | "nivel" | "perguntasFeitas" | "ocasiao" | "necessidades" | "history"> & { opcoesFaladas: string[] };
}

export interface ResponderInput {
  plano: PlanoSnapshot;
  mudou?: string;      // categoria ajustada, para falar só a diferença
  assumido: string[];
}

export interface LlmPort {
  readonly nome: string;
  interpretar(input: InterpretarInput, signal?: AbortSignal): Promise<TurnoInterpretado>;
  responder(input: ResponderInput, signal?: AbortSignal): Promise<string>;
}

export interface AgentReply {
  estado: Estado;
  nivel: Nivel;
  resposta: string;
  fraseEspera?: string;
  tela?: { tipo: "mostrar_plano" | "plano_atualizado" | "aguardando_aprovacao"; plano: PlanoSnapshot };
  aprovacao?: { planoId: string; versao: number };
  origem: Origem;
  llm: string;
  tempos: { interpretarMs: number; dominioMs?: number; responderMs?: number; totalMs: number };
}
