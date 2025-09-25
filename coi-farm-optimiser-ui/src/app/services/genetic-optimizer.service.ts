import { Injectable } from '@angular/core';
import { BuildingType, RotationSummary } from '../models/crop.model';
import { FarmConfig, GeneticResult } from '../models/optimization.model';
import { RotationSimulatorService } from './rotation-simulator.service';

interface CandidateRotation {
  rotation: string[];
  fertilityTarget: number | null;
}

interface Evaluation {
  fertilizer: number;
  water: number;
  yields: Record<string, number>;
}

@Injectable({ providedIn: 'root' })
export class GeneticOptimizerService {
  private readonly simulationCache = new Map<string, RotationSummary>();

  constructor(private readonly simulator: RotationSimulatorService) {}

  runGeneticSearch(
    foodDemand: Record<string, number>,
    cropList: string[],
    farmConfigs: FarmConfig[],
    fertilizerLevels: (number | null)[],
    populationSize: number,
    generations: number,
    mutationRate: number
  ): GeneticResult | null {
    const baseRotations = this.generateBaseRotations(cropList);
    const farmSafeRotations = baseRotations.filter((rotation) => !rotation.includes('Fruit'));

    const buildingSpecificOptions = new Map<BuildingType, CandidateRotation[]>([
      ['farm', farmSafeRotations.flatMap((rotation) => fertilizerLevels.map((fertilityTarget) => ({ rotation, fertilityTarget })))],
      ['greenhouse_tier1', baseRotations.flatMap((rotation) => fertilizerLevels.map((fertilityTarget) => ({ rotation, fertilityTarget })))],
      ['greenhouse_tier2', baseRotations.flatMap((rotation) => fertilizerLevels.map((fertilityTarget) => ({ rotation, fertilityTarget })))]
    ]);

    const activeFarmConfigs = farmConfigs.filter((config) => config.count > 0);
    const totalFarms = activeFarmConfigs.reduce((sum, config) => sum + config.count, 0);
    if (totalFarms === 0) {
      return null;
    }

    const buildingTypes = activeFarmConfigs.flatMap((config) => Array(config.count).fill(config.buildingType));

    const population = Array.from({ length: populationSize }, () => this.generateIndividual(buildingTypes, buildingSpecificOptions));

    let best: { individual: CandidateRotation[]; evaluation: Evaluation } | null = null;

    for (let generation = 0; generation < generations; generation += 1) {
      const scored = population.map((individual) => {
        const evaluation = this.evaluateIndividual(individual, buildingTypes, foodDemand);
        return { individual, evaluation };
      });

      scored.sort((a, b) => a.evaluation.fertilizer - b.evaluation.fertilizer);

      const survivors = scored.slice(0, Math.max(2, Math.floor(populationSize / 2)));
      best = this.selectBetter(best, survivors[0]);

      const survivorIndividuals = survivors.map((entry) => entry.individual);
      population.length = 0;
      population.push(...survivorIndividuals);

      while (population.length < populationSize) {
        const [parent1, parent2] = this.pickParents(survivorIndividuals);
        const child = this.mutate(this.crossover(parent1, parent2), mutationRate, buildingTypes, buildingSpecificOptions);
        population.push(child);
      }
    }

    if (!best || !Number.isFinite(best.evaluation.fertilizer)) {
      return null;
    }

    const assignments = best.individual.map((candidate, index) => ({
      buildingType: buildingTypes[index],
      rotation: candidate.rotation,
      fertilityTarget: candidate.fertilityTarget
    }));

    return {
      bestFertilizerUsage: best.evaluation.fertilizer,
      bestWaterUsage: best.evaluation.water,
      configuration: assignments,
      combinedYield: best.evaluation.yields
    };
  }

  private selectBetter(
    best: { individual: CandidateRotation[]; evaluation: Evaluation } | null,
    candidate: { individual: CandidateRotation[]; evaluation: Evaluation }
  ): { individual: CandidateRotation[]; evaluation: Evaluation } | null {
    if (!candidate || !Number.isFinite(candidate.evaluation.fertilizer)) {
      return best;
    }
    if (!best || candidate.evaluation.fertilizer < best.evaluation.fertilizer) {
      return candidate;
    }
    return best;
  }

