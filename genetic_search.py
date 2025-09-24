# --- genetic_search.py ---
import itertools
import random
from crop_rotation_simulator import crops, simulate_rotation

# --- Simulation cache ---
simulation_cache = {}
def cached_simulate_rotation(rotation, fert_level, building_type):
    key = (rotation, fert_level, building_type)
    if key in simulation_cache:
        return simulation_cache[key]
    result = simulate_rotation([crops[crop] for crop in rotation],
                             building_type=building_type,
                             fertility_target=fert_level)
    simulation_cache[key] = result
    return result

# --- Genetic search entry point ---
def run_genetic_search(food_demand, crop_list, farm_configs, fertilizer_levels,
                      pop_size=100, generations=50, mutation_rate=0.2):
    """
    Enhanced genetic search with building type support.
    """
    # --- Generate valid crop rotations ---
    def generate_base_rotations(crops_list):
        rotations = []
        for r in range(1, 5):
            for combo in itertools.combinations_with_replacement(crops_list, r):
                if any(combo[i] == combo[i + 1] for i in range(len(combo) - 1)):
                    continue
                rotations.append(combo)
        return rotations

    base_rotations = generate_base_rotations(crop_list)
    farm_safe_rotations = [rot for rot in base_rotations if "Fruit" not in rot]

    building_specific_options = {
        "farm": list(itertools.product(farm_safe_rotations, fertilizer_levels)),
        "greenhouse_tier1": list(itertools.product(base_rotations, fertilizer_levels)),
        "greenhouse_tier2": list(itertools.product(base_rotations, fertilizer_levels)),
    }

    active_farm_configs = [(building_type, count) for building_type, count in farm_configs if count > 0]
    total_farms = sum(count for _, count in active_farm_configs)
    building_types = []
    for building_type, count in active_farm_configs:
        building_types.extend([building_type] * count)

    # --- Fitness evaluation ---
    def evaluate_individual(individual):
        combined_output = {crop: 0 for crop in crop_list}
        total_fertilizer_used = 0
        total_water_used = 0  # MODIFICATION: Initialize water usage

        for i, (rotation, fert_level) in enumerate(individual):
            building_type = building_types[i]
            result = cached_simulate_rotation(rotation, fert_level, building_type)
            total_fertilizer_used += result["fertilizer_required_per_month"]
            total_water_used += result["water_per_month"] # MODIFICATION: Accumulate water usage
            for crop, yield_amount in result["individual_effective_yields"].items():
                if crop in combined_output:
                    combined_output[crop] += yield_amount

        if all(combined_output.get(crop, 0) >= food_demand.get(crop, 0) for crop in food_demand):
            # MODIFICATION: Return water usage along with other stats
            return total_fertilizer_used, total_water_used, combined_output
        else:
            return float('inf'), float('inf'), None

    # --- Genetic operations (no changes here) ---
    def mutate(individual):
        new_individual = list(individual)
        for i in range(len(new_individual)):
            if random.random() < mutation_rate:
                building_type = building_types[i]
                new_individual[i] = random.choice(building_specific_options[building_type])
        return tuple(new_individual)

    def crossover(parent1, parent2):
        point = random.randint(1, total_farms - 1) if total_farms > 1 else 0
        return tuple(parent1[:point] + parent2[point:])

    # --- Initialize population ---
    def generate_individual():
        individual = []
        for building_type in building_types:
            individual.append(random.choice(building_specific_options[building_type]))
        return tuple(individual)

    population = [generate_individual() for _ in range(pop_size)]
    best_fertilizer_usage = float('inf')
    best_water_usage = float('inf') # MODIFICATION: Initialize best water usage
    best_config = None

    for generation in range(generations):
        scored = []
        for individual in population:
            # MODIFICATION: Unpack the new water_use value
            fert_use, water_use, output = evaluate_individual(individual)
            scored.append((fert_use, individual, output, water_use)) # MODIFICATION: Add water_use to scored list
            if fert_use < best_fertilizer_usage and output is not None:
                best_fertilizer_usage = fert_use
                best_water_usage = water_use # MODIFICATION: Save water usage of the best configuration
                best_config = (individual, output, building_types)

        scored.sort(key=lambda x: x[0])
        # MODIFICATION: Unpack correctly to rebuild survivor population
        survivors = [ind for _, ind, _, _ in scored[:pop_size // 2]]
        population = survivors[:]

        while len(population) < pop_size:
            p1, p2 = random.sample(survivors, 2)
            child = mutate(crossover(p1, p2))
            population.append(child)

    # MODIFICATION: Return the new best_water_usage value
    return best_fertilizer_usage, best_water_usage, best_config