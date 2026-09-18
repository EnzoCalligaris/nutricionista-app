"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PatientFormState } from "@/actions/patients";

type Mode =
  | { mode: "create" }
  | {
      mode: "edit";
      hasPortalAccount: boolean;
      initial: { fullName: string; email: string; phone: string; birthDate: string };
    };

type Props = Mode & {
  action: (prev: PatientFormState, formData: FormData) => Promise<PatientFormState>;
  cancelHref: string;
};

const initialState: PatientFormState = {};

/**
 * Formulário de paciente (prompt Fase 5 §12/§16/§51): página dedicada,
 * Server Action + `useActionState` (mesmo padrão da Fase 3). Só campos de
 * negócio desta fase — nada clínico, nada de role/ids. Em caso de erro os
 * valores digitados voltam do servidor para não perder o que foi preenchido.
 */
export function PatientForm(props: Props) {
  const [state, formAction, isPending] = useActionState(props.action, initialState);
  const idPrefix = useId();

  const defaults =
    state.values ??
    (props.mode === "edit"
      ? { ...props.initial, sendInvite: "" }
      : { fullName: "", email: "", phone: "", birthDate: "", sendInvite: "" });

  const field = (name: "fullName" | "email" | "phone" | "birthDate") => ({
    id: `${idPrefix}-${name}`,
    errorId: `${idPrefix}-${name}-error`,
    error: state.fieldErrors?.[name],
  });

  const fullName = field("fullName");
  const email = field("email");
  const phone = field("phone");
  const birthDate = field("birthDate");

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={fullName.id}>Nome completo</Label>
          <Input
            id={fullName.id}
            name="fullName"
            type="text"
            autoComplete="name"
            required
            maxLength={120}
            defaultValue={defaults.fullName}
            aria-invalid={fullName.error ? true : undefined}
            aria-describedby={fullName.error ? fullName.errorId : undefined}
          />
          {fullName.error ? (
            <p id={fullName.errorId} className="text-xs text-destructive">
              {fullName.error}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={email.id}>E-mail</Label>
          <Input
            id={email.id}
            name="email"
            type="email"
            autoComplete="off"
            inputMode="email"
            defaultValue={defaults.email}
            aria-invalid={email.error ? true : undefined}
            aria-describedby={email.error ? email.errorId : `${email.id}-hint`}
          />
          {email.error ? (
            <p id={email.errorId} className="text-xs text-destructive">
              {email.error}
            </p>
          ) : (
            <p id={`${email.id}-hint`} className="text-xs text-muted-foreground">
              {props.mode === "edit" && props.hasPortalAccount
                ? "E-mail de contato. O e-mail de login do portal não muda por aqui."
                : "Opcional. Necessário para enviar o convite de acesso ao portal."}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={phone.id}>Telefone</Label>
          <Input
            id={phone.id}
            name="phone"
            type="tel"
            autoComplete="off"
            inputMode="tel"
            placeholder="+55 11 90000-0000"
            defaultValue={defaults.phone}
            aria-invalid={phone.error ? true : undefined}
            aria-describedby={phone.error ? phone.errorId : undefined}
          />
          {phone.error ? (
            <p id={phone.errorId} className="text-xs text-destructive">
              {phone.error}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={birthDate.id}>Data de nascimento</Label>
          <Input
            id={birthDate.id}
            name="birthDate"
            type="date"
            max="9999-12-31"
            defaultValue={defaults.birthDate}
            aria-invalid={birthDate.error ? true : undefined}
            aria-describedby={birthDate.error ? birthDate.errorId : `${birthDate.id}-hint`}
          />
          {birthDate.error ? (
            <p id={birthDate.errorId} className="text-xs text-destructive">
              {birthDate.error}
            </p>
          ) : (
            <p id={`${birthDate.id}-hint`} className="text-xs text-muted-foreground">
              Opcional. A idade é calculada automaticamente.
            </p>
          )}
        </div>
      </div>

      {props.mode === "create" ? (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
          <Checkbox id={`${idPrefix}-sendInvite`} name="sendInvite" defaultChecked={defaults.sendInvite === "on"} />
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-sendInvite`}>Enviar convite para acesso ao portal</Label>
            <p className="text-xs text-muted-foreground">
              O paciente recebe um e-mail para definir a própria senha. Sem o convite, o paciente
              existe apenas no seu cadastro — você pode convidar depois pelo perfil.
            </p>
          </div>
        </div>
      ) : null}

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button asChild variant="outline" type="button">
          <Link href={props.cancelHref}>Cancelar</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending
            ? "Salvando..."
            : props.mode === "create"
              ? "Cadastrar paciente"
              : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}
