import { Injectable } from '@angular/core';
import { BuildingType } from '../models/crop.model';
import { FoodDemandService, FOOD_DEFINITIONS } from './food-demand.service';
import { CROP_DATABASE } from './crop-database';
import { GeneticOptimizerService } from './genetic-optimizer.service';
import { GeneticResult, OptimizationRequest, OptimizationResponse } from '../models/optimization.model';

interface FoodToCropMapping {
  crop: string;
  divisor: number;
}

const FOOD_TO_CROP_MAPPING: Record<string, FoodToCropMapping> = {
  Bread: { crop: 'Wheat', divisor: 1.5 },
  Tofu: { crop: 'Soybean', divisor: 1.34 },
  Sausage: { crop: 'Wheat', divisor: 4 },
  Cake: { crop: 'Wheat', divisor: 1.4 },
  Snack: { crop: 'Corn', divisor: 1 }
};

const FERTILIZER_LEVELS: (number | null)[] = [null, 80, 100, 120, 140];

@Injectable({ providedIn: 'root' })
export class OptimizationService {
  constructor(
    private readonly demandService: FoodDemandService,
    private readonly optimizer: GeneticOptimizerService
  ) {}

  runOptimization(request: OptimizationRequest): OptimizationResponse {
    const start = performance.now();
    const logLines: string[] = [];

    const demand = this.demandService.calculateFoodDemand(
      request.population,
      request.foodMultiplier,
      request.foodSelections
    );
    if (demand.error) {
      return {
        log: demand.error,
        report: demand.error
      };
    }

    logLines.push(
      `Food demand calculated (Multiplier ${request.foodMultiplier.toFixed(2)}): ${JSON.stringify(demand.demandByFood)}`
    );

    const validFoods = request.foodSelections.filter((food) => FOOD_DEFINITIONS[food]);
    const skippedFoods = request.foodSelections.filter((food) => !FOOD_DEFINITIONS[food]);
    if (skippedFoods.length > 0) {
      logLines.push(`Skipping foods not recognised in demand table: ${skippedFoods.join(', ')}`);
    }

    const cropDemand: Record<string, number> = {};
    const cropsRequired = new Set<string>();

    validFoods.forEach((food) => {
      const mapping = FOOD_TO_CROP_MAPPING[food];
      if (mapping) {
        const demandValue = demand.demandByFood[food] ?? 0;
        cropDemand[mapping.crop] = (cropDemand[mapping.crop] ?? 0) + demandValue / mapping.divisor;
        cropsRequired.add(mapping.crop);
      } else if (food in CROP_DATABASE) {
        cropDemand[food] = (cropDemand[food] ?? 0) + (demand.demandByFood[food] ?? 0);
        cropsRequired.add(food);
      }
    });

    Object.entries(request.extraCropRequirements).forEach(([crop, amount]) => {
      if (amount > 0) {
        cropDemand[crop] = (cropDemand[crop] ?? 0) + amount;
        cropsRequired.add(crop);
      }
    });

    const farmConfigs = request.farmConfigs.map((config) => ({ ...config })) as { buildingType: BuildingType; count: number }[];

    logLines.push('Starting genetic optimisation search...');

    const result = this.optimizer.runGeneticSearch(
      cropDemand,
      Array.from(cropsRequired),
      farmConfigs,
      FERTILIZER_LEVELS,
      request.populationSize,
      request.generations,
      request.mutationRate
    );

    const runtimeSeconds = (performance.now() - start) / 1000;
    const report = this.formatReport(result, cropDemand, farmConfigs, runtimeSeconds);

    return {
      log: logLines.join('\n'),
      report,
      result: result ?? undefined
    };
  }

  private formatReport(
    result: GeneticResult | null,
    cropDemand: Record<string, number>,
    farmConfigs: { buildingType: BuildingType; count: number }[],
    runtime: number
  ): string {
    const lines: string[] = ['\n🌿 Genetic Optimisation Results 🌿'];

    if (!result) {
      lines.push('\n❌ No configuration satisfied the crop demand.');
      lines.push(`\n⏱️ Total Runtime: ${runtime.toFixed(2)} seconds`);
      return lines.join('\n');
    }

    lines.push('\n✅ Optimal configuration found!');
    lines.push(`🌱 Total Fertiliser Usage: ${result.bestFertilizerUsage.toFixed(1)} units/month`);
    lines.push(`💧 Total Water Usage: ${result.bestWaterUsage.toFixed(1)} units/month`);

    lines.push('\n🚜 Farm & Greenhouse Rotations:');
    result.configuration.forEach((assignment, index) => {
      const rotation = assignment.rotation.join(' → ');
      const fertility = assignment.fertilityTarget === null ? 'Off' : `${assignment.fertilityTarget}%`;
      const friendlyName = assignment.buildingType.replace('_', ' ');
      const icon = assignment.buildingType.startsWith('greenhouse') ? '🏢' : '🚜';
      lines.push(
        `  ${icon} ${friendlyName.padEnd(18)} | Rotation: ${rotation.padEnd(40)} | Fertility: ${fertility.padStart(6)}`
      );
    });

    lines.push('\n📦 Combined Monthly Crop Output:');
    Object.entries(result.combinedYield)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([crop, yieldAmount]) => {
        const demandValue = cropDemand[crop] ?? 0;
        if (demandValue > 0) {
          lines.push(`  🌽 ${crop}: ${yieldAmount.toFixed(1)} units/month (Required: ${demandValue.toFixed(1)})`);
        } else {
          lines.push(`  🌽 ${crop}: ${yieldAmount.toFixed(1)} units/month`);
        }
      });

    const totalBuildings = farmConfigs.reduce((sum, config) => sum + config.count, 0);
    lines.push(`\n🏗️ Total Buildings Evaluated: ${totalBuildings}`);
    lines.push(`⏱️ Total Runtime: ${runtime.toFixed(2)} seconds`);

    return lines.join('\n');
  }
}
