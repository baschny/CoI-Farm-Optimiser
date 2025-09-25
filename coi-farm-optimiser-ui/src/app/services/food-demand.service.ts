import { Injectable } from '@angular/core';
import { FoodDemandResult } from '../models/demand.model';

type FoodCategory = 'Carbs' | 'Protein' | 'Vitamins' | 'Treats';

interface FoodDefinition {
  category: FoodCategory;
  coefficient: number;
}

export const FOOD_DEFINITIONS: Record<string, FoodDefinition> = {
  Potatoes: { category: 'Carbs', coefficient: 4.2 },
  Corn: { category: 'Carbs', coefficient: 3 },
  Bread: { category: 'Carbs', coefficient: 2 },
  Meat: { category: 'Protein', coefficient: 2.7 },
  Eggs: { category: 'Protein', coefficient: 3 },
  Tofu: { category: 'Protein', coefficient: 1.8 },
  Sausage: { category: 'Protein', coefficient: 3.35 },
  Vegetables: { category: 'Vitamins', coefficient: 4.2 },
  Fruit: { category: 'Vitamins', coefficient: 3.15 },
  Snack: { category: 'Treats', coefficient: 2.6 },
  Cake: { category: 'Treats', coefficient: 2.5 }
};

@Injectable({ providedIn: 'root' })
export class FoodDemandService {
  calculateFoodDemand(population: number, multiplier: number, selectedFoods: string[]): FoodDemandResult {
    const provided = selectedFoods
      .filter((food) => FOOD_DEFINITIONS[food])
      .map((food) => ({ name: food, ...FOOD_DEFINITIONS[food]! }));

    if (provided.length === 0) {
      return {
        population,
        multiplier,
        categoriesFulfilled: 0,
        totalMonthlyDemand: 0,
        demandByFood: {},
        error: 'No valid food selected.'
      };
    }

    const categoryMap = new Map<FoodCategory, { name: string; coefficient: number }[]>();
    provided.forEach((food) => {
      const foods = categoryMap.get(food.category) ?? [];
      foods.push({ name: food.name, coefficient: food.coefficient });
      categoryMap.set(food.category, foods);
    });

    const categoriesFulfilled = categoryMap.size;
    const demandByFood: Record<string, number> = {};
    let total = 0;

    categoryMap.forEach((foods) => {
      const count = foods.length;
      foods.forEach((food) => {
        const demandPer100 = food.coefficient / (categoriesFulfilled * count);
        const monthly = (population / 100) * demandPer100 * multiplier;
        demandByFood[food.name] = Math.round(monthly * 10) / 10;
        total += monthly;
      });
    });

    return {
      population,
      multiplier,
      categoriesFulfilled,
      totalMonthlyDemand: Math.round(total * 10) / 10,
      demandByFood
    };
  }
}
