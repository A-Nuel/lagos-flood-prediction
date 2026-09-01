import React, { useState, useEffect } from 'react';
import CaveatBanner from './components/CaveatBanner';
import FloodMap from './components/FloodMap';
import ScenarioControls from './components/ScenarioControls';
import CellDetails from './components/CellDetails';
import ModelTransparencyModal from './components/ModelTransparencyModal';
import { Shield, Waves, Info, MapPin, Database, Activity, ExternalLink } from 'lucide-react';

export default function App() {
  const [params, setParams] = useState({
    rainfall_mm: 35,
    rainfall_3d_sum: 80,
    rainfall_7d_sum: 150,
    is_rainy_season: 1,
    blockage_multiplier: 1.0,
    model_choice: 'random_forest'
  });

  const [gridData, setGridData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [keyLocations, setKeyLocations] = useState([]);
  const [activeLocation, setActiveLocation] = useState(null);
  const [loadingSimulation, setLoadingSimulation] = useState(false);
  const [transparencyModalOpen, setTransparencyModalOpen] = useState(false);

  // Load Initial Landmark Hotspots and Initial Simulation
  useEffect(() => {
    fetchKeyLocations();
    runSimulation();
  }, []);

  const fetchKeyLocations = async () => {
    try {
      const res = await fetch('/api/key-locations');
      const data = await res.json();
      if (data?.locations) {
        setKeyLocations(data.locations);
      }
    } catch (e) {
      console.error('Failed to load key locations:', e);
    }
  };

  const runSimulation = async () => {
    setLoadingSimulation(true);
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      const data = await res.json();
      if (data?.grid_predictions) {
        setGridData(data.grid_predictions);
        setSummary(data.summary);

        // If a cell was selected, update its predicted probability under the new simulation
        if (selectedCell) {
          const updated = data.grid_predictions.find((c) => c.grid_id === selectedCell.grid_id);
          if (updated) setSelectedCell(updated);
        } else if (data.grid_predictions.length > 0) {
          // Default selection to first severe or high blockage cell
          const defaultCell = data.grid_predictions.find((c) => c.tier === 'severe') || data.grid_predictions[0];
          setSelectedCell(defaultCell);
        }
      }
    } catch (e) {
      console.error('Simulation request failed:', e);
    } finally {
      setLoadingSimulation(false);
    }
  };

  const handleSelectLocation = async (loc) => {
    setActiveLocation(loc);
    // Find closest cell or fetch point prediction
    try {
      const res = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: loc.lat,
          lon: loc.lon,
          ...params
        })
      });
      const data = await res.json();
      if (data) {
        setSelectedCell({
          grid_id: data.grid_id,
          lat: data.lat,
          lon: data.lon,
          p: data.flood_probability,
          tier: data.tier_code,
          elev: data.cell_features.elevation_m,
          slope_deg: data.cell_features.slope_deg,
          impervious_pct: data.cell_features.impervious_pct,
          drain_density: data.cell_features.drain_density,
          blockage: data.cell_features.composite_blockage_risk
        });
      }
    } catch (e) {
      console.error('Point prediction failed:', e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 1. Mandatory Early-Stage Indicator Caveat Banner */}
      <CaveatBanner onOpenTransparencyModal={() => setTransparencyModalOpen(true)} />

      {/* 2. Top Header Bar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-cyan-600 to-blue-500 rounded-xl shadow-md text-white">
              <Waves className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight text-white m-0">
                  Lagos Flood Risk Prediction
                </h1>
                <span className="text-[10px] uppercase tracking-wider font-bold bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/30">
                  v1.0 Safety Model
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                500m Resolution Hydrological, Terrain & Drainage Blockage Risk Model
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="bg-slate-800/80 border border-slate-700/80 px-3 py-1.5 rounded-xl flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-300">Default Model:</span>
              <strong className="text-emerald-300 font-mono">
                {params.model_choice === 'random_forest' ? 'Random Forest (Option B)' : 'XGBoost (Option A)'}
              </strong>
            </div>

            <button
              onClick={() => setTransparencyModalOpen(true)}
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 font-medium cursor-pointer"
            >
              <Info className="w-4 h-4 text-cyan-400" />
              <span>Metrics & SHAP</span>
            </button>
          </div>
        </div>
      </header>

      {/* 3. Main Dashboard Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Scenario Simulator & Controls (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <ScenarioControls
            params={params}
            setParams={setParams}
            onRunSimulation={runSimulation}
            loadingSimulation={loadingSimulation}
            summary={summary}
          />
        </div>

        {/* Center/Right Column: Interactive Map & Cell Inspector (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Leaflet Flood Map (Takes majority height) */}
          <div className="flex-1 min-h-[500px]">
            <FloodMap
              gridData={gridData}
              selectedCell={selectedCell}
              onSelectCell={(cell) => setSelectedCell(cell)}
              keyLocations={keyLocations}
              activeLocation={activeLocation}
              onSelectLocation={handleSelectLocation}
            />
          </div>

          {/* Cell Detail Inspector Card */}
          <CellDetails
            selectedCell={selectedCell}
            modelChoice={params.model_choice}
          />
        </div>
      </main>

      {/* 4. Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Lagos Flood Risk Prediction Project &copy; 2026. Data sources: GEE, CHIRPS, OSM, LASEMA.</span>
          <span className="text-slate-400">Option B Safety Standard: Prioritizing early flood detection.</span>
        </div>
      </footer>

      {/* 5. Transparency Modal */}
      <ModelTransparencyModal
        isOpen={transparencyModalOpen}
        onClose={() => setTransparencyModalOpen(false)}
      />
    </div>
  );
}

