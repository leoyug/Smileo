import { fitnessRingNames, type FitnessSnapshot } from "../lib/avatar-fitness";

function setArc(arc: SVGCircleElement, percent: number) {
  arc.setAttribute("visibility", percent > 0 ? "visible" : "hidden");
  arc.setAttribute("stroke-dasharray", `${percent} 100`);
}

export function bindAvatarFitness(dialog: HTMLDialogElement) {
  const card = dialog.querySelector("[data-avatar-fitness]");
  if (!card) return;

  const steps = card.querySelector("[data-fitness-steps]");
  const stepsUnit = card.querySelector<HTMLElement>("[data-fitness-steps-unit]");
  if (!steps || !stepsUnit) return;

  const number = new Intl.NumberFormat(document.documentElement.lang, { maximumFractionDigits: 1 });
  const formatValue = (value: number | null) => value === null ? "—" : number.format(value);

  const render = (snapshot: FitnessSnapshot | null) => {
    for (const name of fitnessRingNames) {
      const graphic = card.querySelector(`[data-fitness-ring="${name}"]`);
      const arc = graphic?.querySelector<SVGCircleElement>("[data-fitness-arc]");
      const lap = graphic?.querySelector<SVGCircleElement>("[data-fitness-lap]");
      const details = card.querySelector<HTMLElement>(`[data-fitness-value="${name}"]`);
      const text = details?.querySelector("span");
      if (!graphic || !arc || !lap || !details || !text) continue;

      const ring = snapshot?.rings?.[name];
      const value = ring?.value ?? null;
      const goal = ring?.goal ?? null;
      const hasProgress = value !== null && goal !== null && goal > 0;
      const progress = hasProgress ? (value / goal) * 100 : 0;
      setArc(arc, Math.min(progress, 100));
      setArc(lap, progress > 100 ? progress % 100 || 100 : 0);
      graphic.toggleAttribute("data-synced", hasProgress);
      graphic.toggleAttribute("data-progress", progress > 0);
      details.hidden = !ring;
      text.textContent = ring ? `${formatValue(ring.value)} / ${formatValue(ring.goal)} ${ring.unit}` : "";
    }

    steps.textContent = formatValue(snapshot?.steps ?? null);
    stepsUnit.hidden = snapshot?.steps == null;
  };

  return async (signal: AbortSignal) => {
    try {
      const response = await fetch("/api/fitness", { cache: "no-store", signal });
      if (!response.ok) return;
      const { snapshot }: { snapshot: FitnessSnapshot | null } = await response.json();
      if (!signal.aborted) render(snapshot);
    } catch {
      // Keep the last displayed data through a connection error or dialog close.
    }
  };
}
