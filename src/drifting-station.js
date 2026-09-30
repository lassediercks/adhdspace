import * as THREE from 'three';
import { toonMaterial, facetedGeometry } from './toon-style.js';

// A balanced, non-directional silhouette: no cockpit, nose, or drive exhaust.
// Its attitude stays fixed as gravity changes the flight path.
export function createDriftingStation() {
 const station=new THREE.Group();station.name='Drifting space station';
 const hull=toonMaterial(0xc4ceca),structure=toonMaterial(0x34413f);
 const solar=toonMaterial(0x587d88),windows=toonMaterial(0xa4d8c7);
 const add=(geometry,material,position=[0,0,0])=>{
  const part=new THREE.Mesh(facetedGeometry(geometry),material);
  part.position.set(...position);station.add(part);return part;
 };
 const box=(size,position,material)=>add(new THREE.BoxGeometry(...size),material,position);
 add(new THREE.CylinderGeometry(.62,.62,1.5,8),hull);
 add(new THREE.CylinderGeometry(.66,.66,.22,8),windows,[0,.35,0]);
 for(const side of [-1,1]) {
  // Docking ports on opposite faces keep either end from reading as an engine.
  add(new THREE.CylinderGeometry(.36,.36,.35,8),structure,[0,side*.87,0]);
  add(new THREE.CylinderGeometry(.23,.23,.37,8),hull,[0,side*.87,0]);
  const module=add(new THREE.CylinderGeometry(.36,.36,1.45,8),hull,[0,0,side*.95]);
  module.rotation.x=Math.PI/2;
  box([4.4,.12,.14],[0,0,side*.95],structure);
  for(const arm of [-1,1]) {
   box([1.38,.09,1.12],[arm*1.48,0,side*.95],solar);
   // Just two broad cells per wing keep surface detail restrained.
   box([.04,.105,1.12],[arm*1.48,0,side*.95],hull);
  }
 }
 station.rotation.set(.35,.25,.3);
 return station;
}
