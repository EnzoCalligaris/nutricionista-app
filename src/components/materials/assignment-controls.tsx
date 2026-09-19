"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { assignMaterialAction, unassignMaterialAction } from "@/actions/materials";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { PatientPicker } from "@/components/scheduling/patient-picker";
import type { PatientSearchResult } from "@/data/appointments";

/**
 * Atribuir material a um paciente a partir da página do material (prompt
 * Fase 10 §41): autocomplete server-side de pacientes (nunca a lista
 * inteira no browser). Toast só após o servidor.
 */
export function AssignToPatientForm({ materialId }: { materialId: string }) {
  const router = useRouter();
  const [patient, setPatient] = useState<PatientSearchResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function assign() {
    if (!patient) return;
    startTransition(async () => {
      const result = await assignMaterialAction(materialId, patient.id);
      if (result.ok) {
        toast.success(`Material atribuído a ${patient.fullName}.`);
        setPatient(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      <PatientPicker key={patient ? "selected" : "empty"} autoOpen={false} onSelect={setPatient} />
      <Button size="sm" disabled={!patient || isPending} onClick={assign}>
        <Send data-icon="inline-start" />
        {isPending ? "Atribuindo..." : "Atribuir material"}
      </Button>
    </div>
  );
}

/**
 * Atribuir material a partir do perfil do paciente (§42): seletor da
 * biblioteca do nutricionista (só materiais ativos e completos, já
 * atribuídos excluídos). O paciente vem da rota.
 */
export function AssignFromLibraryForm({ patientId, options }: { patientId: string; options: { id: string; title: string; typeLabel: string }[] }) {
  const router = useRouter();
  const id = useId();
  const [materialId, setMaterialId] = useState("");
  const [isPending, startTransition] = useTransition();

  function assign() {
    if (!materialId) return;
    const chosen = options.find((option) => option.id === materialId);
    startTransition(async () => {
      const result = await assignMaterialAction(materialId, patientId);
      if (result.ok) {
        toast.success(`Material atribuído${chosen ? `: ${chosen.title}` : "."}`);
        setMaterialId("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground">Todos os materiais ativos da biblioteca já estão atribuídos a este paciente, ou a biblioteca está vazia.</p>;
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1 space-y-1">
        <Label htmlFor={`${id}-material`}>Material da biblioteca</Label>
        <NativeSelect id={`${id}-material`} value={materialId} onChange={(event) => setMaterialId(event.target.value)} disabled={isPending}>
          <option value="">Selecione um material...</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.title} ({option.typeLabel})
            </option>
          ))}
        </NativeSelect>
      </div>
      <Button size="sm" disabled={!materialId || isPending} onClick={assign}>
        <Send data-icon="inline-start" />
        {isPending ? "Atribuindo..." : "Atribuir"}
      </Button>
    </div>
  );
}

/** Remover atribuição (§43): confirmação; o material global permanece, o paciente perde o acesso. */
export function UnassignButton({ assignmentId, materialTitle, patientName, size = "sm" }: { assignmentId: string; materialTitle: string; patientName: string; size?: "sm" | "xs" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function unassign() {
    startTransition(async () => {
      const result = await unassignMaterialAction(assignmentId);
      if (result.ok) {
        toast.success("Atribuição removida.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setOpen(false);
    });
  }

  return (
    <>
      <Button size={size} variant="ghost" disabled={isPending} onClick={() => setOpen(true)} aria-label={`Remover atribuição de ${materialTitle} para ${patientName}`}>
        <UserMinus data-icon="inline-start" />
        Remover
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => !next && !isPending && setOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover o acesso de {patientName}?</AlertDialogTitle>
            <AlertDialogDescription>&ldquo;{materialTitle}&rdquo; deixa de aparecer no portal deste paciente. O material continua na biblioteca e pode ser atribuído de novo.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                unassign();
              }}
            >
              Remover acesso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
