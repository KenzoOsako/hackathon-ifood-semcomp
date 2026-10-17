// Normalização pura de valores decimais em BRL para Money e Cost (@/contracts).
// Escopo restrito a entradas internas; não define schemas externos do iFood nem certifica dados reais.
import { CostSchema, MoneySchema, type Candidate, type Cost, type Money } from "@/contracts";

export class CostNormalizationError extends Error {
  readonly code = "INVALID_DATA" as const;

  constructor(message = "INVALID_DATA") {
    super(message);
    this.name = "CostNormalizationError";
  }
}

export interface CostItemInput {
  price: number;
  promotionalPrice?: number;
  quantity?: number;
}

export interface CostNormalizationInput {
  items: number | Money | readonly CostItemInput[];
  delivery?: number | Money;
  fees?: number | Money;
  total?: number | Money;
  status?: Cost["status"];
}

export interface CandidateCostOptions {
  quantity?: number;
  fees?: number | Money;
  status?: Cost["status"];
}

function isMoney(value: unknown): value is Money {
  return typeof value === "object" && value !== null && "currency" in value && "cents" in value;
}

function toValidatedMoney(input: number | Money): Money {
  if (isMoney(input)) {
    const parsed = MoneySchema.safeParse(input);
    if (!parsed.success) {
      throw new CostNormalizationError("Objeto Money inválido.");
    }
    return parsed.data;
  }
  return brlToMoney(input);
}

/**
 * Converte um valor decimal em BRL (ex.: 32.9, 0, 19.99) para Money em centavos inteiros seguros.
 * Rejeita negativos, NaN/Infinity, mais de 2 casas decimais e overflow de inteiro seguro.
 */
export function brlToMoney(value: number): Money {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new CostNormalizationError("Valor monetário deve ser número finito e não negativo.");
  }

  const scaled = value * 100;
  const rounded = Math.round(scaled);
  const cents = rounded === 0 ? 0 : rounded;

  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new CostNormalizationError("Valor em centavos excede o limite de inteiro seguro.");
  }

  // Garante precisão de até 2 casas decimais em ponto flutuante IEEE-754 sem truncar frações extras.
  if (Math.abs(scaled - cents) > 1e-6 || cents / 100 !== value) {
    throw new CostNormalizationError("Valor monetário possui precisão decimal inválida.");
  }

  const parsed = MoneySchema.safeParse({ currency: "BRL", cents });
  if (!parsed.success) {
    throw new CostNormalizationError("Falha ao validar Money.");
  }
  return parsed.data;
}

/**
 * Converte um valor decimal opcional em BRL para Money, preservando undefined quando ausente.
 * Ausência nunca é convertida em zero.
 */
export function optionalBrlToMoney(value: number | undefined): Money | undefined {
  if (value === undefined) return undefined;
  return brlToMoney(value);
}

/**
 * Resolve o preço unitário efetivo de um item, aplicando promotionalPrice quando presente.
 * Rejeita preços inválidos ou promoção maior que o preço base.
 */
export function resolveItemUnitPrice(item: Pick<CostItemInput, "price" | "promotionalPrice">): Money {
  const regular = brlToMoney(item.price);
  if (item.promotionalPrice === undefined) {
    return regular;
  }
  const promo = brlToMoney(item.promotionalPrice);
  if (promo.cents > regular.cents) {
    throw new CostNormalizationError("Preço promocional não pode exceder o preço original.");
  }
  return promo;
}

/**
 * Soma uma lista não vazia de itens (com quantidade e promoção opcional) em Money seguro.
 */
export function normalizeItemsSubtotal(items: readonly CostItemInput[]): Money {
  if (!Array.isArray(items) || items.length === 0) {
    throw new CostNormalizationError("Lista de itens para cálculo de custo não pode ser vazia.");
  }

  let subtotalCents = 0;
  for (const item of items) {
    const quantity = item.quantity ?? 1;
    if (typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity <= 0) {
      throw new CostNormalizationError("Quantidade do item deve ser inteiro positivo seguro.");
    }
    const unit = resolveItemUnitPrice(item);
    const lineCents = unit.cents * quantity;
    if (!Number.isSafeInteger(lineCents)) {
      throw new CostNormalizationError("Subtotal do item excede inteiro seguro.");
    }
    const nextSubtotal = subtotalCents + lineCents;
    if (!Number.isSafeInteger(nextSubtotal)) {
      throw new CostNormalizationError("Subtotal acumulado excede inteiro seguro.");
    }
    subtotalCents = nextSubtotal;
  }

  return MoneySchema.parse({ currency: "BRL", cents: subtotalCents });
}

function resolveItemsMoney(items: CostNormalizationInput["items"]): Money {
  if (Array.isArray(items)) {
    return normalizeItemsSubtotal(items);
  }
  return toValidatedMoney(items as number | Money);
}

/**
 * Normaliza componentes internos de custo para o contrato Cost.
 * - Frete ou taxas ausentes permanecem undefined (desconhecidos).
 * - Frete grátis ou taxa zero precisam ser informados explicitamente (0).
 * - Total só existe quando items, delivery e fees são conhecidos e o status não é "unknown".
 * - Distingue status "confirmed", "estimated" e "unknown".
 */
export function normalizeCost(input: CostNormalizationInput): Cost {
  const items = resolveItemsMoney(input.items);
  const delivery = input.delivery === undefined ? undefined : toValidatedMoney(input.delivery);
  const fees = input.fees === undefined ? undefined : toValidatedMoney(input.fees);
  const explicitTotal = input.total === undefined ? undefined : toValidatedMoney(input.total);

  const hasAllComponents = delivery !== undefined && fees !== undefined;

  if (!hasAllComponents) {
    if (explicitTotal !== undefined) {
      throw new CostNormalizationError("Total não pode existir quando frete ou taxas são desconhecidos.");
    }
    return CostSchema.parse({
      items,
      ...(delivery !== undefined ? { delivery } : {}),
      ...(fees !== undefined ? { fees } : {}),
      status: "unknown",
    });
  }

  if (input.status === "unknown") {
    if (explicitTotal !== undefined) {
      throw new CostNormalizationError("Custo com status unknown não pode declarar total.");
    }
    return CostSchema.parse({
      items,
      delivery,
      fees,
      status: "unknown",
    });
  }

  const totalCents = items.cents + delivery.cents + fees.cents;
  if (!Number.isSafeInteger(totalCents)) {
    throw new CostNormalizationError("Total calculado excede o limite de inteiro seguro.");
  }

  if (explicitTotal !== undefined && explicitTotal.cents !== totalCents) {
    throw new CostNormalizationError("Total informado diverge da soma dos componentes.");
  }

  const status: Cost["status"] = input.status ?? "confirmed";
  const total = MoneySchema.parse({ currency: "BRL", cents: totalCents });

  return CostSchema.parse({
    items,
    delivery,
    fees,
    total,
    status,
  });
}

/**
 * Normaliza o custo a partir de um Candidate interno e encargos opcionais conhecidos.
 */
export function normalizeCandidateCost(
  candidate: Pick<Candidate, "price" | "promotionalPrice" | "deliveryFee">,
  options: CandidateCostOptions = {},
): Cost {
  return normalizeCost({
    items: [
      {
        price: candidate.price,
        promotionalPrice: candidate.promotionalPrice,
        quantity: options.quantity ?? 1,
      },
    ],
    delivery: candidate.deliveryFee,
    fees: options.fees,
    status: options.status,
  });
}
