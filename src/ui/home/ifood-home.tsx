import Link from "next/link";
import {
  Bell,
  ChevronDown,
  Clock,
  Fish,
  House,
  IceCream,
  MapPin,
  PawPrint,
  Pill,
  Pizza,
  Receipt,
  Salad,
  Sandwich,
  Search,
  ShoppingBasket,
  Soup,
  Star,
  User,
  UtensilsCrossed,
  Wine,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/ui/components/badge";
import { Orb } from "@/ui/components/orb";
import { StoreLogo } from "@/ui/components/store-logo";

// Tudo aqui é cenário: imita a home do iFood só para dar contexto à demo, sem imagens e sem lógica.
// A única parte funcional é a bolinha, que abre o assistente.
const CATEGORIES = [
  { label: "Restaurantes", Icon: UtensilsCrossed },
  { label: "Mercado", Icon: ShoppingBasket },
  { label: "Bebidas", Icon: Wine },
  { label: "Farmácia", Icon: Pill },
  { label: "Pet", Icon: PawPrint },
];

const FILTERS = ["Entrega grátis", "Mais rápidos", "Cupons", "Favoritos"];

type Store = { name: string; kind: string; km: string; rating: string; time: string; fee: string; Icon: LucideIcon; tone: number };
const STORES: Store[] = [
  { name: "Cantina da Praça", kind: "Italiana", km: "1,2 km", rating: "4,8", time: "30-40 min", fee: "Grátis", Icon: Pizza, tone: 1 },
  { name: "Burger do Bairro", kind: "Lanches", km: "0,8 km", rating: "4,6", time: "25-35 min", fee: "R$ 4,99", Icon: Sandwich, tone: 2 },
  { name: "Sabor Caseiro", kind: "Brasileira", km: "2,1 km", rating: "4,7", time: "35-45 min", fee: "R$ 3,50", Icon: Soup, tone: 3 },
  { name: "Sushi Hana", kind: "Japonesa", km: "2,6 km", rating: "4,9", time: "40-50 min", fee: "Grátis", Icon: Fish, tone: 4 },
  { name: "Açaí Tropical", kind: "Sobremesas", km: "1,5 km", rating: "4,6", time: "20-30 min", fee: "R$ 3,99", Icon: IceCream, tone: 5 },
  { name: "Verde Salada", kind: "Saudável", km: "1,9 km", rating: "4,5", time: "25-35 min", fee: "Grátis", Icon: Salad, tone: 6 },
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
        <header className="bg-primary px-4 pb-3 pt-3 text-primary-foreground">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              <MapPin className="size-4" aria-hidden="true" />
              <span>Rua das Flores, 120</span>
              <ChevronDown className="size-4" aria-hidden="true" />
            </div>
            <Bell className="size-5" aria-hidden="true" />
          </div>
          <div className="mt-3 flex h-10 items-center gap-2 rounded-full bg-background px-4 text-sm text-muted-foreground">
            <Search className="size-4" aria-hidden="true" />
            <span>Busque por item ou loja</span>
          </div>
        </header>

        <nav aria-label="Categorias" className="flex gap-4 overflow-x-auto px-4 py-3">
          {CATEGORIES.map(({ label, Icon }) => (
            <div key={label} className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-xs font-medium">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                <Icon className="size-6" aria-hidden="true" />
              </span>
              {label}
            </div>
          ))}
        </nav>

        <div aria-hidden="true" className="flex gap-2 overflow-x-auto px-4 pb-3">
          {FILTERS.map((f) => (
            <span key={f} className="shrink-0 rounded-full border border-border px-3 py-1.5 text-sm">{f}</span>
          ))}
        </div>

        <section aria-label="Promoção" className="px-4">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-primary px-4 py-3 text-primary-foreground">
            <div>
              <p className="font-display text-2xl font-medium leading-none">R$ 10 off</p>
              <p className="mt-1 text-xs">no primeiro pedido</p>
            </div>
            {/* Botão só de cenário: não é focável nem faz nada. */}
            <span aria-hidden="true" className="rounded-full bg-background px-4 py-1.5 text-sm font-semibold text-primary">Pegar</span>
          </div>
        </section>

        <section aria-label="Lojas para você" className="px-4 pt-4">
          <h2 className="font-display text-lg font-medium">Lojas para você</h2>
          <ul className="mt-1 divide-y divide-border">
            {STORES.map((store) => (
              <li key={store.name} className="flex items-center gap-3 py-3">
                <StoreLogo icon={store.Icon} tone={store.tone} className="size-14" />
                <div className="min-w-0 text-sm">
                  <p className="truncate font-display text-base font-medium leading-tight">{store.name}</p>
                  <p className="text-muted-foreground">{store.kind} · {store.km}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Star className="size-3.5 text-warning-foreground" aria-hidden="true" />
                    {store.rating}
                    <Clock className="size-3.5" aria-hidden="true" />
                    {store.time}
                    <span aria-hidden="true">·</span>
                    <span className={store.fee === "Grátis" ? "font-semibold text-success-foreground" : ""}>{store.fee}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <Badge variant="simulated" className="mt-3">Protótipo · dados simulados</Badge>
        </section>
      </div>

      <nav aria-label="Navegação do app" className="flex border-t border-border bg-background px-2 py-2">
        {NAV.map(({ label, Icon, active }) => (
          <div
            key={label}
            className={`flex flex-1 flex-col items-center gap-0.5 text-xs font-medium ${active ? "text-primary" : "text-muted-foreground"}`}
          >
            <Icon className="size-5" fill={active ? "currentColor" : "none"} aria-hidden="true" />
            {label}
          </div>
        ))}
      </nav>

      <Link
        href="/agente"
        aria-label="Abrir assistente Mimo"
        className="absolute bottom-20 right-4 flex size-16 items-center justify-center rounded-full shadow-lg"
      >
        <Orb size="fab" />
      </Link>
    </div>
  );
}
