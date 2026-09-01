import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { Navigation, ShieldAlert, Sparkles, MapPin, Compass } from 'lucide-react';

function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom || 12, { duration: 1.5, easeLinearity: 0.25 });
    }
  }, [center, zoom, map]);
  return null;
}

export default function FloodMap({
  gridData,
  selectedCell,
  onSelectCell,
  keyLocations,
  activeLocation,
  onSelectLocation
}) {
  const lagosCenter = [6.5244, 3.3792];

  const getMarkerColor = (tier) => {
    switch (tier) {
      case 'severe':
        return '#EF4444'; // Red-500
      case 'moderate':
        return '#F59E0B'; // Amber-500
      default:
        return '#10B981'; // Emerald-500
    }
  };

  return (
    <div className="absolute inset-0 w-full h-full z-0 overflow-hidden bg-[#030712]">
      {/* 1. Floating Bottom Landmark Navigation Dock */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 max-w-4xl w-[94%] overflow-x-auto pb-1 scrollbar-none pointer-events-auto">
        <div className="glass-panel border border-slate-700/50 rounded-2xl p-1.5 flex items-center gap-1.5 shadow-[0_15px_35px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
          <div className="px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-xs text-cyan-300 font-semibold flex items-center gap-1.5 shrink-0">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>Landmarks</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
            {keyLocations?.map((loc, idx) => {
              const isActive = activeLocation?.name === loc.name;
              return (
                <button
                  key={idx}
                  onClick={() => onSelectLocation(loc)}
                  className={`text-xs px-3 py-1.5 rounded-xl border transition shrink-0 cursor-pointer font-medium flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <MapPin className={`w-3 h-3 ${isActive ? 'text-slate-950' : 'text-slate-500'}`} />
                  <span>{loc.name.split('(')[0].trim()}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Floating Minimalist Risk Legend */}
      <div className="hidden sm:block absolute bottom-24 right-6 z-30 pointer-events-auto">
        <div className="glass-panel border border-slate-800/80 rounded-2xl p-3 shadow-2xl text-xs space-y-1.5 backdrop-blur-xl">
          <div className="font-bold text-slate-400 uppercase tracking-widest text-[9px] mb-1">
            Option B Risk Tiers
          </div>
          <div className="flex items-center gap-2 text-slate-300 text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
            <span>Severe Warning (P ≥ 0.35)</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300 text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b]" />
            <span>Moderate Advisory (P ≥ 0.20)</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300 text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
            <span>Low Baseline (P &lt; 0.20)</span>
          </div>
        </div>
      </div>

      {/* 3. Base Leaflet Map Canvas */}
      <MapContainer
        center={lagosCenter}
        zoom={11}
        scrollWheelZoom={true}
        zoomControl={false}
        className="w-full h-full"
      >
        <MapController
          center={activeLocation ? [activeLocation.lat, activeLocation.lon] : lagosCenter}
          zoom={activeLocation ? 13 : 11}
        />

        {/* High-Contrast Dark CartoDB Tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />

        {/* Spatial Grid Telemetry Markers */}
        {gridData?.map((cell, idx) => {
          const isSelected = selectedCell?.grid_id === cell.grid_id;
          const isSevere = cell.tier === 'severe';
          const color = getMarkerColor(cell.tier);

          return (
            <CircleMarker
              key={cell.grid_id || idx}
              center={[cell.lat, cell.lon]}
              radius={isSelected ? 9 : isSevere ? 6 : 4.5}
              pathOptions={{
                color: isSelected ? '#38BDF8' : color,
                fillColor: color,
                fillOpacity: isSelected ? 1.0 : isSevere ? 0.9 : 0.65,
                weight: isSelected ? 3 : isSevere ? 1.5 : 0.5
              }}
              eventHandlers={{
                click: () => onSelectCell(cell)
              }}
            >
              <Popup className="custom-leaflet-popup">
                <div className="p-2 text-slate-100 text-xs space-y-1">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-700/60 pb-1">
                    <span className="font-mono text-cyan-400 font-bold">{cell.grid_id}</span>
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase"
                      style={{ backgroundColor: `${color}25`, color }}
                    >
                      {cell.tier}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                    <div>Risk: <strong className="text-white">{Math.round(cell.p * 100)}%</strong></div>
                    <div>Elev: <strong className="text-white">{cell.elev}m</strong></div>
                    <div className="col-span-2">Blockage Index: <strong className="text-amber-300">{cell.blockage}</strong></div>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}

