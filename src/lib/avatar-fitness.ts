export const fitnessRingNames = ["move", "exercise", "stand"] as const;

export type FitnessRingName = typeof fitnessRingNames[number];

export interface FitnessRing {
  value: number | null;
  goal: number | null;
  unit: "kcal" | "min" | "h";
}

export type FitnessRings = Record<FitnessRingName, FitnessRing | null>;

export interface FitnessSnapshot {
  rings: FitnessRings | null;
  steps: number | null;
}
