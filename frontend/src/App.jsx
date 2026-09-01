import React, { useState, useEffect } from 'react';
import CaveatBanner from './components/CaveatBanner';
import FloodMap from './components/FloodMap';
import ScenarioControls from './components/ScenarioControls';
import CellDetails from './components/CellDetails';
import ModelTransparencyModal from './components/ModelTransparencyModal';
import { Waves, Shield, BarChart3, Menu, X } from 'lucide-react';

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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 1. Header Bar */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-3 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              className="lg:hidden p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg cursor-pointer"
            >
              {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="p-2 bg-blue-600 rounded-lg text-white">
              <Waves className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Lagos Flood Risk Prediction Platform
                </h1>
                <span className="hidden sm:inline text-[10px] uppercase font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                  500m Grid
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Spatial Hydrological Simulation & Early Warning System
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTransparencyModalOpen(true)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Validation Matrix & SHAP</span>
              <span className="sm:hidden">Metrics</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Persistent Caveat Banner */}
      <CaveatBanner onOpenTransparencyModal={() => setTransparencyModalOpen(true)} />

      {/* 3. Main Operational Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left Sidebar (Desktop & Mobile Drawer) */}
        <aside
          className={`${
            mobileSidebarOpen ? 'block absolute inset-0 z-50 bg-slate-950' : 'hidden'
          } lg:block lg:relative w-full lg:w-[380px] xl:w-[420px] shrink-0 border-r border-slate-800 bg-slate-900/90 overflow-y-auto p-4 sm:p-5`}
        >
          {mobileSidebarOpen && (
            <div className="flex justify-between items-center mb-4 lg:hidden">
              <span className="font-bold text-sm text-white">Simulation Controls</span>
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          <ScenarioControls
            params={params}
            setParams={setParams}
            onRunSimulation={() => {
              runSimulation();
              setMobileSidebarOpen(false);
            }}
            loadingSimulation={loadingSimulation}
            summary={summary}
            keyLocations={keyLocations}
            activeLocation={activeLocation}
            onSelectLocation={(loc) => {
              handleSelectLocation(loc);
              setMobileSidebarOpen(false);
            }}
          />
        </aside>

        {/* Right Map Canvas & Docked Inspector */}
        <main className="flex-1 flex flex-col relative h-[calc(100dvh-120px)] lg:h-auto overflow-hidden">
          {/* Map */}
          <div className="flex-1 w-full h-full relative">
            <FloodMap
              gridData={gridData}
              selectedCell={selectedCell}
              onSelectCell={(cell) => setSelectedCell(cell)}
              activeLocation={activeLocation}
              modelChoice={params.model_choice}
            />
          </div>

          {/* Docked Inspector Card at Bottom */}
          <div className="p-4 bg-slate-950/95 border-t border-slate-800 shrink-0">
            <CellDetails
              selectedCell={selectedCell}
              modelChoice={params.model_choice}
            />
          </div>
        </main>
      </div>


      {/* 4. Methodology Modal */}
      <ModelTransparencyModal
        isOpen={transparencyModalOpen}
        onClose={() => setTransparencyModalOpen(false)}
      />
    </div>
  );
}



