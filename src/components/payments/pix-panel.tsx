"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Painel do Pix (prompt Fase 13 §10–§11/§131): QR gerado no servidor a
 * partir do payload do provedor e o mesmo código em texto ("Pix copia e
 * cola") como alternativa acessível — quem não consegue ler o QR copia o
 * código. Nada aqui é persistido além do que o provedor devolveu.
 */
export function PixPanel({ qrSvg, payload, simulated }: { qrSvg: string; payload: string; simulated: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      toast.success("Código Pix copiado.");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Não foi possível copiar. Selecione o código e copie manualmente.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-full max-w-[220px] rounded-lg border border-border bg-white p-3 [&>svg]:h-auto [&>svg]:w-full"
          // QR gerado no servidor (SVG) a partir do payload — sem script, sem imagem externa.
          dangerouslySetInnerHTML={{ __html: qrSvg }}
          role="img"
          aria-label={simulated ? "QR Code de demonstração — não é uma cobrança real" : "QR Code do Pix. Se preferir, use o código Pix copia e cola abaixo."}
        />
        <p className="text-center text-xs text-muted-foreground">
          {simulated ? "QR de demonstração: nenhum aplicativo de banco reconhece este código." : "Abra o app do seu banco, escolha Pix, e escaneie o QR Code."}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium" id="pix-copia-cola">
          Pix copia e cola
        </p>
        <p className="max-h-24 overflow-y-auto rounded-lg bg-muted/60 p-3 font-mono text-xs break-all" aria-labelledby="pix-copia-cola" data-testid="pix-payload">
          {payload}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={copy} data-testid="copy-pix">
          {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
          {copied ? "Código copiado" : "Copiar código Pix"}
        </Button>
      </div>
    </div>
  );
}
