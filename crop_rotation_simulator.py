from dataclasses import dataclass
from typing import List, Optional, Literal

BuildingType = Literal["farm", "greenhouse_tier1", "greenhouse_tier2"]

# --- Crop class ---
@dataclass
class Crop:
    name: str
    duration_days: int
    water_usage: int
    fertility_change: float
    total_yield: float

# --- Crop database ---
crops = {
    "Green Manure": Crop(name="Green Manure", duration_days=60, water_usage=54, fertility_change=+7.2, total_yield=0.0),
    "Potatoes": Crop(name="Potatoes", duration_days=90, water_usage=108, fertility_change=-31.5, total_yield=58),
    "Corn": Crop(name="Corn", duration_days=120, water_usage=160, fertility_change=-48.0, total_yield=66),
    "Wheat": Crop(name="Wheat", duration_days=180, water_usage=191, fertility_change=-63.0, total_yield=58),
    "Vegetables": Crop(name="Vegetables", duration_days=120, water_usage=128, fertility_change=-42.0, total_yield=60),
    "Soybean": Crop(name="Soybean", duration_days=120, water_usage=144, fertility_change=-60.0, total_yield=22),
    "Fruit": Crop(name="Fruit", duration_days=240, water_usage=319, fertility_change=-72.0, total_yield=80),
    "Canola": Crop(name="Canola", duration_days=90, water_usage=84, fertility_change=-27.0, total_yield=36),
}

# --- Building modifiers ---
def get_building_modifiers(building_type: BuildingType):
    """Returns yield, water, and fertilizer multipliers for different building types"""
    if building_type == "farm":
        return 1.0, 1.0, 1.0  # yield, water, fertilizer
    elif building_type == "greenhouse_tier1":
        return 1.25, 1.12, 1.12  # +25% yield, +12% water/fertilizer
    elif building_type == "greenhouse_tier2":
        return 1.50, 1.25, 1.25  # +50% yield, +25% water/fertilizer
    else:
        raise ValueError(f"Unknown building type: {building_type}")
    
# --- Core calculation ---
def simulate_rotation(crops_in_rotation: List[Crop], 
                     building_type: BuildingType = "farm",
                     fertility_target: Optional[float] = None):
    
    # Get building modifiers
    yield_multiplier, water_multiplier, fertilizer_multiplier = get_building_modifiers(building_type)
    
    adjusted_crops = []

    for i, crop in enumerate(crops_in_rotation):
        fertility_change = crop.fertility_change
        prev_crop_name = crops_in_rotation[i - 1].name if i > 0 else crops_in_rotation[-1].name
        if crop.name == prev_crop_name:
            fertility_change *= 1.5

        # Apply building modifiers
        adjusted_water_usage = crop.water_usage * water_multiplier
        adjusted_yield = crop.total_yield * yield_multiplier

        adjusted_crops.append(Crop(
            name=crop.name,
            duration_days=crop.duration_days,
            water_usage=adjusted_water_usage,
            fertility_change=fertility_change,
            total_yield=adjusted_yield
        ))

    total_days = sum(c.duration_days for c in adjusted_crops)
    if total_days == 0:
        return {}

    total_fertility = sum(c.fertility_change for c in adjusted_crops)
    total_yield = sum(c.total_yield for c in adjusted_crops)
    total_water = sum(c.water_usage for c in adjusted_crops)

    fertility_per_day = total_fertility / total_days
    yield_per_day = total_yield / total_days
    water_per_day = total_water / total_days

    fertility_per_month = fertility_per_day * 30
    yield_per_month_raw = yield_per_day * 30
    water_per_month = water_per_day * 30

    # --- Fertility equilibrium or fertilizer needs ---
    if fertility_target is None:
        if fertility_per_day >= 0:
            equilibrium = 100.0
        else:
            equilibrium = 100 - abs(fertility_per_day * 100)
        equilibrium = max(0.0, min(100.0, equilibrium))
        fertility_factor = equilibrium / 100
        fertilizer_required = 0.0
    else:
        if fertility_target <= 100:
            fertility_regen_per_day = 0.01 * (100 - fertility_target)
        else:
            excess = fertility_target - 100
            fertility_regen_per_day = ((fertility_per_day / 10) * 2 - 0.02) * (excess / 10)

        fertility_deficit_per_day = abs(fertility_per_day) - fertility_regen_per_day
        fertilizer_required = max(0.0, fertility_deficit_per_day * 30)
        
        # Apply fertilizer multiplier for greenhouse buildings
        fertilizer_required *= fertilizer_multiplier
        
        fertility_factor = fertility_target / 100
        equilibrium = fertility_target

    effective_yield = yield_per_month_raw * fertility_factor

    crop_effective_yields = {}
    for crop in adjusted_crops:
        yield_contribution = (crop.total_yield / total_days) * 30 * fertility_factor
        crop_effective_yields[crop.name] = crop_effective_yields.get(crop.name, 0) + yield_contribution

    return {
        "rotation": [c.name for c in crops_in_rotation],
        "building_type": building_type,
        "total_duration_days": total_days,
        "fertility_per_month": fertility_per_month,
        "yield_per_month_raw": yield_per_month_raw,
        "water_per_month": water_per_month,
        "fertility_equilibrium": equilibrium,
        "effective_yield_per_month": effective_yield,
        "individual_effective_yields": crop_effective_yields,
        "fertilizer_required_per_month": fertilizer_required,
        "building_modifiers": {
            "yield_multiplier": yield_multiplier,
            "water_multiplier": water_multiplier,
            "fertilizer_multiplier": fertilizer_multiplier
        }
    }
