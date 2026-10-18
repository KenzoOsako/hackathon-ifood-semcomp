import Link from "next/link";
import {
  Bell,
  ChevronDown,
  Clock,
  House,
  MapPin,
  PawPrint,
  Pill,
  Receipt,
  Search,
  ShoppingBasket,
  Star,
  Tag,
  User,
  UtensilsCrossed,
  Wine,
} from "lucide-react";
import { Badge } from "@/ui/components/badge";
import { Orb } from "@/ui/components/orb";

// Tudo aqui é cenário: imita a home do iFood só para dar contexto à demo.
// A única parte funcional é a bolinha, que abre o assistente.
const CATEGORIES = [
  { label: "Restaurantes", Icon: UtensilsCrossed },
  { label: "Mercado", Icon: ShoppingBasket },
  { label: "Bebidas", Icon: Wine },
  { label: "Farmácia", Icon: Pill },
  { label: "Pet", Icon: PawPrint },
];

const STORES = [
  { name: "Cantina da Praça", kind: "Italiana", rating: "4,8", time: "30-40 min", fee: "Grátis" },
  { name: "Burger do Bairro", kind: "Lanches", rating: "4,6", time: "25-35 min", fee: "R$ 4,99" },
  { name: "Sabor Caseiro", kind: "Brasileira", rating: "4,7", time: "35-45 min", fee: "R$ 3,50" },
];

const NAV = [
  { label: "Início", Icon: House, active: true },
  { label: "Busca", Icon: Search },
  { label: "Pedidos", Icon: Receipt },
  { label: "Perfil", Icon: User },
];

export function IfoodHome() {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto pb-4">
        <header className="bg-primary px-4 pb-5 pt-4 text-primary-foreground">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <MapPin className="size-4" aria-hidden="true" />
              <span>Rua das Flores, 120</span>
              <ChevronDown className="size-4" aria-hidden="true" />
            </div>
            <Bell className="size-5" aria-hidden="true" />
          </div>
          <div className="mt-4 flex h-11 items-center gap-2 rounded-full bg-background px-4 text-sm text-muted-foreground">
            <Search className="size-4" aria-hidden="true" />
            <span>Busque por item ou loja</span>
          </div>
        </header>

        <nav aria-label="Categorias" className="flex gap-4 overflow-x-auto px-4 py-4">
          {CATEGORIES.map(({ label, Icon }) => (
            <div key={label} className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-xs font-medium">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                <Icon className="size-6" aria-hidden="true" />
              </span>
              {label}
            </div>
          ))}
        </nav>

        <section aria-label="Promoção" className="px-4">
          <div className="flex items-center justify-between rounded-2xl bg-primary p-4 text-primary-foreground">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide">Cupom da semana</p>
              <p className="mt-1 text-lg font-bold leading-tight">R$ 10 off no primeiro pedido</p>
            </div>
            <Tag className="size-8" aria-hidden="true" />
          </div>
        </section>

        <section aria-label="Lojas para você" className="px-4 pt-5">
          <h2 className="text-base font-bold">Lojas para você</h2>
          <ul className="mt-3 grid gap-3">
            {STORES.map((store) => (
              <li key={store.name} className="flex gap-3 rounded-2xl border border-border p-3">
                <span className="size-16 shrink-0 rounded-xl bg-secondary" aria-hidden="true" />
                <div className="min-w-0 text-sm">
                  <p className="truncate font-semibold">{store.name}</p>
                  <p className="text-muted-foreground">{store.kind}</p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Star className="size-3.5 text-warning-foreground" aria-hidden="true" />
                    {store.rating}
                    <Clock className="size-3.5" aria-hidden="true" />
                    {store.time} · {store.fee}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <Badge variant="simulated" className="mt-4">Protótipo · dados simulados</Badge>
        </section>
      </div>

      <nav aria-label="Navegação do app" className="flex border-t border-border bg-background px-2 py-2">
        {NAV.map(({ label, Icon, active }) => (
          <div
            key={label}
            className={`flex flex-1 flex-col items-center gap-0.5 text-xs font-medium ${active ? "text-primary" : "text-muted-foreground"}`}
          >
            <Icon className="size-5" aria-hidden="true" />
            {label}
          </div>
        ))}
      </nav>

      <Link
        href="/agente"
        aria-label="Abrir assistente FoodPilot"
        className="absolute bottom-20 right-4 flex size-16 items-center justify-center rounded-full shadow-lg"
      >
        <Orb size="fab" />
      </Link>
    </div>
  );
}
