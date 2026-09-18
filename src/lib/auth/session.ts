import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Helpers centralizados de autenticação/autorização (prompt Fase 3 §4) —
 * toda página/layout protegido chama um destes em vez de reimplementar
 * `getUser`/checagem de role localmente.
 *
 * `cache()` do React deduplica chamadas dentro de uma ÚNICA renderização de
 * Server Components (útil quando layout + página chamam o mesmo helper) —
 * não é um cache entre requisições nem entre usuários diferentes: cada
 * requisição cria seu próprio cliente Supabase a partir dos cookies daquela
 * requisição, então não há risco de vazar sessão de um usuário para outro
 * (prompt Fase 3 §37).
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !data) return null;
  return data;
});

/** Exige usuário autenticado (qualquer role). Redireciona para /login. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Exige profile existente para o usuário autenticado. Redireciona para /login. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

/**
 * Exige role NUTRITIONIST. Um PATIENT autenticado é mandado para a própria
 * área (/paciente) em vez de um erro genérico — evita um 403 confuso para
 * quem só está na rota errada (prompt Fase 3 §5).
 */
export async function requireNutritionist(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "NUTRITIONIST") {
    redirect(profile.role === "PATIENT" ? "/paciente" : "/login");
  }
  return profile;
}

/** Exige role PATIENT. Um NUTRITIONIST autenticado é mandado para /dashboard. */
export async function requirePatient(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "PATIENT") {
    redirect(profile.role === "NUTRITIONIST" ? "/dashboard" : "/login");
  }
  return profile;
}
