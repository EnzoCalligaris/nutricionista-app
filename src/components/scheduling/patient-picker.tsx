"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Check, Search, X } from "lucide-react";
import { searchPatientsAction } from "@/actions/scheduling";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { PatientSearchResult } from "@/data/appointments";

type Props = {
  initial?: { id: string; name: string } | null;
  error?: string;
  onSelect?: (patient: PatientSearchResult | null) => void;
};

/**
 * Autocomplete de paciente (prompt Fase 6 §20): busca server-side entre os
 * pacientes do nutricionista autenticado (≤ 10 por consulta), nunca a lista
 * inteira no browser. Envia `patientId` (e `patientName` para repopular).
 */
export function PatientPicker({ initial = null, error, onSelect }: Props) {
  const idPrefix = useId();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<PatientSearchResult[]>([]);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(initial);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (selected) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      startTransition(async () => {
        const found = await searchPatientsAction(term);
        setResults(found);
        setOpen(true);
      });
    }, 200);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [term, selected]);

  function choose(patient: PatientSearchResult) {
    setSelected({ id: patient.id, name: patient.fullName });
    setOpen(false);
    setTerm("");
    onSelect?.(patient);
  }

  function clear() {
    setSelected(null);
    setResults([]);
    onSelect?.(null);
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`${idPrefix}-search`}>Paciente</Label>
      <input type="hidden" name="patientId" value={selected?.id ?? ""} />
      <input type="hidden" name="patientName" value={selected?.name ?? ""} />

      {selected ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
          <span className="flex items-center gap-2">
            <Check className="size-4 text-success" aria-hidden="true" />
            <span className="font-medium">{selected.name}</span>
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={clear} aria-label="Trocar paciente">
            <X data-icon="inline-start" />
            Trocar
          </Button>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id={`${idPrefix}-search`}
            type="search"
            autoComplete="off"
            placeholder="Buscar paciente pelo nome..."
            className="pl-8"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            onFocus={() => setOpen(true)}
            role="combobox"
            aria-expanded={open}
            aria-controls={`${idPrefix}-listbox`}
            aria-autocomplete="list"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${idPrefix}-error` : undefined}
          />
          {open ? (
            <ul
              id={`${idPrefix}-listbox`}
              role="listbox"
              aria-label="Pacientes encontrados"
              className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-popover p-1 shadow-md"
            >
              {isPending && results.length === 0 ? (
                <li className="px-2 py-1.5 text-sm text-muted-foreground">Buscando...</li>
              ) : results.length === 0 ? (
                <li className="px-2 py-1.5 text-sm text-muted-foreground">Nenhum paciente ativo encontrado.</li>
              ) : (
                results.map((patient) => (
                  <li key={patient.id} role="option" aria-selected={false}>
                    <button
                      type="button"
                      onClick={() => choose(patient)}
                      className={cn(
                        "flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
                      )}
                    >
                      <span className="font-medium">{patient.fullName}</span>
                      {patient.email ? <span className="text-xs text-muted-foreground">{patient.email}</span> : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
      )}
      {error ? (
        <p id={`${idPrefix}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
