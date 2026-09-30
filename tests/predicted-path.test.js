import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { predictPath, FORECAST_STEP } from '../src/trajectory-prediction.js';
import { PassingAsteroids } from '../src/asteroids.js';
import { Journey } from '../src/journey.js';
import { OrbitalGravity } from '../src/orbital-gravity.js';

function snapshot(bodies=[]) {
 const position={x:0,y:Math.cos(1.05)*4,z:Math.sin(1.05)*4};
 return {position,velocity:{x:0,y:-position.z*.45,z:position.y*.45},journey:new Journey(),bodies,phase:1.05,radius:4,targetRadius:4,instability:0,targetInstability:0,speed:1.5};
}

test('forecast follows the nominal orbit and never mutates the live snapshot',()=>{
 const input=snapshot();const before=JSON.stringify(input);
 const path=predictPath(input,3);
 assert.equal(JSON.stringify(input),before);
 const end=[...path.slice(-3)];
 assert.ok(Math.abs(end[0]-3*2.8)<.001);
 assert.ok(Math.abs(end[1]-4*Math.cos(1.05+3*.45))<.002);
 assert.ok(Math.abs(end[2]-4*Math.sin(1.05+3*.45))<.002);
});

test('a newly spawned beam obstacle changes the preview even without gravitational pull',()=>{
 const input=snapshot();
 const clear=predictPath(input,4);
 input.bodies=[{id:0,x:20,y:0,z:0,radius:3,mass:3,avoidanceRadius:3,vx:-8}];
 const avoided=predictPath(input,4);
 const delta=Math.hypot(...[0,1,2].map(i=>avoided[avoided.length-3+i]-clear[clear.length-3+i]));
 assert.ok(delta>2);
});

test('forecast matches live integration including an upcoming randomized respawn',()=>{
 const asteroids=new PassingAsteroids(new THREE.Scene(),{seed:31});
 asteroids.asteroids[3].definition.x=-500;
 asteroids.update(0);
 const input=snapshot(asteroids.sources);
 const predicted=predictPath(input,3);
 const physics=new OrbitalGravity();physics.reset(input.position,input.velocity);
 const journey=new Journey();let phase=input.phase;
 for(let i=0;i<90;i++) {
  phase+=FORECAST_STEP*.45;
  const previousRate=journey.rate;
  const travel=journey.advance(FORECAST_STEP,physics.position,physics.velocity,asteroids.sources,0,4);
  physics.velocity.x+=8*(previousRate-journey.rate);
  const sources=asteroids.update(travel,physics.position,journey.rate);
  physics.advance(FORECAST_STEP,{x:0,y:Math.cos(phase)*4,z:Math.sin(phase)*4},sources,0,4);
 }
 assert.equal(asteroids.sources[3].generation,1);
 const expected=[physics.position.x+journey.distance,physics.position.y,physics.position.z];
 expected.forEach((value,i)=>assert.ok(Math.abs(value-predicted[predicted.length-3+i])<1e-4));
});

test('captured-orbit forecasts continue curving while forward journey progress is stopped',()=>{
 const body={id:0,x:10,y:0,z:0,radius:2.5,mass:1.875,avoidanceRadius:2.5625,vx:0};
 const input=snapshot([body]);
 input.position={x:10,y:17,z:0};input.velocity={x:0,y:0,z:9};
 input.journey.rate=0;input.journey.orbit={id:0,normal:{x:1,y:0,z:0}};
 input.instability=input.targetInstability=1;
 const before=JSON.stringify(input),path=predictPath(input,3);
 assert.ok(Math.abs(path.at(-1))>1);
 assert.equal(JSON.stringify(input),before);
});
