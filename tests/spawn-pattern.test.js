import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnAsteroid,advanceFlyby } from '../src/flyby-motion.js';
import { gravitationalAcceleration } from '../src/orbital-gravity.js';

test('spawns vary in spacing, lateral distance, size, and shape while remaining reproducible',()=>{
 const bodies=Array.from({length:20},(_,i)=>spawnAsteroid(4,31,i+1));
 assert.equal(new Set(bodies.map(p=>p.x)).size,20);
 assert.ok(Math.max(...bodies.map(p=>p.radius))/Math.min(...bodies.map(p=>p.radius))>3);
 assert.ok(new Set(bodies.map(p=>JSON.stringify(p.shape))).size>10);
 assert.ok(bodies.every(p=>p.y!==0||p.z!==0));
 assert.ok(bodies.some(p=>Math.hypot(p.y,p.z)>20));
 assert.deepEqual(spawnAsteroid(4,31,2),spawnAsteroid(4,31,2));
 assert.notDeepEqual(spawnAsteroid(4,31,2),spawnAsteroid(4,32,2));
});

test('recycled rocks get fresh properties and nearby captured rocks are retained',()=>{
 const old={...spawnAsteroid(4,31),x:-500};
 const next=advanceFlyby(old,1,{x:0,y:0,z:0},1);
 assert.equal(next.generation,1);
 assert.notEqual(next.radius,old.radius);
 assert.ok(next.x>=260);
 const captured=advanceFlyby(old,1,{x:-500,y:old.y,z:old.z},1);
 assert.equal(captured.generation,old.generation);
 const paused=advanceFlyby(old,0,{x:0,y:0,z:0},0);
 assert.equal(paused.x,old.x);
 assert.equal(paused.generation,old.generation);
});

test('actual generated asteroid sizes determine pull at equal distance and instability',()=>{
 const bodies=Array.from({length:20},(_,id)=>spawnAsteroid(id,31)).sort((a,b)=>a.radius-b.radius);
 const small={...bodies[0],x:0,y:0,z:0},large={...bodies.at(-1),x:0,y:0,z:0};
 for(const strength of [.25,.5,1]) {
  const smallPull=gravitationalAcceleration({x:100,y:0,z:0},[small],strength);
  const largePull=gravitationalAcceleration({x:100,y:0,z:0},[large],strength);
  assert.ok(Math.abs(largePull.x/smallPull.x-(large.radius/small.radius)**3)<1e-8);
  assert.ok(Math.abs(largePull.x)>Math.abs(smallPull.x));
 }
});

// Fixed seeds keep this distribution check deterministic, including opening IDs
// that previously forced rocks onto the beam.
test('initial and recycled fields sample area evenly without forced beam centers',()=>{
 for(const generation of [0,1,7]) {
  let inner=0,intersections=0,positiveY=0,positiveZ=0;
  const count=8000;
  for(let i=0;i<count;i++) {
   const body=spawnAsteroid(i%8,Math.floor(i/8),generation);
   const distance=Math.hypot(body.y,body.z);
   assert.ok(distance>0&&distance<=40);
   if(distance<20)inner++;
   if(distance<body.radius)intersections++;
   if(body.y>0)positiveY++;
   if(body.z>0)positiveZ++;
  }
  assert.ok(inner/count>.23&&inner/count<.27,'half-radius disk gets a quarter of spawns');
  assert.ok(intersections>0&&intersections/count<.03,'occasional natural beam intersections');
  for(const value of [positiveY,positiveZ])assert.ok(value/count>.47&&value/count<.53);
 }
});
