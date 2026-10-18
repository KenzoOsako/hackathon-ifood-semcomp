// VARREDURA DO MCP: descobre, na conta conectada, o que o iFood realmente expõe (ferramentas ao vivo, campos, tipos, nulos,
// tamanhos, quais combinações funcionam) para guiar os testes e a abordagem pelo que EXISTE, não pelo que a documentação diz.
// Segurança por construção:
//   - só chama ferramentas de LEITURA de uma lista fechada (carrinho, endereço novo e checkout nunca são chamados);
//   - devolve o FORMATO das respostas; valores de dados da pessoa (perfil, endereços, pedidos) são ocultados, e coordenadas
//     e identificadores de pedido nunca saem daqui;
//   - de dados públicos do catálogo (loja, item, categoria) entram até 3 exemplos por campo, úteis para os testes.
import type { McpTools } from "./domain-mcp";

// Única lista de ferramentas que a varredura pode chamar. Tudo fora dela (Cart, createAddress, submitOrder…) é bloqueado.
export const LEITURA = new Set(["getUser", "listAddresses", "searchOffers", "browseOffers", "getRecommendations", "listItemTaxonomy", "getMerchant", "getItem", "trackOrder", "getOrder"]);
export const NAO_CHAMADAS: { ferramenta: string; motivo: string }[] = [
  ...["createCart", "getCart", "getCartDeliveryMethods", "addItemToCart", "updateCartItem", "removeItemFromCart", "removeVoucher", "listVouchers", "setVoucher", "setCartDelivery", "listPaymentMethods", "setCartPayment"].map((ferramenta) => ({ ferramenta, motivo: "Cart: carrinho é escrita (o agente só propõe; a compra termina no iFood)" })),
  { ferramenta: "submitOrder", motivo: "cria pedido: nunca" },
  { ferramenta: "createAddress", motivo: "persiste endereço: nunca" },
];

export type Forma =
  | { tipo: "nulo" }
  | { tipo: "texto"; comprimentoMax: number; exemplos?: string[] }
  | { tipo: "numero"; min: number; max: number }
  | { tipo: "booleano" }
  | { tipo: "oculto" }
  | { tipo: "lista"; tamanho: number; item?: Forma }
  | { tipo: "objeto"; campos: Record<string, Forma & { opcional?: boolean; anulavel?: boolean }> }
  | { tipo: "misto"; tipos: string[] };

// Campos cujo VALOR nunca sai, em respostas de dados da pessoa.
// Dados da pessoa (perfil, endereços, pedidos): lista ampla, inclui nome e alias.
const SENSIVEL_PESSOAL = /name|nome|email|phone|telefone|document|cpf|cnpj|address|endereco|street|rua|complement|reference|referencia|postal|zip|cep|latitude|longitude|coordinates|lat\b|lng\b|code|shortcode|orderid|lastorderid|alias|neighborhood|bairro|city|cidade|deeplink|url|token|card/i;
// Vale também no catálogo público (onde nome de loja e de item são dados públicos e úteis como exemplo).
const SENSIVEL_SEMPRE = /email|phone|telefone|document|cpf|cnpj|street|rua|complement|postal|zip|cep|latitude|longitude|coordinates|orderid|lastorderid|token|card/i;
const MAX_PROFUNDIDADE = 7;
const MAX_ITENS_MESCLADOS = 12;

interface OpcoesForma { ocultarValores: boolean; exemplos: boolean }

const tipoDe = (v: unknown): string => (v === null || v === undefined ? "nulo" : Array.isArray(v) ? "lista" : typeof v === "object" ? "objeto" : typeof v === "number" ? "numero" : typeof v === "boolean" ? "booleano" : "texto");

// Descreve a forma de um valor (e de uma lista inteira, mesclando os itens: campo ausente em algum = opcional).
export function formaDe(valor: unknown, opts: OpcoesForma, caminho = "", prof = 0): Forma {
  const t = tipoDe(valor);
  if (t === "nulo") return { tipo: "nulo" };
  if (prof > MAX_PROFUNDIDADE) return { tipo: "objeto", campos: {} };
  const chave = caminho.split(".").pop() ?? "";
  if ((opts.ocultarValores ? SENSIVEL_PESSOAL : SENSIVEL_SEMPRE).test(chave) && t !== "objeto" && t !== "lista") return { tipo: "oculto" };
  if (t === "texto") {
    const s = valor as string;
    return { tipo: "texto", comprimentoMax: s.length, ...(opts.exemplos ? { exemplos: [s.slice(0, 60)] } : {}) };
  }
  if (t === "numero") return { tipo: "numero", min: valor as number, max: valor as number };
  if (t === "booleano") return { tipo: "booleano" };
  if (t === "lista") {
    const itens = (valor as unknown[]).slice(0, MAX_ITENS_MESCLADOS);
    return { tipo: "lista", tamanho: (valor as unknown[]).length, ...(itens.length ? { item: mesclar(itens.map((i) => formaDe(i, opts, caminho, prof + 1))) } : {}) };
  }
  const campos: Record<string, Forma> = {};
  for (const [k, v] of Object.entries(valor as Record<string, unknown>)) campos[k] = formaDe(v, opts, caminho ? `${caminho}.${k}` : k, prof + 1);
  return { tipo: "objeto", campos };
}

