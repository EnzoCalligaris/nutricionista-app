import "server-only";

export type QueryResult<T> =
  | { ok: true; data: T }
  | { ok: false; data: T; error: string };

/**
 * Executa uma query pública com fallback (prompt Fase 4 §42): o site
 * institucional não pode cair inteiro porque o Supabase local está fora do
 * ar durante o desenvolvimento — mas o erro NÃO é escondido: vai para o log
 * do servidor (sem dados sensíveis, é conteúdo público) e a UI recebe
 * `ok: false` para mostrar um estado honesto ("conteúdo indisponível") em
 * vez de fingir que não existe nada.
 */
export async function safeQuery<T>(label: string, fallback: T, run: () => Promise<T>): Promise<QueryResult<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[public-content] ${label} falhou: ${message}`);
    return { ok: false, data: fallback, error: message };
  }
}
