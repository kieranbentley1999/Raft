import React from 'react';
import { motion } from 'motion/react';

interface ResourceObj {
  seaGlass: number;
  cobalt: number;
  volcanic: number;
  scrapMetal: number;
  driftwood: number;
  biomass: number;
  stones: number;
  kelpFiber: number;
  treasure: number;
  food: number;
  rawFood?: number;
  cookedFood?: number;
  rope?: number;
  cloth?: number;
  leather?: number;
  ironBar?: number;
  clay?: number;
  sharkSkin?: number;
  copperWire?: number;
  batteryScrap?: number;
  plastic?: number;
  leadScrap?: number;
}

interface ChestInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  chestCoordinates: { x: number; z: number };
  chestInventory: { [key: string]: number };
  playerInventory: ResourceObj;
  setResources: React.Dispatch<React.SetStateAction<ResourceObj>>;
  onUpdateChestInventory: (newInventory: { [key: string]: number }) => void;
  audioSynth: {
    playPickup: () => void;
    playPing: () => void;
  };
}

const RESOURCE_METADATA: { [key: string]: { name: string; icon: string; color: string } } = {
  driftwood: { name: 'Driftwood', icon: '🪵', color: 'text-amber-500' },
  stones: { name: 'Stones', icon: '🪨', color: 'text-slate-400' },
  scrapMetal: { name: 'Scrap Metal', icon: '🔩', color: 'text-zinc-400' },
  cobalt: { name: 'Cobalt Ore', icon: '🔋', color: 'text-blue-400' },
  seaGlass: { name: 'Sea Glass', icon: '💎', color: 'text-cyan-400' },
  biomass: { name: 'Biomass', icon: '🌿', color: 'text-emerald-400' },
  food: { name: 'Foraged Food', icon: '🍓', color: 'text-rose-400' },
  rawFood: { name: 'Raw Food', icon: '🥩', color: 'text-rose-300' },
  cookedFood: { name: 'Cooked Food', icon: '🍗', color: 'text-amber-500' },
  kelpFiber: { name: 'Kelp Fiber', icon: '🕸️', color: 'text-teal-400' },
  volcanic: { name: 'Volcanic Ash', icon: '🌋', color: 'text-orange-400' },
  treasure: { name: 'Sunken Treasure', icon: '👑', color: 'text-yellow-400' },
  rope: { name: 'Rare Rope', icon: '🧵', color: 'text-purple-400' },
  cloth: { name: 'Woven Cloth', icon: '🧶', color: 'text-rose-400' },
  leather: { name: 'Cured Leather', icon: '💼', color: 'text-amber-600' },
  ironBar: { name: 'Iron Bar', icon: '🧱', color: 'text-slate-300' },
  clay: { name: 'Seabed Clay', icon: '🧱', color: 'text-orange-300' },
  sharkSkin: { name: 'Shark Skin', icon: '🦈', color: 'text-cyan-500' },
  copperWire: { name: 'Copper Wire', icon: '🔌', color: 'text-orange-400' },
  batteryScrap: { name: 'Battery Scrap', icon: '🔋', color: 'text-emerald-500' },
  plastic: { name: 'Marine Plastic', icon: '🥤', color: 'text-sky-300' },
  leadScrap: { name: 'Lead Scrap', icon: '⛓️', color: 'text-stone-400' },
};

