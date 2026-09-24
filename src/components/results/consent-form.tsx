"use client";

import { useActionState, useId } from "react";
import { registerConsentAction, type ResultFormState } from "@/actions/results";
import { PatientPicker } from "@/components/scheduling/patient-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { MEDIA_CONSENT_DOCUMENT } from "@/domain/results/consent-document";
import { NAME_DISPLAY_LABELS, NAME_DISPLAY_MODES } from "@/domain/results/display";

const initialState: ResultFormState = {};

/**
 * Registro do consentimento de uso de imagem (prompt Fase 14 §29/§30/§88).
 *
 * Não é um checkbox solto: grava finalidade, versão do texto, data, quem
 * registrou, o formato de identificação autorizado e onde a autorização
 * está arquivada. A finalidade e a versão são fixadas pelo servidor.
 */
export function ConsentForm({
  resultId,
  patient,
}: {
  resultId: string;
  patient: { id: string; name: string } | null;
}) {
  const action = registerConsentAction.bind(null, resultId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const idPrefix = useId();
  const fieldErrors = state.fieldErrors ?? {};
  const values = state.values;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <section aria-labelledby={`${idPrefix}-doc`} className="rounded-xl border border-border bg-muted/30 p-4">
        <h2 id={`${idPrefix}-doc`} className="font-heading text-base font-medium">
          {MEDIA_CONSENT_DOCUMENT.title}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Versão <code>{MEDIA_CONSENT_DOCUMENT.version}</code> · REVISÃO JURÍDICA PENDENTE antes de produção
        </p>
        <p className="mt-3 text-sm leading-relaxed">{MEDIA_CONSENT_DOCUMENT.summary}</p>
        <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm leading-relaxed text-muted-foreground">
          {MEDIA_CONSENT_DOCUMENT.clauses.map((clause) => (
            <li key={clause}>{clause}</li>
          ))}
        </ul>
      </section>

      <div className="space-y-1.5">
        <PatientPicker
          autoOpen={!patient}
          initial={patient}
          error={fieldErrors.patientId}
        />
        <p className="text-xs text-muted-foreground">
          O consentimento é sempre de uma pessoa identificada — é dela que sai o nome exibido, no formato autorizado.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-mode`}>Como a pessoa autorizou ser identificada</Label>
        <NativeSelect
          id={`${idPrefix}-mode`}
          name="nameDisplayMode"
          required
          defaultValue={values?.nameDisplayMode ?? "ANONYMOUS"}
          aria-invalid={fieldErrors.nameDisplayMode ? true : undefined}
        >
          {NAME_DISPLAY_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {NAME_DISPLAY_LABELS[mode]}
            </option>
          ))}
        </NativeSelect>
        {fieldErrors.nameDisplayMode ? (
          <p className="text-xs text-destructive">{fieldErrors.nameDisplayMode}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            O nome é derivado do cadastro do paciente — não há campo para digitar um nome.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-evidence`}>Onde a autorização está registrada</Label>
        <Input
          id={`${idPrefix}-evidence`}
          name="evidenceReference"
          required
          maxLength={300}
          placeholder={MEDIA_CONSENT_DOCUMENT.evidenceHint}
          defaultValue={values?.evidenceReference ?? ""}
          aria-invalid={fieldErrors.evidenceReference ? true : undefined}
        />
        {fieldErrors.evidenceReference ? (
          <p className="text-xs text-destructive">{fieldErrors.evidenceReference}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Guarde a referência do documento assinado. Este campo não substitui a autorização em si.
          </p>
        )}
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
        <Checkbox id={`${idPrefix}-ack`} name="acknowledged" />
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-ack`}>
            Confirmo que obtive esta autorização do paciente e que ela está arquivada.
          </Label>
          {fieldErrors.acknowledged ? <p className="text-xs text-destructive">{fieldErrors.acknowledged}</p> : null}
        </div>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Registrando..." : "Registrar consentimento"}
        </Button>
      </div>
    </form>
  );
}
