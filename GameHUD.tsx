import React from 'react';
import { Shield, Droplet, ArrowDown, BatteryWarning, Anchor, Layers, CircleDot } from 'lucide-react';
import { Crystal, DockReserves } from '../types';

interface GameHUDProps {
  oxygen: number;
  maxOxygen: number;
  depth: number;
  maxDepth: number;
  inventory: Crystal[];
  inventoryCapacity: number;
  isGameOver: boolean;
  isAtSurface: boolean;
  score: number;
  pressure: number;
  temperature: number;
  logs: string[];
  longitude?: number;
  dockReserves: DockReserves;
  isGodMode: boolean;
  onToggleGodMode: () => void;
  onMaxResources: () => void;
  onTeleportToBottom: () => void;
  bossSpawned: boolean;
  isCrushDepthExceeded?: boolean;
  crushDepthLimit?: number;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  oxygen,
  maxOxygen,
  depth,
  maxDepth,
  inventory,
  inventoryCapacity,
  isGameOver,
  isAtSurface,
  score,
  pressure,
  temperature,
  logs,
  longitude,
  dockReserves,
  isGodMode,
  onToggleGodMode,
  onMaxResources,
  onTeleportToBottom,
  bossSpawned,
  isCrushDepthExceeded = false,
  crushDepthLimit = 150,
}) => {
  const oxygenPercentage = (oxygen / maxOxygen) * 100;
  const inventoryCount = inventory.length;

  // Oxygen warning level
  const isCritical = oxygenPercentage < 30;
  const isWarning = oxygenPercentage >= 30 && oxygenPercentage < 60;

  let oxygenColor = 'bg-[#00f5ff] shadow-[0_0_8px_rgba(0,245,255,0.4)]';
  let oxygenTextColor = 'text-[#00f5ff]';

  if (isCritical) {
    oxygenColor = 'bg-rose-500 shadow-[0_0_10px_rgba(239,68,68,0.6)] animate-pulse';
    oxygenTextColor = 'text-rose-400 font-bold';
  } else if (isWarning) {
    oxygenColor = 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]';
    oxygenTextColor = 'text-amber-400';
  }

  const isFullCargo = inventoryCount >= inventoryCapacity;

  const getCarriedCount = (type: 'sea_glass' | 'abyssal_pearl' | 'cobalt_ore' | 'volcanic_crystal' | 'shark_tooth' | 'precursor_battery') => {
    return inventory.filter((c) => c.type === type).length;
  };

  const resources = [
    { type: 'sea_glass', label: 'Sea Glass', color: '#14f195', desc: 'Shallows (0-100m)' },
    { type: 'abyssal_pearl', label: 'Abyssal Pearl', color: '#fbcfe8', desc: 'Rare Shallows (5%)' },
    { type: 'cobalt_ore', label: 'Cobalt Ore', color: '#3b82f6', desc: 'Twilight (101-300m)' },
    { type: 'volcanic_crystal', label: 'Volcanic Crystal', color: '#f97316', desc: 'Rare Twilight (3%)' },
    { type: 'shark_tooth', label: 'Shark Tooth', color: '#cbd5e1', desc: 'Shark Defeated Drop (50%)' },
    { type: 'precursor_battery', label: 'Precursor Battery', color: '#e0f2fe', desc: 'Mythic Chest Loot (5%)' },
  ] as const;

  return (
    <div id="game-hud" className="bg-[#050c14] border border-white/10 rounded-none p-4 shadow-none flex flex-col justify-between h-full gap-3 overflow-y-auto min-h-0 scrollbar-none">
      {/* 0. ULTRA-VISIBLE LIFE SUPPORT (O2) */}
      <div
        id="life-support-container"
        style={{
          marginBottom: '15px',
          padding: '10px',
          background: 'rgba(255, 0, 0, 0.05)',
          border: '1px solid #ff3333',
        }}
        className="font-mono flex flex-col gap-2 shrink-0"
      >
        <div className="flex justify-between items-center">
          <span style={{ color: '#ff3333', fontWeight: 'bold', letterSpacing: '1px' }} className="text-[10px]">
            LIFE SUPPORT (O2)
          </span>
          <span style={{ color: '#ff3333', fontWeight: 'bold' }} className="text-xs">
            {Math.max(0, Math.floor(oxygenPercentage))}%
          </span>
        </div>
        <div className="w-full h-3 bg-[#03070b] border border-[#ff3333]/30 rounded-none overflow-hidden p-0.5">
          <div
            className={`h-full rounded-none transition-all duration-100 ${
              isCritical ? 'bg-rose-600 animate-pulse' : isWarning ? 'bg-amber-500' : 'bg-rose-500'
            }`}
            style={{ width: `${Math.max(0, Math.min(100, oxygenPercentage))}%` }}
          />
        </div>
        {isCritical && (
          <span className="text-[8px] text-rose-500 font-bold uppercase animate-pulse text-center">
            ⚠️ CRITICAL - ASCEND IMMEDIATELY
          </span>
        )}
      </div>

      {/* 1. Header with coordinates & active status */}
      <div className="flex justify-between items-end border-b border-white/10 pb-3">
        <div>
          <span className="font-mono text-[9px] text-[#00f5ff] uppercase tracking-[0.25em] block mb-1 leading-none">
            Tactical Telemetry
          </span>
          <h2 className="font-serif italic font-light text-2xl text-white tracking-tight">
            Trench Status
          </h2>
          {longitude !== undefined && (
            <div className="font-mono text-[9px] text-gray-400 mt-1 uppercase tracking-wide">
              LOC:{' '}
              <span className="text-[#00f5ff] font-semibold">
                {Math.abs(longitude)}m {longitude >= 0 ? 'EAST' : 'WEST'}
              </span>{' '}
              of ship
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 border border-white/10 bg-[#03070b] px-3 py-1 text-[9px] font-mono tracking-widest uppercase">
          <CircleDot className={`w-2 h-2 ${isAtSurface ? 'text-[#00f5ff] animate-pulse' : 'text-amber-500 animate-ping'}`} />
          <span className="text-gray-300">
            {isAtSurface ? 'SURFACE' : 'SUBMERGED'}
          </span>
        </div>
      </div>

      {/* Boss Radar Alert (Subtle Periodic Radio Detector Ping) */}
      <div className={`px-3 py-2 border text-[8.5px] font-mono leading-relaxed flex items-center gap-2 rounded-none transition-colors duration-150 ${
        bossSpawned 
          ? 'bg-rose-950/20 border-rose-500/30 text-rose-400 animate-pulse' 
          : 'bg-[#03070b]/60 border-emerald-500/20 text-emerald-500/80'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${bossSpawned ? 'bg-rose-500 animate-ping' : 'bg-emerald-500/40'}`} />
        <div className="flex-1">
          <span className="font-bold tracking-wider mr-1">[RADAR DETECTOR]:</span>
          {bossSpawned 
            ? "⚠️ ANOMALOUS ABYSSAL SIGNATURE DETECTED IN MIDNIGHT ZONE" 
            : "DATA SCAN: Trench clear of major biological threats."}
        </div>
      </div>

      {isCrushDepthExceeded && (
        <div className="px-3 py-2 bg-rose-950/30 border border-rose-500/40 text-rose-400 text-[8.5px] font-mono leading-relaxed flex items-center gap-2 rounded-none animate-pulse">
          <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping shrink-0" />
          <div className="flex-1 font-semibold">
            ⚠️ WARNING: CRUSH DEPTH EXCEEDED. HULL COMPROMISED! (Limit: {crushDepthLimit}m)
          </div>
        </div>
      )}

      {/* 2. Core Gauges */}
      <div className="grid grid-cols-3 gap-2">
        {/* Depth Meter */}
        <div className="bg-[#03070b]/60 border border-white/5 rounded-none p-2.5 flex flex-col justify-between">
          <div className="flex items-center gap-1 text-gray-400 mb-1">
            <ArrowDown className="w-3 h-3 text-[#00f5ff]" />
            <span className="text-[8px] font-mono uppercase tracking-[0.1em]">Depth</span>
          </div>
          <div>
            <div className="font-mono text-base text-white leading-none">
              {depth}<span className="text-[10px] text-[#00f5ff] ml-0.5">m</span>
            </div>
            <span className="font-mono text-[8px] text-gray-500">
              Max: {maxDepth}m
            </span>
          </div>
        </div>

        {/* Pressure Gauge */}
        <div className="bg-[#03070b]/60 border border-white/5 rounded-none p-2.5 flex flex-col justify-between">
          <div className="flex items-center gap-1 text-gray-400 mb-1">
            <Anchor className="w-3 h-3 text-gray-500" />
            <span className="text-[8px] font-mono uppercase tracking-[0.1em]">Pres</span>
          </div>
          <div>
            <div className="font-mono text-base text-gray-300 leading-none">
              {pressure.toFixed(1)}<span className="text-[10px] text-gray-500 ml-0.5">a</span>
            </div>
            <span className="font-mono text-[8px] text-gray-500">
              Atmosphere
            </span>
          </div>
        </div>

        {/* Temperature Gauge */}
        <div className="bg-[#03070b]/60 border border-white/5 rounded-none p-2.5 flex flex-col justify-between">
          <div className="flex items-center gap-1 text-gray-400 mb-1">
            <Droplet className="w-3 h-3 text-emerald-400" />
            <span className="text-[8px] font-mono uppercase tracking-[0.1em]">Temp</span>
          </div>
          <div>
            <div className="font-mono text-base text-emerald-400 leading-none">
              {temperature.toFixed(1)}<span className="text-[10px] text-gray-500 ml-0.5">°</span>
            </div>
            <span className="font-mono text-[8px] text-gray-500">
              Abyssal C
            </span>
          </div>
        </div>
      </div>

      {/* 3. Itemized Cargo & Dock Reserves Manifest */}
      <div className={`bg-[#03070b]/60 border rounded-none p-4 flex flex-col gap-3 transition-colors duration-150 ${isFullCargo ? 'border-amber-500/20 bg-amber-500/5' : 'border-white/5'}`}>
        <div className="flex justify-between items-center border-b border-white/10 pb-2">
          <div className="flex items-center gap-1.5 text-gray-300">
            <Layers className={`w-3.5 h-3.5 ${isFullCargo ? 'text-amber-400 animate-pulse' : 'text-[#00f5ff]'}`} />
            <span className="text-[9px] font-mono uppercase tracking-[0.15em] font-bold">Cargo Manifest</span>
          </div>
          <div className="font-mono text-[10px] text-gray-400">
            <span className={isFullCargo ? 'text-amber-400 font-bold' : 'text-white'}>{inventoryCount}</span>
            <span className="text-[9px] text-gray-500"> / {inventoryCapacity} slots</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {resources.map((res) => {
            const carried = getCarriedCount(res.type);
            const deposited = dockReserves[res.type] || 0;
            return (
              <div key={res.type} className="flex items-center justify-between p-2 bg-[#03070b]/90 border border-white/5 hover:border-white/10 rounded-none text-[10px] transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: res.color, boxShadow: `0 0 6px ${res.color}` }} />
                  <div className="truncate">
                    <div className="font-mono text-[9px] text-gray-200 uppercase tracking-wider font-semibold leading-none">{res.label}</div>
                    <div className="text-[7.5px] text-gray-500 font-mono tracking-wide leading-tight mt-0.5">{res.desc}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 font-mono text-right shrink-0">
                  {carried > 0 ? (
                    <span className="text-[#14f195] bg-[#14f195]/10 border border-[#14f195]/20 px-1 py-0.5 text-[8.5px] rounded-none font-bold animate-pulse">
                      +{carried}
                    </span>
                  ) : (
                    <span className="text-gray-700 px-1 text-[8.5px]">-</span>
                  )}
                  <div className="text-gray-300 min-w-[50px] text-right">
                    <span className="text-white font-bold">{deposited}</span>
                    <span className="text-[7.5px] text-gray-500 ml-0.5">HELD</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Logger / Terminal Feed */}
      <div className="flex-1 min-h-[100px] flex flex-col justify-end bg-[#03070b] border border-white/10 rounded-none p-4 font-mono text-[9px]">
        <div className="text-gray-500 uppercase tracking-[0.2em] text-[8px] font-bold pb-2 mb-2 border-b border-white/5">
          Telesync Feed Log
        </div>
        <div className="space-y-1.5 overflow-y-auto max-h-[85px] scrollbar-none">
          {logs.map((log, index) => (
            <div
              key={index}
              className={`line-clamp-1 leading-relaxed ${
                log.includes('SOL') || log.includes('deposited')
                  ? 'text-[#00f5ff]'
                  : log.includes('UPGRADE') || log.includes('UPGRADED')
                  ? 'text-purple-400'
                  : log.includes('CRITICAL') || log.includes('DROWNED') || log.includes('WARNING')
                  ? 'text-rose-400 font-bold'
                  : 'text-gray-400'
              }`}
            >
              &gt; {log}
            </div>
          ))}
          {logs.length === 0 && (
            <div className="text-gray-600 italic">&gt; Telemetry online...</div>
          )}
        </div>
      </div>
    </div>
  );
};
