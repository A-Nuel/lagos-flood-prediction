import React, { useState, useEffect } from 'react';
import CaveatBanner from './components/CaveatBanner';
import FloodMap from './components/FloodMap';
import ScenarioControls from './components/ScenarioControls';
import CellDetails from './components/CellDetails';
import ModelTransparencyModal from './components/ModelTransparencyModal';
import { Waves, Cpu, Activity, Shield, Sparkles, Compass } from 'lucide-react';

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

        if (selectedCell) {
          const updated = data.grid_predictions.find((c) => c.grid_id === selectedCell.grid_id);
          if (updated) setSelectedCell(updated);
        } else if (data.grid_predictions.length > 0) {
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
    <div className="relative w-screen h-screen overflow-hidden bg-[#030712] text-slate-100 font-sans select-none">
      {/* 1. Base Layer: Full-Bleed Spatial Map */}
      <FloodMap
        gridData={gridData}
        selectedCell={selectedCell}
        onSelectCell={(cell) => setSelectedCell(cell)}
        keyLocations={keyLocations}
        activeLocation={activeLocation}
        onSelectLocation={handleSelectLocation}
      />

      {/* 2. Top-Left Floating Header Brand HUD */}
      <div className="fixed top-4 left-4 sm:left-6 z-40 pointer-events-auto">
        <div className="glass-panel border border-slate-700/60 rounded-2xl p-2 sm:px-3.5 sm:py-2 flex items-center gap-3 shadow-[0_15px_35px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
          <div className="p-2 bg-gradient-to-tr from-cyan-600 to-blue-500 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.4)] text-white">
            <Waves className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-white tracking-tight">
                LAGOS HYDRO-TACTICAL
              </span>
              <span className="text-[9px] uppercase font-mono font-bold bg-cyan-500/15 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/30">
                v1.0
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono hidden sm:block">500M RESOLUTION ML SIMULATOR</p>
          </div>
        </div>
      </div>

      {/* 3. Top-Center Floating Caveat & Safety Ticker */}
      <CaveatBanner onOpenTransparencyModal={() => setTransparencyModalOpen(true)} />

      {/* 4. Top-Right Telemetry & Settings Dock */}
      <div className="fixed top-4 right-4 sm:right-6 z-40 flex items-center gap-2 pointer-events-auto">
        <button
          onClick={() => setTransparencyModalOpen(true)}
          className="glass-panel border border-slate-700/60 hover:border-cyan-500/40 text-slate-200 hover:text-white px-3 py-2 rounded-2xl transition flex items-center gap-1.5 text-xs font-semibold shadow-lg cursor-pointer backdrop-blur-2xl"
        >
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Telemetry & SHAP</span>
        </button>
      </div>

      {/* 5. Left Floating HUD: Scenario Controls */}
      <ScenarioControls
        params={params}
        setParams={setParams}
        onRunSimulation={runSimulation}
        loadingSimulation={loadingSimulation}
        summary={summary}
      />

      {/* 6. Right Floating HUD: Node Telemetry Details */}
      <CellDetails
        selectedCell={selectedCell}
        modelChoice={params.model_choice}
      />

      {/* 7. Methodology Command-Room Modal */}
      <ModelTransparencyModal
        isOpen={transparencyModalOpen}
        onClose={() => setTransparencyModalOpen(false)}
      />
    </div>
  );
}


