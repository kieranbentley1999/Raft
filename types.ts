export interface Upgrade {
  id: string;
  name: string;
  description: string;
  level: number;
  maxLevel: number;
  baseCost: number;
  costMultiplier: number;
  value: number;
  upgradeAmount: number;
  unit: string;
}

export interface Crystal {
  id: string;
  x: number;
  y: number;
  value: number; // point score value
  size: number;
  color: string;
  pulsePhase: number;
  collected: boolean;
  type: 'sea_glass' | 'abyssal_pearl' | 'cobalt_ore' | 'volcanic_crystal' | 'shark_tooth' | 'precursor_battery' |
        'ironScraps' | 'silicaSand' | 'copperWire' | 'rawTitanium' | 'volcanicCrystals' | 'lithiumBatteryPacks' |
        'deepSeaUranium' | 'ancientRelicFragments' | 'corruptedAIChips' | 'blackBoxCore' | 'singularityShard' | 'glitchArtifact';
}

export interface Obstacle {
  id: string;
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  pulse: number;
  type: 'urchin' | 'jellyfish' | 'thermal_vent' | 'shark' | 'octopus';
  health?: number;
  maxHealth?: number;
  startX?: number;
  startY?: number;
  respawnTimer?: number;
  flashFrames?: number;
}

export interface Harpoon {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  startX: number;
  direction: 'left' | 'right';
  radius: number;
  type?: 'standard' | 'piercing' | 'plasma';
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  decay: number;
  color: string;
  type: 'bubble' | 'sparkle' | 'thrust' | 'splash';
}

export interface HighScore {
  name: string;
  sol: number; // overall score representation
  depth: number;
  timestamp: string;
}

export interface DockReserves {
  sea_glass: number;
  abyssal_pearl: number;
  cobalt_ore: number;
  volcanic_crystal: number;
  shark_tooth: number;
  precursor_battery: number;
  ironScraps?: number;
  silicaSand?: number;
  copperWire?: number;
  rawTitanium?: number;
  volcanicCrystals?: number;
  lithiumBatteryPacks?: number;
  deepSeaUranium?: number;
  ancientRelicFragments?: number;
  corruptedAIChips?: number;
  blackBoxCore?: number;
  singularityShard?: number;
  glitchArtifact?: number;
  titaniumHarpoon?: number;
  magneticScanner?: number;
  kineticDrill?: number;
  thermalRegulators?: number;
  highCapacityOxygenRebreather?: number;
  glitchSubDriveMk1?: number;
  reinforcedHullPlating?: number;
  bioFilterSuit?: number;
  empPulseModule?: number;
}

export interface MarketListing {
  id: string;
  sellerName: string;
  itemName: keyof DockReserves;
  quantity: number;
  pricePerUnit: number;
}

export interface Recipe {
  sea_glass?: number;
  abyssal_pearl?: number;
  cobalt_ore?: number;
  volcanic_crystal?: number;
  shark_tooth?: number;
  precursor_battery?: number;
  ironScraps?: number;
  silicaSand?: number;
  copperWire?: number;
  rawTitanium?: number;
  volcanicCrystals?: number;
  lithiumBatteryPacks?: number;
  deepSeaUranium?: number;
  ancientRelicFragments?: number;
  corruptedAIChips?: number;
  blackBoxCore?: number;
  singularityShard?: number;
  glitchArtifact?: number;
  titaniumHarpoon?: number;
  magneticScanner?: number;
  kineticDrill?: number;
  thermalRegulators?: number;
  highCapacityOxygenRebreather?: number;
  glitchSubDriveMk1?: number;
  reinforcedHullPlating?: number;
  bioFilterSuit?: number;
  empPulseModule?: number;
}

export interface BackgroundDecoration {
  id: string;
  type: 'coral' | 'anemone' | 'vent';
  x: number;
  y: number;
  scale: number;
  color: string;
  seed: number;
  height?: number;
  width?: number;
}

export interface AmbientFish {
  id: string;
  x: number;
  y: number;
  vx: number;
  scale: number;
  color: string;
  tailPhase: number;
  tailSpeed: number;
  type: number;
}

export interface AmbientBubble {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  wobbleSpeed: number;
  wobbleAmount: number;
  wobblePhase: number;
}


export const getUpgradeRecipe = (id: string, level: number): Recipe => {
  if (id === 'oxygen') {
    if (level === 1) return { sea_glass: 30, abyssal_pearl: 2 };
    if (level === 2) return { sea_glass: 45, cobalt_ore: 15, abyssal_pearl: 3 };
    if (level === 3) return { cobalt_ore: 40, abyssal_pearl: 5, volcanic_crystal: 2 };
    if (level === 4) return { volcanic_crystal: 5, precursor_battery: 1 };
  }
  if (id === 'speed') {
    if (level === 1) return { sea_glass: 40, cobalt_ore: 15 };
    if (level === 2) return { sea_glass: 50, cobalt_ore: 30, volcanic_crystal: 2 };
    if (level === 3) return { cobalt_ore: 50, volcanic_crystal: 5, abyssal_pearl: 4 };
    if (level === 4) return { cobalt_ore: 70, shark_tooth: 3 };
  }
  if (id === 'cargo') {
    if (level === 1) return { sea_glass: 20 };
    if (level === 2) return { sea_glass: 30, cobalt_ore: 10 };
    if (level === 3) return { cobalt_ore: 35, abyssal_pearl: 3 };
    if (level === 4) return { cobalt_ore: 60, volcanic_crystal: 4, shark_tooth: 1 };
  }
  if (id === 'shield') {
    if (level === 0) return { sea_glass: 15 };
    if (level === 1) return { sea_glass: 25, cobalt_ore: 5 };
    if (level === 2) return { cobalt_ore: 30, abyssal_pearl: 2 };
    if (level === 3) return { cobalt_ore: 50, volcanic_crystal: 3 };
    if (level === 4) return { cobalt_ore: 75, volcanic_crystal: 6, abyssal_pearl: 5, precursor_battery: 1 };
  }
  if (id === 'magnet') {
    if (level === 1) return { sea_glass: 25, abyssal_pearl: 1 };
    if (level === 2) return { sea_glass: 35, cobalt_ore: 10, abyssal_pearl: 2 };
    if (level === 3) return { cobalt_ore: 45, volcanic_crystal: 3 };
    if (level === 4) return { cobalt_ore: 70, volcanic_crystal: 6, abyssal_pearl: 5, shark_tooth: 1 };
  }
  if (id === 'harpoon') {
    if (level === 1) return { shark_tooth: 3 };
    if (level === 2) return { precursor_battery: 1 };
  }
  if (id === 'drone') {
    if (level === 0) return { sea_glass: 50 };
    if (level === 1) return { sea_glass: 75, cobalt_ore: 20 };
    if (level === 2) return { sea_glass: 100, cobalt_ore: 40, abyssal_pearl: 5 };
  }
  if (id === 'raft') {
    if (level === 4) return { sea_glass: 15 };
    if (level === 5) return { sea_glass: 30, cobalt_ore: 10 };
    if (level === 6) return { sea_glass: 45, cobalt_ore: 20, abyssal_pearl: 2 };
    if (level === 7) return { sea_glass: 60, cobalt_ore: 30, abyssal_pearl: 3 };
    if (level === 8) return { sea_glass: 80, cobalt_ore: 40, abyssal_pearl: 4, volcanic_crystal: 2 };
    if (level === 9) return { sea_glass: 100, cobalt_ore: 55, abyssal_pearl: 5, volcanic_crystal: 4 };
  }
  return { sea_glass: 10 };
};
