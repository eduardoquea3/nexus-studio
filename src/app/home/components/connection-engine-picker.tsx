import { useGSAP } from "@gsap/react";
import { RiDatabase2Line } from "@remixicon/react";
import { MySQLDark, MySQLLight, PostgreSQL } from "@ridemountainpig/svgl-react";
import gsap from "gsap";
import { useRef, useState } from "react";

gsap.registerPlugin(useGSAP);

export type ConnectionEngine = "postgresql" | "mysql" | "sqlite";

type ConnectionEnginePickerProps = {
  onSelect: (engine: ConnectionEngine) => void;
};

const engines: {
  id: ConnectionEngine;
  name: string;
  mark?: typeof PostgreSQL;
  darkMark?: typeof PostgreSQL;
  asset?: string;
}[] = [
  { id: "postgresql", name: "PostgreSQL", mark: PostgreSQL },
  { id: "mysql", name: "MySQL", mark: MySQLLight, darkMark: MySQLDark },
  { id: "sqlite", name: "SQLite", asset: "/SQLite.svg" },
];

export function ConnectionEnginePicker({ onSelect }: ConnectionEnginePickerProps) {
  const [selected, setSelected] = useState<ConnectionEngine | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useRef(false);

  useGSAP(() => {
    if (!gridRef.current) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotion.current = media.matches;
    if (media.matches) return;
    gsap.fromTo(
      gridRef.current.children,
      { y: 12, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.45, stagger: 0.08, ease: "power2.out" },
    );
    return () => {
      if (gridRef.current) gsap.killTweensOf(gridRef.current.children);
    };
  }, { scope: gridRef });

  const choose = (engine: ConnectionEngine) => {
    setSelected(engine);
    if (!reducedMotion.current) {
      const target = gridRef.current?.querySelector(`[data-engine="${engine}"]`);
      if (target) gsap.fromTo(target, { scale: 0.98 }, { scale: 1, duration: 0.28, ease: "back.out(2)" });
    }
    onSelect(engine);
  };

  return (
    <section className="mx-auto w-full max-w-4xl" aria-labelledby="engine-picker-title">
      <div className="mb-7 max-w-xl">
        <p className="mb-2 flex items-center gap-2 font-label text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
          <RiDatabase2Line size={14} aria-hidden="true" /> New connection
        </p>
        <h2 id="engine-picker-title" className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Choose your database
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Select the engine you want to connect to. You can configure your connection next.
        </p>
      </div>
      <div role="group" aria-label="Choose a database engine" ref={gridRef} className="grid gap-3 sm:grid-cols-3">
        {engines.map(({ id, name, mark: Mark, darkMark: DarkMark, asset }) => {
          const active = selected === id;
          return (
            <button
              key={id}
              type="button"
              data-engine={id}
              aria-pressed={active}
              onClick={() => choose(id)}
              className={`group relative flex min-h-24 flex-row items-center gap-4 rounded-xl border bg-card p-4 text-left text-card-foreground shadow-sm transition-[background-color,border-color,box-shadow,transform] duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none ${
                active
                  ? "border-primary shadow-[0_8px_30px_-18px] shadow-primary/30 ring-1 ring-primary/30"
                  : "border-border hover:-translate-y-1 hover:border-primary/70 hover:bg-accent/60 hover:shadow-xl hover:shadow-primary/15 hover:ring-1 hover:ring-primary/30"
              }`}
            >
              <span className="flex size-14 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background p-2.5 shadow-sm">
                {asset ? (
                  <img src={asset} alt="" className="size-9 max-h-full max-w-full object-contain" />
                ) : Mark ? (
                  <>
                    <Mark
                      className={`size-9 max-h-full max-w-full ${DarkMark ? "dark:hidden" : ""}`}
                      aria-hidden="true"
                    />
                    {DarkMark ? (
                      <DarkMark className="hidden size-9 max-h-full max-w-full dark:block" aria-hidden="true" />
                    ) : null}
                  </>
                ) : null}
              </span>
              <span className="font-label text-base font-semibold text-card-foreground">{name}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
