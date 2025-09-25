import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  NgbAccordionModule,
  NgbAlertModule,
  NgbBadgeModule,
  NgbButtonsModule,
  NgbCollapseModule,
  NgbProgressbarModule,
  NgbTooltipModule
} from '@ng-bootstrap/ng-bootstrap';
import { OptimizationService } from './services/optimization.service';
import { FOOD_DEFINITIONS } from './services/food-demand.service';
import { CROP_DATABASE } from './services/crop-database';
import { BuildingType } from './models/crop.model';
import { OptimizationRequest } from './models/optimization.model';
import { signal } from '@angular/core';

interface FoodCategoryGroup {
  name: string;
  foods: string[];
  icon: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgbAccordionModule,
    NgbAlertModule,
    NgbBadgeModule,
    NgbButtonsModule,
    NgbCollapseModule,
    NgbProgressbarModule,
    NgbTooltipModule
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  readonly title = 'Captain of Industry – Farm Optimiser';
  readonly foodCategories: FoodCategoryGroup[] = [
    { name: 'Carbs', foods: ['Potatoes', 'Corn', 'Bread'], icon: '🥖' },
    { name: 'Protein', foods: ['Meat', 'Eggs', 'Tofu', 'Sausage'], icon: '🥩' },
    { name: 'Vitamins', foods: ['Vegetables', 'Fruit'], icon: '🥕' },
    { name: 'Treats', foods: ['Snack', 'Cake'], icon: '🍰' }
  ];
  readonly buildingTypes: { id: BuildingType; label: string; description: string }[] = [
    { id: 'farm', label: 'Open Farm', description: 'Base yield, normal water and fertiliser usage.' },
    {
      id: 'greenhouse_tier1',
      label: 'Greenhouse Tier 1',
      description: '+25% yield, +12% water and fertiliser demand.'
    },
    {
      id: 'greenhouse_tier2',
      label: 'Greenhouse Tier 2',
      description: '+50% yield, +25% water and fertiliser demand.'
    }
  ];
  readonly extraCrops = Object.keys(CROP_DATABASE).filter((crop) => crop !== 'Green Manure');

  readonly optimiserForm: FormGroup;
  readonly logOutput = signal('');
  readonly reportOutput = signal('');
  readonly errorMessage = signal<string | null>(null);
  readonly isRunning = signal(false);

  constructor(
    private readonly fb: FormBuilder,
    private readonly optimisationService: OptimizationService,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.optimiserForm = this.fb.group({
      population: [1000, [Validators.required, Validators.min(1)]],
      foodMultiplier: [1, [Validators.required, Validators.min(0.1)]],
      foods: this.fb.group(
        Object.fromEntries(
          Object.keys(FOOD_DEFINITIONS).map((food) => [food, [this.getDefaultFoodSelection(food)]])
        )
      ),
      farmConfigs: this.fb.group({
        farm: [4, [Validators.required, Validators.min(0)]],
        greenhouse_tier1: [0, [Validators.required, Validators.min(0)]],
        greenhouse_tier2: [0, [Validators.required, Validators.min(0)]]
      }),
      ga: this.fb.group({
        populationSize: [200, [Validators.required, Validators.min(10)]],
        generations: [80, [Validators.required, Validators.min(10)]],
        mutationRate: [0.2, [Validators.required, Validators.min(0), Validators.max(1)]]
      }),
      extraCrops: this.fb.group(
        Object.fromEntries(this.extraCrops.map((crop) => [crop, [0, [Validators.min(0)]]]))
      )
    });
  }

  selectedFoodCount(): number {
    const foods = (this.optimiserForm.get('foods') as FormGroup).value as Record<string, boolean>;
    return Object.values(foods).filter(Boolean).length;
  }

  runOptimisation(): void {
    if (this.optimiserForm.invalid) {
      this.optimiserForm.markAllAsTouched();
      this.errorMessage.set('Please fix validation errors before running the optimiser.');
      return;
    }

    const request = this.buildRequest();
    this.errorMessage.set(null);
    this.logOutput.set('');
    this.reportOutput.set('');
    this.isRunning.set(true);
    this.cdr.markForCheck();

    setTimeout(() => {
      try {
        const response = this.optimisationService.runOptimization(request);
        this.logOutput.set(response.log);
        this.reportOutput.set(response.report);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error during optimisation run.';
        this.errorMessage.set(message);
      } finally {
        this.isRunning.set(false);
        this.cdr.markForCheck();
      }
    });
  }

  resetForm(): void {
    this.optimiserForm.reset({
      population: 1000,
      foodMultiplier: 1,
      foods: Object.fromEntries(
        Object.keys(FOOD_DEFINITIONS).map((food) => [food, this.getDefaultFoodSelection(food)])
      ),
      farmConfigs: { farm: 4, greenhouse_tier1: 0, greenhouse_tier2: 0 },
      ga: { populationSize: 200, generations: 80, mutationRate: 0.2 },
      extraCrops: Object.fromEntries(this.extraCrops.map((crop) => [crop, 0]))
    });
    this.logOutput.set('');
    this.reportOutput.set('');
    this.errorMessage.set(null);
  }

  trackByIndex(index: number): number {
    return index;
  }

  private buildRequest(): OptimizationRequest {
    const formValue = this.optimiserForm.value as {
      population: number;
      foodMultiplier: number;
      foods: Record<string, boolean>;
      farmConfigs: Record<string, number>;
      ga: { populationSize: number; generations: number; mutationRate: number };
      extraCrops: Record<string, number>;
    };

    const foodSelections = Object.entries(formValue.foods)
      .filter(([, selected]) => !!selected)
      .map(([food]) => food);

    const farmConfigs = Object.entries(formValue.farmConfigs).map(([buildingType, count]) => ({
      buildingType: buildingType as BuildingType,
      count: Number(count)
    }));

    return {
      population: Number(formValue.population),
      foodMultiplier: Number(formValue.foodMultiplier),
      foodSelections,
      farmConfigs,
      extraCropRequirements: Object.fromEntries(
        Object.entries(formValue.extraCrops).map(([crop, amount]) => [crop, Number(amount ?? 0)])
      ),
      populationSize: Number(formValue.ga.populationSize),
      generations: Number(formValue.ga.generations),
      mutationRate: Number(formValue.ga.mutationRate)
    };
  }

  private getDefaultFoodSelection(food: string): boolean {
    return ['Potatoes', 'Corn', 'Vegetables'].includes(food);
  }
}
