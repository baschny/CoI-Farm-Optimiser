import { BuildingType } from './crop.model';

export interface FarmConfig {
  buildingType: BuildingType;
  count: number;
}

export interface GeneticResult {
  bestFertilizerUsage: number;
  bestWaterUsage: number;
  configuration: RotationAssignment[];
  combinedYield: Record<string, number>;
}

export interface RotationAssignment {
  buildingType: BuildingType;
  rotation: string[];
  fertilityTarget: number | null;
}

export interface OptimizationRequest {
  population: number;
  foodMultiplier: number;
  foodSelections: string[];
  farmConfigs: FarmConfig[];
  extraCropRequirements: Record<string, number>;
  populationSize: number;
  generations: number;
  mutationRate: number;
}

export interface OptimizationResponse {
  log: string;
  report: string;
  result?: GeneticResult;
}
