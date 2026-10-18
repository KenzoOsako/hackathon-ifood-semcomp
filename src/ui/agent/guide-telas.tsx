"use client";
// As três telas que o agente pode pedir (docs/PLANO_TELA_GUIDE.md): plano por item, revisão por loja e sacola.
// Os botões não têm rota própria: mandam ao agente a mesma frase que a pessoa diria. Nenhum valor é somado aqui.
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CircleCheck, Info, ShoppingBag } from "lucide-react";
import { Alert } from "@/ui/components/alert";
import { Badge } from "@/ui/components/badge";
import { Button } from "@/ui/components/button";
import { CatalogImage } from "@/ui/components/catalog-image";
import { catalogImage } from "@/ui/lib/catalog-media";
import { chaveLoja } from "@/agent/sacola";
import { StoreLogo } from "@/ui/components/store-logo";
import { fromCents } from "./format";
import { paraOption, porLoja, type PlanoTela } from "./plano-tela";
import { ResultCard } from "./result-card";

// Frases que os botões mandam. "pode" leva à revisão; só a frase explícita aprova (regra do agente), e ela cita
// a versão exibida: se o plano mudou no servidor depois, o agente recusa em vez de aprovar a versão nova.
export const FRASE_REVISAR = "pode";
export const fraseAprovar = (versao: number) => `aprovo o plano versão ${versao}`;

type Base = { plano: PlanoTela; busy: boolean; onSend: (texto: string) => void; onAdjust: () => void };

function Avisos({ plano }: Readonly<{ plano: PlanoTela }>) {
  const avisos = [...plano.naoAtendidas.map((n) => `${n.categoria}: ${n.motivo}`), ...plano.pendencias];
  if (!avisos.length) return null;
  return (
    <Alert variant="warning" className="mt-3">
      <Info aria-hidden="true" />
      <ul className="list-disc pl-4 text-sm">{avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>
    </Alert>
  );
}

const Origem = ({ origem }: Readonly<{ origem: string }>) =>
  origem === "real" ? <Badge variant="success">iFood real</Badge> : <Badge variant="simulated">Simulado</Badge>;

export function PlanoView({ plano, atualizado, busy, onSend, onAdjust }: Readonly<Base & { atualizado: boolean }>) {
  const reduceMotion = useReducedMotion();
  const [aberto, setAberto] = useState<string | null>(null);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mt-1 min-h-0 flex-1 overflow-y-auto rounded-t-3xl bg-card px-4 pb-4 pt-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl font-semibold">Seu plano</h2>
          <span className="shrink-0 text-xs text-muted-foreground">versão {plano.versao}{atualizado && " · atualizado"}</span>
        </div>
        <ul className="mt-2 flex flex-col gap-3">
          {plano.blocos.map((b, i) => {
            const { option, tag, media } = paraOption(b.principal);
            return (
              <motion.li key={b.necessidadeId} className="min-w-0"
                initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: i * 0.06 }}>
                <div className="flex items-center gap-2 px-2">
                  <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">{b.categoria} · {b.quantidade} {b.quantidade > 1 ? "unidades" : "unidade"}</h3>
                  {b.sugestao && <Badge>Sugestão</Badge>}
                  <span className="ml-auto"><Origem origem={b.principal.origem} /></span>
                </div>
                {/* Sem "Selecionar": trocar de alternativa tocando fica para depois; ajustar é falar ou digitar. */}
                <ResultCard option={option} tag={tag} media={media} first={i === 0} expanded={aberto === b.necessidadeId} disabled={busy}
                  onToggle={() => setAberto(aberto === b.necessidadeId ? null : b.necessidadeId)} onAdjust={onAdjust} />
              </motion.li>
            );
          })}
        </ul>
        <Avisos plano={plano} />
        <p className="mt-3 text-center text-xs text-muted-foreground">Preço de cada unidade. O total aparece na sacola; o valor final é o do iFood.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 bg-card px-4 pb-3">
        <Button variant="outline" onClick={onAdjust}>Ajustar</Button>
        <Button disabled={busy} onClick={() => onSend(FRASE_REVISAR)}>Revisar e aprovar</Button>
      </div>
    </div>
  );
}

