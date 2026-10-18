// Contratos internos do agente (frente Hyago). O plano de ocasião aqui é provisório
// até o contrato oficial do domínio (K-3, Kenzo); manter as assinaturas de
// docs/AGENTE_CONVERSA_E_FLUXO.md §4.2 para a troca ser só de implementação.
import { z } from "zod";
import { VoiceSignalsSchema } from "@/voice/signals";
import { MAX_NECESSIDADES } from "./limites";

export const VerticalSchema = z.enum(["RESTAURANT", "GROCERIES", "SHOPPING"]);
export type Vertical = z.infer<typeof VerticalSchema>;

// As descrições vão para o modelo junto com o schema: campos curtos são poucas palavras, não frases.
export const OcasiaoSchema = z.object({
  tipo: z.string().max(60).describe("Uma a três palavras. Ex.: aniversário, churrasco, jantar, doença").optional(),
  pessoas: z.number().int().min(1).max(50).optional(),
  quando: z.string().max(60).describe("Uma ou duas palavras. Ex.: hoje, sábado, agora").optional(),
  local: z.string().max(60).describe("Uma ou duas palavras. Ex.: casa, trabalho").optional(),
});
export type Ocasiao = z.infer<typeof OcasiaoSchema>;

export const NecessidadeSchema = z.object({
  id: z.string().min(1).max(40),
  vertical: VerticalSchema,
  categoria: z.string().min(1).max(60).describe("Uma a três palavras concretas, buscáveis no iFood. Ex.: pizza calabresa, canja, carvão"),
  restricoes: z.array(z.string().max(60)).max(10).default([]),
  // min(1) e não positive(): o Gemini rejeita exclusiveMinimum no response_schema.
  orcamento: z.object({ max: z.number().min(1), tipo: z.enum(["teto", "flexivel"]) }).optional(),
  // "inferido": sugestão do Guide a partir da ocasião; "dito" (ou ausente): o usuário pediu.
  fonte: z.enum(["dito", "inferido"]).optional(),
  // Termos de busca do planejador: o catálogo busca ITEM por termo, então cada consulta é um produto ou prato.
  consultas: z.array(z.string().max(80)).max(6).optional().describe("1 a 3 termos de busca concretos para ESTE item (um produto ou prato por termo, sinônimos reais). Ex.: leite → leite integral; churrasco → picanha, costela"),
});
export type Necessidade = z.infer<typeof NecessidadeSchema>;

export const CriterioSchema = z.enum(["mais_barata", "mais_rapida", "melhor_avaliada", "favorita", "outra"]);
export type Criterio = z.infer<typeof CriterioSchema>;

// Saída do LLM em cada turno. Estado completo (não delta): o código valida e substitui.
export const TurnoInterpretadoSchema = z.object({
  intencao: z.enum(["pedido", "responder", "consentir", "ajustar", "aprovar", "fora_escopo", "incerto", "conversa"]),
  nivel: z.enum(["L0", "L1", "L2"]),
  ocasiao: OcasiaoSchema.default({}),
  necessidades: z.array(NecessidadeSchema).max(MAX_NECESSIDADES).default([]),
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
  // Começa uma conversa nova (zera o estado do agente; o login iFood continua).
  reiniciar: z.boolean().optional(),
});
export type ConverseInput = z.infer<typeof ConverseInputSchema>;

export type Origem = "simulado" | "real";

// "exata": é o que foi pedido; "proxima": o catálogo não tem o pedido, esta é a mais parecida (o Guide diz isso).
export type Cobertura = "exata" | "proxima";

