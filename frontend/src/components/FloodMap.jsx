import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, ZoomControl } from 'react-leaflet';
import { Radio } from 'lucide-react';

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
          color: isSelected ? '#FFFFFF' : '#EF4444',
          fillColor: '#EF4444',
          fillOpacity: isSelected ? 1.0 : 0.85,
          radius: isSelected ? 8 : 5.5,
          weight: isSelected ? 2.5 : 1.0
        };
      case 'moderate':
        return {
          color: isSelected ? '#FFFFFF' : '#F59E0B',
          fillColor: '#F59E0B',
          fillOpacity: isSelected ? 1.0 : 0.75,
          radius: isSelected ? 7.5 : 5,
          weight: isSelected ? 2.5 : 1.0
        };
      default:
        return {
          color: isSelected ? '#FFFFFF' : '#10B981',
          fillColor: '#10B981',
          fillOpacity: isSelected ? 1.0 : 0.55,
          radius: isSelected ? 7 : 4,
          weight: isSelected ? 2.5 : 0.75
        };
    }
  };

  const isOptionB = modelChoice === 'random_forest';

  return (
    <div className="relative w-full h-full min-h-[350px] bg-[#0F172A] flex-1 overflow-hidden">
      {/* Dynamic Compact Hazard Legend (Bottom-Right) */}
      <div className="absolute bottom-4 right-4 z-[400] bg-[#0F172A]/95 backdrop-blur border border-[#1E293B] rounded-lg p-3 shadow-xl pointer-events-auto text-[#F8FAFC]">
        <div className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider font-mono border-b border-[#1E293B] pb-1.5 mb-2 flex items-center justify-between gap-3">
          <span>Hazard Legend</span>
          <span className="text-[#3B82F6]">{isOptionB ? 'Opt B' : 'Opt A'}</span>
        </div>
        <div className="space-y-1.5 text-xs font-mono">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]"></span>
              <span>Critical</span>
            </div>
            <span className="text-[#94A3B8]">{isOptionB ? '≥35%' : '≥35%'}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]"></span>
              <span>Elevated</span>
            </div>
            <span className="text-[#94A3B8]">{isOptionB ? '20-35%' : '10-35%'}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]"></span>
              <span>Nominal</span>
            </div>
            <span className="text-[#94A3B8]">{isOptionB ? '<20%' : '<10%'}</span>
          </div>
        </div>
      </div>

      {/* Base Leaflet Map Canvas */}
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

        {/* 100% Free OpenStreetMap Cartography */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          subdomains={['a', 'b', 'c']}
          maxZoom={19}
        />

        {/* 1,200+ Spatial Nodes */}
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
                <div className="p-1 text-[#F8FAFC] text-xs space-y-1 font-sans">
                  <div className="font-bold text-sm text-white flex items-center justify-between gap-2 border-b border-[#1E293B] pb-1">
                    <span className="font-mono">{cell.grid_id}</span>
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase font-mono"
                      style={{
                        backgroundColor: cell.tier === 'severe' ? '#EF444430' : cell.tier === 'moderate' ? '#F59E0B30' : '#10B98130',
                        color: cell.tier === 'severe' ? '#EF4444' : cell.tier === 'moderate' ? '#F59E0B' : '#10B981'
                      }}
                    >
                      {cell.tier}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] pt-1 font-mono">
                    <div>Risk: <strong className="text-white">{Math.round(cell.p * 100)}%</strong></div>
                    <div>Elev: <strong className="text-white">{cell.elev}m</strong></div>
                    <div className="col-span-2">Blockage: <strong className="text-[#F59E0B]">{cell.blockage}</strong></div>
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





