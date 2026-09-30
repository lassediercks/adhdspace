import { test } from 'node:test';
import assert from 'node:assert/strict';
import { predictPath } from '../src/trajectory-prediction.js';
import { spawnAsteroid } from '../src/flyby-motion.js';
import { flightRoute, beamCenter } from '../src/flight-route.js';
import { Journey } from '../src/journey.js';

function snapshot(seed,strength) {
 const initial=flightRoute(1.05,4);
 return {position:initial,velocity:initial.velocity,journey:new Journey(),bodies:Array.from({length:20},(_,id)=>spawnAsteroid(id,seed)),phase:1.05,radius:4,targetRadius:4,instability:strength,targetInstability:strength,speed:1.5};
}

test('low instability anticipates and counters pulling forces in the forecast',()=>{
 for(const seed of [1,7,31]) {
  const baseline=predictPath(snapshot(seed,0),30);
  const stable=predictPath(snapshot(seed,.3),30);
  for(let i=0;i<baseline.length;i++)assert.ok(Math.abs(baseline[i]-stable[i])<1e-5);
 }
});

test('100% instability frequently derails the predicted route across random asteroid fields',()=>{
 let derailed=0;
 for(let seed=1;seed<=12;seed++) {
  const baseline=predictPath(snapshot(seed,0),60),unstable=predictPath(snapshot(seed,1),60);
  let deviation=0;
  for(let i=0;i<baseline.length;i+=3) {
   assert.ok(Number.isFinite(unstable[i]+unstable[i+1]+unstable[i+2]));
   deviation=Math.max(deviation,Math.hypot(unstable[i]-baseline[i],unstable[i+1]-baseline[i+1],unstable[i+2]-baseline[i+2]));
  }
  if(deviation>20)derailed++;
 }
 assert.ok(derailed>=10,`${derailed}/12 fields produced a major deviation`);
});

test('100% coherence forecast reaches every polygon beam',()=>{
 const initial=flightRoute(0,0,9);
 const points=predictPath({...snapshot(1,0),position:initial,velocity:initial.velocity,bodies:[],phase:0,radius:0,targetRadius:0,dual:9,targetDual:9},280);
 for(let beam=0;beam<10;beam++) {
  const center=beamCenter(beam,10);
  let closest=Infinity;
  for(let i=0;i<points.length;i+=3)closest=Math.min(closest,Math.hypot(points[i+1]-center.y,points[i+2]-center.z));
  assert.ok(closest<.01);
 }
});
