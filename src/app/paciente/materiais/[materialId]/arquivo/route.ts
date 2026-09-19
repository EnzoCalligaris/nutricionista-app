import { NextResponse } from "next/server";
import { requirePatient } from "@/lib/auth/session";
import { getPatientBookingContext } from "@/services/scheduling";
import { signMaterialForPatient } from "@/services/materials";
import { materialIdSchema } from "@/validators/patient-content";

export const dynamic = "force-dynamic";

/**
 * Download do material pelo paciente (prompt Fase 10 §46–§47): patient_id
 * vem da sessão (nunca da URL); o material precisa estar atribuído a ele,
 * não revogado e não arquivado; URL assinada de 60 s; sem cache; nunca
 * persistida nem logada. O bucket privado nunca é exposto diretamente.
 */
export async function GET(_request: Request, context: RouteContext<"/paciente/materiais/[materialId]/arquivo">) {
  const profile = await requirePatient();
  const { materialId } = await context.params;
  const parsed = materialIdSchema.safeParse(materialId);
  const patientContext = await getPatientBookingContext(profile.id);
  if (!parsed.success || !patientContext) return new NextResponse("Não encontrado", { status: 404 });
  try {
    const signed = await signMaterialForPatient(patientContext.patientId, parsed.data);
    return NextResponse.redirect(signed.url, { status: 302, headers: { "Cache-Control": "no-store, private" } });
  } catch {
    return new NextResponse("Não encontrado", { status: 404, headers: { "Cache-Control": "no-store, private" } });
  }
}
