import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { Navigation, AlertCircle, Info, ShieldAlert } from 'lucide-react';

// Sub-component to handle programmatically moving the map
function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom || 12, { duration: 1.2 });
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
    <div className="relative w-full h-full min-h-[520px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl flex flex-col">
      {/* Map Landmark Presets Bar */}
      <div className="absolute top-4 left-4 right-4 z-[400] flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none pointer-events-auto">
        <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-cyan-400 font-semibold flex items-center gap-1.5 shadow-lg shrink-0 backdrop-blur-md">
          <Navigation className="w-3.5 h-3.5" />
          <span>Hotspots:</span>
        </div>
        {keyLocations?.map((loc, idx) => (
          <button
            key={idx}
            onClick={() => onSelectLocation(loc)}
            className={`text-xs px-3 py-1.5 rounded-xl border backdrop-blur-md font-medium transition shrink-0 cursor-pointer shadow-md ${
              activeLocation?.name === loc.name
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold shadow-cyan-500/20'
                : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {loc.name}
          </button>
        ))}
      </div>

      {/* Map Legend Overlay */}
      <div className="absolute bottom-4 right-4 z-[400] bg-slate-900/90 border border-slate-800 backdrop-blur-md rounded-xl p-3 shadow-xl text-xs space-y-1.5 pointer-events-auto">
        <div className="font-bold text-slate-300 uppercase tracking-wider text-[10px] mb-1">
          Option B: Risk Levels
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500 shadow-sm shadow-red-500/50 inline-block" />
          <span className="text-slate-200">Severe Warning (P ≥ 0.35)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50 inline-block" />
          <span className="text-slate-200">Moderate Advisory (P ≥ 0.20)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50 inline-block" />
          <span className="text-slate-200">Low Risk (P &lt; 0.20)</span>
        </div>
      </div>

      {/* Main Leaflet Map */}
      <MapContainer
        center={lagosCenter}
        zoom={11}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <MapController
          center={activeLocation ? [activeLocation.lat, activeLocation.lon] : lagosCenter}
          zoom={activeLocation ? 13 : 11}
        />

        {/* Dark CartoDB Tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />

        {/* Grid Markers */}
        {gridData?.map((cell, idx) => {
          const isSelected = selectedCell?.grid_id === cell.grid_id;
          const isSevere = cell.tier === 'severe';
          const color = getMarkerColor(cell.tier);

          return (
            <CircleMarker
              key={cell.grid_id || idx}
              center={[cell.lat, cell.lon]}
              radius={isSelected ? 9 : isSevere ? 7 : 5}
              pathOptions={{
                color: isSelected ? '#FFFFFF' : color,
                fillColor: color,
                fillOpacity: isSelected ? 0.95 : isSevere ? 0.85 : 0.65,
                weight: isSelected ? 2.5 : isSevere ? 1.5 : 0.5
              }}
              eventHandlers={{
                click: () => onSelectCell(cell)
              }}
            >
              <Popup className="custom-leaflet-popup">
                <div className="p-1 text-slate-900 text-xs">
                  <div className="font-bold text-sm mb-1">{cell.grid_id}</div>
                  <div>Risk: <strong style={{ color }}>{cell.tier.toUpperCase()}</strong> ({Math.round(cell.p * 100)}%)</div>
                  <div>Elevation: <strong>{cell.elev}m</strong></div>
                  <div>Blockage Index: <strong>{cell.blockage}</strong></div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
