"use client";

import { useActionState, useId } from "react";
import { createResultAction, updateResultAction, type ResultFormState } from "@/actions/results";
import { PatientPicker } from "@/components/scheduling/patient-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DashboardResult } from "@/data/results";

const initialState: ResultFormState = {};

/**
 * Dados do resultado antes/depois (prompt Fase 14 §28/§36/§85).
 *
 * NÃO existe campo "nome a exibir": o nome público é derivado do nome real do
 * paciente no formato que ele autorizou no consentimento — a aplicação não
 * aceita um nome digitado, para não haver como inventar identidade (§91).
 */
export function ResultForm({ result }: { result: DashboardResult | null }) {
  const action = result ? updateResultAction.bind(null, result.id) : createResultAction;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const idPrefix = useId();
  const fieldErrors = state.fieldErrors ?? {};
  const values = state.values;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-title`}>Título</Label>
        <Input
          id={`${idPrefix}-title`}
          name="title"
          required
          maxLength={140}
          defaultValue={values?.title ?? result?.title ?? ""}
          aria-invalid={fieldErrors.title ? true : undefined}
        />
        {fieldErrors.title ? <p className="text-xs text-destructive">{fieldErrors.title}</p> : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-description`}>Descrição / depoimento</Label>
        <Textarea
          id={`${idPrefix}-description`}
          name="description"
          rows={5}
          maxLength={2000}
          defaultValue={values?.description ?? result?.description ?? ""}
        />
        <p className="text-xs text-muted-foreground">
          Se for depoimento do paciente, use as palavras dele. Nenhum texto é gerado nem sugerido pelo sistema.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-period`}>Período</Label>
          <Input
            id={`${idPrefix}-period`}
            name="period"
            maxLength={80}
            placeholder="Ex.: 6 meses de acompanhamento"
            defaultValue={values?.period ?? result?.period ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-sortOrder`}>Ordem de exibição</Label>
          <Input
            id={`${idPrefix}-sortOrder`}
            name="sortOrder"
            type="number"
            min={0}
            max={9999}
            defaultValue={values?.sortOrder ?? String(result?.sortOrder ?? 0)}
          />
          <p className="text-xs text-muted-foreground">Menor primeiro.</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-imageAlt`}>Texto alternativo das imagens</Label>
        <Input
          id={`${idPrefix}-imageAlt`}
          name="imageAlt"
          maxLength={180}
          defaultValue={values?.imageAlt ?? result?.imageAlt ?? ""}
          placeholder="Ex.: Evolução corporal ao longo do acompanhamento"
        />
        <p className="text-xs text-muted-foreground">
          Para leitores de tela. Descreva a imagem sem citar nome, medida, exame ou qualquer dado clínico.
        </p>
      </div>

      <div className="space-y-1.5">
        <PatientPicker
          autoOpen={false}
          initial={result?.patientId && result.patientName ? { id: result.patientId, name: result.patientName } : null}
          error={fieldErrors.patientId}
        />
        <p className="text-xs text-muted-foreground">
          Opcional, mas o consentimento de uso de imagem exige um paciente. Sem paciente, o resultado fica anônimo e
          não pode ser publicado.
        </p>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-sm text-primary">
          Resultado salvo.
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : result ? "Salvar resultado" : "Criar resultado"}
        </Button>
      </div>
    </form>
  );
}
