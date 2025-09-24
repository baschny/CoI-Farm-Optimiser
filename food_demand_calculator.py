from collections import defaultdict

# --- Food category data ---
all_foods = {
    "Potatoes":     ("Carbs",    4.20),
    "Corn":       ("Carbs",    3.00),
    "Bread":      ("Carbs",    2.00),
    "Meat":       ("Protein",  2.70),
    "Eggs":       ("Protein",  3.00),
    "Tofu":       ("Protein",  1.80),
    "Sausage":    ("Protein",  3.35),
    "Vegetables": ("Vitamins", 4.20),
    "Fruit":      ("Vitamins", 3.15),
    "Snack":      ("Treats",   2.60),
    "Cake":       ("Treats",   2.50),
}

# --- Demand calculator ---


def calculate_food_demand(population: int, multiplier: float, selected_foods: list[str]):
    provided = [(f, *all_foods[f]) for f in selected_foods if f in all_foods]
    if not provided:
        return {"error": "No valid food selected."}

    # Group foods by category
    cat_to_foods = defaultdict(list)
    for name, cat, A in provided:
        cat_to_foods[cat].append((name, A))

    Nc = len(cat_to_foods)  # number of fulfilled food categories
    total = 0
    breakdown = {}

    for cat, foods in cat_to_foods.items():
        N = len(foods)
        for name, A in foods:
            demand_per_100 = A / (Nc * N)
            monthly = (population / 100) * demand_per_100 * multiplier
            total += monthly
            breakdown[name] = round(monthly, 1)

    return {
        "population": population,
        "multiplier": multiplier,
        "categories_fulfilled": Nc,
        "total_monthly_demand": round(total, 1),
        "demand_by_food": breakdown
    }