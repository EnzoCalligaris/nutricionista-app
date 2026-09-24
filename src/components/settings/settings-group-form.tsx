"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { saveSettingsGroupAction, type SettingsFormState } from "@/actions/site-settings";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SettingDefinition, SettingGroupId } from "@/domain/site-settings/registry";

const initialState: SettingsFormState = {};

export type SettingFieldValue = { value: string; checked: boolean };

/**
 * Formulário de um GRUPO de configurações, montado a partir do registry
 * (prompt Fase 14 §59: seções, não uma página com 100 campos).
 *
 * - salva explicitamente, sem autosave (§60);
 * - o aviso de "alterações não salvas" é o do próprio navegador, ligado só
 *   quando o formulário está sujo (§61 — sem complexidade extra);
 * - a confirmação só aparece depois da resposta do servidor (§62).
 */
export function SettingsGroupForm({
  group,
  definitions,
  values,
  description,
  submitLabel = "Salvar",
}: {
  group: SettingGroupId;
  definitions: SettingDefinition[];
  values: Record<string, SettingFieldValue>;
  description?: string;
  submitLabel?: string;
}) {
  const action = saveSettingsGroupAction.bind(null, group);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const idPrefix = useId();
  const fieldErrors = state.fieldErrors ?? {};
  // Ref (não state): o aviso de saída não precisa re-renderizar nada, e
  // assim o formulário não pisca a cada tecla digitada.
  const dirtyRef = useRef(false);

  // Avisa ao sair da página com alteração não salva (§61).
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  useEffect(() => {
    if (state.ok) dirtyRef.current = false;
  }, [state.ok, state.savedAt]);

  return (
    <form
      action={formAction}
      onChange={() => {
        dirtyRef.current = true;
      }}
      className="space-y-6"
      noValidate
    >
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}

      <div className="grid gap-5 lg:grid-cols-2">
        {definitions.map((definition) => {
          const fieldId = `${idPrefix}-${definition.key}`;
          const hintId = `${fieldId}-hint`;
          const error = fieldErrors[definition.key];
          const current = values[definition.key] ?? { value: "", checked: false };
          const wide = definition.kind === "multiline" || definition.kind === "list";

          if (definition.kind === "boolean") {
            return (
              <div key={definition.key} className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3 lg:col-span-2">
                <Checkbox id={fieldId} name={definition.key} defaultChecked={current.checked} />
                <div className="space-y-1">
                  <Label htmlFor={fieldId}>{definition.label}</Label>
                  {definition.help ? <p className="text-xs text-muted-foreground">{definition.help}</p> : null}
                  {error ? <p className="text-xs text-destructive">{error}</p> : null}
                </div>
              </div>
            );
          }

          return (
            <div key={definition.key} className={`space-y-1.5 ${wide ? "lg:col-span-2" : ""}`}>
              <Label htmlFor={fieldId}>{definition.label}</Label>
              {wide ? (
                <Textarea
                  id={fieldId}
                  name={definition.key}
                  rows={definition.kind === "list" ? 5 : 4}
                  maxLength={definition.maxLength}
                  defaultValue={current.value}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={hintId}
                />
              ) : (
                <Input
                  id={fieldId}
                  name={definition.key}
                  type={definition.kind === "email" ? "email" : definition.kind === "integer" ? "number" : "text"}
                  inputMode={definition.kind === "phone" ? "tel" : undefined}
                  maxLength={definition.kind === "integer" ? undefined : definition.maxLength}
                  min={definition.kind === "integer" ? 0 : undefined}
                  max={definition.kind === "integer" ? 80 : undefined}
                  placeholder={definition.placeholder}
                  defaultValue={current.value}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={hintId}
                />
              )}
              {error ? (
                <p className="text-xs text-destructive">{error}</p>
              ) : definition.help ? (
                <p id={hintId} className="text-xs text-muted-foreground">
                  {definition.help}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Campo em branco apaga a configuração — o site volta a não exibir essa informação.
      </p>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-sm text-primary">
          Configurações salvas. O site público já reflete a mudança.
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
