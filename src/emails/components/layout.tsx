import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";

/**
 * Layout base dos e-mails transacionais (prompt Fase 12 §32–§36): simples,
 * responsivo, identidade Método EM (azul-petróleo escuro sobre off-white,
 * monograma "EM"), sem marketing, sem conteúdo clínico. Todo link absoluto
 * nasce de `siteUrl` (NEXT_PUBLIC_SITE_URL) — nunca localhost hardcoded.
 * Tipografia: fontes de sistema (e-mail não carrega fonte custom com
 * confiabilidade).
 */

export const EMAIL_COLORS = {
  paper: "#faf9f6",
  ink: "#1f2e2e",
  petrol: "#2f5a73",
  muted: "#6b7c82",
  border: "#e6e4df",
  white: "#ffffff",
} as const;

const fontFamily = "'Georgia', 'Times New Roman', serif";
const bodyFont = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export type EmailLayoutProps = {
  preview: string;
  heading: string;
  siteUrl: string;
  children: ReactNode;
  cta?: { label: string; href: string } | null;
  secondaryCta?: { label: string; href: string } | null;
};

export function EmailLayout({ preview, heading, siteUrl, children, cta, secondaryCta }: EmailLayoutProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: EMAIL_COLORS.paper, margin: 0, padding: "24px 12px", fontFamily: bodyFont, color: EMAIL_COLORS.ink }}>
        <Container style={{ maxWidth: 520, margin: "0 auto", backgroundColor: EMAIL_COLORS.white, border: `1px solid ${EMAIL_COLORS.border}`, borderRadius: 12, overflow: "hidden" }}>
          <Section style={{ backgroundColor: EMAIL_COLORS.petrol, padding: "20px 28px" }}>
            <table role="presentation" cellPadding={0} cellSpacing={0} style={{ width: "100%" }}>
              <tbody>
                <tr>
                  <td style={{ width: 44 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: EMAIL_COLORS.paper, color: EMAIL_COLORS.petrol, fontFamily, fontWeight: 700, fontSize: 16, lineHeight: "40px", textAlign: "center" }}>EM</div>
                  </td>
                  <td style={{ paddingLeft: 12, color: EMAIL_COLORS.paper, fontFamily, fontSize: 20, fontWeight: 600 }}>Método EM</td>
                </tr>
              </tbody>
            </table>
          </Section>
          <Section style={{ padding: "28px 28px 8px" }}>
            <Heading as="h1" style={{ fontFamily, fontSize: 22, lineHeight: "30px", margin: "0 0 16px", color: EMAIL_COLORS.ink }}>
              {heading}
            </Heading>
            {children}
            {cta ? (
              <Section style={{ margin: "24px 0 8px" }}>
                <Button href={cta.href} style={{ backgroundColor: EMAIL_COLORS.petrol, color: EMAIL_COLORS.white, borderRadius: 8, padding: "12px 20px", fontSize: 15, fontWeight: 600, textDecoration: "none", display: "inline-block" }}>
                  {cta.label}
                </Button>
                {secondaryCta ? (
                  <Text style={{ margin: "12px 0 0", fontSize: 14 }}>
                    <Link href={secondaryCta.href} style={{ color: EMAIL_COLORS.petrol, textDecoration: "underline" }}>
                      {secondaryCta.label}
                    </Link>
                  </Text>
                ) : null}
              </Section>
            ) : null}
          </Section>
          <Hr style={{ borderColor: EMAIL_COLORS.border, margin: "8px 28px" }} />
          <Section style={{ padding: "8px 28px 24px" }}>
            <Text style={{ fontSize: 12, lineHeight: "18px", color: EMAIL_COLORS.muted, margin: 0 }}>
              Este é um aviso automático do seu acompanhamento no Método EM. Para ver detalhes, acesse o portal em{" "}
              <Link href={siteUrl} style={{ color: EMAIL_COLORS.petrol }}>
                {siteUrl.replace(/^https?:\/\//, "")}
              </Link>
              . Preferências de aviso podem ser ajustadas no portal, em Notificações.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function Paragraph({ children }: { children: ReactNode }) {
  return <Text style={{ fontSize: 15, lineHeight: "24px", margin: "0 0 12px", color: EMAIL_COLORS.ink }}>{children}</Text>;
}

export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td style={{ padding: "6px 0", fontSize: 13, color: EMAIL_COLORS.muted, width: 110, verticalAlign: "top" }}>{label}</td>
      <td style={{ padding: "6px 0", fontSize: 15, color: EMAIL_COLORS.ink, fontWeight: 600 }}>{value}</td>
    </tr>
  );
}

export function Details({ children }: { children: ReactNode }) {
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} style={{ width: "100%", margin: "8px 0 4px", borderTop: `1px solid ${EMAIL_COLORS.border}`, borderBottom: `1px solid ${EMAIL_COLORS.border}`, padding: "6px 0" }}>
      <tbody>{children}</tbody>
    </table>
  );
}