// Junta várias formas do mesmo lugar (itens de uma lista): faixa dos números, comprimento máximo, até 3 exemplos distintos,
// campo que falta em algum item = opcional, campo nulo em algum = anulável.
export function mesclar(formas: Forma[]): Forma {
  const tipos = [...new Set(formas.map((f) => f.tipo))];
  const naoNulos = formas.filter((f) => f.tipo !== "nulo");
  if (naoNulos.length === 0) return { tipo: "nulo" };
  const base = [...new Set(naoNulos.map((f) => f.tipo))];
  if (base.length > 1) return { tipo: "misto", tipos };
  const alvo = base[0];
  if (alvo === "texto") {
    const ts = naoNulos as Extract<Forma, { tipo: "texto" }>[];
    const ex = [...new Set(ts.flatMap((t) => t.exemplos ?? []))].slice(0, 3);
    return { tipo: "texto", comprimentoMax: Math.max(...ts.map((t) => t.comprimentoMax)), ...(ex.length ? { exemplos: ex } : {}) };
  }
  if (alvo === "numero") { const ns = naoNulos as Extract<Forma, { tipo: "numero" }>[]; return { tipo: "numero", min: Math.min(...ns.map((n) => n.min)), max: Math.max(...ns.map((n) => n.max)) }; }
  if (alvo === "lista") { const ls = naoNulos as Extract<Forma, { tipo: "lista" }>[]; const itens = ls.flatMap((l) => (l.item ? [l.item] : [])); return { tipo: "lista", tamanho: Math.max(...ls.map((l) => l.tamanho)), ...(itens.length ? { item: mesclar(itens) } : {}) }; }
  if (alvo === "objeto") {
    const os = naoNulos as Extract<Forma, { tipo: "objeto" }>[];
    const chaves = [...new Set(os.flatMap((o) => Object.keys(o.campos)))];
    const campos: Record<string, Forma & { opcional?: boolean; anulavel?: boolean }> = {};
    for (const k of chaves) {
      const presentes = os.filter((o) => k in o.campos).map((o) => o.campos[k]);
      campos[k] = { ...mesclar(presentes), ...(presentes.length < os.length ? { opcional: true } : {}), ...(presentes.some((p) => p.tipo === "nulo") ? { anulavel: true } : {}) };
    }
    return { tipo: "objeto", campos };
  }
  return naoNulos[0];
}

export interface Sondagem { ferramenta: string; argumentos: Record<string, unknown>; ok: boolean; ms: number; forma?: Forma; erro?: string }
export interface Ferramenta { name: string; description: string; obrigatorios: string[]; parametros: Record<string, string> }
export interface Varredura { geradoEm: string; localizacao: string; ferramentas: Ferramenta[]; sondagens: Sondagem[]; naoChamadas: typeof NAO_CHAMADAS; divergenciasComADoc: string[] }

// As 24 ferramentas da documentação: o que o MCP ao vivo expõe a mais ou a menos aparece em `divergenciasComADoc`.
export const DOCUMENTADAS = ["getUser", "listAddresses", "createAddress", "searchOffers", "browseOffers", "getRecommendations", "listItemTaxonomy", "getMerchant", "getItem", ...NAO_CHAMADAS.filter((n) => n.motivo.startsWith("Cart")).map((n) => n.ferramenta), "submitOrder", "trackOrder", "getOrder"];

const ids = (r: unknown, ...campos: string[]): string | undefined => {
  const lista = (r as { results?: Record<string, unknown>[] } | undefined)?.results ?? [];
  for (const it of lista) { const v = campos.map((c) => c.split(".").reduce<unknown>((a, k) => (a as Record<string, unknown>)?.[k], it)); if (v.every((x) => typeof x === "string")) return v.join("|"); }
  return undefined;
};

