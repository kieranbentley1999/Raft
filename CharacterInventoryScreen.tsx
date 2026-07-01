import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

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
  ironScraps?: number;
  silicaSand?: number;
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

interface EquippedGear {
  head: string | null;
  chest: string | null;
  weapon: string | null;
  legs: string | null;
  back: string | null;
}

interface CharacterInventoryScreenProps {
  isOpen: boolean;
  onClose: () => void;
  resources: ResourceObj;
  setResources: React.Dispatch<React.SetStateAction<ResourceObj>>;
  hunger: number;
  setHunger: React.Dispatch<React.SetStateAction<number>>;
  setHealth: React.Dispatch<React.SetStateAction<number>>;
  craftedItems: { [key: string]: boolean };
  equippedItems: EquippedGear;
  setEquippedItems: React.Dispatch<React.SetStateAction<EquippedGear>>;
  userEmail?: string;
  addLog: (msg: string) => void;
  audioSynth: {
    playPickup: () => void;
    playPing: () => void;
    playError?: () => void;
  };
}

interface ItemInfo {
  id: string;
  name: string;
  icon: string;
  type: 'head' | 'chest' | 'weapon' | 'legs' | 'back' | 'accessory' | 'resource';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  description: string;
  stats: string;
  isEquippable: boolean;
}

