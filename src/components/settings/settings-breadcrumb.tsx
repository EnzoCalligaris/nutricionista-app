import Link from "next/link";

/** Migalha comum das seções de configuração (prompt Fase 14 §1). */
export function SettingsBreadcrumb({ current }: { current: string }) {
  return (
    <p className="text-xs text-muted-foreground">
      <Link href="/dashboard/configuracoes" className="hover:underline">
        Configurações
      </Link>{" "}
      / {current}
    </p>
  );
}
