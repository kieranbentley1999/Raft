import React, { useState } from 'react';
import { Upgrade, DockReserves, Recipe, getUpgradeRecipe } from '../types';
import { audioSynth } from '../audio';
import { Shield, Zap, RefreshCw, BatteryCharging, ShoppingCart, Magnet, Check, AlertCircle, Crosshair, Bot, Hammer } from 'lucide-react';

interface UpgradeShopProps {
  upgrades: Upgrade[];
  dockReserves: DockReserves;
  onPurchase: (upgradeId: string) => void;
}

export const UpgradeShop: React.FC<UpgradeShopProps> = ({
  upgrades,
  dockReserves,
  onPurchase,
}) => {
  const [failedUpgradeId, setFailedUpgradeId] = useState<string | null>(null);

  const getIcon = (id: string) => {
    switch (id) {
      case 'oxygen':
        return <BatteryCharging className="w-4 h-4 text-[#00f5ff]" />;
      case 'speed':
        return <Zap className="w-4 h-4 text-cyan-400" />;
      case 'cargo':
        return <ShoppingCart className="w-4 h-4 text-purple-400" />;
      case 'shield':
        return <Shield className="w-4 h-4 text-amber-400" />;
      case 'magnet':
        return <Magnet className="w-4 h-4 text-indigo-400" />;
      case 'harpoon':
        return <Crosshair className="w-4 h-4 text-rose-500" />;
      case 'drone':
        return <Bot className="w-4 h-4 text-emerald-400" />;
      case 'raft':
        return <Hammer className="w-4 h-4 text-amber-500" />;
      default:
        return <RefreshCw className="w-4 h-4 text-gray-400" />;
    }
  };

  const getResourceLabel = (key: string) => {
    switch (key) {
      case 'sea_glass': return 'Sea Glass';
      case 'abyssal_pearl': return 'Abyssal Pearl';
      case 'cobalt_ore': return 'Cobalt Ore';
      case 'volcanic_crystal': return 'Volcanic Crystal';
      case 'shark_tooth': return 'Shark Tooth';
      case 'precursor_battery': return 'Precursor Battery';
      default: return key;
    }
  };

  const checkRecipeAffordable = (recipe: Recipe): { canAfford: boolean; details: { key: keyof DockReserves; required: number; actual: number; satisfied: boolean }[] } => {
    const details: { key: keyof DockReserves; required: number; actual: number; satisfied: boolean }[] = [];
    let canAfford = true;

    const checkItem = (key: keyof DockReserves) => {
      const required = recipe[key] || 0;
      if (required > 0) {
        const actual = dockReserves[key] || 0;
        const satisfied = actual >= required;
        if (!satisfied) canAfford = false;
        details.push({ key, required, actual, satisfied });
      }
    };

    checkItem('sea_glass');
    checkItem('abyssal_pearl');
    checkItem('cobalt_ore');
    checkItem('volcanic_crystal');
    checkItem('shark_tooth');
    checkItem('precursor_battery');

    return { canAfford, details };
  };

  const handleBuy = (upgradeId: string, recipe: Recipe) => {
    const { canAfford } = checkRecipeAffordable(recipe);
    if (canAfford) {
      audioSynth.playUpgrade();
      onPurchase(upgradeId);
    } else {
      audioSynth.playError();
      setFailedUpgradeId(upgradeId);
      setTimeout(() => {
        setFailedUpgradeId(null);
      }, 820);
    }
  };

  const getHarpoonName = (level: number) => {
    if (level === 1) return "Standard Harpoon";
    if (level === 2) return "Piercing Harpoon";
    return "Abyssal Plasma Spear";
  };

  const getHarpoonDesc = (level: number) => {
    if (level === 1) return "Fires standard steel-tipped harpoons (1 dmg, 0.5s cooldown).";
    if (level === 2) return "Fires hyper-velocity, armor-piercing harpoons (2 dmg, travels faster).";
    return "Fires high-frequency plasma core projectiles (3 dmg, cooldown 0.2s).";
  };

  return (
    <div id="upgrade-shop" className="bg-[#050c14] border border-white/10 rounded-none p-6 shadow-none flex flex-col h-full">
      <style>{`
        @keyframes shop-shake {
          0%, 100% { transform: translateX(0); }
          12%, 37%, 62%, 87% { transform: translateX(-6px); }
          25%, 50%, 75% { transform: translateX(6px); }
        }
        .animate-shop-shake {
          animation: shop-shake 0.4s ease-in-out;
          border-color: rgba(239, 68, 68, 0.4) !important;
          box-shadow: 0 0 15px rgba(239, 68, 68, 0.15);
        }
      `}</style>

      <div className="flex items-end justify-between mb-5 pb-4 border-b border-white/10">
        <div>
          <span className="font-mono text-[9px] text-[#00f5ff] uppercase tracking-[0.25em] block mb-1 leading-none">
            Dock Crafting Station
          </span>
          <h3 className="font-serif italic font-light text-2xl text-white tracking-tight">
            Vessel Upgrades
          </h3>
        </div>
        <div className="border border-white/10 bg-[#03070b] px-3 py-1 font-mono text-[10px] text-gray-400">
          RESOURCES SYNCED
        </div>
      </div>

      <div className="space-y-4 overflow-y-auto flex-1 pr-1.5 min-h-0 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {upgrades.map((up) => {
          const isMax = up.level >= up.maxLevel;
          const recipe = !isMax ? getUpgradeRecipe(up.id, up.level) : null;
          const { canAfford, details } = recipe ? checkRecipeAffordable(recipe) : { canAfford: false, details: [] };
          const isFailed = failedUpgradeId === up.id;

          return (
            <div
              key={up.id}
              className={`group relative bg-[#03070b]/40 border rounded-none p-4 transition-all duration-150 ${
                isFailed ? 'animate-shop-shake' : 'border-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="p-2.5 bg-[#03070b] rounded-none border border-white/10 group-hover:border-white/25 transition-colors">
                  {getIcon(up.id)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-sans font-medium text-xs text-white truncate uppercase tracking-wider">
                      {up.name.split(' ').slice(1).join(' ')}
                    </span>
                    <span className="font-mono text-[10px] text-gray-500">
                      Lvl {up.level}/{up.maxLevel}
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-400 mb-3 leading-relaxed">
                    {up.id === 'harpoon' ? getHarpoonDesc(up.level) : up.description}
                  </p>

                  <div className="mb-4">
                    <div className="flex items-center justify-between text-[10px] font-mono mb-1.5">
                      <span className="text-gray-500">
                        {up.id === 'harpoon' ? 'CURRENT WEAPON:' : 'CURRENT RATING:'}
                      </span>
                      <span className="text-[#00f5ff] font-bold">
                        {up.id === 'harpoon' ? `${getHarpoonName(up.level)} (${up.value}${up.unit})` : `${up.value.toFixed(0)}${up.unit}`}
                      </span>
                    </div>

                    {!isMax && (
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="text-gray-500">
                          {up.id === 'harpoon' ? 'NEXT UPGRADE:' : 'NEXT RATING:'}
                        </span>
                        <span className="text-[#14f195] font-bold">
                          {up.id === 'harpoon' ? `${getHarpoonName(up.level + 1)} (${up.value + up.upgradeAmount}${up.unit})` : `${(up.value + up.upgradeAmount).toFixed(0)}${up.unit}`}
                        </span>
                      </div>
                    )}
                  </div>

                  {isMax ? (
                    <div className="text-center">
                      <span className="text-[9px] font-mono tracking-widest uppercase text-purple-400 px-3 py-1 bg-purple-950/20 border border-purple-800/10 block">
                        MAX LEVEL SECURED
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Recipe Display */}
                      <div className={`border p-2.5 space-y-1.5 transition-all duration-150 ${
                        isFailed ? 'border-red-500/40 bg-red-950/10' : 'border-white/5 bg-[#03070b]/80'
                      }`}>
                        <div className={`text-[8px] font-mono uppercase tracking-widest ${
                          isFailed ? 'text-red-400' : 'text-gray-500'
                        }`}>
                          Required Materials:
                        </div>
                        {details.map((item) => {
                          const itemFailed = isFailed && !item.satisfied;
                          return (
                            <div
                              key={item.key}
                              className={`flex items-center justify-between font-mono text-[9.5px] transition-all duration-150 ${
                                itemFailed ? 'text-red-400 animate-pulse font-semibold' : (item.satisfied ? 'text-gray-300' : 'text-rose-400')
                              }`}
                            >
                              <span className="flex items-center gap-1.5">
                                {item.satisfied ? (
                                  <Check className="w-3 h-3 text-[#14f195]" />
                                ) : (
                                  <AlertCircle className={`w-3 h-3 shrink-0 ${itemFailed ? 'text-red-500' : 'text-rose-400'}`} />
                                )}
                                {getResourceLabel(item.key)}
                              </span>
                              <span>
                                {item.actual} / {item.required}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => recipe && handleBuy(up.id, recipe)}
                        className={`w-full font-mono text-[10px] uppercase tracking-widest font-bold px-3 py-2 transition-all duration-150 flex items-center justify-center gap-1.5 ${
                          canAfford
                            ? 'bg-[#00f5ff] hover:bg-white text-black cursor-pointer shadow-[0_0_10px_rgba(0,245,255,0.15)] hover:shadow-[0_0_15px_rgba(255,255,255,0.2)]'
                            : 'bg-[#150a0a]/40 border border-red-950/60 hover:border-red-500/50 text-gray-500 hover:text-red-400 cursor-pointer'
                        }`}
                      >
                        Craft Upgrade
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 pt-4 border-t border-white/10 text-center">
        <p className="text-[9px] font-mono text-gray-500 uppercase tracking-[0.2em]">
          Dock synchronized &middot; Materials persistent
        </p>
      </div>
    </div>
  );
};