export default function CharacterInventoryScreen({
  isOpen,
  onClose,
  resources,
  setResources,
  hunger,
  setHunger,
  setHealth,
  craftedItems,
  equippedItems,
  setEquippedItems,
  userEmail,
  addLog,
  audioSynth,
}: CharacterInventoryScreenProps) {
  const [hoveredItem, setHoveredItem] = useState<ItemInfo | null>(null);
  const [selectedItem, setSelectedItem] = useState<ItemInfo | null>(null);

  if (!isOpen) return null;

  // Personalized RPG Character Name
  const charName = userEmail 
    ? `Diver ${userEmail.split('@')[0].toUpperCase()}`
    : 'AQUANAUT ELITE SURVIVOR';

  // Item definitions registry
  const itemRegistry: { [key: string]: ItemInfo } = {
    stoneAxe: {
      id: 'stoneAxe',
      name: 'Stone Axe',
      icon: '🪓',
      type: 'weapon',
      rarity: 'common',
      description: 'A sharp, robust hand axe crafted from driftwood and metal scraps.',
      stats: '+12 DAMAGE | Chop Island Trees',
      isEquippable: true,
    },
    huntingBowSpear: {
      id: 'huntingBowSpear',
      name: 'Hunting Spear',
      icon: '🏹',
      type: 'weapon',
      rarity: 'epic',
      description: 'An advanced projectile-launching harpoon spear to fight off apex shark threats.',
      stats: '+25 DAMAGE | Anti-Predator Defenses',
      isEquippable: true,
    },
    item_spear: {
      id: 'item_spear',
      name: 'Sharpened Scrap Spear',
      icon: '🔱',
      type: 'weapon',
      rarity: 'epic',
      description: 'A sharpened wood handle tipped with a jagged scrap metal point. Devastating against skeleton threats.',
      stats: '+25 DAMAGE | Melee Range Strike',
      isEquippable: true,
    },
    item_bow: {
      id: 'item_bow',
      name: 'Hunting Bow & Arrow',
      icon: '🏹',
      type: 'weapon',
      rarity: 'epic',
      description: 'A curved hunting bow shooting fast, lethal projectiles to defend at a distance.',
      stats: '+15 DAMAGE | Long Range Shot',
      isEquippable: true,
    },
    fishingRod: {
      id: 'fishingRod',
      name: 'Fishing Rod',
      icon: '🎣',
      type: 'weapon',
      rarity: 'rare',
      description: 'A thin flexible carbon-wood rod for deep sea subsea fishing.',
      stats: '+7 DAMAGE | Enable Deck Fishing',
      isEquippable: true,
    },
    scubaHelmet: {
      id: 'scubaHelmet',
      name: 'Brass Scuba Helmet',
      icon: '🤿',
      type: 'head',
      rarity: 'rare',
      description: 'A heavy, pressure-resistant vintage brass diving helmet.',
      stats: '+15 ARMOR | +40 Max Oxygen Capacity',
      isEquippable: true,
    },
    divingSuit: {
      id: 'divingSuit',
      name: 'Armored Diving Suit',
      icon: '🛡️',
      type: 'chest',
      rarity: 'epic',
      description: 'A state-of-the-art slate polymer scuba suit designed for deep-sea defense.',
      stats: '+30 ARMOR | High Impact Protection',
      isEquippable: true,
    },
    propulsionFins: {
      id: 'propulsionFins',
      name: 'Propulsion Fins',
      icon: '🚀',
      type: 'legs',
      rarity: 'epic',
      description: 'Turbo-charged high-speed swim fins that double kick efficiency.',
      stats: '+10 ARMOR | +30% Swimming Velocity',
      isEquippable: true,
    },
    oxygenTank: {
      id: 'oxygenTank',
      name: 'Standard Oxygen Tank',
      icon: '🎒',
      type: 'back',
      rarity: 'common',
      description: 'A compressed metal container supplying breathable surface oxygen.',
      stats: '+5 ARMOR | Essential Life Support',
      isEquippable: true,
    },
    // Resources definitions for descriptions
    seaGlass: { id: 'seaGlass', name: 'Sea Glass', icon: '🟢', type: 'resource', rarity: 'common', description: 'Smooth frosted fragments of glass gathered from reefs. Used for basic hull upgrades.', stats: 'Resource material', isEquippable: false },
    cobalt: { id: 'cobalt', name: 'Cobalt Ore', icon: '🔵', type: 'resource', rarity: 'rare', description: 'Dense, metallic blue ore rich in deep-sea thermal regions.', stats: 'Resource material', isEquippable: false },
    volcanic: { id: 'volcanic', name: 'Volcanic Core', icon: '🟠', type: 'resource', rarity: 'epic', description: 'A highly reactive crystal containing volcanic thermal heat energy.', stats: 'Resource material', isEquippable: false },
    scrapMetal: { id: 'scrapMetal', name: 'Scrap Metal', icon: '⚙️', type: 'resource', rarity: 'common', description: 'Rusted steel plates salvaged from ship wreckage.', stats: 'Resource material', isEquippable: false },
    driftwood: { id: 'driftwood', name: 'Driftwood', icon: '🪵', type: 'resource', rarity: 'common', description: 'Sun-bleached sea logs. The fundamental material for raft expansions.', stats: 'Resource material', isEquippable: false },
    biomass: { id: 'biomass', name: 'Algae Biomass', icon: '🌿', type: 'resource', rarity: 'common', description: 'Raw ocean seaweed and biological biomass collected underwater.', stats: 'Resource material', isEquippable: false },
    stones: { id: 'stones', name: 'Volcanic Stones', icon: '🪨', type: 'resource', rarity: 'common', description: 'Heavy basalt rocks used for fires and heavy anchoring tools.', stats: 'Resource material', isEquippable: false },
    kelpFiber: { id: 'kelpFiber', name: 'Kelp Fiber', icon: '🌾', type: 'resource', rarity: 'common', description: 'Strong, woven strings harvested from deep giant kelp stalks.', stats: 'Resource material', isEquippable: false },
    treasure: { id: 'treasure', name: 'Precursor Treasure', icon: '👑', type: 'resource', rarity: 'legendary', description: 'A glittering golden ancient crown retrieved from abyssal ruins.', stats: 'Highly valuable trade material', isEquippable: false },
    food: { id: 'food', name: 'Foraged Food', icon: '🥗', type: 'resource', rarity: 'common', description: 'Nutritious island wild berries or coconuts.', stats: 'Consumable (Press U to eat)', isEquippable: false },
    rawFood: { id: 'rawFood', name: 'Raw Food', icon: '🥩', type: 'resource', rarity: 'common', description: 'Freshly caught raw fish or raw food. Needs to be cooked on a campfire before eating.', stats: 'Restores +15% hunger, but causes sickness (-5 HP)', isEquippable: false },
    cookedFood: { id: 'cookedFood', name: 'Cooked Food', icon: '🍗', type: 'resource', rarity: 'rare', description: 'Nicely flame-broiled and cooked on a campfire. Safe and extremely delicious!', stats: 'Consumable (Restores massive +30% hunger safely)', isEquippable: false },
    rope: { id: 'rope', name: 'Rare Rope', icon: '🧵', type: 'resource', rarity: 'rare', description: 'Strong, braided fiber rope harvested from rare island ruins chest. Crucial for advanced structural crafting.', stats: 'Resource material', isEquippable: false },
    cloth: { id: 'cloth', name: 'Woven Cloth', icon: '🧶', type: 'resource', rarity: 'common', description: 'Tightly woven plant fiber fabric. Used for beds and comfortable items.', stats: 'Resource material', isEquippable: false },
    leather: { id: 'leather', name: 'Cured Leather', icon: '💼', type: 'resource', rarity: 'rare', description: 'Cured skin from deep-sea life. Extremely tough and flexible.', stats: 'Resource material', isEquippable: false },
    ironBar: { id: 'ironBar', name: 'Iron Bar', icon: '🧱', type: 'resource', rarity: 'rare', description: 'Process scrap metal in the blast furnace to smelt these heavy ingots.', stats: 'Refined structural metal', isEquippable: false },
    clay: { id: 'clay', name: 'Seabed Clay', icon: '🧱', type: 'resource', rarity: 'common', description: 'Dredged from shallow sand bars. Essential for baking stone structures.', stats: 'Resource material', isEquippable: false },
    sharkSkin: { id: 'sharkSkin', name: 'Shark Skin', icon: '🦈', type: 'resource', rarity: 'epic', description: 'Rough, sandpaper-like dermal denticles from apex sharks.', stats: 'Exotic leather material', isEquippable: false },
    copperWire: { id: 'copperWire', name: 'Copper Wire', icon: '🔌', type: 'resource', rarity: 'rare', description: 'Salvaged wiring from sunken electronic components.', stats: 'Refined automation wiring', isEquippable: false },
    batteryScrap: { id: 'batteryScrap', name: 'Battery Scrap', icon: '🔋', type: 'resource', rarity: 'epic', description: 'Old leaking lead-acid cells containing raw chemical energy.', stats: 'Automation energy cell', isEquippable: false },
    plastic: { id: 'plastic', name: 'Marine Plastic', icon: '🥤', type: 'resource', rarity: 'common', description: 'Compact discarded polymer bottles recovered from ocean gyres.', stats: 'Resource material', isEquippable: false },
    leadScrap: { id: 'leadScrap', name: 'Lead Scrap', icon: '⛓️', type: 'resource', rarity: 'rare', description: 'Heavy dense sinking sinkers used to weigh down deep lines.', stats: 'High density ballast metal', isEquippable: false },
    armor_scrap: { id: 'armor_scrap', name: 'Scrap Plate Armor', icon: '🧱', type: 'chest', rarity: 'rare', description: 'Basic protection. Reduces incoming physical damage by 15% but slightly lowers swimming speed.', stats: '+15 ARMOR | -10% Swimming Speed', isEquippable: true },
    suit_shark: { id: 'suit_shark', name: 'Shark-Skin Wetsuit', icon: '🧜', type: 'chest', rarity: 'rare', description: 'Lightweight tactical gear. Increases swimming and underwater movement speed by 20%.', stats: '+5 ARMOR | +20% Swimming Speed', isEquippable: true },
    boots_weighted: { id: 'boots_weighted', name: 'Lead-Weighted Boots', icon: '🥾', type: 'legs', rarity: 'epic', description: 'Sinks you like a stone to the seabed instantly, conserving precious diving oxygen.', stats: '+12 ARMOR | Instant Sinking', isEquippable: true },
    
    // 12 NEW PROGRESSION LOOT & RAW MATERIALS TIERS
    ironScraps: { id: 'ironScraps', name: 'Iron Scraps', icon: '⚙️', type: 'resource', rarity: 'common', description: 'Raw iron scraps gathered from wreckages. A foundational material.', stats: 'Resource material', isEquippable: false },
    silicaSand: { id: 'silicaSand', name: 'Silica Sand', icon: '⏳', type: 'resource', rarity: 'common', description: 'Fine silica sand sifted from the ocean floor. Useful for glass and electronics.', stats: 'Resource material', isEquippable: false },
    
    rawTitanium: { id: 'rawTitanium', name: 'Raw Titanium', icon: '💎', type: 'resource', rarity: 'rare', description: 'Durable and lightweight raw titanium ore. Found in deeper zones.', stats: 'Resource material', isEquippable: false },
    volcanicCrystals: { id: 'volcanicCrystals', name: 'Volcanic Crystals', icon: '🟠', type: 'resource', rarity: 'rare', description: 'Thermal crystals charged with heat energy from vents.', stats: 'Resource material', isEquippable: false },
    lithiumBatteryPacks: { id: 'lithiumBatteryPacks', name: 'Lithium Battery Packs', icon: '🔋', type: 'resource', rarity: 'rare', description: 'Industrial lithium cell groups designed to power subsea rigs.', stats: 'Resource material', isEquippable: false },
    
    deepSeaUranium: { id: 'deepSeaUranium', name: 'Deep-Sea Uranium', icon: '☢️', type: 'resource', rarity: 'epic', description: 'Radioactive isotopes emitting green light, found only in deep trenches.', stats: 'Radioactive fuel material', isEquippable: false },
    ancientRelicFragments: { id: 'ancientRelicFragments', name: 'Ancient Relic Fragments', icon: '🏺', type: 'resource', rarity: 'epic', description: 'Shards of an ancient subsea civilization. Filled with advanced code.', stats: 'Rare historical data', isEquippable: false },
    corruptedAIChips: { id: 'corruptedAIChips', name: 'Corrupted AI Chips', icon: '👾', type: 'resource', rarity: 'epic', description: 'Silicon processing chips from failed deep-sea drones.', stats: 'Advanced computer logic', isEquippable: false },
    
    blackBoxCore: { id: 'blackBoxCore', name: 'Black Box Core', icon: '📦', type: 'resource', rarity: 'legendary', description: 'Armored server module recovered from high-tech research subs.', stats: 'High-value market asset', isEquippable: false },
    singularityShard: { id: 'singularityShard', name: 'Singularity Shard', icon: '🌌', type: 'resource', rarity: 'legendary', description: 'An unstable piece of dark matter defying gravitational pull.', stats: 'Fascinating gravitational asset', isEquippable: false },
    
    glitchArtifact: { id: 'glitchArtifact', name: 'Glitch Artifact', icon: '🌀', type: 'resource', rarity: 'legendary', description: 'The crown jewel asset: a hyper-rare shimmering void crystal.', stats: 'High-value legendary collectible', isEquippable: false },

    // 9 NEW CRAFTABLE PROGRESSION ITEMS
    titaniumHarpoon: { id: 'titaniumHarpoon', name: 'Titanium Harpoon', icon: '🔱', type: 'weapon', rarity: 'rare', description: 'A lightweight and razor-sharp titanium harpoon. Drastically boosts melee striking power.', stats: '+35 DAMAGE | Multiplies fish yield', isEquippable: true },
    magneticScanner: { id: 'magneticScanner', name: 'Magnetic Scanner', icon: '🧲', type: 'back', rarity: 'rare', description: 'Advanced magnetic scanner that passively highlights hidden ocean floor resources.', stats: '+10% Loot detection', isEquippable: true },
    kineticDrill: { id: 'kineticDrill', name: 'Kinetic Drill', icon: '⚙️', type: 'weapon', rarity: 'rare', description: 'A rapid mechanical drill to break deep subsea nodes 50% faster.', stats: '+15 DAMAGE | +30% Mining speed', isEquippable: true },
    thermalRegulators: { id: 'thermalRegulators', name: 'Thermal Regulators', icon: '🌡️', type: 'chest', rarity: 'rare', description: 'A specialized under-suit that neutralizes extreme temperatures and thermal vent damage.', stats: '+10 ARMOR | Immune to thermal vent heat', isEquippable: true },
    highCapacityOxygenRebreather: { id: 'highCapacityOxygenRebreather', name: 'High-Capacity Oxygen Rebreather', icon: '🤿', type: 'head', rarity: 'epic', description: 'Advanced closed-loop respiratory gear. Doubles your underwater oxygen conservation.', stats: '+15 ARMOR | -50% Oxygen depletion rate', isEquippable: true },
    glitchSubDriveMk1: { id: 'glitchSubDriveMk1', name: 'Glitch Sub-Drive Mk1', icon: '🚀', type: 'legs', rarity: 'epic', description: 'A reverse-engineered hyper-fast propulsion thruster for subsea speeds.', stats: '+8 ARMOR | +40% Swimming speed', isEquippable: true },
    reinforcedHullPlating: { id: 'reinforcedHullPlating', name: 'Reinforced Hull Plating', icon: '🛡️', type: 'chest', rarity: 'epic', description: 'Heavy alloy plates that maximize physical protection and reinforce health pools.', stats: '+40 ARMOR | +50 Max HP', isEquippable: true },
    bioFilterSuit: { id: 'bioFilterSuit', name: 'Bio-Filter Suit', icon: '🧜', type: 'chest', rarity: 'epic', description: 'A synthetic bio-barrier suit that decreases biological hunger drain by 40%.', stats: '+10 ARMOR | -40% Hunger depletion rate', isEquippable: true },
    empPulseModule: { id: 'empPulseModule', name: 'EMP Pulse Module', icon: '💥', type: 'back', rarity: 'legendary', description: 'A weapon attachment that releases electromagnetic disruption to paralyze incoming predators.', stats: 'Active predator counter', isEquippable: true },
  };

  // Build Bag Items List (resources > 0 and crafted unequipped items)
  const bagItems: { id: string; count: number; registryItem: ItemInfo }[] = [];

  const equippableKeys = [
    'titaniumHarpoon', 'magneticScanner', 'kineticDrill', 'thermalRegulators',
    'highCapacityOxygenRebreather', 'glitchSubDriveMk1', 'reinforcedHullPlating',
    'bioFilterSuit', 'empPulseModule'
  ];

  // 1. Add raw resources to the bag (skipping custom equippables)
  Object.entries(resources).forEach(([key, val]) => {
    if (val > 0 && itemRegistry[key] && !equippableKeys.includes(key)) {
      bagItems.push({
        id: key,
        count: val,
        registryItem: itemRegistry[key],
      });
    }
  });

  // 2. Add custom craftable equippables from resources (subtracting 1 if currently equipped)
  equippableKeys.forEach((key) => {
    const val = (resources as any)[key] || 0;
    if (val > 0) {
      const reg = itemRegistry[key];
      const slot = reg.type as keyof EquippedGear;
      const isEquipped = equippedItems[slot] === key;
      const displayCount = val - (isEquipped ? 1 : 0);
      if (displayCount > 0) {
        bagItems.push({
          id: key,
          count: displayCount,
          registryItem: reg,
        });
      }
    }
  });

  // 3. Add legacy crafted equippable items that are not equipped
  if (craftedItems.stoneAxe && equippedItems.weapon !== 'stoneAxe') {
    bagItems.push({ id: 'stoneAxe', count: 1, registryItem: itemRegistry.stoneAxe });
  }
  if (craftedItems.huntingBowSpear && equippedItems.weapon !== 'huntingBowSpear') {
    bagItems.push({ id: 'huntingBowSpear', count: 1, registryItem: itemRegistry.huntingBowSpear });
  }
  if (craftedItems.item_spear && equippedItems.weapon !== 'item_spear') {
    bagItems.push({ id: 'item_spear', count: 1, registryItem: itemRegistry.item_spear });
  }
  if (craftedItems.item_bow && equippedItems.weapon !== 'item_bow') {
    bagItems.push({ id: 'item_bow', count: 1, registryItem: itemRegistry.item_bow });
  }
  if (craftedItems.fishingRod && equippedItems.weapon !== 'fishingRod') {
    bagItems.push({ id: 'fishingRod', count: 1, registryItem: itemRegistry.fishingRod });
  }
  if (craftedItems.scubaHelmet && equippedItems.head !== 'scubaHelmet') {
    bagItems.push({ id: 'scubaHelmet', count: 1, registryItem: itemRegistry.scubaHelmet });
  }
  if (craftedItems.divingSuit && equippedItems.chest !== 'divingSuit') {
    bagItems.push({ id: 'divingSuit', count: 1, registryItem: itemRegistry.divingSuit });
  }
  if (craftedItems.propulsionFins && equippedItems.legs !== 'propulsionFins') {
    bagItems.push({ id: 'propulsionFins', count: 1, registryItem: itemRegistry.propulsionFins });
  }
  if (craftedItems.armor_scrap && equippedItems.chest !== 'armor_scrap') {
    bagItems.push({ id: 'armor_scrap', count: 1, registryItem: itemRegistry.armor_scrap });
  }
  if (craftedItems.suit_shark && equippedItems.chest !== 'suit_shark') {
    bagItems.push({ id: 'suit_shark', count: 1, registryItem: itemRegistry.suit_shark });
  }
  if (craftedItems.boots_weighted && equippedItems.legs !== 'boots_weighted') {
    bagItems.push({ id: 'boots_weighted', count: 1, registryItem: itemRegistry.boots_weighted });
  }

  // Handle click on item in Bag (Equip)
  const handleEquipItem = (itemId: string, itemType: string) => {
    audioSynth.playPickup();
    setEquippedItems((prev) => {
      const next = { ...prev };
      const typedKey = itemType as keyof EquippedGear;
      // If there was something else in that slot, it gets sent back to the bag implicitly
      next[typedKey] = itemId;
      return next;
    });
    addLog(`🛡️ EQUIPPED: ${itemRegistry[itemId]?.name || itemId} set to ${itemType.toUpperCase()} slot!`);
  };

  // Handle click on Slot (Unequip)
  const handleUnequipSlot = (slotType: keyof EquippedGear, itemId: string) => {
    audioSynth.playPickup();
    setEquippedItems((prev) => {
      const next = { ...prev };
      next[slotType] = null;
      return next;
    });
    addLog(`🎒 UNEQUIPPED: ${itemRegistry[itemId]?.name || itemId} returned to backpack inventory.`);
  };

  // Calculate stats
  let totalDamage = 5;
  let totalArmor = 0;

  if (equippedItems.weapon === 'stoneAxe') totalDamage = 12;
  else if (equippedItems.weapon === 'huntingBowSpear') totalDamage = 25;
  else if (equippedItems.weapon === 'item_spear') totalDamage = 25;
  else if (equippedItems.weapon === 'item_bow') totalDamage = 15;
  else if (equippedItems.weapon === 'fishingRod') totalDamage = 7;
  else if (equippedItems.weapon === 'titaniumHarpoon') totalDamage = 35;
  else if (equippedItems.weapon === 'kineticDrill') totalDamage = 15;

  if (equippedItems.head === 'scubaHelmet') totalArmor += 15;
  if (equippedItems.head === 'highCapacityOxygenRebreather') totalArmor += 15;
  if (equippedItems.chest === 'divingSuit') totalArmor += 30;
  if (equippedItems.chest === 'armor_scrap') totalArmor += 15;
  if (equippedItems.chest === 'suit_shark') totalArmor += 5;
  if (equippedItems.chest === 'thermalRegulators') totalArmor += 10;
  if (equippedItems.chest === 'reinforcedHullPlating') totalArmor += 40;
  if (equippedItems.chest === 'bioFilterSuit') totalArmor += 10;
  if (equippedItems.legs === 'propulsionFins') totalArmor += 10;
  if (equippedItems.legs === 'glitchSubDriveMk1') totalArmor += 8;
  if (equippedItems.legs === 'boots_weighted') totalArmor += 12;
  if (equippedItems.back === 'oxygenTank') totalArmor += 5;
  if (equippedItems.back === 'empPulseModule') totalArmor += 5;
  if (equippedItems.back === 'magneticScanner') totalArmor += 5;

  const rarityColor = {
    common: 'border-slate-500/30 text-slate-400',
    rare: 'border-cyan-500/40 text-cyan-400',
    epic: 'border-purple-500/40 text-purple-400',
    legendary: 'border-amber-500/50 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.2)]',
  };

  return (
    <div
      id="character-inventory-screen"
      className="absolute inset-0 bg-black/85 backdrop-blur-md z-45 flex items-center justify-center p-4 overflow-y-auto select-none"
    >
      <motion.div
        initial={{ scale: 0.9, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 30, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 180 }}
        style={{ backgroundColor: '#1d120a', borderColor: '#4a2c11' }}
        className="border-[6px] max-w-4xl w-full rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.8)] relative text-amber-100 flex flex-col overflow-hidden"
      >
        {/* Intricate RPG Golden Corner Ornaments */}
        <div className="absolute top-1 left-1 text-[10px] text-amber-600/60 font-mono">◆</div>
        <div className="absolute top-1 right-1 text-[10px] text-amber-600/60 font-mono">◆</div>
        <div className="absolute bottom-1 left-1 text-[10px] text-amber-600/60 font-mono">◆</div>
        <div className="absolute bottom-1 right-1 text-[10px] text-amber-600/60 font-mono">◆</div>

        {/* TOP HEADER SECTION */}
        <div className="border-b-[3px] border-[#4a2c11] px-6 py-4 flex justify-between items-center bg-[#24170e]">
          <div>
            <span className="font-mono text-[9px] text-amber-500/80 tracking-widest block uppercase font-bold">
              ★ DEEP OCEAN SECTOR ARCHIVE ★
            </span>
            <h2 className="font-serif italic font-light text-2xl text-amber-100 flex items-center gap-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
              🛡️ {charName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 border-2 border-[#5a4533] hover:border-amber-400 bg-[#14100d] hover:bg-[#2c1a10] text-amber-400 hover:text-amber-200 text-xs font-mono transition-all duration-100 cursor-pointer rounded shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]"
          >
            [ CLOSE INVENTORY (I) ]
          </button>
        </div>

        {/* THREE COLUMN VIEWPORT BODY */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 p-5 bg-[#140f0a]">
          {/* COLUMN 1: LEFT EQUIPMENT SLOTS */}
          <div className="md:col-span-3 flex flex-col justify-around gap-4 bg-[#1e150f] p-4 border border-[#4a2c11] rounded shadow-inner">
            <h3 className="text-xs text-amber-500 uppercase font-mono tracking-widest text-center border-b border-[#4a2c11] pb-1.5">
              Active Gear
            </h3>
            
            {/* SLOT HEAD */}
            <div 
              onMouseEnter={() => equippedItems.head ? setHoveredItem(itemRegistry[equippedItems.head]) : null}
              onMouseLeave={() => setHoveredItem(null)}
              className="flex items-center gap-3"
            >
              <div
                onClick={() => equippedItems.head && handleUnequipSlot('head', equippedItems.head)}
                className={`w-[60px] h-[60px] flex items-center justify-center relative rounded border-2 transition-all ${
                  equippedItems.head 
                    ? 'border-cyan-500/50 bg-[#282119] hover:border-red-500 cursor-pointer shadow-[0_0_8px_rgba(6,182,212,0.15)]' 
                    : 'border-[#5a4533] bg-[#0d0a08]'
                }`}
                style={{ background: equippedItems.head ? '#211912' : '#0d0a08' }}
              >
                {equippedItems.head ? (
                  <>
                    <span className="text-2xl">{itemRegistry[equippedItems.head].icon}</span>
                    <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[7px] font-mono text-cyan-400 text-center uppercase tracking-wider">HEAD</span>
                    <span className="absolute -top-1 -right-1 text-[8px] bg-red-800 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold opacity-0 hover:opacity-100 transition-opacity">×</span>
                  </>
                ) : (
                  <div className="flex flex-col items-center opacity-35 text-[9px] font-mono">
                    <span className="text-lg">🤿</span>
                    <span>HEAD</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col text-[11px]">
                <span className="text-amber-500 font-bold">HEADGEAR</span>
                <span className="text-slate-400">{equippedItems.head ? itemRegistry[equippedItems.head].name : 'None Equipped'}</span>
              </div>
            </div>

            {/* SLOT CHEST */}
            <div 
              onMouseEnter={() => equippedItems.chest ? setHoveredItem(itemRegistry[equippedItems.chest]) : null}
              onMouseLeave={() => setHoveredItem(null)}
              className="flex items-center gap-3"
            >
              <div
                onClick={() => equippedItems.chest && handleUnequipSlot('chest', equippedItems.chest)}
                className={`w-[60px] h-[60px] flex items-center justify-center relative rounded border-2 transition-all ${
                  equippedItems.chest 
                    ? 'border-purple-500/50 bg-[#282119] hover:border-red-500 cursor-pointer shadow-[0_0_8px_rgba(168,85,247,0.15)]' 
                    : 'border-[#5a4533] bg-[#0d0a08]'
                }`}
                style={{ background: equippedItems.chest ? '#211912' : '#0d0a08' }}
              >
                {equippedItems.chest ? (
                  <>
                    <span className="text-2xl">{itemRegistry[equippedItems.chest].icon}</span>
                    <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[7px] font-mono text-purple-400 text-center uppercase tracking-wider">SUIT</span>
                    <span className="absolute -top-1 -right-1 text-[8px] bg-red-800 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold opacity-0 hover:opacity-100 transition-opacity">×</span>
                  </>
                ) : (
                  <div className="flex flex-col items-center opacity-35 text-[9px] font-mono">
                    <span className="text-lg">🛡️</span>
                    <span>CHEST</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col text-[11px]">
                <span className="text-amber-500 font-bold">CHEST ARMOR</span>
                <span className="text-slate-400">{equippedItems.chest ? itemRegistry[equippedItems.chest].name : 'None Equipped'}</span>
              </div>
            </div>

            {/* SLOT WEAPON */}
            <div 
              onMouseEnter={() => equippedItems.weapon ? setHoveredItem(itemRegistry[equippedItems.weapon]) : null}
              onMouseLeave={() => setHoveredItem(null)}
              className="flex items-center gap-3"
            >
              <div
                onClick={() => equippedItems.weapon && handleUnequipSlot('weapon', equippedItems.weapon)}
                className={`w-[60px] h-[60px] flex items-center justify-center relative rounded border-2 transition-all ${
                  equippedItems.weapon 
                    ? 'border-emerald-500/50 bg-[#282119] hover:border-red-500 cursor-pointer shadow-[0_0_8px_rgba(16,185,129,0.15)]' 
                    : 'border-[#5a4533] bg-[#0d0a08]'
                }`}
                style={{ background: equippedItems.weapon ? '#211912' : '#0d0a08' }}
              >
                {equippedItems.weapon ? (
                  <>
                    <span className="text-2xl">{itemRegistry[equippedItems.weapon].icon}</span>
                    <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[7px] font-mono text-emerald-400 text-center uppercase tracking-wider">WEAPON</span>
                    <span className="absolute -top-1 -right-1 text-[8px] bg-red-800 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold opacity-0 hover:opacity-100 transition-opacity">×</span>
                  </>
                ) : (
                  <div className="flex flex-col items-center opacity-35 text-[9px] font-mono">
                    <span className="text-lg">🪓</span>
                    <span>WEAPON</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col text-[11px]">
                <span className="text-amber-500 font-bold">MAIN HAND</span>
                <span className="text-slate-400">{equippedItems.weapon ? itemRegistry[equippedItems.weapon].name : 'Unarmed (Fists)'}</span>
              </div>
            </div>

            {/* SLOT LEGS */}
            <div 
              onMouseEnter={() => equippedItems.legs ? setHoveredItem(itemRegistry[equippedItems.legs]) : null}
              onMouseLeave={() => setHoveredItem(null)}
              className="flex items-center gap-3"
            >
              <div
                onClick={() => equippedItems.legs && handleUnequipSlot('legs', equippedItems.legs)}
                className={`w-[60px] h-[60px] flex items-center justify-center relative rounded border-2 transition-all ${
                  equippedItems.legs 
                    ? 'border-orange-500/50 bg-[#282119] hover:border-red-500 cursor-pointer shadow-[0_0_8px_rgba(249,115,22,0.15)]' 
                    : 'border-[#5a4533] bg-[#0d0a08]'
                }`}
                style={{ background: equippedItems.legs ? '#211912' : '#0d0a08' }}
              >
                {equippedItems.legs ? (
                  <>
                    <span className="text-2xl">{itemRegistry[equippedItems.legs].icon}</span>
                    <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[7px] font-mono text-orange-400 text-center uppercase tracking-wider">LEGS</span>
                    <span className="absolute -top-1 -right-1 text-[8px] bg-red-800 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold opacity-0 hover:opacity-100 transition-opacity">×</span>
                  </>
                ) : (
                  <div className="flex flex-col items-center opacity-35 text-[9px] font-mono">
                    <span className="text-lg">🚀</span>
                    <span>FINS</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col text-[11px]">
                <span className="text-amber-500 font-bold">SWIM LEGS</span>
                <span className="text-slate-400">{equippedItems.legs ? itemRegistry[equippedItems.legs].name : 'None Equipped'}</span>
              </div>
            </div>

            {/* SLOT BACK */}
            <div 
              onMouseEnter={() => equippedItems.back ? setHoveredItem(itemRegistry[equippedItems.back]) : null}
              onMouseLeave={() => setHoveredItem(null)}
              className="flex items-center gap-3"
            >
              <div
                onClick={() => equippedItems.back && handleUnequipSlot('back', equippedItems.back)}
                className={`w-[60px] h-[60px] flex items-center justify-center relative rounded border-2 transition-all ${
                  equippedItems.back 
                    ? 'border-slate-500/50 bg-[#282119] hover:border-red-500 cursor-pointer' 
                    : 'border-[#5a4533] bg-[#0d0a08]'
                }`}
                style={{ background: equippedItems.back ? '#211912' : '#0d0a08' }}
              >
                {equippedItems.back ? (
                  <>
                    <span className="text-2xl">{itemRegistry[equippedItems.back].icon}</span>
                    <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[7px] font-mono text-slate-400 text-center uppercase tracking-wider">BACK</span>
                    <span className="absolute -top-1 -right-1 text-[8px] bg-red-800 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold opacity-0 hover:opacity-100 transition-opacity">×</span>
                  </>
                ) : (
                  <div className="flex flex-col items-center opacity-35 text-[9px] font-mono">
                    <span className="text-lg">🎒</span>
                    <span>BACK</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col text-[11px]">
                <span className="text-amber-500 font-bold">BACKPACK</span>
                <span className="text-slate-400">{equippedItems.back ? itemRegistry[equippedItems.back].name : 'None Equipped'}</span>
              </div>
            </div>
          </div>

          {/* COLUMN 2: CENTER PANEL - VIEWPORT BOX SHOWCASING CHARACTER MESH */}
          <div className="md:col-span-4 flex flex-col bg-[#0b0805] border-[3px] border-[#4a2c11] rounded p-4 relative h-[360px] md:h-auto overflow-hidden shadow-inner">
            {/* Ambient Water Bubbles floating behind the character */}
            <div className="absolute inset-0 pointer-events-none opacity-20 bg-gradient-to-t from-cyan-950/40 to-transparent flex justify-around">
              <span className="animate-bounce delay-100 text-cyan-400 text-xs mt-32">⚪</span>
              <span className="animate-bounce delay-500 text-cyan-400 text-[10px] mt-12">⚪</span>
              <span className="animate-bounce delay-1000 text-cyan-400 text-sm mt-44">⚪</span>
              <span className="animate-bounce delay-300 text-cyan-400 text-[9px] mt-24">⚪</span>
            </div>

            <div className="absolute top-2 left-2 text-[8px] font-mono text-amber-500/50 uppercase tracking-widest bg-black/40 px-2 py-0.5 rounded border border-amber-950">
              3D PREVIEW PORT
            </div>

            {/* SATISFYING INTERACTIVE CHARACTER VECTOR VISUALIZATION */}
            <div className="flex-1 flex flex-col items-center justify-center relative mt-6">
              <motion.div 
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                className="w-36 h-64 flex flex-col items-center justify-center relative"
              >
                {/* 1. Helmet / Goggles overlay */}
                <div className="relative w-12 h-12 flex items-center justify-center z-20">
                  {/* Visor Goggles */}
                  <div 
                    className={`absolute w-10 h-6 top-4 rounded border transition-all ${
                      equippedItems.head === 'scubaHelmet'
                        ? 'bg-amber-500 border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                        : 'bg-cyan-400 border-cyan-200'
                    }`}
                  >
                    <div className="w-8 h-2 bg-white/40 mx-auto mt-1 rounded-sm" />
                  </div>
                  {/* Outer Helmet */}
                  <div 
                    className={`w-12 h-12 rounded-full border-2 transition-all ${
                      equippedItems.head === 'scubaHelmet'
                        ? 'border-amber-400 bg-amber-800'
                        : 'border-[#5a4533] bg-pink-200'
                    }`}
                  >
                    {equippedItems.head === 'scubaHelmet' && (
                      <div className="absolute -top-1 left-4 right-4 h-2 bg-amber-500 rounded-t" />
                    )}
                  </div>
                </div>

                {/* 2. Torso / Body Suit */}
                <div 
                  className={`w-16 h-24 border-2 rounded-md mt-1 relative z-10 transition-all ${
                    equippedItems.chest === 'divingSuit'
                      ? 'bg-slate-800 border-slate-600 shadow-[0_0_10px_rgba(30,41,59,0.3)]'
                      : 'bg-yellow-500 border-yellow-400'
                  }`}
                >
                  {/* Oxygen Tank on back */}
                  {equippedItems.back === 'oxygenTank' && (
                    <div className="absolute -left-3 top-2 bottom-2 w-3 bg-slate-400 border border-slate-300 rounded-l" />
                  )}

                  {/* Left hand holding equipped weapon representation */}
                  {equippedItems.weapon && (
                    <motion.div 
                      animate={{ rotate: [0, 15, 0] }}
                      transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                      className="absolute -right-10 top-8 bg-[#2d1b0d] border border-amber-600 rounded px-1.5 py-1 text-sm flex items-center justify-center font-bold z-20"
                    >
                      {itemRegistry[equippedItems.weapon].icon}
                    </motion.div>
                  )}
                  
                  {/* High quality suit decals */}
                  <div className="w-8 h-2 bg-black/20 mx-auto mt-4 rounded-sm" />
                  <div className="w-10 h-4 bg-[#14100d] mx-auto mt-6 rounded border border-amber-900/50 flex items-center justify-center text-[7px] font-mono text-cyan-400">
                    O₂ INTL
                  </div>
                </div>

                {/* 3. Limbs / Legs */}
                <div className="flex gap-4 mt-1 z-10">
                  <div className={`w-4 h-14 border transition-all ${equippedItems.chest === 'divingSuit' ? 'bg-slate-800 border-slate-600' : 'bg-slate-700 border-slate-600'} rounded-b`}>
                    {/* Foot Fins */}
                    <div className={`w-6 h-3 -ml-1 mt-11 rounded-t border transition-all ${equippedItems.legs === 'propulsionFins' ? 'bg-red-600 border-red-400' : 'bg-orange-500 border-orange-400'}`} />
                  </div>
                  <div className={`w-4 h-14 border transition-all ${equippedItems.chest === 'divingSuit' ? 'bg-slate-800 border-slate-600' : 'bg-slate-700 border-slate-600'} rounded-b`}>
                    {/* Foot Fins */}
                    <div className={`w-6 h-3 -ml-1 mt-11 rounded-t border transition-all ${equippedItems.legs === 'propulsionFins' ? 'bg-red-600 border-red-400' : 'bg-orange-500 border-orange-400'}`} />
                  </div>
                </div>
              </motion.div>

              {/* Status display overlay */}
              <div className="absolute bottom-1 left-0 right-0 text-center text-[10px] font-mono text-amber-500/80 tracking-widest">
                DIVER CONDITION: STABLE
              </div>
            </div>

            {/* STAT BARS AT THE BOTTOM FOR "DAMAGE" & "ARMOR" */}
            <div className="border-t-2 border-[#4a2c11] pt-3.5 mt-3 space-y-2.5">
              {/* DAMAGE BAR */}
              <div>
                <div className="flex justify-between items-baseline text-xs mb-1 font-mono">
                  <span className="text-amber-400 font-bold">⚔️ DAMAGE POWER</span>
                  <span className="text-amber-200 font-bold">{totalDamage} DMG</span>
                </div>
                <div className="w-full h-3 bg-black rounded border border-[#5a4533] overflow-hidden relative shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]">
                  <div 
                    className="h-full bg-gradient-to-r from-red-800 to-red-500 rounded-r shadow-[0_0_4px_rgba(239,68,68,0.4)] transition-all duration-300"
                    style={{ width: `${Math.min(100, (totalDamage / 30) * 100)}%` }}
                  />
                </div>
              </div>

              {/* ARMOR BAR */}
              <div>
                <div className="flex justify-between items-baseline text-xs mb-1 font-mono">
                  <span className="text-cyan-400 font-bold">🛡️ ARMOR PROTECTION</span>
                  <span className="text-cyan-200 font-bold">{totalArmor} ARMOR</span>
                </div>
                <div className="w-full h-3 bg-black rounded border border-[#5a4533] overflow-hidden relative shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-800 to-cyan-500 rounded-r shadow-[0_0_4px_rgba(6,182,212,0.4)] transition-all duration-300"
                    style={{ width: `${Math.min(100, (totalArmor / 60) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* COLUMN 3: RIGHT PANEL: ITEMS BAG GRID CONTAINER */}
          <div className="md:col-span-5 flex flex-col bg-[#1e150f] p-4 border border-[#4a2c11] rounded shadow-inner">
            <h3 className="text-xs text-amber-500 uppercase font-mono tracking-widest text-center border-b border-[#4a2c11] pb-1.5 mb-3.5">
              🎒 Items Bag Backpack ({bagItems.length} / 24)
            </h3>

            {/* Dynamic grid square list - 4 columns x 6 rows (24 total slots) */}
            <div className="grid grid-cols-4 gap-2.5 max-h-[290px] overflow-y-auto pr-1">
              {(() => {
                const totalSlots = 24;
                const slotElements = [];

                for (let i = 0; i < totalSlots; i++) {
                  const item = bagItems[i];

                  if (item) {
                    const rarityBorder = rarityColor[item.registryItem.rarity];
                    slotElements.push(
                      <div
                        key={`bag-slot-${i}`}
                        onMouseEnter={() => setHoveredItem(item.registryItem)}
                        onMouseLeave={() => setHoveredItem(null)}
                        onClick={() => {
                          setSelectedItem(item.registryItem);
                          if (item.registryItem.isEquippable) {
                            handleEquipItem(item.id, item.registryItem.type);
                          }
                        }}
                        style={{ background: '#14100d' }}
                        className={`w-[60px] h-[60px] mx-auto border-2 rounded flex flex-col items-center justify-center relative cursor-pointer select-none transition-all duration-150 hover:border-amber-400 hover:scale-105 active:scale-95 group shadow-md ${
                          selectedItem?.id === item.id 
                            ? 'border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)] bg-[#1e150f]' 
                            : 'border-[#5a4533]'
                        }`}
                      >
                        {/* Item Icon */}
                        <span className="text-2xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.6)]">{item.registryItem.icon}</span>

                        {/* Stacking count label (for raw resource materials) */}
                        {item.count > 1 && (
                          <span className="absolute bottom-0.5 right-1.5 bg-black/75 px-1 border border-amber-900/40 text-amber-300 text-[8px] font-mono font-bold rounded">
                            {item.count}
                          </span>
                        )}

                        {/* Rarity trim marker */}
                        <div className={`absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full ${
                          item.registryItem.rarity === 'common' ? 'bg-slate-400/40' :
                          item.registryItem.rarity === 'rare' ? 'bg-cyan-400/80 shadow-[0_0_4px_cyan]' :
                          item.registryItem.rarity === 'epic' ? 'bg-purple-400/80 shadow-[0_0_4px_purple]' :
                          'bg-amber-400 animate-pulse shadow-[0_0_6px_amber]'
                        }`} />

                        {/* Hover Quick Action Cue */}
                        {item.registryItem.isEquippable && (
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[7px] font-mono text-amber-400 uppercase tracking-widest font-bold text-center">
                            EQUIP
                          </div>
                        )}
                      </div>
                    );
                  } else {
                    // Empty recessed dark box slot
                    slotElements.push(
                      <div
                        key={`bag-slot-${i}`}
                        style={{ background: '#0d0a08' }}
                        className="w-[60px] h-[60px] mx-auto border-2 border-[#33251a]/60 rounded flex items-center justify-center opacity-30 cursor-default select-none shadow-inner"
                      >
                        <span className="text-amber-900/20 text-xs">◆</span>
                      </div>
                    );
                  }
                }
                return slotElements;
              })()}
            </div>

            {/* Quick Helper hint text */}
            <p className="text-[9px] text-amber-600/60 text-center font-mono uppercase mt-4 tracking-wider">
              [ Click to Equip Gear | Hover slots for Lore & Details ]
            </p>
          </div>
        </div>

        {/* BOTTOM ITEM DETAIL TOOLTIP PANEL */}
        <div className="border-t-[3px] border-[#4a2c11] px-5 py-3.5 bg-[#17100a] min-h-[90px] flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {(() => {
              const displayedItem = hoveredItem || selectedItem;
              if (displayedItem) {
                return (
                  <motion.div
                    key={displayedItem.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="flex items-center justify-between gap-4 w-full"
                  >
                    <div className="flex items-start gap-4 flex-1">
                      <div className="text-3xl mt-0.5">{displayedItem.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-serif italic text-sm text-amber-200 font-bold">{displayedItem.name}</h4>
                          <span className="text-[7px] px-1.5 py-0.2 bg-black/40 border border-amber-900/30 text-amber-500 rounded uppercase font-bold tracking-wider">
                            {displayedItem.rarity}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-0.5 font-sans leading-relaxed">{displayedItem.description}</p>
                        <p className="text-[9px] text-amber-500 font-mono font-bold mt-1 tracking-wider uppercase">⚔️ STATS: {displayedItem.stats}</p>
                      </div>
                    </div>

                    {/* Edible Action Button */}
                    {(displayedItem.id === 'food' || displayedItem.id === 'rawFood' || displayedItem.id === 'cookedFood') && (
                      <div className="flex flex-col items-center justify-center pl-4 border-l border-[#4a2c11]/50">
                        <button
                          id="inventory-eat-button"
                          onClick={() => {
                            const itemKey = displayedItem.id as 'food' | 'rawFood' | 'cookedFood';
                            const count = resources[itemKey] || 0;
                            if (count <= 0) {
                              addLog(`⚠️ NO ${displayedItem.name.toUpperCase()}: You don't have any left to eat!`);
                              audioSynth.playPing();
                              return;
                            }
                            if (hunger >= 100) {
                              addLog("😋 ALREADY FULL: Your hunger is fully satisfied!");
                              audioSynth.playPing();
                              return;
                            }

                            // Deduct item
                            setResources((prev) => ({
                              ...prev,
                              [itemKey]: Math.max(0, (prev[itemKey] || 0) - 1),
                            }));

                            // Apply health/hunger changes based on item type
                            if (itemKey === 'rawFood') {
                              setHunger((prev) => Math.min(100, prev + 15));
                              setHealth((prev) => Math.max(0, prev - 5));
                              addLog("🥩 EATEN RAW FOOD: Restored 15% hunger, but causes toxicity sickness (-5 HP)!");
                              if (audioSynth.playError) {
                                audioSynth.playError();
                              } else {
                                audioSynth.playPing();
                              }
                            } else if (itemKey === 'food') {
                              setHunger((prev) => Math.min(100, prev + 25));
                              addLog("🍎 CONSUMED FORAGED FOOD: Restored 25% hunger/energy!");
                              audioSynth.playPickup();
                            } else if (itemKey === 'cookedFood') {
                              setHunger((prev) => Math.min(100, prev + 30));
                              addLog("🍗 CONSUMED COOKED FOOD: Safe & delicious! Restored 30% hunger/energy!");
                              audioSynth.playPickup();
                            }
                          }}
                          className="px-5 py-2 bg-gradient-to-b from-[#e67e22] to-[#d35400] text-[#f5ebd6] hover:from-[#f39c12] hover:to-[#e67e22] text-xs font-black uppercase font-mono rounded border-2 border-[#4a2c11] hover:border-amber-400 active:scale-95 transition-all shadow-md cursor-pointer text-center whitespace-nowrap"
                        >
                          🍴 Eat One ({resources[displayedItem.id as 'food' | 'rawFood' | 'cookedFood'] || 0})
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              } else {
                return (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.4 }}
                    className="text-center font-mono text-[10px] text-amber-600/50 uppercase tracking-wider"
                  >
                    ◆ Click any equipment slot or bag item to select, stats & actions ◆
                  </motion.div>
                );
              }
            })()}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