export async function explorar(tools: McpTools, ferramentasVivas: Ferramenta[], agora: () => number = Date.now): Promise<Varredura> {
  const sondagens: Sondagem[] = [];
  const chamar = async (ferramenta: string, argumentos: Record<string, unknown>, opts: OpcoesForma): Promise<unknown> => {
    if (!LEITURA.has(ferramenta)) throw new Error(`BLOQUEADA:${ferramenta}`); // última trava: nada fora da lista de leitura
    const t0 = agora();
    try {
      const r = await tools.callTool(ferramenta, argumentos);
      sondagens.push({ ferramenta, argumentos: ocultarCoordenadas(argumentos), ok: true, ms: agora() - t0, forma: formaDe(r, opts) });
      return r;
    } catch (e) {
      sondagens.push({ ferramenta, argumentos: ocultarCoordenadas(argumentos), ok: false, ms: agora() - t0, erro: String((e as Error)?.message ?? e).slice(0, 160) });
      return undefined;
    }
  };
  const pessoal: OpcoesForma = { ocultarValores: true, exemplos: false };
  const catalogo: OpcoesForma = { ocultarValores: false, exemplos: true };

  // Pessoa: só formato. O primeiro endereço fornece as coordenadas para as buscas (e não sai daqui).
  const enderecos = (await chamar("listAddresses", {}, pessoal)) as { results?: Record<string, unknown>[] } | undefined;
  await chamar("getUser", {}, pessoal);
  let loc = { latitude: -22.0069, longitude: -47.8946 }; let fonte = "fixa (USP São Carlos)";
  for (const a of enderecos?.results ?? []) {
    const c = (a.coordinates ?? a.location ?? a) as { latitude?: unknown; longitude?: unknown };
    if (typeof c.latitude === "number" && typeof c.longitude === "number") { loc = { latitude: c.latitude, longitude: c.longitude }; fonte = "endereço da conta"; break; }
  }
  const base = { userLocation: loc };

  // Catálogo: busca por texto e navegação, por tipo de loja e por tipo de resultado.
  const consultas: [string, string][] = [["RESTAURANT", "pizza"], ["RESTAURANT", "hamburguer"], ["GROCERIES", "leite"], ["GROCERIES", "ovos"], ["SHOPPING", "presente"], ["PETSTORE", "ração"]];
  let ultimoItem: string | undefined; let ultimaLoja: string | undefined;
  for (const [merchantType, query] of consultas) {
    for (const resultKind of ["ITEM", "MERCHANT"]) {
      const r = await chamar("searchOffers", { query, ...base, resultKind, merchantType, pageSize: 10, refinements: { onlyOpen: true } }, catalogo);
      ultimoItem ??= resultKind === "ITEM" ? ids(r, "merchant.merchantId", "itemId") : undefined;
      ultimaLoja ??= ids(r, "merchantId") ?? ids(r, "merchant.merchantId");
    }
  }
  for (const merchantType of ["RESTAURANT", "GROCERIES", "SHOPPING", "PETSTORE", "DRUGSTORE", "LIQUORSTORE"]) {
    await chamar("browseOffers", { ...base, merchantType, resultKind: "MERCHANT", pageSize: 10 }, catalogo);
    await chamar("listItemTaxonomy", { merchantType, pageSize: 20 }, catalogo);
  }

  // Hábitos e recomendações (a base do "o de sempre"): cada modo, para loja e para item quando a tabela permite.
  const modos: [string, string[]][] = [["RECOMMENDED", ["MERCHANT", "ITEM"]], ["RECENT_ORDERS", ["MERCHANT", "ITEM"]], ["FAVORITE_MERCHANTS", ["MERCHANT"]], ["BEST_DEALS", ["MERCHANT", "ITEM"]], ["FEATURED_LOCAL", ["MERCHANT"]]];
  let ultimoPedido: string | undefined;
  for (const [contentMode, kinds] of modos) {
    for (const resultKind of kinds) {
      for (const merchantType of ["RESTAURANT", "GROCERIES"]) {
        // Dados da pessoa (o que ela pediu): forma sem valores. O restante é catálogo público.
        const r = await chamar("getRecommendations", { contentMode, ...base, resultKind, merchantType, pageSize: 10 }, contentMode === "RECENT_ORDERS" || contentMode === "FAVORITE_MERCHANTS" ? pessoal : catalogo);
        if (contentMode === "RECENT_ORDERS") ultimoPedido ??= ids(r, "lastOrderId");
      }
    }
  }

  // Detalhe de uma loja e de um item achados acima (se houver) e do último pedido (só formato, valores ocultos).
  if (ultimaLoja) await chamar("getMerchant", { merchantId: ultimaLoja.split("|")[0], ...base }, catalogo);
  if (ultimoItem) { const [merchantId, itemId] = ultimoItem.split("|"); await chamar("getItem", { merchantId, itemId, ...base }, catalogo); }
  if (ultimoPedido) { await chamar("getOrder", { orderId: ultimoPedido }, pessoal); await chamar("trackOrder", { orderId: ultimoPedido }, pessoal); }

  const vivas = new Set(ferramentasVivas.map((f) => f.name));
  const divergencias = [
    ...DOCUMENTADAS.filter((d) => vivas.size > 0 && !vivas.has(d)).map((d) => `documentada mas AUSENTE no MCP ao vivo: ${d}`),
    ...[...vivas].filter((v) => !DOCUMENTADAS.includes(v)).map((v) => `no MCP ao vivo mas NÃO documentada: ${v}`),
  ];
  return { geradoEm: new Date().toISOString(), localizacao: fonte, ferramentas: ferramentasVivas, sondagens, naoChamadas: NAO_CHAMADAS, divergenciasComADoc: divergencias };
}

function ocultarCoordenadas(a: Record<string, unknown>): Record<string, unknown> {
  const out = { ...a };
  if (out.userLocation) out.userLocation = "<oculto>";
  for (const k of ["orderId", "merchantId", "itemId"]) if (typeof out[k] === "string") out[k] = "<id>";
  return out;
}
