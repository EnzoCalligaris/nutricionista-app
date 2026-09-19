import { NextResponse } from "next/server";
import { requireNutritionist } from "@/lib/auth/session";
import { getPatientById } from "@/data/patients";
import { signReportForNutritionist } from "@/services/assessments";
import { patientIdSchema } from "@/validators/patients";
import { assessmentIdSchema } from "@/validators/assessments";
import { isDomainError } from "@/lib/errors/domain";

export const dynamic = "force-dynamic";

/**
 * Download do relatório pelo nutricionista (prompt Fase 9 §21/§62):
 * ownership no servidor → URL assinada de 60 s → redirect. Nada é cacheado
 * nem persistido; a URL nunca vai para log ou banco.
 */
export async function GET(_request: Request, context: RouteContext<"/dashboard/pacientes/[id]/avaliacoes/[assessmentId]/relatorio">) {
  const nutritionist = await requireNutritionist();
  const { id, assessmentId } = await context.params;
  const patientId = patientIdSchema.safeParse(id);
  const parsedAssessment = assessmentIdSchema.safeParse(assessmentId);
  if (!patientId.success || !parsedAssessment.success) return new NextResponse("Não encontrado", { status: 404 });
  const patient = await getPatientById(nutritionist.id, patientId.data);
  if (!patient) return new NextResponse("Não encontrado", { status: 404 });
  try {
    const signed = await signReportForNutritionist(nutritionist.id, parsedAssessment.data);
    return NextResponse.redirect(signed.url, { status: 302, headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    return new NextResponse(isDomainError(error) ? error.message : "Não encontrado", { status: 404, headers: { "Cache-Control": "no-store, private" } });
  }
}
