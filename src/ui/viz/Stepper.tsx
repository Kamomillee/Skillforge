import { useEffect, useRef, useState } from "react";

export const SPEEDS = [
  { label: "0,5×", ms: 2600 },
  { label: "1×", ms: 1400 },
  { label: "2×", ms: 700 },
];

export const prefersReducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** État commun des visualisations pas à pas : position, lecture automatique, vitesse. */
export function useStepper(count: number) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!playing) return;
    if (i >= count - 1) {
      setPlaying(false);
      return;
    }
    timer.current = setTimeout(() => setI((x) => Math.min(x + 1, count - 1)), SPEEDS[speed].ms);
    return () => clearTimeout(timer.current);
  }, [playing, i, speed, count]);

  useEffect(() => {
    if (i > count - 1) setI(Math.max(0, count - 1));
  }, [count, i]);

  const go = (n: number) => {
    setPlaying(false);
    setI(Math.max(0, Math.min(n, count - 1)));
  };
  const toggle = () => {
    if (i >= count - 1) setI(0);
    setPlaying((p) => !p);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    if (e.key === "ArrowRight") (e.preventDefault(), go(i + 1));
    else if (e.key === "ArrowLeft") (e.preventDefault(), go(i - 1));
    else if (e.key === "Home") (e.preventDefault(), go(0));
    else if (e.key === "End") (e.preventDefault(), go(count - 1));
  };
  return { i, count, playing, speed, setSpeed, go, toggle, onKey };
}

export function StepperControls({ s, label = "Position dans la visualisation", valueText }: { s: ReturnType<typeof useStepper>; label?: string; valueText?: string }) {
  return (
    <div className="tracer-controls" role="group" aria-label="Contrôles de la visualisation">
      <button className="btn sm" onClick={() => s.go(0)} aria-label="Revenir au début">
        ⏮
      </button>
      <button className="btn sm" onClick={() => s.go(s.i - 1)} disabled={s.i === 0} aria-label="Étape précédente">
        ◀
      </button>
      <button className="btn sm primary" onClick={s.toggle} aria-label={s.playing ? "Pause" : "Lecture"}>
        {s.playing ? "❚❚ Pause" : "▶ Lecture"}
      </button>
      <button className="btn sm" onClick={() => s.go(s.i + 1)} disabled={s.i >= s.count - 1} aria-label="Étape suivante">
        ▶|
      </button>
      <input
        type="range"
        min={0}
        max={Math.max(0, s.count - 1)}
        value={s.i}
        onChange={(e) => s.go(Number(e.target.value))}
        aria-label={label}
        aria-valuetext={valueText ?? `Étape ${s.i + 1} sur ${s.count}`}
      />
      <span className="small muted" aria-hidden="true">
        {s.i + 1}/{s.count}
      </span>
      <label className="small row" style={{ gap: 4 }}>
        Vitesse
        <select value={s.speed} onChange={(e) => s.setSpeed(Number(e.target.value))}>
          {SPEEDS.map((x, k) => (
            <option key={k} value={k}>
              {x.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
