// Pedido específico ("pizza calabresa") não pode virar outro sabor num ajuste ("a mais bem avaliada").
// Se houver itens que batem com todas as palavras específicas do pedido, só eles concorrem; senão, todos.
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const GENERICAS = new Set(["grande", "media", "pequena", "familia", "para", "com", "sem"]);

export function soOsEspecificos<T>(itens: T[], categoria: string, texto: (t: T) => string): T[] {
  const palavras = norm(categoria).split(/\s+/).filter((w) => w.length > 3 && !GENERICAS.has(w));
  if (palavras.length < 2) return itens;
  const exatos = itens.filter((i) => palavras.every((w) => norm(texto(i)).includes(w)));
  return exatos.length > 0 ? exatos : itens;
}
