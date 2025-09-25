export interface FoodDemandResult {
  population: number;
  multiplier: number;
  categoriesFulfilled: number;
  totalMonthlyDemand: number;
  demandByFood: Record<string, number>;
  error?: string;
}
