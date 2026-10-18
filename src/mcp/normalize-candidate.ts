// Normalização pura de candidatos de busca para representação interna verificável do FoodPilot.
// Este formato é interno à aplicação: não representa schema oficial do iFood e não realiza chamadas de rede.
import { z } from "zod";
import {
  CandidateSchema,
  CostSchema,
  HistoryEntrySchema,
  MoneySchema,
  OriginSchema,
  type Candidate,
  type Cost,
  type HistoryEntry,
  type Money,
  type Origin,
} from "@/contracts";
import {
  brlToMoney,
  CostNormalizationError,
  normalizeCost,
  optionalBrlToMoney,
  resolveItemUnitPrice,
} from "./costs";

export class CandidateNormalizationError extends Error {
  readonly code = "INVALID_DATA" as const;

  constructor(message = "INVALID_DATA") {
    super(message);
    this.name = "CandidateNormalizationError";
  }
}

const NonEmptyTrimmedString = z.string().trim().min(1);

const CompositionEntryArraySchema = z
  .array(NonEmptyTrimmedString)
  .transform((items) => {
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const item of items) {
      const key = item.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(item);
      }
    }
    return deduped;
  });

export const CandidateCompositionSchema = z.strictObject({
  ingredients: CompositionEntryArraySchema.optional(),
  allergens: CompositionEntryArraySchema.optional(),
});
export type CandidateComposition = z.infer<typeof CandidateCompositionSchema>;

const StrictHistoryEntrySchema = z.strictObject({
  merchantId: NonEmptyTrimmedString,
  timesOrdered: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  lastOrderedAt: z.iso.datetime({ offset: true }).optional(),
  lastOrderId: NonEmptyTrimmedString.optional(),
});

export const RawCandidateInputSchema = z.strictObject({
  itemId: NonEmptyTrimmedString,
  itemName: NonEmptyTrimmedString,
  merchantId: NonEmptyTrimmedString,
  merchantName: NonEmptyTrimmedString,
  price: z.number(),
  promotionalPrice: z.number().optional(),
  deliveryFee: z.number().optional(),
  fees: z.number().optional(),
  total: z.number().optional(),
  costStatus: z.enum(["confirmed", "estimated", "unknown"]).optional(),
  quantity: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  rating: z.number().finite().min(0).max(5).optional(),
  deliveryTimeMinutes: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  distanceKm: z.number().finite().min(0).optional(),
  curated: z.boolean().optional(),
  available: z.boolean().optional(),
  category: NonEmptyTrimmedString.optional(),
  composition: CandidateCompositionSchema.optional(),
  origin: OriginSchema.optional(),
  origins: z.array(OriginSchema).min(1).optional(),
  history: StrictHistoryEntrySchema.optional(),
});
export type RawCandidateInput = z.infer<typeof RawCandidateInputSchema>;

export interface NormalizeCandidateOptions {
  origin?: Origin;
  origins?: readonly Origin[];
  defaultCostStatus?: Cost["status"];
  fees?: number;
  quantity?: number;
  history?: HistoryEntry;
}

export const NormalizedCandidateSchema = z.strictObject({
  itemId: NonEmptyTrimmedString,
  itemName: NonEmptyTrimmedString,
  merchantId: NonEmptyTrimmedString,
  merchantName: NonEmptyTrimmedString,
  price: z.number(),
  promotionalPrice: z.number().optional(),
  deliveryFee: z.number().optional(),
  rating: z.number().finite().min(0).max(5).optional(),
  deliveryTimeMinutes: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  distanceKm: z.number().finite().min(0).optional(),
  curated: z.boolean().optional(),
  available: z.boolean().optional(),
  category: NonEmptyTrimmedString.optional(),
  regularUnitPrice: MoneySchema,
  unitPrice: MoneySchema,
  cost: CostSchema,
  origins: z.array(OriginSchema).min(1),
  composition: CandidateCompositionSchema.optional(),
  history: StrictHistoryEntrySchema.optional(),
  uncertainties: z.array(NonEmptyTrimmedString),
});
export type NormalizedCandidate = z.infer<typeof NormalizedCandidateSchema>;

