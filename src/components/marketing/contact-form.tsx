"use client";

import { useActionState } from "react";
import Link from "next/link";
import { contactAction, type ContactState } from "@/actions/contact";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: ContactState = {};

export function ContactForm() {
  const [state, formAction, isPending] = useActionState(contactAction, initialState);

  if (state.status === "not_delivered") {
    return (
      <div role="status" className="rounded-[1.25rem] border border-border bg-card p-6 text-sm leading-relaxed">
        <p className="font-medium">Sua mensagem foi validada, mas ainda não enviada.</p>
        <p className="mt-2 text-muted-foreground">
          O envio automático deste formulário será ativado em breve. Enquanto isso, o caminho mais
          rápido é{" "}
          <Link href="/agendar" className="underline underline-offset-4 hover:text-foreground">
            agendar a pré-consulta gratuita
          </Link>
          .
        </p>
      </div>
    );
  }

  const errors = state.fieldErrors ?? {};
  const values = state.values;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="name">Nome</Label>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          required
          defaultValue={values?.name}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "contact-name-error" : undefined}
        />
        {errors.name ? (
          <p id="contact-name-error" className="text-sm text-destructive">
            {errors.name}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={values?.email}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "contact-email-error" : undefined}
        />
        {errors.email ? (
          <p id="contact-email-error" className="text-sm text-destructive">
            {errors.email}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="message">Mensagem</Label>
        <Textarea
          id="message"
          name="message"
          rows={5}
          required
          defaultValue={values?.message}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={errors.message ? "contact-message-error" : undefined}
        />
        {errors.message ? (
          <p id="contact-message-error" className="text-sm text-destructive">
            {errors.message}
          </p>
        ) : null}
      </div>

      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? "Enviando..." : "Enviar mensagem"}
      </Button>
    </form>
  );
}
