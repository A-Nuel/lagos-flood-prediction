import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, ZoomControl } from 'react-leaflet';
import { MapPin } from 'lucide-react';

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
  activeLocation,
  modelChoice = 'random_forest'
}) {
  const lagosCenter = [6.5244, 3.3792];

  const getMarkerStyle = (tier, isSelected) => {
    switch (tier) {
      case 'severe':
        return {
          color: isSelected ? '#FFFFFF' : '#DC2626',
          fillColor: '#EF4444',
          fillOpacity: isSelected ? 1.0 : 0.85,
          radius: isSelected ? 8 : 5.5,
          weight: isSelected ? 2.5 : 1.0
        };
      case 'moderate':
        return {
          color: isSelected ? '#FFFFFF' : '#D97706',
          fillColor: '#F59E0B',
          fillOpacity: isSelected ? 1.0 : 0.75,
          radius: isSelected ? 7.5 : 5,
          weight: isSelected ? 2.5 : 1.0
        };
      default:
        return {
          color: isSelected ? '#FFFFFF' : '#059669',
          fillColor: '#10B981',
          fillOpacity: isSelected ? 1.0 : 0.55,
          radius: isSelected ? 7 : 4,
          weight: isSelected ? 2.5 : 0.75
        };
    }
  };

  const isOptionB = modelChoice === 'random_forest';

  return (
    <div className="relative w-full h-full min-h-[420px] bg-slate-950 flex flex-col">
      {/* Dynamic Synchronized Risk Legend */}
      <div className="absolute bottom-4 right-4 z-[400] bg-slate-900/95 border border-slate-700/80 rounded-xl p-3 shadow-lg text-xs space-y-1.5 backdrop-blur-md pointer-events-auto">
        <div className="font-bold text-slate-300 text-[11px] uppercase tracking-wider mb-1 border-b border-slate-800 pb-1 flex items-center justify-between gap-2">
          <span>{isOptionB ? 'Option B Tiers (Safety Standard)' : 'Option A Tiers (XGBoost)'}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-200">
          <span className="w-3 h-3 rounded-full bg-red-500 border border-red-400" />
          <span>Severe Warning (P ≥ 0.35)</span>
        </div>
        <div className="flex items-center gap-2 text-slate-200">
          <span className="w-3 h-3 rounded-full bg-amber-500 border border-amber-400" />
          <span>Moderate Advisory ({isOptionB ? 'P ≥ 0.20' : 'P ≥ 0.10'})</span>
        </div>
        <div className="flex items-center gap-2 text-slate-200">
          <span className="w-3 h-3 rounded-full bg-emerald-500 border border-emerald-400" />
          <span>Low Risk ({isOptionB ? 'P < 0.20' : 'P < 0.10'})</span>
        </div>
      </div>

      {/* Main Map with Canvas acceleration for high performance */}
      <MapContainer
        center={lagosCenter}
        zoom={11}
        scrollWheelZoom={true}
        zoomControl={false}
        preferCanvas={true}
        className="w-full h-full"
      >
        <ZoomControl position="topright" />
        <MapController
          center={activeLocation ? [activeLocation.lat, activeLocation.lon] : lagosCenter}
          zoom={activeLocation ? 13 : 11}
        />

        {/* 100% Free, Zero-Key OpenStreetMap Layer */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          subdomains={['a', 'b', 'c']}
          maxZoom={19}
        />

        {/* Grid Cells */}
        {gridData?.map((cell, idx) => {
          const isSelected = selectedCell?.grid_id === cell.grid_id;
          const style = getMarkerStyle(cell.tier, isSelected);

          return (
            <CircleMarker
              key={cell.grid_id || idx}
              center={[cell.lat, cell.lon]}
              radius={style.radius}
              pathOptions={{
                color: style.color,
                fillColor: style.fillColor,
                fillOpacity: style.fillOpacity,
                weight: style.weight
              }}
              eventHandlers={{
                click: () => onSelectCell(cell)
              }}
            >
              <Popup>
                <div className="p-1 text-slate-100 text-xs space-y-1">
                  <div className="font-bold text-sm text-white flex items-center justify-between gap-2 border-b border-slate-700 pb-1">
                    <span>{cell.grid_id}</span>
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
                      style={{
                        backgroundColor: cell.tier === 'severe' ? '#EF444430' : cell.tier === 'moderate' ? '#F59E0B30' : '#10B98130',
                        color: cell.tier === 'severe' ? '#F87171' : cell.tier === 'moderate' ? '#FBBF24' : '#34D399'
                      }}
                    >
                      {cell.tier}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] pt-1">
                    <div>Risk Prob: <strong className="text-white font-mono">{Math.round(cell.p * 100)}%</strong></div>
                    <div>Elevation: <strong className="text-white font-mono">{cell.elev}m</strong></div>
                    <div className="col-span-2">Blockage Index: <strong className="text-amber-300 font-mono">{cell.blockage}</strong></div>
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



