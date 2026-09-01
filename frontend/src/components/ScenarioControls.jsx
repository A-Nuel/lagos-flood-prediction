import React, { useState } from 'react';
import { CloudRain, Sliders, RefreshCw, CheckCircle2, Shield, Sparkles, MapPin, Layers } from 'lucide-react';

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
          `Synced Live Lagos Weather: ${dailyRain.toFixed(1)}mm (24h), ${past3d.toFixed(1)}mm (3d), ${past7d.toFixed(1)}mm (7d)`
        );
        setTimeout(() => setWeatherNotice(null), 6000);
      } else {
        throw new Error('Incomplete daily precipitation array');
      }
    } catch (e) {
      console.warn('Failed to fetch live weather:', e);
      setWeatherNotice('Could not reach Open-Meteo service.');
      setTimeout(() => setWeatherNotice(null), 5000);
    } finally {
      setFetchingWeather(false);
    }
  };

  const presetScenarios = [
    {
      name: 'Dry Baseline',
      tag: 'HIST-A',
      desc: '0mm rain, dry season',
      values: { rainfall_mm: 0, rainfall_3d_sum: 5, rainfall_7d_sum: 10, is_rainy_season: 0, blockage_multiplier: 1.0 }
    },
    {
      name: 'Seasonal Storm',
      tag: 'LIVE-SIM',
      desc: '35mm rain, rainy season',
      values: { rainfall_mm: 35, rainfall_3d_sum: 80, rainfall_7d_sum: 150, is_rainy_season: 1, blockage_multiplier: 1.0 }
    },
    {
      name: 'Severe Deluge',
      tag: 'PROJ-X',
      desc: '90mm rain, 1.6x blockage',
      values: { rainfall_mm: 90, rainfall_3d_sum: 170, rainfall_7d_sum: 260, is_rainy_season: 1, blockage_multiplier: 1.6 }
    }
  ];

  return (
    <div className="flex flex-col space-y-5 text-slate-100">
      {/* 1. Strategy Switcher */}
      <section className="bg-[#0F172A] border border-[#1E293B] rounded-lg p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#94A3B8] uppercase tracking-widest font-mono font-bold">
            Decision Model Strategy
          </span>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60">
            5-Fold CV Verified
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {/* Option B */}
          <button
            onClick={() => setParams((p) => ({ ...p, model_choice: 'random_forest' }))}
            className={`p-2.5 rounded text-left transition cursor-pointer relative border ${
              params.model_choice === 'random_forest'
                ? 'border-[#3B82F6] bg-[#3B82F6]/10 text-white'
                : 'border-[#1E293B] bg-[#0B0F19] text-[#94A3B8] hover:text-white hover:border-[#3B82F6]/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-[#3B82F6]" />
                Option B (Safety)
              </span>
              {params.model_choice === 'random_forest' && (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#3B82F6]" />
              )}
            </div>
            <div className="text-[10px] text-[#94A3B8] mt-1 font-mono leading-tight">
              92% Recall Target (Prioritize safety)
            </div>
          </button>

          {/* Option A */}
          <button
            onClick={() => setParams((p) => ({ ...p, model_choice: 'xgboost' }))}
            className={`p-2.5 rounded text-left transition cursor-pointer relative border ${
              params.model_choice === 'xgboost'
                ? 'border-[#3B82F6] bg-[#3B82F6]/10 text-white'
                : 'border-[#1E293B] bg-[#0B0F19] text-[#94A3B8] hover:text-white hover:border-[#3B82F6]/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                Option A (XGBoost)
              </span>
              {params.model_choice === 'xgboost' && (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#3B82F6]" />
              )}
            </div>
            <div className="text-[10px] text-[#94A3B8] mt-1 font-mono leading-tight">
              51% Precision (Minimize false alarms)
            </div>
          </button>
        </div>
      </section>

      {/* 2. Environmental Controls */}
      <section className="bg-[#0F172A] border border-[#1E293B] rounded-lg p-3.5 space-y-3.5">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-[#94A3B8] uppercase tracking-widest font-mono font-bold">
            Environmental Telemetry
          </span>
          <button
            onClick={fetchLiveWeather}
            disabled={fetchingWeather}
            className="text-[10px] font-mono text-[#3B82F6] hover:text-white bg-[#3B82F6]/10 hover:bg-[#3B82F6]/20 border border-[#3B82F6]/30 px-2 py-0.5 rounded flex items-center gap-1 uppercase transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-2.5 h-2.5 ${fetchingWeather ? 'animate-spin' : ''}`} />
            <span>{fetchingWeather ? 'Syncing...' : 'Sync Live Weather'}</span>
          </button>
        </div>

        {weatherNotice && (
          <div className="text-[10px] bg-[#3B82F6]/10 border border-[#3B82F6]/30 text-[#93C5FD] p-2 rounded font-mono">
            {weatherNotice}
          </div>
        )}

        {/* 24h Rainfall */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="text-[#94A3B8] font-medium">24-Hour Rainfall</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                max="250"
                value={params.rainfall_mm}
                onChange={(e) => setParams((p) => ({ ...p, rainfall_mm: Math.max(0, Number(e.target.value)) }))}
                className="w-14 bg-[#0B0F19] border border-[#1E293B] rounded px-1.5 py-0.5 text-right font-mono font-bold text-[#3B82F6] text-xs focus:border-[#3B82F6] focus:outline-none"
              />
              <span className="text-[10px] text-[#94A3B8] font-mono">mm</span>
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="150"
            step="1"
            value={params.rainfall_mm}
            onChange={(e) => setParams((p) => ({ ...p, rainfall_mm: Number(e.target.value) }))}
          />
        </div>

        {/* 7-Day Rainfall */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="text-[#94A3B8] font-medium">7-Day Saturation Sum</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                max="500"
                value={params.rainfall_7d_sum}
                onChange={(e) => setParams((p) => ({ ...p, rainfall_7d_sum: Math.max(0, Number(e.target.value)) }))}
                className="w-14 bg-[#0B0F19] border border-[#1E293B] rounded px-1.5 py-0.5 text-right font-mono font-bold text-[#3B82F6] text-xs focus:border-[#3B82F6] focus:outline-none"
              />
              <span className="text-[10px] text-[#94A3B8] font-mono">mm</span>
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="300"
            step="5"
            value={params.rainfall_7d_sum}
            onChange={(e) => setParams((p) => ({ ...p, rainfall_7d_sum: Number(e.target.value) }))}
          />
        </div>

        {/* Blockage Multiplier */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="text-[#94A3B8] font-medium">Canal Blockage Index</span>
            <span className="font-mono font-bold text-[#F59E0B] text-xs">
              {params.blockage_multiplier.toFixed(1)}x
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

        {/* Rainy Season Toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-[#1E293B]">
          <span className="text-xs text-[#94A3B8]">Rainy Season (Apr–Oct)</span>
          <button
            onClick={() => setParams((p) => ({ ...p, is_rainy_season: p.is_rainy_season === 1 ? 0 : 1 }))}
            className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold transition cursor-pointer border ${
              params.is_rainy_season === 1
                ? 'bg-[#3B82F6]/20 text-[#3B82F6] border-[#3B82F6]/50'
                : 'bg-[#0B0F19] text-[#94A3B8] border-[#1E293B]'
            }`}
          >
            {params.is_rainy_season === 1 ? 'ACTIVE' : 'INACTIVE'}
          </button>
        </div>
      </section>

      {/* 3. Scenario Presets */}
      <section className="bg-[#0F172A] border border-[#1E293B] rounded-lg p-3.5 space-y-2">
        <span className="text-[10px] text-[#94A3B8] uppercase tracking-widest font-mono font-bold block">
          Scenario Presets
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {presetScenarios.map((s, idx) => {
            const isSelected = params.rainfall_mm === s.values.rainfall_mm && params.is_rainy_season === s.values.is_rainy_season;
            return (
              <button
                key={idx}
                onClick={() => setParams((prev) => ({ ...prev, ...s.values }))}
                className={`p-2 rounded text-left transition cursor-pointer border ${
                  isSelected
                    ? 'bg-[#3B82F6]/15 border-[#3B82F6] text-[#3B82F6]'
                    : 'bg-[#0B0F19] border-[#1E293B] text-slate-300 hover:bg-[#1E293B]'
                }`}
              >
                <div className="text-[11px] font-bold truncate">{s.name}</div>
                <div className="text-[9px] font-mono text-[#94A3B8] mt-0.5">{s.tag}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 4. Grid Analysis Summary */}
      {summary && (
        <section className="bg-[#0F172A] border border-[#1E293B] rounded-lg p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#94A3B8] uppercase tracking-widest font-mono font-bold">
              Grid Risk Breakdown
            </span>
            <span className="text-[10px] font-mono text-[#94A3B8]">{summary.total_cells} Nodes</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-[#0B0F19] border border-[#EF4444]/30 rounded">
              <div className="text-[9px] text-[#EF4444] font-mono uppercase font-semibold">Severe</div>
              <div className="text-lg font-mono font-bold text-[#EF4444]">{summary.severe_warning_cells}</div>
            </div>
            <div className="p-2 bg-[#0B0F19] border border-[#F59E0B]/30 rounded">
              <div className="text-[9px] text-[#F59E0B] font-mono uppercase font-semibold">Elevated</div>
              <div className="text-lg font-mono font-bold text-[#F59E0B]">{summary.moderate_advisory_cells}</div>
            </div>
            <div className="p-2 bg-[#0B0F19] border border-[#10B981]/30 rounded">
              <div className="text-[9px] text-[#10B981] font-mono uppercase font-semibold">Nominal</div>
              <div className="text-lg font-mono font-bold text-[#10B981]">{summary.low_risk_cells}</div>
            </div>
          </div>
        </section>
      )}

      {/* 5. Landmark Sectors */}
      <section className="bg-[#0F172A] border border-[#1E293B] rounded-lg p-3.5 space-y-2">
        <span className="text-[10px] text-[#94A3B8] uppercase tracking-widest font-mono font-bold block">
          Lagos Hotspot Sectors
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {keyLocations?.map((loc, idx) => {
            const isActive = activeLocation?.name === loc.name;
            return (
              <button
                key={idx}
                onClick={() => onSelectLocation(loc)}
                className={`p-1.5 rounded text-left text-[11px] font-mono border transition truncate cursor-pointer flex items-center gap-1.5 ${
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

      {/* Execute Simulation Action */}
      <button
        onClick={onRunSimulation}
        disabled={loadingSimulation}
        className="w-full py-2.5 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-bold rounded text-xs uppercase tracking-wider shadow transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Sliders className={`w-3.5 h-3.5 ${loadingSimulation ? 'animate-spin' : ''}`} />
        <span>{loadingSimulation ? 'Calculating Inundation...' : 'Execute Simulation'}</span>
      </button>
    </div>
  );
}




