import { Injectable } from '@angular/core';
import { BuildingType, Crop, RotationSummary } from '../models/crop.model';
import { CROP_DATABASE, getBuildingModifiers } from './crop-database';

@Injectable({ providedIn: 'root' })
export class RotationSimulatorService {
  simulateRotation(rotation: string[], buildingType: BuildingType, fertilityTarget: number | null): RotationSummary {
    if (rotation.length === 0) {
      throw new Error('Rotation must contain at least one crop.');
    }

    const crops: Crop[] = rotation.map((name) => {
      const crop = CROP_DATABASE[name];
      if (!crop) {
        throw new Error(`Unknown crop: ${name}`);
      }
      return crop;
    });

    const [yieldMultiplier, waterMultiplier, fertilizerMultiplier] = getBuildingModifiers(buildingType);

    const adjustedCrops = crops.map((crop, index) => {
      const prevCrop = crops[(index - 1 + crops.length) % crops.length];
      const fertilityChange = crop.name === prevCrop.name ? crop.fertilityChange * 1.5 : crop.fertilityChange;
      return {
        ...crop,
        waterUsage: crop.waterUsage * waterMultiplier,
        totalYield: crop.totalYield * yieldMultiplier,
        fertilityChange
      } satisfies Crop;
    });

    const totalDays = adjustedCrops.reduce((sum, crop) => sum + crop.durationDays, 0);
    if (totalDays === 0) {
      throw new Error('Rotation has a zero total duration.');
    }

    const totalFertility = adjustedCrops.reduce((sum, crop) => sum + crop.fertilityChange, 0);
    const totalYield = adjustedCrops.reduce((sum, crop) => sum + crop.totalYield, 0);
    const totalWater = adjustedCrops.reduce((sum, crop) => sum + crop.waterUsage, 0);

    const fertilityPerDay = totalFertility / totalDays;
    const yieldPerDay = totalYield / totalDays;
    const waterPerDay = totalWater / totalDays;

    const fertilityPerMonth = fertilityPerDay * 30;
    const yieldPerMonthRaw = yieldPerDay * 30;
    const waterPerMonth = waterPerDay * 30;

    let equilibrium: number;
    let fertilityFactor: number;
    let fertilizerRequired = 0;

    if (fertilityTarget === null) {
      equilibrium = fertilityPerDay >= 0 ? 100 : 100 - Math.abs(fertilityPerDay * 100);
      equilibrium = Math.min(100, Math.max(0, equilibrium));
      fertilityFactor = equilibrium / 100;
    } else {
      let fertilityRegenPerDay: number;
      if (fertilityTarget <= 100) {
        fertilityRegenPerDay = 0.01 * (100 - fertilityTarget);
      } else {
        const excess = fertilityTarget - 100;
        fertilityRegenPerDay = ((fertilityPerDay / 10) * 2 - 0.02) * (excess / 10);
      }

      const fertilityDeficitPerDay = Math.abs(fertilityPerDay) - fertilityRegenPerDay;
      fertilizerRequired = Math.max(0, fertilityDeficitPerDay * 30) * fertilizerMultiplier;
      fertilityFactor = fertilityTarget / 100;
      equilibrium = fertilityTarget;
    }

    const effectiveYield = yieldPerMonthRaw * fertilityFactor;
    const individualEffectiveYields = adjustedCrops.reduce<Record<string, number>>((acc, crop) => {
      const contribution = ((crop.totalYield / totalDays) * 30) * fertilityFactor;
      acc[crop.name] = (acc[crop.name] ?? 0) + contribution;
      return acc;
    }, {});

    return {
      rotation: crops.map((c) => c.name),
      buildingType,
      totalDurationDays: totalDays,
      fertilityPerMonth,
      yieldPerMonthRaw,
      waterPerMonth,
      fertilityEquilibrium: equilibrium,
      effectiveYieldPerMonth: effectiveYield,
      individualEffectiveYields,
      fertilizerRequiredPerMonth: fertilizerRequired,
      buildingModifiers: {
        yieldMultiplier,
        waterMultiplier,
        fertilizerMultiplier
      }
    };
  }
}
