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
  confirmacaoNegada: "Tudo bem. Me diz de novo o que você quer.",
} as const;

export type FraseFixa = keyof typeof FRASES;
export const FRASES_FIXAS: readonly string[] = Object.values(FRASES);

// Faixas da confiança do STT (sinais.confianca, 0 a 1).
// Abaixo de `repetir`: a voz pede para repetir e nem chama o backend.
// Entre `repetir` e `confirmar`: o agente confirma o que entendeu antes de buscar.
// A partir de `confirmar`: segue normal. Valores provisórios até a calibração com gravações reais.
export const LIMIARES_CONFIANCA = { repetir: 0.6, confirmar: 0.85 } as const;

// Quando a mesma frase fixa se repetiria (duas vezes seguidas), o Guide diz de outro jeito: nunca o mesmo texto, e sempre
// com um caminho concreto. Cada lista é consumida em ordem pela repetição.
export const ALTERNATIVAS: Record<string, readonly string[]> = {
  [FRASES.oQueFaco]: ["Posso buscar comida pronta, itens de mercado ou um presente. Me diz o que você precisa e eu monto o plano.", "Se quiser, comece pelo que está faltando: um prato, ingredientes ou um presente."],
  [FRASES.semNecessidade]: ["Ainda não sei o que buscar. Pode dizer um prato, um item de mercado ou um presente?", "Me diga o nome de um item, como pizza, leite ou um presente, que eu procuro."],
  [FRASES.naoEntendi]: ["Não peguei direito. Pode falar de outro jeito, só o item que você quer?", "Ainda não entendi. Diga só o nome do que você quer, por exemplo pizza ou leite."],
  [FRASES.foraEscopo]: ["Isso está fora do que eu faço. Posso ajudar com comida, mercado ou presente.", "Não consigo ajudar com isso, mas posso buscar uma refeição, itens de mercado ou um presente."],
  [FRASES.jaEncaminhado]: ["O plano está na sua tela. Se quiser mudar alguma coisa, me diga o quê; senão, é só aprovar.", "Está tudo na sua tela para você revisar e aprovar. Quer trocar algum item?"],
  [FRASES.erroFerramenta]: ["Ainda não consegui buscar. Quer tentar de novo ou pedir outra coisa?", "A busca não respondeu. Posso tentar mais uma vez se você quiser."],
  [FRASES.semMudanca]: ["Não há outra opção melhor para esse critério. Quer mudar outro item?", "Esse já é o melhor que encontrei por aí. Quer ajustar outra coisa?"],
};

// Último recurso: sempre diferente das anteriores, sempre com um caminho.
export const GENERICAS: readonly string[] = [
  "Posso tentar de outro jeito. O que você quer buscar: comida, mercado ou presente?",
  "Vamos por outro caminho: me diga só o nome do item que você quer.",
  "Estou aqui para ajudar com comida, mercado e presentes. Por onde quer começar?",
];
