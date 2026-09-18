import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(120, "Nome muito longo."),
  email: z.email({ error: "Informe um e-mail válido." }),
  message: z.string().trim().min(10, "Conte um pouco mais — pelo menos 10 caracteres.").max(2000, "Mensagem muito longa."),
  // Honeypot anti-spam: campo invisível que humanos não preenchem.
  website: z.string().max(0).optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;
