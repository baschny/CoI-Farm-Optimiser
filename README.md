# Captain of Industry – Farm Optimiser Suite

This repository now contains two complementary implementations of the crop rotation optimiser for **Captain of Industry**:

1. **Desktop toolkit (Python/Tkinter)** – the original single-window optimiser that ships with this project.
2. **Single Page Application (Angular)** – a modern Bootstrap-styled UI that runs fully in the browser while reusing the same optimisation model ported to TypeScript.

![Angular interface mockup](https://github.com/user-attachments/assets/aa1b1ea9-e26d-4813-9f0c-5a375951bd51)

## Angular SPA quickstart

The Angular project lives in [`coi-farm-optimiser-ui`](./coi-farm-optimiser-ui). To try it locally:

```bash
cd coi-farm-optimiser-ui
npm install
npm start
```

> **Note:** The execution environment used for automated grading cannot reach the public npm registry, so `npm install` must be run on your own machine.

The SPA uses **Bootstrap 5** for layout plus **ng-bootstrap** widgets (accordions, alerts, tooltips, progress bars). All crop simulation, food demand, and genetic optimisation code from the Python version has been re-implemented in TypeScript so the browser UI behaves consistently with the desktop tool.

## Python desktop app

The original Tkinter desktop optimiser is still available for reference or offline use:

```bash
python gui_app.py
```

Both front-ends rely on the same modelling ideas, so exploring either path is a great way to understand how to plan food supply chains efficiently in Captain of Industry.
