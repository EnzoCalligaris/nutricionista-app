import { NextResponse } from "next/server";
import { requireNutritionist } from "@/lib/auth/session";
import { signMealPhotoForNutritionist } from "@/services/food-analysis/service";
import { analysisIdSchema } from "@/validators/food-analysis";
import { patientIdSchema } from "@/validators/patients";

export const dynamic = "force-dynamic";

/** Foto da refeição para o nutricionista: ownership do paciente da rota → URL assinada de 60 s → redirect sem cache. */
export async function GET(_request: Request, context: RouteContext<"/dashboard/pacientes/[id]/refeicoes/[analysisId]/foto">) {
  const nutritionist = await requireNutritionist();
  const { id, analysisId } = await context.params;
  const patient = patientIdSchema.safeParse(id);
  const analysis = analysisIdSchema.safeParse(analysisId);
  if (!patient.success || !analysis.success) return new NextResponse("Não encontrado", { status: 404 });
  try {
    const url = await signMealPhotoForNutritionist(nutritionist.id, patient.data, analysis.data);
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store, private" } });
  } catch {
    return new NextResponse("Não encontrado", { status: 404, headers: { "Cache-Control": "no-store, private" } });
  }
}
