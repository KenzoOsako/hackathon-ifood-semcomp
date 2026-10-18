// Cenários de conversa: casos C1–C12 de docs/AGENTE_CONVERSA_E_FLUXO.md §6 que fazem sentido
// sem voz, mais os tipos de src/evals/README.md. Rodam contra qualquer LlmPort.
import type { AgentReply } from "@/agent/types";

export interface Checagem {
  estado?: AgentReply["estado"];
  nivel?: AgentReply["nivel"];
  maxPerguntas?: number;          // perguntas acumuladas na sessão até este turno
  temPlano?: boolean;
  minBlocos?: number;
  temSugestao?: boolean;          // algum bloco do plano na tela é sugestão do Guide
  aprovacao?: boolean;
  contem?: RegExp;
  naoContem?: RegExp;
}

export interface Cenario { id: string; descricao: string; turnos: { usuario: string; esperado: Checagem }[] }

const PROIBIDO = /pedido (foi )?(feito|realizado|enviado)|\[|\]|no local ou (para )?entrega|muito pedido/i;
const SUGESTAO = /sugest|sugir|sugiro/i;

export const CENARIOS: Cenario[] = [
  { id: "C1", descricao: "Pedido específico com pressa: zero perguntas, proposta no 1º turno", turnos: [
    { usuario: "Pizza calabresa grande, pede logo.", esperado: { nivel: "L0", maxPerguntas: 0, temPlano: true, naoContem: PROIBIDO } },
  ] },
  { id: "C2", descricao: "Consentimento depois da proposta avança sem repetir", turnos: [
    { usuario: "Pizza calabresa grande, pede logo.", esperado: { temPlano: true } },
    { usuario: "tanto faz, só faz isso logo", esperado: { estado: "S5", contem: /tela/, naoContem: PROIBIDO } },
  ] },
  { id: "C4", descricao: "Nunca pergunta local ou entrega", turnos: [
    { usuario: "Quero um hambúrguer", esperado: { naoContem: PROIBIDO } },
  ] },
  { id: "C6", descricao: "Ocasião: até 3 perguntas e plano com várias necessidades", turnos: [
    { usuario: "Hoje é aniversário de um amigo, vamos comer pizza em casa e ver um filme.", esperado: { maxPerguntas: 1, naoContem: PROIBIDO } },
    { usuario: "Umas seis.", esperado: { maxPerguntas: 3 } },
    { usuario: "Pode escolher.", esperado: { temPlano: true, minBlocos: 2, temSugestao: true, maxPerguntas: 3, naoContem: PROIBIDO } },
  ] },
  { id: "SG1", descricao: "Sugestão da ocasião entra rotulada e sai quando recusada", turnos: [
    { usuario: "Pizza calabresa pra ver um filme, pede logo.", esperado: { temPlano: true, minBlocos: 2, temSugestao: true, contem: SUGESTAO, naoContem: PROIBIDO } },
    { usuario: "Sem pipoca.", esperado: { temPlano: true, naoContem: /pipoca/i } },
  ] },
  { id: "C8", descricao: "Fora de escopo: bebida alcoólica", turnos: [
    { usuario: "Me indica uma cerveja pra festa.", esperado: { temPlano: false, contem: /refeição|mercado|presente/i } },
  ] },
  { id: "C11", descricao: "Fala estranha depois da proposta vira confirmação, não recomeço", turnos: [
    { usuario: "Pizza calabresa grande, pede logo.", esperado: { temPlano: true } },
    { usuario: "Escola Cucurbita", esperado: { contem: /\?$/, naoContem: /Montei assim/ } },
  ] },
  { id: "AJ1", descricao: "Ajuste gera nova versão", turnos: [
    { usuario: "Pizza calabresa grande, pede logo.", esperado: { temPlano: true } },
    { usuario: "Quero a pizza mais bem avaliada", esperado: { temPlano: true, naoContem: PROIBIDO } },
  ] },
  { id: "AP1", descricao: "Aprovação explícita só sinaliza versão", turnos: [
    { usuario: "Pizza calabresa grande, pede logo.", esperado: { temPlano: true } },
    { usuario: "Aprovo o plano", esperado: { aprovacao: true, naoContem: PROIBIDO } },
  ] },
  { id: "AP2", descricao: "'Sim' isolado não aprova", turnos: [
    { usuario: "Pizza calabresa grande, pede logo.", esperado: { temPlano: true } },
    { usuario: "sim", esperado: { aprovacao: false } },
  ] },
  { id: "R1", descricao: "Restrição rígida: alergia não é relaxada", turnos: [
    { usuario: "Pizza calabresa grande, pede logo, tenho intolerância a lactose", esperado: { naoContem: /Montei assim: pizza/ } },
  ] },
  { id: "Q1", descricao: "O que você faz", turnos: [
    { usuario: "O que você faz?", esperado: { contem: /plano/i, temPlano: false } },
  ] },
];
