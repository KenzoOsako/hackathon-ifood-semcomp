"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Badge } from "@/ui/components/badge";
import { Button } from "@/ui/components/button";
import type { Agregados, Contagem } from "@/data/sinais";

type Resposta = { origem: "real" | "simulado"; agregados: Agregados };

// Visão do iFood: só contagens. Nenhuma linha aqui aponta para uma pessoa ou uma conversa.
export function PainelSinais() {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [erro, setErro] = useState(false);

  const carregar = () => fetch("/api/sinais").then((r) => { if (!r.ok) throw new Error("Falha ao carregar sinais"); return r.json(); }).then((d: Resposta) => { setDados(d); setErro(false); }).catch(() => setErro(true));
  useEffect(() => { void carregar(); }, []);

  const a = dados?.agregados;
  const vazio = a && a.buscas + a.planos === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      <header className="flex items-center gap-2 px-3 py-2">
        <Button asChild variant="ghost" size="icon" aria-label="Voltar para a conversa"><Link href="/agente"><ArrowLeft /></Link></Button>
        <span className="font-display text-lg font-medium">O que o Mimo aprende</span>
        <Button variant="ghost" size="icon" className="ml-auto" aria-label="Atualizar" onClick={() => { void carregar(); }}><RefreshCw /></Button>
      </header>

      <div className="grid gap-4 px-4 pb-6">
        <p className="text-sm text-muted-foreground">
          Sinais de demanda das conversas com o Mimo. Não guardamos conversa, nome, endereço nem identificador:
          só categoria, restrição e se o catálogo tinha opção.
        </p>
        {dados && <Badge variant={dados.origem === "real" ? "success" : "simulated"} className="justify-self-start">{dados.origem === "real" ? "Catálogo iFood real" : "Catálogo simulado"}</Badge>}

        {erro && <p className="text-sm text-destructive">Não consegui carregar os dados agora.</p>}
        {vazio && <p className="rounded-xl bg-secondary p-4 text-sm">Ainda não há sinais. Converse com o Mimo e faça um pedido.</p>}

        {a && !vazio && (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Numero rotulo="buscas" valor={a.buscas} />
              <Numero rotulo="planos" valor={a.planos} />
              <Numero rotulo="aprovados" valor={a.aprovados} />
            </div>
            <Lista titulo="Pediram e não tinha" dica="Demanda sem oferta na região: onde o iFood pode trazer lojas ou itens." itens={a.semOferta} destaque />
            <Lista titulo="Mais procurados" itens={a.maisBuscadas} />
            <Lista titulo="Restrições pedidas" itens={a.restricoes} />
            <Lista titulo="Ocasiões" itens={a.ocasioes} />
            <Lista titulo="Pedidos juntos no mesmo plano" itens={a.combinacoes} />
          </>
        )}
      </div>
    </div>
  );
}

function Numero({ rotulo, valor }: Readonly<{ rotulo: string; valor: number }>) {
  return (
    <div className="rounded-xl bg-secondary px-2 py-3">
      <p className="text-2xl font-bold">{valor}</p>
      <p className="text-xs text-muted-foreground">{rotulo}</p>
    </div>
  );
}

function Lista({ titulo, dica, itens, destaque }: Readonly<{ titulo: string; dica?: string; itens: Contagem[]; destaque?: boolean }>) {
  if (!itens.length) return null;
  const max = itens[0].total;
  return (
    <section className="grid gap-2">
      <h2 className="font-semibold">{titulo}</h2>
      {dica && <p className="-mt-1 text-xs text-muted-foreground">{dica}</p>}
      <ul className="grid gap-1.5">
        {itens.map((i) => (
          <li key={i.nome} className="grid grid-cols-[1fr_auto] items-center gap-x-3 text-sm">
            <span className="truncate first-letter:uppercase">{i.nome}</span>
            <span className="tabular-nums text-muted-foreground">{i.total}</span>
            <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-secondary">
              <span className={destaque ? "block h-full bg-primary" : "block h-full bg-foreground/30"} style={{ width: `${(i.total / max) * 100}%` }} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