export interface OpcaoPlano {
  ref: string;
  loja: string;
  // Identificador estável do estabelecimento (merchantId no MCP). Duas lojas com o mesmo nome são lojas diferentes;
  // sacola e revisão agrupam por ele. Ausente: agrupa pelo nome.
  lojaId?: string;
  item: string;
  precoCents: number;
  freteCents?: number;
  prazo?: string;
  nota?: number;
  rotulo: string;   // vem do ranking do domínio, nunca do LLM
  motivo: string;   // idem
  origem: Origem;
  cobertura?: Cobertura;
  // Cartão de sugestão da interface: só campos reais (nada escrito pelo modelo). Ausente = o dado não veio.
  descricao?: string;          // uma linha: nota, distância, prazo, frete, pedido mínimo, promoção
  imagemUrl?: string;          // foto do item (só https://static.ifood-static.com.br/...)
  logoUrl?: string;            // logo da loja (idem)
  distanciaKm?: number;
  avaliacoes?: number;         // quantidade de avaliações por trás da nota
  pedidoMinimoCents?: number;
  precoOriginalCents?: number; // preço antes da promoção (quando há)
}

export interface BlocoPlano {
  necessidadeId: string;
  vertical: Vertical;
  categoria: string;
  quantidade: number;
  principal: OpcaoPlano;
  alternativas: OpcaoPlano[];
  sugestao?: boolean; // necessidade inferida pelo Guide, não pedida pelo usuário
  cobertura?: Cobertura;
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

// Relevância: o que a busca devolveu serve para o que foi pedido? (src/agent/relevancia.ts)
export type Veredito = "serve" | "proximo" | "nao_serve";
export interface CandidatoJulgado { ref: string; item: string; loja?: string }
export interface RelevancePort {
  julgar(n: Necessidade, candidatos: CandidatoJulgado[]): Promise<Map<string, Veredito>>;
}
export interface ContextoBusca { relevancia?: RelevancePort }

// Ferramentas do domínio que o agente pode chamar. Nenhuma compra, aprova ou paga.
export interface DomainPort {
  buscarNecessidade(n: Necessidade, ocasiao: Ocasiao, ctx?: ContextoBusca): Promise<OpcaoPlano[]>;
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
  recusadas: string[];    // categorias sugeridas que o usuário recusou; não voltam na sessão
  nomeUsado?: boolean;
  ultimaIntencao?: string; // para a telemetria
  guardas?: string[];      // guardas que dispararam NESTE turno (telemetria); limpo ao fechar o turno    // o Guide já chamou a pessoa pelo nome no encaminhamento (uma vez por sessão)
  // Turno entendido com confiança média do STT: espera "sim" antes de buscar, ajustar ou aprovar.
  confirmacaoPendente?: { turno: TurnoInterpretado; texto: string; pressa: boolean };
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
  // Juiz de relevância (opcional: sem ele vale só a camada léxica). Devolve ref → veredito.
  julgar?(input: { necessidade: Necessidade; candidatos: CandidatoJulgado[] }, signal?: AbortSignal): Promise<Record<string, Veredito>>;
}

// Sacola simulada do plano aprovado: valores calculados no servidor; nunca é um carrinho remoto nem um pedido.
export interface SacolaLoja {
  lojaId: string;
  loja: string;
  itens: { ref: string; item: string; categoria: string; quantidade: number; precoCents: number; subtotalCents: number }[];
  subtotalCents: number;
  freteCents?: number;
  totalCents: number; // subtotal + frete conhecido
  origem: Origem;
}
export interface Sacola {
  planoId: string;
  versao: number;
  lojas: SacolaLoja[];
  totalCents: number;
  freteDesconhecido: boolean; // alguma loja sem frete informado: o total é parcial
  simulacao: true;
}

export type TipoTela = "mostrar_plano" | "plano_atualizado" | "aguardando_aprovacao" | "sacola";

export interface AgentReply {
  estado: Estado;
  nivel: Nivel;
  resposta: string;
  fraseEspera?: string;
  // A sacola viaja dentro do payload do plano para chegar à tela pelo mesmo evento `screen` da voz.
  tela?: { tipo: TipoTela; plano: PlanoSnapshot & { sacola?: Sacola } };
  aprovacao?: { planoId: string; versao: number };
  origem: Origem;
  llm: string;
  tempos: { interpretarMs: number; dominioMs?: number; responderMs?: number; totalMs: number };
}
