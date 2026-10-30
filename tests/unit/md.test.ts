import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Md } from "../../src/ui/Md";

describe("rendu Markdown sûr", () => {
  it("n'interprète jamais de HTML brut", () => {
    const html = renderToStaticMarkup(createElement(Md, { text: '<img src=x onerror="alert(1)"> **gras**' }));
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    expect(html).toContain("<strong>gras</strong>");
  });
  it("rend le glossaire avec la définition accessible", () => {
    const html = renderToStaticMarkup(
      createElement(Md, { text: "un [[accumulateur]]", glossary: [{ term: "accumulateur", en: "accumulator", definition: "Variable mise à jour." }] }),
    );
    expect(html).toContain('class="term"');
    expect(html).toContain("accumulator");
  });
});
