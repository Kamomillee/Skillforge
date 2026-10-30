import { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { python } from "@codemirror/lang-python";
import { sql, PostgreSQL } from "@codemirror/lang-sql";
import { Annotation, Compartment, EditorState } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { indentUnit } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";

export interface EditorHandle {
  focus: () => void;
  goToLine: (line: number) => void;
  setValue: (code: string) => void;
}

/** Marque les changements imposés par l'application (restauration, autre onglet) : ils ne déclenchent pas onChange. */
const External = Annotation.define<boolean>();

function isDark() {
  const t = document.documentElement.dataset.theme;
  if (t === "dark") return true;
  if (t === "light") return false;
  return matchMedia("(prefers-color-scheme: dark)").matches;
}

const lightTheme = EditorView.theme({
  "&": { backgroundColor: "var(--code-bg)", color: "var(--ink)" },
  ".cm-gutters": { backgroundColor: "var(--surface-2)", color: "var(--ink-3)", borderRight: "1px solid var(--line)" },
  ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--accent-soft) 50%, transparent)" },
  ".cm-activeLineGutter": { backgroundColor: "var(--accent-soft)" },
});

/**
 * Éditeur CodeMirror 6 : coloration Python (indentation 4) ou SQL PostgreSQL (indentation 2), numéros de ligne.
 * Tab indente ; Échap puis Tab permet de quitter l'éditeur au clavier.
 */
export function CodeEditor({
  value,
  onChange,
  onRun,
  onSubmit,
  label,
  handleRef,
  language = "python",
}: {
  language?: "python" | "sql";
  value: string;
  onChange: (v: string) => void;
  onRun?: () => void;
  onSubmit?: () => void;
  label: string;
  handleRef?: React.MutableRefObject<EditorHandle | null>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const cbs = useRef({ onChange, onRun, onSubmit });
  cbs.current = { onChange, onRun, onSubmit };

  useEffect(() => {
    const theme = new Compartment();
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          keymap.of([
            { key: "Mod-Enter", run: () => (cbs.current.onRun?.(), true) },
            { key: "Mod-Shift-Enter", run: () => (cbs.current.onSubmit?.(), true) },
            indentWithTab,
          ]),
          basicSetup,
          ...(language === "sql" ? [sql({ dialect: PostgreSQL, upperCaseKeywords: true }), indentUnit.of("  "), EditorState.tabSize.of(2)] : [python(), indentUnit.of("    "), EditorState.tabSize.of(4)]),
          theme.of(isDark() ? oneDark : lightTheme),
          EditorView.contentAttributes.of({ "aria-label": label }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged && !u.transactions.some((tr) => tr.annotation(External))) cbs.current.onChange(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = v;
    // Point d'accès pour les tests de bout en bout (lecture/écriture du document).
    (host.current as HTMLDivElement & { cmView?: EditorView }).cmView = v;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const sync = () => v.dispatch({ effects: theme.reconfigure(isDark() ? oneDark : lightTheme) });
    mq.addEventListener("change", sync);
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      mq.removeEventListener("change", sync);
      obs.disconnect();
      v.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Valeur imposée de l'extérieur (restauration, réinitialisation, autre onglet).
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value }, annotations: External.of(true) });
  }, [value]);

  useEffect(() => {
    if (!handleRef) return;
    handleRef.current = {
      focus: () => view.current?.focus(),
      goToLine: (line) => {
        const v = view.current;
        if (!v) return;
        const l = v.state.doc.line(Math.max(1, Math.min(line, v.state.doc.lines)));
        v.dispatch({ selection: { anchor: l.from }, scrollIntoView: true });
        v.focus();
      },
      setValue: (code) => {
        const v = view.current;
        if (v) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: code }, annotations: External.of(true) });
      },
    };
  }, [handleRef]);

  return <div className="editor-wrap" ref={host} />;
}
