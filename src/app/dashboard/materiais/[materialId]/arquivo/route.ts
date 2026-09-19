import { NextResponse } from "next/server";
import { requireNutritionist } from "@/lib/auth/session";
import { signMaterialForNutritionist } from "@/services/materials";
import { materialIdSchema } from "@/validators/patient-content";

export const dynamic = "force-dynamic";

/**
 * Download do arquivo pelo nutricionista (prompt Fase 10 §46–§47): ownership
 * no servidor → URL assinada de 60 s → redirect sem cache. A URL nunca é
 * persistida nem logada.
 */
export async function GET(_request: Request, context: RouteContext<"/dashboard/materiais/[materialId]/arquivo">) {
  const nutritionist = await requireNutritionist();
  const { materialId } = await context.params;
  const parsed = materialIdSchema.safeParse(materialId);
  if (!parsed.success) return new NextResponse("Não encontrado", { status: 404 });
  try {
    const signed = await signMaterialForNutritionist(nutritionist.id, parsed.data);
    return NextResponse.redirect(signed.url, { status: 302, headers: { "Cache-Control": "no-store, private" } });
  } catch {
    return new NextResponse("Não encontrado", { status: 404, headers: { "Cache-Control": "no-store, private" } });
  }
}
