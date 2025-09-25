import io
import sys
import time

# --- Import your existing logic modules ---
from food_demand_calculator import calculate_food_demand
from genetic_search import run_genetic_search
from crop_rotation_simulator import crops as crop_db

# --- Define constants that the logic depends on ---
FOOD_TO_CROP_MAPPING = {"Bread": ("Wheat", 1.5),"Tofu": ("Soybean", 1.34),"Sausage": ("Wheat", 4),"Cake": ("Wheat", 1.4),"Snack": ("Corn", 1)}
DIRECT_CROPS = set(crop_db.keys())
FERTILIZER_LEVELS = [None, 80, 100, 120, 140]

def run_full_optimization(population, food_multiplier, food_to_produce, farm_configs, extra_reqs, pop_size, gens, mut_rate):
    """
    Runs the entire optimization process and returns the pre-formatted final report.
    """
    start_time = time.time()
    old_stdout = sys.stdout
    sys.stdout = captured_output = io.StringIO()

    try:
        # --- Core Logic ---
        demand = calculate_food_demand(population, food_multiplier, food_to_produce)
        food_demand = demand["demand_by_food"]
        print(f"Food Demand Calculated (Multiplier: {food_multiplier}):", food_demand)

        filtered_foods, skipped_foods = [], []
        for food in food_to_produce:
            if food in FOOD_TO_CROP_MAPPING or food in DIRECT_CROPS:
                filtered_foods.append(food)
            else:
                skipped_foods.append(food)
        if skipped_foods:
            print(f"Skipping foods not produced at farms: {skipped_foods}")

        crop_demand, crops_required = {}, set()
        for food in filtered_foods:
            if food in FOOD_TO_CROP_MAPPING:
                crop, mult = FOOD_TO_CROP_MAPPING[food]
                crop_demand[crop] = crop_demand.get(crop, 0) + food_demand.get(food, 0) / mult
                crops_required.add(crop)
            else:
                crop_demand[food] = food_demand.get(food, 0)
                crops_required.add(food)

        for crop, amount in extra_reqs.items():
            crop_demand[crop] = crop_demand.get(crop, 0) + amount
            crops_required.add(crop)

        print("\n--- Starting Genetic Optimization ---")
        
        result_data = run_genetic_search(
            crop_demand, list(crops_required), farm_configs, FERTILIZER_LEVELS,
            pop_size, gens, mut_rate
        )
        
        end_time = time.time()
        
        # --- Format the final report using the new detailed function ---
        report_string = format_results_text(result_data, crop_demand, farm_configs, end_time - start_time)

        sys.stdout = old_stdout
        text_log = captured_output.getvalue()

        # Return the initial log and the fully formatted final report
        return text_log, report_string

    except Exception as e:
        sys.stdout = old_stdout
        error_message = f"An error occurred during optimization:\n{e}"
        return error_message, ""

# --- MODIFICATION: This function now creates the entire final report ---
def format_results_text(result_data, crop_demand, farm_configs, runtime):
    """
    Takes all necessary data and formats it into the final human-readable report.
    """
    output_lines = ["\n\n🌿 Genetic Optimization Results 🌿"]

    if not result_data or not result_data[2]:
        output_lines.append("\n❌ No optimal configuration found that satisfies the demand.")
        output_lines.append(f"\n⏱️ Total Runtime: {runtime:.2f} seconds")
        return "\n".join(output_lines)

    best_fertilizer, best_water, best_config = result_data
    
    output_lines.append(f"\n✅ Optimal Configuration Found!")
    output_lines.append(f"🌱 Total Fertilizer Usage: {best_fertilizer:.1f} units/month")
    output_lines.append(f"💧 Total Water Usage: {best_water:.1f} units/month")

    output_lines.append("\n🚜 Farm/Greenhouse Rotations:")
    rotations, yields, building_types = best_config
    for idx, (rotation, fert) in enumerate(rotations):
        rot_str = " → ".join(rotation)
        fert_str = f"{fert}%" if fert is not None else "Off"
        b_type = building_types[idx]
        b_name = b_type.replace('_', ' ').title()
        b_icon = "🏢" if "greenhouse" in b_type else "🚜"
        output_lines.append(f"  {b_icon} {b_name:<18} | Rotation: {rot_str:<40} | Fertility: {fert_str:>6}")

    output_lines.append("\n📦 Combined Monthly Crop Output:")
    for crop, total_yield in sorted(yields.items()):
        demand_val = crop_demand.get(crop, 0)
        if demand_val > 0:
            output_lines.append(f"  🌽️ {crop}: {total_yield:.1f} units/month (Required: {demand_val:.1f})")
        else:
            output_lines.append(f"  🌽️ {crop}: {total_yield:.1f} units/month")

    active_configs = [(bt, count) for bt, count in farm_configs if count > 0]
    total_buildings = sum(count for _, count in active_configs)

    output_lines.append(f"\n⏱️ Total Runtime: {runtime:.2f} seconds")
    
    return "\n".join(output_lines)