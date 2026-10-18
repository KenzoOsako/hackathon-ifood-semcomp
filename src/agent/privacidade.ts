// A fala do Guide vai para o TTS de terceiros (ElevenLabs): não pode carregar dado pessoal.
// Checagem em código, não só no prompt. Preço ("R$ 39,90"), tempo ("25 min") e distância ("1,2 km") passam.
const DADO_PESSOAL = [
  /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/,                         // CPF
  /\b\d{5}-\d{3}\b/,                                            // CEP
  /(?:\(?\b\d{2}\)?\s?)?\b9?\d{4}[-\s]\d{4}\b/,                 // telefone com separador
  /\b\d{10,11}\b/,                                              // telefone corrido com DDD
  /[\w.+-]+@[\w-]+\.[\w.]+/,                                    // e-mail
  /\b(?:rua|r\.|avenida|av\.?|alameda|al\.|travessa|estrada|rodovia|pra[cç]a)\s+[^\d,.;!?]{2,40},?\s*(?:n[ºo°.]?\s*)?\d{1,5}\b/i, // endereço com número
];

export function temDadoPessoal(fala: string): boolean {
  return DADO_PESSOAL.some((re) => re.test(fala));
}
