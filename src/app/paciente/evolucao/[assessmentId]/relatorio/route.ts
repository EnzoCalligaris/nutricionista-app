import { NextResponse } from "next/server";
import { requirePatient } from "@/lib/auth/session";
import { getPatientBookingContext } from "@/services/scheduling";
import { signReportForPatient } from "@/services/assessments";
import { assessmentIdSchema } from "@/validators/assessments";

export const dynamic = "force-dynamic";

/**
 * Download do relatório pelo paciente (prompt Fase 9 §21): patient_id vem
 * da sessão (nunca da URL), a avaliação precisa ser própria, visível e não
 * arquivada; URL assinada de 60 s; sem cache.
 */
export async function GET(_request: Request, context: RouteContext<"/paciente/evolucao/[assessmentId]/relatorio">) {
  const profile = await requirePatient();
  const { assessmentId } = await context.params;
  const parsed = assessmentIdSchema.safeParse(assessmentId);
  const patientContext = await getPatientBookingContext(profile.id);
  if (!parsed.success || !patientContext) return new NextResponse("Não encontrado", { status: 404 });
  try {
    const signed = await signReportForPatient(patientContext.patientId, parsed.data);
    return NextResponse.redirect(signed.url, { status: 302, headers: { "Cache-Control": "no-store, private" } });
  } catch {
    return new NextResponse("Não encontrado", { status: 404, headers: { "Cache-Control": "no-store, private" } });
  }
}