function resolveOrigins(
  raw: RawCandidateInput,
  options?: NormalizeCandidateOptions,
): Origin[] {
  const candidateOrigins = raw.origins ?? (raw.origin ? [raw.origin] : undefined);
  const optionOrigins = options?.origins
    ? [...options.origins]
    : options?.origin
      ? [options.origin]
      : undefined;

  const chosen = candidateOrigins ?? optionOrigins;
  if (!chosen || chosen.length === 0) {
    throw new CandidateNormalizationError(
      "Origem do candidato é obrigatória (mode real ou mock).",
    );
  }

  const parsed = z.array(OriginSchema).min(1).safeParse(chosen);
  if (!parsed.success) {
    throw new CandidateNormalizationError("Origem do candidato inválida.");
  }
  return parsed.data;
}

function normalizeOptionalComposition(
  composition: CandidateComposition | undefined,
): CandidateComposition | undefined {
  if (composition === undefined) {
    return undefined;
  }
  const ingredients =
    composition.ingredients && composition.ingredients.length > 0
      ? composition.ingredients
      : undefined;
  const allergens =
    composition.allergens && composition.allergens.length > 0
      ? composition.allergens
      : undefined;

  if (ingredients === undefined && allergens === undefined) {
    return undefined;
  }

  return {
    ...(ingredients !== undefined ? { ingredients } : {}),
    ...(allergens !== undefined ? { allergens } : {}),
  };
}

function resolveHistory(
  merchantId: string,
  rawHistory: HistoryEntry | undefined,
  optionHistory: HistoryEntry | undefined,
): HistoryEntry | undefined {
  const chosen = rawHistory ?? optionHistory;
  if (chosen === undefined) {
    return undefined;
  }
  const parsed = StrictHistoryEntrySchema.safeParse(chosen);
  if (!parsed.success) {
    throw new CandidateNormalizationError("Histórico do candidato inválido.");
  }
  if (parsed.data.merchantId !== merchantId) {
    throw new CandidateNormalizationError(
      "Histórico informado não pertence ao estabelecimento do candidato.",
    );
  }
  return HistoryEntrySchema.parse(parsed.data);
}

function buildUncertainties(
  cost: Cost,
  composition: CandidateComposition | undefined,
): string[] {
  const uncertainties: string[] = [];
  if (cost.delivery === undefined) {
    uncertainties.push("Frete desconhecido");
  }
  if (cost.fees === undefined) {
    uncertainties.push("Taxas desconhecidas");
  }
  if (cost.status === "unknown") {
    uncertainties.push("Total não confirmado");
  } else if (cost.status === "estimated") {
    uncertainties.push("Custos estimados sujeitos a confirmação no iFood");
  }
  if (composition?.ingredients === undefined) {
    uncertainties.push("Composição completa não informada");
  }
  return uncertainties;
}

/**
 * Normaliza uma entrada de candidato validando formato, preços decimais BRL, custos,
 * origem (real/mock), metadados opcionais e composição disponível.
 * Não inventa disponibilidade, avaliação, composição, histórico nem taxas ausentes.
 */
export function normalizeCandidate(
  input: unknown,
  options?: NormalizeCandidateOptions,
): NormalizedCandidate {
  const parsedInput = RawCandidateInputSchema.safeParse(input);
  if (!parsedInput.success) {
    throw new CandidateNormalizationError("Dados de entrada do candidato inválidos.");
  }
  const raw = parsedInput.data;

  const origins = resolveOrigins(raw, options);
  const composition = normalizeOptionalComposition(raw.composition);
  const history = resolveHistory(raw.merchantId, raw.history, options?.history);

  const quantity = raw.quantity ?? options?.quantity ?? 1;
  if (typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new CandidateNormalizationError("Quantidade deve ser inteiro positivo seguro.");
  }

  let regularUnitPrice: Money;
  let unitPrice: Money;
  let cost: Cost;

  try {
    regularUnitPrice = brlToMoney(raw.price);
    unitPrice = resolveItemUnitPrice({
      price: raw.price,
      promotionalPrice: raw.promotionalPrice,
    });
    // Valida deliveryFee e fees opcionais com a mesma régua de centavos seguros.
    optionalBrlToMoney(raw.deliveryFee);
    const effectiveFees = raw.fees ?? options?.fees;
    optionalBrlToMoney(effectiveFees);

    cost = normalizeCost({
      items: [
        {
          price: raw.price,
          promotionalPrice: raw.promotionalPrice,
          quantity,
        },
      ],
      delivery: raw.deliveryFee,
      fees: effectiveFees,
      total: raw.total,
      status: raw.costStatus ?? options?.defaultCostStatus,
    });
  } catch (error) {
    if (error instanceof CostNormalizationError) {
      throw new CandidateNormalizationError(error.message);
    }
    throw error;
  }

  const uncertainties = buildUncertainties(cost, composition);

  const normalized: NormalizedCandidate = {
    itemId: raw.itemId,
    itemName: raw.itemName,
    merchantId: raw.merchantId,
    merchantName: raw.merchantName,
    price: raw.price,
    ...(raw.promotionalPrice !== undefined ? { promotionalPrice: raw.promotionalPrice } : {}),
    ...(raw.deliveryFee !== undefined ? { deliveryFee: raw.deliveryFee } : {}),
    ...(raw.rating !== undefined ? { rating: raw.rating } : {}),
    ...(raw.deliveryTimeMinutes !== undefined
      ? { deliveryTimeMinutes: raw.deliveryTimeMinutes }
      : {}),
    ...(raw.distanceKm !== undefined ? { distanceKm: raw.distanceKm } : {}),
    ...(raw.curated !== undefined ? { curated: raw.curated } : {}),
    ...(raw.available !== undefined ? { available: raw.available } : {}),
    ...(raw.category !== undefined ? { category: raw.category } : {}),
    regularUnitPrice,
    unitPrice,
    cost,
    origins,
    ...(composition !== undefined ? { composition } : {}),
    ...(history !== undefined ? { history } : {}),
    uncertainties,
  };

  return NormalizedCandidateSchema.parse(normalized);
}

