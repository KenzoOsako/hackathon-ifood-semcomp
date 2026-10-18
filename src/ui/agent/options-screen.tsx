"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { AlertTriangle, ArrowLeft, BadgeCheck, Clock, Heart, History, MapPin, Sparkles, Star, Tag, Wallet, Zap, type LucideIcon } from "lucide-react";
import type { Option, OptionLabel, Reason } from "@/contracts";
import { Alert } from "@/ui/components/alert";
import { Badge } from "@/ui/components/badge";
import { Button } from "@/ui/components/button";
import { DATA_ORIGIN, useAgent } from "./agent-context";
import { fromReais } from "./format";

const LABELS: Record<OptionLabel, { title: string; Icon: LucideIcon }> = {
  MAIS_BARATA: { title: "Mais barata", Icon: Wallet },
  MELHOR_AVALIADA: { title: "Melhor avaliada", Icon: Star },
  MAIS_RAPIDA: { title: "Mais rápida", Icon: Zap },
  SEU_FAVORITO: { title: "Seu favorito", Icon: Heart },
  NOVIDADE_PARA_VOCE: { title: "Novidade para você", Icon: Sparkles },
};

const REASON_ICON: Record<Reason["kind"], LucideIcon> = {
  rating: Star, price: Tag, delivery_time: Clock, distance: MapPin,
  promo: Tag, times_ordered: History, new_for_you: Sparkles, curated: BadgeCheck,
};

export function OptionCard({ option, onSelect, disabled }: Readonly<{ option: Option; onSelect: () => void; disabled: boolean }>) {
  const { title, Icon } = LABELS[option.label];
  const c = option.candidate;
  const price = c.promotionalPrice ?? c.price;
  return (
    <article aria-label={`${title}: ${c.itemName}, ${c.merchantName}`} className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <h2 className="font-display text-xl font-bold leading-none">{title}</h2>
        {DATA_ORIGIN === "mock" && <Badge variant="simulated" className="ml-auto">Simulado</Badge>}
      </div>

      <p className="mt-3 font-semibold leading-tight">{c.itemName}</p>
      <p className="text-sm text-muted-foreground">{c.merchantName}</p>

      {/* Motivos: só o texto que veio de `reasons`; a UI não inventa nenhum. */}
      <ul className="mt-3 grid gap-1.5 text-sm">
        {option.reasons.map((r) => {
          const RIcon = REASON_ICON[r.kind];
          return (
            <li key={r.kind} className="flex items-start gap-2">
              <RIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>{r.text}</span>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-2xl font-bold leading-none">{fromReais(price)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {c.deliveryFee === undefined ? "Frete não informado" : `Frete ${fromReais(c.deliveryFee)}`} · total ainda não confirmado
          </p>
        </div>
        {c.deliveryTimeMinutes !== undefined && (
          <p className="text-right text-xs text-muted-foreground">≈ {c.deliveryTimeMinutes} min<br />(estimado)</p>
        )}
      </div>

      <Button className="mt-4 w-full" disabled={disabled} onClick={onSelect} aria-label={`Escolher ${title}: ${c.itemName}, ${c.merchantName}`}>
        Escolher esta opção
      </Button>
    </article>
  );
}

export function OptionsScreen() {
  const { turn, busy, error, select, retry } = useAgent();
  const reduceMotion = useReducedMotion();
  const options = turn?.state === "ESCOLHENDO_OPCAO" ? turn.options ?? [] : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Button asChild variant="ghost" size="icon" aria-label="Voltar para a conversa">
          <Link href="/agente"><ArrowLeft /></Link>
        </Button>
        <h1 className="font-display text-lg font-bold">{options.length ? "Opções para você" : "Opções"}</h1>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {error && (
          <Alert variant="destructive" className="mb-3">
            <AlertTriangle aria-hidden="true" />
            <div className="flex-1">
              <p>{error}</p>
              <Button variant="outline" size="sm" className="mt-2" disabled={busy} onClick={() => void retry()}>Tentar de novo</Button>
            </div>
          </Alert>
        )}

        {options.length === 0 ? (
          <div className="grid justify-items-center gap-3 py-12 text-center">
            <p className="font-display text-xl font-bold">Ainda não há opções</p>
            <p className="max-w-64 text-sm text-muted-foreground">Conte o que você quer comer e eu busco para você.</p>
            <Button asChild><Link href="/agente">Falar com o FoodPilot</Link></Button>
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              Valores simulados. O total com frete e taxas só aparece na revisão, quando estiver confirmado.
            </p>
            <ul className="grid gap-3">
              {options.map((option, i) => (
                <motion.li
                  key={option.candidate.itemId}
                  initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.08 }}
                >
                  <OptionCard option={option} disabled={busy} onSelect={() => void select(i)} />
                </motion.li>
              ))}
            </ul>
            <p className="mt-4 text-center text-sm">
              Nenhuma serve? <Link href="/agente" className="font-semibold text-primary underline underline-offset-2">Refinar a busca</Link>
            </p>
          </>
        )}
      </main>
    </div>
  );
}
