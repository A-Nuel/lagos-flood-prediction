import React, { useState } from 'react';
import { CloudRain, Sliders, RefreshCw, CheckCircle2, AlertCircle, CloudLightning, MapPin, UserCheck } from 'lucide-react';

export default function ScenarioControls({
  params,
  setParams,
  onRunSimulation,
  loadingSimulation,
  summary,
  keyLocations,
  activeLocation,
  onSelectLocation
}) {
  const [fetchingWeather, setFetchingWeather] = useState(false);
  const [weatherNotice, setWeatherNotice] = useState(null);

  const fetchLiveWeather = async () => {
    setFetchingWeather(true);
    setWeatherNotice(null);
    try {
      const res = await fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=6.5244&longitude=3.3792&daily=precipitation_sum&past_days=7&forecast_days=1&timezone=Africa%2FLagos',
        { signal: AbortSignal.timeout(6000) }
      );
      if (!res.ok) throw new Error(`Weather service returned HTTP ${res.status}`);
      const data = await res.json();
      if (data?.daily?.precipitation_sum && Array.isArray(data.daily.precipitation_sum) && data.daily.precipitation_sum.length >= 7) {
        const rawPrecip = data.daily.precipitation_sum.map((v) => (v === null || isNaN(v) ? 0 : Number(v)));
        const dailyRain = Math.max(0, rawPrecip[rawPrecip.length - 1] || 0);
        const past3d = Math.max(0, rawPrecip.slice(-3).reduce((a, b) => a + b, 0));
        const past7d = Math.max(0, rawPrecip.slice(-7).reduce((a, b) => a + b, 0));

        const currentMonth = new Date().getMonth() + 1;
        const isRainy = (currentMonth >= 4 && currentMonth <= 10) ? 1 : 0;

        setParams((prev) => ({
          ...prev,
          rainfall_mm: Math.round(dailyRain * 10) / 10,
          rainfall_3d_sum: Math.round(past3d * 10) / 10,
          rainfall_7d_sum: Math.round(past7d * 10) / 10,
          is_rainy_season: isRainy
        }));

        setWeatherNotice(
          `Synced 7-Day Live Lagos Weather: ${dailyRain.toFixed(1)} mm (24h), ${past3d.toFixed(1)} mm (3d Sum), ${past7d.toFixed(1)} mm (7d Saturation)`
        );
        setTimeout(() => setWeatherNotice(null), 6000);
      } else {
        throw new Error('Incomplete daily precipitation array');
      }
    } catch (e) {
      console.warn('Failed to fetch live weather:', e);
      setWeatherNotice('Could not reach Open-Meteo service. Maintained current simulation values.');
      setTimeout(() => setWeatherNotice(null), 5000);
    } finally {
      setFetchingWeather(false);
    }
  };

  const presetScenarios = [
    {
      name: 'Dry Baseline',
      tag: 'HIST-A',
      values: { rainfall_mm: 0, rainfall_3d_sum: 5, rainfall_7d_sum: 10, is_rainy_season: 0, blockage_multiplier: 1.0 }
    },
    {
      name: 'Seasonal Storm',
      tag: 'LIVE-SIM',
      values: { rainfall_mm: 35, rainfall_3d_sum: 80, rainfall_7d_sum: 150, is_rainy_season: 1, blockage_multiplier: 1.0 }
    },
    {
      name: 'Severe Deluge',
      tag: 'PROJ-X',
      values: { rainfall_mm: 90, rainfall_3d_sum: 170, rainfall_7d_sum: 260, is_rainy_season: 1, blockage_multiplier: 1.6 }
    }
  ];

  return (
    <aside className="bg-[#0F172A] text-[#F8FAFC] border-r border-[#1E293B] w-full lg:w-[380px] z-40 flex flex-col h-full overflow-y-auto">
      {/* Operator Status Header */}
      <div className="py-4 px-5 border-b border-[#1E293B] bg-[#0B0F19]/50 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-xs uppercase tracking-wider text-[#94A3B8]">Telemetry Control</h2>
          <div className="text-[#EF4444] font-mono text-[10px] uppercase flex items-center gap-1.5 bg-[#EF4444]/10 px-2 py-0.5 rounded border border-[#EF4444]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-pulse"></span>
            <span>Alert Status</span>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <div className="w-10 h-10 rounded border border-[#1E293B] bg-[#1E293B] flex items-center justify-center text-slate-300">
            <UserCheck className="w-5 h-5 text-[#3B82F6]" />
          </div>
          <div>
            <div className="text-xs font-mono text-[#94A3B8]">ID: OPR-78A</div>
            <div className="text-sm font-medium text-white">Cmdr. K. Adebayo</div>
          </div>
        </div>
      </div>

      {/* Control Canvas Content */}
      <div className="flex-1 p-5 space-y-6">
        {/* Section A: Prediction Strategy */}
        <section>
          <h3 className="text-[10px] text-[#94A3B8] mb-3 uppercase tracking-widest font-semibold">Prediction Strategy</h3>
          <div className="grid grid-cols-2 gap-3">
            {/* Standard (Opt A) */}
            <button
              onClick={() => setParams((p) => ({ ...p, model_choice: 'xgboost' }))}
              className={`border rounded p-3 text-left transition-all cursor-pointer relative ${
                params.model_choice === 'xgboost'
                  ? 'border-[#3B82F6] bg-[#3B82F6]/10'
                  : 'border-[#1E293B] bg-[#0B0F19] opacity-70 hover:opacity-100 hover:border-[#3B82F6]/50'
              }`}
            >
              {params.model_choice === 'xgboost' && (
                <div className="absolute top-0 right-0 w-8 h-8 bg-[#3B82F6]/10 rounded-bl-full flex items-start justify-end p-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#3B82F6]" />
                </div>
              )}
              <div className={`font-semibold text-sm mb-1 ${params.model_choice === 'xgboost' ? 'text-[#3B82F6]' : 'text-[#94A3B8]'}`}>
                Standard (Opt A)
              </div>
              <div className="text-[11px] text-[#94A3B8] leading-tight">Balanced precision. Minimize false alarms.</div>
            </button>

            {/* Max Sens (Opt B) */}
            <button
              onClick={() => setParams((p) => ({ ...p, model_choice: 'random_forest' }))}
              className={`border rounded p-3 text-left transition-all cursor-pointer relative ${
                params.model_choice === 'random_forest'
                  ? 'border-[#3B82F6] bg-[#3B82F6]/10'
                  : 'border-[#1E293B] bg-[#0B0F19] opacity-70 hover:opacity-100 hover:border-[#3B82F6]/50'
              }`}
            >
              {params.model_choice === 'random_forest' && (
                <div className="absolute top-0 right-0 w-8 h-8 bg-[#3B82F6]/10 rounded-bl-full flex items-start justify-end p-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#3B82F6]" />
                </div>
              )}
              <div className={`font-semibold text-sm mb-1 ${params.model_choice === 'random_forest' ? 'text-[#3B82F6]' : 'text-[#94A3B8]'}`}>
                Max Sens (Opt B)
              </div>
              <div className="text-[11px] text-[#94A3B8] leading-tight">92% sensitivity. Prioritize event capture.</div>
            </button>
          </div>
        </section>

        {/* Section B: Environmental Inputs */}
        <section>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-[10px] text-[#94A3B8] uppercase tracking-widest font-semibold">Environmental Inputs</h3>
            <button
              onClick={fetchLiveWeather}
              disabled={fetchingWeather}
              className="text-[10px] font-mono text-[#3B82F6] hover:text-[#60A5FA] flex items-center gap-1 uppercase transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${fetchingWeather ? 'animate-spin' : ''}`} />
              <span>{fetchingWeather ? 'Syncing...' : 'Sync Weather'}</span>
            </button>
          </div>

          {weatherNotice && (
            <div className="text-[11px] bg-[#3B82F6]/10 border border-[#3B82F6]/30 text-[#93C5FD] p-2 rounded mb-3 font-mono">
              {weatherNotice}
            </div>
          )}

          <div className="space-y-4 bg-[#0B0F19] border border-[#1E293B] rounded p-4">
            {/* 24h Rainfall */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs text-[#94A3B8] font-medium">24h Rainfall</label>
                <span className="font-mono text-xs text-[#3B82F6] font-bold">
                  {params.rainfall_mm.toFixed(1)} <span className="text-[#94A3B8] text-[10px] font-normal">mm</span>
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="250"
                step="1"
                value={params.rainfall_mm}
                onChange={(e) => setParams((p) => ({ ...p, rainfall_mm: Number(e.target.value) }))}
              />
            </div>

            {/* Drainage Blockage */}
            <div className="pt-2 border-t border-[#1E293B]">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs text-[#94A3B8] font-medium">Drainage Blockage</label>
                <span className="font-mono text-xs text-[#F59E0B] font-bold">
                  {Math.round(params.blockage_multiplier * 50)} <span className="text-[#94A3B8] text-[10px] font-normal">%</span>
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.5"
                step="0.1"
                value={params.blockage_multiplier}
                onChange={(e) => setParams((p) => ({ ...p, blockage_multiplier: Number(e.target.value) }))}
              />
            </div>
          </div>
        </section>

        {/* Section C: Scenario Simulation Presets */}
        <section>
          <h3 className="text-[10px] text-[#94A3B8] mb-3 uppercase tracking-widest font-semibold">Scenario Simulation</h3>
          <div className="flex flex-col gap-2">
            {presetScenarios.map((s, idx) => {
              const isSelected = params.rainfall_mm === s.values.rainfall_mm && params.is_rainy_season === s.values.is_rainy_season;
              return (
                <button
                  key={idx}
                  onClick={() => setParams((prev) => ({ ...prev, ...s.values }))}
                  className={`w-full py-2 px-4 rounded text-xs font-medium text-left flex justify-between items-center transition cursor-pointer border ${
                    isSelected
                      ? 'bg-[#3B82F6]/10 border-[#3B82F6] text-[#3B82F6]'
                      : 'bg-[#0B0F19] border-[#1E293B] text-[#F8FAFC] hover:bg-[#1E293B]'
                  }`}
                >
                  <span>{s.name}</span>
                  <span className={`text-[10px] font-mono ${isSelected ? 'text-[#3B82F6]' : 'text-[#94A3B8]'}`}>
                    {s.tag}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Section D: Grid Analysis Summary */}
        {summary && (
          <section className="pt-4 border-t border-[#1E293B]">
            <h3 className="text-[10px] text-[#94A3B8] mb-3 uppercase tracking-widest font-semibold">Grid Analysis Summary</h3>
            <div className="flex justify-between items-end gap-2">
              <div className="flex-1 bg-[#0B0F19] border border-[#1E293B] rounded p-2 text-center">
                <div className="text-[#EF4444] font-mono text-xl font-bold">{summary.severe_warning_cells}</div>
                <div className="text-[9px] text-[#94A3B8] uppercase tracking-wider mt-1">Severe</div>
              </div>
              <div className="flex-1 bg-[#0B0F19] border border-[#1E293B] rounded p-2 text-center">
                <div className="text-[#F59E0B] font-mono text-xl font-bold">{summary.moderate_advisory_cells}</div>
                <div className="text-[9px] text-[#94A3B8] uppercase tracking-wider mt-1">Elevated</div>
              </div>
              <div className="flex-1 bg-[#0B0F19] border border-[#1E293B] rounded p-2 text-center">
                <div className="text-[#10B981] font-mono text-xl font-bold">{summary.low_risk_cells}</div>
                <div className="text-[9px] text-[#94A3B8] uppercase tracking-wider mt-1">Nominal</div>
              </div>
            </div>
          </section>
        )}

        {/* Section E: Landmark Sectors */}
        <section className="pt-4 border-t border-[#1E293B]">
          <h3 className="text-[10px] text-[#94A3B8] mb-3 uppercase tracking-widest font-semibold">Lagos Sectors</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {keyLocations?.map((loc, idx) => {
              const isActive = activeLocation?.name === loc.name;
              return (
                <button
                  key={idx}
                  onClick={() => onSelectLocation(loc)}
                  className={`p-2 rounded text-left text-xs font-mono border transition truncate cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-[#3B82F6] text-white border-[#3B82F6] font-bold'
                      : 'bg-[#0B0F19] border-[#1E293B] text-[#94A3B8] hover:bg-[#1E293B] hover:text-white'
                  }`}
                >
                  <MapPin className={`w-3 h-3 shrink-0 ${isActive ? 'text-white' : 'text-[#94A3B8]'}`} />
                  <span className="truncate">{loc.name.split('(')[0].trim()}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Update Simulation Action Button */}
        <div className="pt-2">
          <button
            onClick={onRunSimulation}
            disabled={loadingSimulation}
            className="w-full py-2.5 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-bold rounded text-xs uppercase tracking-wider shadow transition cursor-pointer disabled:opacity-50"
          >
            {loadingSimulation ? 'Running Simulation...' : 'Execute Simulation'}
          </button>
        </div>
      </div>
    </aside>
  );
}



