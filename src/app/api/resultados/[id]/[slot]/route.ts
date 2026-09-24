import { NextResponse } from "next/server";
import { readPublicResultImage } from "@/services/results";
import { resultSlotSchema } from "@/validators/results";
import { z } from "zod";

/**
 * Entrega PÚBLICA das fotos de antes/depois (prompt Fase 14 §32/§33).
 *
 * O bucket `before-after` é privado e continua privado. A elegibilidade é
 * decidida pelo BANCO (`public_result_image_path`: published + não arquivado +
 * consentimento válido); só depois disso o servidor lê o objeto e devolve os
 * bytes. O visitante nunca recebe URL assinada nem path de storage, então não
 * há link que continue funcionando depois de uma revogação.
 *
 * `Cache-Control: no-store` é deliberado: o requisito de revogação imediata
 * (§31) vale mais que o ganho de cache nestas imagens. Se a foto ficasse em
 * cache de CDN por minutos, um resultado revogado continuaria visível — o que
 * a fase proíbe.
 */

export const dynamic = "force-dynamic";

const idSchema = z.guid();

function notFound(): NextResponse {
  return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
}

export async function GET(_request: Request, context: RouteContext<"/api/resultados/[id]/[slot]">) {
  const { id, slot } = await context.params;

  const parsedId = idSchema.safeParse(id);
  const parsedSlot = resultSlotSchema.safeParse(slot);
  if (!parsedId.success || !parsedSlot.success) return notFound();

  const image = await readPublicResultImage(parsedId.data, parsedSlot.data);
  if (!image) return notFound();

  return new NextResponse(image.bytes, {
    status: 200,
    headers: {
      "Content-Type": image.contentType,
      "Content-Length": String(image.bytes.byteLength),
      "Cache-Control": "no-store",
      // A imagem não deve ser embutida em outro site nem interpretada como HTML.
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