export function RevisaoView({ plano, busy, onSend, onAdjust }: Readonly<Base>) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
        <h2 className="font-display text-2xl font-semibold">Revise o plano</h2>
        <p className="text-sm text-muted-foreground">Versão {plano.versao}. Para mudar algo, é só falar.</p>
        {porLoja(plano).map((l) => (
          <section key={l.lojaId} className="mt-3 rounded-2xl border border-border bg-card">
            <header className="flex items-center gap-2 border-b border-border p-3">
              <StoreLogo seed={l.lojaId} shape="square" imageSrc={plano.blocos.filter(b => chaveLoja(b.principal) === l.lojaId).map(b => paraOption(b.principal).media.logo).find(Boolean)} className="size-8" />
              <span className="font-display font-semibold">{l.loja}</span>
            </header>
            <ul className="divide-y divide-border">
              {l.itens.map(({ bloco: b }) => (
                <li key={b.necessidadeId} className="flex justify-between gap-3 p-3 text-sm">
                  <span className="flex items-center gap-2"><ItemPhoto src={paraOption(b.principal).media.photo} />{b.quantidade}× {b.principal.item}{b.sugestao && <Badge className="ml-2">Sugestão</Badge>}</span>
                  <span className="font-semibold">{fromCents(b.principal.precoCents)}{b.quantidade > 1 && <span className="font-normal text-muted-foreground"> cada</span>}</span>
                </li>
              ))}
            </ul>
            <p className="flex justify-between border-t border-border p-3 text-sm text-muted-foreground">
              <span>Frete</span><span>{l.freteCents === undefined ? "Não informado" : l.freteCents === 0 ? "Grátis" : fromCents(l.freteCents)}</span>
            </p>
          </section>
        ))}
        <Avisos plano={plano} />
      </main>
      <div className="grid grid-cols-2 gap-2 px-4 pb-3">
        <Button variant="outline" onClick={onAdjust}>Ajustar</Button>
        <Button disabled={busy} onClick={() => onSend(fraseAprovar(plano.versao))}>Aprovar versão {plano.versao}</Button>
      </div>
    </div>
  );
}

export function SacolaView({ plano }: Readonly<{ plano: PlanoTela }>) {
  const [finalizou, setFinalizou] = useState(false);
  const sacola = plano.sacola;
  const mesmaVersao = sacola?.planoId === plano.planoId && sacola?.versao === plano.versao;
  const opcao = (lojaId: string, ref?: string) => mesmaVersao ? plano.blocos.find(b => chaveLoja(b.principal) === lojaId && (ref === undefined || b.principal.ref === ref))?.principal : undefined;
  if (!sacola) return null;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
        <div className="flex items-center gap-2">
          <ShoppingBag className="size-5" aria-hidden="true" />
          <h2 className="font-display text-2xl font-semibold">Sacola</h2>
          <Badge variant="simulated" className="ml-auto">Simulação</Badge>
        </div>
        <p className="text-sm text-muted-foreground">Versão {sacola.versao} aprovada. Nada foi enviado ao iFood.</p>
        {sacola.lojas.map((l) => (
          <section key={l.lojaId} className="mt-3 rounded-2xl border border-border bg-card">
            <header className="flex items-center gap-2 border-b border-border p-3">
              <StoreLogo seed={l.lojaId} shape="square" imageSrc={mesmaVersao ? plano.blocos.filter(b => chaveLoja(b.principal) === l.lojaId).map(b => paraOption(b.principal).media.logo).find(Boolean) : undefined} className="size-8" />
              <span className="font-display font-semibold">{l.loja}</span>
              <span className="ml-auto"><Origem origem={l.origem} /></span>
            </header>
            <ul className="divide-y divide-border">
              {l.itens.map((it, i) => (
                <li key={`${it.ref}-${i}`} className="flex justify-between gap-3 p-3 text-sm">
                  <span className="flex items-center gap-2"><ItemPhoto src={opcao(l.lojaId, it.ref) ? paraOption(opcao(l.lojaId, it.ref)!).media.photo : undefined} />{it.quantidade}× {it.item}</span>
                  <span className="font-semibold">{fromCents(it.subtotalCents)}</span>
                </li>
              ))}
            </ul>
            <dl className="grid grid-cols-[1fr_auto] gap-y-1 border-t border-border p-3 text-sm">
              <dt className="text-muted-foreground">Subtotal</dt><dd>{fromCents(l.subtotalCents)}</dd>
              <dt className="text-muted-foreground">Taxa de entrega</dt>
              <dd>{l.freteCents === undefined ? "Não informada" : l.freteCents === 0 ? "Grátis" : fromCents(l.freteCents)}</dd>
              <dt className="font-semibold">Total da loja</dt><dd className="font-semibold">{fromCents(l.totalCents)}</dd>
            </dl>
          </section>
        ))}
        <p className="mt-4 flex items-baseline justify-between font-display">
          <span className="text-lg font-medium">Total</span>
          <span className="text-3xl font-medium">{fromCents(sacola.totalCents)}</span>
        </p>
        {sacola.freteDesconhecido && <p className="text-right text-xs text-muted-foreground">Sem a taxa de entrega que não foi informada</p>}
        {finalizou && (
          <Alert className="mt-3">
            <CircleCheck aria-hidden="true" />
            <p>Esta é uma simulação: nenhum pedido foi enviado. A compra termina no app do iFood.</p>
          </Alert>
        )}
      </main>
      <div className="px-4 pb-3">
        {/* Não chama nada remoto: a chave do MCP não tem escopo de carrinho e a compra final é no iFood. */}
        <Button className="w-full" onClick={() => setFinalizou(true)}>Finalizar pedido no iFood</Button>
      </div>
    </div>
  );
}

function ItemPhoto({ src }: Readonly<{ src?: string }>) {
 const safe = src?.startsWith("/exemplos/") ? src : catalogImage(src);
 return safe ? <span aria-hidden="true" className="relative size-10 shrink-0 overflow-hidden rounded-lg"><CatalogImage key={safe} src={safe} alt="" sizes="40px" /></span> : null;
}
