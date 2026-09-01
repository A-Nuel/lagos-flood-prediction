import React, { useState, useEffect } from 'react';
import CaveatBanner from './components/CaveatBanner';
import FloodMap from './components/FloodMap';
import ScenarioControls from './components/ScenarioControls';
import CellDetails from './components/CellDetails';
import ModelTransparencyModal from './components/ModelTransparencyModal';
import { Radio, Bell, Settings, Menu, X, Satellite } from 'lucide-react';

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
    <div className="bg-[#0B0F19] text-[#F8FAFC] h-screen w-screen overflow-hidden flex flex-col font-sans antialiased">
      {/* 1. TopNavBar (h-14 fixed) */}
      <header className="bg-[#0F172A] text-[#F8FAFC] flex justify-between items-center px-4 w-full border-b border-[#1E293B] fixed top-0 left-0 right-0 z-50 h-14 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="lg:hidden p-1.5 text-[#94A3B8] hover:text-white bg-[#1E293B] rounded cursor-pointer"
          >
            {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2 border-r border-[#1E293B] pr-4">
            <Satellite className="w-5 h-5 text-[#3B82F6]" />
            <span className="font-semibold tracking-tight text-sm uppercase font-mono">
              Lagos Hydro-Predictive Node
            </span>
          </div>

          <div className="hidden sm:flex gap-2 items-center">
            <span className="bg-[#1E293B] px-2 py-0.5 rounded text-[#94A3B8] font-mono text-xs border border-[#1E293B]">
              RES: 500m
            </span>
            <span className="bg-[#10B981]/10 text-[#10B981] px-2 py-0.5 rounded font-mono text-[10px] uppercase border border-[#10B981]/20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span>
              <span>Sys Nominal</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setTransparencyModalOpen(true)}
            className="bg-[#F8FAFC] text-[#0B0F19] px-3 py-1 rounded text-xs font-bold hover:bg-gray-200 transition-colors uppercase tracking-wide cursor-pointer shadow-sm"
          >
            Validation Matrix
          </button>
          <div className="flex gap-1 border-l border-[#1E293B] pl-3">
            <button
              onClick={() => setTransparencyModalOpen(true)}
              className="text-[#94A3B8] hover:text-white hover:bg-[#1E293B] transition-colors p-1.5 rounded cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTransparencyModalOpen(true)}
              className="text-[#94A3B8] hover:text-white hover:bg-[#1E293B] transition-colors p-1.5 rounded cursor-pointer"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Emergency Notice Bar (fixed top-14) */}
      <CaveatBanner onOpenTransparencyModal={() => setTransparencyModalOpen(true)} />

      {/* 3. Main Workspace Layout (mt-[86px]) */}
      <div className="flex flex-1 mt-[86px] relative h-[calc(100vh-86px)] overflow-hidden">
        {/* Left Sidebar (Desktop & Mobile Drawer) */}
        <div
          className={`${
            mobileSidebarOpen ? 'fixed inset-0 top-[86px] z-50 bg-[#0F172A] block' : 'hidden'
          } lg:block lg:relative w-full lg:w-[380px] shrink-0 h-full`}
        >
          {mobileSidebarOpen && (
            <div className="flex justify-between items-center p-4 border-b border-[#1E293B] lg:hidden">
              <span className="font-bold text-xs uppercase font-mono text-white">Telemetry Controls</span>
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="p-1 text-[#94A3B8] hover:text-white"
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
        </div>

        {/* Right Main Map Canvas with Floating Inspector */}
        <main className="flex-1 relative bg-[#0B0F19] h-full overflow-hidden flex flex-col">
          <FloodMap
            gridData={gridData}
            selectedCell={selectedCell}
            onSelectCell={(cell) => setSelectedCell(cell)}
            activeLocation={activeLocation}
            modelChoice={params.model_choice}
          />

          {/* Mobile Bottom Inspector Drawer (visible on mobile only) */}
          <div className="sm:hidden p-3 bg-[#0F172A] border-t border-[#1E293B] shrink-0">
            <CellDetails
              selectedCell={selectedCell}
              modelChoice={params.model_choice}
            />
          </div>
        </main>
      </div>

      {/* 4. Methodology & Transparency Modal */}
      <ModelTransparencyModal
        isOpen={transparencyModalOpen}
        onClose={() => setTransparencyModalOpen(false)}
      />
    </div>
  );
}