  private generateIndividual(
    buildingTypes: BuildingType[],
    options: Map<BuildingType, CandidateRotation[]>
  ): CandidateRotation[] {
    return buildingTypes.map((type) => {
      const candidates = options.get(type);
      if (!candidates || candidates.length === 0) {
        throw new Error(`No rotation options available for building type ${type}.`);
      }
      return candidates[Math.floor(Math.random() * candidates.length)];
    });
  }

  private evaluateIndividual(
    individual: CandidateRotation[],
    buildingTypes: BuildingType[],
    foodDemand: Record<string, number>
  ): Evaluation {
    const combinedOutput: Record<string, number> = {};
    let totalFertilizer = 0;
    let totalWater = 0;

    individual.forEach((candidate, index) => {
      const buildingType = buildingTypes[index];
      const summary = this.cachedSimulate(candidate.rotation, candidate.fertilityTarget, buildingType);
      totalFertilizer += summary.fertilizerRequiredPerMonth;
      totalWater += summary.waterPerMonth;
      Object.entries(summary.individualEffectiveYields).forEach(([crop, yieldAmount]) => {
        combinedOutput[crop] = (combinedOutput[crop] ?? 0) + yieldAmount;
      });
    });

    const meetsDemand = Object.entries(foodDemand).every(([crop, demand]) => (combinedOutput[crop] ?? 0) >= demand);
    return {
      fertilizer: meetsDemand ? totalFertilizer : Number.POSITIVE_INFINITY,
      water: meetsDemand ? totalWater : Number.POSITIVE_INFINITY,
      yields: meetsDemand ? combinedOutput : {}
    };
  }

  private mutate(
    individual: CandidateRotation[],
    mutationRate: number,
    buildingTypes: BuildingType[],
    options: Map<BuildingType, CandidateRotation[]>
  ): CandidateRotation[] {
    return individual.map((candidate, index) => {
      if (Math.random() < mutationRate) {
        const candidates = options.get(buildingTypes[index]) ?? [];
        return candidates[Math.floor(Math.random() * candidates.length)];
      }
      return candidate;
    });
  }

  private crossover(parent1: CandidateRotation[], parent2: CandidateRotation[]): CandidateRotation[] {
    if (parent1.length !== parent2.length) {
      throw new Error('Parents must have equal length.');
    }
    if (parent1.length <= 1) {
      return [...parent1];
    }
    const point = Math.floor(Math.random() * (parent1.length - 1)) + 1;
    return [...parent1.slice(0, point), ...parent2.slice(point)];
  }

  private pickParents(population: CandidateRotation[][]): [CandidateRotation[], CandidateRotation[]] {
    if (population.length === 0) {
      throw new Error('Population cannot be empty.');
    }
    if (population.length === 1) {
      return [population[0], population[0]];
    }
    const firstIndex = Math.floor(Math.random() * population.length);
    let secondIndex = Math.floor(Math.random() * population.length);
    while (secondIndex === firstIndex) {
      secondIndex = Math.floor(Math.random() * population.length);
    }
    return [population[firstIndex], population[secondIndex]];
  }

  private cachedSimulate(rotation: string[], fertilityTarget: number | null, buildingType: BuildingType): RotationSummary {
    const key = `${rotation.join('>')}|${fertilityTarget ?? 'off'}|${buildingType}`;
    const cached = this.simulationCache.get(key);
    if (cached) {
      return cached;
    }
    const summary = this.simulator.simulateRotation(rotation, buildingType, fertilityTarget);
    this.simulationCache.set(key, summary);
    return summary;
  }

  private generateBaseRotations(crops: string[]): string[][] {
    const results: string[][] = [];
    const sorted = [...new Set(crops)].sort();

    for (let length = 1; length <= 4; length += 1) {
      this.generateCombinations(sorted, length, 0, [], results);
    }

    return results;
  }

  private generateCombinations(
    crops: string[],
    length: number,
    start: number,
    prefix: string[],
    results: string[][]
  ): void {
    if (prefix.length === length) {
      results.push([...prefix]);
      return;
    }

    for (let index = start; index < crops.length; index += 1) {
      prefix.push(crops[index]);
      this.generateCombinations(crops, length, index + 1, prefix, results);
      prefix.pop();
    }
  }
}
