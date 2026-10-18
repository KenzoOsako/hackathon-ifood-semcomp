"use client";
import { useState } from "react";
import type { BlocoPlano, ConfiguracaoItem } from "@/agent/types";
import { validarSelecoes, resumoComplementos } from "@/agent/complementos";
import { Button } from "@/ui/components/button";
import { fromCents } from "./format";

type Props = { bloco: BlocoPlano; planoId: string; versao: number; busy: boolean; onSend: (texto: string, configuracao?: ConfiguracaoItem) => void; onDirtyChange?: (dirty: boolean) => void };

export function ComplementosResumo({ bloco }: Readonly<{ bloco: BlocoPlano }>) {
  const nomes = resumoComplementos(bloco.principal);
  return nomes.length ? <span className="mt-1 block text-xs text-muted-foreground">{nomes.join(" · ")}</span> : null;
}

// O pai usa chave por versão: uma resposta do servidor substitui o rascunho e impede escolhas de outro item.
export function ComplementosItem({ bloco, planoId, versao, busy, onSend, onDirtyChange }: Readonly<Props>) {
  const c = bloco.principal.complementos;
  const [selecoes, setSelecoes] = useState<ConfiguracaoItem["selecoes"]>(c?.selecoes ?? []);
  if (!c) return null;
  if (c.status !== "verificado") return <p role="status" className="px-2 py-3 text-sm text-muted-foreground">Não foi possível verificar os complementos. Peça para buscar este item novamente antes de aprovar.</p>;
  if (!c.grupos.length) return <p className="px-2 text-xs text-muted-foreground">Este item não tem complementos no catálogo consultado.</p>;
  if (c.composicaoNaoVerificada) return <p role="status" className="px-2 py-3 text-sm text-muted-foreground">A composição dos complementos não foi confirmada para suas restrições alimentares. {c.grupos.some(g => g.minimo > 0) ? "Este item exige complementos; escolha outro item com composição verificada." : "Este item seguirá sem adicionais."}</p>;
  const erros = validarSelecoes(bloco.principal, selecoes);
  const alterar = (grupoId: string, opcaoId: string, quantidade: number, unico: boolean) => {
    const novas = [
    ...selecoes.filter(s => !(s.grupoId === grupoId && (unico || s.opcaoId === opcaoId))),
    ...(quantidade > 0 ? [{ grupoId, opcaoId, quantidade }] : []),
    ];
    setSelecoes(novas);
    const chave = (xs: ConfiguracaoItem["selecoes"]) => JSON.stringify([...xs].sort((a,b) => a.grupoId.localeCompare(b.grupoId) || a.opcaoId.localeCompare(b.opcaoId)));
    onDirtyChange?.(chave(novas) !== chave(c.selecoes));
  };
  return <details className="mt-2 rounded-xl border border-border bg-card p-3" open={validarSelecoes(bloco.principal).length > 0}>
    <summary className="cursor-pointer text-sm font-semibold">Configurar complementos</summary>
    <p className="my-2 text-xs text-muted-foreground">Escolhas e adicionais por unidade. {bloco.quantidade > 1 ? `Aplicados às ${bloco.quantidade} unidades deste item.` : ""}</p>
    {c.grupos.map(g => <fieldset key={g.id} disabled={busy} className="my-3">
      <legend className="text-sm font-semibold">{g.nome} · {g.minimo > 0 ? "Obrigatório" : "Opcional"} · {g.minimo} a {g.maximo}</legend>
      {g.opcoes.map(o => {
        const qtd = selecoes.find(s => s.grupoId === g.id && s.opcaoId === o.id)?.quantidade ?? 0;
        return <label key={o.id} className="mt-2 flex items-center justify-between gap-2 text-sm">
          <span>{o.nome} <span className="text-muted-foreground">{o.precoCents ? `+ ${fromCents(o.precoCents)}` : "Sem adicional"}{!o.disponivel && " · Indisponível"}</span></span>
          {g.maximo === 1 ? <input type={g.minimo === 1 ? "radio" : "checkbox"} name={`${planoId}-${bloco.necessidadeId}-${g.id}`} checked={qtd > 0} disabled={!o.disponivel || busy} onChange={e => alterar(g.id, o.id, e.target.checked ? 1 : 0, true)} />
            : <select aria-label={`Quantidade de ${o.nome}`} value={qtd} disabled={!o.disponivel || busy} onChange={e => alterar(g.id, o.id, Number(e.target.value), false)} className="rounded border border-border bg-background p-1">{Array.from({length:g.maximo + 1}, (_,i) => <option key={i} value={i}>{i}</option>)}</select>}
        </label>;
      })}
    </fieldset>)}
    {erros.length > 0 && <p role="status" className="text-sm text-muted-foreground">{erros.join(" ")}</p>}
    <Button size="sm" className="mt-2" disabled={busy || erros.length > 0} onClick={() => onSend(`Salvar complementos de ${bloco.principal.item}`, { planoId, versao, necessidadeId: bloco.necessidadeId, ref: bloco.principal.ref, selecoes })}>Salvar complementos</Button>
  </details>;
}
