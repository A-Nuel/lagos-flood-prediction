import React, { useState } from 'react';
import { CloudRain, Sliders, RefreshCw, Shield, Sparkles, CloudRainWind, AlertTriangle, Layers, MapPin } from 'lucide-react';

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
      // Fetch past 7 days of recorded historical rainfall + today's forecast
      const res = await fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=6.5244&longitude=3.3792&daily=precipitation_sum&past_days=7&forecast_days=1&timezone=Africa%2FLagos',
        { signal: AbortSignal.timeout(6000) }
      );
      if (!res.ok) throw new Error(`Weather service returned HTTP ${res.status}`);
      const data = await res.json();
      if (data?.daily?.precipitation_sum && Array.isArray(data.daily.precipitation_sum) && data.daily.precipitation_sum.length >= 7) {
        const rawPrecip = data.daily.precipitation_sum.map((v) => (v === null || isNaN(v) ? 0 : Number(v)));
        
        // Today's rainfall is the latest entry (index length - 1)
        const dailyRain = Math.max(0, rawPrecip[rawPrecip.length - 1] || 0);
        
        // 3-day rolling sum (today + prior 2 days)
        const past3d = Math.max(0, rawPrecip.slice(-3).reduce((a, b) => a + b, 0));
        
        // 7-day rolling sum (today + prior 6 days)
        const past7d = Math.max(0, rawPrecip.slice(-7).reduce((a, b) => a + b, 0));

        // Determine current season in Lagos (April - October = rainy season)
        const currentMonth = new Date().getMonth() + 1; // 1-12
        const isRainy = (currentMonth >= 4 && currentMonth <= 10) ? 1 : 0;

        setParams((prev) => ({
          ...prev,
          rainfall_mm: Math.round(dailyRain * 10) / 10,
          rainfall_3d_sum: Math.round(past3d * 10) / 10,
          rainfall_7d_sum: Math.round(past7d * 10) / 10,
          is_rainy_season: isRainy
        }));

        setWeatherNotice(
          `Synced 7-Day Live Lagos Weather: ${dailyRain.toFixed(1)} mm (24h), ${past3d.toFixed(1)} mm (3-Day Rolling), ${past7d.toFixed(1)} mm (7-Day Saturation)`
        );
        setTimeout(() => setWeatherNotice(null), 7000);
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
      desc: '0mm rain, dry season',
      values: { rainfall_mm: 0, rainfall_3d_sum: 5, rainfall_7d_sum: 10, is_rainy_season: 0, blockage_multiplier: 1.0 }
    },
    {
      name: 'Seasonal Storm',
      desc: '35mm rain, rainy season',
      values: { rainfall_mm: 35, rainfall_3d_sum: 80, rainfall_7d_sum: 150, is_rainy_season: 1, blockage_multiplier: 1.0 }
    },
    {
      name: 'Severe Deluge + Clog',
      desc: '90mm rain, 1.6x blockage',
      values: { rainfall_mm: 90, rainfall_3d_sum: 170, rainfall_7d_sum: 260, is_rainy_season: 1, blockage_multiplier: 1.6 }
    }
  ];

  return (
    <div className="space-y-6 text-slate-200">
      {/* 1. Model Strategy Toggle */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
          Inference Model Strategy
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setParams((p) => ({ ...p, model_choice: 'random_forest' }))}
            className={`p-2.5 rounded-lg text-xs font-medium border text-left transition cursor-pointer ${
              params.model_choice === 'random_forest'
                ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/50'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="font-bold flex items-center gap-1.5 text-xs">
              <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Option B (Safety)</span>
            </div>
            <div className="text-[11px] text-emerald-400/80 mt-0.5 font-mono">92% Recall Target</div>
          </button>

          <button
            onClick={() => setParams((p) => ({ ...p, model_choice: 'xgboost' }))}
            className={`p-2.5 rounded-lg text-xs font-medium border text-left transition cursor-pointer ${
              params.model_choice === 'xgboost'
                ? 'bg-blue-950/60 border-blue-500 text-blue-300 ring-1 ring-blue-500/50'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="font-bold flex items-center gap-1.5 text-xs">
              <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>Option A (XGBoost)</span>
            </div>
            <div className="text-[11px] text-blue-400/80 mt-0.5 font-mono">51% Precision View</div>
          </button>
        </div>
      </div>

      {/* 2. Presets & Weather Sync */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Quick Scenario Presets
          </label>
          <button
            onClick={fetchLiveWeather}
            disabled={fetchingWeather}
            className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800/80 px-2.5 py-1 rounded-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${fetchingWeather ? 'animate-spin' : ''}`} />
            <span>{fetchingWeather ? 'Syncing...' : 'Sync Live Weather'}</span>
          </button>
        </div>

        {weatherNotice && (
          <div className="text-xs bg-cyan-950/80 border border-cyan-800 text-cyan-300 p-2 rounded-lg">
            {weatherNotice}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {presetScenarios.map((s, idx) => (
            <button
              key={idx}
              onClick={() => setParams((prev) => ({ ...prev, ...s.values }))}
              className="p-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition cursor-pointer"
            >
              <div className="text-xs font-semibold text-white">{s.name}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{s.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Parameter Sliders with Direct Numerical Inputs */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4 text-xs">
        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
          Environmental Parameters
        </label>

        {/* 24h Rain */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-slate-300 flex items-center gap-1.5 font-medium">
              <CloudRain className="w-3.5 h-3.5 text-blue-400" />
              24-Hour Rainfall (mm)
            </span>
            <input
              type="number"
              min="0"
              max="250"
              value={params.rainfall_mm}
              onChange={(e) => setParams((p) => ({ ...p, rainfall_mm: Math.max(0, Number(e.target.value)) }))}
              className="w-16 bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-right font-mono font-bold text-blue-400 text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>
          <input
            type="range"
            min="0"
            max="150"
            step="5"
            value={params.rainfall_mm}
            onChange={(e) => setParams((p) => ({ ...p, rainfall_mm: Number(e.target.value) }))}
            className="w-full accent-blue-500 bg-slate-950 rounded-lg cursor-pointer h-1.5"
          />
        </div>

        {/* 7-Day Rainfall */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-slate-300 flex items-center gap-1.5 font-medium">
              <CloudRainWind className="w-3.5 h-3.5 text-blue-400" />
              7-Day Cumulative Saturation (mm)
            </span>
            <input
              type="number"
              min="0"
              max="500"
              value={params.rainfall_7d_sum}
              onChange={(e) => setParams((p) => ({ ...p, rainfall_7d_sum: Math.max(0, Number(e.target.value)) }))}
              className="w-16 bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-right font-mono font-bold text-blue-400 text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>
          <input
            type="range"
            min="0"
            max="300"
            step="10"
            value={params.rainfall_7d_sum}
            onChange={(e) => setParams((p) => ({ ...p, rainfall_7d_sum: Number(e.target.value) }))}
            className="w-full accent-blue-500 bg-slate-950 rounded-lg cursor-pointer h-1.5"
          />
        </div>

        {/* Drainage Blockage */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-slate-300 flex items-center gap-1.5 font-medium">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              Canal Blockage Multiplier
            </span>
            <span className="font-mono font-bold text-amber-400 text-xs">{params.blockage_multiplier.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.5"
            step="0.1"
            value={params.blockage_multiplier}
            onChange={(e) => setParams((p) => ({ ...p, blockage_multiplier: Number(e.target.value) }))}
            className="w-full accent-amber-500 bg-slate-950 rounded-lg cursor-pointer h-1.5"
          />
        </div>

        {/* Season Toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <span className="text-slate-300 font-medium">Rainy Season (April–October)</span>
          <button
            onClick={() => setParams((p) => ({ ...p, is_rainy_season: p.is_rainy_season === 1 ? 0 : 1 }))}
            className={`px-3 py-1 rounded text-xs font-semibold transition cursor-pointer border ${
              params.is_rainy_season === 1
                ? 'bg-blue-600/30 text-blue-300 border-blue-500'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {params.is_rainy_season === 1 ? 'Active (Rainy)' : 'Inactive (Dry)'}
          </button>
        </div>
      </div>

      {/* 4. Action Simulation Button */}
      <button
        onClick={onRunSimulation}
        disabled={loadingSimulation}
        className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
      >
        <Sliders className={`w-4 h-4 ${loadingSimulation ? 'animate-spin' : ''}`} />
        <span>{loadingSimulation ? 'Simulating 1,200+ Lagos Cells...' : 'Update Simulation'}</span>
      </button>

      {/* 5. Summary Statistics Card */}
      {summary && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
            Grid Risk Breakdown ({summary.total_cells} Cells)
          </label>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-red-950/40 border border-red-800/60 rounded-lg">
              <div className="text-[10px] text-red-300 font-bold uppercase">Severe</div>
              <div className="text-base font-bold text-red-400 font-mono">{summary.severe_warning_cells}</div>
            </div>
            <div className="p-2 bg-amber-950/40 border border-amber-800/60 rounded-lg">
              <div className="text-[10px] text-amber-300 font-bold uppercase">Moderate</div>
              <div className="text-base font-bold text-amber-400 font-mono">{summary.moderate_advisory_cells}</div>
            </div>
            <div className="p-2 bg-emerald-950/40 border border-emerald-800/60 rounded-lg">
              <div className="text-[10px] text-emerald-300 font-bold uppercase">Low Risk</div>
              <div className="text-base font-bold text-emerald-400 font-mono">{summary.low_risk_cells}</div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Quick Landmark Navigation List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
          Lagos Landmark Hotspots
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {keyLocations?.map((loc, idx) => {
            const isActive = activeLocation?.name === loc.name;
            return (
              <button
                key={idx}
                onClick={() => onSelectLocation(loc)}
                className={`p-2 rounded-lg text-left text-xs font-medium border transition truncate cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-blue-600 text-white border-blue-500 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <MapPin className={`w-3 h-3 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span className="truncate">{loc.name.split('(')[0].trim()}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}


