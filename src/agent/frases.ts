// Contrato com a voz (docs/PLANO_INTEGRACAO_VOZ_AGENTE.md, Fase 0). A voz pré-gera o áudio destas frases;
// mudar um texto aqui invalida o cache dela, então avise o Felipe.

// Frases fixas do agente: saem sempre iguais, sem passar pelo LLM.
export const FRASES = {
  espera: "Deixa eu ver as opções.",
  encaminhar: "Pronto, o plano está na sua tela. É só revisar e aprovar; a compra termina no iFood.",
  jaEncaminhado: "O plano continua na sua tela para você revisar e aprovar. Quer ajustar algo?",
  aprovacaoEnviada: "Enviei sua aprovação desta versão do plano para validação. Confira na tela; a compra termina no iFood.",
  semPlano: "Ainda não montei um plano. Me diz o que você quer resolver: refeição, mercado ou presente?",
  semNecessidade: "Me diz o que você quer: refeição, mercado ou presente?",
  oQueFaco: "Eu ajudo com refeição, mercado e presentes, e monto um plano para você aprovar. O que você quer resolver?",
  foraEscopo: "Isso eu não consigo ajudar. Posso ajudar com refeição, mercado ou presente?",
  naoEntendi: "Não consegui entender agora. Pode repetir de outro jeito?",
  erroFerramenta: "Não consegui buscar as opções agora. Quer tentar de novo?",
  repetir: "Pode repetir só o nome?",
  semDadoCriterio: "Não tenho essa informação para comparar essas opções ainda. Quer ajustar de outro jeito?",
  semMudanca: "Essa já é a melhor opção para esse critério. Quer ajustar outra coisa?",
} as const;

export type FraseFixa = keyof typeof FRASES;
export const FRASES_FIXAS: readonly string[] = Object.values(FRASES);

// Faixas da confiança do STT (sinais.confianca, 0 a 1).
// Abaixo de `repetir`: a voz pede para repetir e nem chama o backend.
// Entre `repetir` e `confirmar`: o agente confirma o que entendeu antes de buscar.
// A partir de `confirmar`: segue normal. Valores provisórios até a calibração com gravações reais.
export const LIMIARES_CONFIANCA = { repetir: 0.6, confirmar: 0.85 } as const;
