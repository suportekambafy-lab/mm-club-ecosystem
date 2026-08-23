import { describe, expect, it } from "vitest";
import { escapeHtml, interpolate, safeUrl, mergeTemplate, renderTemplate } from "./render";
import type { TemplateDefinition } from "./types";

const def: TemplateDefinition = {
  key: "test",
  category: "retention",
  label: "Teste",
  description: "Teste",
  subject: "Olá {{name}}",
  previewText: "Preview {{name}}",
  heading: "Bem-vindo {{name}}",
  body: ["Primeiro parágrafo para {{name}}.", "Segundo parágrafo."],
  ctaLabel: "Abrir",
  ctaUrl: "{{ctaUrl}}",
  version: 1,
} as unknown as TemplateDefinition;

describe("escapeHtml", () => {
  it("escapa HTML perigoso", () => {
    expect(escapeHtml('<script>"x"&y</script>')).toBe(
      "&lt;script&gt;&quot;x&quot;&amp;y&lt;/script&gt;",
    );
  });
});

describe("safeUrl", () => {
  it("aceita http, https, relativos e âncoras", () => {
    expect(safeUrl("https://mmclub.pt/aulas")).toBe("https://mmclub.pt/aulas");
    expect(safeUrl("/dashboard")).toBe("/dashboard");
    expect(safeUrl("#topo")).toBe("#topo");
  });

  it("bloqueia esquemas perigosos", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("https://mmclub.pt");
    expect(safeUrl("data:text/html,<h1>x")).toBe("https://mmclub.pt");
  });

  it("neutraliza aspas que quebrariam o href", () => {
    expect(safeUrl('https://x.pt/a"onmouseover=1')).toBe("https://x.pt/a%22onmouseover=1");
  });
});

describe("interpolate", () => {
  it("substitui e escapa valores", () => {
    expect(interpolate("Olá {{name}}", { name: "<b>Ana</b>" })).toBe(
      "Olá &lt;b&gt;Ana&lt;/b&gt;",
    );
  });

  it("remove tokens sem valor", () => {
    expect(interpolate("A{{x}}B", {})).toBe("AB");
    expect(interpolate("A{{x}}B", { x: null })).toBe("AB");
    expect(interpolate("A{{x}}B", { x: "" })).toBe("AB");
  });

  it("mantém números e não escapa URLs válidos", () => {
    expect(interpolate("{{days}} dias", { days: 5 })).toBe("5 dias");
    expect(interpolate("{{ctaUrl}}", { ctaUrl: "https://mmclub.pt/x?a=1&b=2" })).toBe(
      "https://mmclub.pt/x?a=1&amp;b=2",
    );
  });
});

describe("mergeTemplate", () => {
  it("devolve a definição original sem override", () => {
    expect(mergeTemplate(def, null)).toBe(def);
  });

  it("aplica apenas os campos preenchidos do override", () => {
    const merged = mergeTemplate(def, {
      subject: "Novo assunto",
      bodyHtml: "P1\n\nP2\n\nP3",
      version: 3,
    } as never);
    expect(merged.subject).toBe("Novo assunto");
    expect(merged.heading).toBe(def.heading);
    expect(merged.body).toEqual(["P1", "P2", "P3"]);
    expect(merged.version).toBe(3);
  });
});

describe("renderTemplate", () => {
  it("produz assunto, html e texto coerentes", () => {
    const out = renderTemplate(def, { name: "Ana", ctaUrl: "https://mmclub.pt/aulas" });
    expect(out.subject).toBe("Olá Ana");
    expect(out.html).toContain("Bem-vindo Ana");
    expect(out.html).toContain('href="https://mmclub.pt/aulas"');
    expect(out.text).toContain("Primeiro parágrafo para Ana.");
    expect(out.text).not.toContain("<p");
    expect(out.previewText).toBe("Preview Ana");
  });

  it("nunca injeta script vindo das variáveis", () => {
    const out = renderTemplate(def, {
      name: '<img src=x onerror=alert(1)>',
      ctaUrl: "javascript:alert(1)",
    });
    expect(out.html).not.toContain("<img");
    expect(out.html).not.toContain('href="javascript:');
  });
});
