import { Fragment, type ReactNode } from "react";
import type { Lesson } from "../content/types";

/**
 * Rendu Markdown minimal et SÛR : aucun HTML brut n'est interprété (pas de innerHTML).
 * Syntaxe : paragraphes, listes « - », **gras**, *italique*, `code`, [[terme du glossaire|texte]].
 */
type Glossary = Lesson["glossary"];

function inline(text: string, glossary: Glossary | undefined, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[\[[^\]]+\]\])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith("`")) out.push(<code key={key}>{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("**")) out.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("[[")) {
      const [term, label] = tok.slice(2, -2).split("|");
      const g = glossary?.find((x) => x.term.toLowerCase() === term.toLowerCase());
      out.push(
        g ? (
          <span key={key} className="term" tabIndex={0} title={`${g.term}${g.en ? ` (anglais : ${g.en})` : ""} — ${g.definition}`}>
            {label ?? term}
            <span className="sr-only">
              {" "}
              (définition : {g.definition}
              {g.en ? `, en anglais « ${g.en} »` : ""})
            </span>
          </span>
        ) : (
          <Fragment key={key}>{label ?? term}</Fragment>
        ),
      );
    } else out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Md({ text, glossary, className }: { text: string; glossary?: Glossary; className?: string }) {
  const blocks = text.split(/\n\s*\n/);
  return (
    <div className={`md ${className ?? ""}`}>
      {blocks.map((b, bi) => {
        const lines = b.split("\n");
        if (lines.every((l) => l.trim().startsWith("- ")))
          return (
            <ul key={bi}>
              {lines.map((l, li) => (
                <li key={li}>{inline(l.trim().slice(2), glossary, `${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        const head = lines.filter((l) => !l.trim().startsWith("- "));
        const items = lines.filter((l) => l.trim().startsWith("- "));
        return (
          <Fragment key={bi}>
            <p>{inline(head.join(" "), glossary, `${bi}`)}</p>
            {items.length > 0 && (
              <ul>
                {items.map((l, li) => (
                  <li key={li}>{inline(l.trim().slice(2), glossary, `${bi}-i${li}`)}</li>
                ))}
              </ul>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
