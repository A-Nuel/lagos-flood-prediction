import React, { useState } from 'react';
import { CloudRain, CloudLightning, Sliders, RefreshCw, Layers, Shield, Sparkles, Sun, CloudRainWind, ChevronLeft, ChevronRight, Zap } from 'lucide-react';

export default function ScenarioControls({
  params,
  setParams,
  onRunSimulation,
  loadingSimulation,
  summary
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [fetchingWeather, setFetchingWeather] = useState(false);
  const [weatherNotice, setWeatherNotice] = useState(null);

  const fetchLiveWeather = async () => {
    setFetchingWeather(true);
    setWeatherNotice(null);
    try {
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

        setWeatherNotice(`Live Lagos Precipitation: ${dailyRain.toFixed(1)}mm / ${past7d.toFixed(1)}mm 7d`);
        setTimeout(() => setWeatherNotice(null), 5000);
      }
    } catch (e) {
      console.error('Failed to fetch live weather:', e);
      setWeatherNotice('Open-Meteo unreachable. Kept local values.');
    } finally {
      setFetchingWeather(false);
    }
  };

  const presetScenarios = [
    {
      name: 'Dry Baseline',
      desc: '0mm rain',
      values: { rainfall_mm: 0, rainfall_3d_sum: 5, rainfall_7d_sum: 10, is_rainy_season: 0, blockage_multiplier: 1.0 }
    },
    {
      name: 'Seasonal Storm',
      desc: '35mm rain',
      values: { rainfall_mm: 35, rainfall_3d_sum: 80, rainfall_7d_sum: 150, is_rainy_season: 1, blockage_multiplier: 1.0 }
    },
    {
      name: 'Torrenial Deluge',
      desc: '90mm + Blockage',
      values: { rainfall_mm: 90, rainfall_3d_sum: 170, rainfall_7d_sum: 260, is_rainy_season: 1, blockage_multiplier: 1.6 }
    }
  ];

  if (collapsed) {
    return (
      <div className="fixed top-20 left-4 z-40 pointer-events-auto">
        <button
          onClick={() => setCollapsed(false)}
          className="glass-panel border border-cyan-500/40 p-3 rounded-2xl text-cyan-400 hover:text-white shadow-[0_0_20px_rgba(6,182,212,0.25)] flex items-center gap-2 cursor-pointer transition hover:scale-105 backdrop-blur-2xl"
          title="Expand Scenario Deck"
        >
          <Sliders className="w-5 h-5" />
          <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Scenario Deck</span>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed top-20 left-4 sm:left-6 z-40 w-80 max-h-[calc(100vh-120px)] overflow-y-auto pointer-events-auto animate-in fade-in slide-in-from-left-4 duration-300">
      <div className="glass-panel border border-slate-700/60 rounded-3xl p-5 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] backdrop-blur-2xl text-slate-100 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-white tracking-tight">Scenario Simulator</h2>
              <p className="text-[10px] text-slate-400 font-mono">HYDROLOGICAL INPUTS</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCollapsed(true)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
              title="Minimize deck"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Weather Trigger */}
        <div className="flex items-center justify-between p-2.5 bg-slate-950/60 rounded-2xl border border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            <span className="text-[11px] font-medium text-slate-300">Open-Meteo Lagos</span>
          </div>
          <button
            onClick={fetchLiveWeather}
            disabled={fetchingWeather}
            className="text-[11px] font-bold text-cyan-300 hover:text-white bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 px-2.5 py-1 rounded-xl transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${fetchingWeather ? 'animate-spin' : ''}`} />
            <span>{fetchingWeather ? 'Syncing...' : 'Sync Live'}</span>
          </button>
        </div>

        {weatherNotice && (
          <div className="text-[11px] bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 p-2 rounded-xl animate-in fade-in">
            {weatherNotice}
          </div>
        )}

        {/* Preset Chips */}
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">
            Quick Scenarios
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {presetScenarios.map((s, idx) => (
              <button
                key={idx}
                onClick={() => setParams((prev) => ({ ...prev, ...s.values }))}
                className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-cyan-500/40 transition text-left cursor-pointer group"
              >
                <div className="text-[11px] font-bold text-white group-hover:text-cyan-300 transition truncate">{s.name}</div>
                <div className="text-[9px] text-slate-400 font-mono">{s.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Inference Model Toggle */}
        <div className="p-1 bg-slate-950/80 rounded-2xl border border-slate-800 flex gap-1">
          <button
            onClick={() => setParams((p) => ({ ...p, model_choice: 'random_forest' }))}
            className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              params.model_choice === 'random_forest'
                ? 'bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Option B (92% Recall)</span>
          </button>
          <button
            onClick={() => setParams((p) => ({ ...p, model_choice: 'xgboost' }))}
            className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              params.model_choice === 'xgboost'
                ? 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Option A (XGB)</span>
          </button>
        </div>

        {/* Sliders */}
        <div className="space-y-3.5 text-xs pt-1">
          {/* 24h Rain */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-slate-300 flex items-center gap-1 text-[11px]">
                <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
                24h Precipitation
              </span>
              <span className="font-mono text-cyan-400 font-bold text-xs">{params.rainfall_mm} mm</span>
            </div>
            <input
              type="range"
              min="0"
              max="150"
              step="5"
              value={params.rainfall_mm}
              onChange={(e) => setParams((p) => ({ ...p, rainfall_mm: Number(e.target.value) }))}
              className="w-full accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer h-1.5"
            />
          </div>

          {/* 7-Day Sum */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-slate-300 flex items-center gap-1 text-[11px]">
                <CloudRainWind className="w-3.5 h-3.5 text-cyan-400" />
                7-Day Soil Saturation
              </span>
              <span className="font-mono text-cyan-400 font-bold text-xs">{params.rainfall_7d_sum} mm</span>
            </div>
            <input
              type="range"
              min="0"
              max="300"
              step="10"
              value={params.rainfall_7d_sum}
              onChange={(e) => setParams((p) => ({ ...p, rainfall_7d_sum: Number(e.target.value) }))}
              className="w-full accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer h-1.5"
            />
          </div>

          {/* Blockage */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-slate-300 flex items-center gap-1 text-[11px]">
                <CloudLightning className="w-3.5 h-3.5 text-amber-400" />
                Canal Blockage Multiplier
              </span>
              <span className="font-mono text-amber-400 font-bold text-xs">{params.blockage_multiplier.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              value={params.blockage_multiplier}
              onChange={(e) => setParams((p) => ({ ...p, blockage_multiplier: Number(e.target.value) }))}
              className="w-full accent-amber-400 bg-slate-800 rounded-lg cursor-pointer h-1.5"
            />
          </div>
        </div>

        {/* Update Simulation Action Button */}
        <button
          onClick={onRunSimulation}
          disabled={loadingSimulation}
          className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold rounded-2xl shadow-[0_0_20px_rgba(6,182,212,0.3)] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-xs"
        >
          <Zap className={`w-4 h-4 ${loadingSimulation ? 'animate-spin' : ''}`} />
          <span>{loadingSimulation ? 'Simulating Grid...' : 'Execute Simulation'}</span>
        </button>

        {/* Summary Telemetry Badges */}
        {summary && (
          <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-800/80 text-center">
            <div className="p-2 bg-red-950/40 border border-red-500/30 rounded-xl">
              <div className="text-[9px] text-red-400 uppercase font-bold">Severe</div>
              <div className="text-sm font-extrabold text-red-400 font-mono">{summary.severe_warning_cells}</div>
            </div>
            <div className="p-2 bg-amber-950/40 border border-amber-500/30 rounded-xl">
              <div className="text-[9px] text-amber-400 uppercase font-bold">Moderate</div>
              <div className="text-sm font-extrabold text-amber-400 font-mono">{summary.moderate_advisory_cells}</div>
            </div>
            <div className="p-2 bg-emerald-950/40 border border-emerald-500/30 rounded-xl">
              <div className="text-[9px] text-emerald-400 uppercase font-bold">Low</div>
              <div className="text-sm font-extrabold text-emerald-400 font-mono">{summary.low_risk_cells}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

