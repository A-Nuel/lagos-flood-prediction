import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, ZoomControl } from 'react-leaflet';
import { Radio } from 'lucide-react';
import CellDetails from './CellDetails';

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
    <div className="relative w-full h-full min-h-[420px] bg-[#0B0F19] flex-1 overflow-hidden">
      {/* 1. Floating Spatial Node Inspector (Bottom-Left on Desktop) */}
      <div className="absolute bottom-6 left-6 z-[400] max-w-[calc(100vw-3rem)] pointer-events-auto hidden sm:block">
        <CellDetails selectedCell={selectedCell} modelChoice={modelChoice} />
      </div>

      {/* 2. Floating Hazard Legend (Bottom-Right) */}
      <div className="absolute bottom-6 right-6 z-[400] bg-[#0F172A]/90 backdrop-blur border border-[#1E293B] rounded p-4 w-56 shadow-2xl pointer-events-auto text-[#F8FAFC]">
        <h4 className="text-[10px] text-[#94A3B8] mb-3 uppercase tracking-widest font-semibold border-b border-[#1E293B] pb-2 font-mono">
          Hazard Legend
        </h4>
        <div className="space-y-3 mt-3 text-xs font-mono">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-[#EF4444] opacity-80 border border-[#EF4444]"></span>
              <span>Critical</span>
            </div>
            <span className="text-[#94A3B8]">{isOptionB ? '≥35%' : '≥35%'}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-[#F59E0B] opacity-80 border border-[#F59E0B]"></span>
              <span>Elevated</span>
            </div>
            <span className="text-[#94A3B8]">{isOptionB ? '20-35%' : '10-35%'}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-[#10B981] opacity-80 border border-[#10B981]"></span>
              <span>Nominal</span>
            </div>
            <span className="text-[#94A3B8]">{isOptionB ? '<20%' : '<10%'}</span>
          </div>
          <div className="pt-2 border-t border-[#1E293B] mt-2">
            <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
              <Radio className="w-4 h-4 text-[#3B82F6]" />
              <span>Active 500m Grid</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Base Leaflet Map Canvas */}
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

        {/* 100% Free, Zero-Key OpenStreetMap Layer with high contrast dark filter */}
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
                <div className="p-1 text-[#F8FAFC] text-xs space-y-1">
                  <div className="font-bold text-sm text-white flex items-center justify-between gap-2 border-b border-[#1E293B] pb-1">
                    <span>{cell.grid_id}</span>
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
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