export default function ChestInventoryModal({
  isOpen,
  onClose,
  chestCoordinates,
  chestInventory,
  playerInventory,
  setResources,
  onUpdateChestInventory,
  audioSynth,
}: ChestInventoryModalProps) {
  if (!isOpen) return null;

  const depositItem = (key: string, amount: number) => {
    const playerQty = (playerInventory as any)[key] || 0;
    if (playerQty <= 0) {
      audioSynth.playPing();
      return;
    }

    const actualAmount = Math.min(amount, playerQty);
    
    // Deduct from player
    setResources((prev: any) => ({
      ...prev,
      [key]: Math.max(0, (prev[key] || 0) - actualAmount),
    }));

    // Add to chest
    const newChestInv = { ...chestInventory };
    newChestInv[key] = (newChestInv[key] || 0) + actualAmount;
    onUpdateChestInventory(newChestInv);

    audioSynth.playPickup();
  };

  const withdrawItem = (key: string, amount: number) => {
    const chestQty = chestInventory[key] || 0;
    if (chestQty <= 0) {
      audioSynth.playPing();
      return;
    }

    const actualAmount = Math.min(amount, chestQty);

    // Add to player
    setResources((prev: any) => ({
      ...prev,
      [key]: (prev[key] || 0) + actualAmount,
    }));

    // Deduct from chest
    const newChestInv = { ...chestInventory };
    newChestInv[key] = Math.max(0, (newChestInv[key] || 0) - actualAmount);
    onUpdateChestInventory(newChestInv);

    audioSynth.playPickup();
  };

  // Get total items in chest
  const totalChestItems = Object.values(chestInventory).reduce((a, b) => a + b, 0);

  return (
    <div id="chest-inventory-overlay" className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-30 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-900 border-2 border-[#00f5ff]/30 w-full max-w-2xl h-[85vh] flex flex-col shadow-2xl relative"
      >
        {/* Neon decorative scanline */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-cyan-400 shadow-[0_0_10px_#00f5ff]" />

        {/* Header */}
        <div className="p-4 border-b border-[#00f5ff]/20 bg-slate-950/80 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm">📦</span>
              <h2 className="text-xs font-mono font-bold text-[#00f5ff] uppercase tracking-wider">
                WOODEN CARGO CRATE STORAGE
              </h2>
            </div>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
              GRID LOCATION: ({chestCoordinates.x.toFixed(1)}, {chestCoordinates.z.toFixed(1)}) | CARGO LEVEL: {totalChestItems} UNITS
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[10px] font-mono text-slate-400 hover:text-white border border-slate-700 hover:border-[#00f5ff]/50 px-2 py-1 bg-slate-950 transition-all uppercase"
          >
            Close [ESC]
          </button>
        </div>

        {/* Content columns */}
        <div className="flex-1 grid grid-cols-2 overflow-hidden">
          {/* LEFT COLUMN: CRATE INVENTORY */}
          <div className="p-4 border-r border-slate-800 flex flex-col h-full bg-slate-950/20">
            <h3 className="text-[10px] font-mono font-bold text-[#00f5ff] uppercase tracking-wider mb-3 border-b border-[#00f5ff]/10 pb-1 flex justify-between">
              <span>Crate Cargo Slots</span>
              <span className="text-[9px] text-slate-400 font-normal">Capacity: Limitless</span>
            </h3>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {Object.keys(RESOURCE_METADATA).map((key) => {
                const meta = RESOURCE_METADATA[key];
                const qty = chestInventory[key] || 0;

                return (
                  <div
                    key={`chest-${key}`}
                    className={`p-2 border transition-all flex items-center justify-between ${
                      qty > 0 ? 'bg-slate-950/50 border-[#00f5ff]/20' : 'bg-slate-900/20 border-slate-800/50 opacity-40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{meta.icon}</span>
                      <div>
                        <div className={`text-[10px] font-mono font-bold ${meta.color}`}>{meta.name}</div>
                        <div className="text-[9px] font-mono text-slate-400">Qty: {qty}</div>
                      </div>
                    </div>

                    {qty > 0 && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => withdrawItem(key, 1)}
                          className="text-[9px] font-mono bg-[#00f5ff]/10 hover:bg-[#00f5ff]/30 text-[#00f5ff] border border-[#00f5ff]/30 px-1.5 py-0.5"
                          title="Withdraw 1"
                        >
                          Withdraw
                        </button>
                        <button
                          onClick={() => withdrawItem(key, qty)}
                          className="text-[9px] font-mono bg-[#00f5ff]/20 hover:bg-[#00f5ff]/40 text-[#00f5ff] border border-[#00f5ff]/40 px-1 py-0.5 font-bold"
                          title="Withdraw All"
                        >
                          All
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT COLUMN: PLAYER INVENTORY */}
          <div className="p-4 flex flex-col h-full">
            <h3 className="text-[10px] font-mono font-bold text-amber-500 uppercase tracking-wider mb-3 border-b border-amber-500/10 pb-1">
              Aquanaut Cargo Holds
            </h3>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {Object.keys(RESOURCE_METADATA).map((key) => {
                const meta = RESOURCE_METADATA[key];
                const qty = (playerInventory as any)[key] || 0;

                return (
                  <div
                    key={`player-${key}`}
                    className={`p-2 border transition-all flex items-center justify-between ${
                      qty > 0 ? 'bg-slate-950/50 border-amber-500/20' : 'bg-slate-900/20 border-slate-800/50 opacity-40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{meta.icon}</span>
                      <div>
                        <div className={`text-[10px] font-mono font-bold ${meta.color}`}>{meta.name}</div>
                        <div className="text-[9px] font-mono text-slate-400">Qty: {qty}</div>
                      </div>
                    </div>

                    {qty > 0 && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => depositItem(key, 1)}
                          className="text-[9px] font-mono bg-amber-500/10 hover:bg-amber-500/30 text-amber-500 border border-amber-500/30 px-1.5 py-0.5"
                          title="Deposit 1"
                        >
                          Deposit
                        </button>
                        <button
                          onClick={() => depositItem(key, qty)}
                          className="text-[9px] font-mono bg-amber-500/20 hover:bg-amber-500/40 text-amber-500 border border-amber-500/40 px-1 py-0.5 font-bold"
                          title="Deposit All"
                        >
                          All
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#00f5ff]/10 bg-slate-950/50 flex justify-between items-center text-[9px] font-mono text-slate-400">
          <span>⚠️ ITEMS REMAIN STORED INSIDE CRATE PERMANENTLY UNLESS HARVESTED.</span>
          <span>DECKSIDE STORAGE INTERFACE V1.0</span>
        </div>
      </motion.div>
    </div>
  );
}
