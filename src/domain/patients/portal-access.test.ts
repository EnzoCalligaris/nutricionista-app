import { describe, expect, it } from "vitest";
import { derivePortalAccess } from "@/domain/patients/portal-access";

describe("derivePortalAccess", () => {
  it("sem profile_id => Sem conta", () => {
    expect(derivePortalAccess({ profileId: null, authUser: null })).toBe("NO_ACCOUNT");
  });

  it("profile sem usuário Auth localizável => Não ativado", () => {
    expect(derivePortalAccess({ profileId: "p", authUser: null })).toBe("NOT_ACTIVATED");
  });

  it("convidado, sem confirmação nem login => Convite pendente", () => {
    expect(
      derivePortalAccess({
        profileId: "p",
        authUser: { invitedAt: "2026-09-01T00:00:00Z", lastSignInAt: null, emailConfirmedAt: null },
      }),
    ).toBe("INVITE_PENDING");
  });

  it("já entrou ao menos uma vez => Ativo", () => {
    expect(
      derivePortalAccess({
        profileId: "p",
        authUser: {
          invitedAt: "2026-09-01T00:00:00Z",
          lastSignInAt: "2026-09-02T00:00:00Z",
          emailConfirmedAt: "2026-09-02T00:00:00Z",
        },
      }),
    ).toBe("ACTIVE");
  });

  it("confirmado mas nunca entrou (ex.: usuário criado por seed) => Não ativado", () => {
    expect(
      derivePortalAccess({
        profileId: "p",
        authUser: { invitedAt: null, lastSignInAt: null, emailConfirmedAt: "2026-09-02T00:00:00Z" },
      }),
    ).toBe("NOT_ACTIVATED");
  });
});
