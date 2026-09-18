"use client";

import { useActionState } from "react";
import { invitePatientAction, type InvitePatientState } from "@/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: InvitePatientState = {};

export function InvitePatientForm() {
  const [state, formAction, isPending] = useActionState(invitePatientAction, initialState);

  return (
    <form action={formAction} className="max-w-sm space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="fullName">Nome completo</Label>
        <Input id="fullName" name="fullName" type="text" autoComplete="name" required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p role="status" className="text-sm text-success">
          {state.success}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Enviando convite..." : "Convidar paciente"}
      </Button>
    </form>
  );
}
