"use server";

import { contactSchema } from "@/validators/contact";
import { InMemoryRateLimiter } from "@/lib/auth/rate-limiter";
import { getClientIp } from "@/lib/auth/rate-limit";
import { authErrorMessage } from "@/lib/auth/errors";

export type ContactState = {
  status?: "invalid" | "rate_limited" | "not_delivered";
  error?: string;
  fieldErrors?: Partial<Record<"name" | "email" | "message", string>>;
  /** Valores digitados, devolvidos para o form não esvaziar após erro (React reseta o form ao fim da action). */
  values?: { name: string; email: string; message: string };
};

function readValues(formData: FormData): NonNullable<ContactState["values"]> {
  return {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    message: String(formData.get("message") ?? ""),
  };
}

const contactRateLimiter = new InMemoryRateLimiter(5, 15 * 60 * 1000);

/**
 * Formulário de contato — Fase 4. Valida e limita abuso, mas NÃO entrega a
 * mensagem: o envio real depende de um provedor de e-mail (Resend, Fase 12)
 * que ainda não está integrado, e não existe fila/tabela para guardá-la.
 * Em vez de fingir sucesso (prompt Fase 4 §29: "não fingir que enviou"), a
 * action devolve `not_delivered` e a UI explica isso com clareza.
 *
 * Quando o provedor existir, este é o único ponto a mudar: validar (já
 * feito) -> `EmailProvider.send()` -> retornar `sent`.
 */
export async function contactAction(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    message: formData.get("message"),
    website: formData.get("website") ?? undefined,
  });

  if (!parsed.success) {
    const fieldErrors: ContactState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "name" || field === "email" || field === "message") {
        fieldErrors[field] ??= issue.message;
      }
    }
    return { status: "invalid", fieldErrors, values: readValues(formData) };
  }

  const ip = await getClientIp();
  const rate = await contactRateLimiter.consume(ip);
  if (!rate.success) {
    return { status: "rate_limited", error: authErrorMessage("RATE_LIMITED"), values: readValues(formData) };
  }

  return { status: "not_delivered" };
}
