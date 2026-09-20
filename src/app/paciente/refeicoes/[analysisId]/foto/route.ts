import { NextResponse } from "next/server";
import { requirePatient } from "@/lib/auth/session";
import { getPatientBookingContext } from "@/services/scheduling";
import { signMealPhotoForPatient } from "@/services/food-analysis/service";
import { analysisIdSchema } from "@/validators/food-analysis";

export const dynamic = "force-dynamic";

/**
 * Foto da refeição para o paciente (prompt Fase 11 §17–§18): patient_id da
 * sessão, refeição própria e não arquivada → URL assinada de 60 s →
 * redirect sem cache. A URL nunca é persistida nem logada.
 */
export async function GET(_request: Request, context: RouteContext<"/paciente/refeicoes/[analysisId]/foto">) {
  const profile = await requirePatient();
  const { analysisId } = await context.params;
  const parsed = analysisIdSchema.safeParse(analysisId);
  const patientContext = await getPatientBookingContext(profile.id);
  if (!parsed.success || !patientContext) return new NextResponse("Não encontrado", { status: 404 });
  try {
    const url = await signMealPhotoForPatient({ profileId: profile.id, patientId: patientContext.patientId }, parsed.data);
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store, private" } });
  } catch {
    return new NextResponse("Não encontrado", { status: 404, headers: { "Cache-Control": "no-store, private" } });
  }
}
