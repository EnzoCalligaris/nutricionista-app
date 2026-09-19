"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { UNIT_OPTIONS } from "@/domain/meal-plans/definitions";
import type { MealItemFormInput, SubstitutionFormInput } from "@/actions/meal-plans";

/**
 * Formulários inline do editor (prompt Fase 8 §50–§52): salvar explícito,
 * erros por campo vindos do servidor, sem autosave.
 */

type FieldErrors = Record<string, string>;

function FieldError({ errors, name }: { errors: FieldErrors; name: string }) {
  return errors[name] ? <p className="text-xs text-destructive">{errors[name]}</p> : null;
}

export type MealFormValues = { name: string; timeOfDay: string; notes: string };

export function MealForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
  pending,
  errors,
}: {
  initial: MealFormValues;
  onSubmit: (values: MealFormValues) => void;
  onCancel: () => void;
  submitLabel: string;
  pending: boolean;
  errors: FieldErrors;
}) {
  const idPrefix = useId();
  const [values, setValues] = useState(initial);
  const set = (key: keyof MealFormValues) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues((prev) => ({ ...prev, [key]: event.target.value }));

  return (
    <form
      className="space-y-3 rounded-lg border border-border bg-muted/30 p-3"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(values);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-name`}>Nome da refeição</Label>
          <Input id={`${idPrefix}-name`} value={values.name} onChange={set("name")} placeholder="Ex.: Café da manhã" maxLength={80} required aria-invalid={errors.name ? true : undefined} />
          <FieldError errors={errors} name="name" />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-time`}>Horário (opcional)</Label>
          <Input id={`${idPrefix}-time`} type="time" value={values.timeOfDay} onChange={set("timeOfDay")} aria-invalid={errors.timeOfDay ? true : undefined} />
          <FieldError errors={errors} name="timeOfDay" />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-notes`}>Observação da refeição (opcional)</Label>
        <Textarea id={`${idPrefix}-notes`} rows={2} maxLength={1000} value={values.notes} onChange={set("notes")} />
        <FieldError errors={errors} name="notes" />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Salvando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export const EMPTY_ITEM: MealItemFormInput = { foodName: "", quantity: "", unit: "g", calories: "", proteinG: "", carbsG: "", fatG: "", fiberG: "", instructions: "", notes: "" };

function UnitSelect({ id, value, onChange, allowEmpty = false, invalid }: { id: string; value: string; onChange: (value: string) => void; allowEmpty?: boolean; invalid?: boolean }) {
  return (
    <NativeSelect id={id} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={invalid ? true : undefined}>
      {allowEmpty ? <option value="">—</option> : null}
      {UNIT_OPTIONS.map((unit) => (
        <option key={unit.value} value={unit.value}>
          {unit.value}
        </option>
      ))}
    </NativeSelect>
  );
}

function NutrientFields({
  idPrefix,
  values,
  onChange,
  errors,
  withFiber,
}: {
  idPrefix: string;
  values: { calories: string; proteinG: string; carbsG: string; fatG: string; fiberG?: string };
  onChange: (key: "calories" | "proteinG" | "carbsG" | "fatG" | "fiberG", value: string) => void;
  errors: FieldErrors;
  withFiber: boolean;
}) {
  const fields: { key: "calories" | "proteinG" | "carbsG" | "fatG" | "fiberG"; label: string }[] = [
    { key: "calories", label: "kcal" },
    { key: "proteinG", label: "Proteína (g)" },
    { key: "carbsG", label: "Carboidrato (g)" },
    { key: "fatG", label: "Gordura (g)" },
    ...(withFiber ? [{ key: "fiberG" as const, label: "Fibra (g)" }] : []),
  ];
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">Valores nutricionais (opcionais, informados manualmente — nada é calculado).</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {fields.map((field) => (
          <div key={field.key} className="space-y-1">
            <Label htmlFor={`${idPrefix}-${field.key}`} className="text-xs">
              {field.label}
            </Label>
            <Input id={`${idPrefix}-${field.key}`} inputMode="decimal" value={values[field.key] ?? ""} onChange={(event) => onChange(field.key, event.target.value)} aria-invalid={errors[field.key] ? true : undefined} />
            <FieldError errors={errors} name={field.key} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ItemForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
  pending,
  errors,
}: {
  initial: MealItemFormInput;
  onSubmit: (values: MealItemFormInput) => void;
  onCancel: () => void;
  submitLabel: string;
  pending: boolean;
  errors: FieldErrors;
}) {
  const idPrefix = useId();
  const [values, setValues] = useState(initial);
  const [more, setMore] = useState(Boolean(initial.calories || initial.proteinG || initial.carbsG || initial.fatG || initial.fiberG || initial.instructions));
  const set = (key: keyof MealItemFormInput, value: string) => setValues((prev) => ({ ...prev, [key]: value }));

  return (
    <form
      className="space-y-3 rounded-lg border border-border bg-muted/30 p-3"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(values);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_110px_150px]">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-food`}>Alimento</Label>
          <Input id={`${idPrefix}-food`} value={values.foodName} onChange={(event) => set("foodName", event.target.value)} placeholder="Ex.: Arroz integral" maxLength={120} required aria-invalid={errors.foodName ? true : undefined} />
          <FieldError errors={errors} name="foodName" />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-qty`}>Quantidade</Label>
          <Input id={`${idPrefix}-qty`} inputMode="decimal" value={values.quantity} onChange={(event) => set("quantity", event.target.value)} placeholder="100" required aria-invalid={errors.quantity ? true : undefined} />
          <FieldError errors={errors} name="quantity" />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-unit`}>Unidade</Label>
          <UnitSelect id={`${idPrefix}-unit`} value={values.unit} onChange={(value) => set("unit", value)} invalid={Boolean(errors.unit)} />
          <FieldError errors={errors} name="unit" />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-notes`}>Observação (opcional)</Label>
        <Input id={`${idPrefix}-notes`} value={values.notes} onChange={(event) => set("notes", event.target.value)} maxLength={1000} placeholder="Ex.: sem sal, preferir integral" />
        <FieldError errors={errors} name="notes" />
      </div>
      <button type="button" className="text-xs font-medium text-primary underline underline-offset-4" onClick={() => setMore((value) => !value)} aria-expanded={more}>
        {more ? "Ocultar preparo e valores nutricionais" : "Preparo e valores nutricionais (opcional)"}
      </button>
      {more ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-instructions`}>Método de preparo (opcional)</Label>
            <Textarea id={`${idPrefix}-instructions`} rows={2} maxLength={1000} value={values.instructions} onChange={(event) => set("instructions", event.target.value)} />
            <FieldError errors={errors} name="instructions" />
          </div>
          <NutrientFields idPrefix={idPrefix} values={values} onChange={(key, value) => set(key, value)} errors={errors} withFiber />
        </div>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Salvando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export const EMPTY_SUBSTITUTION: SubstitutionFormInput = { substituteFoodName: "", quantity: "", unit: "", calories: "", proteinG: "", carbsG: "", fatG: "", notes: "" };

