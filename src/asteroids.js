import { stationKey } from './navigation.js';
import * as THREE from 'three';
import { advanceFlybyField, spawnAsteroid, ASTEROID_COUNT } from './flyby-motion.js';
import { toonMaterial, facetedGeometry } from './toon-style.js';

function asteroidGeometry(definition, seed) {
  if(definition.kind==='station') {
    const geometry=new THREE.TorusGeometry(.78,.18,4,12);
    geometry.rotateY(Math.PI/2);return facetedGeometry(geometry);
  }
  const geometry = facetedGeometry(new THREE.IcosahedronGeometry(1, definition.radius < 1.2 ? 0 : 1));
  const positions = geometry.attributes.position;
  let extent = 0;
  // A coordinate-based deformation keeps shared triangle vertices welded.
  for(let i=0;i<positions.count;i++) {
    const x=positions.getX(i), y=positions.getY(i), z=positions.getZ(i);
    const noise=Math.sin(x*4.1+seed)*Math.cos(y*3.7-seed*.6)*Math.sin(z*5.3+seed*.3);
    const dent=Math.max(0,x*.6+y*.4-z*.7)*definition.roughness*.5;
    const scale=1+noise*definition.roughness-dent;
    const px=x*definition.shape[0]*scale,py=y*definition.shape[1]*scale,pz=z*definition.shape[2]*scale;
    positions.setXYZ(i,px,py,pz);
    extent=Math.max(extent,Math.hypot(px,py,pz));
  }
  // Every silhouette fits its physics bounding sphere, including while tumbling.
  geometry.scale(1/extent,1/extent,1/extent);
  geometry.computeVertexNormals();
  return geometry;
}

export class PassingAsteroids {
  constructor(scene, {seed=crypto.getRandomValues(new Uint32Array(1))[0]}={}) {
    this.seed=seed;
    const pixels=new Uint8Array(32*32*4);
    for(let y=0;y<32;y++)for(let x=0;x<32;x++){
      const i=(y*32+x)*4,r=Math.hypot((x-15.5)/15.5,(y-15.5)/15.5);
      pixels.set([255,255,255,Math.round(150*Math.max(0,1-r)**2)],i);
    }
    const glowTexture=new THREE.DataTexture(pixels,32,32);glowTexture.needsUpdate=true;
    this.glowMaterial=new THREE.SpriteMaterial({map:glowTexture,color:0x4ba9ff,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false});
    this.travel = 0;
    this.sources = [];
    this.asteroids = Array.from({length:ASTEROID_COUNT},(_,index) => {
      const definition=spawnAsteroid(index,seed);
      const group = new THREE.Group();
      scene.add(group);
      group.position.set(definition.x,definition.y,definition.z);
      const geometry = asteroidGeometry(definition,definition.geometrySeed);
      const surface = new THREE.Mesh(geometry, toonMaterial(definition.colors[0]));
      surface.scale.setScalar(definition.radius);
      surface.rotation.z = 0.18 + index * 0.23;
      group.add(surface);
      const outline = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({color:0x090f20, side:THREE.BackSide}));
      outline.scale.setScalar(1.025);
      surface.add(outline);
      const glow=new THREE.Sprite(this.glowMaterial);group.add(glow);
      const asteroid={definition,group,surface,outline,glow};
      this.updateStationStyle(asteroid,definition);
      return asteroid;
    });
    this.update(0);
  }

  updateStationStyle(asteroid,source) {
    const station=source.kind==='station';
    asteroid.glow.visible=station;asteroid.glow.scale.setScalar(source.radius*4);
    asteroid.surface.material.emissive.setHex(station?0x2168a0:0);
    asteroid.surface.material.emissiveIntensity=station?.55:0;
  }

  applySpawn(asteroid,source) {
    const geometry=asteroidGeometry(source,source.geometrySeed);
    asteroid.surface.geometry.dispose();
    asteroid.surface.geometry=asteroid.outline.geometry=geometry;
    asteroid.surface.scale.setScalar(source.radius);
    asteroid.surface.material.color.set(source.colors[0]);
    this.updateStationStyle(asteroid,source);
    asteroid.surface.rotation.set(0,0,.18+source.id*.23);
  }

  reset() {
    this.travel=0;
    this.asteroids.forEach((asteroid,id)=>{
      const source=spawnAsteroid(id,this.seed);
      this.applySpawn(asteroid,source);
      asteroid.definition=source;
      asteroid.group.position.set(source.x,source.y,source.z);
    });
    this.update(0);
  }

  update(dt, shipPosition = {x:0,y:0,z:0}, progressRate = 1, spinDt = dt, consumedStations = [], flightSeconds = 0, navigation = null, supplyCenter = shipPosition) {
    this.travel+=dt*8;
    this.sources.length=0;
    const field=advanceFlybyField(this.asteroids.map(body=>body.definition),dt,shipPosition,progressRate,flightSeconds,navigation,supplyCenter);
    this.asteroids.forEach((asteroid,index)=>{
      const source=field[index];
      if(source.generation!==asteroid.definition.generation)this.applySpawn(asteroid,source);
      asteroid.definition=source;
      asteroid.group.position.set(source.x,source.y,source.z);
      asteroid.surface.rotation.x+=spinDt*source.spin[0];
      asteroid.surface.rotation.y+=spinDt*source.spin[1];
      asteroid.surface.rotation.z+=spinDt*source.spin[2];
      // Keep distant stations legible as a blue beacon without enlarging their
      // collision shape or making nearby stations overwhelm the scene.
      if(source.kind==='station'){
        const distance=Math.hypot(source.x-shipPosition.x,source.y-shipPosition.y,source.z-shipPosition.z);
        asteroid.glow.scale.setScalar(Math.max(source.radius*4,Math.min(40,distance*.07)));
      }
      asteroid.group.visible=!consumedStations.includes(stationKey(source));
      if(asteroid.group.visible)this.sources.push(source);
    });
    return this.sources;
  }

}
