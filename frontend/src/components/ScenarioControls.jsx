import React, { useState } from 'react';
import { CloudRain, CloudLightning, Sliders, RefreshCw, Layers, Shield, Sparkles, Sun, CloudRainWind } from 'lucide-react';

export default function ScenarioControls({
  params,
  setParams,
  onRunSimulation,
  loadingSimulation,
  summary
}) {
  const [fetchingWeather, setFetchingWeather] = useState(false);
  const [weatherNotice, setWeatherNotice] = useState(null);

  const fetchLiveWeather = async () => {
    setFetchingWeather(true);
    setWeatherNotice(null);
    try {
      // Fetch Lagos live weather from Open-Meteo API
      const res = await fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=6.5244&longitude=3.3792&daily=precipitation_sum&timezone=Africa%2FLagos'
      );
      const data = await res.json();
      if (data?.daily?.precipitation_sum) {
        const dailyRain = data.daily.precipitation_sum[0] || 0;
        const past7d = data.daily.precipitation_sum.slice(0, 7).reduce((a, b) => a + b, 0);
        const past3d = data.daily.precipitation_sum.slice(0, 3).reduce((a, b) => a + b, 0);

        setParams((prev) => ({
          ...prev,
          rainfall_mm: Math.round(dailyRain),
          rainfall_3d_sum: Math.round(past3d),
          rainfall_7d_sum: Math.round(past7d)
        }));

        setWeatherNotice(`Live Lagos Precipitation Synced: ${dailyRain.toFixed(1)}mm (24h), ${past7d.toFixed(1)}mm (7-Day)`);
        setTimeout(() => setWeatherNotice(null), 5000);
      }
    } catch (e) {
      console.error('Failed to fetch live weather:', e);
      setWeatherNotice('Could not reach Open-Meteo. Using local parameters.');
    } finally {
      setFetchingWeather(false);
    }
  };

  const presetScenarios = [
    {
      name: 'Dry Season Baseline',
      desc: 'Sunny, clear drains',
      values: { rainfall_mm: 0, rainfall_3d_sum: 5, rainfall_7d_sum: 10, is_rainy_season: 0, blockage_multiplier: 1.0 }
    },
    {
      name: 'Moderate Storm (June/July)',
      desc: '35mm rain, normal drainage',
      values: { rainfall_mm: 35, rainfall_3d_sum: 80, rainfall_7d_sum: 150, is_rainy_season: 1, blockage_multiplier: 1.0 }
    },
    {
      name: 'Severe 10-Hr Downpour + Blockages',
      desc: '90mm torrential deluge + clogged canals',
      values: { rainfall_mm: 90, rainfall_3d_sum: 170, rainfall_7d_sum: 260, is_rainy_season: 1, blockage_multiplier: 1.6 }
    }
  ];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl text-slate-100 space-y-5">
      {/* Header & Live Weather Sync */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-cyan-400" />
          <h2 className="font-bold text-base text-white">Scenario Simulator</h2>
        </div>
        <button
          onClick={fetchLiveWeather}
          disabled={fetchingWeather}
          className="flex items-center gap-1.5 text-xs bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-3 py-1.5 rounded-lg transition disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${fetchingWeather ? 'animate-spin' : ''}`} />
          <span>{fetchingWeather ? 'Syncing...' : 'Fetch Live Weather'}</span>
        </button>
      </div>

      {weatherNotice && (
        <div className="text-xs bg-cyan-950/80 border border-cyan-800 text-cyan-300 p-2.5 rounded-xl animate-in fade-in">
          {weatherNotice}
        </div>
      )}

      {/* Preset Quick Buttons */}
      <div>
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
          Quick Preset Scenarios
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {presetScenarios.map((s, idx) => (
            <button
              key={idx}
              onClick={() => {
                setParams((prev) => ({ ...prev, ...s.values }));
              }}
              className="text-left p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-cyan-500/40 transition cursor-pointer"
            >
              <div className="font-semibold text-xs text-white">{s.name}</div>
              <div className="text-[11px] text-slate-400 truncate">{s.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Model Selection Toggle */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2 flex items-center justify-between">
          <span>Inference Model Strategy</span>
          <span className="text-[11px] font-normal text-emerald-400">
            {params.model_choice === 'random_forest' ? 'Option B Active' : 'Option A Active'}
          </span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setParams((p) => ({ ...p, model_choice: 'random_forest' }))}
            className={`p-2.5 rounded-lg text-xs font-medium border transition text-left cursor-pointer ${
              params.model_choice === 'random_forest'
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="font-bold flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              <span>Option B: Random Forest</span>
            </div>
            <div className="text-[11px] text-emerald-400/80 mt-0.5">Safety Default (92% Recall)</div>
          </button>

          <button
            onClick={() => setParams((p) => ({ ...p, model_choice: 'xgboost' }))}
            className={`p-2.5 rounded-lg text-xs font-medium border transition text-left cursor-pointer ${
              params.model_choice === 'xgboost'
                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Option A: XGBoost</span>
            </div>
            <div className="text-[11px] text-cyan-400/80 mt-0.5">Precision-Weighted (51% Precision)</div>
          </button>
        </div>
      </div>

      {/* Sliders */}
      <div className="space-y-4 text-xs">
        {/* 24h Rainfall */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-slate-300 flex items-center gap-1.5">
              <CloudRain className="w-4 h-4 text-cyan-400" />
              24-Hour Rainfall
            </span>
            <span className="font-mono text-cyan-400 font-bold">{params.rainfall_mm} mm</span>
          </div>
          <input
            type="range"
            min="0"
            max="150"
            step="5"
            value={params.rainfall_mm}
            onChange={(e) => setParams((p) => ({ ...p, rainfall_mm: Number(e.target.value) }))}
            className="w-full accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>

        {/* 7-Day Cumulative Rainfall */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-slate-300 flex items-center gap-1.5">
              <CloudRainWind className="w-4 h-4 text-cyan-400" />
              7-Day Cumulative Rainfall (Soil Saturation)
            </span>
            <span className="font-mono text-cyan-400 font-bold">{params.rainfall_7d_sum} mm</span>
          </div>
          <input
            type="range"
            min="0"
            max="300"
            step="10"
            value={params.rainfall_7d_sum}
            onChange={(e) => setParams((p) => ({ ...p, rainfall_7d_sum: Number(e.target.value) }))}
            className="w-full accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>

        {/* Blockage Severity Multiplier */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-slate-300 flex items-center gap-1.5">
              <CloudLightning className="w-4 h-4 text-amber-400" />
              Canal & Gutter Blockage Multiplier
            </span>
            <span className="font-mono text-amber-400 font-bold">{params.blockage_multiplier.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.5"
            step="0.1"
            value={params.blockage_multiplier}
            onChange={(e) => setParams((p) => ({ ...p, blockage_multiplier: Number(e.target.value) }))}
            className="w-full accent-amber-400 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>

        {/* Rainy Season Switch */}
        <div className="flex items-center justify-between p-3 bg-slate-800/40 rounded-xl border border-slate-800">
          <span className="text-slate-300">Lagos Rainy Season Active (April–October)</span>
          <button
            onClick={() => setParams((p) => ({ ...p, is_rainy_season: p.is_rainy_season === 1 ? 0 : 1 }))}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
              params.is_rainy_season === 1
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-slate-700 text-slate-400'
            }`}
          >
            {params.is_rainy_season === 1 ? 'Active (Rainy)' : 'Inactive (Dry)'}
          </button>
        </div>
      </div>

      {/* Execute Simulation Button */}
      <button
        onClick={onRunSimulation}
        disabled={loadingSimulation}
        className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl shadow-lg shadow-cyan-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
      >
        <RefreshCw className={`w-4 h-4 ${loadingSimulation ? 'animate-spin' : ''}`} />
        <span>{loadingSimulation ? 'Simulating 1,200+ Grid Cells...' : 'Update Map Simulation'}</span>
      </button>

      {/* Real-time Summary Box */}
      {summary && (
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-center">
          <div className="p-2 bg-red-950/30 border border-red-500/30 rounded-xl">
            <div className="text-[10px] text-red-400 uppercase font-semibold">Severe Warning</div>
            <div className="text-base font-bold text-red-400 font-mono">{summary.severe_warning_cells}</div>
          </div>
          <div className="p-2 bg-amber-950/30 border border-amber-500/30 rounded-xl">
            <div className="text-[10px] text-amber-400 uppercase font-semibold">Moderate Alert</div>
            <div className="text-base font-bold text-amber-400 font-mono">{summary.moderate_advisory_cells}</div>
          </div>
          <div className="p-2 bg-emerald-950/30 border border-emerald-500/30 rounded-xl">
            <div className="text-[10px] text-emerald-400 uppercase font-semibold">Low Risk</div>
            <div className="text-base font-bold text-emerald-400 font-mono">{summary.low_risk_cells}</div>
          </div>
        </div>
      )}
    </div>
  );
}
