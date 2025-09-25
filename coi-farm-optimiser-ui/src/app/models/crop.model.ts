export type BuildingType = 'farm' | 'greenhouse_tier1' | 'greenhouse_tier2';

export interface Crop {
  name: string;
  durationDays: number;
  waterUsage: number;
  fertilityChange: number;
  totalYield: number;
}

export interface RotationSummary {
  rotation: string[];
  buildingType: BuildingType;
  totalDurationDays: number;
  fertilityPerMonth: number;
  yieldPerMonthRaw: number;
  waterPerMonth: number;
  fertilityEquilibrium: number;
  effectiveYieldPerMonth: number;
  individualEffectiveYields: Record<string, number>;
  fertilizerRequiredPerMonth: number;
  buildingModifiers: {
    yieldMultiplier: number;
    waterMultiplier: number;
    fertilizerMultiplier: number;
  };
}
