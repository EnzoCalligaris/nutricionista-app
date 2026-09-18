/**
 * Dinheiro é sempre inteiro em centavos (docs/DATABASE.md) — formatação e
 * parsing ficam aqui, puros, para o domínio e a UI usarem a mesma regra.
 */

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(cents: number): string {
  return brl.format(cents / 100);
}

/**
 * Converte entrada humana ("1.050,00", "1050", "R$ 600,5") em centavos.
 * Devolve null quando não dá para interpretar com segurança — quem chama
 * decide a mensagem de validação. Nunca usa float como valor final.
 */
export function parseBRLToCents(input: string): number | null {
  const cleaned = input.replace(/\s|R\$/g, "");
  if (!cleaned) return null;
  // Formato brasileiro: "." é milhar e "," é decimal. Aceita também um
  // número sem separador decimal ("1050" = R$ 1.050,00).
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  return Number.isSafeInteger(cents) ? cents : null;
}
