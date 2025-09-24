import tkinter as tk
from tkinter import ttk, scrolledtext
import threading
import queue

# --- Import the refactored logic ---
from optimization_logic import run_full_optimization
from food_demand_calculator import all_foods

class ToolTip:
    """Creates a tooltip for a given widget."""
    def __init__(self, widget, text):
        self.widget = widget; self.text = text; self.tooltip_window = None
        widget.bind("<Enter>", self.show_tooltip); widget.bind("<Leave>", self.hide_tooltip)
    def show_tooltip(self, event):
        x, y, _, _ = self.widget.bbox("insert")
        x += self.widget.winfo_rootx() + 25; y += self.widget.winfo_rooty() + 25
        self.tooltip_window = tk.Toplevel(self.widget); self.tooltip_window.wm_overrideredirect(True)
        self.tooltip_window.wm_geometry(f"+{x}+{y}")
        label = tk.Label(self.tooltip_window, text=self.text, justify='left', background="#ffffe0", relief='solid', borderwidth=1, font=("tahoma", "8", "normal"))
        label.pack(ipadx=1)
    def hide_tooltip(self, event):
        if self.tooltip_window: self.tooltip_window.destroy()
        self.tooltip_window = None

class CropOptimizerApp(tk.Tk):
    """Main application class for the Crop Optimizer GUI."""
    def __init__(self):
        super().__init__()
        self.title("Captain of Industry - Crop Rotation Optimizer"); self.geometry("900x850")

        self.VALID_FOODS = list(all_foods.keys())
        self.ALL_BUILDING_TYPES = ["farm", "greenhouse_tier1", "greenhouse_tier2"]
        self.ALL_CROPS = ["Potatoes", "Corn", "Wheat", "Vegetables", "Soybean", "Fruit", "Canola"]
        self.result_queue = queue.Queue()

        main_frame = ttk.Frame(self, padding="10"); main_frame.pack(fill=tk.BOTH, expand=True)
        main_frame.grid_rowconfigure(1, weight=1); main_frame.grid_columnconfigure(0, weight=1); main_frame.grid_columnconfigure(1, weight=1)

        self.create_input_widgets(main_frame)
        self.create_output_widgets(main_frame)
        self.create_control_widgets(main_frame)

    def create_input_widgets(self, parent):
        primary_frame = ttk.LabelFrame(parent, text="⚙️ Primary Inputs", padding="10")
        primary_frame.grid(row=0, column=0, sticky="nsew", padx=5, pady=5)

        ttk.Label(primary_frame, text="Population:").grid(row=0, column=0, sticky="w", pady=2)
        self.population_var = tk.IntVar(value=2560)
        ttk.Entry(primary_frame, textvariable=self.population_var, width=10).grid(row=0, column=1, sticky="w", pady=2)

        ttk.Label(primary_frame, text="Food Multiplier:").grid(row=1, column=0, sticky="w", pady=2)
        self.food_multiplier_var = tk.DoubleVar(value=1.0)
        ttk.Entry(primary_frame, textvariable=self.food_multiplier_var, width=10).grid(row=1, column=1, sticky="w", pady=2)

        foods_container_frame = ttk.LabelFrame(primary_frame, text="Foods to Produce", padding=5)
        foods_container_frame.grid(row=2, column=0, columnspan=2, sticky="ew", pady=5)
        foods_container_frame.grid_columnconfigure(0, weight=1)
        foods_container_frame.grid_columnconfigure(1, weight=1)
        
        food_categories = {
            "Carbs": ["Potatoes", "Corn", "Bread"], "Protein": ["Meat", "Eggs", "Tofu", "Sausage"],
            "Vitamins": ["Vegetables", "Fruit"], "Treats": ["Snack", "Cake"]
        }
        self.food_vars = {}
        initial_foods = ["Potatoes", "Corn", "Vegetables", "Bread", "Eggs", "Fruit"]

        for i, (category, foods) in enumerate(food_categories.items()):
            cat_frame = ttk.LabelFrame(foods_container_frame, text=category)
            cat_frame.grid(row=i//2, column=i%2, sticky="nsew", padx=5, pady=2)
            for food in foods:
                if food in self.VALID_FOODS:
                    var = tk.BooleanVar(value=(food in initial_foods))
                    cb = ttk.Checkbutton(cat_frame, text=food, variable=var)
                    cb.pack(anchor="w", padx=5, pady=1)
                    self.food_vars[food] = var

        building_frame = ttk.LabelFrame(primary_frame, text="Building Configuration", padding="5")
        building_frame.grid(row=3, column=0, columnspan=2, sticky="ew", pady=5)
        self.building_vars = {}
        initial_buildings = {"farm": 4, "greenhouse_tier1": 2, "greenhouse_tier2": 0}
        for i, b_type in enumerate(self.ALL_BUILDING_TYPES):
            name = b_type.replace('_', ' ').title()
            ttk.Label(building_frame, text=f"{name}:").grid(row=i, column=0, sticky="w", padx=5, pady=2)
            var = tk.IntVar(value=initial_buildings.get(b_type, 0))
            ttk.Entry(building_frame, textvariable=var, width=5).grid(row=i, column=1, sticky="w", padx=5, pady=2)
            self.building_vars[b_type] = var

        advanced_frame = ttk.LabelFrame(parent, text="🔬 Advanced Settings", padding="10")
        advanced_frame.grid(row=0, column=1, sticky="nsew", padx=5, pady=5)

        ga_frame = ttk.LabelFrame(advanced_frame, text="Genetic Algorithm Parameters", padding="5")
        ga_frame.grid(row=0, column=0, sticky="ew", pady=5)
        
        ttk.Label(ga_frame, text="Population Size:").grid(row=0, column=0, sticky="w", pady=2)
        self.ga_pop_var = tk.IntVar(value=3000)
        ttk.Entry(ga_frame, textvariable=self.ga_pop_var, width=10).grid(row=0, column=1, sticky="w", pady=2)
        
        ttk.Label(ga_frame, text="Generations:").grid(row=1, column=0, sticky="w", pady=2)
        self.ga_gen_var = tk.IntVar(value=5000)
        ttk.Entry(ga_frame, textvariable=self.ga_gen_var, width=10).grid(row=1, column=1, sticky="w", pady=2)
        
        ttk.Label(ga_frame, text="Mutation Rate:").grid(row=2, column=0, sticky="w", pady=2)
        self.ga_mut_var = tk.DoubleVar(value=0.4)
        ttk.Entry(ga_frame, textvariable=self.ga_mut_var, width=10).grid(row=2, column=1, sticky="w", pady=2)

        extra_frame = ttk.LabelFrame(advanced_frame, text="Extra Non-Food Crop Requirements", padding="5")
        extra_frame.grid(row=1, column=0, sticky="ew", pady=5)
        
        self.extra_req_vars = {}
        cols = 2
        for i, crop_name in enumerate(self.ALL_CROPS):
            default_val = 40 if crop_name == "Corn" else 0
            var = tk.IntVar(value=default_val)
            label = ttk.Label(extra_frame, text=f"{crop_name}:")
            entry = ttk.Entry(extra_frame, textvariable=var, width=8)
            row_num = i // cols; col_num = (i % cols) * 2
            label.grid(row=row_num, column=col_num, sticky="w", padx=5, pady=2)
            entry.grid(row=row_num, column=col_num + 1, sticky="w", pady=2)
            self.extra_req_vars[crop_name] = var

    def create_output_widgets(self, parent):
        output_frame = ttk.LabelFrame(parent, text="📊 Results", padding="10")
        output_frame.grid(row=1, column=0, columnspan=2, sticky="nsew", padx=5, pady=5)
        output_frame.grid_rowconfigure(0, weight=1); output_frame.grid_columnconfigure(0, weight=1)
        self.output_text = scrolledtext.ScrolledText(output_frame, wrap=tk.WORD, state="disabled", font=("Courier New", 9))
        self.output_text.grid(row=0, column=0, sticky="nsew")

    def create_control_widgets(self, parent):
        control_frame = ttk.Frame(parent, padding="5")
        control_frame.grid(row=2, column=0, columnspan=2, sticky="ew")
        control_frame.grid_columnconfigure(0, weight=1)
        self.run_button = ttk.Button(control_frame, text="🚀 Run Optimization", command=self.start_optimization)
        self.run_button.grid(row=0, column=0, sticky="e", padx=5)
        self.status_var = tk.StringVar(value="Ready.")
        status_bar = ttk.Label(control_frame, textvariable=self.status_var, anchor="w")
        status_bar.grid(row=0, column=1, sticky="w", padx=5)

    def get_extra_requirements(self):
        reqs = {}
        try:
            for crop_name, var in self.extra_req_vars.items():
                amount = var.get()
                if amount > 0:
                    reqs[crop_name] = float(amount)
            return reqs
        except (ValueError, tk.TclError):
            self.update_output("Error: Invalid input for Extra Requirements. Please enter numbers only.")
            return None

    def start_optimization(self):
        self.run_button.config(state="disabled"); self.status_var.set("Processing... Gathers inputs."); self.update_idletasks()
        extra_crop_requirements = self.get_extra_requirements()
        if extra_crop_requirements is None:
            self.run_button.config(state="normal"); self.status_var.set("Ready. Invalid input.")
            return

        params = {
            "population": self.population_var.get(), "food_multiplier": self.food_multiplier_var.get(),
            "food_to_produce": [food for food, var in self.food_vars.items() if var.get()],
            "farm_configs": [(b_type, var.get()) for b_type, var in self.building_vars.items()],
            "extra_reqs": extra_crop_requirements, "pop_size": self.ga_pop_var.get(),
            "gens": self.ga_gen_var.get(), "mut_rate": self.ga_mut_var.get()
        }

        self.status_var.set("Running genetic algorithm... This may take a while.")
        thread = threading.Thread(target=self.optimization_worker, args=(params,))
        thread.daemon = True; thread.start()
        self.after(100, self.check_for_result)

    def optimization_worker(self, params):
        try:
            # The logic function now returns the log and the final formatted report
            text_log, final_report = run_full_optimization(**params)
            self.result_queue.put((text_log, final_report))
        except Exception as e:
            self.result_queue.put((f"A critical error occurred: {e}", None))

    def check_for_result(self):
        try:
            text_log, final_report = self.result_queue.get_nowait()
            self.display_final_results(text_log, final_report)
            self.status_var.set("✅ Done."); self.run_button.config(state="normal")
        except queue.Empty:
            self.after(100, self.check_for_result)
            
    def update_output(self, text):
        self.output_text.config(state="normal"); self.output_text.delete('1.0', tk.END)
        self.output_text.insert(tk.END, text); self.output_text.config(state="disabled")

    # --- MODIFICATION: This function is now much simpler ---
    def display_final_results(self, text_log, final_report):
        """Displays the log and the pre-formatted report from the logic module."""
        full_output = text_log + (final_report or "")
        self.update_output(full_output)

if __name__ == "__main__":
    app = CropOptimizerApp()
    app.mainloop()