export interface NormalizeCandidatesBatchOptions extends Omit<NormalizeCandidateOptions, "history"> {
  history?: readonly HistoryEntry[];
}

/**
 * Normaliza uma coleção de candidatos preservando a ordem de entrada e associando
 * apenas entradas de histórico cujo merchantId coincida exatamente.
 */
export function normalizeCandidates(
  inputs: readonly unknown[],
  options?: NormalizeCandidatesBatchOptions,
): NormalizedCandidate[] {
  if (!Array.isArray(inputs)) {
    throw new CandidateNormalizationError("Lista de candidatos deve ser um array.");
  }

  const historyByMerchant = new Map<string, HistoryEntry>();
  if (options?.history) {
    for (const entry of options.history) {
      const parsed = StrictHistoryEntrySchema.safeParse(entry);
      if (!parsed.success) {
        throw new CandidateNormalizationError("Entrada de histórico inválida no lote.");
      }
      historyByMerchant.set(parsed.data.merchantId, parsed.data);
    }
  }

  return inputs.map((item) => {
    const merchantId =
      typeof item === "object" && item !== null && "merchantId" in item && typeof item.merchantId === "string"
        ? item.merchantId.trim()
        : undefined;
    const matchedHistory = merchantId ? historyByMerchant.get(merchantId) : undefined;

    return normalizeCandidate(item, {
      origin: options?.origin,
      origins: options?.origins,
      defaultCostStatus: options?.defaultCostStatus,
      fees: options?.fees,
      quantity: options?.quantity,
      history: matchedHistory,
    });
  });
}

/**
 * Projeta um candidato normalizado para o contrato legado Candidate (@/contracts),
 * preservando ausências opcionais.
 */
export function toLegacyCandidate(candidate: NormalizedCandidate): Candidate {
  return CandidateSchema.parse({
    merchantId: candidate.merchantId,
    merchantName: candidate.merchantName,
    ...(candidate.rating !== undefined ? { rating: candidate.rating } : {}),
    ...(candidate.distanceKm !== undefined ? { distanceKm: candidate.distanceKm } : {}),
    ...(candidate.deliveryTimeMinutes !== undefined
      ? { deliveryTimeMinutes: candidate.deliveryTimeMinutes }
      : {}),
    ...(candidate.deliveryFee !== undefined ? { deliveryFee: candidate.deliveryFee } : {}),
    ...(candidate.cost.fees !== undefined ? { fees: candidate.cost.fees.cents / 100 } : {}),
    ...(candidate.cost.status !== "unknown" ? { costStatus: candidate.cost.status } : {}),
    ...(candidate.composition !== undefined ? { composition: candidate.composition } : {}),
    itemId: candidate.itemId,
    itemName: candidate.itemName,
    price: candidate.price,
    ...(candidate.promotionalPrice !== undefined
      ? { promotionalPrice: candidate.promotionalPrice }
      : {}),
    ...(candidate.curated !== undefined ? { curated: candidate.curated } : {}),
  });
}
