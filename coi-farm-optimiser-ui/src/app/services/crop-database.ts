import { BuildingType, Crop } from '../models/crop.model';

export const CROP_DATABASE: Record<string, Crop> = {
  'Green Manure': { name: 'Green Manure', durationDays: 60, waterUsage: 54, fertilityChange: 7.2, totalYield: 0 },
  Potatoes: { name: 'Potatoes', durationDays: 90, waterUsage: 108, fertilityChange: -31.5, totalYield: 58 },
  Corn: { name: 'Corn', durationDays: 120, waterUsage: 160, fertilityChange: -48, totalYield: 66 },
  Wheat: { name: 'Wheat', durationDays: 180, waterUsage: 191, fertilityChange: -63, totalYield: 58 },
  Vegetables: { name: 'Vegetables', durationDays: 120, waterUsage: 128, fertilityChange: -42, totalYield: 60 },
  Soybean: { name: 'Soybean', durationDays: 120, waterUsage: 144, fertilityChange: -60, totalYield: 22 },
  Fruit: { name: 'Fruit', durationDays: 240, waterUsage: 319, fertilityChange: -72, totalYield: 80 },
  Canola: { name: 'Canola', durationDays: 90, waterUsage: 84, fertilityChange: -27, totalYield: 36 }
};

export function getBuildingModifiers(buildingType: BuildingType): [number, number, number] {
  switch (buildingType) {
    case 'farm':
      return [1, 1, 1];
    case 'greenhouse_tier1':
      return [1.25, 1.12, 1.12];
    case 'greenhouse_tier2':
      return [1.5, 1.25, 1.25];
    default:
      throw new Error(`Unknown building type: ${buildingType as string}`);
  }
}
