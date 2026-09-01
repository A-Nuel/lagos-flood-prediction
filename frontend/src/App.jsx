import React, { useState, useEffect } from 'react';
import CaveatBanner from './components/CaveatBanner';
import FloodMap from './components/FloodMap';
import ScenarioControls from './components/ScenarioControls';
import CellDetails from './components/CellDetails';
import ModelTransparencyModal from './components/ModelTransparencyModal';
import { Map, Sliders, Target, BarChart3, Satellite } from 'lucide-react';

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
  const [mobileTab, setMobileTab] = useState('map'); // 'map' | 'controls' | 'inspector'

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
      {/* 1. Top Navigation Bar */}
      <header className="bg-[#0F172A] text-[#F8FAFC] flex justify-between items-center px-4 w-full border-b border-[#1E293B] shrink-0 h-13 z-50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 border-r border-[#1E293B] pr-3">
            <Satellite className="w-4 h-4 text-[#3B82F6]" />
            <span className="font-bold tracking-tight text-xs uppercase font-mono">
              Lagos Flood Risk Platform
            </span>
          </div>

          <div className="hidden sm:flex gap-2 items-center font-mono">
            <span className="bg-[#1E293B] px-2 py-0.5 rounded text-[#94A3B8] text-[11px] border border-[#1E293B]">
              RES: 500m
            </span>
            <span className="bg-[#10B981]/10 text-[#10B981] px-2 py-0.5 rounded text-[10px] uppercase border border-[#10B981]/20 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span>
              <span>Online</span>
            </span>
          </div>
        </div>

        {/* Action: Validation Matrix Modal Trigger */}
        <button
          onClick={() => setTransparencyModalOpen(true)}
          className="bg-[#1E293B] hover:bg-[#334155] text-slate-100 border border-[#334155] px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer shadow-sm"
        >
          <BarChart3 className="w-3.5 h-3.5 text-[#3B82F6]" />
          <span>Validation Matrix</span>
        </button>
      </header>

      {/* 2. Grounded Early-Stage Notice Bar */}
      <div className="bg-[#F59E0B]/10 border-b border-[#F59E0B]/20 px-4 py-1.5 shrink-0 flex items-center justify-between text-xs font-mono">
        <p className="text-[#F59E0B] text-[11px] truncate">
          <strong>MODEL NOTICE:</strong> Trained on 499 known events across 28 confirmed sectors in Lagos. Option B safety tiers prioritize catching real floods (up to 92% sensitivity).
        </p>
        <button
          onClick={() => setTransparencyModalOpen(true)}
          className="hidden md:inline text-[10px] text-[#F59E0B] underline hover:text-white cursor-pointer ml-3 shrink-0 uppercase"
        >
          View 5-Fold Metrics
        </button>
      </div>

      {/* 3. Mobile View Switcher Tabs (Visible on screens < 1024px) */}
      <div className="lg:hidden flex border-b border-[#1E293B] bg-[#0F172A] shrink-0 text-xs font-mono">
        <button
          onClick={() => setMobileTab('map')}
          className={`flex-1 py-2 text-center flex items-center justify-center gap-1.5 border-b-2 transition ${
            mobileTab === 'map'
              ? 'border-[#3B82F6] text-[#3B82F6] font-bold bg-[#3B82F6]/10'
              : 'border-transparent text-[#94A3B8] hover:text-white'
          }`}
        >
          <Map className="w-3.5 h-3.5" />
          <span>Map View</span>
        </button>
        <button
          onClick={() => setMobileTab('controls')}
          className={`flex-1 py-2 text-center flex items-center justify-center gap-1.5 border-b-2 transition ${
            mobileTab === 'controls'
              ? 'border-[#3B82F6] text-[#3B82F6] font-bold bg-[#3B82F6]/10'
              : 'border-transparent text-[#94A3B8] hover:text-white'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Telemetry Controls</span>
        </button>
        <button
          onClick={() => setMobileTab('inspector')}
          className={`flex-1 py-2 text-center flex items-center justify-center gap-1.5 border-b-2 transition ${
            mobileTab === 'inspector'
              ? 'border-[#3B82F6] text-[#3B82F6] font-bold bg-[#3B82F6]/10'
              : 'border-transparent text-[#94A3B8] hover:text-white'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>Node Details</span>
        </button>
      </div>

      {/* 4. Main Operational Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar (Desktop: always visible | Mobile: visible on 'controls' or 'inspector' tab) */}
        <aside
          className={`w-full lg:w-[380px] xl:w-[400px] shrink-0 border-r border-[#1E293B] bg-[#0B0F19] overflow-y-auto p-4 space-y-4 ${
            mobileTab === 'map' ? 'hidden lg:block' : 'block'
          }`}
        >
          {/* Spatial Node Inspector (Top of Sidebar) */}
          <CellDetails
            selectedCell={selectedCell}
            modelChoice={params.model_choice}
          />

          {/* Scenario Telemetry Controls */}
          {mobileTab !== 'inspector' && (
            <ScenarioControls
              params={params}
              setParams={setParams}
              onRunSimulation={runSimulation}
              loadingSimulation={loadingSimulation}
              summary={summary}
              keyLocations={keyLocations}
              activeLocation={activeLocation}
              onSelectLocation={handleSelectLocation}
            />
          )}
        </aside>

        {/* Right Map Canvas (Desktop: always visible | Mobile: visible on 'map' tab) */}
        <main
          className={`flex-1 relative bg-[#0F172A] h-full overflow-hidden ${
            mobileTab !== 'map' ? 'hidden lg:block' : 'block'
          }`}
        >
          <FloodMap
            gridData={gridData}
            selectedCell={selectedCell}
            onSelectCell={(cell) => {
              setSelectedCell(cell);
            }}
            activeLocation={activeLocation}
            modelChoice={params.model_choice}
          />
        </main>
      </div>

      {/* 5. Methodology & Validation Modal */}
      <ModelTransparencyModal
        isOpen={transparencyModalOpen}
        onClose={() => setTransparencyModalOpen(false)}
      />
    </div>
  );
}





