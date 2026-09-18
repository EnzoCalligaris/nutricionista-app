import { describe, expect, it } from "vitest";
import { hasAnyContactChannel, resolveContactInfo, whatsappHref } from "@/domain/site-settings/contact";

describe("resolveContactInfo", () => {
  it("retorna vazio quando nada está configurado (estado atual do projeto)", () => {
    const info = resolveContactInfo({});
    expect(info).toEqual({});
    expect(hasAnyContactChannel(info)).toBe(false);
  });

  it("só aceita strings não vazias", () => {
    const info = resolveContactInfo({
      "contact.phone": "   ",
      "contact.email": 42,
      "contact.whatsapp": "+55 11 90000-0000",
    });
    expect(info.phone).toBeUndefined();
    expect(info.email).toBeUndefined();
    expect(info.whatsapp).toBe("+55 11 90000-0000");
    expect(hasAnyContactChannel(info)).toBe(true);
  });

  it("CRN sozinho não conta como canal de contato", () => {
    expect(hasAnyContactChannel(resolveContactInfo({ "professional.crn": "12345" }))).toBe(false);
  });
});

describe("whatsappHref", () => {
  it("gera link wa.me só com dígitos", () => {
    expect(whatsappHref("+55 (11) 90000-0000")).toBe("https://wa.me/5511900000000");
  });
});