export function SubstitutionForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
  pending,
  errors,
}: {
  initial: SubstitutionFormInput;
  onSubmit: (values: SubstitutionFormInput) => void;
  onCancel: () => void;
  submitLabel: string;
  pending: boolean;
  errors: FieldErrors;
}) {
  const idPrefix = useId();
  const [values, setValues] = useState(initial);
  const [more, setMore] = useState(Boolean(initial.calories || initial.proteinG || initial.carbsG || initial.fatG));
  const set = (key: keyof SubstitutionFormInput, value: string) => setValues((prev) => ({ ...prev, [key]: value }));

  return (
    <form
      className="space-y-3 rounded-lg border border-dashed border-border bg-background p-3"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(values);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_110px_150px]">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-food`}>Alimento substituto</Label>
          <Input id={`${idPrefix}-food`} value={values.substituteFoodName} onChange={(event) => set("substituteFoodName", event.target.value)} placeholder="Ex.: Batata doce" maxLength={120} required aria-invalid={errors.substituteFoodName ? true : undefined} />
          <FieldError errors={errors} name="substituteFoodName" />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-qty`}>Quantidade</Label>
          <Input id={`${idPrefix}-qty`} inputMode="decimal" value={values.quantity} onChange={(event) => set("quantity", event.target.value)} placeholder="opcional" aria-invalid={errors.quantity ? true : undefined} />
          <FieldError errors={errors} name="quantity" />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-unit`}>Unidade</Label>
          <UnitSelect id={`${idPrefix}-unit`} value={values.unit} onChange={(value) => set("unit", value)} allowEmpty invalid={Boolean(errors.unit)} />
          <FieldError errors={errors} name="unit" />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-notes`}>Observação (opcional)</Label>
        <Input id={`${idPrefix}-notes`} value={values.notes} onChange={(event) => set("notes", event.target.value)} maxLength={500} />
        <FieldError errors={errors} name="notes" />
      </div>
      <button type="button" className="text-xs font-medium text-primary underline underline-offset-4" onClick={() => setMore((value) => !value)} aria-expanded={more}>
        {more ? "Ocultar valores nutricionais" : "Valores nutricionais (opcional)"}
      </button>
      {more ? <NutrientFields idPrefix={idPrefix} values={values} onChange={(key, value) => set(key as keyof SubstitutionFormInput, value)} errors={errors} withFiber={false} /> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Salvando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
