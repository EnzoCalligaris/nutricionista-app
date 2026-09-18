import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import type { Database } from "@/types/database";

// Decisão técnica (prompt Fase 3 §8, docs/DECISIONS.md): a partir do
// Next.js 16, `middleware.ts` está DEPRECIADO em favor de `proxy.ts` — o
// próprio pacote instalado (node_modules/next/dist/docs/.../proxy.md)
// documenta a troca ("Middleware is deprecated and renamed to Proxy" desde
// a v16.0.0) e expõe um codemod oficial
// (`npx @next/codemod@canary middleware-to-proxy`). Usamos a convenção nova
// diretamente em vez de escrever `middleware.ts` e migrar depois.
//
// Este proxy é a PRIMEIRA camada de proteção de rota, não a única (prompt
// Fase 3 §7): ele redireciona cedo por UX e para evitar round-trips
// desnecessários, mas cada layout de /dashboard e /paciente também chama
// `requireNutritionist()`/`requirePatient()` (src/lib/auth/session.ts), e a
// RLS do banco é a camada final que realmente impede acesso a dado alheio
// mesmo que as camadas de aplicação falhem.

const DASHBOARD_PREFIX = "/dashboard";
const PATIENT_PREFIX = "/paciente";
const LOGIN_PATH = "/login";

function redirectPreservingCookies(url: URL, base: NextResponse): NextResponse {
  const redirectResponse = NextResponse.redirect(url);
  for (const cookie of base.cookies.getAll()) {
    redirectResponse.cookies.set(cookie);
  }
  return redirectResponse;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let response = NextResponse.next({ request });

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    // Supabase não configurado (ex.: ambiente sem env ainda) — não bloqueia
    // a navegação aqui; os helpers server-side em cada layout continuam
    // como segunda camada e vão barrar o acesso de qualquer forma.
    return response;
  }

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Sempre `getUser()`, nunca `getSession()` aqui: `getUser()` valida o
  // token contra o servidor Auth a cada chamada, `getSession()` só lê o
  // cookie local (poderia aceitar um token adulterado/expirado sem notar).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isDashboardRoute = pathname === DASHBOARD_PREFIX || pathname.startsWith(`${DASHBOARD_PREFIX}/`);
  const isPatientRoute = pathname === PATIENT_PREFIX || pathname.startsWith(`${PATIENT_PREFIX}/`);

  if (!user) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return redirectPreservingCookies(loginUrl, response);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role;

  if (isDashboardRoute && role !== "NUTRITIONIST") {
    const target = role === "PATIENT" ? PATIENT_PREFIX : LOGIN_PATH;
    return redirectPreservingCookies(new URL(target, request.url), response);
  }

  if (isPatientRoute && role !== "PATIENT") {
    const target = role === "NUTRITIONIST" ? DASHBOARD_PREFIX : LOGIN_PATH;
    return redirectPreservingCookies(new URL(target, request.url), response);
  }

  return response;
}

// Sem matcher, o Proxy roda em TODA requisição (assets estáticos
// inclusive) — restringimos explicitamente a /dashboard e /paciente, que é
// tudo que precisa de autenticação nesta fase (site público não tem auth).
export const config = {
  matcher: ["/dashboard", "/dashboard/:path*", "/paciente", "/paciente/:path*"],
};
