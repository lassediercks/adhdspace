import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PassingAsteroids } from '../src/asteroids.js';
import { OrbitalGravity, bodyClearance } from '../src/orbital-gravity.js';

test('all asteroids are visible immediately and move at a constant speed without a pull setting',()=>{
 const asteroids=new PassingAsteroids(new THREE.Scene(),{seed:31});
 const initial=asteroids.sources.map(p=>({...p}));
 assert.equal(initial.length,20);
 assert.ok(asteroids.asteroids.every(p=>p.group.visible&&p.surface.material.opacity===1));
 asteroids.update(1);
 asteroids.sources.forEach((p,i)=>{
  assert.equal(p.x,initial[i].x-8);
  assert.equal(p.mass,initial[i].mass);
  assert.equal(p.vx,-8);
 });
 const paused=asteroids.sources.map(p=>({...p}));
 asteroids.update(0);
 assert.deepEqual(asteroids.sources,paused);
 asteroids.reset();
 assert.deepEqual(asteroids.sources,initial);
});

test('repeated live body encounters respect clearance with powered stabilizers at every pull setting',()=>{
 for(const radius of [2,4,5.6])for(const pull of [0,1]) {
  const asteroids=new PassingAsteroids(new THREE.Scene(),{seed:31});
  const gravity=new OrbitalGravity();
  for(let frame=0;frame<1800;frame++) {
   const time=frame/30,phase=1.05+time*.45;
   const nominal={x:0,y:Math.cos(phase)*radius,z:Math.sin(phase)*radius};
   const sources=asteroids.update(1/30,gravity.position??nominal);
   const offset=gravity.advance(1/30,nominal,sources,pull,radius);
   for(const p of sources) {
    const distance=Math.hypot(offset.x-p.x,nominal.y+offset.y-p.y,nominal.z+offset.z-p.z);
    assert.ok(distance>=bodyClearance(p,radius)-1e-4,JSON.stringify({radius,pull,frame,distance,clearance:bodyClearance(p,radius)}));
   }
  }
 }
});

test('a massive flyby can eject the ship smoothly while the same zero-gravity pass cannot',()=>{
 const radius=4;
 const simulate=strength=>{
  const physics=new OrbitalGravity();
  const initial={x:0,y:Math.cos(1.05)*radius,z:Math.sin(1.05)*radius};
  physics.reset(initial,{x:0,y:-initial.z*.45,z:initial.y*.45});
  let maxRadius=0;
  for(let frame=1;frame<=14400;frame++) {
   const time=frame/240,phase=1.05+time*.45;
   const nominal={x:0,y:Math.cos(phase)*radius,z:Math.sin(phase)*radius};
   const before={...physics.position};
   physics.advance(1/240,nominal,[{id:0,x:40-time*8,y:20,z:12,radius:6,mass:6**3*.12,vx:-8}],strength,radius);
   const p=physics.position;
   maxRadius=Math.max(maxRadius,Math.hypot(p.y,p.z));
   assert.ok(Math.hypot(p.x-before.x,p.y-before.y,p.z-before.z)<1,'no teleporting');
  }
  return maxRadius;
 };
 assert.ok(simulate(0)<radius*1.1);
 assert.ok(simulate(1)>radius*6);
});

test('irregular asteroid silhouettes fit their avoidance bounds at every tumble angle',()=>{
 const asteroids=new PassingAsteroids(new THREE.Scene(),{seed:31});
 asteroids.asteroids.forEach((body,index)=>{
  const positions=body.surface.geometry.attributes.position;
  for(let i=0;i<positions.count;i++) {
   const radius=Math.hypot(positions.getX(i),positions.getY(i),positions.getZ(i))*body.definition.radius*1.025;
   assert.ok(radius<=asteroids.sources[index].avoidanceRadius+1e-5);
  }
 });
});


test('the opening station is already rendered at long range with a readable blue beacon',()=>{
 const asteroids=new PassingAsteroids(new THREE.Scene(),{seed:31});
 const station=asteroids.asteroids[7];
 assert.equal(station.definition.kind,'station');
 assert.ok(station.group.position.x>500);
 assert.equal(station.group.visible,true);assert.equal(station.glow.visible,true);
 assert.ok(station.glow.scale.x>station.definition.radius*4);
 const geometry=station.surface.geometry;
 asteroids.update(10,{x:0,y:0,z:0},1,10,[],10/1.5);
 assert.equal(station.surface.geometry,geometry);
 assert.equal(station.group.position.x,472);
});
