import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { audioSynth } from './audio';
import CharacterInventoryScreen from './components/CharacterInventoryScreen';
import ChestInventoryModal from './components/ChestInventoryModal';

// Local pure definitions to ensure absolute self-contained reliability
interface UpgradeItem {
  id: string;
  name: string;
  level: number;
  maxLevel: number;
  costSeaGlass: number;
  costCobalt: number;
  costVolcanic: number;
  benefit: number;
}

interface CrystalData {
  id: string;
  type: 'sea_glass' | 'cobalt' | 'volcanic' | 'scrap_metal' | 'biomass' | 'driftwood' | 'treasure' |
        'ironScraps' | 'silicaSand' | 'copperWire' | 'rawTitanium' | 'volcanicCrystals' | 'lithiumBatteryPacks' |
        'deepSeaUranium' | 'ancientRelicFragments' | 'corruptedAIChips' | 'blackBoxCore' | 'singularityShard' | 'glitchArtifact';
  mesh: THREE.Object3D;
  originalY: number;
  collected: boolean;
  color: number | string;
}

interface HazardData {
  id: string;
  type: 'urchin' | 'shark';
  mesh: THREE.Group;
  health: number;
  speed: number;
  radius: number;
  angle: number;
  originalY: number;
}

interface IslandTree {
  id: string;
  mesh: THREE.Group;
  hits: number;
  shakeTimer: number;
  originalX: number;
  originalZ: number;
}

interface IslandFood {
  id: string;
  mesh: THREE.Group;
  type: 'berry' | 'coconut';
}

interface ForageableItem {
  id: string;
  type: 'driftwood_stick' | 'loose_scrap' | 'drifting_log';
  mesh: THREE.Object3D;
  originalY: number;
}

interface RareChest {
  id: string;
  mesh: THREE.Group;
  lidMesh: THREE.Mesh;
  opened: boolean;
  openProgress: number;
}

interface IslandEnemy {
  id: string;
  mesh: THREE.Group;
  health: number;
  speed: number;
  state: 'idle' | 'chase';
  islandCenter: { x: number; z: number };
  aggroTable?: Record<string, number>;
  currentTargetId?: string | null;
}

let isSwimming = false;
let activePlacementProp: 'campfire' | 'chest' | 'bed_straw' | 'hammock_luxury' | 'spikes_wood' | 'spikes_iron' | 'smelter_furnace' | 'magnet_buoy' | 'oxygen_line' | 'raft_sail' | 'anchor' | 'steering_wheel' | 'water_purifier' | 'advanced_smelter' | 'crop_plot' | 'research_table' | 'wooden_chair' | 'wooden_table' | 'standing_lantern' | 'crew_bed' | null = null;
let ghostPropMesh: THREE.Group | null = null;
let islandEnemies: IslandEnemy[] = [];
let isSailCrafted = false;
let totalTilesBuilt = 0;
let raftVelocity = { x: 0, z: 0.05 };

function getNextTileCost() {
  return 5 + Math.floor(totalTilesBuilt * 1.5);
}

const createGhostPropMesh = (type: 'campfire' | 'chest' | 'bed_straw' | 'hammock_luxury' | 'spikes_wood' | 'spikes_iron' | 'smelter_furnace' | 'magnet_buoy' | 'oxygen_line' | 'raft_sail' | 'anchor' | 'steering_wheel' | 'water_purifier' | 'advanced_smelter' | 'crop_plot' | 'research_table' | 'wooden_chair' | 'wooden_table' | 'standing_lantern' | 'crew_bed') => {
  const ghostGroup = new THREE.Group();
  if (type === 'campfire') {
    // 1. Elegant circular ring of 8 stone blocks
    const stoneGeom = new THREE.DodecahedronGeometry(0.12, 0);
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x64748b, // slate grey stone
      roughness: 0.9,
      transparent: true,
      opacity: 0.5,
    });
    const ringRadius = 0.55;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const stoneMesh = new THREE.Mesh(stoneGeom, stoneMat);
      stoneMesh.position.set(Math.sin(angle) * ringRadius, 0.08, Math.cos(angle) * ringRadius);
      stoneMesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      ghostGroup.add(stoneMesh);
    }

    // 2. Wood tripod (three thin cylindrical/box poles tilted inward and intersecting at the top)
    const poleGeom = new THREE.CylinderGeometry(0.03, 0.03, 0.8, 4);
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x451a03, // dark wood poles
      roughness: 0.95,
      transparent: true,
      opacity: 0.5,
    });
    
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const pole = new THREE.Mesh(poleGeom, poleMat);
      const px = Math.sin(angle) * 0.25;
      const pz = Math.cos(angle) * 0.25;
      pole.position.set(px, 0.35, pz);
      
      pole.rotation.z = -Math.sin(angle) * 0.4;
      pole.rotation.x = Math.cos(angle) * 0.4;
      pole.rotation.y = -angle;

      ghostGroup.add(pole);
    }

    // 3. Bright orange ember/coal cube inside the stone ring
    const coalGeom = new THREE.BoxGeometry(0.35, 0.2, 0.35);
    const coalMat = new THREE.MeshStandardMaterial({
      color: 0x333333, // Default unlit dark charcoal
      emissive: 0x000000,
      emissiveIntensity: 0.0,
      transparent: true,
      opacity: 0.5,
      roughness: 0.9,
    });
    const coalMesh = new THREE.Mesh(coalGeom, coalMat);
    coalMesh.position.y = 0.1;
    coalMesh.userData = { type: 'coal' }; // tag to toggle lit state
    ghostGroup.add(coalMesh);
  } else if (type === 'chest') {
    // Bottom base box
    const baseGeom = new THREE.BoxGeometry(1.2, 0.6, 0.8);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x5c2c16, // Rich deep brown wood
      transparent: true,
      opacity: 0.5,
      roughness: 0.8,
    });
    const baseMesh = new THREE.Mesh(baseGeom, baseMat);
    baseMesh.position.y = 0.3;
    ghostGroup.add(baseMesh);

    // Lid box (slightly wider, aligned directly above)
    const lidGeom = new THREE.BoxGeometry(1.26, 0.3, 0.88);
    const lidMat = new THREE.MeshStandardMaterial({
      color: 0x783e1e, // Slightly warmer brown
      transparent: true,
      opacity: 0.5,
      roughness: 0.7,
    });
    const lidMesh = new THREE.Mesh(lidGeom, lidMat);
    lidMesh.position.y = 0.6 + 0.15;
    ghostGroup.add(lidMesh);

    // Latch box (front-center metallic latch lock)
    const latchGeom = new THREE.BoxGeometry(0.15, 0.2, 0.08);
    const latchMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37, // Gold/Brass metal
      metalness: 0.8,
      roughness: 0.2,
      transparent: true,
      opacity: 0.5,
    });
    const latchMesh = new THREE.Mesh(latchGeom, latchMat);
    latchMesh.position.set(0, 0.55, 0.44);
    ghostGroup.add(latchMesh);
  } else if (type === 'bed_straw') {
    // Bed frame box (brown wood)
    const frameGeom = new THREE.BoxGeometry(1.2, 0.2, 2.0);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x5c2c16, // dark wood brown
      transparent: true,
      opacity: 0.5,
      roughness: 0.8,
    });
    const frameMesh = new THREE.Mesh(frameGeom, frameMat);
    frameMesh.position.y = 0.1;
    ghostGroup.add(frameMesh);

    // Straw mattress (yellow/golden)
    const mattressGeom = new THREE.BoxGeometry(1.1, 0.15, 1.8);
    const mattressMat = new THREE.MeshStandardMaterial({
      color: 0xeab308, // straw yellow
      transparent: true,
      opacity: 0.5,
      roughness: 0.9,
    });
    const mattressMesh = new THREE.Mesh(mattressGeom, mattressMat);
    mattressMesh.position.set(0, 0.15, 0);
    ghostGroup.add(mattressMesh);

    // Simple pillow (cream white)
    const pillowGeom = new THREE.BoxGeometry(0.9, 0.1, 0.4);
    const pillowMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a, // soft off-white/yellow
      transparent: true,
      opacity: 0.5,
    });
    const pillowMesh = new THREE.Mesh(pillowGeom, pillowMat);
    pillowMesh.position.set(0, 0.25, -0.6);
    ghostGroup.add(pillowMesh);
  } else if (type === 'hammock_luxury') {
    // Left post
    const postGeom = new THREE.CylinderGeometry(0.06, 0.06, 1.2, 5);
    const postMat = new THREE.MeshStandardMaterial({
      color: 0x783e1e, // wood post
      transparent: true,
      opacity: 0.5,
    });
    const leftPost = new THREE.Mesh(postGeom, postMat);
    leftPost.position.set(0, 0.6, -0.9);
    ghostGroup.add(leftPost);

    // Right post
    const rightPost = leftPost.clone();
    rightPost.position.set(0, 0.6, 0.9);
    ghostGroup.add(rightPost);

    // Hammock cloth bed (curved shape represented by a box with blue-teal colors)
    const canvasGeom = new THREE.BoxGeometry(0.8, 0.04, 1.6);
    const canvasMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4, // vibrant cyan/teal canvas
      transparent: true,
      opacity: 0.5,
      roughness: 0.7,
    });
    const canvasMesh = new THREE.Mesh(canvasGeom, canvasMat);
    canvasMesh.position.set(0, 0.5, 0);
    ghostGroup.add(canvasMesh);

    // Pillow
    const pillowGeom = new THREE.BoxGeometry(0.6, 0.08, 0.3);
    const pillowMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
    });
    const pillowMesh = new THREE.Mesh(pillowGeom, pillowMat);
    pillowMesh.position.set(0, 0.55, -0.6);
    ghostGroup.add(pillowMesh);
  } else if (type === 'spikes_wood') {
    // Base board
    const baseGeom = new THREE.BoxGeometry(1.4, 0.1, 1.4);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x3b2314, // dark wood
      transparent: true,
      opacity: 0.5,
    });
    const baseMesh = new THREE.Mesh(baseGeom, baseMat);
    baseMesh.position.y = 0.05;
    ghostGroup.add(baseMesh);

    // Pointed wood spikes
    const spikeGeom = new THREE.ConeGeometry(0.12, 0.8, 4);
    const spikeMat = new THREE.MeshStandardMaterial({
      color: 0xd97706, // raw wood spike tip color
      transparent: true,
      opacity: 0.5,
      roughness: 0.9,
    });
    
    const positions = [
      { x: 0, z: 0, rotX: 0, rotZ: 0 },
      { x: 0.4, z: 0.4, rotX: 0.2, rotZ: -0.2 },
      { x: -0.4, z: 0.4, rotX: 0.2, rotZ: 0.2 },
      { x: 0.4, z: -0.4, rotX: -0.2, rotZ: -0.2 },
      { x: -0.4, z: -0.4, rotX: -0.2, rotZ: 0.2 },
    ];

    positions.forEach((p) => {
      const spike = new THREE.Mesh(spikeGeom, spikeMat);
      spike.position.set(p.x, 0.4, p.z);
      spike.rotation.x = p.rotX;
      spike.rotation.z = p.rotZ;
      ghostGroup.add(spike);
    });
  } else if (type === 'spikes_iron') {
    // Metal Base plate
    const baseGeom = new THREE.BoxGeometry(1.4, 0.12, 1.4);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x475569, // steel/iron slate
      transparent: true,
      opacity: 0.5,
      metalness: 0.8,
    });
    const baseMesh = new THREE.Mesh(baseGeom, baseMat);
    baseMesh.position.y = 0.06;
    ghostGroup.add(baseMesh);

    // metallic spikes
    const spikeGeom = new THREE.ConeGeometry(0.08, 1.0, 5);
    const spikeMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8, // silver/metallic silver spikes
      transparent: true,
      opacity: 0.5,
      metalness: 0.9,
      roughness: 0.1,
    });

    const positions = [
      { x: 0.2, z: 0.2, rotX: 0.15, rotZ: -0.15 },
      { x: -0.2, z: 0.2, rotX: 0.15, rotZ: 0.15 },
      { x: 0.2, z: -0.2, rotX: -0.15, rotZ: -0.15 },
      { x: -0.2, z: -0.2, rotX: -0.15, rotZ: 0.15 },
      { x: 0.5, z: 0, rotX: 0, rotZ: -0.3 },
      { x: -0.5, z: 0, rotX: 0, rotZ: 0.3 },
    ];

    positions.forEach((p) => {
      const spike = new THREE.Mesh(spikeGeom, spikeMat);
      spike.position.set(p.x, 0.5, p.z);
      spike.rotation.x = p.rotX;
      spike.rotation.z = p.rotZ;
      ghostGroup.add(spike);
    });
  } else if (type === 'smelter_furnace') {
    // Cylinder tower body
    const bodyGeom = new THREE.CylinderGeometry(0.5, 0.6, 1.3, 8);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x334155, // cobblestone dark grey
      transparent: true,
      opacity: 0.5,
      roughness: 0.95,
    });
    const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
    bodyMesh.position.y = 0.65;
    ghostGroup.add(bodyMesh);

    // Chimney top pipe
    const pipeGeom = new THREE.CylinderGeometry(0.2, 0.2, 0.4, 6);
    const pipeMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      transparent: true,
      opacity: 0.5,
      roughness: 0.8,
    });
    const pipeMesh = new THREE.Mesh(pipeGeom, pipeMat);
    pipeMesh.position.y = 1.3 + 0.2;
    ghostGroup.add(pipeMesh);

    // Front opening door
    const doorGeom = new THREE.BoxGeometry(0.4, 0.4, 0.1);
    const doorMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0, // bright steel door or glowing fire inside
      emissive: 0xff3300,
      emissiveIntensity: 1.0,
      transparent: true,
      opacity: 0.5,
    });
    const doorMesh = new THREE.Mesh(doorGeom, doorMat);
    doorMesh.position.set(0, 0.35, 0.55);
    ghostGroup.add(doorMesh);
  } else if (type === 'magnet_buoy') {
    // Red/white float base
    const baseGeom = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 8);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626, // Crimson red float base
      transparent: true,
      opacity: 0.5,
      roughness: 0.5,
    });
    const baseMesh = new THREE.Mesh(baseGeom, baseMat);
    baseMesh.position.y = 0.2;
    ghostGroup.add(baseMesh);

    // Metal antenna
    const antGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.8, 4);
    const antMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      transparent: true,
      opacity: 0.5,
    });
    const antMesh = new THREE.Mesh(antGeom, antMat);
    antMesh.position.set(0, 0.6, 0);
    ghostGroup.add(antMesh);

    // Magnet horseshoe accessory representation
    const magGeom = new THREE.TorusGeometry(0.2, 0.06, 6, 12, Math.PI);
    const magMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Deep electric blue
      transparent: true,
      opacity: 0.5,
    });
    const magMesh = new THREE.Mesh(magGeom, magMat);
    magMesh.position.set(0, 0.2, 0.51);
    magMesh.rotation.y = Math.PI / 2;
    ghostGroup.add(magMesh);
  } else if (type === 'oxygen_line') {
    // Base structural bracket (cast iron slate)
    const baseGeom = new THREE.BoxGeometry(0.8, 0.15, 0.8);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      transparent: true,
      opacity: 0.5,
    });
    const baseMesh = new THREE.Mesh(baseGeom, baseMat);
    baseMesh.position.y = 0.075;
    ghostGroup.add(baseMesh);

    // Spool Cylinder wheel
    const wheelGeom = new THREE.CylinderGeometry(0.35, 0.35, 0.4, 8);
    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0xea580c, // orange plastic line wheel reel
      transparent: true,
      opacity: 0.5,
    });
    const wheelMesh = new THREE.Mesh(wheelGeom, wheelMat);
    wheelMesh.position.set(0, 0.4, 0);
    wheelMesh.rotation.x = Math.PI / 2;
    ghostGroup.add(wheelMesh);

    // Blue hose wrapped coils
    const coilGeom = new THREE.CylinderGeometry(0.32, 0.32, 0.3, 8);
    const coilMat = new THREE.MeshStandardMaterial({
      color: 0x2563eb, // High-visibility dive safety blue hose
      transparent: true,
      opacity: 0.5,
    });
    const coilMesh = new THREE.Mesh(coilGeom, coilMat);
    coilMesh.position.set(0, 0.4, 0);
    coilMesh.rotation.x = Math.PI / 2;
    ghostGroup.add(coilMesh);
  } else if (type === 'raft_sail') {
    const mastGeom = new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6);
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x5c2c16, roughness: 0.9, transparent: true, opacity: 0.5 });
    const mast = new THREE.Mesh(mastGeom, mastMat);
    mast.position.y = 1.1;
    ghostGroup.add(mast);

    const crossGeom = new THREE.CylinderGeometry(0.03, 0.03, 1.4, 5);
    const cross = new THREE.Mesh(crossGeom, mastMat);
    cross.position.set(0, 1.8, 0);
    cross.rotation.z = Math.PI / 2;
    ghostGroup.add(cross);

    const canvasGeom = new THREE.BoxGeometry(1.2, 1.4, 0.03);
    const canvasMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.8, transparent: true, opacity: 0.5 });
    const canvasMesh = new THREE.Mesh(canvasGeom, canvasMat);
    canvasMesh.position.set(0, 1.1, 0.02);
    ghostGroup.add(canvasMesh);
  } else if (type === 'anchor') {
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3, transparent: true, opacity: 0.5 });
    const shankGeom = new THREE.CylinderGeometry(0.04, 0.04, 1.0, 5);
    const shank = new THREE.Mesh(shankGeom, steelMat);
    shank.position.y = 0.5;
    ghostGroup.add(shank);

    const stockGeom = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 5);
    const stock = new THREE.Mesh(stockGeom, steelMat);
    stock.position.set(0, 0.8, 0);
    stock.rotation.z = Math.PI / 2;
    ghostGroup.add(stock);

    const crownGeom = new THREE.TorusGeometry(0.25, 0.04, 6, 12, Math.PI);
    const crown = new THREE.Mesh(crownGeom, steelMat);
    crown.position.set(0, 0.15, 0);
    crown.rotation.x = Math.PI;
    ghostGroup.add(crown);

    const tipGeom = new THREE.ConeGeometry(0.05, 0.15, 4);
    const tipL = new THREE.Mesh(tipGeom, steelMat);
    tipL.position.set(-0.25, 0.25, 0);
    tipL.rotation.z = 0.4;
    ghostGroup.add(tipL);

    const tipR = new THREE.Mesh(tipGeom, steelMat);
    tipR.position.set(0.25, 0.25, 0);
    tipR.rotation.z = -0.4;
    ghostGroup.add(tipR);
  } else if (type === 'steering_wheel') {
    const baseGeom = new THREE.BoxGeometry(0.3, 0.8, 0.3);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x5c2c16, roughness: 0.8, transparent: true, opacity: 0.5 });
    const pedestal = new THREE.Mesh(baseGeom, baseMat);
    pedestal.position.y = 0.4;
    ghostGroup.add(pedestal);

    const ringGeom = new THREE.TorusGeometry(0.35, 0.03, 6, 16);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x783e1e, roughness: 0.7, transparent: true, opacity: 0.5 });
    const wheel = new THREE.Mesh(ringGeom, ringMat);
    wheel.position.set(0, 0.8, 0.18);
    wheel.rotation.x = -0.2;
    ghostGroup.add(wheel);

    const capGeom = new THREE.CylinderGeometry(0.06, 0.06, 0.05, 6);
    const capMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.7, roughness: 0.2, transparent: true, opacity: 0.5 });
    const cap = new THREE.Mesh(capGeom, capMat);
    cap.position.set(0, 0.8, 0.18);
    cap.rotation.x = Math.PI / 2 - 0.2;
    ghostGroup.add(cap);

    const spokeGeom = new THREE.CylinderGeometry(0.015, 0.015, 0.7, 4);
    for (let i = 0; i < 4; i++) {
      const spoke = new THREE.Mesh(spokeGeom, ringMat);
      spoke.position.set(0, 0.8, 0.18);
      spoke.rotation.z = (i / 4) * Math.PI;
      spoke.rotation.x = -0.2;
      ghostGroup.add(spoke);
    }
  } else if (type === 'water_purifier') {
    const panGeom = new THREE.CylinderGeometry(0.4, 0.4, 0.15, 8);
    const panMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, transparent: true, opacity: 0.5 });
    const pan = new THREE.Mesh(panGeom, panMat);
    pan.position.y = 0.075;
    ghostGroup.add(pan);

    const domeGeom = new THREE.CylinderGeometry(0.32, 0.35, 0.45, 8);
    const domeMat = new THREE.MeshStandardMaterial({ color: 0x00f5ff, roughness: 0.1, transparent: true, opacity: 0.35 });
    const dome = new THREE.Mesh(domeGeom, domeMat);
    dome.position.y = 0.35;
    ghostGroup.add(dome);

    const pipeGeom = new THREE.TorusGeometry(0.2, 0.02, 4, 8);
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.2, transparent: true, opacity: 0.5 });
    const coil1 = new THREE.Mesh(pipeGeom, pipeMat);
    coil1.position.set(0, 0.2, 0);
    coil1.rotation.x = Math.PI / 2;
    ghostGroup.add(coil1);

    const cupGeom = new THREE.CylinderGeometry(0.08, 0.06, 0.18, 5);
    const cupMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, metalness: 0.2, transparent: true, opacity: 0.5 });
    const cup = new THREE.Mesh(cupGeom, cupMat);
    cup.position.set(0.28, 0.1, 0.28);
    ghostGroup.add(cup);
  } else if (type === 'advanced_smelter') {
    const baseGeom = new THREE.CylinderGeometry(0.55, 0.65, 0.9, 8);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9, transparent: true, opacity: 0.5 });
    const base = new THREE.Mesh(baseGeom, baseMat);
    base.position.y = 0.45;
    ghostGroup.add(base);

    const cryGeom = new THREE.ConeGeometry(0.08, 0.35, 4);
    const cryMat = new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 1.0, transparent: true, opacity: 0.5 });
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const crystal = new THREE.Mesh(cryGeom, cryMat);
      crystal.position.set(Math.sin(angle) * 0.45, 0.7, Math.cos(angle) * 0.45);
      crystal.rotation.x = Math.sin(angle) * 0.3;
      crystal.rotation.z = -Math.cos(angle) * 0.3;
      ghostGroup.add(crystal);
    }

    const chimneyGeom = new THREE.CylinderGeometry(0.18, 0.18, 0.6, 6);
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, transparent: true, opacity: 0.5 });
    const chimney = new THREE.Mesh(chimneyGeom, ironMat);
    chimney.position.set(0, 1.1, 0);
    ghostGroup.add(chimney);
  } else if (type === 'crop_plot') {
    const borderGeom = new THREE.BoxGeometry(1.4, 0.15, 1.4);
    const borderMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9, transparent: true, opacity: 0.5 });
    const border = new THREE.Mesh(borderGeom, borderMat);
    border.position.y = 0.075;
    ghostGroup.add(border);

    const soilGeom = new THREE.BoxGeometry(1.3, 0.13, 1.3);
    const soilMat = new THREE.MeshStandardMaterial({ color: 0x27170e, roughness: 0.95, transparent: true, opacity: 0.5 });
    const soil = new THREE.Mesh(soilGeom, soilMat);
    soil.position.y = 0.085;
    ghostGroup.add(soil);

    const leafGeom = new THREE.ConeGeometry(0.04, 0.25, 4);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.7, transparent: true, opacity: 0.5 });
    const sproutCoords = [
      { x: -0.3, z: -0.3 },
      { x: 0.3, z: -0.3 },
      { x: -0.3, z: 0.3 },
      { x: 0.3, z: 0.3 }
    ];
    sproutCoords.forEach((coord) => {
      const sprout = new THREE.Mesh(leafGeom, leafMat);
      sprout.position.set(coord.x, 0.2, coord.z);
      sprout.userData = { isCropSprout: true };
      sprout.visible = false;
      ghostGroup.add(sprout);
    });
  } else if (type === 'research_table') {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x783e1e, roughness: 0.8, transparent: true, opacity: 0.5 });
    const topGeom = new THREE.BoxGeometry(1.4, 0.06, 0.9);
    const top = new THREE.Mesh(topGeom, woodMat);
    top.position.y = 0.72;
    ghostGroup.add(top);

    const legGeom = new THREE.CylinderGeometry(0.03, 0.03, 0.7, 4);
    const legs = [
      { x: -0.6, z: -0.35 },
      { x: 0.6, z: -0.35 },
      { x: -0.6, z: 0.35 },
      { x: 0.6, z: 0.35 }
    ];
    legs.forEach(l => {
      const leg = new THREE.Mesh(legGeom, woodMat);
      leg.position.set(l.x, 0.35, l.z);
      ghostGroup.add(leg);
    });

    const scrollGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.35, 6);
    const scrollMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.9, transparent: true, opacity: 0.5 });
    const scroll = new THREE.Mesh(scrollGeom, scrollMat);
    scroll.position.set(0.1, 0.76, 0);
    scroll.rotation.y = 0.5;
    scroll.rotation.z = Math.PI / 2;
    ghostGroup.add(scroll);

    const cogGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.05, 8);
    const copperMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.7, transparent: true, opacity: 0.5 });
    const cog = new THREE.Mesh(cogGeom, copperMat);
    cog.position.set(-0.3, 0.76, 0.1);
    ghostGroup.add(cog);
  } else if (type === 'wooden_chair') {
    const chairMat = new THREE.MeshStandardMaterial({ color: 0x783e1e, roughness: 0.85, transparent: true, opacity: 0.5 });
    const seatGeom = new THREE.BoxGeometry(0.55, 0.05, 0.55);
    const seat = new THREE.Mesh(seatGeom, chairMat);
    seat.position.y = 0.42;
    ghostGroup.add(seat);

    const legGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.4, 4);
    const legs = [
      { x: -0.23, z: -0.23 },
      { x: 0.23, z: -0.23 },
      { x: -0.23, z: 0.23 },
      { x: 0.23, z: 0.23 }
    ];
    legs.forEach(l => {
      const leg = new THREE.Mesh(legGeom, chairMat);
      leg.position.set(l.x, 0.2, l.z);
      ghostGroup.add(leg);
    });

    const backGeom = new THREE.BoxGeometry(0.55, 0.5, 0.05);
    const back = new THREE.Mesh(backGeom, chairMat);
    back.position.set(0, 0.67, -0.23);
    ghostGroup.add(back);
  } else if (type === 'wooden_table') {
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x5c2c16, roughness: 0.8, transparent: true, opacity: 0.5 });
    const topGeom = new THREE.BoxGeometry(1.2, 0.06, 1.2);
    const top = new THREE.Mesh(topGeom, tableMat);
    top.position.y = 0.75;
    ghostGroup.add(top);

    const legGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.72, 4);
    const legs = [
      { x: -0.5, z: -0.5 },
      { x: 0.5, z: -0.5 },
      { x: -0.5, z: 0.5 },
      { x: 0.5, z: 0.5 }
    ];
    legs.forEach(l => {
      const leg = new THREE.Mesh(legGeom, tableMat);
      leg.position.set(l.x, 0.36, l.z);
      ghostGroup.add(leg);
    });
  } else if (type === 'standing_lantern') {
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2, transparent: true, opacity: 0.5 });
    const standGeom = new THREE.CylinderGeometry(0.02, 0.025, 1.4, 6);
    const stand = new THREE.Mesh(standGeom, metalMat);
    stand.position.y = 0.7;
    ghostGroup.add(stand);

    const baseGeom = new THREE.CylinderGeometry(0.2, 0.22, 0.06, 8);
    const base = new THREE.Mesh(baseGeom, metalMat);
    base.position.y = 0.03;
    ghostGroup.add(base);

    const glassGeom = new THREE.CylinderGeometry(0.12, 0.1, 0.24, 6);
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.1, transparent: true, opacity: 0.65 });
    const glass = new THREE.Mesh(glassGeom, glassMat);
    glass.position.y = 1.42;
    ghostGroup.add(glass);

    const lidGeom = new THREE.ConeGeometry(0.15, 0.08, 6);
    const lid = new THREE.Mesh(lidGeom, metalMat);
    lid.position.y = 1.54;
    ghostGroup.add(lid);
  } else if (type === 'crew_bed') {
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8, transparent: true, opacity: 0.5 });
    const sheetMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.65, transparent: true, opacity: 0.5 });
    const pillowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, transparent: true, opacity: 0.5 });

    const frameGeom = new THREE.BoxGeometry(1.25, 0.35, 2.05);
    const frame = new THREE.Mesh(frameGeom, frameMat);
    frame.position.y = 0.175;
    ghostGroup.add(frame);

    const boardGeom = new THREE.BoxGeometry(1.25, 0.75, 0.1);
    const board = new THREE.Mesh(boardGeom, frameMat);
    board.position.set(0, 0.375, -0.985);
    ghostGroup.add(board);

    const matGeom = new THREE.BoxGeometry(1.15, 0.22, 1.9);
    const mattress = new THREE.Mesh(matGeom, sheetMat);
    mattress.position.set(0, 0.36, 0.05);
    ghostGroup.add(mattress);

    const pilGeom = new THREE.BoxGeometry(0.48, 0.08, 0.32);
    const pillow1 = new THREE.Mesh(pilGeom, pillowMat);
    pillow1.position.set(-0.25, 0.48, -0.7);
    ghostGroup.add(pillow1);

    const pillow2 = new THREE.Mesh(pilGeom, pillowMat);
    pillow2.position.set(0.25, 0.48, -0.7);
    ghostGroup.add(pillow2);
  }
  return ghostGroup;
};

const characterShopItems = [
  { skinId: "skin_diver_01", name: "Solana Deep Diver Alpha", priceSOL: 0.5, totalMinted: 0, maxSupply: 100, rarity: "Mythic", image: "alpha_diver.png" },
  { skinId: "skin_shark_hunter", name: "Apex Shark Slayer", priceSOL: 1.2, totalMinted: 0, maxSupply: 50, rarity: "Legendary", image: "shark_slayer.png" }
];

let GLOBAL_ISLAND_LOCATIONS = [
  { x: 0, z: 75 },     // Island 1 (Your current starting destination)
  { x: 300, z: -250 }, // Island 2 (Far North-East)
  { x: -400, z: 150 }, // Island 3 (Far West)
  { x: 200, z: 500 }   // Island 4 (Far South-Deep)
];

let islandLocationsGenerated = false;

const initializeIslandLocations = () => {
  if (islandLocationsGenerated) return;
  islandLocationsGenerated = true;

  const isFirstReached = typeof window !== 'undefined' && localStorage.getItem('isFirstIslandReached') === 'true';
  if (!isFirstReached) {
    // 1500m directly ahead of raft default starting vector (0, 0, -1500)
    GLOBAL_ISLAND_LOCATIONS = [
      { x: 0, z: 0 },      // Island 1 (Onboarding tutorial island)
      { x: 300, z: 600 },  // Island 2
      { x: -450, z: 1200 }, // Island 3
      { x: 250, z: 1800 }  // Island 4
    ];
  } else {
    // Normal game session: all future islands spawn randomly around the map based on normal procedural math
    const intervals = [
      { minZ: -1100, maxZ: -800 },
      { minZ: -500, maxZ: -200 },
      { minZ: 100, maxZ: 400 },
      { minZ: 700, maxZ: 1000 }
    ];
    GLOBAL_ISLAND_LOCATIONS = intervals.map((interval) => {
      const x = (Math.random() - 0.5) * 800; // -400 to 400
      const z = interval.minZ + Math.random() * (interval.maxZ - interval.minZ);
      return { x: Math.round(x), z: Math.round(z) };
    });
  }
};

const getCardinalDirection = (deg: number) => {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.floor(((deg + 22.5) % 360) / 45);
  return directions[index];
};

export default function App() {
  // Initialize dynamic island locations once before anything else runs
  initializeIslandLocations();

  const [isFirstIslandReached, setIsFirstIslandReached] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('isFirstIslandReached') === 'true';
    }
    return false;
  });

  const isFirstIslandReachedRef = useRef(isFirstIslandReached);
  useEffect(() => {
    isFirstIslandReachedRef.current = isFirstIslandReached;
  }, [isFirstIslandReached]);

  const hasShownWedgeLogRef = useRef(false);

  // Game balances and resource tracking
  const [resources, setResources] = useState({
    seaGlass: 5,
    cobalt: 0,
    volcanic: 0,
    scrapMetal: 0,
    driftwood: 0,
    biomass: 0,
    treasure: 0,
    food: 0,
    stones: 0,
    kelpFiber: 0,
    rawFood: 0,
    cookedFood: 0,
    rope: 0,
    titaniumBracket: 0,
    skeletonKingCore: 0,
    money: 500,

    palmFronds: 0,
    scrapWood: 0,
    plasticSheets: 0,
    
    // NEW RAW MATERIALS & LOOT TIERS (Common starting baseline)
    ironScraps: 15,
    silicaSand: 10,
    copperWire: 8,
    rawTitanium: 0,
    volcanicCrystals: 0,
    lithiumBatteryPacks: 0,
    deepSeaUranium: 0,
    ancientRelicFragments: 0,
    corruptedAIChips: 0,
    blackBoxCore: 0,
    singularityShard: 0,
    glitchArtifact: 0,

    // NEW CRAFTED PROGRESSION GEARS (Start at 0)
    titaniumHarpoon: 0,
    magneticScanner: 0,
    kineticDrill: 0,
    thermalRegulators: 0,
    highCapacityOxygenRebreather: 0,
    glitchSubDriveMk1: 0,
    reinforcedHullPlating: 0,
    bioFilterSuit: 0,
    empPulseModule: 0,
  });

  const playerInventory = [
    // 1. Common Resources
    { id: "ironScraps", name: "Iron Scraps", rarity: "Common", tradeable: true, quantity: resources.ironScraps || 0 },
    { id: "silicaSand", name: "Silica Sand", rarity: "Common", tradeable: true, quantity: resources.silicaSand || 0 },
    { id: "copperWire", name: "Copper Wire", rarity: "Common", tradeable: true, quantity: resources.copperWire || 0 },
    { id: "palmFronds", name: "Palm Fronds", rarity: "Common", tradeable: true, quantity: resources.palmFronds || 0 },
    { id: "scrapWood", name: "Scrap Wood", rarity: "Common", tradeable: true, quantity: resources.scrapWood || 0 },
    { id: "plasticSheets", name: "Plastic Sheets", rarity: "Common", tradeable: true, quantity: resources.plasticSheets || 0 },
    
    // 2. Uncommon Resources
    { id: "rawTitanium", name: "Raw Titanium", rarity: "Uncommon", tradeable: true, quantity: resources.rawTitanium || 0 },
    { id: "volcanicCrystals", name: "Volcanic Crystals", rarity: "Uncommon", tradeable: true, quantity: resources.volcanicCrystals || 0 },
    { id: "lithiumBatteryPacks", name: "Lithium Battery Packs", rarity: "Uncommon", tradeable: true, quantity: resources.lithiumBatteryPacks || 0 },
    
    // 3. Rare Resources
    { id: "deepSeaUranium", name: "Deep-Sea Uranium", rarity: "Rare", tradeable: true, quantity: resources.deepSeaUranium || 0 },
    { id: "ancientRelicFragments", name: "Ancient Relic Fragments", rarity: "Rare", tradeable: true, quantity: resources.ancientRelicFragments || 0 },
    { id: "corruptedAIChips", name: "Corrupted AI Chips", rarity: "Rare", tradeable: true, quantity: resources.corruptedAIChips || 0 },
    
    // 4. Mythic & Glitch Resources
    { id: "blackBoxCore", name: "Black Box Core", rarity: "Mythic", tradeable: true, quantity: resources.blackBoxCore || 0 },
    { id: "singularityShard", name: "Singularity Shard", rarity: "Mythic", tradeable: true, quantity: resources.singularityShard || 0 },
    { id: "glitchArtifact", name: "Glitch Artifact", rarity: "Glitch", tradeable: true, quantity: resources.glitchArtifact || 0 },

    // 5. Crafted Progression Gear & Tools
    { id: "titaniumHarpoon", name: "Titanium Harpoon", rarity: "Rare", tradeable: true, quantity: resources.titaniumHarpoon || 0 },
    { id: "magneticScanner", name: "Magnetic Scanner", rarity: "Rare", tradeable: true, quantity: resources.magneticScanner || 0 },
    { id: "kineticDrill", name: "Kinetic Drill", rarity: "Rare", tradeable: true, quantity: resources.kineticDrill || 0 },
    { id: "thermalRegulators", name: "Thermal Regulators", rarity: "Rare", tradeable: true, quantity: resources.thermalRegulators || 0 },
    { id: "highCapacityOxygenRebreather", name: "High-Capacity Oxygen Rebreather", rarity: "Epic", tradeable: true, quantity: resources.highCapacityOxygenRebreather || 0 },
    { id: "glitchSubDriveMk1", name: "Glitch Sub-Drive Mk1", rarity: "Epic", tradeable: true, quantity: resources.glitchSubDriveMk1 || 0 },
    { id: "reinforcedHullPlating", name: "Reinforced Hull Plating", rarity: "Epic", tradeable: true, quantity: resources.reinforcedHullPlating || 0 },
    { id: "bioFilterSuit", name: "Bio-Filter Suit", rarity: "Epic", tradeable: true, quantity: resources.bioFilterSuit || 0 },
    { id: "empPulseModule", name: "EMP Pulse Module", rarity: "Legendary", tradeable: true, quantity: resources.empPulseModule || 0 },

    // 6. Legacy items
    { id: "item_0912", name: "Titanium Bracket", rarity: "Legendary", tradeable: true, quantity: resources.titaniumBracket || 0 },
    { id: "item_0913", name: "Skeleton King Core", rarity: "Mythic", tradeable: true, quantity: resources.skeletonKingCore || 0 },
    { id: "item_0101", name: "Driftwood", rarity: "Common", tradeable: true, quantity: resources.driftwood || 0 },
    { id: "item_0102", name: "Rare Rope", rarity: "Rare", tradeable: true, quantity: resources.rope || 0 },
    { id: "item_0103", name: "Stones", rarity: "Common", tradeable: true, quantity: resources.stones || 0 },
    { id: "item_0104", name: "Sea Glass", rarity: "Uncommon", tradeable: true, quantity: resources.seaGlass || 0 },
    { id: "item_0105", name: "Scrap Metal", rarity: "Common", tradeable: true, quantity: resources.scrapMetal || 0 },
    { id: "item_0106", name: "Biomass", rarity: "Common", tradeable: true, quantity: resources.biomass || 0 },
  ];

  const [upgrades, setUpgrades] = useState<UpgradeItem[]>([
    {
      id: 'speed',
      name: '🚀 Propulsion Fins',
      level: 1,
      maxLevel: 5,
      costSeaGlass: 8,
      costCobalt: 2,
      costVolcanic: 0,
      benefit: 1,
    },
    {
      id: 'oxygen',
      name: '🔋 Core Oxygen Tank',
      level: 1,
      maxLevel: 5,
      costSeaGlass: 10,
      costCobalt: 4,
      costVolcanic: 1,
      benefit: 1,
    },
  ]);

  // Player telemetry values shown on screen
  const [oxygen, setOxygen] = useState<number>(100);
  const [maxOxygen, setMaxOxygen] = useState<number>(100);
  const [hunger, setHunger] = useState<number>(100);
  const [health, setHealth] = useState<number>(100);
  const [foodEatFlash, setFoodEatFlash] = useState<boolean>(false);
   const [damageFlash, setDamageFlash] = useState<boolean>(false);
  const [restingFade, setRestingFade] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [interactionPrompt, setInteractionPrompt] = useState<string>("");
  const [depth, setDepth] = useState<number>(0);
  const [isUnderwater, setIsUnderwater] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [starvationDeathAlert, setStarvationDeathAlert] = useState<boolean>(false);
  const [showTabMenu, setShowTabMenu] = useState<boolean>(false);
  const [showHelpMenu, setShowHelpMenu] = useState<boolean>(false);
  const [showInventoryMenu, setShowInventoryMenu] = useState<boolean>(false);
  const [hasAxe, setHasAxe] = useState<boolean>(false);
  const [equippedItems, setEquippedItems] = useState({
    head: null as string | null,
    chest: null as string | null,
    weapon: null as string | null,
    legs: null as string | null,
    back: 'oxygenTank' as string | null,
  });
  const [craftedItems, setCraftedItems] = useState<{ [key: string]: boolean }>({
    stoneAxe: false,
    campfire: false,
    woodenChest: false,
    raftSail: false,
    makeshiftDriftSail: false,
    fishingRod: false,
    huntingBowSpear: false,
    item_spear: false,
    item_bow: false,
    scubaHelmet: false,
    divingSuit: false,
    propulsionFins: false,
    bed_straw: false,
    hammock_luxury: false,
    spikes_wood: false,
    spikes_iron: false,
    smelter_furnace: false,
    magnet_buoy: false,
    oxygen_line: false,
    armor_scrap: false,
    suit_shark: false,
    boots_weighted: false,
    anchor: false,
    steering_wheel: false,
    water_purifier: false,
    advanced_smelter: false,
    crop_plot: false,
    research_table: false,
    wooden_chair: false,
    wooden_table: false,
    standing_lantern: false,
    crew_bed: false,
  });
  const [activeCategory, setActiveCategory] = useState<'upgrades' | 'tools' | 'survival' | 'raft' | 'weapons' | 'map' | 'character_shop'>('upgrades');
  const [solBalance, setSolBalance] = useState<number>(2.5);
  const [characterShopSkins, setCharacterShopSkins] = useState([
    { skinId: "skin_diver_01", name: "Solana Deep Diver Alpha", priceSOL: 0.5, totalMinted: 18, maxSupply: 100, rarity: "Mythic", image: "alpha_diver.png" },
    { skinId: "skin_shark_hunter", name: "Apex Shark Slayer", priceSOL: 1.2, totalMinted: 7, maxSupply: 50, rarity: "Legendary", image: "shark_slayer.png" }
  ]);
  const [ownedSkins, setOwnedSkins] = useState<{ skinId: string, name: string, rarity: string, mintNumber: number, image: string }[]>([]);
  const [equippedSkinId, setEquippedSkinId] = useState<string>('default');
  const equippedSkinIdRef = useRef<string>('default');
  const [isPlacementMode, setIsPlacementMode] = useState<boolean>(false);
  const [totalTilesCount, setTotalTilesCount] = useState<number>(0);
  const [activeChestIndex, setActiveChestIndex] = useState<number | null>(null);
  const [placedChestsState, setPlacedChestsState] = useState<{
    id: number;
    x: number;
    z: number;
    inventory: { [key: string]: number };
  }[]>([]);
  const [chestUpdateCounter, setChestUpdateCounter] = useState(0);

  const [showMarketplace, setShowMarketplace] = useState<boolean>(false);
  const showMarketplaceRef = useRef(showMarketplace);
  useEffect(() => {
    showMarketplaceRef.current = showMarketplace;
  }, [showMarketplace]);

  const [marketFilter, setMarketFilter] = useState<'all' | 'weapons' | 'materials' | 'mythics'>('all');
  const [marketSearchText, setMarketSearchText] = useState<string>('');

  const [sellInputs, setSellInputs] = useState<{
    [itemName: string]: { quantity: number; price: number }
  }>({});

  const [globalMarketOrders, setGlobalMarketOrders] = useState<{
    orderId: string;
    seller: string;
    itemName: string;
    quantity: number;
    askingPrice: number;
    isSkin?: boolean;
    skinId?: string;
    mintNumber?: number;
    rarity?: string;
  }[]>([]);

  const [selectedItemToList, setSelectedItemToList] = useState<string | null>(null);
  const [listQuantity, setListQuantity] = useState<number>(1);
  const [listPrice, setListPrice] = useState<number>(10);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const raftGroupRef = useRef<THREE.Group | null>(null);
  const placedChestsRef = useRef<{
    id: number;
    x: number;
    z: number;
    mesh: THREE.Group;
    inventory: { [key: string]: number };
  }[]>([]);

  const placedBedsRef = useRef<{
    id: number;
    x: number;
    z: number;
    type: 'bed_straw' | 'hammock_luxury';
    mesh: THREE.Group;
  }[]>([]);

  const placedSmeltersRef = useRef<{
    id: number;
    x: number;
    z: number;
    mesh: THREE.Group;
  }[]>([]);

  const placedSpikesRef = useRef<{
    id: number;
    x: number;
    z: number;
    type: 'spikes_wood' | 'spikes_iron';
    mesh: THREE.Group;
  }[]>([]);

  const placedMagnetsRef = useRef<{
    id: number;
    x: number;
    z: number;
    mesh: THREE.Group;
  }[]>([]);

  const placedOxygenLinesRef = useRef<{
    id: number;
    x: number;
    z: number;
    mesh: THREE.Group;
  }[]>([]);

  const placedCustomStructuresRef = useRef<{
    id: number;
    x: number;
    z: number;
    type: 'raft_sail' | 'anchor' | 'steering_wheel' | 'water_purifier' | 'advanced_smelter' | 'crop_plot' | 'research_table' | 'wooden_chair' | 'wooden_table' | 'standing_lantern' | 'crew_bed';
    mesh: THREE.Group;
    state?: any;
  }[]>([]);

  const [logs, setLogs] = useState<string[]>([
    'System online. Press TAB to open the Tactical Upgrade menu!',
    'Drag mouse/screen OR use I/K (or PageUp/PageDown) to tilt camera.',
    'Use WASD / Arrow Keys to move. SPACE to swim up, L-SHIFT to swim down.',
    'Press U to consume foraged food and restore hunger!'
  ]);

  // Canvas & Scene references
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Keyboard references
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  // Synchronous refs for the game loop
  const resourcesRef = useRef(resources);
  const oxygenRef = useRef(oxygen);
  const maxOxygenRef = useRef(maxOxygen);
  const hungerRef = useRef(hunger);
  const healthRef = useRef(health);
  const isGameOverRef = useRef(isGameOver);
  const upgradesRef = useRef(upgrades);
  const hasAxeRef = useRef(hasAxe);
  const craftedItemsRef = useRef(craftedItems);
  const equippedItemsRef = useRef(equippedItems);
  const currentPromptRef = useRef("");
  const consumeFoodActionRef = useRef<() => void>(() => {});
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(audioSynth.getMuted());
  const activeSmokeEffectsRef = useRef<{
    smokeGroup: THREE.Group;
    particles: {
      mesh: THREE.Mesh;
      speedY: number;
      speedX: number;
      speedZ: number;
      life: number;
    }[];
    parentMesh: THREE.Group;
    createdAt: number;
  }[]>([]);

  const isPlacementModeRef = useRef(isPlacementMode);

  useEffect(() => { resourcesRef.current = resources; }, [resources]);
  useEffect(() => { oxygenRef.current = oxygen; }, [oxygen]);
  useEffect(() => { maxOxygenRef.current = maxOxygen; }, [maxOxygen]);
  useEffect(() => { hungerRef.current = hunger; }, [hunger]);
  useEffect(() => { healthRef.current = health; }, [health]);
  useEffect(() => { isGameOverRef.current = isGameOver; }, [isGameOver]);
  useEffect(() => { upgradesRef.current = upgrades; }, [upgrades]);
  useEffect(() => { hasAxeRef.current = hasAxe; }, [hasAxe]);
  useEffect(() => { craftedItemsRef.current = craftedItems; }, [craftedItems]);
  useEffect(() => { equippedItemsRef.current = equippedItems; }, [equippedItems]);
  useEffect(() => { isPlacementModeRef.current = isPlacementMode; }, [isPlacementMode]);

  // --- MOBILE DEVICE DETECTION & VIEWPORT OPTIMIZATION ---
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [viewportSize, setViewportSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  const joystickVector = useRef({ x: 0, y: 0 });
  const isDraggingJoystickRef = useRef(false);
  const joystickStartRef = useRef<{ x: number; y: number } | null>(null);
  const joystickKnobRef = useRef<HTMLDivElement | null>(null);
  const joystickRef = useRef<HTMLDivElement | null>(null);

  const btnARef = useRef<HTMLButtonElement | null>(null);
  const btnBRef = useRef<HTMLButtonElement | null>(null);
  const btnCRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = (
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        window.innerWidth <= 768
      );
      setIsMobile(mobile);
    };

    const handleResize = () => {
      checkMobile();
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    checkMobile();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Set up touch listeners for joystick and buttons to support multi-touch and preventDefault
  useEffect(() => {
    const joystick = joystickRef.current;
    if (!joystick) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      const touch = e.touches[0];
      const rect = joystick.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      joystickStartRef.current = { x: centerX, y: centerY };
      isDraggingJoystickRef.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDraggingJoystickRef.current || !joystickStartRef.current) return;
      if (e.cancelable) e.preventDefault();
      
      const touch = e.touches[0];
      const dx = touch.clientX - joystickStartRef.current.x;
      const dy = touch.clientY - joystickStartRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      const maxRadius = 45; // pixels
      let clampedX = dx;
      let clampedY = dy;
      
      if (distance > maxRadius) {
        clampedX = (dx / distance) * maxRadius;
        clampedY = (dy / distance) * maxRadius;
      }
      
      if (joystickKnobRef.current) {
        joystickKnobRef.current.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0)`;
      }
      
      // Normalize to -1.0 ... 1.0 range
      const normX = clampedX / maxRadius;
      const normY = -clampedY / maxRadius; // inverted Y (up is positive)
      
      joystickVector.current = { x: normX, y: normY };
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      isDraggingJoystickRef.current = false;
      joystickStartRef.current = null;
      if (joystickKnobRef.current) {
        joystickKnobRef.current.style.transform = `translate3d(0, 0, 0)`;
      }
      joystickVector.current = { x: 0, y: 0 };
    };

    joystick.addEventListener('touchstart', onTouchStart, { passive: false });
    joystick.addEventListener('touchmove', onTouchMove, { passive: false });
    joystick.addEventListener('touchend', onTouchEnd, { passive: false });
    joystick.addEventListener('touchcancel', onTouchEnd, { passive: false });

    return () => {
      joystick.removeEventListener('touchstart', onTouchStart);
      joystick.removeEventListener('touchmove', onTouchMove);
      joystick.removeEventListener('touchend', onTouchEnd);
      joystick.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [isMobile]);

  useEffect(() => {
    const btnA = btnARef.current;
    const btnB = btnBRef.current;
    const btnC = btnCRef.current;

    const preventDefaultTouch = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
    };

    const simulateLeftClick = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const clientX = rect.left + rect.width / 2;
      const clientY = rect.top + rect.height / 2;
      
      const downEvent = new PointerEvent('pointerdown', {
        clientX,
        clientY,
        button: 0,
        pointerId: 1,
        bubbles: true,
        cancelable: true,
      });
      canvas.dispatchEvent(downEvent);
      
      setTimeout(() => {
        const upEvent = new PointerEvent('pointerup', {
          clientX,
          clientY,
          button: 0,
          pointerId: 1,
          bubbles: true,
          cancelable: true,
        });
        canvas.dispatchEvent(upEvent);
      }, 50);
    };

    if (btnA) {
      btnA.addEventListener('touchstart', (e) => {
        if (e.cancelable) e.preventDefault();
        simulateLeftClick();
      }, { passive: false });
      btnA.addEventListener('touchmove', preventDefaultTouch, { passive: false });
    }

    if (btnB) {
      btnB.addEventListener('touchstart', (e) => {
        if (e.cancelable) e.preventDefault();
        keysPressed.current['e'] = true;
      }, { passive: false });
      btnB.addEventListener('touchmove', preventDefaultTouch, { passive: false });
    }

    if (btnC) {
      btnC.addEventListener('touchstart', (e) => {
        if (e.cancelable) e.preventDefault();
        setShowInventoryMenu((prev) => !prev);
        audioSynth.playPing();
      }, { passive: false });
      btnC.addEventListener('touchmove', preventDefaultTouch, { passive: false });
    }
  }, [isMobile]);

  // Simulated Marketplace buyers purchasing your active listings
  useEffect(() => {
    const interval = setInterval(() => {
      setGlobalMarketOrders(prev => {
        const yourListings = prev.filter(o => o.seller === "You");
        if (yourListings.length > 0) {
          // Select a random listing of yours to be bought
          const target = yourListings[Math.floor(Math.random() * yourListings.length)];
          // Deduct it from listings, add funds to resources
          setResources(r => ({
            ...r,
            money: (r.money || 0) + target.askingPrice
          }));
          displayNotification(`💰 MARKET SALE: A traveler purchased your ${target.quantity}x ${target.itemName} for ${target.askingPrice} Coins!`);
          addLog(`🌐 MARKETPLACE TRADE: Traveler bought your listing of ${target.quantity}x ${target.itemName} for ${target.askingPrice} Coins.`);
          audioSynth.playPickup();
          return prev.filter(o => o.orderId !== target.orderId);
        }
        return prev;
      });
    }, 20000); // Check every 20 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    isSailCrafted = !!craftedItems.raftSail;
  }, [craftedItems.raftSail]);

  useEffect(() => {
    setHasAxe(equippedItems.weapon === 'stoneAxe');
  }, [equippedItems.weapon]);

  useEffect(() => {
    let baseMaxO2 = 100;
    // Upgrade oxygen
    const o2Level = upgrades.find((u) => u.id === 'oxygen')?.level || 1;
    baseMaxO2 += (o2Level - 1) * 30; // standard upgrade bonus

    // Equipment bonus
    if (equippedItems.head === 'scubaHelmet') {
      baseMaxO2 += 40; // Scuba helmet adds extra tank/oxygen capability!
    } else if (equippedItems.head === 'highCapacityOxygenRebreather') {
      baseMaxO2 += 80; // High-Capacity Rebreather adds double the tank size!
    }

    setMaxOxygen(baseMaxO2);
  }, [equippedItems.head, upgrades]);

  const addLog = (msg: string) => {
    setLogs((prev) => [msg, ...prev.slice(0, 8)]);
  };

  const displayNotification = (msg: string) => {
    setNotification(msg);
    addLog(msg);
    setTimeout(() => {
      setNotification((curr) => (curr === msg ? null : curr));
    }, 4500);
  };

  const onOnboardingResourceInteracted = () => {
    if (!isFirstIslandReachedRef.current) {
      setIsFirstIslandReached(true);
      isFirstIslandReachedRef.current = true;
      localStorage.setItem('isFirstIslandReached', 'true');
      displayNotification("🧭 TUTORIAL COMPLETED: You gathered resources! Assist disabled. Future islands will spawn randomly.");
    }
  };

  const consumeFoodAction = () => {
    const currentRes = resourcesRef.current;
    const currentHunger = hungerRef.current;

    if (currentHunger >= 100) {
      addLog("😋 ALREADY FULL: Your hunger is fully satisfied!");
      audioSynth.playPing();
      return;
    }

    if ((currentRes.cookedFood || 0) >= 1) {
      setResources((prev) => ({
        ...prev,
        cookedFood: Math.max(0, (prev.cookedFood || 0) - 1),
      }));
      setHunger((prev) => Math.min(100, prev + 30));
      addLog("🍗 CONSUMED COOKED FOOD: Safe & delicious! Restored 30% hunger/energy!");
      audioSynth.playPickup();
      setFoodEatFlash(true);
      setTimeout(() => {
        setFoodEatFlash(false);
      }, 400);
    } else if ((currentRes.food || 0) >= 1) {
      setResources((prev) => ({
        ...prev,
        food: Math.max(0, (prev.food || 0) - 1),
      }));
      setHunger((prev) => Math.min(100, prev + 25));
      addLog("🍎 CONSUMED FORAGED FOOD: Restored 25% hunger/energy!");
      audioSynth.playPickup();
      setFoodEatFlash(true);
      setTimeout(() => {
        setFoodEatFlash(false);
      }, 400);
    } else if ((currentRes.rawFood || 0) >= 1) {
      setResources((prev) => ({
        ...prev,
        rawFood: Math.max(0, (prev.rawFood || 0) - 1),
      }));
      setHunger((prev) => Math.min(100, prev + 15));
      setHealth((prev) => Math.max(0, prev - 5));
      addLog("🥩 EATEN RAW FOOD: Restored 15% hunger, but causes toxicity sickness (-5 HP)!");
      audioSynth.playError();
      setFoodEatFlash(true);
      setDamageFlash(true);
      setTimeout(() => {
        setFoodEatFlash(false);
        setDamageFlash(false);
      }, 400);
    } else {
      addLog("⚠️ NO FOOD TO EAT: Explore surface islands to forage, or use a fishing rod to catch fish!");
      audioSynth.playPing();
    }
  };

  useEffect(() => {
    consumeFoodActionRef.current = consumeFoodAction;
  }, [resources, hunger]);

  // --- CONTROLS INSTRUCTIONS KEYBOARD BINDINGS ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') {
        return;
      }

      const key = e.key.toLowerCase();
      
      if (key === 'm') {
        e.preventDefault();
        setShowMarketplace((prev) => !prev);
        audioSynth.playPing();
        return;
      }

      if (showMarketplaceRef.current) {
        if (key === 'escape') {
          e.preventDefault();
          setShowMarketplace(false);
          audioSynth.playPing();
        }
        return;
      }
      
      // Intercept menu-toggle keys before registering them as active movement keys
      if (key === 'i') {
        e.preventDefault();
        setShowInventoryMenu((prev) => !prev);
        audioSynth.playPing();
        return;
      }

      if (key === 'tab') {
        e.preventDefault();
        setShowTabMenu((prev) => !prev);
        audioSynth.playPing();
        return;
      }

      if (key === 'h') {
        e.preventDefault();
        setShowHelpMenu((prev) => !prev);
        audioSynth.playPing();
        return;
      }

      if (key === 'b') {
        e.preventDefault();
        
        if (activePlacementProp) {
          // Cancel active campfire/chest placement!
          if (ghostPropMesh && sceneRef.current) {
            sceneRef.current.remove(ghostPropMesh);
          }
          activePlacementProp = null;
          ghostPropMesh = null;
          addLog("🔨 CANCELED PROP PLACEMENT.");
          audioSynth.playPing();
          return;
        }

        setIsPlacementMode((prev) => {
          const next = !prev;
          if (next) {
            setShowTabMenu(false); // close crafting tab menu if open
            addLog("🔨 ENTERED PLACEMENT MODE: Look around the edge of the raft. Green = valid. Red = insufficient wood. Press Left Click or [E] to place, [B] to cancel.");
          } else {
            addLog("🔨 EXITED PLACEMENT MODE.");
          }
          audioSynth.playPing();
          return next;
        });
        return;
      }

      if (key === 'r') {
        if (activePlacementProp && ghostPropMesh) {
          e.preventDefault();
          ghostPropMesh.rotation.y += Math.PI / 4;
          addLog("🔄 ROTATED PROP: Rotated building preview by 45 degrees.");
          audioSynth.playPing();
          return;
        }
      }

      keysPressed.current[key] = true;
      if (e.shiftKey || e.key === 'Shift') {
        keysPressed.current['shift'] = true;
      }
      
      // Prevent browser default actions for keys we use
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'pageup', 'pagedown'].includes(key)) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysPressed.current[key] = false;
      if (e.key === 'Shift') {
        keysPressed.current['shift'] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // --- UPGRADE LOGIC ---
  const purchaseUpgrade = (id: string) => {
    const up = upgrades.find((u) => u.id === id);
    if (!up) return;

    if (up.level >= up.maxLevel) {
      addLog(`⚠️ UPGRADE MAXED: ${up.name} is already at peak level.`);
      return;
    }

    const currentRes = resourcesRef.current;
    if (
      currentRes.seaGlass < up.costSeaGlass ||
      currentRes.cobalt < up.costCobalt ||
      currentRes.volcanic < up.costVolcanic
    ) {
      addLog('⚠️ INSUFFICIENT MATERIALS: Continue diving to gather resources!');
      return;
    }

    // Deduct cost
    setResources((prev) => ({
      ...prev,
      seaGlass: (prev.seaGlass || 0) - up.costSeaGlass,
      cobalt: (prev.cobalt || 0) - up.costCobalt,
      volcanic: (prev.volcanic || 0) - up.costVolcanic,
    }));

    // Update level
    setUpgrades((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nextLevel = item.level + 1;
          
          // Apply upgrade side effects
          if (id === 'oxygen') {
            const newMax = 100 + (nextLevel - 1) * 40;
            setMaxOxygen(newMax);
            setOxygen(newMax);
          }

          addLog(`🔧 SYSTEM UPGRADED: ${item.name} boosted to Level ${nextLevel}!`);
          audioSynth.playPing();

          return {
            ...item,
            level: nextLevel,
            costSeaGlass: Math.floor(item.costSeaGlass * 1.8),
            costCobalt: Math.floor(item.costCobalt * 1.8) || (nextLevel >= 2 ? 3 : 0),
            costVolcanic: Math.floor(item.costVolcanic * 2.0) || (nextLevel >= 3 ? 1 : 0),
          };
        }
        return item;
      })
    );
  };

  const craftBlueprint = (blueprintId: string) => {
    // Check requirements and deduct resources, then update crafted state!
    const currentRes = resourcesRef.current;
    if (blueprintId === 'stoneAxe') {
      if (currentRes.scrapMetal >= 3 && currentRes.driftwood >= 2) {
        setResources(prev => ({
          ...prev,
          scrapMetal: Math.max(0, (prev.scrapMetal || 0) - 3),
          driftwood: Math.max(0, (prev.driftwood || 0) - 2),
        }));
        setCraftedItems(prev => ({ ...prev, stoneAxe: true }));
        setHasAxe(true);
        addLog("🛠️ CRAFTED STONE AXE: You can now chop island trees with [E]!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Stone Axe requires 3x Scrap Metal and 2x Driftwood!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'campfire') {
      if (currentRes.driftwood >= 5 && currentRes.stones >= 5) {
        setResources(prev => ({
          ...prev,
          driftwood: Math.max(0, (prev.driftwood || 0) - 5),
          stones: Math.max(0, (prev.stones || 0) - 5),
        }));
        setCraftedItems(prev => ({ ...prev, campfire: true }));
        setShowTabMenu(false);
        
        // Setup campfire placement
        activePlacementProp = 'campfire';
        if (ghostPropMesh && sceneRef.current) {
          sceneRef.current.remove(ghostPropMesh);
        }
        ghostPropMesh = createGhostPropMesh('campfire');
        if (sceneRef.current) {
          sceneRef.current.add(ghostPropMesh);
        }
        
        addLog("🔥 CAMPFIRE CRAFTED: Enter placement mode. Look around the raft deck. Left Click to Place!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Campfire requires 5x Driftwood and 5x Stones!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'woodenChest') {
      if (currentRes.driftwood >= 8) {
        setResources(prev => ({
          ...prev,
          driftwood: Math.max(0, (prev.driftwood || 0) - 8),
        }));
        setCraftedItems(prev => ({ ...prev, woodenChest: true }));
        setShowTabMenu(false);

        // Setup chest placement
        activePlacementProp = 'chest';
        if (ghostPropMesh && sceneRef.current) {
          sceneRef.current.remove(ghostPropMesh);
        }
        ghostPropMesh = createGhostPropMesh('chest');
        if (sceneRef.current) {
          sceneRef.current.add(ghostPropMesh);
        }

        addLog("📦 WOODEN CHEST CRAFTED: Enter placement mode. Look around the raft deck. Left Click to Place!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Wooden Chest requires 8x Driftwood!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'raftSail') {
      if ((currentRes.driftwood || 0) >= 10 && (currentRes.biomass || 0) >= 5 && (currentRes.rope || 0) >= 3) {
        setResources(prev => ({
          ...prev,
          driftwood: Math.max(0, (prev.driftwood || 0) - 10),
          biomass: Math.max(0, (prev.biomass || 0) - 5),
          rope: Math.max(0, (prev.rope || 0) - 3),
        }));
        setCraftedItems(prev => ({ ...prev, raftSail: true }));
        setShowTabMenu(false);
        activePlacementProp = 'raft_sail';
        if (ghostPropMesh && sceneRef.current) sceneRef.current.remove(ghostPropMesh);
        ghostPropMesh = createGhostPropMesh('raft_sail');
        if (sceneRef.current) sceneRef.current.add(ghostPropMesh);
        addLog("⛵ CRAFTED RAFT SAIL: Enter placement mode. Look around the raft deck. Left Click to Place!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Raft Sail requires 10x Driftwood, 5x Biomass, and 3x Rare Rope!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'anchor') {
      if ((currentRes.ironScraps || 0) >= 10 && (currentRes.rope || 0) >= 4) {
        setResources(prev => ({
          ...prev,
          ironScraps: Math.max(0, (prev.ironScraps || 0) - 10),
          rope: Math.max(0, (prev.rope || 0) - 4),
        }));
        setCraftedItems(prev => ({ ...prev, anchor: true }));
        setShowTabMenu(false);
        activePlacementProp = 'anchor';
        if (ghostPropMesh && sceneRef.current) sceneRef.current.remove(ghostPropMesh);
        ghostPropMesh = createGhostPropMesh('anchor');
        if (sceneRef.current) sceneRef.current.add(ghostPropMesh);
        addLog("⚓ CRAFTED HEAVY ANCHOR: Enter placement mode. Look around the raft deck. Left Click to Place!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Heavy Anchor requires 10x Iron Scraps and 4x Rare Rope!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'steering_wheel') {
      if ((currentRes.driftwood || 0) >= 15 && (currentRes.copperWire || 0) >= 6) {
        setResources(prev => ({
          ...prev,
          driftwood: Math.max(0, (prev.driftwood || 0) - 15),
          copperWire: Math.max(0, (prev.copperWire || 0) - 6),
        }));
        setCraftedItems(prev => ({ ...prev, steering_wheel: true }));
        setShowTabMenu(false);
        activePlacementProp = 'steering_wheel';
        if (ghostPropMesh && sceneRef.current) sceneRef.current.remove(ghostPropMesh);
        ghostPropMesh = createGhostPropMesh('steering_wheel');
        if (sceneRef.current) sceneRef.current.add(ghostPropMesh);
        addLog("☸️ CRAFTED STEERING WHEEL: Enter placement mode. Look around the raft deck. Left Click to Place!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Steering Wheel requires 15x Driftwood and 6x Copper Wire!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'water_purifier') {
      if ((currentRes.ironScraps || 0) >= 12 && (currentRes.copperWire || 0) >= 5 && (currentRes.seaGlass || 0) >= 4) {
        setResources(prev => ({
          ...prev,
          ironScraps: Math.max(0, (prev.ironScraps || 0) - 12),
          copperWire: Math.max(0, (prev.copperWire || 0) - 5),
          seaGlass: Math.max(0, (prev.seaGlass || 0) - 4),
        }));
        setCraftedItems(prev => ({ ...prev, water_purifier: true }));
        setShowTabMenu(false);
        activePlacementProp = 'water_purifier';
        if (ghostPropMesh && sceneRef.current) sceneRef.current.remove(ghostPropMesh);
        ghostPropMesh = createGhostPropMesh('water_purifier');
        if (sceneRef.current) sceneRef.current.add(ghostPropMesh);
        addLog("💧 CRAFTED WATER PURIFIER: Enter placement mode. Look around the raft deck. Left Click to Place!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Water Purifier requires 12x Iron Scraps, 5x Copper Wire, and 4x Sea Glass!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'advanced_smelter') {
      if ((currentRes.volcanicCrystals || 0) >= 6 && (currentRes.ironScraps || 0) >= 12) {
        setResources(prev => ({
          ...prev,
          volcanicCrystals: Math.max(0, (prev.volcanicCrystals || 0) - 6),
          ironScraps: Math.max(0, (prev.ironScraps || 0) - 12),
        }));
        setCraftedItems(prev => ({ ...prev, advanced_smelter: true }));
        setShowTabMenu(false);
        activePlacementProp = 'advanced_smelter';
        if (ghostPropMesh && sceneRef.current) sceneRef.current.remove(ghostPropMesh);
        ghostPropMesh = createGhostPropMesh('advanced_smelter');
        if (sceneRef.current) sceneRef.current.add(ghostPropMesh);
        addLog("🔥 CRAFTED ADVANCED SMELTER: Enter placement mode. Look around the raft deck. Left Click to Place!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Advanced Smelter requires 6x Volcanic Crystals and 12x Iron Scraps!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'crop_plot') {
      if ((currentRes.driftwood || 0) >= 10 && (currentRes.biomass || 0) >= 5) {
        setResources(prev => ({
          ...prev,
          driftwood: Math.max(0, (prev.driftwood || 0) - 10),
          biomass: Math.max(0, (prev.biomass || 0) - 5),
        }));
        setCraftedItems(prev => ({ ...prev, crop_plot: true }));
        setShowTabMenu(false);
        activePlacementProp = 'crop_plot';
        if (ghostPropMesh && sceneRef.current) sceneRef.current.remove(ghostPropMesh);
        ghostPropMesh = createGhostPropMesh('crop_plot');
        if (sceneRef.current) sceneRef.current.add(ghostPropMesh);
        addLog("🌱 CRAFTED CROP PLOT: Enter placement mode. Look around the raft deck. Left Click to Place!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Crop Plot requires 10x Driftwood and 5x Biomass!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'research_table') {
      if ((currentRes.driftwood || 0) >= 15 && (currentRes.copperWire || 0) >= 8) {
        setResources(prev => ({
          ...prev,
          driftwood: Math.max(0, (prev.driftwood || 0) - 15),
          copperWire: Math.max(0, (prev.copperWire || 0) - 8),
        }));
        setCraftedItems(prev => ({ ...prev, research_table: true }));
        setShowTabMenu(false);
        activePlacementProp = 'research_table';
        if (ghostPropMesh && sceneRef.current) sceneRef.current.remove(ghostPropMesh);
        ghostPropMesh = createGhostPropMesh('research_table');
        if (sceneRef.current) sceneRef.current.add(ghostPropMesh);
        addLog("🔬 CRAFTED RESEARCH TABLE: Enter placement mode. Look around the raft deck. Left Click to Place!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Research Table requires 15x Driftwood and 8x Copper Wire!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'wooden_chair') {
      if ((currentRes.driftwood || 0) >= 8) {
        setResources(prev => ({
          ...prev,
          driftwood: Math.max(0, (prev.driftwood || 0) - 8),
        }));
        setCraftedItems(prev => ({ ...prev, wooden_chair: true }));
        setShowTabMenu(false);
        activePlacementProp = 'wooden_chair';
        if (ghostPropMesh && sceneRef.current) sceneRef.current.remove(ghostPropMesh);
        ghostPropMesh = createGhostPropMesh('wooden_chair');
        if (sceneRef.current) sceneRef.current.add(ghostPropMesh);
        addLog("🪑 CRAFTED WOODEN CHAIR: Enter placement mode. Look around the raft deck. Left Click to Place!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Wooden Chair requires 8x Driftwood!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'wooden_table') {
      if ((currentRes.driftwood || 0) >= 12) {
        setResources(prev => ({
          ...prev,
          driftwood: Math.max(0, (prev.driftwood || 0) - 12),
        }));
        setCraftedItems(prev => ({ ...prev, wooden_table: true }));
        setShowTabMenu(false);
        activePlacementProp = 'wooden_table';
        if (ghostPropMesh && sceneRef.current) sceneRef.current.remove(ghostPropMesh);
        ghostPropMesh = createGhostPropMesh('wooden_table');
        if (sceneRef.current) sceneRef.current.add(ghostPropMesh);
        addLog("🪵 CRAFTED WOODEN TABLE: Enter placement mode. Look around the raft deck. Left Click to Place!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Wooden Table requires 12x Driftwood!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'standing_lantern') {
      if ((currentRes.copperWire || 0) >= 4 && (currentRes.biomass || 0) >= 2) {
        setResources(prev => ({
          ...prev,
          copperWire: Math.max(0, (prev.copperWire || 0) - 4),
          biomass: Math.max(0, (prev.biomass || 0) - 2),
        }));
        setCraftedItems(prev => ({ ...prev, standing_lantern: true }));
        setShowTabMenu(false);
        activePlacementProp = 'standing_lantern';
        if (ghostPropMesh && sceneRef.current) sceneRef.current.remove(ghostPropMesh);
        ghostPropMesh = createGhostPropMesh('standing_lantern');
        if (sceneRef.current) sceneRef.current.add(ghostPropMesh);
        addLog("🏮 CRAFTED STANDING LANTERN: Enter placement mode. Look around the raft deck. Left Click to Place!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Standing Lantern requires 4x Copper Wire and 2x Biomass!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'crew_bed') {
      if ((currentRes.driftwood || 0) >= 20 && (currentRes.kelpFiber || 0) >= 10 && (currentRes.rope || 0) >= 6 && (currentRes.biomass || 0) >= 4) {
        setResources(prev => ({
          ...prev,
          driftwood: Math.max(0, (prev.driftwood || 0) - 20),
          kelpFiber: Math.max(0, (prev.kelpFiber || 0) - 10),
          rope: Math.max(0, (prev.rope || 0) - 6),
          biomass: Math.max(0, (prev.biomass || 0) - 4),
        }));
        setCraftedItems(prev => ({ ...prev, crew_bed: true }));
        setShowTabMenu(false);
        activePlacementProp = 'crew_bed';
        if (ghostPropMesh && sceneRef.current) sceneRef.current.remove(ghostPropMesh);
        ghostPropMesh = createGhostPropMesh('crew_bed');
        if (sceneRef.current) sceneRef.current.add(ghostPropMesh);
        addLog("🛌 CRAFTED CREW QUARTER BED: Enter placement mode. Look around the raft deck. Left Click to Place!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Crew Quarter Bed requires 20x Driftwood, 10x Kelp Fiber, 6x Rare Rope, and 4x Biomass!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'fishingRod') {
      if (currentRes.driftwood >= 4 && currentRes.biomass >= 2) {
        setResources(prev => ({
          ...prev,
          driftwood: Math.max(0, (prev.driftwood || 0) - 4),
          biomass: Math.max(0, (prev.biomass || 0) - 2),
        }));
        setCraftedItems(prev => ({ ...prev, fishingRod: true }));
        addLog("🎣 CRAFTED FISHING ROD: Ready for subsea and deck fishing!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Fishing Rod requires 4x Driftwood and 2x Biomass!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'makeshiftDriftSail') {
      if ((currentRes.palmFronds || 0) >= 30 && (currentRes.scrapWood || 0) >= 15 && (currentRes.plasticSheets || 0) >= 10) {
        setResources(prev => ({
          ...prev,
          palmFronds: Math.max(0, (prev.palmFronds || 0) - 30),
          scrapWood: Math.max(0, (prev.scrapWood || 0) - 15),
          plasticSheets: Math.max(0, (prev.plasticSheets || 0) - 10),
        }));
        setCraftedItems(prev => ({ ...prev, makeshiftDriftSail: true }));
        addLog("⛵ CRAFTED MAKESHIFT DRIFT-SAIL: Crude sails hoisted! Allows minimal direction adjustments to fight currents.");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Makeshift Drift-Sail requires 30x Palm Fronds, 15x Scrap Wood, and 10x Plastic Sheets!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'item_spear') {
      if ((currentRes.scrapWood || 0) >= 5 && (currentRes.ironScraps || 0) >= 2) {
        setResources(prev => ({
          ...prev,
          scrapWood: Math.max(0, (prev.scrapWood || 0) - 5),
          ironScraps: Math.max(0, (prev.ironScraps || 0) - 2),
        }));
        setCraftedItems(prev => ({ ...prev, item_spear: true }));
        addLog("🔱 CRAFTED SHARPENED SCRAP SPEAR: Crafted a sturdy wooden pole tipped with a jagged scrap metal blade!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Sharpened Scrap Spear requires 5x Scrap Wood and 2x Iron Scraps!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'item_bow') {
      if ((currentRes.driftwood || 0) >= 6) {
        setResources(prev => ({
          ...prev,
          driftwood: Math.max(0, (prev.driftwood || 0) - 6),
        }));
        setCraftedItems(prev => ({ ...prev, item_bow: true }));
        addLog("🏹 CRAFTED BOW & ARROW: Created a curved low-poly arc bow and arrows!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Bow & Arrow requires 6x Driftwood!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'huntingBowSpear') {
      if (currentRes.driftwood >= 6 && currentRes.scrapMetal >= 3 && currentRes.kelpFiber >= 4) {
        setResources(prev => ({
          ...prev,
          driftwood: Math.max(0, (prev.driftwood || 0) - 6),
          scrapMetal: Math.max(0, (prev.scrapMetal || 0) - 3),
          kelpFiber: Math.max(0, (prev.kelpFiber || 0) - 4),
        }));
        setCraftedItems(prev => ({ ...prev, huntingBowSpear: true, item_spear: true, item_bow: true }));
        addLog("🏹 CRAFTED HUNTING BOW & SPEAR: Prepared to defend against shark threats!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Hunting Bow & Spear requires 6x Driftwood, 3x Scrap Metal, and 4x Kelp Fiber!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'scubaHelmet') {
      if (currentRes.seaGlass >= 6 && currentRes.cobalt >= 4 && currentRes.scrapMetal >= 3) {
        setResources(prev => ({
          ...prev,
          seaGlass: Math.max(0, (prev.seaGlass || 0) - 6),
          cobalt: Math.max(0, (prev.cobalt || 0) - 4),
          scrapMetal: Math.max(0, (prev.scrapMetal || 0) - 3),
        }));
        setCraftedItems(prev => ({ ...prev, scubaHelmet: true }));
        addLog("🤿 CRAFTED BRASS SCUBA HELMET: Put it on in the Character screen (I) for extra Armor & Oxygen!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Scuba Helmet requires 6x Sea Glass, 4x Cobalt, and 3x Scrap Metal!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'divingSuit') {
      if (currentRes.cobalt >= 8 && currentRes.kelpFiber >= 5 && currentRes.scrapMetal >= 4) {
        setResources(prev => ({
          ...prev,
          cobalt: Math.max(0, (prev.cobalt || 0) - 8),
          kelpFiber: Math.max(0, (prev.kelpFiber || 0) - 5),
          scrapMetal: Math.max(0, (prev.scrapMetal || 0) - 4),
        }));
        setCraftedItems(prev => ({ ...prev, divingSuit: true }));
        addLog("🛡️ CRAFTED DIVING SUIT: Put it on in the Character screen (I) for exceptional Armor protection!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Diving Suit requires 8x Cobalt, 5x Kelp Fiber, and 4x Scrap Metal!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'propulsionFins') {
      if (currentRes.cobalt >= 4 && currentRes.kelpFiber >= 4 && currentRes.seaGlass >= 3) {
        setResources(prev => ({
          ...prev,
          cobalt: Math.max(0, (prev.cobalt || 0) - 4),
          kelpFiber: Math.max(0, (prev.kelpFiber || 0) - 4),
          seaGlass: Math.max(0, (prev.seaGlass || 0) - 3),
        }));
        setCraftedItems(prev => ({ ...prev, propulsionFins: true }));
        addLog("🚀 CRAFTED PROPULSION FINS: Put them on in the Character screen (I) for extra swimming speed!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Propulsion Fins require 4x Cobalt, 4x Kelp Fiber, and 3x Sea Glass!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'bed_straw') {
      if ((currentRes.driftwood || 0) >= 15 && (currentRes.rope || 0) >= 5 && (currentRes.cloth || 0) >= 4) {
        setResources(prev => ({
          ...prev,
          driftwood: Math.max(0, (prev.driftwood || 0) - 15),
          rope: Math.max(0, (prev.rope || 0) - 5),
          cloth: Math.max(0, (prev.cloth || 0) - 4),
        }));
        setCraftedItems(prev => ({ ...prev, bed_straw: true }));
        setShowTabMenu(false);

        activePlacementProp = 'bed_straw';
        if (ghostPropMesh && sceneRef.current) sceneRef.current.remove(ghostPropMesh);
        ghostPropMesh = createGhostPropMesh('bed_straw');
        if (sceneRef.current) sceneRef.current.add(ghostPropMesh);

        addLog("🛌 BASIC STRAW BED CRAFTED: Enter placement mode. Look around the raft deck. Left Click to Place!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Basic Straw Bed requires 15x Driftwood, 5x Rope, and 4x Cloth!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'hammock_luxury') {
      if ((currentRes.driftwood || 0) >= 15 && (currentRes.rope || 0) >= 8 && (currentRes.cloth || 0) >= 8 && (currentRes.leather || 0) >= 4) {
        setResources(prev => ({
          ...prev,
          driftwood: Math.max(0, (prev.driftwood || 0) - 15),
          rope: Math.max(0, (prev.rope || 0) - 8),
          cloth: Math.max(0, (prev.cloth || 0) - 8),
          leather: Math.max(0, (prev.leather || 0) - 4),
        }));
        setCraftedItems(prev => ({ ...prev, hammock_luxury: true }));
        setShowTabMenu(false);

        activePlacementProp = 'hammock_luxury';
        if (ghostPropMesh && sceneRef.current) sceneRef.current.remove(ghostPropMesh);
        ghostPropMesh = createGhostPropMesh('hammock_luxury');
        if (sceneRef.current) sceneRef.current.add(ghostPropMesh);

        addLog("🛌 LUXURY HAMMOCK CRAFTED: Enter placement mode. Look around the raft deck. Left Click to Place!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Luxury Hammock requires 15x Driftwood, 8x Rope, 8x Cloth, and 4x Leather!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'spikes_wood') {
      if ((currentRes.driftwood || 0) >= 12 && (currentRes.rope || 0) >= 4) {
        setResources(prev => ({
          ...prev,
          driftwood: Math.max(0, (prev.driftwood || 0) - 12),
          rope: Math.max(0, (prev.rope || 0) - 4),
        }));
        setCraftedItems(prev => ({ ...prev, spikes_wood: true }));
        setShowTabMenu(false);

        activePlacementProp = 'spikes_wood';
        if (ghostPropMesh && sceneRef.current) sceneRef.current.remove(ghostPropMesh);
        ghostPropMesh = createGhostPropMesh('spikes_wood');
        if (sceneRef.current) sceneRef.current.add(ghostPropMesh);

        addLog("🛡️ WOODEN SPIKES CRAFTED: Enter placement mode. Look around the raft deck. Left Click to Place!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Wooden Spikes require 12x Driftwood and 4x Rope!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'spikes_iron') {
      if ((currentRes.driftwood || 0) >= 15 && (currentRes.scrapMetal || 0) >= 6 && (currentRes.ironBar || 0) >= 3) {
        setResources(prev => ({
          ...prev,
          driftwood: Math.max(0, (prev.driftwood || 0) - 15),
          scrapMetal: Math.max(0, (prev.scrapMetal || 0) - 6),
          ironBar: Math.max(0, (prev.ironBar || 0) - 3),
        }));
        setCraftedItems(prev => ({ ...prev, spikes_iron: true }));
        setShowTabMenu(false);

        activePlacementProp = 'spikes_iron';
        if (ghostPropMesh && sceneRef.current) sceneRef.current.remove(ghostPropMesh);
        ghostPropMesh = createGhostPropMesh('spikes_iron');
        if (sceneRef.current) sceneRef.current.add(ghostPropMesh);

        addLog("🛡️ SCRAP-METAL BARBS CRAFTED: Enter placement mode. Look around the raft deck. Left Click to Place!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Scrap-Metal Barbs require 15x Driftwood, 6x Scrap Metal, and 3x Iron Bar!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'smelter_furnace') {
      if ((currentRes.clay || 0) >= 12 && (currentRes.stones || 0) >= 10 && (currentRes.scrapMetal || 0) >= 6) {
        setResources(prev => ({
          ...prev,
          clay: Math.max(0, (prev.clay || 0) - 12),
          stones: Math.max(0, (prev.stones || 0) - 10),
          scrapMetal: Math.max(0, (prev.scrapMetal || 0) - 6),
        }));
        setCraftedItems(prev => ({ ...prev, smelter_furnace: true }));
        setShowTabMenu(false);

        activePlacementProp = 'smelter_furnace';
        if (ghostPropMesh && sceneRef.current) sceneRef.current.remove(ghostPropMesh);
        ghostPropMesh = createGhostPropMesh('smelter_furnace');
        if (sceneRef.current) sceneRef.current.add(ghostPropMesh);

        addLog("🔥 BLAST FURNACE CRAFTED: Enter placement mode. Look around the raft deck. Left Click to Place!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Blast Furnace requires 12x Clay, 10x Stones, and 6x Scrap Metal!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'magnet_buoy') {
      if ((currentRes.copperWire || 0) >= 8 && (currentRes.batteryScrap || 0) >= 4 && (currentRes.plastic || 0) >= 6) {
        setResources(prev => ({
          ...prev,
          copperWire: Math.max(0, (prev.copperWire || 0) - 8),
          batteryScrap: Math.max(0, (prev.batteryScrap || 0) - 4),
          plastic: Math.max(0, (prev.plastic || 0) - 6),
        }));
        setCraftedItems(prev => ({ ...prev, magnet_buoy: true }));
        setShowTabMenu(false);

        activePlacementProp = 'magnet_buoy';
        if (ghostPropMesh && sceneRef.current) sceneRef.current.remove(ghostPropMesh);
        ghostPropMesh = createGhostPropMesh('magnet_buoy');
        if (sceneRef.current) sceneRef.current.add(ghostPropMesh);

        addLog("🧲 MAGNET BUOY CRAFTED: Enter placement mode. Look around the raft deck. Left Click to Place!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Magnet Buoy requires 8x Copper Wire, 4x Battery Scrap, and 6x Plastic!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'oxygen_line') {
      if ((currentRes.plastic || 0) >= 12 && (currentRes.copperWire || 0) >= 6 && (currentRes.leadScrap || 0) >= 4) {
        setResources(prev => ({
          ...prev,
          plastic: Math.max(0, (prev.plastic || 0) - 12),
          copperWire: Math.max(0, (prev.copperWire || 0) - 6),
          leadScrap: Math.max(0, (prev.leadScrap || 0) - 4),
        }));
        setCraftedItems(prev => ({ ...prev, oxygen_line: true }));
        setShowTabMenu(false);

        activePlacementProp = 'oxygen_line';
        if (ghostPropMesh && sceneRef.current) sceneRef.current.remove(ghostPropMesh);
        ghostPropMesh = createGhostPropMesh('oxygen_line');
        if (sceneRef.current) sceneRef.current.add(ghostPropMesh);

        addLog("🔌 OXYGEN LINE REEL CRAFTED: Enter placement mode. Look around the raft deck. Left Click to Place!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Oxygen Line Reel requires 12x Plastic, 6x Copper Wire, and 4x Lead Scrap!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'armor_scrap') {
      if ((currentRes.scrapMetal || 0) >= 8 && (currentRes.leather || 0) >= 4 && (currentRes.cloth || 0) >= 4) {
        setResources(prev => ({
          ...prev,
          scrapMetal: Math.max(0, (prev.scrapMetal || 0) - 8),
          leather: Math.max(0, (prev.leather || 0) - 4),
          cloth: Math.max(0, (prev.cloth || 0) - 4),
        }));
        setCraftedItems(prev => ({ ...prev, armor_scrap: true }));
        addLog("🛡️ CRAFTED SCRAP PLATE ARMOR: Equip in Character Inventory (I) for great physical protection!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Scrap Plate Armor requires 8x Scrap Metal, 4x Leather, and 4x Cloth!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'suit_shark') {
      if ((currentRes.sharkSkin || 0) >= 12 && (currentRes.leather || 0) >= 8 && (currentRes.cloth || 0) >= 4) {
        setResources(prev => ({
          ...prev,
          sharkSkin: Math.max(0, (prev.sharkSkin || 0) - 12),
          leather: Math.max(0, (prev.leather || 0) - 8),
          cloth: Math.max(0, (prev.cloth || 0) - 4),
        }));
        setCraftedItems(prev => ({ ...prev, suit_shark: true }));
        addLog("🦈 CRAFTED SHARK-SKIN WETSUIT: Equip in Character Inventory (I) for +20% swimming speed!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Shark-Skin Wetsuit requires 12x Shark Skin, 8x Leather, and 4x Cloth!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'boots_weighted') {
      if ((currentRes.leadScrap || 0) >= 8 && (currentRes.leather || 0) >= 4 && (currentRes.scrapMetal || 0) >= 4) {
        setResources(prev => ({
          ...prev,
          leadScrap: Math.max(0, (prev.leadScrap || 0) - 8),
          leather: Math.max(0, (prev.leather || 0) - 4),
          scrapMetal: Math.max(0, (prev.scrapMetal || 0) - 4),
        }));
        setCraftedItems(prev => ({ ...prev, boots_weighted: true }));
        addLog("🥾 CRAFTED LEAD-WEIGHTED BOOTS: Equip in Character Inventory (I) to sink fast and conserve oxygen!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Lead-Weighted Boots require 8x Lead Scrap, 4x Leather, and 4x Scrap Metal!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'titaniumHarpoon') {
      if ((currentRes.ironScraps || 0) >= 10 && (currentRes.copperWire || 0) >= 6 && (currentRes.rawTitanium || 0) >= 4) {
        setResources(prev => ({
          ...prev,
          ironScraps: Math.max(0, (prev.ironScraps || 0) - 10),
          copperWire: Math.max(0, (prev.copperWire || 0) - 6),
          rawTitanium: Math.max(0, (prev.rawTitanium || 0) - 4),
          titaniumHarpoon: (prev.titaniumHarpoon || 0) + 1,
        }));
        setCraftedItems(prev => ({ ...prev, titaniumHarpoon: true }));
        addLog("🔱 CRAFTED TITANIUM HARPOON: High-grade harpoon. Equip in Inventory (I) for massive +35 DMG!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Titanium Harpoon requires 10x Iron Scraps, 6x Copper Wire, and 4x Raw Titanium!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'magneticScanner') {
      if ((currentRes.copperWire || 0) >= 8 && (currentRes.silicaSand || 0) >= 4 && (currentRes.volcanicCrystals || 0) >= 3) {
        setResources(prev => ({
          ...prev,
          copperWire: Math.max(0, (prev.copperWire || 0) - 8),
          silicaSand: Math.max(0, (prev.silicaSand || 0) - 4),
          volcanicCrystals: Math.max(0, (prev.volcanicCrystals || 0) - 3),
          magneticScanner: (prev.magneticScanner || 0) + 1,
        }));
        setCraftedItems(prev => ({ ...prev, magneticScanner: true }));
        addLog("🧲 CRAFTED MAGNETIC SCANNER: Highlights subsea reserves. Equip in Inventory (I) for passive scanning!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Magnetic Scanner requires 8x Copper Wire, 4x Silica Sand, and 3x Volcanic Crystals!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'kineticDrill') {
      if ((currentRes.ironScraps || 0) >= 12 && (currentRes.rawTitanium || 0) >= 5 && (currentRes.lithiumBatteryPacks || 0) >= 4) {
        setResources(prev => ({
          ...prev,
          ironScraps: Math.max(0, (prev.ironScraps || 0) - 12),
          rawTitanium: Math.max(0, (prev.rawTitanium || 0) - 5),
          lithiumBatteryPacks: Math.max(0, (prev.lithiumBatteryPacks || 0) - 4),
          kineticDrill: (prev.kineticDrill || 0) + 1,
        }));
        setCraftedItems(prev => ({ ...prev, kineticDrill: true }));
        addLog("⚙️ CRAFTED KINETIC DRILL: Break subsea nodes 50% faster! Equip in Inventory (I) to use.");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Kinetic Drill requires 12x Iron Scraps, 5x Raw Titanium, and 4x Lithium Battery Packs!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'thermalRegulators') {
      if ((currentRes.ironScraps || 0) >= 15 && (currentRes.silicaSand || 0) >= 10 && (currentRes.volcanicCrystals || 0) >= 6 && (currentRes.deepSeaUranium || 0) >= 2) {
        setResources(prev => ({
          ...prev,
          ironScraps: Math.max(0, (prev.ironScraps || 0) - 15),
          silicaSand: Math.max(0, (prev.silicaSand || 0) - 10),
          volcanicCrystals: Math.max(0, (prev.volcanicCrystals || 0) - 6),
          deepSeaUranium: Math.max(0, (prev.deepSeaUranium || 0) - 2),
          thermalRegulators: (prev.thermalRegulators || 0) + 1,
        }));
        setCraftedItems(prev => ({ ...prev, thermalRegulators: true }));
        addLog("🌡️ CRAFTED THERMAL REGULATORS: Neutralizes heat! Equip in Inventory (I) for full thermal vent immunity.");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Thermal Regulators require 15x Iron Scraps, 10x Silica Sand, 6x Volcanic Crystals, and 2x Deep-Sea Uranium!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'highCapacityOxygenRebreather') {
      if ((currentRes.copperWire || 0) >= 12 && (currentRes.silicaSand || 0) >= 8 && (currentRes.lithiumBatteryPacks || 0) >= 6 && (currentRes.corruptedAIChips || 0) >= 3) {
        setResources(prev => ({
          ...prev,
          copperWire: Math.max(0, (prev.copperWire || 0) - 12),
          silicaSand: Math.max(0, (prev.silicaSand || 0) - 8),
          lithiumBatteryPacks: Math.max(0, (prev.lithiumBatteryPacks || 0) - 6),
          corruptedAIChips: Math.max(0, (prev.corruptedAIChips || 0) - 3),
          highCapacityOxygenRebreather: (prev.highCapacityOxygenRebreather || 0) + 1,
        }));
        setCraftedItems(prev => ({ ...prev, highCapacityOxygenRebreather: true }));
        addLog("🤿 CRAFTED HIGH-CAPACITY OXYGEN REBREATHER: Cuts oxygen depletion in half! Equip in Inventory (I).");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: High-Capacity Rebreather requires 12x Copper Wire, 8x Silica Sand, 6x Lithium Battery Packs, and 3x Corrupted AI Chips!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'glitchSubDriveMk1') {
      if ((currentRes.lithiumBatteryPacks || 0) >= 8 && (currentRes.rawTitanium || 0) >= 5 && (currentRes.corruptedAIChips || 0) >= 4 && (currentRes.blackBoxCore || 0) >= 1) {
        setResources(prev => ({
          ...prev,
          lithiumBatteryPacks: Math.max(0, (prev.lithiumBatteryPacks || 0) - 8),
          rawTitanium: Math.max(0, (prev.rawTitanium || 0) - 5),
          corruptedAIChips: Math.max(0, (prev.corruptedAIChips || 0) - 4),
          blackBoxCore: Math.max(0, (prev.blackBoxCore || 0) - 1),
          glitchSubDriveMk1: (prev.glitchSubDriveMk1 || 0) + 1,
        }));
        setCraftedItems(prev => ({ ...prev, glitchSubDriveMk1: true }));
        addLog("🚀 CRAFTED GLITCH SUB-DRIVE MK1: Reverse-engineered thrust. Equip in Inventory (I) for +40% swimming speed!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Glitch Sub-Drive Mk1 requires 8x Lithium Battery Packs, 5x Raw Titanium, 4x Corrupted AI Chips, and 1x Black Box Core!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'reinforcedHullPlating') {
      if ((currentRes.ironScraps || 0) >= 20 && (currentRes.silicaSand || 0) >= 10 && (currentRes.rawTitanium || 0) >= 8 && (currentRes.ancientRelicFragments || 0) >= 2) {
        setResources(prev => ({
          ...prev,
          ironScraps: Math.max(0, (prev.ironScraps || 0) - 20),
          silicaSand: Math.max(0, (prev.silicaSand || 0) - 10),
          rawTitanium: Math.max(0, (prev.rawTitanium || 0) - 8),
          ancientRelicFragments: Math.max(0, (prev.ancientRelicFragments || 0) - 2),
          reinforcedHullPlating: (prev.reinforcedHullPlating || 0) + 1,
        }));
        setCraftedItems(prev => ({ ...prev, reinforcedHullPlating: true }));
        addLog("🛡️ CRAFTED REINFORCED HULL PLATING: Maximum survival chassis armor (+40 ARMOR). Equip in Inventory (I).");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Reinforced Hull Plating requires 20x Iron Scraps, 10x Silica Sand, 8x Raw Titanium, and 2x Ancient Relic Fragments!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'bioFilterSuit') {
      if ((currentRes.silicaSand || 0) >= 10 && (currentRes.lithiumBatteryPacks || 0) >= 6 && (currentRes.ancientRelicFragments || 0) >= 4) {
        setResources(prev => ({
          ...prev,
          silicaSand: Math.max(0, (prev.silicaSand || 0) - 10),
          lithiumBatteryPacks: Math.max(0, (prev.lithiumBatteryPacks || 0) - 6),
          ancientRelicFragments: Math.max(0, (prev.ancientRelicFragments || 0) - 4),
          bioFilterSuit: (prev.bioFilterSuit || 0) + 1,
        }));
        setCraftedItems(prev => ({ ...prev, bioFilterSuit: true }));
        addLog("🧜 CRAFTED BIO-FILTER SUIT: Cuts hunger depletion by 40%! Equip in Inventory (I).");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: Bio-Filter Suit requires 10x Silica Sand, 6x Lithium Battery Packs, and 4x Ancient Relic Fragments!");
        audioSynth.playPing();
      }
    } else if (blueprintId === 'empPulseModule') {
      if ((currentRes.copperWire || 0) >= 15 && (currentRes.lithiumBatteryPacks || 0) >= 8 && (currentRes.corruptedAIChips || 0) >= 5 && (currentRes.singularityShard || 0) >= 1) {
        setResources(prev => ({
          ...prev,
          copperWire: Math.max(0, (prev.copperWire || 0) - 15),
          lithiumBatteryPacks: Math.max(0, (prev.lithiumBatteryPacks || 0) - 8),
          corruptedAIChips: Math.max(0, (prev.corruptedAIChips || 0) - 5),
          singularityShard: Math.max(0, (prev.singularityShard || 0) - 1),
          empPulseModule: (prev.empPulseModule || 0) + 1,
        }));
        setCraftedItems(prev => ({ ...prev, empPulseModule: true }));
        addLog("💥 CRAFTED EMP PULSE MODULE: Predator counter pulse. Equip in Inventory (I) to automatically repel sharks!");
        audioSynth.playPickup();
      } else {
        addLog("⚠️ INSUFFICIENT MATERIALS: EMP Pulse Module requires 15x Copper Wire, 8x Lithium Battery Packs, 5x Corrupted AI Chips, and 1x Singularity Shard!");
        audioSynth.playPing();
      }
    }
  };

  const handleRestart = () => {
    setOxygen(maxOxygenRef.current);
    setHunger(100);
    setHealth(100);
    setIsGameOver(false);

    const activeSpawnBed = placedCustomStructuresRef.current.find(
      (s) => s.type === 'crew_bed' && s.state?.isSpawnPoint
    );

    if (activeSpawnBed) {
      if (teleportTriggerRef.current) {
        teleportTriggerRef.current(0.275);
      }
      addLog('🛌 CREW QUARTERS RESPAWN: Safe-guard protocols active. Reconstructed at saved Crew Quarter Bed!');
      addLog('🎒 CARGO SECURED: Your inventory was completely secured by the Crew Quarter backup system!');
      return;
    }

    setResources({
      seaGlass: 0,
      cobalt: 0,
      volcanic: 0,
      scrapMetal: 0,
      driftwood: 0,
      biomass: 0,
      treasure: 0,
      food: 0,
      stones: 0,
      kelpFiber: 0,
    });
    islandEnemies = [];
    isSailCrafted = false;
    totalTilesBuilt = 0;
    setTotalTilesCount(0);
    if (teleportTriggerRef.current) {
      teleportTriggerRef.current(0.275); // teleport to raft deck
    }
    addLog('🔄 MISSION REBOOTED: Life support restored. Safe on raft platform.');
    addLog('🎒 INVENTORY LOST: All raw cargo resources were lost to the ocean depths...');
  };

  // Callback reference to teleport player within the loop
  const teleportTriggerRef = useRef<((y: number) => void) | null>(null);

  // --- THREE.JS SIMULATION LOOP ---
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;

    // SCENE & ATMOSPHERE
    const scene = new THREE.Scene();
    const skyColorHex = 0x87CEEB;
    scene.background = new THREE.Color(skyColorHex);
    scene.fog = new THREE.FogExp2(skyColorHex, 0.0075);
    let skyTime = 0;

    // CAMERA
    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 2000);

    // RENDERER
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: false,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x87CEEB, 1);

    // LIGHTING
    // Soft AmbientLight so shadows aren't completely black
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    // A beautiful HemisphereLight to simulate sky dome light and give shadow areas a natural rich blue-grey tint
    const hemiLight = new THREE.HemisphereLight(0xb3e5fc, 0x142b3a, 0.45);
    scene.add(hemiLight);

    // Powerful DirectionalLight (the Sun) to cast bright, crisp shadows
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.25);
    sunLight.position.set(35, 65, 35);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 250;
    const d = 60;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0003;
    scene.add(sunLight);

    // Moonlight for nighttime illumination
    const moonLight = new THREE.DirectionalLight(0x5c8a99, 0.4);
    moonLight.position.set(-35, -65, -35);
    moonLight.castShadow = true;
    scene.add(moonLight);

    // 3D OCEAN SURFACE (Y = 0) - LOW-POLY SEA WATER MESH
    const oceanGeom = new THREE.PlaneGeometry(1600, 1600, 64, 64);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x2A8A9D, // Vibrant teal blue matching the user specifications
      transparent: true,
      opacity: 0.85,
      roughness: 0.2,
      metalness: 0.1,
      flatShading: true, // For that distinct, blocky low-poly wave look
    });
    const oceanMesh = new THREE.Mesh(oceanGeom, oceanMat);
    oceanMesh.rotation.x = -Math.PI / 2;
    oceanMesh.receiveShadow = true;
    scene.add(oceanMesh);

    // Floating dynamic waves lines
    const waveParticlesGroup = new THREE.Group();
    scene.add(waveParticlesGroup);
    for (let i = 0; i < 40; i++) {
      const lineGeom = new THREE.BoxGeometry(Math.random() * 6 + 2, 0.02, 0.1);
      const lineMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.35, roughness: 0.2 });
      const line = new THREE.Mesh(lineGeom, lineMat);
      line.position.set(Math.random() * 150 - 75, 0.02, Math.random() * 150 - 75);
      waveParticlesGroup.add(line);
    }

    // MULTI-TILE MODULAR RAFT GROUP
    const raftGroup = new THREE.Group();
    raftGroup.position.set(0, 0, -1500);
    scene.add(raftGroup);

    sceneRef.current = scene;
    raftGroupRef.current = raftGroup;

    // Shadow helper to enable shadows recursively on grouped elements
    const enableShadows = (obj: THREE.Object3D) => {
      obj.castShadow = true;
      obj.receiveShadow = true;
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
    };

    // Modular grid-snapping system
    let raftTiles: { x: number; z: number; mesh: THREE.Group }[] = [];
    const placedCampfires: { mesh: THREE.Group; light: THREE.PointLight }[] = [];
    const placedBeds: { mesh: THREE.Group; type: 'bed_straw' | 'hammock_luxury' }[] = [];
    const placedSmelters: { mesh: THREE.Group }[] = [];
    const placedSpikes: { mesh: THREE.Group; type: 'spikes_wood' | 'spikes_iron' }[] = [];
    const placedMagnets: { mesh: THREE.Group }[] = [];
    const placedOxygenLines: { mesh: THREE.Group }[] = [];
    const placedSails: { mesh: THREE.Group }[] = [];
    const placedAnchors: { mesh: THREE.Group; deployed: boolean }[] = [];
    const placedSteeringWheels: { mesh: THREE.Group }[] = [];
    const placedWaterPurifiers: { mesh: THREE.Group; timer: number; waterLevel: number }[] = [];
    const placedAdvancedSmelters: { mesh: THREE.Group }[] = [];
    const placedCropPlots: { mesh: THREE.Group; seedPlanted: boolean; growTimer: number; cropReady: boolean }[] = [];
    const placedResearchTables: { mesh: THREE.Group }[] = [];
    const placedChairs: { mesh: THREE.Group }[] = [];
    const placedTables: { mesh: THREE.Group }[] = [];
    const placedLanterns: { mesh: THREE.Group; light: THREE.PointLight }[] = [];
    const placedCrewBeds: { mesh: THREE.Group }[] = [];
    let magnetTimer = 10.0;
    const RAFT_TILE_COST = 5;

    const createTileMesh = (tileX: number, tileZ: number): THREE.Group => {
      const tileGroup = new THREE.Group();
      tileGroup.position.set(tileX, 0, tileZ);

      const barrelMat = new THREE.MeshStandardMaterial({
        color: 0x475569, // steel buoyancy cylinders
        metalness: 0.8,
        roughness: 0.2,
        flatShading: true,
      });

      const woodMat = new THREE.MeshStandardMaterial({
        color: 0xe88a3a,
        roughness: 0.75,
        metalness: 0.05,
        flatShading: true,
      });

      // Under-support frame structure
      const supportGeom = new THREE.BoxGeometry(3.0 - 0.1, 0.08, 3.0 - 0.1);
      const supportMesh = new THREE.Mesh(supportGeom, barrelMat);
      supportMesh.position.y = 0.01;
      tileGroup.add(supportMesh);

      // Deck made of 6 parallel individual wooden planks with subtle gaps
      const plankCount = 6;
      const plankSpacing = (3.0 - 0.1) / plankCount;
      const plankWidth = plankSpacing - 0.03;
      const plankHeight = 0.08;
      const plankLength = 3.0 - 0.05;

      for (let p = 0; p < plankCount; p++) {
        const plankMesh = new THREE.Mesh(new THREE.BoxGeometry(plankWidth, plankHeight, plankLength), woodMat);
        const px = -((3.0 - 0.1) / 2) + (p * plankSpacing) + (plankSpacing / 2);
        plankMesh.position.set(px, 0.1, 0);
        tileGroup.add(plankMesh);
      }

      // Buoyancy drums
      const drumGeom = new THREE.CylinderGeometry(0.24, 0.24, 3.0 - 0.3, 10);
      drumGeom.rotateX(Math.PI / 2);

      const drumLeft = new THREE.Mesh(drumGeom, barrelMat);
      drumLeft.position.set(-0.8, -0.22, 0);
      tileGroup.add(drumLeft);

      const drumRight = new THREE.Mesh(drumGeom, barrelMat);
      drumRight.position.set(0.8, -0.22, 0);
      tileGroup.add(drumRight);

      // Enable shadows recursively on this raft tile
      enableShadows(tileGroup);

      return tileGroup;
    };

    const initRaft = () => {
      // Clear old
      while (raftGroup.children.length > 0) {
        raftGroup.remove(raftGroup.children[0]);
      }
      raftTiles = [];

      // Start with 1 tile at (0, 0)
      const mesh = createTileMesh(0, 0);
      raftGroup.add(mesh);
      raftTiles.push({ x: 0, z: 0, mesh });
    };

    // Initial Raft Build
    initRaft();

    // Ghost plank for previewing placement
    const ghostGeom = new THREE.BoxGeometry(3.0, 0.1, 3.0);
    const ghostMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.4,
      roughness: 0.5,
    });
    const ghostPlank = new THREE.Mesh(ghostGeom, ghostMat);
    ghostPlank.visible = false;
    scene.add(ghostPlank);

    const getSnapPosition = () => {
      const lookDir = new THREE.Vector3();
      camera.getWorldDirection(lookDir);
      lookDir.y = 0; // lock to horizontal plane
      lookDir.normalize();

      // Target placement point: 4.5 units ahead of playerPos
      const targetPlacementPoint = new THREE.Vector3().copy(playerPos).addScaledVector(lookDir, 4.5);

      // Snap coordinates relative to the center of the main raft
      const localX = targetPlacementPoint.x - raftGroup.position.x;
      const localZ = targetPlacementPoint.z - raftGroup.position.z;

      const snapX = Math.round(localX / 3.0) * 3.0;
      const snapZ = Math.round(localZ / 3.0) * 3.0;

      return { snapX, snapZ };
    };

    // PLAYER CHARACTER MESH GROUP (Stylized Scuba Diver, Roblox-style)
    const playerGroup = new THREE.Group();
    scene.add(playerGroup);

    const playerModelGroup = new THREE.Group();
    playerModelGroup.position.set(0, 0.26, 0);
    playerGroup.add(playerModelGroup);

    // Head
    const headGeom = new THREE.SphereGeometry(0.25, 12, 12);
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xfbcfe8, roughness: 0.8 });
    const head = new THREE.Mesh(headGeom, skinMat);
    head.position.set(0, 0.8, 0);
    playerModelGroup.add(head);

    // Visor goggles
    const visorGeom = new THREE.BoxGeometry(0.28, 0.12, 0.15);
    const visorMat = new THREE.MeshStandardMaterial({ color: 0x00f5ff, roughness: 0.1, metalness: 0.9 });
    const visor = new THREE.Mesh(visorGeom, visorMat);
    visor.position.set(0, 0.8, 0.16);
    playerModelGroup.add(visor);

    // Torso (yellow Scuba suit)
    const torsoGeom = new THREE.BoxGeometry(0.45, 0.6, 0.3);
    const suitMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.6 });
    const torso = new THREE.Mesh(torsoGeom, suitMat);
    torso.position.set(0, 0.38, 0);
    playerModelGroup.add(torso);

    // Oxygen tank on back
    const tankGeom = new THREE.CylinderGeometry(0.12, 0.12, 0.45, 10);
    const tankMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.75, roughness: 0.2 });
    const tank = new THREE.Mesh(tankGeom, tankMat);
    tank.position.set(0, 0.38, -0.2);
    playerModelGroup.add(tank);

    // Limbs (Arms & Legs)
    const limbGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.42, 8);
    const suitBlackMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });

    const leftArm = new THREE.Mesh(limbGeom, suitBlackMat);
    leftArm.position.set(-0.3, 0.38, 0);
    leftArm.rotation.z = 0.15;
    playerModelGroup.add(leftArm);

    const rightArm = new THREE.Mesh(limbGeom, suitBlackMat);
    rightArm.position.set(0.3, 0.38, 0);
    rightArm.rotation.z = -0.15;
    playerModelGroup.add(rightArm);

    const leftLeg = new THREE.Mesh(limbGeom, suitBlackMat);
    leftLeg.position.set(-0.16, -0.05, 0);
    playerModelGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(limbGeom, suitBlackMat);
    rightLeg.position.set(0.16, -0.05, 0);
    playerModelGroup.add(rightLeg);

    // Orange flippers
    const finGeom = new THREE.BoxGeometry(0.12, 0.02, 0.3);
    const finMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.9 });
    const leftFin = new THREE.Mesh(finGeom, finMat);
    leftFin.position.set(-0.16, -0.25, 0.08);
    playerModelGroup.add(leftFin);

    const rightFin = new THREE.Mesh(finGeom, finMat);
    rightFin.position.set(0.16, -0.25, 0.08);
    playerModelGroup.add(rightFin);

    // Dynamic head flashlight Spotlight
    const lightTarget = new THREE.Object3D();
    lightTarget.position.set(0, 0.8, 5);
    playerModelGroup.add(lightTarget);

    const flashlight = new THREE.SpotLight(0xffffff, 8, 45, Math.PI / 6, 0.3, 0.5);
    flashlight.position.set(0, 0.8, 0.18);
    flashlight.target = lightTarget;
    flashlight.visible = false;
    playerModelGroup.add(flashlight);

    // Alias/track flashlight as torchLight and turn it off initially
    const torchLight = flashlight;
    torchLight.visible = false;

    // Collectible torch tracking
    let torchWorldMesh: THREE.Group | null = null;
    let hasTorch = false;

    // Ocean flotsam debris system
    let flotsamItems: { type: string; mesh: THREE.Mesh }[] = [];
    let flotsamSpawnTimer = 0;

    // Enable shadows on player group
    enableShadows(playerGroup);

    // Initial position
    const playerPos = new THREE.Vector3(0, 0.8, -1500);
    let playerVY = 0;
    let spaceWasPressed = false;
    let playerRelativeX = 0;
    let playerRelativeZ = 0;
    let isPlayerParentedToRaft = false;

    // Helper to construct a high-fidelity survival Stone Axe
    const createAxeMesh = () => {
      const axeTool = new THREE.Group();

      // 1. THE SCULPTED CURVED HANDLE (TubeGeometry with CatmullRomCurve3)
      const handlePoints = [
        new THREE.Vector3(0, -0.25, 0.03),   // Bottom end curves slightly back
        new THREE.Vector3(0, -0.12, 0.01),
        new THREE.Vector3(0, 0, 0),          // Middle
        new THREE.Vector3(0, 0.12, -0.01),
        new THREE.Vector3(0, 0.25, 0.01)     // Top head connection
      ];
      const handleCurve = new THREE.CatmullRomCurve3(handlePoints);
      
      // Main wooden handle shaft (Deep Mahogany Wood color)
      const shaftGeom = new THREE.TubeGeometry(handleCurve, 16, 0.022, 8, false);
      const shaftMat = new THREE.MeshStandardMaterial({ color: 0x5C4033, roughness: 0.9, flatShading: true });
      const shaftMesh = new THREE.Mesh(shaftGeom, shaftMat);
      shaftMesh.position.y = 0.3; // Moves handle up relative to pivot
      axeTool.add(shaftMesh);

      // Thick dark leather wrap grip around the bottom part of the handle
      const gripPoints = [
        new THREE.Vector3(0, -0.25, 0.03),
        new THREE.Vector3(0, -0.12, 0.01),
        new THREE.Vector3(0, -0.02, 0.005)
      ];
      const gripCurve = new THREE.CatmullRomCurve3(gripPoints);
      const gripGeom = new THREE.TubeGeometry(gripCurve, 10, 0.025, 8, false);
      const gripMat = new THREE.MeshStandardMaterial({ color: 0x2A1A10, roughness: 0.85, flatShading: true }); // Deep dark leather
      const gripMesh = new THREE.Mesh(gripGeom, gripMat);
      gripMesh.position.y = 0.3; // Shift along with the handle
      axeTool.add(gripMesh);

      // Steel butt cap at the bottom end of the handle
      const capGeom = new THREE.CylinderGeometry(0.026, 0.026, 0.02, 8);
      const capMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.6, roughness: 0.3 });
      const capMesh = new THREE.Mesh(capGeom, capMat);
      capMesh.position.set(0, -0.25 + 0.3, 0.03); // Shift along with the handle
      capMesh.rotation.x = Math.PI / 2;
      axeTool.add(capMesh);

      // 2. THE CURVED AXE BLADE (ExtrudeGeometry from Shape)
      const bladeShape = new THREE.Shape();
      // Draw a realistic axe head profile in the XY plane
      bladeShape.moveTo(0, 0.18);
      // Upper flare curving out and up
      bladeShape.quadraticCurveTo(0.08, 0.26, 0.24, 0.28);
      // Smoothly curved cutting edge flaring downward
      bladeShape.quadraticCurveTo(0.28, 0.12, 0.22, -0.02);
      // Lower taper returning back to the base connection
      bladeShape.quadraticCurveTo(0.12, -0.04, 0, 0.08);
      // Flat hammer poll/butt on the back of the head
      bladeShape.lineTo(-0.08, 0.08);
      bladeShape.lineTo(-0.08, 0.18);
      bladeShape.lineTo(0, 0.18);

      const extrudeSettings = {
        depth: 0.02,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.01,
        bevelThickness: 0.015
      };

      const bladeGeom = new THREE.ExtrudeGeometry(bladeShape, extrudeSettings);
      bladeGeom.center(); // Center geometry around local origin
      const bladeMat = new THREE.MeshStandardMaterial({ color: 0xA9A9A9, metalness: 0.8, roughness: 0.2, flatShading: true }); // Steel Grey
      const bladeMesh = new THREE.Mesh(bladeGeom, bladeMat);

      // Rotate -90 degrees around Y-axis so flat sides face left/right,
      // and the cutting edge points directly forward along the Z-axis (sightline).
      bladeMesh.rotation.y = -Math.PI / 2;
      bladeMesh.position.set(0, 0.6, 0.15); // Adjust the blade to sit beautifully right at the top of that shifted handle
      axeTool.add(bladeMesh);

      // Dark forged iron collar to anchor head to the handle shaft
      const collarGeom = new THREE.BoxGeometry(0.06, 0.08, 0.07);
      const collarMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7, roughness: 0.4, flatShading: true });
      const collarMesh = new THREE.Mesh(collarGeom, collarMat);
      collarMesh.position.set(0, 0.2 + 0.3, 0); // Shift along with the handle
      axeTool.add(collarMesh);

      // PREPARED GLTFLOADER ROUTINE FOR WEAPONS (to easily swap out with file assets in the future)
      const weaponLoader = new GLTFLoader();
      const CUSTOM_AXE_URL = ''; // Add URL to GLTF model here in future
      if (CUSTOM_AXE_URL) {
        weaponLoader.load(CUSTOM_AXE_URL, (gltf) => {
          // Clear procedural pieces
          while (axeTool.children.length > 0) {
            axeTool.remove(axeTool.children[0]);
          }
          const customAxe = gltf.scene;
          customAxe.scale.set(0.12, 0.12, 0.12);
          customAxe.traverse((child: any) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          axeTool.add(customAxe);
          console.log("Custom pre-modeled axe weapon loaded successfully!");
        }, undefined, (err) => {
          console.error("Error loading weapon model, using robust procedural fallback:", err);
        });
      }

      return axeTool;
    };

    // Helper to construct a beautiful, detailed Fishing Rod mesh
    const createFishingRodMesh = () => {
      const rodTool = new THREE.Group();
      
      // Main rod pole (carbon wood/bamboo color)
      const polePoints = [
        new THREE.Vector3(0, -0.2, 0),
        new THREE.Vector3(0, 0.2, 0.05),
        new THREE.Vector3(0, 0.6, 0.15),
        new THREE.Vector3(0, 1.0, 0.35) // Elegant curve at top
      ];
      const poleCurve = new THREE.CatmullRomCurve3(polePoints);
      const poleGeom = new THREE.TubeGeometry(poleCurve, 16, 0.015, 8, false);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.65 });
      const poleMesh = new THREE.Mesh(poleGeom, poleMat);
      rodTool.add(poleMesh);

      // Cork/Leather Grip handle at the bottom
      const gripGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8);
      const gripMat = new THREE.MeshStandardMaterial({ color: 0xd2b48c, roughness: 0.8 }); // Cork Tan color
      const gripMesh = new THREE.Mesh(gripGeom, gripMat);
      gripMesh.position.set(0, -0.05, 0.01);
      rodTool.add(gripMesh);

      // Small reel attached near the grip
      const reelGroup = new THREE.Group();
      const reelBodyGeom = new THREE.CylinderGeometry(0.028, 0.028, 0.05, 8);
      const reelBodyMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.2 });
      const reelBody = new THREE.Mesh(reelBodyGeom, reelBodyMat);
      reelBody.rotation.z = Math.PI / 2;
      reelGroup.add(reelBody);

      const reelHandleGeom = new THREE.BoxGeometry(0.01, 0.04, 0.01);
      const reelHandle = new THREE.Mesh(reelHandleGeom, reelBodyMat);
      reelHandle.position.set(0.02, 0.02, 0);
      reelGroup.add(reelHandle);

      reelGroup.position.set(0, 0.15, 0.04);
      rodTool.add(reelGroup);

      // Line guides (rings) along the rod
      const ringMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.9, roughness: 0.1 });
      const ringPoints = [
        { pos: new THREE.Vector3(0, 0.35, 0.09), size: 0.018 },
        { pos: new THREE.Vector3(0, 0.65, 0.17), size: 0.014 },
        { pos: new THREE.Vector3(0, 0.95, 0.32), size: 0.01 }
      ];
      ringPoints.forEach((ring) => {
        const ringGeom = new THREE.TorusGeometry(ring.size, 0.003, 4, 8);
        const ringMesh = new THREE.Mesh(ringGeom, ringMat);
        ringMesh.position.copy(ring.pos);
        ringMesh.rotation.x = Math.PI / 2;
        rodTool.add(ringMesh);
      });

      return rodTool;
    };

    // Helper to construct a high-fidelity Spear / Harpoon mesh
    const createSpearMesh = () => {
      const spearTool = new THREE.Group();

      // Long brown wooden cylinder handle
      const shaftGeom = new THREE.CylinderGeometry(0.014, 0.014, 1.4, 8);
      const shaftMat = new THREE.MeshStandardMaterial({ color: 0x5C4033, roughness: 0.9, flatShading: true }); // Wood brown
      const shaftMesh = new THREE.Mesh(shaftGeom, shaftMat);
      shaftMesh.position.y = 0.4;
      spearTool.add(shaftMesh);

      // Bronze/Gold accents/bindings
      const ringGeom = new THREE.CylinderGeometry(0.018, 0.018, 0.04, 8);
      const ringMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.3 });
      
      const accent1 = new THREE.Mesh(ringGeom, ringMat);
      accent1.position.y = 1.0;
      spearTool.add(accent1);

      const accent2 = new THREE.Mesh(ringGeom, ringMat);
      accent2.position.y = -0.2;
      spearTool.add(accent2);

      // Sharp gray cone tip
      const tipGeom = new THREE.ConeGeometry(0.038, 0.22, 8);
      const tipMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, metalness: 0.8, roughness: 0.2, flatShading: true }); // Gray metal
      const tipMesh = new THREE.Mesh(tipGeom, tipMat);
      tipMesh.position.y = 1.21;
      spearTool.add(tipMesh);

      return spearTool;
    };

    // Helper to construct a curved low-poly Arc Bow mesh
    const createBowMesh = () => {
      const bowTool = new THREE.Group();
      
      // Curved wood arc - using half torus
      const arcGeom = new THREE.TorusGeometry(0.35, 0.015, 6, 12, Math.PI);
      const arcMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9, flatShading: true }); // curved low-poly arc mesh
      const arcMesh = new THREE.Mesh(arcGeom, arcMat);
      arcMesh.rotation.z = -Math.PI / 2; // Orient arc
      arcMesh.position.x = -0.15;
      bowTool.add(arcMesh);

      // Bow string (thin white line)
      const stringGeom = new THREE.CylinderGeometry(0.002, 0.002, 0.7, 4);
      const stringMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
      const stringMesh = new THREE.Mesh(stringGeom, stringMat);
      stringMesh.position.set(-0.15, 0, 0);
      bowTool.add(stringMesh);

      return bowTool;
    };

    let axeMesh: THREE.Group | null = null;
    isSwimming = false;

    // Teleport trigger assigner
    teleportTriggerRef.current = (y: number) => {
      // If teleporting to positive coordinates (deck surface), clamp to exactly the raft deck height
      const targetY = y >= 0 ? (0.275 + raftGroup.position.y) : y;
      
      const activeSpawnBed = placedCustomStructuresRef.current.find(
        (s) => s.type === 'crew_bed' && s.state?.isSpawnPoint
      );

      if (y === 0.275 && activeSpawnBed) {
        const localX = activeSpawnBed.x;
        const localZ = activeSpawnBed.z;
        playerPos.set(raftGroup.position.x + localX, targetY, raftGroup.position.z + localZ);
        playerVY = 0;
        isSwimming = false;
        playerRelativeX = localX;
        playerRelativeZ = localZ;
        return;
      }

      playerPos.set(raftGroup.position.x, targetY, raftGroup.position.z);
      playerVY = 0;
      isSwimming = targetY < 0;
      playerRelativeX = 0;
      playerRelativeZ = 0;
      
      // On full game restart/re-awaken, reset the raft tiles to a single starting tile!
      if (y === 0.275) {
        // Clear placed campfires
        placedCampfires.forEach((cf) => {
          raftGroup.remove(cf.mesh);
        });
        placedCampfires.length = 0;

        // Clear placed chests
        placedChestsRef.current.forEach((chest) => {
          raftGroup.remove(chest.mesh);
        });
        placedChestsRef.current.length = 0;
        setPlacedChestsState([]);

        // Clear custom structures
        placedCustomStructuresRef.current.forEach((struct) => {
          raftGroup.remove(struct.mesh);
        });
        placedCustomStructuresRef.current = [];
        placedSails.length = 0;
        placedAnchors.length = 0;
        placedSteeringWheels.length = 0;
        placedWaterPurifiers.length = 0;
        placedAdvancedSmelters.length = 0;
        placedCropPlots.length = 0;
        placedResearchTables.length = 0;
        placedChairs.length = 0;
        placedTables.length = 0;
        placedLanterns.length = 0;
        placedCrewBeds.length = 0;

        initRaft();
      }
    };

    // --- SUBSEA HARVEST CRYSTALS (SECTOR ORES) ---
    const crystals: CrystalData[] = [];

    const spawnCrystals = () => {
      // Clean previous
      crystals.forEach((c) => scene.remove(c.mesh));
      crystals.length = 0;

      // Spawn 45 materials throughout depth zones
      for (let i = 0; i < 45; i++) {
        const theta = Math.random() * Math.PI * 2;
        const radius = Math.random() * 85 + 8;
        const x = Math.sin(theta) * radius;
        const z = -1500 + Math.cos(theta) * radius;

        // Depth coordinate ranges from -3m to -120m by default
        let originalY = -Math.random() * 110 - 3;

        // Weighted spawn selection
        const roll = Math.random();
        let type: 'ironScraps' | 'silicaSand' | 'copperWire' | 'rawTitanium' | 'volcanicCrystals' | 'lithiumBatteryPacks' | 'deepSeaUranium' | 'ancientRelicFragments' | 'corruptedAIChips' | 'blackBoxCore' | 'singularityShard' | 'glitchArtifact';
        let color = 0x10b981;
        let mesh: THREE.Object3D;

        if (roll < 0.70) {
          // --- COMMON TIER (70% Spawn Rate) ---
          originalY = -Math.random() * 37 - 3; // Shallow depths (-3m to -40m)
          const subRoll = Math.random();
          if (subRoll < 0.34) {
            type = 'ironScraps';
            color = 0x64748b; // Steel slate
            
            // Silver metal gear visual
            const gearGroup = new THREE.Group();
            const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.9 });
            const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.1, 8), mat);
            cylinder.rotateX(Math.PI / 2);
            gearGroup.add(cylinder);
            for (let t = 0; t < 6; t++) {
              const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.1), mat);
              const angle = (t / 6) * Math.PI * 2;
              tooth.position.set(Math.sin(angle) * 0.2, Math.cos(angle) * 0.2, 0);
              tooth.rotation.z = angle;
              gearGroup.add(tooth);
            }
            mesh = gearGroup;
          } else if (subRoll < 0.67) {
            type = 'silicaSand';
            color = 0xeab308; // Yellow
            mesh = new THREE.Mesh(
              new THREE.OctahedronGeometry(0.20),
              new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4, roughness: 0.2 })
            );
          } else {
            type = 'copperWire';
            color = 0xf97316; // Orange copper
            mesh = new THREE.Mesh(
              new THREE.TorusGeometry(0.15, 0.05, 8, 24),
              new THREE.MeshStandardMaterial({ color, roughness: 0.1, metalness: 0.8 })
            );
          }
        } else if (roll < 0.90) {
          // --- UNCOMMON TIER (20% Spawn Rate) ---
          originalY = -Math.random() * 40 - 40; // Mid-depths (-40m to -80m)
          const subRoll = Math.random();
          if (subRoll < 0.34) {
            type = 'rawTitanium';
            color = 0x06b6d4; // Cyan/blue metallic
            mesh = new THREE.Mesh(
              new THREE.DodecahedronGeometry(0.22),
              new THREE.MeshStandardMaterial({ color, roughness: 0.2, metalness: 0.9, emissive: color, emissiveIntensity: 0.3 })
            );
          } else if (subRoll < 0.67) {
            type = 'volcanicCrystals';
            color = 0xef4444; // Volcanic deep red
            mesh = new THREE.Mesh(
              new THREE.ConeGeometry(0.18, 0.5, 6),
              new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8, roughness: 0.1 })
            );
            mesh.rotateX(Math.PI / 4);
          } else {
            type = 'lithiumBatteryPacks';
            color = 0x22c55e; // Battery green
            const batteryGroup = new THREE.Group();
            const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.7 });
            const cell1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8), mat);
            cell1.position.x = -0.07;
            const cell2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8), mat);
            cell2.position.x = 0.07;
            batteryGroup.add(cell1);
            batteryGroup.add(cell2);
            mesh = batteryGroup;
          }
        } else if (roll < 0.98) {
          // --- RARE TIER (8% Spawn Rate) ---
          originalY = -Math.random() * 30 - 80; // Deep trench only (-80m to -110m)
          const subRoll = Math.random();
          if (subRoll < 0.34) {
            type = 'deepSeaUranium';
            color = 0x10b981; // Glowing acid green
            mesh = new THREE.Mesh(
              new THREE.OctahedronGeometry(0.24),
              new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.5, roughness: 0.05 })
            );
          } else if (subRoll < 0.67) {
            type = 'ancientRelicFragments';
            color = 0xf59e0b; // Amber antique
            const relicGroup = new THREE.Group();
            const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.1, metalness: 0.9, emissive: 0xb45309, emissiveIntensity: 0.5 });
            const base = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.1, 0.3, 6), mat);
            const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.15, 6), mat);
            neck.position.y = 0.2;
            relicGroup.add(base);
            relicGroup.add(neck);
            mesh = relicGroup;
          } else {
            type = 'corruptedAIChips';
            color = 0x8b5cf6; // Cyber violet
            const chipGroup = new THREE.Group();
            const boardMat = new THREE.MeshStandardMaterial({ color: 0x4c1d95, roughness: 0.5 });
            const pinMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, metalness: 0.9 });
            const board = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.3), boardMat);
            chipGroup.add(board);
            const core = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.12), pinMat);
            core.position.y = 0.04;
            chipGroup.add(core);
            mesh = chipGroup;
          }
        } else if (roll < 0.997) {
          // --- MYTHIC TIER (1.5% Spawn Rate) ---
          originalY = -Math.random() * 20 - 90; // Abyssal zone only (-90m to -110m)
          const subRoll = Math.random();
          if (subRoll < 0.50) {
            type = 'blackBoxCore';
            color = 0xf97316; // Alert orange
            const boxGroup = new THREE.Group();
            const metal = new THREE.MeshStandardMaterial({ color, metalness: 0.9, roughness: 0.2, emissive: 0xea580c, emissiveIntensity: 0.6 });
            const core = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.26), metal);
            const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 0.28), new THREE.MeshStandardMaterial({ color: 0xffffff }));
            boxGroup.add(core);
            boxGroup.add(stripe);
            mesh = boxGroup;
          } else {
            type = 'singularityShard';
            color = 0x4c1d95; // Void purple
            const shardGroup = new THREE.Group();
            const core = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshBasicMaterial({ color: 0x000000 }));
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.02, 6, 16), new THREE.MeshBasicMaterial({ color: 0xa855f7 }));
            ring.rotateX(Math.PI / 4);
            shardGroup.add(core);
            shardGroup.add(ring);
            mesh = shardGroup;
          }
        } else {
          // --- GLITCH TIER (0.3% Spawn Rate) ---
          originalY = -Math.random() * 10 - 100; // Absolute bottom trench (-100m to -110m)
          type = 'glitchArtifact';
          color = 0xec4899; // Hyper pink
          const glitchGroup = new THREE.Group();
          const core = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.25, 1),
            new THREE.MeshStandardMaterial({ color, wireframe: true, emissive: 0x06b6d4, emissiveIntensity: 2.0 })
          );
          glitchGroup.add(core);
          mesh = glitchGroup;
        }

        mesh.position.set(x, originalY, z);
        scene.add(mesh);

        crystals.push({
          id: `cry-${i}-${Date.now()}`,
          type,
          mesh,
          originalY,
          collected: false,
          color: '#' + new THREE.Color(color).getHexString(),
        });
      }
    };

    spawnCrystals();

    // --- SURFACE ISLAND SYSTEM (PROCEDURAL RUGGED MOUNTAIN & CAVE LANDMASS) ---
    const islandGroup = new THREE.Group();
    scene.add(islandGroup);

    const islandLocations = GLOBAL_ISLAND_LOCATIONS;

    // Helper to calculate sloped height for any coordinate relative to the closest island
    const getIslandHeightAt = (x: number, z: number): number => {
      let closestIsland = islandLocations[0];
      let minDist = Infinity;
      for (const loc of islandLocations) {
        const dx = x - loc.x;
        const dz = z - loc.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < minDist) {
          minDist = dist;
          closestIsland = loc;
        }
      }

      if (minDist > 60) return 0;

      const dx = x - closestIsland.x;
      const dz = z - closestIsland.z;
      const distanceSquared = dx * dx + dz * dz;
      
      // Create a base mountain dome shape that tapers down at the edges
      let baseDome = Math.max(0, 10.0 - (distanceSquared * 0.003));
      
      // Add rugged noise detail on top
      let ruggedNoise = Math.sin(dx * 0.05) * Math.cos(dz * 0.05) * 2.0;
      
      let targetHeight = baseDome + ruggedNoise - 1.0 - 0.4;
      
      if (targetHeight < 0) {
        targetHeight = 0;
      }
      return targetHeight;
    };

    // Generate island meshes for all locations
    islandLocations.forEach((loc, islandIdx) => {
      // Generate rugged mountain landmass plane geometry with sharp facet vertex coloring
      const islandGeo = new THREE.PlaneGeometry(120, 120, 80, 80);
      islandGeo.rotateX(-Math.PI / 2); // Rotate to lay flat

      // Update vertex heights and build vertex colors
      const posAttr = islandGeo.attributes.position;
      const colors: number[] = [];
      
      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vz = posAttr.getZ(i);
        // Offset position center locally to loc
        const globalX = vx + loc.x;
        const globalZ = vz + loc.z;
        const height = getIslandHeightAt(globalX, globalZ);
        
        // Offset so that when mesh is placed at -0.4, vertex global Y is height
        posAttr.setY(i, height + 0.4);
        
        // Determine color based on height & steepness (low = sand, mid = grass, high = rock/snow)
        const finalH = height;
        let r = 0.1, g = 0.6, b = 0.2; // default green
        
        if (finalH < 0.6) {
          // Sandy beach
          r = 0.95; g = 0.85; b = 0.55;
        } else if (finalH < 1.8) {
          // Grassy meadows
          r = 0.15; g = 0.65; b = 0.25;
        } else if (finalH < 4.5) {
          // Dark forest green / mossy rocks
          r = 0.08; g = 0.45; b = 0.15;
        } else if (finalH < 7.5) {
          // Rocky slopes
          r = 0.45; g = 0.42; b = 0.40;
        } else {
          // Snowy peaks
          r = 0.95; g = 0.95; b = 0.98;
        }
        
        colors.push(r, g, b);
      }
      
      islandGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      islandGeo.computeVertexNormals();

      const islandMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.9,
        metalness: 0.05,
        flatShading: true
      });

      const islandMesh = new THREE.Mesh(islandGeo, islandMat);
      islandMesh.position.set(loc.x, -0.4, loc.z);
      islandMesh.castShadow = true;
      islandMesh.receiveShadow = true;
      islandGroup.add(islandMesh);
    });

    // --- PROCEDURAL CAVE ---
    // Near the base of the mountains (e.g. coordinates 10, 0, 70), build a beautiful rock box archway cave.
    const caveGroup = new THREE.Group();
    const caveX = 10;
    const caveZ = 70;
    const caveY = getIslandHeightAt(caveX, caveZ);

    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x374151, // dark grey rock
      roughness: 0.9,
      flatShading: true
    });

    // Left pillar
    const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(2.8, 5.0, 3.5), rockMat);
    leftPillar.position.set(-2.2, 2.5, 0);
    leftPillar.rotation.set(0.1, 0.05, -0.05);
    leftPillar.castShadow = true;
    leftPillar.receiveShadow = true;
    caveGroup.add(leftPillar);

    // Right pillar
    const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(2.8, 5.0, 3.5), rockMat);
    rightPillar.position.set(2.2, 2.5, 0);
    rightPillar.rotation.set(-0.1, -0.05, 0.05);
    rightPillar.castShadow = true;
    rightPillar.receiveShadow = true;
    caveGroup.add(rightPillar);

    // Arch Roof / Cap
    const archRoof = new THREE.Mesh(new THREE.BoxGeometry(7.0, 2.0, 4.5), rockMat);
    archRoof.position.set(0, 5.2, -0.2);
    archRoof.rotation.set(0.05, 0.1, -0.05);
    archRoof.castShadow = true;
    archRoof.receiveShadow = true;
    caveGroup.add(archRoof);

    // Back wall to contain the interior and give depth
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(6.5, 5.0, 2.0), rockMat);
    backWall.position.set(0, 2.5, -2.0);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    caveGroup.add(backWall);

    // Black light-absorbant material inside the cave to simulate deep cave interior
    const blackMat = new THREE.MeshBasicMaterial({ color: 0x070a13, side: THREE.DoubleSide });
    const caveInterior = new THREE.Mesh(new THREE.BoxGeometry(4.0, 4.2, 0.2), blackMat);
    caveInterior.position.set(0, 2.1, -1.6);
    caveGroup.add(caveInterior);

    // Glowing cyan rare crystal inside the cave!
    const crystalGeo = new THREE.ConeGeometry(0.18, 0.7, 5);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4, // glowing cyan
      emissive: 0x0891b2,
      roughness: 0.1,
      metalness: 0.9,
    });
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.position.set(0, 0.35, -1.3);
    crystal.rotation.set(0.15, 0, 0.15);
    caveGroup.add(crystal);

    // Blue glow point light inside the cave entrance
    const crystalLight = new THREE.PointLight(0x06b6d4, 1.8, 6);
    crystalLight.position.set(0, 0.8, -1.0);
    caveGroup.add(crystalLight);

    // Position the cave and orient it facing the starting raft area
    caveGroup.position.set(caveX, caveY - 0.1, caveZ);
    caveGroup.rotation.y = Math.atan2(caveX, caveZ);
    islandGroup.add(caveGroup);

    // SPAWN THE UNIQUE COLLECTIBLE TORCH MESH
    torchWorldMesh = new THREE.Group();

    // Brown stick
    const torchStickGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6);
    const torchStickMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
    const torchStick = new THREE.Mesh(torchStickGeo, torchStickMat);
    torchStick.position.y = 0.3;
    torchStick.castShadow = true;
    torchStick.receiveShadow = true;
    torchWorldMesh.add(torchStick);

    // Orange cone on top
    const torchFlameGeo = new THREE.ConeGeometry(0.08, 0.25, 5);
    const torchFlameMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
    const torchFlame = new THREE.Mesh(torchFlameGeo, torchFlameMat);
    torchFlame.position.y = 0.65;
    torchWorldMesh.add(torchFlame);

    // Warm torch glow light
    const torchGlowLight = new THREE.PointLight(0xffaa44, 2.0, 6);
    torchGlowLight.position.set(0, 0.65, 0);
    torchWorldMesh.add(torchGlowLight);

    // Position it explicitly on the terrain of Island 1 (near cave entrance)
    const torchX = 10.5;
    const torchZ = 73.0;
    const torchY = getIslandHeightAt(torchX, torchZ);
    torchWorldMesh.position.set(torchX, torchY, torchZ);
    scene.add(torchWorldMesh);

    // Spawning Choppable Trees & Food on the sloped surface
    const islandTrees: IslandTree[] = [];
    const islandFoods: IslandFood[] = [];
    const rareChests: RareChest[] = [];

    // Loop through each island to populate them with vegetation
    islandLocations.forEach((loc, islandIdx) => {
      // 1. Procedurally scatter 45 palm trees for each island
      for (let i = 0; i < 45; i++) {
        const treeGroup = new THREE.Group();
        
        // Stem/Trunk
        const trunkMat = new THREE.MeshStandardMaterial({
          color: 0x78350f, // Brown bark
          roughness: 0.9,
        });
        const trunkGeom = new THREE.CylinderGeometry(0.12, 0.22, 2.5, 5);
        const trunk = new THREE.Mesh(trunkGeom, trunkMat);
        trunk.position.y = 1.25; // center of a 2.5 tall trunk sits at 1.25 locally
        treeGroup.add(trunk);

        // Palm leaves
        const leafMat = new THREE.MeshStandardMaterial({
          color: 0x16a34a, // Rich green
          roughness: 0.7,
        });
        for (let j = 0; j < 5; j++) {
          const leafGeom = new THREE.ConeGeometry(0.35, 1.2, 4);
          leafGeom.rotateX(Math.PI / 2.2); // tilt down
          const leaf = new THREE.Mesh(leafGeom, leafMat);
          const angle = (j / 5) * Math.PI * 2;
          leaf.position.set(Math.sin(angle) * 0.4, 2.4, Math.cos(angle) * 0.4);
          leaf.rotation.y = angle;
          treeGroup.add(leaf);
        }

        // Random position inside slope area (radius 5 to 45 around the current island center)
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 40 + 5; // 5 to 45 distance from center
        const tx = loc.x + Math.sin(angle) * dist;
        const tz = loc.z + Math.cos(angle) * dist;
        const ty = getIslandHeightAt(tx, tz);
        
        treeGroup.position.set(tx, ty, tz);
        
        // Enable shadows on the tree group
        enableShadows(treeGroup);
        
        scene.add(treeGroup);

        islandTrees.push({
          id: `tree-${islandIdx}-${i}-${Date.now()}`,
          mesh: treeGroup,
          hits: 0,
          shakeTimer: 0,
          originalX: tx,
          originalZ: tz,
        });
      }

      // 2. Place 45 food items (32 berry bushes and 13 coconuts) for each island
      for (let i = 0; i < 45; i++) {
        const foodGroup = new THREE.Group();
        const type = i < 32 ? 'berry' : 'coconut';

        if (type === 'berry') {
          // Berry bush (small green ball with tiny red berries)
          const bushMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.9 });
          const bush = new THREE.Mesh(new THREE.SphereGeometry(0.24, 6, 6), bushMat);
          bush.position.y = 0.12;
          foodGroup.add(bush);

          const berryMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 });
          for (let b = 0; b < 4; b++) {
            const berry = new THREE.Mesh(new THREE.SphereGeometry(0.06, 4, 4), berryMat);
            const bAngle = (b / 4) * Math.PI * 2;
            berry.position.set(Math.sin(bAngle) * 0.18, 0.18, Math.cos(bAngle) * 0.18);
            foodGroup.add(berry);
          }
        } else {
          // Coconut (small brown sphere)
          const cocoMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.8 });
          const coco = new THREE.Mesh(new THREE.SphereGeometry(0.13, 5, 5), cocoMat);
          coco.position.y = 0.08;
          foodGroup.add(coco);
        }

        // Random position inside slope area (radius 4 to 45 around the current island center)
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 41 + 4; // 4 to 45 distance from center
        const fx = loc.x + Math.sin(angle) * dist;
        const fz = loc.z + Math.cos(angle) * dist;
        const fy = getIslandHeightAt(fx, fz);

        foodGroup.position.set(fx, fy, fz);
        
        // Enable shadows on the food group
        enableShadows(foodGroup);
        
        scene.add(foodGroup);

        islandFoods.push({
          id: `food-${islandIdx}-${i}-${Date.now()}`,
          mesh: foodGroup,
          type,
        });
      }

      // 3. Spawn a unique "Rare Chest" mesh group near the center of the island
      const chestGroup = new THREE.Group();
      
      // Base body: a dark/charcoal sci-fi box
      const baseMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.0, 0.5, 0.6),
        new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8, metalness: 0.8 })
      );
      baseMesh.position.set(0, 0.25, 0);
      baseMesh.castShadow = true;
      baseMesh.receiveShadow = true;
      chestGroup.add(baseMesh);

      // Gold bands on Base
      const goldBandMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        emissive: 0xffaa00,
        emissiveIntensity: 1.2,
        metalness: 1.0,
        roughness: 0.1
      });
      const band1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.52, 0.62), goldBandMat);
      band1.position.set(-0.3, 0.25, 0);
      chestGroup.add(band1);

      const band2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.52, 0.62), goldBandMat);
      band2.position.set(0.3, 0.25, 0);
      chestGroup.add(band2);

      // Padlock / Lock
      const lockMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.22, 0.08),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xeab308, emissiveIntensity: 1.5, metalness: 1.0, roughness: 0.1 })
      );
      lockMesh.position.set(0, 0.25, 0.31);
      chestGroup.add(lockMesh);

      // Lid pivot group
      const lidGroup = new THREE.Group();
      lidGroup.position.set(0, 0.5, -0.3); // pivot at the back top edge

      // Lid mesh
      const lidMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.04, 0.25, 0.64),
        new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.7, metalness: 0.9 })
      );
      lidMesh.position.set(0, 0.125, 0.3); // offset forward from pivot
      lidMesh.castShadow = true;
      lidMesh.receiveShadow = true;
      lidGroup.add(lidMesh);

      // Lid Gold bands
      const lidBand1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.27, 0.66), goldBandMat);
      lidBand1.position.set(-0.3, 0.125, 0.3);
      lidGroup.add(lidBand1);

      const lidBand2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.27, 0.66), goldBandMat);
      lidBand2.position.set(0.3, 0.125, 0.3);
      lidGroup.add(lidBand2);

      chestGroup.add(lidGroup);

      // Glow light
      const glowLight = new THREE.PointLight(0xffaa00, 1.5, 4.0);
      glowLight.position.set(0, 0.4, 0);
      chestGroup.add(glowLight);

      // Position chest at center of island
      const cx = loc.x;
      const cz = loc.z;
      const cy = getIslandHeightAt(cx, cz);
      chestGroup.position.set(cx, cy, cz);
      
      // Face somewhat towards the player's general starting area
      chestGroup.rotation.y = Math.random() * Math.PI * 2;

      enableShadows(chestGroup);
      scene.add(chestGroup);

      rareChests.push({
        id: `rare_chest-${islandIdx}-${Date.now()}`,
        mesh: chestGroup,
        lidMesh: lidGroup as unknown as THREE.Mesh,
        opened: false,
        openProgress: 0
      });

      // 4. Procedurally spawn 2 to 3 skeletons on the terrain surface
      const numSkeletons = Math.floor(Math.random() * 2) + 2; // 2 or 3
      for (let s = 0; s < numSkeletons; s++) {
        const enemyGroup = new THREE.Group();

        const skeletonColor = 0xe5e7eb; // Bone white
        const boneMat = new THREE.MeshStandardMaterial({
          color: skeletonColor,
          roughness: 0.9,
          metalness: 0.1
        });

        // spine (torso)
        const spineGeom = new THREE.BoxGeometry(0.12, 1.1, 0.12);
        const spineMesh = new THREE.Mesh(spineGeom, boneMat);
        spineMesh.position.y = 1.0;
        spineMesh.castShadow = true;
        spineMesh.receiveShadow = true;
        enemyGroup.add(spineMesh);

        // shoulders
        const shoulderGeom = new THREE.BoxGeometry(0.55, 0.08, 0.12);
        const shoulderMesh = new THREE.Mesh(shoulderGeom, boneMat);
        shoulderMesh.position.set(0, 1.4, 0);
        shoulderMesh.castShadow = true;
        enemyGroup.add(shoulderMesh);

        // pelvis
        const pelvisGeom = new THREE.BoxGeometry(0.38, 0.08, 0.1);
        const pelvisMesh = new THREE.Mesh(pelvisGeom, boneMat);
        pelvisMesh.position.set(0, 0.7, 0);
        pelvisMesh.castShadow = true;
        enemyGroup.add(pelvisMesh);

        // skull (Sphere)
        const skullGeom = new THREE.SphereGeometry(0.18, 8, 8);
        const skullMesh = new THREE.Mesh(skullGeom, boneMat);
        skullMesh.position.set(0, 1.65, 0);
        skullMesh.castShadow = true;
        enemyGroup.add(skullMesh);

        // Left and Right Legs
        const legGeom = new THREE.BoxGeometry(0.08, 0.7, 0.08);
        
        const leftLeg = new THREE.Mesh(legGeom, boneMat);
        leftLeg.position.set(-0.14, 0.35, 0);
        leftLeg.castShadow = true;
        enemyGroup.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeom, boneMat);
        rightLeg.position.set(0.14, 0.35, 0);
        rightLeg.castShadow = true;
        enemyGroup.add(rightLeg);

        // Left and Right Arms
        const armGeom = new THREE.BoxGeometry(0.07, 0.75, 0.07);

        const leftArm = new THREE.Mesh(armGeom, boneMat);
        leftArm.position.set(-0.3, 1.05, 0);
        leftArm.castShadow = true;
        enemyGroup.add(leftArm);

        const rightArm = new THREE.Mesh(armGeom, boneMat);
        rightArm.position.set(0.3, 1.05, 0);
        rightArm.castShadow = true;
        enemyGroup.add(rightArm);

        // Glowing red eyes
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const eyeGeom = new THREE.BoxGeometry(0.04, 0.04, 0.04);
        
        const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
        leftEye.position.set(-0.06, 1.68, 0.16);
        enemyGroup.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
        rightEye.position.set(0.06, 1.68, 0.16);
        enemyGroup.add(rightEye);

        // Random offset near the center of the island
        const sx = loc.x + THREE.MathUtils.randFloat(-10, 10);
        const sz = loc.z + THREE.MathUtils.randFloat(-10, 10);
        const sy = getIslandHeightAt(sx, sz);
        enemyGroup.position.set(sx, sy, sz);

        // Tag child meshes for hit raycasting
        const uniqueId = `skeleton-${islandIdx}-${s}-${Date.now()}`;
        enemyGroup.traverse((child) => {
          child.userData = { type: 'skeleton', parentId: uniqueId };
        });

        enemyGroup.userData = {
          type: 'skeleton',
          id: uniqueId,
          health: 50,
          speed: 0.03,
          state: 'idle',
          islandCenter: loc
        };

        enableShadows(enemyGroup);
        scene.add(enemyGroup);

        islandEnemies.push({
          id: uniqueId,
          mesh: enemyGroup,
          health: 50,
          speed: 0.03,
          state: 'idle',
          islandCenter: loc
        });
      }
    });

    // --- FORAGEABLE LOOSE ITEMS SYSTEM ---
    const forageables: ForageableItem[] = [];
    interface RespawnTask {
      type: 'driftwood_stick' | 'loose_scrap' | 'drifting_log';
      timeRemaining: number;
    }
    const respawnQueue: RespawnTask[] = [];

    // Helper to spawn a single driftwood stick
    const spawnDriftwoodStick = (id: string, customPos?: THREE.Vector3) => {
      const stickGroup = new THREE.Group();
      const geom = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 5);
      geom.rotateZ(Math.PI / 2); // lie horizontal
      const mat = new THREE.MeshStandardMaterial({
        color: 0x854d0e, // dark brown
        roughness: 0.9,
      });
      const mesh = new THREE.Mesh(geom, mat);
      stickGroup.add(mesh);

      let x = 0, z = 0, y = 1.2;
      if (customPos) {
        x = customPos.x;
        y = customPos.y;
        z = customPos.z;
      } else {
        // Pick a random island to spawn on the beach!
        const randomIsland = islandLocations[Math.floor(Math.random() * islandLocations.length)];
        // Sandy beach: distance 44 to 58 from center on the procedural island
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 14 + 44; // 44 to 58
        x = randomIsland.x + Math.sin(angle) * dist;
        z = randomIsland.z + Math.cos(angle) * dist;
        y = getIslandHeightAt(x, z);
      }
      stickGroup.position.set(x, y + 0.04, z);
      stickGroup.rotation.y = Math.random() * Math.PI * 2;
      
      // Enable shadows on the stick group
      enableShadows(stickGroup);
      
      scene.add(stickGroup);

      forageables.push({
        id,
        type: 'driftwood_stick',
        mesh: stickGroup,
        originalY: y + 0.04,
      });
    };

    // Helper to spawn a single loose metal scrap
    const spawnLooseScrap = (id: string, customPos?: THREE.Vector3) => {
      const scrapGroup = new THREE.Group();
      const geom = new THREE.BoxGeometry(0.3, 0.03, 0.2);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x64748b, // steel slate
        metalness: 0.85,
        roughness: 0.25,
      });
      const mesh = new THREE.Mesh(geom, mat);
      scrapGroup.add(mesh);

      let x = 0, z = 0, y = 1.2;
      if (customPos) {
        x = customPos.x;
        y = customPos.y;
        z = customPos.z;
      } else {
        // Pick a random island to spawn on the beach!
        const randomIsland = islandLocations[Math.floor(Math.random() * islandLocations.length)];
        // Sandy beach: distance 44 to 58 from center on the procedural island
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 14 + 44; // 44 to 58
        x = randomIsland.x + Math.sin(angle) * dist;
        z = randomIsland.z + Math.cos(angle) * dist;
        y = getIslandHeightAt(x, z);
      }
      scrapGroup.position.set(x, y + 0.015, z);
      scrapGroup.rotation.y = Math.random() * Math.PI * 2;
      
      // Enable shadows on the scrap group
      enableShadows(scrapGroup);
      
      scene.add(scrapGroup);

      forageables.push({
        id,
        type: 'loose_scrap',
        mesh: scrapGroup,
        originalY: y + 0.015,
      });
    };

    // Helper to spawn a drifting log in the water near the raft
    const spawnDriftingLog = (id: string) => {
      const logGroup = new THREE.Group();
      const geom = new THREE.CylinderGeometry(0.12, 0.12, 1.4, 6);
      geom.rotateX(Math.PI / 2); // lie horizontal along Z-axis
      const mat = new THREE.MeshStandardMaterial({
        color: 0x78350f, // rich bark brown
        roughness: 0.85,
      });
      const mesh = new THREE.Mesh(geom, mat);
      logGroup.add(mesh);

      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 10 + 10; // 10 to 20 distance
      const x = Math.sin(angle) * dist;
      const z = Math.cos(angle) * dist;
      const y = -0.05; // slightly submerged

      logGroup.position.set(x, y, z);
      logGroup.rotation.y = Math.random() * Math.PI * 2;
      
      // Enable shadows on the log group
      enableShadows(logGroup);
      
      scene.add(logGroup);

      forageables.push({
        id,
        type: 'drifting_log',
        mesh: logGroup,
        originalY: y,
      });
    };

    // Spawn initial beach/water resources
    for (let i = 0; i < 4; i++) {
      spawnDriftwoodStick(`beach-stick-${i}-${Date.now()}`);
    }
    for (let i = 0; i < 3; i++) {
      spawnLooseScrap(`beach-scrap-${i}-${Date.now()}`);
    }
    for (let i = 0; i < 2; i++) {
      spawnDriftingLog(`drift-log-${i}-${Date.now()}`);
    }

    // --- UNDERWATER HAZARDS (SEA URCHINS & SHARKS) ---
    const hazards: HazardData[] = [];

    const spawnHazards = () => {
      // Clean previous
      hazards.forEach((h) => scene.remove(h.mesh));
      hazards.length = 0;

      // 1. Static spiky sea urchins
      for (let i = 0; i < 15; i++) {
        const group = new THREE.Group();
        const core = new THREE.Mesh(
          new THREE.SphereGeometry(0.35, 8, 8),
          new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 })
        );
        group.add(core);

        // Add small needle spikes
        const spikeGeom = new THREE.ConeGeometry(0.05, 0.4, 4);
        spikeGeom.translate(0, 0.2, 0);
        spikeGeom.rotateX(Math.PI / 2);
        const spikeMat = new THREE.MeshStandardMaterial({ color: 0xef4444 });

        for (let s = 0; s < 10; s++) {
          const spike = new THREE.Mesh(spikeGeom, spikeMat);
          spike.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
          group.add(spike);
        }

        const depthCoord = -Math.random() * 90 - 15;
        const theta = Math.random() * Math.PI * 2;
        const r = Math.random() * 70 + 10;
        group.position.set(Math.sin(theta) * r, depthCoord, -1500 + Math.cos(theta) * r);
        scene.add(group);

        hazards.push({
          id: `urchin-${i}`,
          type: 'urchin',
          mesh: group,
          health: 1,
          speed: 0,
          radius: 0,
          angle: 0,
          originalY: depthCoord,
        });
      }

      // 2. Patrolling dangerous sharks
      for (let i = 0; i < 6; i++) {
        const group = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4 });
        
        // Sleek wedge body
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.35, 1.3), bodyMat);
        group.add(body);

        // Dorsal fin
        const fin = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 4), bodyMat);
        fin.position.set(0, 0.3, 0.1);
        group.add(fin);

        // Angry eyes
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xff0000, emissiveIntensity: 0.5 });
        const lEye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 4), eyeMat);
        lEye.position.set(-0.18, 0.08, 0.55);
        const rEye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 4), eyeMat);
        rEye.position.set(0.18, 0.08, 0.55);
        group.add(lEye);
        group.add(rEye);

        const depthCoord = -Math.random() * 100 - 10;
        const radius = Math.random() * 40 + 12;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 0.4 + 0.25;

        group.position.set(Math.sin(angle) * radius, depthCoord, -1500 + Math.cos(angle) * radius);
        scene.add(group);

        hazards.push({
          id: `shark-${i}`,
          type: 'shark',
          mesh: group,
          health: 3,
          speed,
          radius,
          angle,
          originalY: depthCoord,
        });
      }
    };

    spawnHazards();

    // --- THIRD-PERSON CAMERA INTERACTIVE SYSTEM ---
    const cameraState = {
      theta: 0.8, // Horizontal orbit angle
      phi: 0.35,   // Vertical pitch orbit angle
      distance: 7.5,
      isDragging: false,
      prevX: 0,
      prevY: 0,
    };

    // Initialize camera position and target immediately so there's no drift/jump from (0,0,0) to player's starting Z = -1500
    const initialCx = playerPos.x + Math.sin(cameraState.theta) * Math.cos(cameraState.phi) * cameraState.distance;
    const initialCy = playerPos.y + Math.sin(cameraState.phi) * cameraState.distance + 0.5;
    const initialCz = playerPos.z + Math.cos(cameraState.theta) * Math.cos(cameraState.phi) * cameraState.distance;
    camera.position.set(initialCx, initialCy, initialCz);
    camera.lookAt(playerPos.x, playerPos.y + 0.3, playerPos.z);

    const handlePointerDown = (e: PointerEvent) => {
      if (e.target !== canvas) return;

      // Prop placement left click confirmation
      if (activePlacementProp && ghostPropMesh && e.button === 0) {
        e.preventDefault();

        // Switch ghost material to full opacity
        ghostPropMesh.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.material) {
              const mat = child.material as THREE.MeshStandardMaterial;
              mat.transparent = false;
              mat.opacity = 1.0;
              mat.needsUpdate = true;
            }
          }
        });

        // Detach from scene and permanently attach to raftGroup
        scene.remove(ghostPropMesh);

        // Calculate snap local coords relative to raftGroup position
        const localX = ghostPropMesh.position.x - raftGroup.position.x;
        const localZ = ghostPropMesh.position.z - raftGroup.position.z;

        // Position neatly on the raft deck height
        ghostPropMesh.position.set(localX, 0.1, localZ);
        raftGroup.add(ghostPropMesh);

        const propLabel = 
          activePlacementProp === 'campfire' ? 'Campfire' :
          activePlacementProp === 'chest' ? 'Wooden Chest' :
          activePlacementProp === 'bed_straw' ? 'Basic Straw Bed' :
          activePlacementProp === 'hammock_luxury' ? 'Luxury Hammock' :
          activePlacementProp === 'spikes_wood' ? 'Wooden Spikes' :
          activePlacementProp === 'spikes_iron' ? 'Scrap-Metal Barbs' :
          activePlacementProp === 'smelter_furnace' ? 'Blast Furnace' :
          activePlacementProp === 'magnet_buoy' ? 'Magnet Buoy' :
          activePlacementProp === 'oxygen_line' ? 'Oxygen Line Reel' : 'Structure';

        addLog(`🔨 PLACED ${propLabel.toUpperCase()} at relative coordinates (${localX.toFixed(1)}, ${localZ.toFixed(1)})!`);
        audioSynth.playPickup();

        if (activePlacementProp === 'campfire') {
          const campfireLight = new THREE.PointLight(0xff7700, 0, 5); // Start UNLIT (0 intensity)
          campfireLight.position.set(0, 0.4, 0);
          ghostPropMesh.add(campfireLight);
          
          ghostPropMesh.userData = {
            isLit: false,
            cookingTimer: null,
            id: Date.now()
          };
          
          placedCampfires.push({ mesh: ghostPropMesh, light: campfireLight });
        } else if (activePlacementProp === 'chest') {
          const chestId = Date.now();
          const newChest = {
            id: chestId,
            x: localX,
            z: localZ,
            mesh: ghostPropMesh,
            inventory: {
              driftwood: 0,
              stones: 0,
              scrapMetal: 0,
              cobalt: 0,
              seaGlass: 0,
              biomass: 0,
              food: 0,
              kelpFiber: 0,
              volcanic: 0,
              treasure: 0,
              rawFood: 0,
              cookedFood: 0,
            }
          };
          placedChestsRef.current.push(newChest);
          setPlacedChestsState((prev) => [
            ...prev,
            { id: chestId, x: localX, z: localZ, inventory: newChest.inventory },
          ]);
        } else if (activePlacementProp === 'bed_straw' || activePlacementProp === 'hammock_luxury') {
          placedBeds.push({ mesh: ghostPropMesh, type: activePlacementProp });
          placedBedsRef.current.push({
            id: Date.now(),
            x: localX,
            z: localZ,
            type: activePlacementProp,
            mesh: ghostPropMesh,
          });
        } else if (activePlacementProp === 'smelter_furnace') {
          placedSmelters.push({ mesh: ghostPropMesh });
          placedSmeltersRef.current.push({
            id: Date.now(),
            x: localX,
            z: localZ,
            mesh: ghostPropMesh,
          });
        } else if (activePlacementProp === 'spikes_wood' || activePlacementProp === 'spikes_iron') {
          placedSpikes.push({ mesh: ghostPropMesh, type: activePlacementProp });
          placedSpikesRef.current.push({
            id: Date.now(),
            x: localX,
            z: localZ,
            type: activePlacementProp,
            mesh: ghostPropMesh,
          });
        } else if (activePlacementProp === 'magnet_buoy') {
          placedMagnets.push({ mesh: ghostPropMesh });
          placedMagnetsRef.current.push({
            id: Date.now(),
            x: localX,
            z: localZ,
            mesh: ghostPropMesh,
          });
        } else if (activePlacementProp === 'oxygen_line') {
          placedOxygenLines.push({ mesh: ghostPropMesh });
          placedOxygenLinesRef.current.push({
            id: Date.now(),
            x: localX,
            z: localZ,
            mesh: ghostPropMesh,
          });
        } else if ([
          'raft_sail', 'anchor', 'steering_wheel', 'water_purifier', 'advanced_smelter', 'crop_plot', 'research_table', 'wooden_chair', 'wooden_table', 'standing_lantern', 'crew_bed'
        ].includes(activePlacementProp)) {
          const structType = activePlacementProp;
          const structId = Date.now();
          const initialState: any = {};
          
          if (structType === 'raft_sail') {
            placedSails.push({ mesh: ghostPropMesh });
          } else if (structType === 'anchor') {
            initialState.deployed = false;
            placedAnchors.push({ mesh: ghostPropMesh, deployed: false });
          } else if (structType === 'steering_wheel') {
            placedSteeringWheels.push({ mesh: ghostPropMesh });
          } else if (structType === 'water_purifier') {
            initialState.timer = 0;
            initialState.water = 0.0;
            placedWaterPurifiers.push({ mesh: ghostPropMesh, timer: 0, waterLevel: 0.0 });
          } else if (structType === 'advanced_smelter') {
            placedAdvancedSmelters.push({ mesh: ghostPropMesh });
          } else if (structType === 'crop_plot') {
            initialState.planted = false;
            initialState.ready = false;
            initialState.growTimer = 0;
            placedCropPlots.push({ mesh: ghostPropMesh, seedPlanted: false, growTimer: 0, cropReady: false });
          } else if (structType === 'research_table') {
            placedResearchTables.push({ mesh: ghostPropMesh });
          } else if (structType === 'wooden_chair') {
            placedChairs.push({ mesh: ghostPropMesh });
          } else if (structType === 'wooden_table') {
            placedTables.push({ mesh: ghostPropMesh });
          } else if (structType === 'standing_lantern') {
            const lanternLight = new THREE.PointLight(0xfef08a, 0, 8);
            lanternLight.position.set(0, 1.4, 0);
            ghostPropMesh.add(lanternLight);
            placedLanterns.push({ mesh: ghostPropMesh, light: lanternLight });
          } else if (structType === 'crew_bed') {
            placedCrewBeds.push({ mesh: ghostPropMesh });
          }

          placedCustomStructuresRef.current.push({
            id: structId,
            x: localX,
            z: localZ,
            type: structType as any,
            mesh: ghostPropMesh,
            state: initialState,
          });
        }

        activePlacementProp = null;
        ghostPropMesh = null;
        return;
      }

      // In placement mode, left click to construct a raft tile
      if (isPlacementModeRef.current && e.button === 0) {
        e.preventDefault();
        const { snapX, snapZ } = getSnapPosition();
        const currentRes = resourcesRef.current;
        const currentCost = getNextTileCost();
        if ((currentRes.driftwood || 0) < currentCost) {
          addLog(`⚠️ INSUFFICIENT MATERIALS: Requires ${currentCost}x Driftwood to construct a new raft tile!`);
          audioSynth.playPing();
          return;
        }

        if (totalTilesBuilt >= 25 && (currentRes.titaniumBracket || 0) < 1) {
          displayNotification("Raft too unstable! You need a Titanium Bracket to expand further.");
          addLog("⚠️ RAFT UNSTABLE: Reached the 25-tile structural stability limit! Further modular deck expansion requires 1x Titanium Bracket.");
          audioSynth.playPing();
          return;
        }

        const tileExists = raftTiles.some(tile => Math.abs(tile.x - snapX) < 0.1 && Math.abs(tile.z - snapZ) < 0.1);
        if (tileExists) {
          addLog("⚠️ ALREADY BUILT: A raft tile already occupies this space!");
          audioSynth.playPing();
          return;
        }

        setResources((prev) => ({
          ...prev,
          driftwood: Math.max(0, (prev.driftwood || 0) - currentCost),
          titaniumBracket: totalTilesBuilt >= 25 ? Math.max(0, (prev.titaniumBracket || 0) - 1) : (prev.titaniumBracket || 0),
        }));

        const newMesh = createTileMesh(snapX, snapZ);
        raftGroup.add(newMesh);
        raftTiles.push({ x: snapX, z: snapZ, mesh: newMesh });

        totalTilesBuilt++;
        setTotalTilesCount(totalTilesBuilt);

        addLog(`🔨 CONSTRUCTED RAFT TILE: Expanded the deck at relative coords (${snapX}, ${snapZ})! (Next Tile Cost: ${getNextTileCost()} Driftwood)`);
        audioSynth.playPickup();
        return;
      }

      // Left-Click weapon attacks
      if (e.button === 0 && !activePlacementProp && !isPlacementModeRef.current) {
        const currentEquippedWeapon = equippedItemsRef.current.weapon;
        if (currentEquippedWeapon === 'item_spear' || currentEquippedWeapon === 'huntingBowSpear') {
          // SPEAR MELEE ATTACK
          spearThrustTime = 0.25; // 0.25 seconds duration
          audioSynth.playPickup(); // play sound effect!
          
          // Cast short-range forward raycaster
          const raycaster = new THREE.Raycaster();
          const dir = new THREE.Vector3();
          camera.getWorldDirection(dir);
          
          const startPos = new THREE.Vector3(playerPos.x, playerPos.y + 0.5, playerPos.z);
          raycaster.set(startPos, dir);
          raycaster.far = 4.0;
          
          const targetsToIntersect: THREE.Object3D[] = [];
          if (sharkHealth > 0 && !isSharkDead && apexSharkGroup) {
            targetsToIntersect.push(apexSharkGroup);
          }
          islandEnemies.forEach((skeleton) => {
            if (skeleton.health > 0) {
              targetsToIntersect.push(skeleton.mesh);
            }
          });

          const intersects = raycaster.intersectObjects(targetsToIntersect, true);
          if (intersects.length > 0) {
            let hitObject = intersects[0].object;
            let parentSkeletonId: string | null = null;
            let isSkeletonHit = false;

            let temp: THREE.Object3D | null = hitObject;
            while (temp) {
              if (temp.userData && temp.userData.type === 'skeleton') {
                parentSkeletonId = temp.userData.parentId || temp.userData.id;
                isSkeletonHit = true;
                break;
              }
              temp = temp.parent;
            }

            if (isSkeletonHit && parentSkeletonId) {
              const skeletonIdx = islandEnemies.findIndex(s => s.id === parentSkeletonId);
              if (skeletonIdx !== -1) {
                const skeleton = islandEnemies[skeletonIdx];
                skeleton.health -= 25;
                if (!skeleton.aggroTable) {
                  skeleton.aggroTable = {};
                }
                skeleton.aggroTable['player'] = (skeleton.aggroTable['player'] || 0) + 35;
                addLog(`💥 SPEAR STRIKE: Thrusted and hit a skeleton! Skeleton Health: ${skeleton.health}/50`);
                createDamageSplash(intersects[0].point);

                if (skeleton.health <= 0) {
                  scene.remove(skeleton.mesh);
                  islandEnemies.splice(skeletonIdx, 1);

                  // Drop reward
                  const lootChoice = Math.random();
                  const dropChance = Math.random();
                  let bonusBracket = 0;
                  let bonusCore = 0;
                  if (dropChance <= 0.005) {
                    bonusCore = 1;
                    displayNotification("👑 LEGENDARY DROP! Found a Skeleton King Core!");
                    addLog("👑 LEGENDARY DROP! Found a Skeleton King Core! (0.5% Chance)");
                  } else if (dropChance <= 0.02) {
                    bonusBracket = 1;
                    displayNotification("💎 MYTHIC DROP! Found a Titanium Bracket!");
                    addLog("💎 MYTHIC DROP! Found a Titanium Bracket! (2.0% Chance)");
                  }

                  if (lootChoice < 0.5) {
                    setResources(prev => ({
                      ...prev,
                      driftwood: (prev.driftwood || 0) + 2,
                      titaniumBracket: (prev.titaniumBracket || 0) + bonusBracket,
                      skeletonKingCore: (prev.skeletonKingCore || 0) + bonusCore,
                    }));
                    displayNotification("🎁 Defeated Skeleton: Dropped +2 Driftwood!");
                    addLog("🦴 SKELETON DESTROYED: Bone dust scattered! Retrieved +2x Driftwood from the remains.");
                  } else if (lootChoice < 0.8) {
                    setResources(prev => ({
                      ...prev,
                      stones: (prev.stones || 0) + 1,
                      titaniumBracket: (prev.titaniumBracket || 0) + bonusBracket,
                      skeletonKingCore: (prev.skeletonKingCore || 0) + bonusCore,
                    }));
                    displayNotification("🎁 Defeated Skeleton: Dropped +1 Stone!");
                    addLog("🦴 SKELETON DESTROYED: Shattered! Retrieved +1x Ancient Stone.");
                  } else {
                    setResources(prev => ({
                      ...prev,
                      rope: (prev.rope || 0) + 1,
                      titaniumBracket: (prev.titaniumBracket || 0) + bonusBracket,
                      skeletonKingCore: (prev.skeletonKingCore || 0) + bonusCore,
                    }));
                    displayNotification("🎁 Defeated Skeleton: Dropped +1 Rare Rope!");
                    addLog("🦴 SKELETON DESTROYED: Shattered! Retrieved +1x Rare Rope!");
                  }
                }
              }
            } else if (apexSharkGroup && (hitObject === apexSharkGroup || apexSharkGroup.getObjectById(hitObject.id))) {
              sharkHealth = Math.max(0, sharkHealth - 25);
              addLog(`💥 SPEAR STRIKE: Thrusted and hit the shark! Shark Health: ${sharkHealth}/100`);
              createDamageSplash(intersects[0].point);
            } else {
              addLog("🔱 MELEE SWING: Thrusted into something else.");
            }
          } else {
            addLog("🔱 MELEE SWING: Thrusted your spear into empty air.");
          }
          return;
        } else if (currentEquippedWeapon === 'item_bow') {
          // BOW RANGE PROJECTILES
          audioSynth.playPickup(); // play sound effect!
          
          const startPos = new THREE.Vector3(playerPos.x, playerPos.y + 0.5, playerPos.z);
          const arrowMesh = createArrowMesh();
          arrowMesh.position.copy(startPos);
          
          const dir = new THREE.Vector3();
          camera.getWorldDirection(dir);
          dir.normalize();
          
          const targetLook = new THREE.Vector3().addVectors(startPos, dir);
          arrowMesh.lookAt(targetLook);
          
          scene.add(arrowMesh);
          activeArrows.push({
            mesh: arrowMesh,
            direction: dir,
            createdAt: Date.now(),
          });
          
          addLog("🏹 BOW SHOT: Fired an arrow!");
          return;
        }
      }

      cameraState.isDragging = true;
      cameraState.prevX = e.clientX;
      cameraState.prevY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!cameraState.isDragging) return;
      const dx = e.clientX - cameraState.prevX;
      const dy = e.clientY - cameraState.prevY;

      cameraState.theta -= dx * 0.006;
      cameraState.phi = Math.max(-0.9, Math.min(1.4, cameraState.phi + dy * 0.006));

      cameraState.prevX = e.clientX;
      cameraState.prevY = e.clientY;
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (cameraState.isDragging) {
        cameraState.isDragging = false;
        canvas.releasePointerCapture(e.pointerId);
      }
    };

    const mouse2D = new THREE.Vector2();
    const onMouseMove = (e: MouseEvent) => {
      mouse2D.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse2D.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', onMouseMove);

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerUp);

    // --- BEAUTIFUL LOW-POLY ATMOSPHERIC CLOUDS ---
    const cloudsGroup = new THREE.Group();
    scene.add(cloudsGroup);
    const cloudsList: THREE.Group[] = [];

    const createCloud = (x: number, y: number, z: number) => {
      const cloud = new THREE.Group();
      const cloudMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.95,
        metalness: 0.05,
        flatShading: true,
      });

      // Construct a beautiful puffy low-poly cloud out of several merged box elements
      const numPuffs = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < numPuffs; i++) {
        const w = 4 + Math.random() * 5;
        const h = 2 + Math.random() * 2.5;
        const d = 3 + Math.random() * 4;
        const puffMesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), cloudMat);
        puffMesh.position.set(
          (i - numPuffs / 2) * 2.8 + (Math.random() * 1.5 - 0.75),
          Math.random() * 0.8,
          Math.random() * 1.5 - 0.75
        );
        puffMesh.castShadow = true;
        puffMesh.receiveShadow = true;
        cloud.add(puffMesh);
      }

      cloud.position.set(x, y, z);
      cloudsGroup.add(cloud);
      cloudsList.push(cloud);
    };

    // Scatter 15 beautiful puffy clouds across the sky
    for (let i = 0; i < 15; i++) {
      const cx = Math.random() * 320 - 160;
      const cy = 25 + Math.random() * 15; // float high up in the sky
      const cz = Math.random() * 320 - 160;
      createCloud(cx, cy, cz);
    }

    // --- APEX HUNTING SHARK ---
    const apexSharkGroup = new THREE.Group();
    let sharkAIState = 0; // 0: CRUISE, 1: HUNT, 2: DAMAGE_CHARGE
    let sharkAIAngle = 0;

    const buildApexShark = () => {
      while (apexSharkGroup.children.length > 0) {
        apexSharkGroup.remove(apexSharkGroup.children[0]);
      }

      // Add a simple temporary fallback immediately so the game is active before GLTF loads
      const tempGeom = new THREE.ConeGeometry(0.35, 2.5, 8);
      tempGeom.rotateX(Math.PI / 2);
      const tempMat = new THREE.MeshStandardMaterial({ color: 0x2d3c4a, roughness: 0.5, flatShading: true });
      const tempMesh = new THREE.Mesh(tempGeom, tempMat);
      tempMesh.castShadow = true;
      tempMesh.receiveShadow = true;
      apexSharkGroup.add(tempMesh);

      // 1. INSTANTIATE GLTFLOADER
      const loader = new GLTFLoader();

      // 2. LOAD FREE SHARK GLTF MODEL AS REQUESTED
      loader.load(
        'https://assets.babylonjs.com/meshes/shark.glb',
        (gltf) => {
          // Clear any initial or fallback meshes inside apexSharkGroup
          while (apexSharkGroup.children.length > 0) {
            apexSharkGroup.remove(apexSharkGroup.children[0]);
          }

          const sharkMesh = gltf.scene;

          // Compute BoundingBox to auto-scale perfectly to look imposing and match our world size
          const box = new THREE.Box3().setFromObject(sharkMesh);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          // Standard scale of our previous custom shark is about 2.8 meters long
          const targetLength = 3.0; 
          const scaleFactor = targetLength / (maxDim || 1);
          sharkMesh.scale.set(scaleFactor, scaleFactor, scaleFactor);

          // Correct orientation so it faces the correct direction in Three.js coordinates
          sharkMesh.rotation.y = 0; // The BabylonJS model natively faces forward (+Z), matching standard lookAt heading!

          // Enable shadows and configure high-quality low-poly shading on all materials
          sharkMesh.traverse((child: any) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (child.material) {
                child.material.roughness = 0.5;
                child.material.metalness = 0.15;
                child.material.flatShading = true; // Low-poly flat shading look
                child.material.needsUpdate = true;
              }
            }
          });

          // Add to our main movement/AI group so the existing loop drives it perfectly!
          apexSharkGroup.add(sharkMesh);
          console.log("GLTF Shark model successfully loaded from BabylonJS assets and linked to the AI system!");
        },
        undefined,
        (error) => {
          console.error("Could not load online GLTF shark model, using minimal robust fallback:", error);
          // Minimal crash-proof fallback representation (simple cone) to avoid empty screens
          const fallbackGeom = new THREE.ConeGeometry(0.35, 2.5, 8);
          fallbackGeom.rotateX(Math.PI / 2); // align along Z
          const fallbackMat = new THREE.MeshStandardMaterial({ 
            color: 0x2d3c4a, 
            roughness: 0.5, 
            flatShading: true 
          });
          const fallbackMesh = new THREE.Mesh(fallbackGeom, fallbackMat);
          apexSharkGroup.add(fallbackMesh);
        }
      );

      // Initial position: set its initial spawn position deep in the water (Y = -5) near the raft
      apexSharkGroup.position.set(raftGroup.position.x + 8, -5, raftGroup.position.z + 8);
      scene.add(apexSharkGroup);
    };

    buildApexShark();

    // Combat and Weapons tracking variables
    let spearThrustTime = 0;
    let sharkHealth = 100;
    let isSharkDead = false;
    const activeArrows: {
      mesh: THREE.Mesh;
      direction: THREE.Vector3;
      createdAt: number;
    }[] = [];
    
    const activeBloodEffects: {
      group: THREE.Group;
      particles: {
        mesh: THREE.Mesh;
        speedY: number;
        speedX: number;
        speedZ: number;
        life: number;
      }[];
      createdAt: number;
    }[] = [];

    const createDamageSplash = (point: THREE.Vector3) => {
      const splashGroup = new THREE.Group();
      splashGroup.position.copy(point);
      scene.add(splashGroup);

      const particles: any[] = [];
      const geom = new THREE.SphereGeometry(0.04, 4, 4);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff0000, // Bright Red
        transparent: true,
        opacity: 0.9,
      });

      for (let i = 0; i < 12; i++) {
        const mesh = new THREE.Mesh(geom, mat.clone());
        mesh.position.set(
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1
        );
        splashGroup.add(mesh);
        particles.push({
          mesh,
          speedY: (Math.random() - 0.3) * 1.5,
          speedX: (Math.random() - 0.5) * 2.0,
          speedZ: (Math.random() - 0.5) * 2.0,
          life: 1.0,
        });
      }

      activeBloodEffects.push({
        group: splashGroup,
        particles,
        createdAt: Date.now(),
      });
    };

    const createArrowMesh = () => {
      const arrowGroup = new THREE.Mesh(
        new THREE.CylinderGeometry(0.005, 0.005, 0.4, 4),
        new THREE.MeshStandardMaterial({ color: 0xd2b48c, roughness: 0.8 })
      );
      arrowGroup.rotateX(Math.PI / 2);
      
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.012, 0.05, 4),
        new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.8 })
      );
      tip.position.y = 0.2;
      arrowGroup.add(tip);
      
      return arrowGroup;
    };

    // --- TICK & FRAME ITERATIONS ---
    let lastTime = performance.now();
    let frameId: number;

    const renderWorldMap = () => {
      const canvas = document.getElementById('world-radar-canvas') as HTMLCanvasElement | null;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const raft = raftGroupRef.current;
      if (!raft) return;

      const rx = raft.position.x;
      const rz = raft.position.z;

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Draw background sonar rings / grid
      ctx.strokeStyle = 'rgba(0, 245, 255, 0.08)';
      ctx.lineWidth = 1;

      // Concentric circles
      const cx = width / 2;
      const cy = height / 2;
      for (let r = 40; r < Math.max(width, height); r += 40) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw crosshairs
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(width, cy);
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, height);
      ctx.stroke();

      // Cardinal direction indicators
      ctx.fillStyle = 'rgba(0, 245, 255, 0.4)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('N', cx, 12);
      ctx.fillText('S', cx, height - 4);
      ctx.fillText('W', 12, cy + 3);
      ctx.fillText('E', width - 12, cy + 3);

      // Sonar sweep simulation
      const angleSweep = (Date.now() * 0.001) % (Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 245, 255, 0.1)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angleSweep) * 200, cy + Math.sin(angleSweep) * 200);
      ctx.stroke();

      // Center: RAFT (cyan flashing triangle)
      const flash = 0.6 + 0.4 * Math.sin(Date.now() * 0.01);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = `rgba(0, 245, 255, ${flash})`;
      ctx.shadowBlur = 12;
      ctx.shadowColor = "#00f5ff";
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(-6, 6);
      ctx.lineTo(6, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Helper function to draw star
      const drawStar = (c: CanvasRenderingContext2D, sx: number, sy: number, spikes: number, outerRadius: number, innerRadius: number) => {
        let rot = Math.PI / 2 * 3;
        let x = sx;
        let y = sy;
        let step = Math.PI / spikes;

        c.beginPath();
        c.moveTo(sx, sy - outerRadius);
        for (let i = 0; i < spikes; i++) {
          x = sx + Math.cos(rot) * outerRadius;
          y = sy + Math.sin(rot) * outerRadius;
          c.lineTo(x, y);
          rot += step;

          x = sx + Math.cos(rot) * innerRadius;
          y = sy + Math.sin(rot) * innerRadius;
          c.lineTo(x, y);
          rot += step;
        }
        c.lineTo(sx, sy - outerRadius);
        c.closePath();
        c.fillStyle = "#f59e0b"; // Gold color
        c.shadowColor = "#f59e0b";
        c.shadowBlur = 12;
        c.fill();

        // Draw text label
        c.fillStyle = "rgba(245, 158, 11, 0.8)";
        c.font = "8px monospace";
        c.textAlign = "center";
        c.fillText(`MYTHIC RUIN`, sx, sy - 12);
      };

      // Plot generated islands
      const scaleFactor = 0.35; // Map coordinate space to canvas size
      GLOBAL_ISLAND_LOCATIONS.forEach((island, idx) => {
        let relativeX = (island.x - rx) * scaleFactor;
        let relativeZ = (island.z - rz) * scaleFactor;

        // If the calculated offsets fit within the radar view boundaries, render blip
        const canvasX = cx + relativeX;
        const canvasY = cy + relativeZ;

        // Check if within radar view boundaries (with 10px margin safety)
        if (canvasX >= 10 && canvasX <= width - 10 && canvasY >= 10 && canvasY <= height - 10) {
          const isRare = idx % 2 === 1; // Island 2 and 4 are rare chest islands
          if (isRare) {
            // Glowing gold star blip (rare chest islands)
            drawStar(ctx, canvasX, canvasY, 5, 8, 4);
          } else {
            // Distinct solid green circular blip (regular skeleton islands)
            ctx.save();
            ctx.fillStyle = "#10b981"; // Solid green
            ctx.shadowColor = "#10b981";
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(canvasX, canvasY, 6, 0, Math.PI * 2);
            ctx.fill();

            // Draw small text label for island index or designation
            ctx.fillStyle = "rgba(16, 185, 129, 0.8)";
            ctx.font = "8px monospace";
            ctx.textAlign = "center";
            ctx.fillText(`ISLAND ${idx + 1}`, canvasX, canvasY - 10);
            ctx.restore();
          }
        }
      });

      // Update the coordinates text at the base of the radar map
      const coordsTextEl = document.getElementById('radar-coords-text');
      if (coordsTextEl) {
        coordsTextEl.innerText = "RAFT COORDS: X: " + Math.floor(rx) + " | Z: " + Math.floor(rz);
      }
    };

    const tick = () => {
      frameId = requestAnimationFrame(tick);

      const currentTime = performance.now();
      let dt = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      // Update Screen Compass HUD
      const compassEl = document.getElementById('hud-compass-widget');
      if (compassEl && camera) {
        let angleRad = camera.rotation.y;
        let degrees = (angleRad * 180 / Math.PI) % 360;
        if (degrees < 0) degrees += 360;
        const dir = getCardinalDirection(degrees);
        compassEl.innerText = `${dir}\n${Math.floor(degrees)}°`;
      }

      // Update Interactive Radar World Map (if active)
      renderWorldMap();

      if (showMarketplaceRef.current) {
        dt = 0;
      }

      // --- WEAPONS, PROJECTILES & COMBAT FX UPDATES ---
      
      // 1. Spear thrust animation progress
      if (spearThrustTime > 0) {
        spearThrustTime -= dt;
        const currentEquippedWeapon = equippedItemsRef.current.weapon;
        if (axeMesh && (currentEquippedWeapon === 'item_spear' || currentEquippedWeapon === 'huntingBowSpear')) {
          const progress = (0.25 - spearThrustTime) / 0.25;
          const offsetZ = Math.sin(progress * Math.PI) * 0.45; // forward thrust offset
          axeMesh.position.set(0.24, 0.28, 0.12 - offsetZ);
        }
      } else {
        const currentEquippedWeapon = equippedItemsRef.current.weapon;
        if (axeMesh && (currentEquippedWeapon === 'item_spear' || currentEquippedWeapon === 'huntingBowSpear')) {
          axeMesh.position.set(0.24, 0.28, 0.12);
        }
      }

      // 2. Flying Bow arrows update and collision check with shark/skeletons
      for (let i = activeArrows.length - 1; i >= 0; i--) {
        const arrow = activeArrows[i];
        const age = (Date.now() - arrow.createdAt) / 1000;
        
        if (age > 5.0) {
          scene.remove(arrow.mesh);
          arrow.mesh.geometry.dispose();
          if (Array.isArray(arrow.mesh.material)) {
            arrow.mesh.material.forEach(m => m.dispose());
          } else {
            arrow.mesh.material.dispose();
          }
          activeArrows.splice(i, 1);
        } else {
          // Fly forward
          arrow.mesh.position.addScaledVector(arrow.direction, 18.0 * dt);
          
          let arrowDisposed = false;

          // Collision check against island enemies (skeletons)
          let skeletonHitIdx = -1;
          for (let sIdx = 0; sIdx < islandEnemies.length; sIdx++) {
            const skeleton = islandEnemies[sIdx];
            const distToSkeleton = arrow.mesh.position.distanceTo(skeleton.mesh.position);
            // Skeletons stand about 1.8 units tall, so a bounding sphere of 1.25 is perfect
            if (distToSkeleton < 1.25) {
              skeletonHitIdx = sIdx;
              break;
            }
          }

          if (skeletonHitIdx !== -1) {
            const skeleton = islandEnemies[skeletonHitIdx];
            skeleton.health -= 25; // Arrow hits for 25 damage!
            if (!skeleton.aggroTable) {
              skeleton.aggroTable = {};
            }
            skeleton.aggroTable['player'] = (skeleton.aggroTable['player'] || 0) + 35;
            addLog(`🏹 BOW DIRECT HIT: Arrow pierced a skeleton! Skeleton Health: ${skeleton.health}/50`);
            createDamageSplash(arrow.mesh.position);

            // Dispose arrow
            scene.remove(arrow.mesh);
            arrow.mesh.geometry.dispose();
            if (Array.isArray(arrow.mesh.material)) {
              arrow.mesh.material.forEach(m => m.dispose());
            } else {
              arrow.mesh.material.dispose();
            }
            activeArrows.splice(i, 1);
            arrowDisposed = true;

            // Check if skeleton died
            if (skeleton.health <= 0) {
              scene.remove(skeleton.mesh);
              islandEnemies.splice(skeletonHitIdx, 1);
              
              // Drop reward
              const lootChoice = Math.random();
              const dropChance = Math.random();
              let bonusBracket = 0;
              let bonusCore = 0;
              if (dropChance <= 0.005) {
                bonusCore = 1;
                displayNotification("👑 LEGENDARY DROP! Found a Skeleton King Core!");
                addLog("👑 LEGENDARY DROP! Found a Skeleton King Core! (0.5% Chance)");
              } else if (dropChance <= 0.02) {
                bonusBracket = 1;
                displayNotification("💎 MYTHIC DROP! Found a Titanium Bracket!");
                addLog("💎 MYTHIC DROP! Found a Titanium Bracket! (2.0% Chance)");
              }

              if (lootChoice < 0.5) {
                setResources(prev => ({
                  ...prev,
                  driftwood: (prev.driftwood || 0) + 2,
                  titaniumBracket: (prev.titaniumBracket || 0) + bonusBracket,
                  skeletonKingCore: (prev.skeletonKingCore || 0) + bonusCore,
                }));
                displayNotification("🎁 Defeated Skeleton: Dropped +2 Driftwood!");
                addLog("🦴 SKELETON DESTROYED: Shattered! Retrieved +2x Driftwood from the remains.");
              } else if (lootChoice < 0.8) {
                setResources(prev => ({
                  ...prev,
                  stones: (prev.stones || 0) + 1,
                  titaniumBracket: (prev.titaniumBracket || 0) + bonusBracket,
                  skeletonKingCore: (prev.skeletonKingCore || 0) + bonusCore,
                }));
                displayNotification("🎁 Defeated Skeleton: Dropped +1 Stone!");
                addLog("🦴 SKELETON DESTROYED: Shattered! Retrieved +1x Ancient Stone.");
              } else {
                setResources(prev => ({
                  ...prev,
                  rope: (prev.rope || 0) + 1,
                  titaniumBracket: (prev.titaniumBracket || 0) + bonusBracket,
                  skeletonKingCore: (prev.skeletonKingCore || 0) + bonusCore,
                }));
                displayNotification("🎁 Defeated Skeleton: Dropped +1 Rare Rope!");
                addLog("🦴 SKELETON DESTROYED: Shattered! Retrieved +1x Rare Rope!");
              }
            }
          }

          // Collision check against apexSharkGroup if arrow wasn't already disposed
          if (!arrowDisposed && sharkHealth > 0 && !isSharkDead && apexSharkGroup) {
            const distToShark = arrow.mesh.position.distanceTo(apexSharkGroup.position);
            // Shark bounding sphere radius of ~1.6 is great for our 3-meter scale
            if (distToShark < 1.6) {
              sharkHealth = Math.max(0, sharkHealth - 15);
              addLog(`💥 BOW DIRECT HIT: Arrow pierced the shark! Shark Health: ${sharkHealth}/100`);
              createDamageSplash(arrow.mesh.position);
              
              scene.remove(arrow.mesh);
              arrow.mesh.geometry.dispose();
              if (Array.isArray(arrow.mesh.material)) {
                arrow.mesh.material.forEach(m => m.dispose());
              } else {
                arrow.mesh.material.dispose();
              }
              activeArrows.splice(i, 1);
            }
          }
        }
      }

      // 3. Falling blood particles update
      for (let i = activeBloodEffects.length - 1; i >= 0; i--) {
        const effect = activeBloodEffects[i];
        const age = (Date.now() - effect.createdAt) / 1000;
        if (age > 1.2) {
          scene.remove(effect.group);
          effect.group.traverse((c) => {
            if (c instanceof THREE.Mesh) {
              c.geometry.dispose();
              if (Array.isArray(c.material)) {
                c.material.forEach((m) => m.dispose());
              } else {
                c.material.dispose();
              }
            }
          });
          activeBloodEffects.splice(i, 1);
        } else {
          effect.particles.forEach((p) => {
            p.mesh.position.x += p.speedX * dt;
            p.mesh.position.y += p.speedY * dt;
            p.mesh.position.z += p.speedZ * dt;
            p.speedY -= 3.0 * dt; // gravity
            if (p.mesh.material && !Array.isArray(p.mesh.material)) {
              p.mesh.material.opacity = Math.max(0, 1.0 - age / 1.2);
            }
          });
        }
      }

      // 4. Animate Rare Chests opening
      rareChests.forEach((chest) => {
        if (chest.opened && chest.openProgress < 1.0) {
          chest.openProgress = Math.min(1.0, chest.openProgress + 2.5 * dt);
          // Rotate lid backwards around local X-axis
          chest.lidMesh.rotation.x = -1.9 * chest.openProgress;
        }
      });

      // 5. Update Island Enemies (Skeletons) AI & Animations
      islandEnemies.forEach((skeleton) => {
        // Resolve all active potential targets in the game space
        const targets: { id: string; name: string; position: THREE.Vector3; isPlayer: boolean }[] = [
          { id: 'player', name: 'Player', position: playerPos, isPlayer: true }
        ];

        // Simulate other potential targets (such as Co-op Player 2 and an NPC Deckhand companion)
        // to demonstrate multiplayer & NPC aggro preference logic!
        const simulatedPlayer2Pos = new THREE.Vector3(playerPos.x + 12, playerPos.y, playerPos.z + 12);
        const simulatedNPCPos = new THREE.Vector3(playerPos.x - 6, playerPos.y, playerPos.z + 6);
        targets.push({ id: 'player2', name: 'Player 2 (Teammate)', position: simulatedPlayer2Pos, isPlayer: true });
        targets.push({ id: 'companion', name: 'Deckhand Companion', position: simulatedNPCPos, isPlayer: false });

        // Find the nearest player among all player targets to apply the "nearest player preference" bonus
        let nearestPlayerId = '';
        let minPlayerDist = Infinity;
        targets.forEach((t) => {
          if (t.isPlayer) {
            const d = t.position.distanceTo(skeleton.mesh.position);
            if (d < minPlayerDist) {
              minPlayerDist = d;
              nearestPlayerId = t.id;
            }
          }
        });

        let highestAggro = -1;
        let selectedTarget: typeof targets[0] | null = null;

        if (!skeleton.aggroTable) {
          skeleton.aggroTable = {};
        }

        // Evaluate aggro scores for each candidate target
        targets.forEach((t) => {
          const dist = t.position.distanceTo(skeleton.mesh.position);

          // Proximity aggro component (within 20 meters detection radius)
          let proximityAggro = 0;
          if (dist < 20.0) {
            proximityAggro = (20.0 - dist) * 2.0; // scales up to 40.0 aggro
          }

          // Damage-induced aggro component from the persistent aggro table
          const damageAggro = skeleton.aggroTable?.[t.id] || 0;

          // Preference multipliers: players are naturally preferred, and the nearest player gets a critical bonus
          let preferenceBonus = 0;
          if (t.isPlayer) {
            preferenceBonus += 5.0; // General player attraction
            if (t.id === nearestPlayerId) {
              preferenceBonus += 15.0; // Strongly prefer attacking the NEAREST player
            }
          }

          const totalAggro = proximityAggro + damageAggro + preferenceBonus;

          // Slowly decay damage-induced aggro over time so enemies don't hold eternal grudges across islands
          if (skeleton.aggroTable?.[t.id] !== undefined && skeleton.aggroTable[t.id] > 0) {
            skeleton.aggroTable[t.id] = Math.max(0, skeleton.aggroTable[t.id] - 1.5 * dt);
          }

          if (totalAggro > highestAggro && dist < 25.0) { // must be within 25m chase leash
            highestAggro = totalAggro;
            selectedTarget = t;
          }
        });

        // Execute state actions based on the highest aggro target
        if (selectedTarget) {
          const targetPos = selectedTarget.position;
          const distanceToTarget = targetPos.distanceTo(skeleton.mesh.position);

          // Spot transition
          if (skeleton.state === 'idle') {
            skeleton.state = 'chase';
            skeleton.mesh.userData.state = 'chase';
            addLog(`💀 SKELETON AGGRO: Spotted ${selectedTarget.name}! Charging in...`);
          }

          // Track and report aggro shifts
          if (skeleton.currentTargetId !== selectedTarget.id) {
            const oldTargetId = skeleton.currentTargetId;
            skeleton.currentTargetId = selectedTarget.id;
            if (oldTargetId) {
              addLog(`💀 SKELETON AGGRO SHIFTED: Turned to target ${selectedTarget.name}!`);
            }
          }

          // Move toward target (horizontal coordinate plane only)
          const direction = new THREE.Vector3().subVectors(targetPos, skeleton.mesh.position);
          direction.y = 0;
          direction.normalize();

          // Look at target
          skeleton.mesh.lookAt(targetPos.x, skeleton.mesh.position.y, targetPos.z);

          // Translate coordinates directly toward highest aggro target
          const frameSpeed = skeleton.speed * (dt / 0.016);
          skeleton.mesh.position.addScaledVector(direction, frameSpeed);

          // Clamp to sloped terrain heights
          skeleton.mesh.position.y = getIslandHeightAt(skeleton.mesh.position.x, skeleton.mesh.position.z);

          // Limb walking cycle animation
          skeleton.mesh.children.forEach((child) => {
            if (child instanceof THREE.Mesh) {
              if (child.position.y === 0.35) { // Leg
                const factor = child.position.x < 0 ? 1 : -1;
                child.rotation.x = Math.sin(currentTime * 0.008) * 0.5 * factor;
              }
              if (child.position.y === 1.05 && child.position.x !== 0) { // Arm
                const factor = child.position.x < 0 ? -1 : 1;
                child.rotation.x = Math.sin(currentTime * 0.008) * 0.4 * factor;
              }
            }
          });

          // Melee attack range check
          if (distanceToTarget < 1.5) {
            const now = Date.now();
            const lastAttack = (skeleton.mesh.userData.lastAttackTime || 0);
            if (now - lastAttack > 1200) { // 1.2s attack speed cooldown
              skeleton.mesh.userData.lastAttackTime = now;

              // Swing skeletal arms forward
              skeleton.mesh.children.forEach((child) => {
                if (child instanceof THREE.Mesh && child.position.y === 1.05 && child.position.x !== 0) {
                  child.rotation.x = -1.1; // attack thrust rotation
                  setTimeout(() => {
                    child.rotation.x = 0;
                  }, 250);
                }
              });

              // Apply damage based on target type
              if (selectedTarget.id === 'player') {
                setHealth((prev) => {
                  const next = Math.max(0, prev - 5);
                  if (next <= 0) {
                    setIsGameOver(true);
                    audioSynth.playAlarm();
                  }
                  return next;
                });

                audioSynth.playPing();
                setDamageFlash(true);
                setTimeout(() => {
                  setDamageFlash(false);
                }, 400);

                addLog("💀 HIT! A hostile island skeleton slashed you for -5 Health!");
              } else {
                addLog(`⚔️ SKELETON MELEE ATTACK: Slashed at ${selectedTarget.name.toUpperCase()} within range!`);
              }
            }
          }
        } else {
          // Fallback to idle patrol state
          if (skeleton.state === 'chase') {
            skeleton.state = 'idle';
            skeleton.mesh.userData.state = 'idle';
            skeleton.currentTargetId = null;
            addLog("💀 The skeleton lost all targets and returned to its patrol.");
          }

          // Idle patrol bobbing and terrain clamping
          skeleton.mesh.position.y = getIslandHeightAt(skeleton.mesh.position.x, skeleton.mesh.position.z) + Math.sin(currentTime * 0.002 + skeleton.mesh.position.x) * 0.03;
        }
      });

      // --- DYNAMIC WAVE ANIMATION ---
      const oceanTime = currentTime * 0.0015;
      const posAttr = oceanGeom.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        // Clean, low-poly wave math with crisp offsets
        const zHeight = Math.sin(x * 0.04 + oceanTime) * 0.35 + Math.cos(y * 0.04 + oceanTime) * 0.35;
        posAttr.setZ(i, zHeight);
      }
      posAttr.needsUpdate = true;
      oceanGeom.computeVertexNormals();

      // Move clouds slowly
      cloudsList.forEach((cloud) => {
        cloud.position.x += 0.8 * dt;
        if (cloud.position.x > 160) {
          cloud.position.x = -160;
        }
      });

      // --- CUSTOM PLACED STRUCTURES PERIODIC TICKS ---
      placedCustomStructuresRef.current.forEach((struct) => {
        if (struct.type === 'water_purifier') {
          if (!struct.state) struct.state = { timer: 0, water: 0.0 };
          struct.state.timer += dt;
          if (struct.state.timer >= 8.0) {
            struct.state.timer = 0;
            struct.state.water = Math.min(4.0, (struct.state.water || 0.0) + 1.0);
          }
        } else if (struct.type === 'crop_plot') {
          if (!struct.state) struct.state = { planted: false, ready: false, growTimer: 0 };
          if (struct.state.planted && !struct.state.ready) {
            struct.state.growTimer += dt;
            const progress = struct.state.growTimer / 15.0; // 15 seconds to fully grow!
            
            // Scaled sprout animation
            struct.mesh.traverse((child) => {
              if (child.userData && child.userData.isCropSprout) {
                child.visible = true;
                const scale = Math.min(1.0, progress);
                child.scale.set(scale, scale, scale);
              }
            });

            if (struct.state.growTimer >= 15.0) {
              struct.state.ready = true;
            }
          }
        } else if (struct.type === 'standing_lantern') {
          const isNight = Math.sin(skyTime) <= 0;
          struct.mesh.traverse((child) => {
            if (child instanceof THREE.PointLight) {
              child.intensity = isNight ? 1.5 : 0;
            }
          });
        }
      });

      // --- DAY/NIGHT SKY CYCLE ENGINE ---
      skyTime += 0.000029;
      
      const targetSkyColor = new THREE.Color();
      let targetAmbientInt = 0.6;
      let targetHemiInt = 0.5;
      let targetSunInt = 2.0;
      let targetMoonInt = 0.0;

      if (Math.sin(skyTime) <= 0) {
        // Nighttime
        targetSkyColor.setHex(0x05070A);
        targetAmbientInt = 0.05;
        targetHemiInt = 0.02;
        targetSunInt = 0.0;
        targetMoonInt = 0.4;
        renderer.setClearColor(0x05070A, 1);
        scene.background = new THREE.Color(0x05070A);
        if (scene.fog) {
          scene.fog.color.setHex(0x05070A);
        }

        sunLight.position.x = Math.cos(skyTime) * 80;
        sunLight.position.y = Math.sin(skyTime) * 80;
        sunLight.position.z = Math.cos(skyTime * 0.5) * 40;

        moonLight.position.x = -sunLight.position.x;
        moonLight.position.y = -sunLight.position.y;
        moonLight.position.z = -sunLight.position.z;
      } else {
        // Daytime - Force Bright Sky Background & Crisp Overhead Sun
        targetSkyColor.setHex(0x87CEEB);
        targetAmbientInt = 0.6;
        targetHemiInt = 0.5;
        targetSunInt = 2.0;
        targetMoonInt = 0.0;
        renderer.setClearColor(0x87CEEB, 1);
        scene.background = new THREE.Color(0x87CEEB);
        if (scene.fog) {
          scene.fog.color.setHex(0x87CEEB);
        }

        // Adjust sun position for crisp overhead lighting
        sunLight.position.set(20, 40, 20);

        moonLight.position.set(-20, -40, -20);
      }

      // Smooth transition for lights
      const skyLerpSpeed = 0.03;
      ambientLight.intensity += (targetAmbientInt - ambientLight.intensity) * skyLerpSpeed;
      hemiLight.intensity += (targetHemiInt - hemiLight.intensity) * skyLerpSpeed;
      sunLight.intensity += (targetSunInt - sunLight.intensity) * skyLerpSpeed;
      moonLight.intensity += (targetMoonInt - moonLight.intensity) * skyLerpSpeed;

      // --- AUTOMATE TORCH/FLASHLIGHT USE BASED ON DARKNESS ---
      if (hasTorch && Math.sin(skyTime) <= 0) {
        torchLight.visible = true;
      } else {
        torchLight.visible = false;
      }

      // --- OCEAN FLOTSAM SPONDING ENGINE ---
      flotsamSpawnTimer += dt;
      const spawnInterval = !isFirstIslandReachedRef.current ? 1.2 : 3.0; // High volume during onboarding (1.2s instead of 5.0s)
      if (flotsamSpawnTimer >= spawnInterval) {
        flotsamSpawnTimer = 0;
        
        // Spawn randomly within -15 to 15 X, and exactly 100 units ahead on Z
        const spawnX = THREE.MathUtils.randFloat(-15, 15);
        const spawnZ = raftGroup.position.z + 100;
        
        const randVal = Math.random();
        let type = 'wood';
        if (randVal < 0.30) {
          type = 'wood';
        } else if (randVal < 0.55) {
          type = 'food';
        } else if (randVal < 0.80) {
          type = 'palm_frond';
        } else {
          type = 'plastic';
        }

        let geom: THREE.BufferGeometry;
        let mat: THREE.Material;
        
        if (type === 'wood') {
          geom = new THREE.BoxGeometry(1.2, 0.4, 0.4);
          mat = new THREE.MeshStandardMaterial({
            color: 0x8b5a2b, // brown driftwood color
            roughness: 0.9,
            flatShading: true,
          });
        } else if (type === 'food') {
          geom = new THREE.SphereGeometry(0.3, 8, 8);
          mat = new THREE.MeshStandardMaterial({
            color: 0x4f8a10, // green coconut
            roughness: 0.8,
            flatShading: true,
          });
        } else if (type === 'palm_frond') {
          geom = new THREE.BoxGeometry(0.8, 0.05, 1.4);
          mat = new THREE.MeshStandardMaterial({
            color: 0x10b981, // vibrant emerald green for palm fronds
            roughness: 0.7,
            flatShading: true,
          });
        } else {
          geom = new THREE.BoxGeometry(0.9, 0.1, 0.9);
          mat = new THREE.MeshStandardMaterial({
            color: 0x38bdf8, // sky blue plastic sheen
            roughness: 0.5,
            flatShading: true,
          });
        }
        
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(spawnX, 0, spawnZ);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        
        flotsamItems.push({ type, mesh });
      }

      // Bob and Cleanup flotsam items
      for (let i = flotsamItems.length - 1; i >= 0; i--) {
        const item = flotsamItems[i];
        
        // Cleanup if raft drifts past
        if (item.mesh.position.z < raftGroup.position.z - 20) {
          scene.remove(item.mesh);
          item.mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.dispose();
              if (Array.isArray(child.material)) {
                child.material.forEach((m) => m.dispose());
              } else {
                child.material.dispose();
              }
            }
          });
          flotsamItems.splice(i, 1);
          continue;
        }
        
        // Bobbing effect
        const x = item.mesh.position.x;
        const z = item.mesh.position.z;
        const oceanTime = currentTime * 0.0015;
        const waveHeight = Math.sin(x * 0.04 + oceanTime) * 0.35 + Math.cos(z * 0.04 + oceanTime) * 0.35;
        item.mesh.position.y = waveHeight - 0.05;
        item.mesh.rotation.y += 0.5 * dt;
      }

      if (isGameOverRef.current) {
        // slow rotation overview on gameover
        cameraState.theta += 0.15 * dt;
        const cx = playerPos.x + Math.sin(cameraState.theta) * Math.cos(cameraState.phi) * cameraState.distance;
        const cy = playerPos.y + Math.sin(cameraState.phi) * cameraState.distance + 0.5;
        const cz = playerPos.z + Math.cos(cameraState.theta) * Math.cos(cameraState.phi) * cameraState.distance;
        camera.position.set(cx, cy, cz);
        camera.lookAt(playerPos.x, playerPos.y + 0.3, playerPos.z);
        renderer.render(scene, camera);
        return;
      }

      // --- MOBILE JOYSTICK TO KEYBOARD EMULATION ---
      if (isDraggingJoystickRef.current) {
        if (joystickVector.current.y > 0.15) {
          keysPressed.current['w'] = true;
          keysPressed.current['s'] = false;
        } else if (joystickVector.current.y < -0.15) {
          keysPressed.current['w'] = false;
          keysPressed.current['s'] = true;
        } else {
          keysPressed.current['w'] = false;
          keysPressed.current['s'] = false;
        }

        if (joystickVector.current.x < -0.15) {
          keysPressed.current['a'] = true;
          keysPressed.current['d'] = false;
        } else if (joystickVector.current.x > 0.15) {
          keysPressed.current['a'] = false;
          keysPressed.current['d'] = true;
        } else {
          keysPressed.current['a'] = false;
          keysPressed.current['d'] = false;
        }
      }

      const spacePressedNow = !!(keysPressed.current[' '] || keysPressed.current['space']);
      const spaceJustPressed = spacePressedNow && !spaceWasPressed;
      spaceWasPressed = spacePressedNow;

      // --- DYNAMIC 3D WEAPON & ARMOR EQUIP VISUALIZATION ---
      const activeWeapon = equippedItemsRef.current.weapon;
      if (activeWeapon) {
        if (!axeMesh || axeMesh.userData.weaponType !== activeWeapon) {
          // If a weapon is already showing but it's the wrong type, remove it first
          if (axeMesh) {
            playerGroup.remove(axeMesh);
            axeMesh.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
                if (Array.isArray(child.material)) {
                  child.material.forEach((m) => m.dispose());
                } else {
                  child.material.dispose();
                }
              }
            });
            axeMesh = null;
          }

          // Create the new weapon mesh based on active item
          let newMesh: THREE.Group;
          if (activeWeapon === 'stoneAxe') {
            newMesh = createAxeMesh();
            newMesh.position.set(0.24, 0.38, 0.12);
            newMesh.rotation.set(0.4, 0, 0);
          } else if (activeWeapon === 'huntingBowSpear' || activeWeapon === 'item_spear') {
            newMesh = createSpearMesh();
            // Align spear upright in hand
            newMesh.position.set(0.24, 0.28, 0.12);
            newMesh.rotation.set(0.2, 0, 0);
          } else if (activeWeapon === 'item_bow') {
            newMesh = createBowMesh();
            // Align bow naturally in hand
            newMesh.position.set(0.24, 0.28, 0.12);
            newMesh.rotation.set(0, 0, 0);
          } else if (activeWeapon === 'fishingRod') {
            newMesh = createFishingRodMesh();
            // Tilt fishing rod forward
            newMesh.position.set(0.24, 0.28, 0.12);
            newMesh.rotation.set(-0.25, 0, 0);
          } else {
            newMesh = new THREE.Group();
          }

          newMesh.userData.weaponType = activeWeapon;
          axeMesh = newMesh;
          playerGroup.add(axeMesh);
        }
      } else {
        if (axeMesh) {
          playerGroup.remove(axeMesh);
          axeMesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.dispose();
              if (Array.isArray(child.material)) {
                child.material.forEach((m) => m.dispose());
              } else {
                child.material.dispose();
              }
            }
          });
          axeMesh = null;
        }
      }

      // --- DYNAMIC ARMOR & HELMET VISUALIZATION ---
      const activeHead = equippedItemsRef.current.head;
      const activeChest = equippedItemsRef.current.chest;
      const activeLegs = equippedItemsRef.current.legs;
      const activeBack = equippedItemsRef.current.back;

      // Update Head & Visor material colors (closures from player creation)
      if (activeHead === 'scubaHelmet') {
        head.material.color.setHex(0xb5a642); // Shiny golden brass helmet color!
        visor.material.color.setHex(0xd4af37); // Gold-plated visor glass!
      } else {
        head.material.color.setHex(0xfbcfe8); // Pinkish skin tone
        visor.material.color.setHex(0x00f5ff); // Normal cyan visor
      }

      // Update Chest/Torso material colors
      if (activeChest === 'divingSuit') {
        torso.material.color.setHex(0x1e293b); // Midnight blue/grey armor plates
        leftArm.material.color.setHex(0x1e293b);
        rightArm.material.color.setHex(0x1e293b);
      } else {
        torso.material.color.setHex(0xeab308); // Classic high-visibility scuba yellow
        leftArm.material.color.setHex(0x1e293b); // Slate black arm cuffs
        rightArm.material.color.setHex(0x1e293b);
      }

      // Update Legs & Flippers material colors
      if (activeLegs === 'propulsionFins') {
        leftFin.material.color.setHex(0xdc2626); // High-speed rocket red fins
        rightFin.material.color.setHex(0xdc2626);
      } else {
        leftFin.material.color.setHex(0xf97316); // Normal orange fins
        rightFin.material.color.setHex(0xf97316);
      }

      // Toggle Oxygen tank visibility
      tank.visible = (activeBack === 'oxygenTank');

      const speedLevel = upgradesRef.current.find((u) => u.id === 'speed')?.level || 1;
      let swimSpeedValue = 5.0 + (speedLevel - 1) * 2.0;
      if (equippedItemsRef.current.legs === 'propulsionFins') {
        swimSpeedValue *= 1.3; // 30% speed boost!
      } else if (equippedItemsRef.current.legs === 'glitchSubDriveMk1') {
        swimSpeedValue *= 1.40; // 40% speed boost!
      }

      // --- DYNAMIC WAVE BOBBING (BUOYANCY) ---
      const rx = raftGroup.position.x;
      const rz = raftGroup.position.z;
      const waveTime = currentTime * 0.0015;
      raftGroup.position.y = Math.sin(rx * 0.04 + waveTime) * 0.35 + Math.cos(rz * 0.04 + waveTime) * 0.35;

      // --- AUTOMATIC CURRENT DRIFTING & STEERING ---
      let baseDriftSpeed = 0.07;
      
      const hasPhysicalSail = placedSails.length > 0;
      const hasStandardSail = hasPhysicalSail || isSailCrafted;
      const hasMakeshiftSail = !!craftedItemsRef.current.makeshiftDriftSail;
      const hasSteeringWheel = placedSteeringWheels.length > 0;

      if (hasStandardSail) {
        baseDriftSpeed = 0.15; // Standard sail speeds up drift forward!
      } else if (hasMakeshiftSail) {
        baseDriftSpeed = 0.10; // Makeshift sail speeds up drift slightly!
      }

      let steeringSpeed = 0;
      let hasSteeringCapability = false;

      if (hasSteeringWheel) {
        steeringSpeed = 3.5; // Precise steering control
        hasSteeringCapability = true;
      } else if (hasStandardSail) {
        steeringSpeed = 2.0; // Standard sail course steering
        hasSteeringCapability = true;
      } else if (hasMakeshiftSail) {
        steeringSpeed = 0.8; // Minimal direction adjustments (crude drift-sail)
        hasSteeringCapability = true;
      }

      const isRaftAnchored = placedAnchors.some(a => a.deployed);
      if (isRaftAnchored) {
        baseDriftSpeed = 0;
        steeringSpeed = 0;
      }

      // Check onboarding beach collision with Island 1 at (0, 0)
      const isFirstIslandActive = !isFirstIslandReachedRef.current;
      let isWedgedOnFirstBeach = false;
      if (isFirstIslandActive) {
        // Distance from raft to first island at (0, 0)
        const rx = raftGroup.position.x;
        const rz = raftGroup.position.z;
        const dx = rx - 0;
        const dz = rz - 0;
        const distToFirstIsland = Math.sqrt(dx * dx + dz * dz);
        if (distToFirstIsland <= 47) {
          isWedgedOnFirstBeach = true;
          baseDriftSpeed = 0;
          steeringSpeed = 0;
          
          if (!hasShownWedgeLogRef.current) {
            hasShownWedgeLogRef.current = true;
            addLog("📦 ONBOARDING: The raft has collided with the beach and is wedged against the sand!");
            addLog("🌴 TUTORIAL: Step off onto the island and gather wood, stone, or berries to continue!");
          }
        }
      }

      raftGroup.position.z += baseDriftSpeed;

      const lateralDriftSpeed = 0.01;
      const driftX = isWedgedOnFirstBeach ? 0 : lateralDriftSpeed * dt;

      if (hasSteeringCapability) {
        if (keysPressed.current['a'] || keysPressed.current['arrowleft']) {
          raftVelocity.x = isWedgedOnFirstBeach ? 0 : -steeringSpeed;
        } else if (keysPressed.current['d'] || keysPressed.current['arrowright']) {
          raftVelocity.x = isWedgedOnFirstBeach ? 0 : steeringSpeed;
        } else {
          raftVelocity.x = 0;
        }
        if (!isRaftAnchored && !isWedgedOnFirstBeach) {
          raftGroup.position.x += raftVelocity.x * dt;
        }
      } else {
        if (!isRaftAnchored && !isWedgedOnFirstBeach) {
          raftGroup.position.x += driftX;
        }
      }

      // Force the ocean surface mesh to lock to the raft's horizontal position
      oceanMesh.position.x = raftGroup.position.x;
      oceanMesh.position.z = raftGroup.position.z;

      // Find closest island to determine if player is on an island
      let closestIsland = islandLocations[0];
      let minDistToIsland = Infinity;
      for (const loc of islandLocations) {
        const dx = playerPos.x - loc.x;
        const dz = playerPos.z - loc.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < minDistToIsland) {
          minDistToIsland = dist;
          closestIsland = loc;
        }
      }

      // Re-bind player to inherit raft's position if standing/riding on it.
      // If swimming, they drift with the ocean current.
      // If on an island, they stay firmly anchored and do not drift/move with the raft.
      if (isSwimming) {
        playerPos.z += 0.05;
        playerPos.x += driftX;
      } else if (minDistToIsland > 60) {
        // Not swimming and not on an island -> player is on the raft!
        playerPos.x = raftGroup.position.x + playerRelativeX;
        playerPos.z = raftGroup.position.z + playerRelativeZ;
      }

      // 1. BOUNDS AND DECK COLLISION COMPUTATIONS
      let isWithinRaftBounds = false;
      const playerRelX = playerPos.x - raftGroup.position.x;
      const playerRelZ = playerPos.z - raftGroup.position.z;

      for (const tile of raftTiles) {
        if (Math.abs(playerRelX - tile.x) <= 1.5 && Math.abs(playerRelZ - tile.z) <= 1.5) {
          isWithinRaftBounds = true;
          break;
        }
      }
      
      const distToIsland = minDistToIsland;
      const isWithinIslandBounds = distToIsland <= 60;

      const isWithinSolidGround = isWithinRaftBounds || isWithinIslandBounds;
      
      let currentDeckHeight = 0;
      if (isWithinRaftBounds) {
        currentDeckHeight = 0.275 + raftGroup.position.y;
      } else if (isWithinIslandBounds) {
        // Use the exact mathematical sloped mountain height
        currentDeckHeight = getIslandHeightAt(playerPos.x, playerPos.z);
      }

      const isOnDeck = isWithinSolidGround && playerPos.y >= (currentDeckHeight - 0.125);

      // --- MOVEMENT PARENTING & TRIGGER COLLIDER SYSTEM ---
      const isPlayerCurrentlyInRaftDeckZone = isWithinRaftBounds && !isSwimming;

      if (isPlayerCurrentlyInRaftDeckZone && !isPlayerParentedToRaft) {
        // OnTriggerEnter trigger event
        isPlayerParentedToRaft = true;
        
        // Dynamically set the Raft as the Player's Parent in Three.js hierarchy
        if (playerGroup.parent !== raftGroup) {
          const worldPos = new THREE.Vector3();
          playerGroup.getWorldPosition(worldPos);
          raftGroup.add(playerGroup);
          playerGroup.position.copy(raftGroup.worldToLocal(worldPos));
        }
        
        addLog("⚓ TRIGGER ENTER [OnTriggerEnter]: Player entered the raft's deck trigger collider zone. Parent set to Raft Group.");
      } else if (!isPlayerCurrentlyInRaftDeckZone && isPlayerParentedToRaft) {
        // OnTriggerExit trigger event
        isPlayerParentedToRaft = false;
        
        // Detach on exit: remove the parent relationship
        if (playerGroup.parent === raftGroup) {
          const worldPos = new THREE.Vector3();
          playerGroup.getWorldPosition(worldPos);
          scene.add(playerGroup);
          playerGroup.position.copy(worldPos);
        }
        
        addLog("🌊 TRIGGER EXIT [OnTriggerExit]: Player exited the raft's deck trigger zone. Removed parent relationship.");
      }

      // 1. FORCE STATE VARIATION & BOUNDARY DROP:
      if (isWithinSolidGround) {
        if (playerPos.y >= (currentDeckHeight - 0.125)) {
          isSwimming = false;
        }
      } else {
        // The exact millisecond the player's X or Z position moves off solid ground, automatically force isSwimming = true;
        isSwimming = true;
      }

      // If the player's X or Z position goes beyond solid ground above water:
      if (!isWithinSolidGround && playerPos.y > 0) {
        playerPos.y = 0; // Instantly default to flat water level
        playerVY = 0;
      }

      // Oxygen behavior & Refuels on Deck
      if (isOnDeck) {
        // Refuel oxygen bar
        const liveMaxO2 = maxOxygenRef.current;
        setOxygen(liveMaxO2);
        setIsUnderwater(false);
        setDepth(0);

        // Passive collect and deposit! Earn SOL and materials
        // All collected things are processed instantly since we are safe on deck!
      } else {
        if (playerPos.y < 0) {
          setIsUnderwater(true);
          const currentDepthCalc = Math.floor(-playerPos.y * 1.4);
          setDepth(currentDepthCalc);

          // Drain Oxygen bar
          const liveMaxO2 = maxOxygenRef.current;
          let drainRate = (1.8 - (liveMaxO2 - 100) * 0.003) * dt;
          if (equippedItemsRef.current.head === 'highCapacityOxygenRebreather') {
            drainRate *= 0.5; // Cuts oxygen depletion rate in half (50% conservation!)
          }
          setOxygen((prev) => {
            const next = prev - drainRate;
            if (next <= 0) {
              setIsGameOver(true);
              audioSynth.playAlarm();
              return 0;
            }
            return next;
          });
        } else {
          setIsUnderwater(false);
          setDepth(0);
        }
      }

      // Rotate camera left/right orbiting the player with A/D or Left/Right arrows
      const orbitSpeed = 2.2; // Radians per second
      if (keysPressed.current['a'] || keysPressed.current['arrowleft']) {
        cameraState.theta += orbitSpeed * dt;
      }
      if (keysPressed.current['d'] || keysPressed.current['arrowright']) {
        cameraState.theta -= orbitSpeed * dt;
      }

      // Tilt camera up/down orbiting the player with I/K or PageUp/PageDown
      const tiltSpeed = 1.5; // Radians per second
      if (keysPressed.current['i'] || keysPressed.current['pageup']) {
        cameraState.phi -= tiltSpeed * dt;
      }
      if (keysPressed.current['k'] || keysPressed.current['pagedown']) {
        cameraState.phi += tiltSpeed * dt;
      }
      cameraState.phi = Math.max(-0.9, Math.min(1.4, cameraState.phi));

      // 3. EXPLICIT KEYBOARD SWIMMING CONTROLS:
      if (isSwimming) {
        // Disable standard walking gravity entirely.
        playerVY = 0;

        // Move player forward/backward relative to camera 3D direction
        const cam3DForward = new THREE.Vector3();
        camera.getWorldDirection(cam3DForward);
        cam3DForward.normalize();

        const moveDir = new THREE.Vector3(0, 0, 0);
        if (keysPressed.current['w'] || keysPressed.current['arrowup']) {
          moveDir.add(cam3DForward);
        }
        if (keysPressed.current['s'] || keysPressed.current['arrowdown']) {
          moveDir.sub(cam3DForward);
        }

        if (moveDir.lengthSq() > 0.001) {
          moveDir.normalize();
          const activeSpeed = swimSpeedValue * 0.75;
          playerPos.addScaledVector(moveDir, activeSpeed * dt);

          // Spin character facing direction to align with movement (horizontal angle)
          const targetAngle = Math.atan2(moveDir.x, moveDir.z);
          let angleDiff = targetAngle - playerGroup.rotation.y;
          angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
          playerGroup.rotation.y += angleDiff * 0.18;
        }

        // --- DYNAMIC SWIMMING LIMB ANIMATION (Continuous smooth strokes) ---
        const swimWave = Math.sin(currentTime * 0.008);
        leftLeg.rotation.x = swimWave * 0.45;
        rightLeg.rotation.x = -swimWave * 0.45;
        leftArm.rotation.x = -swimWave * 0.3;
        rightArm.rotation.x = swimWave * 0.3;
        leftFin.rotation.x = swimWave * 0.5;
        rightFin.rotation.x = -swimWave * 0.5;
        
        // Tilt arms slightly outward for dynamic swimmer look
        leftArm.rotation.z = 0.25 + swimWave * 0.05;
        rightArm.rotation.z = -0.25 - swimWave * 0.05;

        // Posture alignment: smoothly tilt pitch (rotation on X-axis) to match camera vertical angle
        const pitchAngle = Math.asin(cam3DForward.y);
        const targetPitch = Math.PI / 2 - pitchAngle;
        playerModelGroup.rotation.x += (targetPitch - playerModelGroup.rotation.x) * 0.12;

        // Position the visor on the front of the face pointing forward when laying stomach-down
        visor.position.set(0, 0.95, 0);
        visor.rotation.x = -Math.PI / 2;

        // Align flashlight spotlight to point forward along local Y+ axis (which is world forward when rotated)
        flashlight.position.set(0, 0.98, 0);
        lightTarget.position.set(0, 5, 0);

        // Pressing LEFT SHIFT must forcefully subtract from the vertical coordinate: player.position.y -= 0.15;
        if (keysPressed.current['shift']) {
          playerPos.y -= 0.15;
          if (Math.random() < 0.06) {
            audioSynth.playBubble();
          }
        }

        // Pressing SPACEBAR must forcefully add to the vertical coordinate: player.position.y += 0.15;
        if (keysPressed.current[' '] || keysPressed.current['space']) {
          playerPos.y += 0.15;
          if (Math.random() < 0.06) {
            audioSynth.playBubble();
          }
        }

        // Cap height outside solid ground or allow climbing back up
        if (playerPos.y >= 0) {
          if (isWithinSolidGround) {
            playerPos.y = currentDeckHeight;
            playerVY = 0;
            isSwimming = false;
            audioSynth.playPing();
          } else {
            playerPos.y = 0; // Cap at water surface when not climbing back up
          }
        }

      } else {
        // --- STANDARD GROUND/WALKING MOVEMENT ON DECK ---
        // Upright rotation on deck (smoothly restore upright posture)
        playerModelGroup.rotation.x += (0 - playerModelGroup.rotation.x) * 0.15;

        // Reset visor to normal face location
        visor.position.set(0, 0.8, 0.16);
        visor.rotation.x = 0;

        // Reset flashlight and its target to normal forward direction
        flashlight.position.set(0, 0.8, 0.18);
        lightTarget.position.set(0, 0.8, 5);

        const camForward = new THREE.Vector3();
        camera.getWorldDirection(camForward);
        camForward.y = 0;
        camForward.normalize();

        const moveDir = new THREE.Vector3(0, 0, 0);
        if (keysPressed.current['w'] || keysPressed.current['arrowup']) {
          moveDir.add(camForward);
        }
        if (keysPressed.current['s'] || keysPressed.current['arrowdown']) {
          moveDir.sub(camForward);
        }

        if (moveDir.lengthSq() > 0.001) {
          moveDir.normalize();
          const activeSpeed = swimSpeedValue * 1.1;
          playerPos.addScaledVector(moveDir, activeSpeed * dt);

          // Spin character facing direction to align with movement
          const targetAngle = Math.atan2(moveDir.x, moveDir.z);
          let angleDiff = targetAngle - playerGroup.rotation.y;
          angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
          playerGroup.rotation.y += angleDiff * 0.18;

          // --- DECK WALKING WALK ANIMATIONS ---
          const walkWave = Math.sin(currentTime * 0.012);
          leftLeg.rotation.x = walkWave * 0.35;
          rightLeg.rotation.x = -walkWave * 0.35;
          leftArm.rotation.x = -walkWave * 0.35;
          rightArm.rotation.x = walkWave * 0.35;
          leftFin.rotation.x = walkWave * 0.35;
          rightFin.rotation.x = -walkWave * 0.35;
          leftArm.rotation.z = 0.15;
          rightArm.rotation.z = -0.15;
        } else {
          // Reset limb positions when standing still on the deck
          leftLeg.rotation.x = 0;
          rightLeg.rotation.x = 0;
          leftArm.rotation.x = 0;
          rightArm.rotation.x = 0;
          leftFin.rotation.x = 0;
          rightFin.rotation.x = 0;
          leftArm.rotation.z = 0.15;
          rightArm.rotation.z = -0.15;
        }

        // Platformer land gravity/jump on top of deck
        const isGrounded = playerPos.y <= currentDeckHeight + 0.001;
        if (isGrounded) {
          if (spaceJustPressed) {
            playerVY = 5.2; // leap upwards
            playerPos.y += playerVY * dt;
            audioSynth.playPing();
          } else {
            playerPos.y = currentDeckHeight;
            playerVY = 0;
          }
        } else {
          // Fall off raft deck / in mid-air jumping
          playerVY -= 16.0 * dt; // gravity force
          playerPos.y += playerVY * dt;

          // Landing detection: snap to ground when falling back down
          if (playerPos.y <= currentDeckHeight) {
            playerPos.y = currentDeckHeight;
            playerVY = 0;
          }

          if (playerPos.y < 0) {
            playerVY = 0;
            isSwimming = true;
            audioSynth.playBubble();
          }
        }
      }

      // 3. VISUAL DEEP DIVE PROOF:
      // Instantly change the suit color when player is underwater to visually confirm dive success.
      // Overridden dynamically if a limited-edition Solana skin is active!
      if (equippedSkinIdRef.current === 'skin_diver_01') {
        if (playerPos.y < 0) {
          suitMat.color.setHex(0xa855f7); // Deep Cyber Purple
        } else {
          suitMat.color.setHex(0x00f5ff); // Cyber Neon Cyan
        }
      } else if (equippedSkinIdRef.current === 'skin_shark_hunter') {
        if (playerPos.y < 0) {
          suitMat.color.setHex(0xe11d48); // Crimson Shark Blood Red
        } else {
          suitMat.color.setHex(0xf43f5e); // Bright Apex Rose Red
        }
      } else {
        if (playerPos.y < 0) {
          suitMat.color.setHex(0x0284c7); // Deep scuba blue
        } else {
          suitMat.color.setHex(0xeab308); // Surface yellow
        }
      }

      // Constrain world bounds (distance from the moving raft to avoid floating into infinite empty space)
      const distFromRaft = playerPos.distanceTo(raftGroup.position);
      if (distFromRaft > 300) {
        const dir = new THREE.Vector3().subVectors(playerPos, raftGroup.position);
        dir.y = 0; // keep vertical separate
        dir.normalize().multiplyScalar(300);
        playerPos.x = raftGroup.position.x + dir.x;
        playerPos.z = raftGroup.position.z + dir.z;
      }

      // Sync relative coordinates for the next frame if standing/riding on the raft
      if (isWithinRaftBounds && !isSwimming) {
        playerRelativeX = playerPos.x - raftGroup.position.x;
        playerRelativeZ = playerPos.z - raftGroup.position.z;
      }

      // Physics Parenting translation mapping & VELOCITY CALIBRATION
      if (isPlayerParentedToRaft && playerGroup.parent === raftGroup) {
        // Since player is standing still or moving relative on deck, set local position directly relative to raft
        playerGroup.position.set(playerRelativeX, playerPos.y - raftGroup.position.y, playerRelativeZ);
      } else {
        playerGroup.position.copy(playerPos);
      }

      // --- DYNAMIC COLLISION EXTRACTIONS WITH CORE CRYSTALS ---
      for (let c of crystals) {
        if (c.collected) continue;

        // Hover anim
        c.mesh.position.y = c.originalY + Math.sin(currentTime * 0.003 + c.mesh.position.x) * 0.08;
        c.mesh.rotation.y += 1.2 * dt;

        const distanceToPlayer = playerPos.distanceTo(c.mesh.position);
        if (distanceToPlayer < 1.35) {
          c.collected = true;
          scene.remove(c.mesh);

          audioSynth.playPickup();

          // Increment resources safely
          setResources((prev) => {
            const next = { ...prev };
            if (c.type === 'sea_glass') {
              next.seaGlass = (next.seaGlass || 0) + 1;
              if (Math.random() < 0.35) {
                next.clay = (next.clay || 0) + 1;
                addLog("🏺 CLAY HARVESTED: Found raw clay deposits alongside the sea glass!");
              }
              if (Math.random() < 0.30) {
                next.plastic = (next.plastic || 0) + 1;
                addLog("♻️ PLASTIC RECOVERED: Salvaged discarded ocean plastics near the sea glass!");
              }
            } else if (c.type === 'cobalt') {
              next.cobalt = (next.cobalt || 0) + 1;
            } else if (c.type === 'volcanic') {
              next.volcanic = (next.volcanic || 0) + 1;
              if (Math.random() < 0.40) {
                next.clay = (next.clay || 0) + 1;
                addLog("🏺 CLAY HARVESTED: Recovered premium subsea clay from volcanic structures!");
              }
            } else if (c.type === 'scrap_metal') {
              next.scrapMetal = (next.scrapMetal || 0) + 1;
              if (Math.random() < 0.25) {
                next.leadScrap = (next.leadScrap || 0) + 1;
                addLog("⚙️ LEAD SCRAP: Recovered lead weights from sunken wreck scrap metal!");
              }
              if (Math.random() < 0.20) {
                next.copperWire = (next.copperWire || 0) + 1;
                addLog("⚡ COPPER WIRE: Salvaged rare insulated copper wiring from industrial scrap metal!");
              }
            } else if (c.type === 'driftwood') {
              next.driftwood = (next.driftwood || 0) + 1;
              next.stones = (next.stones || 0) + 1;
              if (Math.random() < 0.20) {
                next.cloth = (next.cloth || 0) + 1;
                addLog("🧵 CLOTH RETRIEVED: Found wet rag cloth entangled with the driftwood!");
              }
            } else if (c.type === 'biomass') {
              next.biomass = (next.biomass || 0) + 1;
              next.kelpFiber = (next.kelpFiber || 0) + 1;
              if (Math.random() < 0.20) {
                next.plastic = (next.plastic || 0) + 1;
                addLog("♻️ PLASTIC POLLUTION: Untangled plastic waste from biomass kelp!");
              }
            } else if (c.type === 'treasure') {
              next.treasure = (next.treasure || 0) + 1;
              if (Math.random() < 0.50) {
                next.leather = (next.leather || 0) + 1;
                addLog("💼 LEATHER SALVAGED: Opened chest and found robust leather straps!");
              }
            } else if (c.type === 'ironScraps') {
              next.ironScraps = (next.ironScraps || 0) + 1;
            } else if (c.type === 'silicaSand') {
              next.silicaSand = (next.silicaSand || 0) + 1;
            } else if (c.type === 'copperWire') {
              next.copperWire = (next.copperWire || 0) + 1;
            } else if (c.type === 'rawTitanium') {
              next.rawTitanium = (next.rawTitanium || 0) + 1;
            } else if (c.type === 'volcanicCrystals') {
              next.volcanicCrystals = (next.volcanicCrystals || 0) + 1;
            } else if (c.type === 'lithiumBatteryPacks') {
              next.lithiumBatteryPacks = (next.lithiumBatteryPacks || 0) + 1;
            } else if (c.type === 'deepSeaUranium') {
              next.deepSeaUranium = (next.deepSeaUranium || 0) + 1;
            } else if (c.type === 'ancientRelicFragments') {
              next.ancientRelicFragments = (next.ancientRelicFragments || 0) + 1;
            } else if (c.type === 'corruptedAIChips') {
              next.corruptedAIChips = (next.corruptedAIChips || 0) + 1;
            } else if (c.type === 'blackBoxCore') {
              next.blackBoxCore = (next.blackBoxCore || 0) + 1;
            } else if (c.type === 'singularityShard') {
              next.singularityShard = (next.singularityShard || 0) + 1;
            } else if (c.type === 'glitchArtifact') {
              next.glitchArtifact = (next.glitchArtifact || 0) + 1;
            }
            return next;
          });

          let displayName = c.type.toUpperCase();
          if (c.type === 'sea_glass') displayName = '🟢 SEA GLASS';
          else if (c.type === 'cobalt') displayName = '🔵 COBALT ORE';
          else if (c.type === 'volcanic') displayName = '🟠 VOLCANIC CRYSTAL';
          else if (c.type === 'scrap_metal') displayName = '⚙️ SCRAP METAL';
          else if (c.type === 'driftwood') displayName = '🪵 DRIFTWOOD';
          else if (c.type === 'biomass') displayName = '🌿 BIOMASS';
          else if (c.type === 'treasure') displayName = '👑 SUNKEN TREASURE';
          else if (c.type === 'ironScraps') displayName = '⚙️ IRON SCRAPS';
          else if (c.type === 'silicaSand') displayName = '⏳ SILICA SAND';
          else if (c.type === 'copperWire') displayName = '🔌 COPPER WIRE';
          else if (c.type === 'rawTitanium') displayName = '💎 RAW TITANIUM';
          else if (c.type === 'volcanicCrystals') displayName = '🔥 VOLCANIC CRYSTALS';
          else if (c.type === 'lithiumBatteryPacks') displayName = '🔋 LITHIUM BATTERY PACKS';
          else if (c.type === 'deepSeaUranium') displayName = '☢️ DEEP-SEA URANIUM';
          else if (c.type === 'ancientRelicFragments') displayName = '🏺 ANCIENT RELIC FRAGMENTS';
          else if (c.type === 'corruptedAIChips') displayName = '👾 CORRUPTED AI CHIPS';
          else if (c.type === 'blackBoxCore') displayName = '📦 BLACK BOX CORE';
          else if (c.type === 'singularityShard') displayName = '🌌 SINGULARITY SHARD';
          else if (c.type === 'glitchArtifact') displayName = '🌀 GLITCH ARTIFACT (LEGENDARY)';

          addLog(`💎 EXTRACTION SECURED: Collected 1x ${displayName}!`);
        }
      }

      // --- PREDATOR PATROLS AND HAZARD STRIKES ---
      for (let h of hazards) {
        if (h.type === 'shark') {
          // Swimming orbit loop
          h.angle += h.speed * dt;
          h.mesh.position.x = Math.sin(h.angle) * h.radius;
          h.mesh.position.z = -1500 + Math.cos(h.angle) * h.radius;
          h.mesh.position.y = h.originalY + Math.sin(currentTime * 0.002 + h.radius) * 1.5;

          // Orient shark to face forward direction of its orbit movement
          h.mesh.rotation.y = h.angle + Math.PI / 2;
        }

        // Urchin hover sway
        if (h.type === 'urchin') {
          h.mesh.position.y = h.originalY + Math.sin(currentTime * 0.0025 + h.mesh.position.x) * 0.08;
          h.mesh.rotation.y += 0.25 * dt;
        }

        // Damage trigger on contact
        const distToPlayer = playerPos.distanceTo(h.mesh.position);
        if (distToPlayer < 1.4) {
          if (Math.random() < 0.04) {
            audioSynth.playAlarm();
            // Drain oxygen pool quickly as a strike penalty
            setOxygen((prev) => Math.max(0, prev - 15));
            addLog(`🚨 DAMAGE INCURRED: Struck by deep hazard ${h.type.toUpperCase()}!`);
          }
        }
      }

      // --- APEX SHARK AI BEHAVIOR & HUNTING STATE MACHINE ---
      if (apexSharkGroup) {
        if (sharkHealth <= 0) {
          if (!isSharkDead) {
            isSharkDead = true;
            addLog("☠️ SHARK DEFEATED: The apex predator has been slain! Awarded +2 Raw Meat, +2 Shark Skin, and +1 Leather!");
            audioSynth.playPickup();
            
            // Give reward: +2 Raw Meat, +2 Shark Skin, +1 Leather
            setResources((prev) => ({
              ...prev,
              rawFood: (prev.rawFood || 0) + 2,
              sharkSkin: (prev.sharkSkin || 0) + 2,
              leather: (prev.leather || 0) + 1,
            }));

            // Set timeout to respawn
            setTimeout(() => {
              sharkHealth = 100;
              isSharkDead = false;
              
              // Reset rotation and place out in deep water
              apexSharkGroup.rotation.set(0, 0, 0);
              const angle = Math.random() * Math.PI * 2;
              apexSharkGroup.position.set(
                raftGroup.position.x + Math.sin(angle) * 35,
                -0.35,
                raftGroup.position.z + Math.cos(angle) * 35
              );
              
              // Reset AI state
              sharkAIState = 0;
              
              addLog("🦈 WARNING: A brand new apex shark has spawned in the deep waters! Watch out!");
              audioSynth.playAlarm();
            }, 60000); // 60 seconds respawn
          }

          // Death visual sequence: Turn the shark upside down
          if (apexSharkGroup.rotation.z < Math.PI) {
            apexSharkGroup.rotation.z = Math.min(Math.PI, apexSharkGroup.rotation.z + 4.0 * dt);
          }
          // Drop it slowly into the sea floor depth
          apexSharkGroup.position.y -= 1.5 * dt;
        } else {
          // Normal life: Make sure y position doesn't stay in depth
          if (apexSharkGroup.position.y < -0.35) {
            apexSharkGroup.position.y = -0.35;
          }

          const isPlayerOnRaft = isWithinRaftBounds;
          let minDistToIsland = Infinity;
          for (const loc of islandLocations) {
            const dx = playerPos.x - loc.x;
            const dz = playerPos.z - loc.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < minDistToIsland) {
              minDistToIsland = dist;
            }
          }
          const distToIsland = minDistToIsland;
          const isPlayerOnIsland = distToIsland <= 60 && playerPos.y >= 0.1;

          const isPlayerInWater = playerPos.y < 1.0 && !isPlayerOnRaft && !isPlayerOnIsland;

          if (isPlayerInWater) {
            // STATE 1: STALKED HUNTING
            if (sharkAIState === 0) {
              sharkAIState = 1;
              addLog("⚠️ APEX DETECTED: A massive shark has spotted you in the water!");
              audioSynth.playAlarm();
            }
          } else {
            // STATE 0: IDLE CRUISE
            if (sharkAIState === 1) {
              sharkAIState = 0;
              addLog("🌊 SAFE: The shark lost interest and is circling the raft...");
            }
          }

          if (sharkAIState === 0) {
            // STATE 0: IDLE CRUISE
            // Circles the raft at a fixed radius of 8 units
            sharkAIAngle += 0.8 * dt; // rotation speed
            const targetX = raftGroup.position.x + Math.sin(sharkAIAngle) * 8;
            const targetZ = raftGroup.position.z + Math.cos(sharkAIAngle) * 8;
            
            // Ensure that when the shark is swimming close to the surface, its top dorsal fin clearly cuts through the water plane (Y = 0)
            // The body height of -0.35 places the dorsal fin (raised 0.45) at Y = +0.1 (above water surface)
            const targetY = -0.35;

            // Set position
            apexSharkGroup.position.set(targetX, targetY, targetZ);

            // Rotate shark to face the next step on its circle
            const nextX = raftGroup.position.x + Math.sin(sharkAIAngle + 0.15) * 8;
            const nextZ = raftGroup.position.z + Math.cos(sharkAIAngle + 0.15) * 8;
            apexSharkGroup.lookAt(nextX, targetY, nextZ);

          } else if (sharkAIState === 1) {
            // STATE 1: STALKED HUNTING
            // Actively interpolates its position towards the player's exact X, Y, and Z coordinates
            const chaseSpeed = 3.2; // faster chase speed
            const direction = new THREE.Vector3().subVectors(playerPos, apexSharkGroup.position);
            const distanceToPlayer = direction.length();

            if (distanceToPlayer > 0.01) {
              direction.normalize();
              apexSharkGroup.position.addScaledVector(direction, chaseSpeed * dt);
            }

            // Rotate the shark mesh to face the player using shark.lookAt(player.position)
            apexSharkGroup.lookAt(playerPos.x, playerPos.y, playerPos.z);

            // STATE 2: DAMAGE CHARGE
            // When the shark's distance to the player is less than 0.8 units:
            if (distanceToPlayer < 0.8) {
              // Active EMP defense counter
              if (equippedItemsRef.current.back === 'empPulseModule') {
                addLog("💥 EMP PULSE RELEASED: Shark is paralyzed, shocked and repelled!");
                audioSynth.playLaser();
                // Repel the shark back by 6 units
                apexSharkGroup.position.addScaledVector(direction, -6);
                sharkAIState = 0; // circle/patrol mode
                return;
              }

              // Calculate damage reduction based on equipped items
              let armorRating = 0;
              if (equippedItemsRef.current.head === 'scubaHelmet') armorRating += 15;
              if (equippedItemsRef.current.head === 'highCapacityOxygenRebreather') armorRating += 15;
              if (equippedItemsRef.current.chest === 'divingSuit') armorRating += 30;
              if (equippedItemsRef.current.chest === 'armor_scrap') armorRating += 15;
              if (equippedItemsRef.current.chest === 'suit_shark') armorRating += 5;
              if (equippedItemsRef.current.chest === 'thermalRegulators') armorRating += 10;
              if (equippedItemsRef.current.chest === 'reinforcedHullPlating') armorRating += 40;
              if (equippedItemsRef.current.chest === 'bioFilterSuit') armorRating += 10;
              if (equippedItemsRef.current.legs === 'propulsionFins') armorRating += 10;
              if (equippedItemsRef.current.legs === 'glitchSubDriveMk1') armorRating += 8;
              if (equippedItemsRef.current.back === 'oxygenTank') armorRating += 5;
              if (equippedItemsRef.current.back === 'magneticScanner') armorRating += 5;
              
              const damageReductionMultiplier = Math.max(0.2, 1 - armorRating / 100);
              const rawDamage = 25;
              const reducedDamage = Math.round(rawDamage * damageReductionMultiplier);

              // Subtract reduced points from the player's health bar
              setHealth((prev) => {
                const next = Math.max(0, prev - reducedDamage);
                if (next <= 0) {
                  setIsGameOver(true);
                  audioSynth.playAlarm();
                }
                return next;
              });

              // Trigger a red HUD flash screen
              setDamageFlash(true);
              setTimeout(() => {
                setDamageFlash(false);
              }, 600);

              addLog(`🦈 SHARK BITE: The apex predator bit you! Absorbed damage: -${reducedDamage}% (Armor: ${armorRating})`);
              audioSynth.playAlarm();

              // Force the shark to immediately reset to STATE 0 (Cruise)
              sharkAIState = 0;
              // Place it at a safe circle position
              sharkAIAngle = Math.random() * Math.PI * 2;
              apexSharkGroup.position.set(
                raftGroup.position.x + Math.sin(sharkAIAngle) * 8,
                -0.35,
                raftGroup.position.z + Math.cos(sharkAIAngle) * 8
              );
            }
          }
        }
      }

      // --- ORBIT CAMERA CAMERA FOLLOW COORDS ---
      const cx = playerPos.x + Math.sin(cameraState.theta) * Math.cos(cameraState.phi) * cameraState.distance;
      const cy = playerPos.y + Math.sin(cameraState.phi) * cameraState.distance + 0.5;
      const cz = playerPos.z + Math.cos(cameraState.theta) * Math.cos(cameraState.phi) * cameraState.distance;

      // Smoothed interpolation
      camera.position.x += (cx - camera.position.x) * 0.12;
      camera.position.y += (cy - camera.position.y) * 0.12;
      camera.position.z += (cz - camera.position.z) * 0.12;
      camera.lookAt(playerPos.x, playerPos.y + 0.3, playerPos.z);

      // --- UNDERWATER DYNAMIC VISUALS (Fog & Ambient Color) ---
      if (playerPos.y < 0) {
        const depthRatio = Math.min(1.0, -playerPos.y / 110); // Normalizes from 0 to 1 as we dive to 110m
        
        // Deep blue transitions to an abyss black clear color
        const r = Math.max(0, Math.floor(2 * (1 - depthRatio))) / 255;
        const g = Math.max(4, Math.floor(17 * (1 - depthRatio))) / 255;
        const b = Math.max(10, Math.floor(51 * (1 - depthRatio))) / 255;
        
        const deepColor = new THREE.Color(r, g, b);
        scene.background = deepColor;
        
        // Dense fog deepens underwater to limit visibility in the abyss
        const density = 0.022 + depthRatio * 0.055;
        scene.fog = new THREE.FogExp2(deepColor, density);
      } else {
        // Return to clear crisp surface atmosphere based on day/night cycle
        if (Math.sin(skyTime) > 0) {
          renderer.setClearColor(0x87CEEB, 1);
          scene.background = new THREE.Color(0x87CEEB);
          if (scene.fog) {
            scene.fog.color.setHex(0x87CEEB);
            if (scene.fog instanceof THREE.FogExp2) {
              scene.fog.density = 0.0075;
            }
          }
        } else {
          renderer.setClearColor(0x05070A, 1);
          scene.background = new THREE.Color(0x05070A);
          if (scene.fog) {
            scene.fog.color.setHex(0x05070A);
            if (scene.fog instanceof THREE.FogExp2) {
              scene.fog.density = 0.0075;
            }
          }
        }
      }

      // --- DECAY HUNGER OVER TIME & APPLY STARVATION DAMAGE ---
      setHunger((prev) => {
        // Slow time-based decay: 0.08% per second (100% lasts ~21 minutes)
        let decayRate = 0.08;
        if (equippedItemsRef.current.chest === 'bioFilterSuit') {
          decayRate *= 0.6; // Decreases biological hunger drain by 40% (60% remaining)
        }
        const next = Math.max(0, prev - decayRate * dt);
        return next;
      });

      // Ensure hunger is firmly clamped at 0 so it doesn't loop into negative numbers
      if (hungerRef.current < 0) {
        setHunger(0);
      }

      // If hunger <= 0, then start draining player health variable
      if (hungerRef.current <= 0) {
        setHealth((prevHealth) => {
          // Strict health-drain loop
          const nextHealth = Math.max(0, prevHealth - 12.0 * dt);
          return nextHealth;
        });
        // Reduce oxygen slowly as starvation damage
        setOxygen((prevO2) => Math.max(0, prevO2 - 3.5 * dt));
      }

      // TRIGGER FULL RESPAWN ON DEATH
      if (healthRef.current <= 0 && hungerRef.current <= 0 && !starvationDeathAlert) {
        // Display onscreen "YOU DIED OF STARVATION" alert message
        setStarvationDeathAlert(true);
        
        // Reset health, hunger, and oxygen
        setHealth(100);
        setHunger(100);
        setOxygen(100);

        // Teleport the raft and player completely back to your safe deep-ocean starting baseline position
        raftGroup.position.set(0, 0, -1500);
        playerPos.set(0, 0.8, -1500);
        playerRelativeX = 0;
        playerRelativeZ = 0;

        addLog("💀 YOU DIED OF STARVATION: Found unconscious! Back to deep-ocean starting baseline position.");
        audioSynth.playAlarm();
      }

      // --- SHAKE TREE ANIMATIONS ---
      islandTrees.forEach((t) => {
        if (t.shakeTimer > 0) {
          t.shakeTimer -= dt;
          // Fast oscillation shake
          t.mesh.rotation.z = Math.sin(t.shakeTimer * 30) * 0.15;
          t.mesh.rotation.x = Math.cos(t.shakeTimer * 25) * 0.15;
          if (t.shakeTimer <= 0) {
            t.mesh.rotation.set(0, 0, 0);
          }
        }
      });

      // --- BOBBING WATER FORAGEABLES & RESPAWNS ---
      forageables.forEach((item) => {
        if (item.type === 'drifting_log') {
          // Bobbing wave effect using sine wave on Y coordinate
          item.mesh.position.y = item.originalY + Math.sin(Date.now() * 0.0015 + item.mesh.position.x) * 0.03;
        }
      });

      // Update respawn queue
      for (let i = respawnQueue.length - 1; i >= 0; i--) {
        respawnQueue[i].timeRemaining -= dt;
        if (respawnQueue[i].timeRemaining <= 0) {
          const type = respawnQueue[i].type;
          if (type === 'driftwood_stick') {
            spawnDriftwoodStick(`beach-stick-respawn-${Date.now()}`);
            addLog("🌊 Beachcombing: A driftwood stick has washed up on the shoreline!");
          } else if (type === 'loose_scrap') {
            spawnLooseScrap(`beach-scrap-respawn-${Date.now()}`);
            addLog("🌊 Beachcombing: A rusty scrap piece has washed up on the shoreline!");
          } else if (type === 'drifting_log') {
            spawnDriftingLog(`drift-log-respawn-${Date.now()}`);
            addLog("🌊 Currents: A drifting log floated near the raft's vicinity!");
          }
          respawnQueue.splice(i, 1);
        }
      }

      // --- PROMPTS AND INTERACTION DETECTION ---
      let activePromptText = "";
      let nearestTreeIndex = -1;
      let nearestFoodIndex = -1;
      let nearestForageableIndex = -1;
      let nearestFlotsamIndex = -1;
      let minTreeDist = 2.5; // Walk-up range
      let minFoodDist = 2.5;
      let minForageableDist = 2.5;
      let minFlotsamDist = 2.5;

      // Distance checking for unique collectible torch
      let isNearTorch = false;
      let nearestChestIndex = -1;
      let nearestCampfireIndex = -1;
      let nearestRareChestIndex = -1;
      let nearestBedIndex = -1;
      let nearestSmelterIndex = -1;
      let nearestSpikeIndex = -1;
      let nearestMagnetIndex = -1;
      let nearestOxygenLineIndex = -1;
      let nearestCustomIdx = -1;
      let minChestDist = 2.0;
      let minRareChestDist = 2.5;

      if (activePlacementProp) {
        const propLabel = activePlacementProp === 'campfire' ? 'Campfire' : 'Wooden Chest';
        activePromptText = `🔨 Press [Left Click] to Place ${propLabel}`;
      } else if (isPlacementModeRef.current) {
        activePromptText = `🔨 Press [E] or [Left Click] to Place Raft Floor Tile (${getNextTileCost()}x Driftwood)`;
      } else {
        // Check if player is near any rare chests
        rareChests.forEach((chest, idx) => {
          if (!chest.opened) {
            const d = playerPos.distanceTo(chest.mesh.position);
            if (d < minRareChestDist) {
              minRareChestDist = d;
              nearestRareChestIndex = idx;
            }
          }
        });

        // Check if player is near any placed chests
        const chestWorldPos = new THREE.Vector3();
        placedChestsRef.current.forEach((chest, idx) => {
          chest.mesh.getWorldPosition(chestWorldPos);
          const d = playerPos.distanceTo(chestWorldPos);
          if (d < minChestDist) {
            minChestDist = d;
            nearestChestIndex = idx;
          }
        });

        // Check if player is near any placed campfires
        let minCampfireDist = 2.0;
        const tempCampfirePos = new THREE.Vector3();
        placedCampfires.forEach((cf, idx) => {
          cf.mesh.getWorldPosition(tempCampfirePos);
          const d = playerPos.distanceTo(tempCampfirePos);
          if (d < minCampfireDist) {
            minCampfireDist = d;
            nearestCampfireIndex = idx;
          }
        });

        // Check if player is near any placed beds
        let minBedDist = 2.0;
        nearestBedIndex = -1;
        const tempBedPos = new THREE.Vector3();
        placedBeds.forEach((bed, idx) => {
          bed.mesh.getWorldPosition(tempBedPos);
          const d = playerPos.distanceTo(tempBedPos);
          if (d < minBedDist) {
            minBedDist = d;
            nearestBedIndex = idx;
          }
        });

        // Check if player is near any placed smelters
        let minSmelterDist = 2.0;
        nearestSmelterIndex = -1;
        const tempSmelterPos = new THREE.Vector3();
        placedSmelters.forEach((smelter, idx) => {
          smelter.mesh.getWorldPosition(tempSmelterPos);
          const d = playerPos.distanceTo(tempSmelterPos);
          if (d < minSmelterDist) {
            minSmelterDist = d;
            nearestSmelterIndex = idx;
          }
        });

        // Check if player is near any placed custom structures
        let minCustomDist = 2.0;
        nearestCustomIdx = -1;
        const tempCustomPos = new THREE.Vector3();
        placedCustomStructuresRef.current.forEach((struct, idx) => {
          struct.mesh.getWorldPosition(tempCustomPos);
          const d = playerPos.distanceTo(tempCustomPos);
          if (d < minCustomDist) {
            minCustomDist = d;
            nearestCustomIdx = idx;
          }
        });

        if (nearestRareChestIndex !== -1) {
          activePromptText = "🔱 Press [E] to Open Rare Island Chest";
        } else if (nearestChestIndex !== -1) {
          activePromptText = "📦 Press [E] to Open Wooden Chest";
        } else if (nearestBedIndex !== -1) {
          const bed = placedBeds[nearestBedIndex];
          if (bed.type === 'hammock_luxury') {
            activePromptText = "🛌 Press [E] to Rest on Luxury Hammock (+Regen Health & Day Skipped)";
          } else {
            activePromptText = "🛌 Press [E] to Sleep on Straw Bed (Skip Night Cycle)";
          }
        } else if (nearestSmelterIndex !== -1) {
          activePromptText = "🔥 Press [E] to Melt Scrap Metal into Iron Bars (Needs 3x Scrap)";
        } else if (nearestCustomIdx !== -1) {
          const struct = placedCustomStructuresRef.current[nearestCustomIdx];
          if (struct.type === 'anchor') {
            const isDeployed = struct.state?.deployed;
            activePromptText = `⚓ Press [E] to ${isDeployed ? 'Raise' : 'Drop'} Anchor (Currently: ${isDeployed ? 'ANCHORED' : 'FLOATING'})`;
          } else if (struct.type === 'steering_wheel') {
            activePromptText = "☸️ Press [E] to Take Steering Wheel (Precise directional course!)";
          } else if (struct.type === 'water_purifier') {
            const waterLevel = struct.state?.water || 0;
            if (waterLevel >= 1) {
              activePromptText = `💧 Press [E] to Drink Purified Water (Ready: ${Math.floor(waterLevel)} cups)`;
            } else {
              activePromptText = "💧 Water Purifier: Purifying salt water... (Wait)";
            }
          } else if (struct.type === 'advanced_smelter') {
            activePromptText = "🔥 Press [E] to Smelt Raw Titanium (Needs 2x Raw Titanium to make 1x Titanium Bracket)";
          } else if (struct.type === 'crop_plot') {
            const planted = struct.state?.planted;
            const ready = struct.state?.ready;
            if (!planted) {
              activePromptText = "🌱 Press [E] to Plant Seeds (Requires 1x Biomass for fertilizer/seeds)";
            } else if (ready) {
              activePromptText = "🥬 Press [E] to Harvest Crop (Get +3 Cooked Food!)";
            } else {
              activePromptText = "🌱 Crop Plot: Crop is growing... (Wait)";
            }
          } else if (struct.type === 'research_table') {
            activePromptText = "🔬 Press [E] to study blueprints at Research Table (+150 Coins!)";
          } else if (struct.type === 'wooden_chair') {
            activePromptText = "🪑 Press [E] to Rest on Wooden Chair (+15% HP restored)";
          } else if (struct.type === 'wooden_table') {
            activePromptText = "🪵 Wooden Table (Decorative)";
          } else if (struct.type === 'standing_lantern') {
            const isNight = Math.sin(skyTime) <= 0;
            activePromptText = `🏮 Standing Lantern (Illuminating deck | Currently: ${isNight ? 'ACTIVE' : 'STANDBY'})`;
          } else if (struct.type === 'crew_bed') {
            activePromptText = "🛌 Press [E] to Sleep in Crew Quarter Bed (Sets Respawn Point & Skips Night)";
          }
        } else if (nearestCampfireIndex !== -1) {
          const cf = placedCampfires[nearestCampfireIndex];
          if (cf.mesh.userData && cf.mesh.userData.isLit) {
            if (cf.mesh.userData.cookingTimer) {
              activePromptText = "🍳 COOKING SIZZLING... (Wait 5s)";
            } else {
              activePromptText = "🔥 Press [E] to Extinguish | Press [C] to Cook Raw Food";
            }
          } else {
            activePromptText = "💨 Press [E] to Ignite Campfire";
          }
        } else {
          if (torchWorldMesh && !hasTorch) {
            const torchWorldPos = new THREE.Vector3(10.5, getIslandHeightAt(10.5, 73.0), 73.0);
            const d = playerPos.distanceTo(torchWorldPos);
            if (d < 2.0) {
              isNearTorch = true;
              activePromptText = "🔥 Press [E] to Collect Mysterious Torch";
            }
          }

          if (!isNearTorch) {
          // First check flotsam items
          flotsamItems.forEach((item, idx) => {
            const d = playerPos.distanceTo(item.mesh.position);
            if (d < minFlotsamDist) {
              minFlotsamDist = d;
              nearestFlotsamIndex = idx;
            }
          });

          if (nearestFlotsamIndex !== -1) {
            const item = flotsamItems[nearestFlotsamIndex];
            if (item.type === 'wood') {
              activePromptText = "🪵 Press [E] to Salvage Driftwood & Scrap Wood";
            } else if (item.type === 'food') {
              activePromptText = "🥥 Press [E] to Salvage Floating Coconut";
            } else if (item.type === 'palm_frond') {
              activePromptText = "🌿 Press [E] to Salvage Palm Fronds";
            } else if (item.type === 'plastic') {
              activePromptText = "🟦 Press [E] to Salvage Plastic Sheets";
            } else {
              activePromptText = "📦 Press [E] to Salvage Flotsam";
            }
          } else {
            islandTrees.forEach((t, idx) => {
              const d = playerPos.distanceTo(t.mesh.position);
              if (d < minTreeDist) {
                minTreeDist = d;
                nearestTreeIndex = idx;
              }
            });

            if (nearestTreeIndex === -1) {
              islandFoods.forEach((f, idx) => {
                const d = playerPos.distanceTo(f.mesh.position);
                if (d < minFoodDist) {
                  minFoodDist = d;
                  nearestFoodIndex = idx;
                }
              });
            }

            if (nearestTreeIndex === -1 && nearestFoodIndex === -1) {
              forageables.forEach((item, idx) => {
                const d = playerPos.distanceTo(item.mesh.position);
                if (d < minForageableDist) {
                  minForageableDist = d;
                  nearestForageableIndex = idx;
                }
              });
            }

            if (nearestTreeIndex !== -1) {
              const tree = islandTrees[nearestTreeIndex];
              const hitsLeft = 3 - tree.hits;
              activePromptText = `🌳 Press [E] to Chop Tree (${hitsLeft} hits left)`;
            } else if (nearestFoodIndex !== -1) {
              const food = islandFoods[nearestFoodIndex];
              const foodName = food.type === 'berry' ? 'Berries' : 'Coconut';
              activePromptText = `🍓 Press [E] to Foraging ${foodName}`;
            } else if (nearestForageableIndex !== -1) {
              const item = forageables[nearestForageableIndex];
              const label = item.type === 'driftwood_stick' ? 'Driftwood Stick' :
                            item.type === 'loose_scrap' ? 'Loose Metal Scrap' :
                            'Drifting Log';
              activePromptText = `🪵 Press [E] to Pick Up ${label}`;
            } else if (equippedItemsRef.current.weapon === 'fishingRod') {
              activePromptText = "🎣 Press [E] to Cast Fishing Line";
            }
          }
        }
      }
    }

      if (currentPromptRef.current !== activePromptText) {
        currentPromptRef.current = activePromptText;
        setInteractionPrompt(activePromptText);
      }

      // --- INTERACTION ACTION ---
      if (keysPressed.current['e']) {
        keysPressed.current['e'] = false; // consume input instantly
        
        if (activePlacementProp) {
          // let pointerdown handle placement confirmation
        } else if (isPlacementModeRef.current) {
          const { snapX, snapZ } = getSnapPosition();
          const currentRes = resourcesRef.current;
          const currentCost = getNextTileCost();
          if ((currentRes.driftwood || 0) < currentCost) {
            addLog(`⚠️ INSUFFICIENT MATERIALS: Requires ${currentCost}x Driftwood to construct a new raft tile!`);
            audioSynth.playPing();
          } else if (totalTilesBuilt >= 25 && (currentRes.titaniumBracket || 0) < 1) {
            displayNotification("Raft too unstable! You need a Titanium Bracket to expand further.");
            addLog("⚠️ RAFT UNSTABLE: Reached the 25-tile structural stability limit! Further modular deck expansion requires 1x Titanium Bracket.");
            audioSynth.playPing();
          } else {
            const tileExists = raftTiles.some(tile => Math.abs(tile.x - snapX) < 0.1 && Math.abs(tile.z - snapZ) < 0.1);
            if (tileExists) {
              addLog("⚠️ ALREADY BUILT: A raft tile already occupies this space!");
              audioSynth.playPing();
            } else {
              setResources((prev) => ({
                ...prev,
                driftwood: Math.max(0, (prev.driftwood || 0) - currentCost),
                titaniumBracket: totalTilesBuilt >= 25 ? Math.max(0, (prev.titaniumBracket || 0) - 1) : (prev.titaniumBracket || 0),
              }));

              const newMesh = createTileMesh(snapX, snapZ);
              raftGroup.add(newMesh);
              raftTiles.push({ x: snapX, z: snapZ, mesh: newMesh });

              totalTilesBuilt++;
              setTotalTilesCount(totalTilesBuilt);

              addLog(`🔨 CONSTRUCTED RAFT TILE: Expanded the deck at relative coords (${snapX}, ${snapZ})! (Next Tile Cost: ${getNextTileCost()} Driftwood)`);
              audioSynth.playPickup();
            }
          }
        } else if (nearestRareChestIndex !== -1) {
          const chest = rareChests[nearestRareChestIndex];
          chest.opened = true;
          const ropesFound = Math.floor(Math.random() * 3) + 1; // 1, 2, or 3 Ropes
          
          const dropChance = Math.random();
          let bonusBracket = 0;
          let bonusCore = 0;
          if (dropChance <= 0.005) {
            bonusCore = 1;
            displayNotification("👑 LEGENDARY DROP! Found a Skeleton King Core!");
            addLog("👑 LEGENDARY EXTRA DROP: Deep inside the golden chest, you discovered a Skeleton King Core! (0.5% Chance)");
          } else if (dropChance <= 0.02) {
            bonusBracket = 1;
            displayNotification("💎 MYTHIC DROP! Found a Titanium Bracket!");
            addLog("💎 MYTHIC EXTRA DROP: Deep within the golden chest, you salvaged a shiny Titanium Bracket! (2.0% Chance)");
          }

          setResources((prev) => ({
            ...prev,
            rope: (prev.rope || 0) + ropesFound,
            titaniumBracket: (prev.titaniumBracket || 0) + bonusBracket,
            skeletonKingCore: (prev.skeletonKingCore || 0) + bonusCore,
          }));
          audioSynth.playPickup();
          displayNotification(`✨ Opened Rare Chest! Found +${ropesFound} Rare Rope!`);
          addLog(`✨ ISLAND RUINS EXPLORED: Cracked open ancient golden chest! Awarded +${ropesFound}x Rare Rope.`);
        } else if (nearestChestIndex !== -1) {
          setActiveChestIndex(nearestChestIndex);
          audioSynth.playPickup();
          addLog("📦 OPENED WOODEN CHEST: Cargo crates linked. Transfer files loaded.");
        } else if (nearestBedIndex !== -1) {
          const bed = placedBeds[nearestBedIndex];
          audioSynth.playPickup();
          setRestingFade(true);

          setTimeout(() => {
            const currentMod = skyTime % (Math.PI * 2);
            let targetAdd = Math.PI * 2 - currentMod;
            skyTime += targetAdd + 0.5; // skip straight to morning!

            if (bed.type === 'hammock_luxury') {
              setHealth(100);
              addLog("🛌 RESTFUL SLEEP: You rested on your Luxury Hammock. Day cycle restored, and your health has been fully regenerated (+100% HP)!");
            } else {
              setHealth((prev) => Math.min(100, prev + 35));
              addLog("🛌 STRAW BED REST: You slept on the basic straw bed and skipped the dangerous night cycle (+35% HP restored)!");
            }
            setRestingFade(false);
          }, 1500);
        } else if (nearestSmelterIndex !== -1) {
          const smelter = placedSmelters[nearestSmelterIndex];
          const currentRes = resourcesRef.current;
          if ((currentRes.scrapMetal || 0) < 3) {
            addLog("⚠️ INSUFFICIENT INGREDIENTS: Smelting high-grade iron bars requires 3x Scrap Metal!");
            audioSynth.playPing();
          } else {
            audioSynth.playPickup();
            setResources((prev) => ({
              ...prev,
              scrapMetal: Math.max(0, (prev.scrapMetal || 0) - 3),
              ironBar: (prev.ironBar || 0) + 1,
            }));
            addLog("🔥 BLAST FURNACE: You processed 3x Scrap Metal into 1x high-grade Iron Bar!");

            // Trigger smelting spark particle effect
            const sparkGroup = new THREE.Group();
            smelter.mesh.add(sparkGroup);
            const particles: any[] = [];
            const geom = new THREE.SphereGeometry(0.05, 4, 4);
            const mat = new THREE.MeshBasicMaterial({
              color: 0xff5500, // Bright orange spark
              transparent: true,
              opacity: 0.9,
            });

            for (let i = 0; i < 20; i++) {
              const m = new THREE.Mesh(geom, mat.clone());
              m.position.set(
                (Math.random() - 0.5) * 0.3,
                0.4 + Math.random() * 0.3,
                (Math.random() - 0.5) * 0.3
              );
              sparkGroup.add(m);
              particles.push({
                mesh: m,
                speedY: 0.4 + Math.random() * 0.5,
                speedX: (Math.random() - 0.5) * 0.3,
                speedZ: (Math.random() - 0.5) * 0.3,
                life: 1.0,
              });
            }

            activeSmokeEffectsRef.current.push({
              smokeGroup: sparkGroup,
              particles,
              parentMesh: smelter.mesh,
              createdAt: Date.now(),
            });
          }
        } else if (nearestCustomIdx !== -1) {
          const struct = placedCustomStructuresRef.current[nearestCustomIdx];
          const currentRes = resourcesRef.current;
          audioSynth.playPickup();

          if (struct.type === 'anchor') {
            if (!struct.state) struct.state = { deployed: false };
            struct.state.deployed = !struct.state.deployed;
            const localA = placedAnchors.find(a => a.mesh === struct.mesh);
            if (localA) localA.deployed = struct.state.deployed;
            
            if (struct.state.deployed) {
              addLog("⚓ ANCHOR DEPLOYED: The heavy iron flukes bite deep into the seabed. Raft drift is halted completely!");
              displayNotification("Anchor Deployed (Raft Stopped)");
            } else {
              addLog("⚓ ANCHOR RAISED: The anchor cable is winched back onto the deck. The raft is floating on the current!");
              displayNotification("Anchor Raised (Raft Drifting)");
            }
          } else if (struct.type === 'steering_wheel') {
            addLog("☸️ COURSE SET: You gripped the steering wheel and trimmed the rudder. Active course control speed is now +75%!");
            displayNotification("Precise Steering Course Active!");
          } else if (struct.type === 'water_purifier') {
            if (!struct.state) struct.state = { timer: 0, water: 0.0 };
            const waterLevel = struct.state.water || 0.0;
            if (waterLevel >= 1.0) {
              struct.state.water = 0.0;
              setHealth((prev) => Math.min(100, prev + 25));
              addLog(`💧 REFRESHING PURIFIED WATER: You drank ${Math.floor(waterLevel)} cup(s) of delicious purified fresh water! (+25% Health restored)`);
              displayNotification("Drank Purified Fresh Water (+25% HP)");
            } else {
              addLog("💧 WATER PURIFIER: The glass condensation plates are still condensing saltwater steam. Please wait.");
            }
          } else if (struct.type === 'advanced_smelter') {
            if ((currentRes.rawTitanium || 0) < 2) {
              addLog("⚠️ INSUFFICIENT INGREDIENTS: Advanced Volcanic Smelting requires 2x Raw Titanium to construct a Titanium Bracket!");
              audioSynth.playPing();
            } else {
              setResources((prev) => ({
                ...prev,
                rawTitanium: Math.max(0, (prev.rawTitanium || 0) - 2),
                titaniumBracket: (prev.titaniumBracket || 0) + 1,
              }));
              addLog("🔥 TITANIUM SMELTING SUCCESSFUL: You processed 2x Raw Titanium into 1x heavy-duty Titanium Bracket!");
              displayNotification("Smelted Raw Titanium into Titanium Bracket!");
            }
          } else if (struct.type === 'crop_plot') {
            if (!struct.state) struct.state = { planted: false, ready: false, growTimer: 0 };
            if (!struct.state.planted) {
              if ((currentRes.biomass || 0) < 1) {
                addLog("⚠️ NO ORGANIC SEEDS/FERTILIZER: Planting a crop plot requires 1x Biomass!");
                audioSynth.playPing();
              } else {
                setResources((prev) => ({
                  ...prev,
                  biomass: Math.max(0, (prev.biomass || 0) - 1),
                }));
                struct.state.planted = true;
                struct.state.ready = false;
                struct.state.growTimer = 0;
                addLog("🌱 SEED PLANTED: You planted nutrient-rich seeds and fertilized the plot with 1x Biomass. Watch it grow!");
                displayNotification("Crop seeds planted! (15s to grow)");
              }
            } else if (struct.state.ready) {
              struct.state.planted = false;
              struct.state.ready = false;
              struct.state.growTimer = 0;
              
              struct.mesh.traverse((child) => {
                if (child.userData && child.userData.isCropSprout) {
                  child.visible = false;
                }
              });

              setResources((prev) => ({
                ...prev,
                cookedFood: (prev.cookedFood || 0) + 3,
              }));
              addLog("🥬 HARVEST SUCCESS: You harvested the lush vegetables from the crop plot! Added +3x Cooked Food to inventory!");
              displayNotification("Harvested Fresh Crops (+3 Cooked Food!)");
            } else {
              addLog("🌱 CROP PLOT: The sprouts are soaking up sunshine. They are not ready for harvest yet.");
            }
          } else if (struct.type === 'research_table') {
            const reward = 150;
            setResources((prev) => ({
              ...prev,
              money: (prev.money || 0) + reward,
            }));
            addLog(`🔬 BLUEPRINTS CODIFIED: You compiled subsea telemetry at the Research Table! Rewarded +${reward} Coins!`);
            displayNotification(`Studied Blueprints! Earned +${reward} Coins!`);
          } else if (struct.type === 'wooden_chair') {
            setHealth((prev) => Math.min(100, prev + 15));
            addLog("🪑 RESTFUL LOUNGE: You sat back on the driftwood lounge chair and felt the gentle ocean breeze. (+15% HP restored)");
            displayNotification("Rested on chair (+15% HP)");
          } else if (struct.type === 'wooden_table') {
            addLog("🪵 WOODEN TABLE: A sturdy driftwood table. Good for decoration.");
          } else if (struct.type === 'standing_lantern') {
            addLog("🏮 LANTERN ADJUSTMENT: The standing lantern features dual photocells, turning on automatically at night.");
          } else if (struct.type === 'crew_bed') {
            setRestingFade(true);
            setTimeout(() => {
              const currentMod = skyTime % (Math.PI * 2);
              let targetAdd = Math.PI * 2 - currentMod;
              skyTime += targetAdd + 0.5;
              setHealth(100);
              
              struct.state.isSpawnPoint = true;
              placedCustomStructuresRef.current.forEach(s => {
                if (s.type === 'crew_bed' && s.id !== struct.id) {
                  if (s.state) s.state.isSpawnPoint = false;
                }
              });

              addLog("🛌 CREW QUARTER SLEEP: Day cycle skipped! Health regenerated to 100%! Set Crew Bed as Saved Respawn Point!");
              displayNotification("Spawn Point Registered & Day Skipped!");
              setRestingFade(false);
            }, 1500);
          }
        } else if (nearestCampfireIndex !== -1) {
          const cf = placedCampfires[nearestCampfireIndex];
          if (!cf.mesh.userData) {
            cf.mesh.userData = { isLit: false, cookingTimer: null, id: Date.now() };
          }
          cf.mesh.userData.isLit = !cf.mesh.userData.isLit;
          
          if (cf.mesh.userData.isLit) {
            cf.light.intensity = 2.0;
            cf.mesh.traverse((child) => {
              if (child instanceof THREE.Mesh && child.userData && child.userData.type === 'coal') {
                child.material.color.setHex(0xff5500);
                child.material.emissive.setHex(0xff3300);
                child.material.emissiveIntensity = 2.0;
                child.material.needsUpdate = true;
              }
            });
            addLog("🔥 CAMPFIRE LIT: The fire is roaring and warm!");
            audioSynth.playPickup();
          } else {
            cf.light.intensity = 0.0;
            if (cf.mesh.userData.cookingTimer) {
              clearTimeout(cf.mesh.userData.cookingTimer);
              cf.mesh.userData.cookingTimer = null;
              addLog("💨 CAMPFIRE EXTINGUISHED: Extinguished fire and cancelled cooking.");
            } else {
              addLog("💨 CAMPFIRE EXTINGUISHED: The flame died down.");
            }
            cf.mesh.traverse((child) => {
              if (child instanceof THREE.Mesh && child.userData && child.userData.type === 'coal') {
                child.material.color.setHex(0x333333);
                child.material.emissive.setHex(0x000000);
                child.material.emissiveIntensity = 0.0;
                child.material.needsUpdate = true;
              }
            });
            audioSynth.playPing();
          }
        } else if (isNearTorch) {
          hasTorch = true;
          addLog("🔥 COLLECTED TORCH: Found the mysterious light source! Automatically activates when night falls.");
          audioSynth.playPickup();
          if (torchWorldMesh) {
            scene.remove(torchWorldMesh);
            torchWorldMesh.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
                if (Array.isArray(child.material)) {
                  child.material.forEach((m) => m.dispose());
                } else {
                  child.material.dispose();
                }
              }
            });
            torchWorldMesh = null;
          }
          currentPromptRef.current = "";
          setInteractionPrompt("");
        } else if (nearestFlotsamIndex !== -1) {
          const item = flotsamItems[nearestFlotsamIndex];
          if (item.type === 'wood') {
            const driftwoodAdd = Math.floor(Math.random() * 2) + 1; // 1-2
            const scrapWoodAdd = Math.floor(Math.random() * 2) + 1; // 1-2
            const ironScrapsAdd = Math.random() < 0.4 ? 1 : 0; // 40% chance of 1 Iron Scrap
            let logMsg = `🪵 SALVAGED WOOD: Recovered +${driftwoodAdd} Driftwood and +${scrapWoodAdd} Scrap Wood`;
            if (ironScrapsAdd > 0) {
              logMsg += ` and +${ironScrapsAdd} Iron Scraps`;
            }
            logMsg += ` from the floating box!`;
            addLog(logMsg);
            audioSynth.playPickup();
            setResources((prev) => ({
              ...prev,
              driftwood: (prev.driftwood || 0) + driftwoodAdd,
              scrapWood: (prev.scrapWood || 0) + scrapWoodAdd,
              ironScraps: (prev.ironScraps || 0) + ironScrapsAdd,
            }));
          } else if (item.type === 'food') {
            addLog("🥥 SALVAGED COCONUT: Pulled in 1x floating Coconut! Added to raw food inventory.");
            audioSynth.playPickup();
            setResources((prev) => ({
              ...prev,
              rawFood: (prev.rawFood || 0) + 1,
            }));
          } else if (item.type === 'palm_frond') {
            const frondsAdd = Math.floor(Math.random() * 2) + 2; // 2-3
            addLog(`🌿 SALVAGED PALM FROND: Pulled in +${frondsAdd} Palm Fronds from the floating foliage!`);
            audioSynth.playPickup();
            setResources((prev) => ({
              ...prev,
              palmFronds: (prev.palmFronds || 0) + frondsAdd,
            }));
          } else if (item.type === 'plastic') {
            const plasticAdd = 2;
            addLog(`🟦 SALVAGED PLASTIC: Recovered +${plasticAdd} Plastic Sheets from floating ocean debris!`);
            audioSynth.playPickup();
            setResources((prev) => ({
              ...prev,
              plasticSheets: (prev.plasticSheets || 0) + plasticAdd,
            }));
          } else {
            addLog("📦 SALVAGED DEBRIS: Pulled in floating flotsam!");
            audioSynth.playPickup();
          }

          onOnboardingResourceInteracted();

          scene.remove(item.mesh);
          item.mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.dispose();
              if (Array.isArray(child.material)) {
                child.material.forEach((m) => m.dispose());
              } else {
                child.material.dispose();
              }
            }
          });
          flotsamItems.splice(nearestFlotsamIndex, 1);

          currentPromptRef.current = "";
          setInteractionPrompt("");
        } else if (nearestTreeIndex !== -1) {
          if (!hasAxeRef.current) {
            const tree = islandTrees[nearestTreeIndex];
            tree.shakeTimer = 0.25; // short shake of refusal
            addLog("⚠️ BARE HANDS: Requires an Axe to chop trees!");
            audioSynth.playPing();
          } else {
            const tree = islandTrees[nearestTreeIndex];
            tree.shakeTimer = 0.4;
            tree.hits += 1;
            audioSynth.playPing();

            if (tree.hits >= 3) {
              addLog("🪵 TREE CHOPPED: Gathered +5 DRIFTWOOD logs for raft building!");
              audioSynth.playPickup();
              scene.remove(tree.mesh);
              islandTrees.splice(nearestTreeIndex, 1);
              
              setResources((prev) => ({
                ...prev,
                driftwood: (prev.driftwood || 0) + 5,
                stones: (prev.stones || 0) + 2, // Also get stones from chopping!
              }));
              
              onOnboardingResourceInteracted();
              
              // clear prompt instantly
              currentPromptRef.current = "";
              setInteractionPrompt("");
            }
          }
        } else if (nearestFoodIndex !== -1) {
          const food = islandFoods[nearestFoodIndex];
          const foodName = food.type === 'berry' ? 'Berries' : 'Coconut';
          const icon = food.type === 'berry' ? '🍓' : '🥥';
          addLog(`${icon} FOOD FORAGED: Gathered 1x fresh ${foodName}! Added to inventory.`);
          audioSynth.playPickup();

          scene.remove(food.mesh);
          islandFoods.splice(nearestFoodIndex, 1);

          setResources((prev) => ({
            ...prev,
            food: food.type === 'berry' ? (prev.food || 0) + 1 : (prev.food || 0),
            rawFood: food.type === 'coconut' ? (prev.rawFood || 0) + 1 : (prev.rawFood || 0),
          }));

          onOnboardingResourceInteracted();

          // clear prompt instantly
          currentPromptRef.current = "";
          setInteractionPrompt("");
        } else if (nearestForageableIndex !== -1) {
          const item = forageables[nearestForageableIndex];
          
          let logMsg = "";
          let woodAdd = 0;
          let scrapAdd = 0;

          if (item.type === 'driftwood_stick') {
            logMsg = "🪵 DRIFTWOOD PICKUP: Gathered +1 Driftwood stick with bare hands!";
            woodAdd = 1;
          } else if (item.type === 'loose_scrap') {
            logMsg = "⚙️ SCRAP METAL: Gathered +1 Loose Metal Scrap!";
            scrapAdd = 1;
          } else if (item.type === 'drifting_log') {
            logMsg = "🪵 DRIFTING LOG: Dragged in +2 Driftwood logs from the ocean!";
            woodAdd = 2;
          }

          addLog(logMsg);
          audioSynth.playPickup();

          // Add to respawn queue
          respawnQueue.push({
            type: item.type,
            timeRemaining: 60.0
          });

          // Remove mesh from scene and list
          scene.remove(item.mesh);
          forageables.splice(nearestForageableIndex, 1);

          // Update resources
          setResources((prev) => ({
            ...prev,
            driftwood: (prev.driftwood || 0) + woodAdd,
            scrapMetal: (prev.scrapMetal || 0) + scrapAdd,
          }));

          onOnboardingResourceInteracted();

          // Clear prompt instantly
          currentPromptRef.current = "";
          setInteractionPrompt("");
        } else if (equippedItemsRef.current.weapon === 'fishingRod') {
          addLog("🎣 CASTING LINE: Waiting for a fish to bite...");
          audioSynth.playPing();
          setTimeout(() => {
            setResources((prev) => ({
              ...prev,
              rawFood: (prev.rawFood || 0) + 1,
            }));
            addLog("🐟 FISH CAUGHT: Successfully reeled in 1x Raw Food!");
            audioSynth.playPickup();
          }, 1500);
        }
      }

      // --- CONSUMPTION MECHANICS FOR FOOD ---
      if (keysPressed.current['u']) {
        keysPressed.current['u'] = false; // consume input instantly
        consumeFoodActionRef.current();
      }

      // --- COOKING MECHANICS (C KEY) ---
      if (keysPressed.current['c']) {
        keysPressed.current['c'] = false; // consume input instantly

        // Find nearest campfire
        let nearestCampfireIndex = -1;
        let minCampfireDist = 2.0;
        const tempCampfirePos = new THREE.Vector3();
        placedCampfires.forEach((cf, idx) => {
          cf.mesh.getWorldPosition(tempCampfirePos);
          const d = playerPos.distanceTo(tempCampfirePos);
          if (d < minCampfireDist) {
            minCampfireDist = d;
            nearestCampfireIndex = idx;
          }
        });

        if (nearestCampfireIndex !== -1) {
          const cf = placedCampfires[nearestCampfireIndex];
          if (cf.mesh.userData && cf.mesh.userData.isLit) {
            if (cf.mesh.userData.cookingTimer) {
              addLog("🍳 CAMPFIRE OCCUPIED: Food is already cooking on this campfire!");
              audioSynth.playPing();
            } else {
              const currentRes = resourcesRef.current;
              if ((currentRes.rawFood || 0) < 1) {
                addLog("⚠️ NO RAW FOOD: You need Raw Food to cook! Cast your fishing rod or forage to get raw food.");
                audioSynth.playPing();
              } else {
                // Subtract 1 raw food
                setResources((prev) => ({
                  ...prev,
                  rawFood: Math.max(0, (prev.rawFood || 0) - 1),
                }));
                addLog("🍳 COOKING IN PROGRESS: Sizzling raw food on the flame... 5 seconds left.");
                audioSynth.playPickup();

                // Trigger smoke particle effect
                const smokeGroup = new THREE.Group();
                cf.mesh.add(smokeGroup);
                const particles: any[] = [];
                const geom = new THREE.SphereGeometry(0.06, 4, 4);
                const mat = new THREE.MeshBasicMaterial({
                  color: 0x22c55e, // Bright green smoke
                  transparent: true,
                  opacity: 0.6,
                });

                for (let i = 0; i < 15; i++) {
                  const mesh = new THREE.Mesh(geom, mat.clone());
                  mesh.position.set(
                    (Math.random() - 0.5) * 0.2,
                    0.25 + Math.random() * 0.2,
                    (Math.random() - 0.5) * 0.2
                  );
                  smokeGroup.add(mesh);
                  particles.push({
                    mesh,
                    speedY: 0.25 + Math.random() * 0.35,
                    speedX: (Math.random() - 0.5) * 0.1,
                    speedZ: (Math.random() - 0.5) * 0.1,
                    life: 1.0,
                  });
                }

                activeSmokeEffectsRef.current.push({
                  smokeGroup,
                  particles,
                  parentMesh: cf.mesh,
                  createdAt: Date.now(),
                });

                cf.mesh.userData.cookingTimer = setTimeout(() => {
                  setResources((prev) => ({
                    ...prev,
                    cookedFood: (prev.cookedFood || 0) + 1,
                  }));
                  displayNotification("+1 Cooked Food added to inventory!");
                  audioSynth.playPickup();
                  cf.mesh.userData.cookingTimer = null;
                }, 5000);
              }
            }
          }
        }
      }

      // --- GHOST PLANK & PLACEMENT MODE SYSTEM ---
      if (isPlacementModeRef.current) {
        ghostPlank.visible = true;
        const { snapX, snapZ } = getSnapPosition();
        ghostPlank.position.set(
          raftGroup.position.x + snapX,
          0.275 + raftGroup.position.y,
          raftGroup.position.z + snapZ
        );
        const hasEnoughWood = (resourcesRef.current.driftwood || 0) >= getNextTileCost();
        (ghostPlank.material as THREE.MeshStandardMaterial).color.setHex(hasEnoughWood ? 0x10b981 : 0xef4444);
      } else {
        ghostPlank.visible = false;
      }

      // --- INTERACTIVE PROP PLACEMENT PREVIEW ---
      if (activePlacementProp && ghostPropMesh) {
        // Cast raycaster from the screen-space mouse coordinates down onto the raft deck surface meshes
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse2D, camera);
        
        const intersects = raycaster.intersectObjects(raftGroup.children, true);
        if (intersects.length > 0) {
          ghostPropMesh.visible = true;
          const intersectPoint = intersects[0].point;
          
          // Snap relative to raftGroup position
          const snapX = Math.round((intersectPoint.x - raftGroup.position.x) * 2) / 2;
          const snapZ = Math.round((intersectPoint.z - raftGroup.position.z) * 2) / 2;
          
          ghostPropMesh.position.set(raftGroup.position.x + snapX, 0.1 + raftGroup.position.y, raftGroup.position.z + snapZ);
        } else {
          // Fallback: project slightly ahead of player
          const lookDir = new THREE.Vector3();
          camera.getWorldDirection(lookDir);
          lookDir.y = 0;
          lookDir.normalize();
          
          const targetPlacementPoint = new THREE.Vector3().copy(playerPos).addScaledVector(lookDir, 3.5);
          const snapX = Math.round((targetPlacementPoint.x - raftGroup.position.x) * 2) / 2;
          const snapZ = Math.round((targetPlacementPoint.z - raftGroup.position.z) * 2) / 2;
          
          ghostPropMesh.position.set(raftGroup.position.x + snapX, 0.1 + raftGroup.position.y, raftGroup.position.z + snapZ);
        }
      } else if (ghostPropMesh) {
        ghostPropMesh.visible = false;
      }

      // --- UPDATE COOKING SMOKE PARTICLES ---
      const smokeNow = Date.now();
      for (let sIdx = activeSmokeEffectsRef.current.length - 1; sIdx >= 0; sIdx--) {
        const effect = activeSmokeEffectsRef.current[sIdx];
        const elapsed = smokeNow - effect.createdAt;
        const pDt = dt;
        
        effect.particles.forEach((p) => {
          p.mesh.position.y += p.speedY * pDt;
          p.mesh.position.x += p.speedX * pDt;
          p.mesh.position.z += p.speedZ * pDt;
          p.life -= pDt * 0.25; // Dissolve over ~4 seconds
          
          if (p.mesh.material) {
            (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, p.life * 0.6);
          }
        });

        if (elapsed >= 5000) {
          effect.parentMesh.remove(effect.smokeGroup);
          effect.particles.forEach((p) => {
            p.mesh.geometry.dispose();
            if (Array.isArray(p.mesh.material)) {
              p.mesh.material.forEach((m) => m.dispose());
            } else {
              p.mesh.material.dispose();
            }
          });
          activeSmokeEffectsRef.current.splice(sIdx, 1);
        }
      }

      // --- CAMPFIRE FLICKER ANIMATION ---
      placedCampfires.forEach((cf) => {
        if (cf.light) {
          if (cf.mesh.userData && cf.mesh.userData.isLit) {
            cf.light.intensity = 1.8 + Math.sin(Date.now() * 0.02) * 0.4;
          } else {
            cf.light.intensity = 0.0;
          }
        }
      });

      renderer.render(scene, camera);
    };

    // --- INITIALIZE LOOP ---
    tick();

    // --- RESIZE OBSERVER DISMISSING ERRORS ---
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      window.requestAnimationFrame(() => {
        for (let entry of entries) {
          const width = Math.floor(entry.contentRect.width);
          const height = Math.floor(entry.contentRect.height);
          if (renderer && camera) {
            renderer.setSize(width, height, false);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
          }
        }
      });
    });
    resizeObserver.observe(container);

    // Cleanups on unmount
    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointercancel', handlePointerUp);
      islandEnemies = []; // Clear active island enemies to prevent stale reference accumulation
    };
  }, []);

  const containerStyle = isMobile ? {
    width: `${viewportSize.width}px`,
    height: `${viewportSize.height}px`,
  } : {};

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      className="relative w-screen h-screen overflow-hidden bg-slate-950 text-white font-mono select-none"
    >
      {/* Absolute fullscreen WebGL canvas */}
      <canvas
        ref={canvasRef}
        className="block w-full h-full bg-slate-950 cursor-grab active:cursor-grabbing"
      />

      {/* Floating Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="absolute top-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          >
            <div className="bg-[#f5ebd6] border-4 border-[#4a2c11] px-6 py-3.5 rounded-2xl shadow-[0_12px_24px_rgba(0,0,0,0.4)] flex items-center gap-3 font-sans text-[#2c1505] font-black tracking-wide text-xs">
              <span className="text-xl">🍗</span>
              <span>{notification}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Red damage flash screen overlay */}
      <AnimatePresence>
        {damageFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.55 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-red-600/35 pointer-events-none z-50 border-8 border-red-600"
          />
        )}
      </AnimatePresence>

      {/* Black restful sleeping overlay */}
      <AnimatePresence>
        {restingFade && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center pointer-events-auto z-50 text-white gap-4"
          >
            <motion.div
              animate={{ scale: [0.95, 1.05, 0.95] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
              className="text-4xl"
            >
              🛌
            </motion.div>
            <motion.h3
              initial={{ y: 5, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-lg font-medium tracking-wide text-slate-300 font-sans"
            >
              Resting peacefully...
            </motion.h3>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtle starvation screen overlay */}
      <AnimatePresence>
        {hunger <= 0 && !isGameOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.12, 0.28, 0.12] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-red-700/15 pointer-events-none z-40 border-6 border-red-700/25 shadow-[inset_0_0_50px_rgba(220,38,38,0.25)]"
          />
        )}
      </AnimatePresence>

      {/* SURVIVAL CARTOON HUD (Pinned bottom left) */}
      <div className="absolute bottom-5 left-5 pointer-events-none z-10 space-y-2">
        <div className={`bg-[#f5ebd6] border-[4px] ${hunger <= 0 ? 'border-red-600 animate-[pulse_1s_infinite] shadow-[0_0_20px_rgba(220,38,38,0.6)]' : 'border-[#4a2c11]'} p-5 min-w-[240px] rounded-2xl pointer-events-auto shadow-[0_12px_24px_rgba(0,0,0,0.5)] flex flex-col gap-2 font-sans text-[#2c1505] relative overflow-hidden`}>
          {/* Subtle paper/wood fiber details */}
          <div className="absolute inset-0 bg-[radial-gradient(#4a2c11_1px,transparent_1px)] [background-size:12px_12px] opacity-5 rounded-xl pointer-events-none" />
          
          <span className="text-[10px] text-[#8b5a2b] tracking-wider font-extrabold block mb-1 uppercase text-center border-b-2 border-[#4a2c11]/15 pb-1 font-mono">
            SURVIVAL STATUS
          </span>
          
          {/* Health / Vitals bar */}
          <div className="flex justify-between items-center mb-0.5">
            <span className="text-xs font-black text-[#4a2c11]">
              VITALS / HEALTH: {hunger <= 0 && <span className="text-rose-600 animate-pulse font-extrabold text-[10px]"> [STARVING!]</span>}
            </span>
            <span className={`text-xs font-black transition-all duration-100 ${hunger <= 0 ? 'text-rose-600 animate-pulse scale-110 font-black' : (health < 35 ? 'text-rose-600 animate-pulse scale-110' : 'text-rose-700')}`}>
              {Math.floor(health)}%
            </span>
          </div>
          <div className={`w-full h-3.5 bg-[#d8ccaf] border-2 ${hunger <= 0 ? 'border-red-600 animate-pulse' : 'border-[#4a2c11]'} rounded-full overflow-hidden relative shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)] mb-2`}>
            <div
              className={`h-full rounded-full transition-all duration-150 ${
                hunger <= 0 ? 'bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]' : (health < 35 ? 'bg-rose-500 animate-pulse' : 'bg-rose-600')
              }`}
              style={{ width: `${Math.min(100, health)}%` }}
            />
          </div>

          {/* O2 Storage bar */}
          <div className="flex justify-between items-center mb-0.5">
            <span className="text-xs font-black text-[#4a2c11]">O2 STORAGE:</span>
            <span className="text-xs font-black text-sky-700">
              {Math.floor(oxygen)}%
            </span>
          </div>
          <div className="w-full h-3.5 bg-[#d8ccaf] border-2 border-[#4a2c11] rounded-full overflow-hidden relative shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)] mb-2">
            <div
              className={`h-full rounded-full transition-all duration-100 ${
                oxygen < 30 ? 'bg-rose-500 animate-pulse' : 'bg-sky-500'
              }`}
              style={{ width: `${Math.min(100, (oxygen / maxOxygen) * 100)}%` }}
            />
          </div>

          {/* Hunger / Nutrition bar */}
          <div className="flex justify-between items-center mb-0.5">
            <span className="text-xs font-black text-[#4a2c11]">HUNGER STATUS:</span>
            <span className={`text-xs font-black transition-all duration-100 ${foodEatFlash ? 'text-emerald-600 scale-110 font-extrabold' : (hunger < 30 ? 'text-rose-600 animate-pulse' : 'text-amber-700')}`}>
              {Math.floor(hunger)}% {foodEatFlash && "🥗 GULP!"}
            </span>
          </div>
          <div className="w-full h-3.5 bg-[#d8ccaf] border-2 border-[#4a2c11] rounded-full overflow-hidden relative shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)] mb-2">
            <div
              className={`h-full rounded-full transition-all duration-150 ${
                foodEatFlash ? 'bg-emerald-500 animate-bounce' : (hunger < 30 ? 'bg-rose-500 animate-pulse' : 'bg-amber-600')
              }`}
              style={{ width: `${Math.min(100, hunger)}%` }}
            />
          </div>

          {/* Eat/Consume Food Button & Hotkey hint */}
          <div className="mt-1 flex items-center justify-between bg-[#eadcb8]/60 p-1.5 border border-[#4a2c11]/15 rounded-xl">
            <span className="text-[10px] text-[#6d4c2c] font-black">Press <kbd className="bg-[#4a2c11] text-[#f5ebd6] px-1 font-mono text-[9px] rounded">U</kbd> to Eat</span>
            <button
              onClick={consumeFoodAction}
              className={`px-3 py-1 text-[10px] uppercase font-black rounded-lg border-2 border-[#4a2c11] transition-all duration-100 ${
                resources.food > 0 && hunger < 100 
                  ? 'bg-[#e67e22] text-[#f5ebd6] hover:bg-[#d35400] cursor-pointer shadow-md active:scale-95' 
                  : 'bg-[#d8ccaf]/80 text-[#a0947a] border-[#b8ac8f] cursor-not-allowed'
              }`}
              disabled={resources.food <= 0 || hunger >= 100}
            >
              Eat ({resources.food})
            </button>
          </div>

          <div className="flex justify-between mt-1.5 border-t-2 border-[#4a2c11]/10 pt-2 text-[10px] font-black text-[#6d4c2c]">
            <span>DEPTH: <strong className="text-[#2c1505] font-extrabold">{depth}m</strong></span>
            <span>STATUS: <strong className={isUnderwater ? 'text-sky-700 animate-pulse' : 'text-emerald-700'}>{isUnderwater ? 'DIVING' : 'ON DECK'}</strong></span>
          </div>
        </div>
      </div>

      {/* INTERACTION PROMPT DISPLAY */}
      {interactionPrompt && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20 pointer-events-none animate-bounce">
          <div className="bg-slate-950/90 border border-amber-400/60 px-6 py-3 rounded-none backdrop-blur-md shadow-lg shadow-amber-500/20 flex items-center space-x-2">
            <span className="text-sm font-bold text-amber-300 tracking-wider font-mono">
              {interactionPrompt}
            </span>
          </div>
        </div>
      )}

      {/* MOBILE HUD VIRTUAL CONTROLLER */}
      {isMobile && (
        <div className="absolute inset-0 z-30 pointer-events-none select-none">
          {/* Left Side: Joystick */}
          <div className="absolute left-8 bottom-8 pointer-events-auto">
            <div
              ref={joystickRef}
              id="virtual-joystick-base"
              className="w-28 h-28 rounded-full border-4 border-white/20 bg-black/35 backdrop-blur-sm flex items-center justify-center shadow-lg cursor-grab active:cursor-grabbing"
              style={{ touchAction: 'none' }}
            >
              <div
                ref={joystickKnobRef}
                id="virtual-joystick-knob"
                className="w-12 h-12 rounded-full border-2 border-white/45 bg-white/30 backdrop-blur-md shadow-md transition-all duration-75"
                style={{ transform: 'translate3d(0px, 0px, 0px)', touchAction: 'none' }}
              />
            </div>
          </div>

          {/* Right Side: Action Buttons Cluster */}
          <div className="absolute right-8 bottom-8 pointer-events-auto flex flex-col items-end gap-4">
            {/* Top row of buttons (Interact and Use Inventory) */}
            <div className="flex gap-4">
              {/* Button C: Use Inventory / Consume */}
              <button
                ref={btnCRef}
                id="mobile-btn-c"
                className="w-14 h-14 rounded-full border-2 border-white/30 bg-slate-800/60 active:bg-slate-700/80 text-white font-bold text-xs flex flex-col items-center justify-center shadow-lg active:scale-95 transition-transform"
                style={{ touchAction: 'none' }}
              >
                <span className="text-sm">🎒</span>
                <span className="text-[9px] tracking-tighter opacity-80 mt-0.5">BAG (I)</span>
              </button>

              {/* Button B: Interact / Place Structure */}
              <button
                ref={btnBRef}
                id="mobile-btn-b"
                className="w-14 h-14 rounded-full border-2 border-white/30 bg-slate-800/60 active:bg-slate-700/80 text-white font-bold text-xs flex flex-col items-center justify-center shadow-lg active:scale-95 transition-transform"
                style={{ touchAction: 'none' }}
              >
                <span className="text-sm">⚙️</span>
                <span className="text-[9px] tracking-tighter opacity-80 mt-0.5">ACTION (E)</span>
              </button>
            </div>

            {/* Bottom Row: Big Button A (Harvest / Attack) */}
            <button
              ref={btnARef}
              id="mobile-btn-a"
              className="w-20 h-20 rounded-full border-4 border-amber-500/50 bg-amber-600/55 active:bg-amber-500/75 text-white font-black text-sm flex flex-col items-center justify-center shadow-xl active:scale-95 transition-transform"
              style={{ touchAction: 'none' }}
            >
              <span className="text-lg">⚔️</span>
              <span className="text-[10px] tracking-tight font-sans mt-0.5 uppercase">ATTACK</span>
              <span className="text-[8px] opacity-75 font-sans uppercase">HARVEST</span>
            </button>
          </div>
        </div>
      )}

      {/* SCREEN COMPASS HUD */}
      <div
        id="hud-compass-widget"
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          border: '2px solid #00f3ff',
          background: 'rgba(5,12,16,0.8)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          color: '#00f3ff',
          fontFamily: 'monospace',
          zIndex: 1000,
          textAlign: 'center',
          whiteSpace: 'pre-line',
          fontSize: '11px',
          lineHeight: '1.1',
          boxShadow: '0 0 10px rgba(0, 243, 255, 0.2)'
        }}
      >
        N<br/>0°
      </div>

      {/* HUD OPTIONS / CONTROL PANEL (Top Right) */}
      <div className="absolute top-5 right-[100px] z-20 text-right space-y-2 flex flex-col items-end">
        {/* Audio Mute/Unmute Toggle */}
        <button
          id="audio-mute-toggle"
          onClick={() => {
            const nextMute = !audioSynth.getMuted();
            audioSynth.setMute(nextMute);
            setIsAudioMuted(nextMute);
            if (!nextMute) {
              audioSynth.playPing();
            }
          }}
          className="bg-slate-950/95 hover:bg-slate-900 border border-[#00f5ff]/20 hover:border-[#00f5ff]/40 px-3.5 py-1.5 text-[10px] text-gray-300 hover:text-white transition-all cursor-pointer flex items-center space-x-1.5 active:scale-95 shadow-md shadow-black/40"
          title={isAudioMuted ? "Click to Unmute Sound" : "Click to Mute Sound"}
        >
          <span>{isAudioMuted ? "🔇 SOUNDS: MUTED" : "🔊 SOUNDS: ON"}</span>
        </button>

        {/* Clickable Inventory Button */}
        <button
          onClick={() => {
            setShowInventoryMenu((prev) => !prev);
            audioSynth.playPing();
          }}
          className="bg-slate-950/95 hover:bg-slate-900 border border-[#00f5ff]/40 px-3.5 py-2 text-xs font-mono font-bold uppercase tracking-wider text-[#00f5ff] hover:text-white transition-all cursor-pointer shadow-lg shadow-[#00f5ff]/10 flex items-center space-x-2 active:scale-95"
        >
          <span>💼 INVENTORY</span>
          <span className="px-1.5 py-0.2 bg-slate-900 border border-[#00f5ff]/20 text-slate-400 font-bold text-[9px]">
            [ I ]
          </span>
        </button>

        <button
          onClick={() => {
            setShowTabMenu((prev) => !prev);
            audioSynth.playPing();
          }}
          className="bg-slate-950/85 hover:bg-slate-900 border border-[#00f5ff]/20 hover:border-[#00f5ff]/40 px-3.5 py-1.5 text-[10px] text-gray-300 hover:text-white transition-all cursor-pointer flex items-center space-x-1.5 active:scale-95"
        >
          <span>Tactical & Upgrades</span>
          <span className="px-1 py-0.2 bg-slate-900 border border-[#00f5ff]/10 text-slate-500 font-bold text-[8px]">
            TAB
          </span>
        </button>

        <button
          onClick={() => {
            setShowMarketplace((prev) => !prev);
            audioSynth.playPing();
          }}
          className="bg-slate-950/85 hover:bg-slate-900 border border-amber-500/30 hover:border-amber-400 px-3.5 py-1.5 text-[10px] text-amber-200 hover:text-white transition-all cursor-pointer flex items-center space-x-1.5 active:scale-95 shadow-[0_0_10px_rgba(245,158,11,0.05)]"
        >
          <span>🌐 Marketplace Ledger</span>
          <span className="px-1 py-0.2 bg-slate-900 border border-amber-500/20 text-amber-500 font-bold text-[8px]">
            M
          </span>
        </button>

        <button
          onClick={() => {
            setShowHelpMenu((prev) => !prev);
            audioSynth.playPing();
          }}
          className="bg-slate-950/85 hover:bg-slate-900 border border-[#00f5ff]/20 hover:border-[#00f5ff]/40 px-3.5 py-1.5 text-[10px] text-gray-300 hover:text-white transition-all cursor-pointer flex items-center space-x-1.5 active:scale-95"
        >
          <span>Help & Telemetry Logs</span>
          <span className="px-1 py-0.2 bg-slate-900 border border-[#00f5ff]/10 text-slate-500 font-bold text-[8px]">
            H
          </span>
        </button>
      </div>

      {/* --- TAB KEY OVERLAY TACTICAL SYSTEM --- */}
      <AnimatePresence>
        {showTabMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm z-30 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#040a12] border border-[#00f5ff]/20 max-w-xl w-full rounded-none p-6 shadow-2xl relative"
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00f5ff] to-transparent" />
              
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="font-mono text-[9px] text-[#00f5ff] tracking-widest block">
                    TACTICAL CONSOLE OVERLAY
                  </span>
                  <h2 className="font-serif italic font-light text-xl text-white">
                    Upgrade Deck & Sandbox Controls
                  </h2>
                </div>
                <button
                  onClick={() => setShowTabMenu(false)}
                  className="px-2 py-1 border border-white/10 hover:border-white text-xs hover:text-[#00f5ff] transition-all cursor-pointer"
                >
                  [ CLOSE ]
                </button>
              </div>

              {/* CORE CARGO DISPLAY */}
              <div className="grid grid-cols-9 gap-1 mb-4 text-center text-[9px]">
                <div className="bg-slate-950/90 border border-white/5 p-1 rounded-sm">
                  <span className="text-[7px] text-gray-500 block">SEA GLASS</span>
                  <span className="text-[10px] font-bold text-emerald-400">{resources.seaGlass}</span>
                </div>
                <div className="bg-slate-950/90 border border-white/5 p-1 rounded-sm">
                  <span className="text-[7px] text-gray-500 block">COBALT ORE</span>
                  <span className="text-[10px] font-bold text-cyan-400">{resources.cobalt}</span>
                </div>
                <div className="bg-slate-950/90 border border-white/5 p-1 rounded-sm">
                  <span className="text-[7px] text-gray-500 block">VOLCANIC</span>
                  <span className="text-[10px] font-bold text-orange-400">{resources.volcanic}</span>
                </div>
                <div className="bg-slate-950/90 border border-white/5 p-1 rounded-sm">
                  <span className="text-[7px] text-gray-500 block">SCRAP METAL</span>
                  <span className="text-[10px] font-bold text-slate-300">{resources.scrapMetal}</span>
                </div>
                <div className="bg-slate-950/90 border border-white/5 p-1 rounded-sm">
                  <span className="text-[7px] text-gray-500 block">DRIFTWOOD</span>
                  <span className="text-[10px] font-bold text-amber-500">{resources.driftwood}</span>
                </div>
                <div className="bg-slate-950/90 border border-white/5 p-1 rounded-sm">
                  <span className="text-[7px] text-gray-500 block">BIOMASS</span>
                  <span className="text-[10px] font-bold text-green-400">{resources.biomass}</span>
                </div>
                <div className="bg-slate-950/90 border border-white/5 p-1 rounded-sm">
                  <span className="text-[7px] text-gray-500 block">STONES</span>
                  <span className="text-[10px] font-bold text-slate-400">{resources.stones}</span>
                </div>
                <div className="bg-slate-950/90 border border-amber-400/30 p-1 rounded-sm shadow-[0_0_8px_rgba(234,179,8,0.1)]">
                  <span className="text-[7px] text-amber-400 block font-bold">💰 COIN BAL</span>
                  <span className="text-[10px] font-bold text-amber-300 font-mono">{resources.money}</span>
                </div>
                <div className="bg-slate-950/90 border border-white/5 p-1 rounded-sm">
                  <span className="text-[7px] text-gray-500 block">KELP FIBER</span>
                  <span className="text-[10px] font-bold text-teal-400">{resources.kelpFiber}</span>
                </div>
                <div className="bg-slate-950/90 border border-white/5 p-1 rounded-sm">
                  <span className="text-[7px] text-gray-500 block">TREASURE</span>
                  <span className="text-[10px] font-bold text-yellow-400">{resources.treasure}</span>
                </div>
                <div className="bg-slate-950/90 border border-white/5 p-1 rounded-sm">
                  <span className="text-[7px] text-gray-500 block">FORAGED</span>
                  <span className="text-[10px] font-bold text-rose-400">{resources.food}</span>
                </div>
                <div className="bg-slate-950/90 border border-white/5 p-1 rounded-sm">
                  <span className="text-[7px] text-gray-500 block">COOKED FD</span>
                  <span className="text-[10px] font-bold text-amber-400">{resources.cookedFood}</span>
                </div>
                <div className="bg-slate-950/90 border border-white/5 p-1 rounded-sm">
                  <span className="text-[7px] text-purple-400 block">RARE ROPE</span>
                  <span className="text-[10px] font-bold text-purple-400">{resources.rope}</span>
                </div>
                <div className="bg-slate-950/90 border border-yellow-500/20 p-1 rounded-sm">
                  <span className="text-[7px] text-yellow-400 block font-bold">TITANIUM BR.</span>
                  <span className="text-[10px] font-bold text-yellow-300">{resources.titaniumBracket || 0}</span>
                </div>
                <div className="bg-slate-950/90 border border-fuchsia-500/20 p-1 rounded-sm">
                  <span className="text-[7px] text-fuchsia-400 block font-bold">KING CORE</span>
                  <span className="text-[10px] font-bold text-fuchsia-300">{resources.skeletonKingCore || 0}</span>
                </div>
                <div className="bg-slate-950/90 border border-emerald-500/10 p-1 rounded-sm">
                  <span className="text-[7px] text-emerald-400 block font-bold">PALM FROND</span>
                  <span className="text-[10px] font-bold text-emerald-300">{resources.palmFronds || 0}</span>
                </div>
                <div className="bg-slate-950/90 border border-amber-500/10 p-1 rounded-sm">
                  <span className="text-[7px] text-amber-400 block font-bold">SCRAP WOOD</span>
                  <span className="text-[10px] font-bold text-amber-300">{resources.scrapWood || 0}</span>
                </div>
                <div className="bg-slate-950/90 border border-sky-500/10 p-1 rounded-sm">
                  <span className="text-[7px] text-sky-400 block font-bold">PLASTIC</span>
                  <span className="text-[10px] font-bold text-sky-300">{resources.plasticSheets || 0}</span>
                </div>
              </div>

              {/* CATEGORIES TAB NAVIGATION */}
              <div className="flex border-b border-[#00f5ff]/20 mb-4 text-[10px] font-mono">
                {(['upgrades', 'tools', 'survival', 'raft', 'weapons', 'map', 'character_shop'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`flex-1 py-1.5 text-center uppercase tracking-wider transition-all duration-100 border-b-2 cursor-pointer ${
                      activeCategory === cat
                        ? 'border-[#00f5ff] text-[#00f5ff] font-bold bg-[#00f5ff]/5'
                        : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-900/40'
                    }`}
                  >
                    {cat === 'character_shop' ? '🎭 SOL Skins' : cat}
                  </button>
                ))}
              </div>

              {/* CATEGORIES TAB CONTENT */}
              <div className={`space-y-2.5 mb-5 ${activeCategory === 'map' || activeCategory === 'character_shop' ? 'max-h-[500px]' : 'max-h-[220px] overflow-y-auto'} pr-2 scrollbar-thin`}>
                {activeCategory === 'upgrades' && (
                  <>
                    <h3 className="text-[9px] text-[#00f5ff] tracking-widest uppercase font-bold border-b border-[#00f5ff]/10 pb-1 mb-2">
                      Active Hull Systems
                    </h3>
                    {upgrades.map((up) => {
                      const isMax = up.level >= up.maxLevel;
                      return (
                        <div
                          key={up.id}
                          className="bg-slate-950/80 border border-white/5 p-2.5 flex justify-between items-center"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{up.name}</span>
                              <span className="text-[9px] px-1.5 py-0.2 bg-slate-900 border border-white/10 text-slate-400">
                                LVL {up.level}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 block mt-0.5">
                              Cost:{' '}
                              <span className="text-emerald-400">{up.costSeaGlass} G</span>
                              {up.costCobalt > 0 && <span className="text-cyan-400">, {up.costCobalt} C</span>}
                              {up.costVolcanic > 0 && <span className="text-orange-400">, {up.costVolcanic} V</span>}
                            </span>
                          </div>

                          <button
                            disabled={isMax}
                            onClick={() => purchaseUpgrade(up.id)}
                            className={`px-3 py-1.5 text-xs font-mono font-bold uppercase transition-all ${
                              isMax
                                ? 'bg-slate-900 text-slate-600 border border-slate-800'
                                : 'bg-[#00f5ff] hover:bg-white text-black cursor-pointer'
                            }`}
                          >
                            {isMax ? 'MAX LEVEL' : '[ UPGRADE ]'}
                          </button>
                        </div>
                      );
                    })}
                  </>
                )}

                {activeCategory === 'tools' && (
                  <>
                    <h3 className="text-[9px] text-[#00f5ff] tracking-widest uppercase font-bold border-b border-[#00f5ff]/10 pb-1 mb-2">
                      Survival Tools & Utility
                    </h3>
                    
                    {/* STONE AXE */}
                    <div className="bg-slate-950/80 border border-white/5 p-2.5 flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">🪓 Stone Axe</span>
                          {craftedItems.stoneAxe && (
                            <span className="text-[8px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-1.5 py-0.5 uppercase font-bold tracking-wider">
                              Crafted
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          Cost: <span className="text-slate-300">3 Scrap Metal</span>, <span className="text-amber-500">2 Driftwood</span>
                        </span>
                        <span className="text-[9px] text-slate-400 block mt-1 italic">
                          Required to chop island trees. Unlocked immediately.
                        </span>
                      </div>
                      <button
                        disabled={craftedItems.stoneAxe}
                        onClick={() => craftBlueprint('stoneAxe')}
                        className={`px-3 py-1.5 text-xs font-mono font-bold uppercase transition-all ${
                          craftedItems.stoneAxe
                            ? 'bg-slate-900 text-emerald-400 border border-emerald-500/10'
                            : 'bg-[#00f5ff] hover:bg-white text-black cursor-pointer'
                        }`}
                      >
                        {craftedItems.stoneAxe ? 'EQUIPPED' : '[ CRAFT ]'}
                      </button>
                    </div>

                    {/* FISHING ROD */}
                    <div className="bg-slate-950/80 border border-white/5 p-2.5 flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">🎣 Fishing Rod</span>
                          {craftedItems.fishingRod && (
                            <span className="text-[8px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-1.5 py-0.5 uppercase font-bold tracking-wider">
                              Crafted
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          Cost: <span className="text-amber-500">4 Driftwood</span>, <span className="text-green-400">2 Biomass</span>
                        </span>
                        <span className="text-[9px] text-slate-400 block mt-1 italic">
                          Allows passive food gathering from the deck.
                        </span>
                      </div>
                      <button
                        disabled={craftedItems.fishingRod}
                        onClick={() => craftBlueprint('fishingRod')}
                        className={`px-3 py-1.5 text-xs font-mono font-bold uppercase transition-all ${
                          craftedItems.fishingRod
                            ? 'bg-slate-900 text-emerald-400 border border-emerald-500/10'
                            : 'bg-[#00f5ff] hover:bg-white text-black cursor-pointer'
                        }`}
                      >
                        {craftedItems.fishingRod ? 'CRAFTED' : '[ CRAFT ]'}
                      </button>
                    </div>

                    {/* MAKESHIFT DRIFT-SAIL */}
                    <div className="bg-slate-950/80 border border-white/5 p-2.5 flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">⛵ Makeshift Drift-Sail</span>
                          {craftedItems.makeshiftDriftSail && (
                            <span className="text-[8px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-1.5 py-0.5 uppercase font-bold tracking-wider">
                              Crafted
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          Cost: <span className="text-emerald-400">30 Palm Fronds</span>, <span className="text-amber-500">15 Scrap Wood</span>, <span className="text-sky-400">10 Plastic Sheets</span>
                        </span>
                        <span className="text-[9px] text-slate-400 block mt-1 italic">
                          Crude sail made of ocean debris. Unlocks minimal drift direction adjustments to fight current.
                        </span>
                      </div>
                      <button
                        disabled={craftedItems.makeshiftDriftSail}
                        onClick={() => craftBlueprint('makeshiftDriftSail')}
                        className={`px-3 py-1.5 text-xs font-mono font-bold uppercase transition-all ${
                          craftedItems.makeshiftDriftSail
                            ? 'bg-slate-900 text-emerald-400 border border-emerald-500/10'
                            : 'bg-[#00f5ff] hover:bg-white text-black cursor-pointer'
                        }`}
                      >
                        {craftedItems.makeshiftDriftSail ? 'CRAFTED' : '[ CRAFT ]'}
                      </button>
                    </div>
                  </>
                )}

                {activeCategory === 'survival' && (
                  <>
                    <h3 className="text-[9px] text-[#00f5ff] tracking-widest uppercase font-bold border-b border-[#00f5ff]/10 pb-1 mb-2">
                      Survival & Sustenance
                    </h3>

                    {/* CAMPFIRE */}
                    <div className="bg-slate-950/80 border border-white/5 p-2.5 flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">🔥 Campfire</span>
                          {craftedItems.campfire && (
                            <span className="text-[8px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-1.5 py-0.5 uppercase font-bold tracking-wider">
                              Crafted
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          Cost: <span className="text-amber-500">5 Driftwood</span>, <span className="text-slate-400">5 Stones</span>
                        </span>
                        <span className="text-[9px] text-slate-400 block mt-1 italic">
                          Used to cook raw food on the deck.
                        </span>
                      </div>
                      <button
                        disabled={craftedItems.campfire}
                        onClick={() => craftBlueprint('campfire')}
                        className={`px-3 py-1.5 text-xs font-mono font-bold uppercase transition-all ${
                          craftedItems.campfire
                            ? 'bg-slate-900 text-emerald-400 border border-emerald-500/10'
                            : 'bg-[#00f5ff] hover:bg-white text-black cursor-pointer'
                        }`}
                      >
                        {craftedItems.campfire ? 'CRAFTED' : '[ CRAFT ]'}
                      </button>
                    </div>

                    {/* WOODEN CHEST */}
                    <div className="bg-slate-950/80 border border-white/5 p-2.5 flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">📦 Wooden Chest</span>
                          {craftedItems.woodenChest && (
                            <span className="text-[8px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-1.5 py-0.5 uppercase font-bold tracking-wider">
                              Crafted
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          Cost: <span className="text-amber-500">8 Driftwood</span>
                        </span>
                        <span className="text-[9px] text-slate-400 block mt-1 italic">
                          Adds +10 storage/cargo slots.
                        </span>
                      </div>
                      <button
                        disabled={craftedItems.woodenChest}
                        onClick={() => craftBlueprint('woodenChest')}
                        className={`px-3 py-1.5 text-xs font-mono font-bold uppercase transition-all ${
                          craftedItems.woodenChest
                            ? 'bg-slate-900 text-emerald-400 border border-emerald-500/10'
                            : 'bg-[#00f5ff] hover:bg-white text-black cursor-pointer'
                        }`}
                      >
                        {craftedItems.woodenChest ? 'CRAFTED' : '[ CRAFT ]'}
                      </button>
                    </div>

                    {/* SCUBA HELMET */}
                    <div className="bg-slate-950/80 border border-white/5 p-2.5 flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">🤿 Scuba Helmet</span>
                          {craftedItems.scubaHelmet && (
                            <span className="text-[8px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-1.5 py-0.5 uppercase font-bold tracking-wider">
                              Crafted
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          Cost: <span className="text-emerald-400">6 Sea Glass</span>, <span className="text-cyan-400">4 Cobalt</span>, <span className="text-slate-300">3 Scrap Metal</span>
                        </span>
                        <span className="text-[9px] text-slate-400 block mt-1 italic">
                          Equip in Character screen (I) for +15 Armor & +20 Max Oxygen.
                        </span>
                      </div>
                      <button
                        disabled={craftedItems.scubaHelmet}
                        onClick={() => craftBlueprint('scubaHelmet')}
                        className={`px-3 py-1.5 text-xs font-mono font-bold uppercase transition-all ${
                          craftedItems.scubaHelmet
                            ? 'bg-slate-900 text-emerald-400 border border-emerald-500/10'
                            : 'bg-[#00f5ff] hover:bg-white text-black cursor-pointer'
                        }`}
                      >
                        {craftedItems.scubaHelmet ? 'CRAFTED' : '[ CRAFT ]'}
                      </button>
                    </div>

                    {/* DIVING SUIT */}
                    <div className="bg-slate-950/80 border border-white/5 p-2.5 flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">🛡️ Diving Suit</span>
                          {craftedItems.divingSuit && (
                            <span className="text-[8px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-1.5 py-0.5 uppercase font-bold tracking-wider">
                              Crafted
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          Cost: <span className="text-cyan-400">8 Cobalt</span>, <span className="text-teal-400">5 Kelp Fiber</span>, <span className="text-slate-300">4 Scrap Metal</span>
                        </span>
                        <span className="text-[9px] text-slate-400 block mt-1 italic">
                          Equip in Character screen (I) for +30 Armor.
                        </span>
                      </div>
                      <button
                        disabled={craftedItems.divingSuit}
                        onClick={() => craftBlueprint('divingSuit')}
                        className={`px-3 py-1.5 text-xs font-mono font-bold uppercase transition-all ${
                          craftedItems.divingSuit
                            ? 'bg-slate-900 text-emerald-400 border border-emerald-500/10'
                            : 'bg-[#00f5ff] hover:bg-white text-black cursor-pointer'
                        }`}
                      >
                        {craftedItems.divingSuit ? 'CRAFTED' : '[ CRAFT ]'}
                      </button>
                    </div>

                    {/* PROPULSION FINS */}
                    <div className="bg-slate-950/80 border border-white/5 p-2.5 flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">🚀 Propulsion Fins</span>
                          {craftedItems.propulsionFins && (
                            <span className="text-[8px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-1.5 py-0.5 uppercase font-bold tracking-wider">
                              Crafted
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          Cost: <span className="text-cyan-400">4 Cobalt</span>, <span className="text-teal-400">4 Kelp Fiber</span>, <span className="text-emerald-400">3 Sea Glass</span>
                        </span>
                        <span className="text-[9px] text-slate-400 block mt-1 italic">
                          Equip in Character screen (I) for +30% swimming speed.
                        </span>
                      </div>
                      <button
                        disabled={craftedItems.propulsionFins}
                        onClick={() => craftBlueprint('propulsionFins')}
                        className={`px-3 py-1.5 text-xs font-mono font-bold uppercase transition-all ${
                          craftedItems.propulsionFins
                            ? 'bg-slate-900 text-emerald-400 border border-emerald-500/10'
                            : 'bg-[#00f5ff] hover:bg-white text-black cursor-pointer'
                        }`}
                      >
                        {craftedItems.propulsionFins ? 'CRAFTED' : '[ CRAFT ]'}
                      </button>
                    </div>
                  </>
                )}

                {activeCategory === 'raft' && (
                  <>
                    <h3 className="text-[9px] text-[#00f5ff] tracking-widest uppercase font-bold border-b border-[#00f5ff]/10 pb-1 mb-2">
                      Raft Infrastructure & Building
                    </h3>

                    {/* MODULAR DECK EXPANSION CONSOLE */}
                    <div className="bg-slate-900 border border-[#00f5ff]/30 p-3 mb-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-[#00f5ff] uppercase tracking-wider">🔨 Modular Deck Expansion</span>
                        <span className="text-[10px] text-amber-500 font-mono font-bold">Cost: {5 + Math.floor(totalTilesCount * 1.5)} Driftwood{totalTilesCount >= 25 ? " + 1 Titanium Bracket" : ""}</span>
                      </div>
                      <p className="text-[10px] text-slate-300 leading-relaxed mb-3">
                        Enter <span className="text-[#00f5ff] font-semibold">Placement Mode</span> to snap-build wooden floor segments anywhere around the perimeter of your raft!
                      </p>
                      
                      <button
                        onClick={() => {
                          setIsPlacementMode((prev) => {
                            const next = !prev;
                            if (next) {
                              setShowTabMenu(false); // close menu so player can look/place
                              addLog("🔨 ENTERED PLACEMENT MODE: Look around the edge of the raft. Green = valid. Red = insufficient wood. Press Left Click or [E] to place, [B] to cancel.");
                            } else {
                              addLog("🔨 EXITED PLACEMENT MODE.");
                            }
                            audioSynth.playPing();
                            return next;
                          });
                        }}
                        className={`w-full py-2 text-xs font-mono font-bold uppercase transition-all tracking-wider ${
                          isPlacementMode
                            ? 'bg-amber-500 text-black hover:bg-amber-400'
                            : 'bg-[#00f5ff] hover:bg-white text-black'
                        }`}
                      >
                        {isPlacementMode ? 'Cancel Placement [B]' : 'Enter Placement Mode [B]'}
                      </button>
                    </div>

                    {/* CUSTOM PLACEABLE STRUCTURES LIST */}
                    {[
                      { id: 'raftSail', label: '⛵ Raft Sail', cost: '10 Driftwood, 5 Biomass, 3 Rare Rope', desc: 'Provides forward drift speed and unlocks course steering.', key: 'raftSail' },
                      { id: 'anchor', label: '⚓ Heavy Iron Anchor', cost: '10 Iron Scraps, 4 Rare Rope', desc: 'Stops the raft completely so you can dive safely.', key: 'anchor' },
                      { id: 'steering_wheel', label: '☸️ Rudder Steering Wheel', cost: '15 Driftwood, 6 Copper Wire', desc: 'Increases course steering velocity by +75%.', key: 'steering_wheel' },
                      { id: 'water_purifier', label: '💧 Saltwater Purifier', cost: '12 Iron Scraps, 5 Copper Wire, 4 Sea Glass', desc: 'Passively distills saltwater into pure drinking water (+25% HP).', key: 'water_purifier' },
                      { id: 'advanced_smelter', label: '🔥 Advanced Smelter', cost: '6 Volcanic Crystals, 12 Iron Scraps', desc: 'Smelts Raw Titanium into strong Titanium Brackets.', key: 'advanced_smelter' },
                      { id: 'crop_plot', label: '🌱 Small Crop Plot', cost: '10 Driftwood, 5 Biomass', desc: 'Plant seeds (1x Biomass) to grow fresh crops (+3 Cooked Food).', key: 'crop_plot' },
                      { id: 'research_table', label: '🔬 Research Table', cost: '15 Driftwood, 8 Copper Wire', desc: 'Analyze deep sea materials to compile blueprint rewards (+150 Coins).', key: 'research_table' },
                      { id: 'wooden_chair', label: '🪑 Wooden Chair', cost: '8 Driftwood', desc: 'Rest on the chair to recuperate health (+15% HP).', key: 'wooden_chair' },
                      { id: 'wooden_table', label: '🪵 Wooden Table', cost: '12 Driftwood', desc: 'A decorative solid wood table for your cozy mobile cabin.', key: 'wooden_table' },
                      { id: 'standing_lantern', label: '🏮 Standing Lantern', cost: '4 Copper Wire, 2 Biomass', desc: 'Features a dusk-to-dawn photocell, illuminating the deck at night.', key: 'standing_lantern' },
                      { id: 'crew_bed', label: '🛌 Crew Quarter Bed', cost: '20 Driftwood, 10 Kelp, 6 Rope, 4 Biomass', desc: 'Sleep to skip the night, heal fully, and set your permanent respawn point.', key: 'crew_bed' },
                    ].map((item) => {
                      const isCrafted = (craftedItems as any)[item.key];
                      return (
                        <div key={item.id} className="bg-slate-950/80 border border-white/5 p-2.5 flex justify-between items-center mb-1.5">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{item.label}</span>
                              {isCrafted && (
                                <span className="text-[8px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-1.5 py-0.5 uppercase font-bold tracking-wider">
                                  Crafted
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500 block mt-0.5">
                              Cost: <span className="text-amber-500">{item.cost}</span>
                            </span>
                            <span className="text-[9px] text-slate-400 block mt-1 italic">
                              {item.desc}
                            </span>
                          </div>
                          <button
                            disabled={isCrafted}
                            onClick={() => craftBlueprint(item.id)}
                            className={`px-3 py-1.5 text-xs font-mono font-bold uppercase transition-all ${
                              isCrafted
                                ? 'bg-slate-900 text-emerald-400 border border-emerald-500/10'
                                : 'bg-[#00f5ff] hover:bg-white text-black cursor-pointer'
                            }`}
                          >
                            {isCrafted ? 'CRAFTED' : '[ CRAFT ]'}
                          </button>
                        </div>
                      );
                    })}
                  </>
                )}

                {activeCategory === 'weapons' && (
                  <>
                    <h3 className="text-[9px] text-[#00f5ff] tracking-widest uppercase font-bold border-b border-[#00f5ff]/10 pb-1 mb-2">
                      Weapons & Defense
                    </h3>

                     {/* HUNTING SPEAR */}
                     <div className="bg-slate-950/80 border border-white/5 p-2.5 flex justify-between items-center mb-2">
                       <div>
                         <div className="flex items-center gap-2">
                           <span className="text-xs font-bold text-white">🔱 Sharpened Scrap Spear</span>
                           {craftedItems.item_spear && (
                             <span className="text-[8px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-1.5 py-0.5 uppercase font-bold tracking-wider">
                               Crafted
                             </span>
                           )}
                         </div>
                         <span className="text-[10px] text-slate-500 block mt-0.5">
                           Cost: <span className="text-amber-500">5 Scrap Wood, 2 Iron Scraps</span>
                         </span>
                         <span className="text-[9px] text-slate-400 block mt-1 italic">
                           A sharpened wood handle tipped with a jagged scrap metal point. Devastating against skeleton threats.
                         </span>
                       </div>
                      <button
                        disabled={craftedItems.item_spear}
                        onClick={() => craftBlueprint('item_spear')}
                        className={`px-3 py-1.5 text-xs font-mono font-bold uppercase transition-all ${
                          craftedItems.item_spear
                            ? 'bg-slate-900 text-emerald-400 border border-emerald-500/10'
                            : 'bg-[#00f5ff] hover:bg-white text-black cursor-pointer'
                        }`}
                      >
                        {craftedItems.item_spear ? 'CRAFTED' : '[ CRAFT SPEAR ]'}
                      </button>
                    </div>

                    {/* HUNTING BOW & ARROW */}
                    <div className="bg-slate-950/80 border border-white/5 p-2.5 flex justify-between items-center mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">🏹 Hunting Bow & Arrow</span>
                          {craftedItems.item_bow && (
                            <span className="text-[8px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-1.5 py-0.5 uppercase font-bold tracking-wider">
                              Crafted
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          Cost: <span className="text-amber-500">6 Driftwood</span>
                        </span>
                        <span className="text-[9px] text-slate-400 block mt-1 italic">
                          A curved low-poly arc bow shooting fast, lethal projectiles at a distance.
                        </span>
                      </div>
                      <button
                        disabled={craftedItems.item_bow}
                        onClick={() => craftBlueprint('item_bow')}
                        className={`px-3 py-1.5 text-xs font-mono font-bold uppercase transition-all ${
                          craftedItems.item_bow
                            ? 'bg-slate-900 text-emerald-400 border border-emerald-500/10'
                            : 'bg-[#00f5ff] hover:bg-white text-black cursor-pointer'
                        }`}
                      >
                        {craftedItems.item_bow ? 'CRAFTED' : '[ CRAFT BOW ]'}
                      </button>
                    </div>

                    {/* OLD HARPOON */}
                    <div className="bg-slate-950/80 border border-white/5 p-2.5 flex justify-between items-center opacity-60">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400">🏹 Advanced Harpoon Combo</span>
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          Cost: <span className="text-amber-500">6 Driftwood</span>, <span className="text-slate-300">3 Scrap Metal</span>, <span className="text-teal-400">4 Kelp</span>
                        </span>
                      </div>
                      <button
                        disabled={craftedItems.huntingBowSpear}
                        onClick={() => craftBlueprint('huntingBowSpear')}
                        className="px-3 py-1.5 text-xs font-mono font-bold uppercase bg-slate-800 text-slate-400 cursor-pointer"
                      >
                        {craftedItems.huntingBowSpear ? 'CRAFTED' : '[ COMBO ]'}
                      </button>
                    </div>
                  </>
                )}

                {activeCategory === 'map' && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center border-b border-[#00f5ff]/10 pb-1.5">
                      <h3 className="text-[10px] text-[#00f5ff] tracking-widest uppercase font-bold font-mono flex items-center gap-1.5">
                        <span>📡 TACTICAL WORLD RADAR GRID</span>
                      </h3>
                      <span className="text-[8px] bg-cyan-500/10 text-[#00f5ff] px-2 py-0.5 animate-pulse font-mono border border-[#00f5ff]/20 uppercase">
                        REAL-TIME PINGING
                      </span>
                    </div>

                    {/* Radar canvas container */}
                    <div className="relative">
                      <canvas
                        id="world-radar-canvas"
                        width={500}
                        height={350}
                        style={{
                          width: '100%',
                          height: '350px',
                          background: 'radial-gradient(circle, #091a24 0%, #030a0f 100%)',
                          border: '1px solid #00f3ff',
                          position: 'relative',
                          overflow: 'hidden',
                          marginTop: '15px',
                        }}
                      />
                    </div>

                    {/* Telemetry coordinate readout text */}
                    <div className="bg-slate-950/90 border border-[#00f5ff]/10 p-2.5 rounded-none flex justify-between items-center font-mono text-[9px] text-[#00f5ff]">
                      <span className="text-slate-500 uppercase">SYSTEM: ACTIVE CONNECTED</span>
                      <span id="radar-coords-text" className="font-bold">
                        {(() => {
                          const raft = raftGroupRef.current;
                          const rx = raft ? Math.floor(raft.position.x) : 0;
                          const rz = raft ? Math.floor(raft.position.z) : 0;
                          return `RAFT COORDS: X: ${rx} | Z: ${rz}`;
                        })()}
                      </span>
                    </div>
                  </div>
                )}

                {activeCategory === 'character_shop' && (
                  <div className="space-y-4">
                    {/* Solana Wallet Panel */}
                    <div className="bg-slate-950/90 border border-purple-500/30 p-3.5 rounded-none text-left space-y-3 shadow-[0_0_15px_rgba(168,85,247,0.05)]">
                      <div className="flex justify-between items-center border-b border-purple-500/10 pb-2">
                        <span className="text-[10px] text-purple-400 font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <span>📡 SIMULATED SOLANA WALLET</span>
                        </span>
                        <span className="text-[8px] bg-purple-500/10 text-purple-400 px-2 py-0.5 font-mono border border-purple-500/20 uppercase rounded">
                          Devnet Connected
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <div className="space-y-0.5">
                          <span className="text-[8px] text-slate-500 font-mono block">WALLET ADDRESS</span>
                          <span className="text-[10px] text-white font-mono font-bold select-all">SolRaftSurvival111111111111111111111111</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[8px] text-slate-500 font-mono block">BALANCE</span>
                          <span className="text-sm font-mono font-black text-purple-400">
                            {solBalance.toFixed(2)} SOL
                          </span>
                        </div>
                      </div>

                      <div className="pt-1.5 flex gap-2">
                        <button
                          onClick={() => {
                            setSolBalance(prev => prev + 1.0);
                            displayNotification("🚰 SOL CLAIMED: Claimed 1.0 SOL Devnet token from the survival faucet!");
                            audioSynth.playPickup();
                          }}
                          className="flex-1 py-1.5 bg-purple-950/40 hover:bg-purple-900/50 border border-purple-500/30 text-purple-300 font-mono text-[9px] font-bold uppercase transition-all cursor-pointer text-center"
                        >
                          🚰 [ Claim 1.0 SOL Faucet ]
                        </button>
                      </div>
                    </div>

                    {/* Day-One Character Store Card Grid */}
                    <div className="space-y-2.5">
                      <h3 className="text-[9px] text-[#00f5ff] tracking-widest uppercase font-bold border-b border-[#00f5ff]/10 pb-1 mb-2">
                        Day-One Limited Editions (Supply Capped)
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {characterShopSkins.map((skin) => {
                          const isSoldOut = skin.totalMinted >= skin.maxSupply;
                          const hasEnoughSOL = solBalance >= skin.priceSOL;
                          
                          const rarityColor = skin.rarity === 'Legendary' ? 'text-amber-400 border-amber-500/20 bg-amber-500/5' :
                                              skin.rarity === 'Mythic' ? 'text-fuchsia-400 border-fuchsia-500/20 bg-fuchsia-500/5' :
                                              'text-slate-400 border-slate-800 bg-slate-900/10';

                          return (
                            <div 
                              key={skin.skinId}
                              className="bg-slate-950/80 border border-white/5 p-3 flex flex-col justify-between space-y-3 rounded-none relative overflow-hidden group hover:border-[#00f5ff]/20 transition-all"
                            >
                              <div className="space-y-1.5 text-left">
                                <div className="flex justify-between items-start">
                                  <span className="text-[20px]">{skin.skinId === "skin_diver_01" ? "🔱" : "🦈"}</span>
                                  <span className={`text-[8px] uppercase tracking-widest px-1.5 py-0.2 border font-mono font-bold ${rarityColor}`}>
                                    {skin.rarity}
                                  </span>
                                </div>
                                <h4 className="text-xs font-mono font-bold text-white tracking-wide">{skin.name}</h4>
                                <span className="text-[9px] text-slate-500 block">
                                  Price: <span className="text-purple-400 font-bold">{skin.priceSOL} SOL</span>
                                </span>

                                {/* Supply bar */}
                                <div className="space-y-1 pt-1">
                                  <div className="flex justify-between text-[8px] font-mono text-slate-500">
                                    <span>SUPPLY MINTED</span>
                                    <span className="text-white font-bold">{skin.totalMinted} / {skin.maxSupply}</span>
                                  </div>
                                  <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                                    <div 
                                      className="bg-gradient-to-r from-purple-500 to-cyan-400 h-full transition-all"
                                      style={{ width: `${(skin.totalMinted / skin.maxSupply) * 100}%` }}
                                    />
                                  </div>
                                </div>
                              </div>

                              <button
                                disabled={isSoldOut || !hasEnoughSOL}
                                onClick={() => {
                                  // Purchase/Mint Skin
                                  setSolBalance(prev => Math.max(0, prev - skin.priceSOL));
                                  
                                  const nextMint = skin.totalMinted + 1;
                                  setCharacterShopSkins(prev => prev.map(s => s.skinId === skin.skinId ? { ...s, totalMinted: nextMint } : s));
                                  
                                  const newSkin = {
                                    skinId: skin.skinId,
                                    name: skin.name,
                                    rarity: skin.rarity,
                                    mintNumber: nextMint,
                                    image: skin.image
                                  };
                                  setOwnedSkins(prev => [...prev, newSkin]);
                                  
                                  displayNotification(`🎉 SUCCESS: Minted ${skin.name} #${nextMint} successfully!`);
                                  addLog(`⛓️ SOLANA MINT: Tokenized ${skin.name} #${nextMint} into wallet after verifying 0.0004 SOL gas fees.`);
                                  audioSynth.playPickup();
                                }}
                                className={`w-full py-1.5 text-xs font-mono font-bold uppercase transition-all ${
                                  isSoldOut 
                                    ? 'bg-slate-900 text-slate-600 border border-slate-950 cursor-not-allowed'
                                    : !hasEnoughSOL 
                                      ? 'bg-purple-950/20 text-purple-500/60 border border-purple-500/10 cursor-not-allowed'
                                      : 'bg-purple-600 hover:bg-[#00f5ff] text-white hover:text-black hover:shadow-[0_0_12px_rgba(0,245,255,0.4)] cursor-pointer'
                                }`}
                              >
                                {isSoldOut ? 'Sold Out' : !hasEnoughSOL ? 'Need more SOL' : 'Mint Character'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Owned Skins Collection */}
                    <div className="space-y-2.5 pt-2 border-t border-white/5">
                      <h3 className="text-[9px] text-[#00f5ff] tracking-widest uppercase font-bold border-b border-[#00f5ff]/10 pb-1 mb-2">
                        Your Custom Character Ledger ({ownedSkins.length})
                      </h3>

                      {ownedSkins.length === 0 ? (
                        <div className="bg-slate-950/40 border border-dashed border-slate-800 p-6 text-center text-slate-500 font-mono text-[10px]">
                          <span className="text-xl block mb-1">🎭</span>
                          No custom character skins currently held in your Solana ledger. Mint skins using SOL, or trade/buy them on the peer-to-peer Marketplace Ledger!
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2">
                          {ownedSkins.map((skin) => {
                            const isEquipped = equippedSkinId === skin.skinId;
                            
                            return (
                              <div 
                                key={`owned_${skin.skinId}_${skin.mintNumber}`}
                                className="bg-slate-950/60 border border-slate-900 p-2.5 flex justify-between items-center"
                              >
                                <div className="text-left font-mono">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[14px]">{skin.skinId === "skin_diver_01" ? "🔱" : "🦈"}</span>
                                    <span className="text-xs font-bold text-white">{skin.name}</span>
                                    <span className="text-amber-400 text-xs font-bold font-black">#{skin.mintNumber}</span>
                                  </div>
                                  <span className="text-[9px] text-slate-500 block uppercase tracking-wider mt-0.5">
                                    Rarity: <strong className="text-slate-400">{skin.rarity}</strong>
                                  </span>
                                </div>

                                <button
                                  onClick={() => {
                                    if (isEquipped) {
                                      setEquippedSkinId('default');
                                      equippedSkinIdRef.current = 'default';
                                      displayNotification("🎭 Default explorer skin equipped.");
                                    } else {
                                      setEquippedSkinId(skin.skinId);
                                      equippedSkinIdRef.current = skin.skinId;
                                      displayNotification(`🎭 Equipped: ${skin.name} #${skin.mintNumber}`);
                                    }
                                    audioSynth.playPickup();
                                  }}
                                  className={`px-3 py-1 text-[10px] font-mono font-bold uppercase transition-all ${
                                    isEquipped 
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer'
                                  }`}
                                >
                                  {isEquipped ? '✓ Equipped' : 'Equip Skin'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- HELP & CONTROLS POPUP --- */}
      <AnimatePresence>
        {showHelpMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-40 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#030712] border border-white/10 max-w-lg w-full rounded-none p-6 shadow-2xl relative"
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
              
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="font-mono text-[9px] text-cyan-400 tracking-widest block">
                    MANUAL & INSTRUCTIONS
                  </span>
                  <h2 className="font-serif italic font-light text-xl text-white">
                    Survival Log & Controls
                  </h2>
                </div>
                <button
                  onClick={() => setShowHelpMenu(false)}
                  className="px-2 py-1 border border-white/10 hover:border-white text-xs hover:text-cyan-400 transition-all cursor-pointer"
                >
                  [ CLOSE ]
                </button>
              </div>

              {/* GAME CONTROLS GRID */}
              <div className="space-y-4 text-xs">
                <div>
                  <h3 className="text-[10px] text-cyan-400 uppercase font-mono tracking-widest mb-1.5 border-b border-white/10 pb-1">
                    Movement & Depth Control
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-slate-300 font-mono text-[11px]">
                    <div>WASD / ARROWS</div>
                    <div className="text-white font-bold">Move Player</div>
                    <div>SPACEBAR</div>
                    <div className="text-white font-bold">Swim Up / Ascend</div>
                    <div>LEFT SHIFT</div>
                    <div className="text-white font-bold">Swim Down / Descend</div>
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] text-cyan-400 uppercase font-mono tracking-widest mb-1.5 border-b border-white/10 pb-1">
                    Camera & View Angle
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-slate-300 font-mono text-[11px]">
                    <div>MOUSE DRAG</div>
                    <div className="text-white font-bold">Rotate & Pitch View</div>
                    <div>I / K (or PgUp/PgDn)</div>
                    <div className="text-white font-bold">Tilt Camera Pitch</div>
                    <div>O / L (or Home/End)</div>
                    <div className="text-white font-bold">Zoom In / Out</div>
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] text-cyan-400 uppercase font-mono tracking-widest mb-1.5 border-b border-white/10 pb-1">
                    Interactions & Sustenance
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-slate-300 font-mono text-[11px]">
                    <div>E KEY</div>
                    <div className="text-white font-bold">Chop Tree / Gather Items</div>
                    <div>U KEY</div>
                    <div className="text-white font-bold">Consume Foraged Food</div>
                    <div>I KEY</div>
                    <div className="text-white font-bold">Open Scuba Cargo Inventory</div>
                    <div>TAB KEY</div>
                    <div className="text-white font-bold">Tactical Crafting & Upgrades</div>
                  </div>
                </div>

                {/* HISTORICAL LIVE CHAT LOGS */}
                <div>
                  <h3 className="text-[10px] text-amber-400 uppercase font-mono tracking-widest mb-1.5 border-b border-amber-400/20 pb-1">
                    Telemetry Logs (History)
                  </h3>
                  <div className="bg-slate-950 p-2.5 max-h-36 overflow-y-auto border border-white/5 space-y-1 scrollbar-thin">
                    {logs.map((log, idx) => (
                      <div key={idx} className="text-[10px] leading-relaxed text-slate-400 font-mono">
                        <span className="text-slate-600 font-bold mr-1">&gt;</span> {log}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- FULLSCREEN MARKET OVERLAY --- */}
      <AnimatePresence>
        {showMarketplace && (
          <motion.div
            id="fullscreen-market-overlay"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 9999,
              background: 'rgba(5, 12, 16, 0.98)',
              overflowY: 'auto',
            }}
            className="p-8 text-white font-sans selection:bg-amber-500/30 selection:text-white"
          >
            {/* Header of the Layer */}
            <div className="flex justify-between items-center border-b border-amber-500/20 pb-4 mb-6">
              <div>
                <h1 className="text-2xl font-mono font-black text-amber-400 tracking-wider flex items-center gap-2">
                  <span>🌐 DYNAMIC GLOBAL LEDGER & MARKET BOARD</span>
                  <span className="text-[9px] bg-amber-500/10 text-amber-400 px-2 py-0.5 animate-pulse font-mono border border-amber-500/20 rounded">
                    PEER-TO-PEER P2P DISTRIBUTED SYNCED
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Directly query the global decentralized maritime asset registry. Trade your salvaged junk and rare components with wandering deep-sea survivors!
                </p>
              </div>
              <button
                onClick={() => {
                  setShowMarketplace(false);
                  audioSynth.playPing();
                }}
                className="bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/40 text-rose-300 font-mono text-xs font-bold px-4 py-2 hover:text-white transition-all cursor-pointer active:scale-95"
              >
                [ CLOSE MARKET AND RETURN TO RAFT ]
              </button>
            </div>

            {/* Widescreen 3-Column Economy Grid */}
            <div className="grid grid-cols-12 gap-6 items-start">
              {/* LEFT COLUMN: Filters and Search (20% Width -> col-span-3) */}
              <div className="col-span-3 space-y-6">
                {/* MASSIVE GILDED COIN BALANCE */}
                <div className="bg-slate-900/60 border border-amber-500/20 p-4 rounded-sm shadow-[0_0_15px_rgba(245,158,11,0.03)] text-left">
                  <span className="text-[9px] text-amber-500/80 font-mono font-bold tracking-widest block mb-1">
                    OFFICIAL COIN BALANCE
                  </span>
                  <div className="font-serif italic font-extrabold text-4xl text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 drop-shadow-[0_2px_10px_rgba(245,158,11,0.3)] select-all">
                    💰 {resources.money || 0}
                  </div>
                  <span className="text-[8px] text-slate-500 font-mono mt-1 block">
                    Exchangeable with any peer network.
                  </span>
                </div>

                {/* SEARCH INPUT */}
                <div className="bg-slate-950/90 border border-[#00f5ff]/10 p-3.5 rounded-sm text-left space-y-2">
                  <label className="text-[9px] text-[#00f5ff] font-mono uppercase font-bold tracking-wider">
                    🔍 Search Asset Ledger
                  </label>
                  <input
                    type="text"
                    placeholder="Type item name..."
                    value={marketSearchText}
                    onChange={(e) => setMarketSearchText(e.target.value)}
                    className="w-full bg-slate-900 text-xs border border-slate-700 px-2 py-1.5 text-white font-mono placeholder-slate-600 focus:outline-none focus:border-[#00f5ff]/50"
                  />
                </div>

                {/* CATEGORY FILTERS */}
                <div className="bg-slate-950/90 border border-white/5 p-4 rounded-sm text-left space-y-2.5">
                  <span className="text-[9px] text-slate-400 font-mono uppercase font-bold tracking-wider">
                    🗂️ Category Index
                  </span>
                  <div className="flex flex-col gap-1.5 font-mono text-[11px]">
                    {(['all', 'weapons', 'materials', 'mythics'] as const).map((filter) => {
                      const isActive = marketFilter === filter;
                      const label = filter === 'all' ? 'Browse All' :
                                    filter === 'weapons' ? 'Browse Weapons' :
                                    filter === 'materials' ? 'Browse Raw Mats' :
                                    'Browse Mythics';
                      return (
                        <button
                          key={filter}
                          onClick={() => {
                            setMarketFilter(filter);
                            audioSynth.playPing();
                          }}
                          className={`w-full py-2 px-3 text-left transition-all border ${
                            isActive
                              ? 'bg-[#00f5ff]/10 text-[#00f5ff] border-[#00f5ff]/30 font-bold'
                              : 'bg-slate-900/40 text-slate-400 border-transparent hover:text-white hover:bg-slate-900'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* CENTER COLUMN: The Global Order Ledger (55% Width -> col-span-6) */}
              <div className="col-span-6">
                {(() => {
                  const filteredOrders = globalMarketOrders.filter((order) => {
                    if (marketSearchText && !order.itemName.toLowerCase().includes(marketSearchText.toLowerCase())) {
                      return false;
                    }
                    if (marketFilter === 'weapons') {
                      const weaponNames = ['Stone Axe', 'Hunting Spear', 'Hunting Bow & Arrow', 'Fishing Rod'];
                      return weaponNames.includes(order.itemName);
                    }
                    if (marketFilter === 'materials') {
                      const materialNames = ['Driftwood', 'Scrap Metal', 'Stones', 'Sea Glass', 'Biomass', 'Rare Rope'];
                      return materialNames.includes(order.itemName);
                    }
                    if (marketFilter === 'mythics') {
                      const mythicNames = ['Titanium Bracket', 'Skeleton King Core'];
                      return mythicNames.includes(order.itemName) || !!order.isSkin;
                    }
                    return true;
                  });

                  return (
                    <div className="bg-slate-950/80 border border-[#00f5ff]/15 p-5 flex flex-col h-[calc(100vh-160px)] rounded-sm">
                      <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/10">
                        <h3 className="text-sm font-mono font-bold text-[#00f5ff] uppercase tracking-widest">
                          📥 GLOBAL RETRIEVAL REGISTER ({filteredOrders.length})
                        </h3>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Ledger verified • Peer connections: online
                        </span>
                      </div>

                      {filteredOrders.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-20 px-6 border border-dashed border-slate-800 text-center rounded-sm">
                          <span className="text-4xl mb-4 opacity-30">📭</span>
                          <p className="text-sm text-slate-400 font-mono leading-relaxed max-w-md">
                            {globalMarketOrders.length === 0 
                              ? "No active listings on the market. Post an item from your cargo bags to begin trading!"
                              : "No active listings match your filter selections."}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3 overflow-y-auto pr-1 flex-1 scrollbar-thin">
                          {filteredOrders.map((order) => {
                            const isOwnListing = order.seller === 'You';
                            const rarityBadgeColor = 
                              order.itemName === 'Titanium Bracket' || order.rarity === 'Legendary' ? 'text-amber-400 border-amber-500/20 bg-amber-500/5' :
                              order.itemName === 'Skeleton King Core' || order.rarity === 'Mythic' ? 'text-fuchsia-400 border-fuchsia-500/20 bg-fuchsia-500/5' :
                              order.itemName === 'Rare Rope' ? 'text-purple-400 border-purple-500/20 bg-purple-500/5' :
                              'text-slate-400 border-slate-800 bg-slate-900/10';

                            return (
                              <div 
                                key={order.orderId} 
                                className="bg-slate-900/80 border border-slate-800 hover:border-[#00f5ff]/30 p-4 flex justify-between items-center transition-all duration-150 rounded-sm hover:shadow-[0_0_15px_rgba(0,245,255,0.03)]"
                              >
                                <div className="space-y-1.5 text-left">
                                  <div className="flex items-center gap-3">
                                    <span className="text-lg font-mono font-bold text-white">{order.itemName}</span>
                                    <span className="text-xs bg-slate-800 px-2 py-0.5 text-slate-400 font-mono font-bold">
                                      QTY: {order.quantity}
                                    </span>
                                    <span className={`text-[9px] uppercase tracking-widest px-2 py-0.5 border ${rarityBadgeColor}`}>
                                      {order.isSkin ? order.rarity : (
                                       order.itemName === 'Titanium Bracket' ? 'Legendary' :
                                       order.itemName === 'Skeleton King Core' ? 'Mythic' :
                                       order.itemName === 'Rare Rope' ? 'Rare' : 'Common'
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono">
                                    <span>ORDER REF: <strong className="text-slate-400">{order.orderId}</strong></span>
                                    <span>•</span>
                                    <span className={isOwnListing ? "text-amber-400" : "text-cyan-400 font-bold"}>
                                      {isOwnListing ? "Seller: You (Tax-Free)" : `Seller: ${order.seller}`}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-4">
                                  <div className="text-right pr-2">
                                    <span className="text-lg font-mono font-bold text-amber-300 block">
                                      💰 {order.askingPrice}
                                    </span>
                                    <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">
                                      Asking Price
                                    </span>
                                  </div>

                                  <button
                                    onClick={() => {
                                      if (order.isSkin) {
                                        if (isOwnListing) {
                                          setOwnedSkins(prev => [...prev, {
                                            skinId: order.skinId!,
                                            name: order.itemName.split(' #')[0],
                                            rarity: order.rarity!,
                                            mintNumber: order.mintNumber!,
                                            image: order.skinId === "skin_diver_01" ? "alpha_diver.png" : "shark_slayer.png"
                                          }]);
                                          setGlobalMarketOrders(prev => prev.filter(o => o.orderId !== order.orderId));
                                          displayNotification(`📤 Cancelled listing for ${order.itemName}! Skin returned to inventory.`);
                                          addLog(`🌐 MARKETPLACE CANCEL: Cancelled trade list order ${order.orderId} of ${order.itemName}.`);
                                          audioSynth.playPickup();
                                        } else {
                                          if ((resources.money || 0) < order.askingPrice) {
                                            displayNotification("⚠️ INSUFFICIENT FUNDS: You need more Coins to buy this!");
                                            audioSynth.playPing();
                                            return;
                                          }
                                          setResources(prev => ({
                                            ...prev,
                                            money: Math.max(0, (prev.money || 0) - order.askingPrice)
                                          }));
                                          setOwnedSkins(prev => [...prev, {
                                            skinId: order.skinId!,
                                            name: order.itemName.split(' #')[0],
                                            rarity: order.rarity!,
                                            mintNumber: order.mintNumber!,
                                            image: order.skinId === "skin_diver_01" ? "alpha_diver.png" : "shark_slayer.png"
                                          }]);
                                          setGlobalMarketOrders(prev => prev.filter(o => o.orderId !== order.orderId));
                                          displayNotification(`🤝 Purchased ${order.itemName} for ${order.askingPrice} Coins!`);
                                          addLog(`🌐 MARKETPLACE BUY: Purchased trade listing ${order.orderId} of ${order.itemName} from ${order.seller} for ${order.askingPrice} Coins.`);
                                          audioSynth.playPickup();
                                        }
                                        return;
                                      }

                                      const resKey = order.itemName === "Titanium Bracket" ? "titaniumBracket" :
                                                     order.itemName === "Skeleton King Core" ? "skeletonKingCore" :
                                                     order.itemName === "Driftwood" ? "driftwood" :
                                                     order.itemName === "Rare Rope" ? "rope" :
                                                     order.itemName === "Stones" ? "stones" :
                                                     order.itemName === "Sea Glass" ? "seaGlass" :
                                                     order.itemName === "Scrap Metal" ? "scrapMetal" :
                                                     order.itemName === "Biomass" ? "biomass" : "";
 
                                      if (isOwnListing) {
                                        if (resKey) {
                                          setResources(prev => ({
                                            ...prev,
                                            [resKey]: (prev[resKey] || 0) + order.quantity
                                          }));
                                        }
                                        setGlobalMarketOrders(prev => prev.filter(o => o.orderId !== order.orderId));
                                        displayNotification(`📤 Cancelled listing for ${order.itemName}! Items returned.`);
                                        addLog(`🌐 MARKETPLACE CANCEL: Cancelled trade list order ${order.orderId} of ${order.quantity}x ${order.itemName}.`);
                                        audioSynth.playPickup();
                                      } else {
                                        if ((resources.money || 0) < order.askingPrice) {
                                          displayNotification("⚠️ INSUFFICIENT FUNDS: You need more Coins to buy this!");
                                          audioSynth.playPing();
                                          return;
                                        }
                                        setResources(prev => ({
                                          ...prev,
                                          money: Math.max(0, (prev.money || 0) - order.askingPrice),
                                          [resKey]: (prev[resKey] || 0) + order.quantity
                                        }));
                                        setGlobalMarketOrders(prev => prev.filter(o => o.orderId !== order.orderId));
                                        displayNotification(`🤝 Purchased ${order.quantity}x ${order.itemName} for ${order.askingPrice} Coins!`);
                                        addLog(`🌐 MARKETPLACE BUY: Purchased trade listing ${order.orderId} of ${order.quantity}x ${order.itemName} from ${order.seller} for ${order.askingPrice} Coins.`);
                                        audioSynth.playPickup();
                                      }
                                    }}
                                    className={`px-4 py-2 text-xs font-mono font-bold uppercase transition-all rounded-sm shadow-md active:scale-95 ${
                                      isOwnListing
                                        ? 'bg-rose-950/60 text-rose-400 border border-rose-500/30 hover:bg-rose-900/50 cursor-pointer'
                                        : 'bg-[#00f5ff] text-black hover:bg-white cursor-pointer hover:shadow-[0_0_12px_rgba(0,245,255,0.4)]'
                                    }`}
                                  >
                                    {isOwnListing ? 'Cancel' : 'Buy'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* RIGHT COLUMN: Cargo Bags / Sell Interface (25% Width -> col-span-3) */}
              <div className="col-span-3 bg-slate-950/80 border border-white/5 p-5 h-[calc(100vh-160px)] flex flex-col rounded-sm">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/10">
                  <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-widest">
                    📤 YOUR CARGO BAGS (SELL)
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Select & List Assets
                  </span>
                </div>

                <div className="space-y-4 overflow-y-auto pr-1 flex-1 scrollbar-thin">
                  {playerInventory.map((item) => {
                    const hasStock = item.quantity > 0;
                    
                    const inputState = sellInputs[item.name] || {
                      quantity: 1,
                      price: Math.floor(item.rarity === 'Legendary' ? 120 : item.rarity === 'Mythic' ? 350 : item.rarity === 'Rare' ? 60 : 15)
                    };
                    
                    const setQty = (val: number) => {
                      const q = Math.max(1, Math.min(item.quantity, val));
                      setSellInputs(prev => ({
                        ...prev,
                        [item.name]: { ...inputState, quantity: q }
                      }));
                    };
                    
                    const setPrice = (val: number) => {
                      const p = Math.max(1, val);
                      setSellInputs(prev => ({
                        ...prev,
                        [item.name]: { ...inputState, price: p }
                      }));
                    };

                    const rarityColor = item.rarity === 'Legendary' ? 'text-amber-400 border-amber-500/20 bg-amber-500/5' :
                                        item.rarity === 'Mythic' ? 'text-fuchsia-400 border-fuchsia-500/20 bg-fuchsia-500/5' :
                                        item.rarity === 'Rare' ? 'text-purple-400 border-purple-500/20 bg-purple-500/5' :
                                        'text-slate-400 border-slate-800 bg-slate-900/10';

                    return (
                      <div 
                        key={item.id} 
                        className={`bg-slate-900/40 border p-4 rounded-sm space-y-3 transition-all text-left ${
                          hasStock ? 'border-slate-800 hover:border-slate-700' : 'border-slate-950 opacity-20'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <h4 className="text-sm font-mono font-bold text-white tracking-wide">{item.name}</h4>
                            <div className="flex items-center gap-2">
                              <span className={`text-[8px] uppercase tracking-widest px-1.5 py-0.2 border ${rarityColor}`}>
                                {item.rarity}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                Stock: <strong className="text-white">{item.quantity}</strong>
                              </span>
                            </div>
                          </div>
                        </div>

                        {hasStock && (
                          <div className="pt-2 border-t border-slate-800 text-xs font-mono space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1 text-left">
                                <span className="text-[8px] text-slate-400 uppercase tracking-widest font-bold">QTY</span>
                                <input
                                  type="number"
                                  min="1"
                                  max={item.quantity}
                                  value={inputState.quantity}
                                  onChange={(e) => setQty(parseInt(e.target.value) || 1)}
                                  className="w-full bg-slate-950 text-white font-mono font-black text-center text-sm border border-slate-700 py-1 focus:outline-none focus:border-[#00f5ff]"
                                />
                              </div>

                              <div className="space-y-1 text-left">
                                <span className="text-[8px] text-slate-400 uppercase tracking-widest font-bold">COINS</span>
                                <input
                                  type="number"
                                  min="1"
                                  value={inputState.price}
                                  onChange={(e) => setPrice(parseInt(e.target.value) || 1)}
                                  className="w-full bg-slate-950 text-amber-300 font-mono font-black text-center text-sm border border-slate-700 py-1 focus:outline-none focus:border-amber-400"
                                />
                              </div>
                            </div>

                            <button
                              onClick={() => {
                                const resKey = item.name === "Iron Scraps" ? "ironScraps" :
                                               item.name === "Silica Sand" ? "silicaSand" :
                                               item.name === "Copper Wire" ? "copperWire" :
                                               item.name === "Raw Titanium" ? "rawTitanium" :
                                               item.name === "Volcanic Crystals" ? "volcanicCrystals" :
                                               item.name === "Lithium Battery Packs" ? "lithiumBatteryPacks" :
                                               item.name === "Deep-Sea Uranium" ? "deepSeaUranium" :
                                               item.name === "Ancient Relic Fragments" ? "ancientRelicFragments" :
                                               item.name === "Corrupted AI Chips" ? "corruptedAIChips" :
                                               item.name === "Black Box Core" ? "blackBoxCore" :
                                               item.name === "Singularity Shard" ? "singularityShard" :
                                               item.name === "Glitch Artifact" ? "glitchArtifact" :
                                               item.name === "Titanium Harpoon" ? "titaniumHarpoon" :
                                               item.name === "Magnetic Scanner" ? "magneticScanner" :
                                               item.name === "Kinetic Drill" ? "kineticDrill" :
                                               item.name === "Thermal Regulators" ? "thermalRegulators" :
                                               item.name === "High-Capacity Oxygen Rebreather" ? "highCapacityOxygenRebreather" :
                                               item.name === "Glitch Sub-Drive Mk1" ? "glitchSubDriveMk1" :
                                               item.name === "Reinforced Hull Plating" ? "reinforcedHullPlating" :
                                               item.name === "Bio-Filter Suit" ? "bioFilterSuit" :
                                               item.name === "EMP Pulse Module" ? "empPulseModule" :
                                               item.name === "Titanium Bracket" ? "titaniumBracket" :
                                               item.name === "Skeleton King Core" ? "skeletonKingCore" :
                                               item.name === "Driftwood" ? "driftwood" :
                                               item.name === "Rare Rope" ? "rope" :
                                               item.name === "Stones" ? "stones" :
                                               item.name === "Sea Glass" ? "seaGlass" :
                                               item.name === "Scrap Metal" ? "scrapMetal" :
                                               item.name === "Biomass" ? "biomass" : "";

                                if (!resKey) return;
                                if ((resources[resKey] || 0) < inputState.quantity) {
                                  displayNotification("⚠️ INSUFFICIENT ITEMS: You don't have enough in cargo bags!");
                                  return;
                                }

                                setResources(prev => ({
                                  ...prev,
                                  [resKey]: Math.max(0, (prev[resKey] || 0) - inputState.quantity)
                                }));

                                const ordId = "ORD_" + Math.floor(1000 + Math.random() * 9000);
                                const newOrder = {
                                  orderId: ordId,
                                  seller: "You",
                                  itemName: item.name,
                                  quantity: inputState.quantity,
                                  askingPrice: inputState.price
                                };

                                setGlobalMarketOrders(prev => [newOrder, ...prev]);
                                displayNotification(`Successfully listed ${inputState.quantity}x ${item.name} for ${inputState.price} Coins!`);
                                addLog(`🌐 MARKETPLACE LISTING: Created list trade order ${ordId} for ${inputState.quantity}x ${item.name} demanding ${inputState.price} Coins.`);
                                audioSynth.playPickup();
                              }}
                              className="w-full py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 border border-amber-500/30 hover:border-amber-400 font-mono font-black uppercase transition-all duration-100 cursor-pointer rounded-sm text-[10px]"
                            >
                              Publish order
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* OWNED SKINS SELL SECTION */}
                  {ownedSkins.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-slate-800 text-left space-y-3">
                      <h4 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                        <span>🎭 YOUR CHARACTER SKINS ({ownedSkins.length})</span>
                      </h4>
                      {ownedSkins.map((skin) => {
                        const uniqueKey = `skin_${skin.skinId}_${skin.mintNumber}`;
                        const inputState = sellInputs[uniqueKey] || {
                          quantity: 1,
                          price: skin.rarity === 'Mythic' ? 450 : 250
                        };

                        const setPrice = (val: number) => {
                          const p = Math.max(1, val);
                          setSellInputs(prev => ({
                            ...prev,
                            [uniqueKey]: { ...inputState, price: p }
                          }));
                        };

                        const rarityColor = skin.rarity === 'Legendary' ? 'text-amber-400 border-amber-500/20 bg-amber-500/5' :
                                            skin.rarity === 'Mythic' ? 'text-fuchsia-400 border-fuchsia-500/20 bg-fuchsia-500/5' :
                                            'text-slate-400 border-slate-800 bg-slate-900/10';

                        return (
                          <div 
                            key={`sell_${uniqueKey}`} 
                            className="bg-slate-900/40 border border-slate-800 p-3 rounded-sm space-y-2.5 text-left"
                          >
                            <div className="space-y-1">
                              <h5 className="text-xs font-mono font-bold text-white">
                                {skin.name} <span className="text-amber-400 font-black">#{skin.mintNumber}</span>
                              </h5>
                              <span className={`text-[8px] uppercase tracking-widest px-1.5 py-0.2 border ${rarityColor}`}>
                                {skin.rarity}
                              </span>
                            </div>

                            <div className="pt-2 border-t border-slate-800/60 text-xs font-mono space-y-2">
                              <div className="space-y-1">
                                <span className="text-[8px] text-slate-400 uppercase tracking-widest font-bold font-black font-mono">ASKING COINS</span>
                                <input
                                  type="number"
                                  min="1"
                                  value={inputState.price}
                                  onChange={(e) => setPrice(parseInt(e.target.value) || 1)}
                                  className="w-full bg-slate-950 text-amber-300 font-mono font-black text-center text-sm border border-slate-700 py-1 focus:outline-none focus:border-amber-400"
                                />
                              </div>

                              <button
                                onClick={() => {
                                  // Unequip if currently equipped
                                  if (equippedSkinId === skin.skinId) {
                                    setEquippedSkinId('default');
                                    equippedSkinIdRef.current = 'default';
                                  }
                                  
                                  // Remove from owned skins state
                                  setOwnedSkins(prev => prev.filter(s => !(s.skinId === skin.skinId && s.mintNumber === skin.mintNumber)));

                                  const ordId = "ORD_SKIN_" + Math.floor(1000 + Math.random() * 9000);
                                  const newOrder = {
                                    orderId: ordId,
                                    seller: "You",
                                    itemName: `${skin.name} #${skin.mintNumber}`,
                                    quantity: 1,
                                    askingPrice: inputState.price,
                                    isSkin: true,
                                    skinId: skin.skinId,
                                    mintNumber: skin.mintNumber,
                                    rarity: skin.rarity
                                  };

                                  setGlobalMarketOrders(prev => [newOrder, ...prev]);
                                  displayNotification(`Successfully listed ${skin.name} #${skin.mintNumber} for ${inputState.price} Coins!`);
                                  addLog(`🌐 MARKETPLACE LISTING: Created list trade order ${ordId} for skin ${skin.name} #${skin.mintNumber} demanding ${inputState.price} Coins.`);
                                  audioSynth.playPickup();
                                }}
                                className="w-full py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 border border-amber-500/30 hover:border-amber-400 font-mono font-bold uppercase transition-all duration-100 cursor-pointer rounded-sm text-[9px]"
                              >
                                Publish skin list
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- INVENTORY MENU POPUP --- */}
      <AnimatePresence>
        {showInventoryMenu && (
          <CharacterInventoryScreen
            isOpen={showInventoryMenu}
            onClose={() => setShowInventoryMenu(false)}
            resources={resources}
            setResources={setResources}
            hunger={hunger}
            setHunger={setHunger}
            setHealth={setHealth}
            craftedItems={craftedItems}
            equippedItems={equippedItems}
            setEquippedItems={setEquippedItems}
            addLog={addLog}
            audioSynth={audioSynth}
          />
        )}
      </AnimatePresence>

      {/* --- CHEST INVENTORY POPUP --- */}
      <AnimatePresence>
        {activeChestIndex !== null && placedChestsState[activeChestIndex] && (
          <ChestInventoryModal
            isOpen={activeChestIndex !== null}
            onClose={() => setActiveChestIndex(null)}
            chestCoordinates={{
              x: placedChestsState[activeChestIndex].x,
              z: placedChestsState[activeChestIndex].z,
            }}
            chestInventory={placedChestsState[activeChestIndex].inventory}
            playerInventory={resources}
            setResources={setResources}
            onUpdateChestInventory={(newInv) => {
              // Update state
              setPlacedChestsState((prev) => {
                const next = [...prev];
                next[activeChestIndex] = {
                  ...next[activeChestIndex],
                  inventory: newInv,
                };
                return next;
              });
              // Update reference
              if (placedChestsRef.current[activeChestIndex]) {
                placedChestsRef.current[activeChestIndex].inventory = newInv;
              }
              // Trigger update force re-render
              setChestUpdateCounter((prev) => prev + 1);
            }}
            audioSynth={audioSynth}
          />
        )}
      </AnimatePresence>

      {/* --- GAMEOVER OVERLAY --- */}
      <AnimatePresence>
        {isGameOver && (
          <div className="absolute inset-0 bg-slate-950/90 z-40 flex flex-col items-center justify-center p-4">
            <span className="font-mono text-[#ef4444] text-[10px] tracking-[0.35em] uppercase mb-1">
              LIFE SUPPORT SYSTEM OFFLINE
            </span>
            <h1 className="font-serif italic font-light text-4xl text-white tracking-tight mb-5">
              Diver Depleted
            </h1>
            <p className="text-gray-400 font-sans text-xs max-w-sm text-center leading-relaxed mb-6">
              Your oxygen reserves reached absolute zero. Any loose materials currently held in your scuba pack were lost to the abyss depths.
            </p>
            <button
              onClick={handleRestart}
              className="px-6 py-3 bg-[#00f5ff] hover:bg-white text-black font-mono font-bold text-xs uppercase tracking-[0.15em] transition-colors rounded-none cursor-pointer"
            >
              Reboot Mission & Retain Upgrades
            </button>
          </div>
        )}
      </AnimatePresence>

      {/* --- STARVATION DEATH ALERT OVERLAY --- */}
      <AnimatePresence>
        {starvationDeathAlert && (
          <div className="absolute inset-0 bg-slate-950/95 z-50 flex flex-col items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="bg-black/80 border-4 border-red-600 p-8 max-w-md rounded-2xl shadow-[0_0_30px_rgba(220,38,38,0.4)] flex flex-col items-center text-center relative overflow-hidden pointer-events-auto"
            >
              {/* Flashing skull icon */}
              <div className="w-16 h-16 bg-red-600/20 border-2 border-red-600 rounded-full flex items-center justify-center mb-4 animate-bounce">
                <span className="text-3xl">💀</span>
              </div>
              
              <span className="font-mono text-red-500 text-xs tracking-[0.3em] uppercase mb-2 animate-pulse font-extrabold">
                CRITICAL INSUFFICIENT NUTRIENTS
              </span>
              
              <h1 className="font-sans font-black text-3xl text-white tracking-tight uppercase mb-4 text-red-600 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                YOU DIED OF STARVATION
              </h1>
              
              <p className="text-gray-300 font-sans text-xs max-w-xs leading-relaxed mb-6">
                Your biological vitals hit absolute zero due to long-term severe starvation. Your raft and inventory have been salvage-teleported back to the safe baseline coordinates.
              </p>
              
              <button
                onClick={() => {
                  setStarvationDeathAlert(false);
                }}
                className="px-8 py-3 bg-red-600 hover:bg-white hover:text-red-600 text-white font-mono font-bold text-xs uppercase tracking-[0.2em] transition-all rounded-xl cursor-pointer shadow-[0_4px_12px_rgba(220,38,38,0.3)] hover:scale-105 active:scale-95"
              >
                Re-awaken on Raft
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
