import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PassingAsteroids } from '../src/asteroids.js';
import { OrbitalGravity, bodyClearance } from '../src/orbital-gravity.js';
import { Journey } from '../src/journey.js';

function simulation() {
 const asteroids=new PassingAsteroids(new THREE.Scene(),{seed:31}),physics=new OrbitalGravity(),journey=new Journey();
 // Explicit capture encounter: this test must not depend on a scripted spawn.
 asteroids.asteroids.forEach((asteroid,i)=>{
  Object.assign(asteroid.definition,i===0
   ? {x:23.64,y:6.83,z:4.67,radius:2.713,mass:2.397,avoidanceRadius:2.781}
   : {x:1000+i*100,y:500,z:500});
 });
 asteroids.update(0);
 let elapsed=0;
 const initial={x:0,y:Math.cos(1.05)*4,z:Math.sin(1.05)*4};
 physics.reset(initial,{x:0,y:-initial.z*.45,z:initial.y*.45});
 return {asteroids,physics,journey,advance(strength){
  const dt=1/60;elapsed+=dt;
  const nominal={x:0,y:Math.cos(1.05+elapsed*.45)*4,z:Math.sin(1.05+elapsed*.45)*4};
  const previousRate=journey.rate;
  const travel=journey.advance(dt,physics.position,physics.velocity,asteroids.sources,strength,4);
  physics.velocity.x+=8*(previousRate-journey.rate);
  const sources=asteroids.update(travel,physics.position,journey.rate);
  const body=journey.orbit&&sources.find(p=>p.id===journey.orbit.id);
  physics.advance(dt,nominal,sources,strength,4,body?{body,normal:journey.orbit.normal}:null);
 }};
}

test('captured body remains fixed while journey stops and local orbital motion continues',()=>{
 const sim=simulation();
 for(let i=0;i<600;i++)sim.advance(1);
 assert.ok(sim.journey.orbit);
 assert.equal(sim.journey.rate,0);
 const distance=sim.journey.distance;
 const id=sim.journey.orbit.id;
 const body={...sim.asteroids.sources.find(p=>p.id===id)};
 const position={...sim.physics.position};
 for(let i=0;i<1800;i++) {
  sim.advance(1);
  const p=sim.physics.position;
  assert.ok(Math.hypot(p.x-body.x,p.y-body.y,p.z-body.z)>=bodyClearance(body,4));
 }
 assert.equal(sim.journey.distance,distance);
 assert.deepEqual(sim.asteroids.sources.find(p=>p.id===id),body);
 assert.ok(Math.hypot(sim.physics.position.x-position.x,sim.physics.position.y-position.y,sim.physics.position.z-position.z)>1);
});

test('lowering gravity resumes travel smoothly and reset clears the local encounter',()=>{
 const sim=simulation();for(let i=0;i<600;i++)sim.advance(1);
 const distance=sim.journey.distance;
 sim.advance(.2);
 assert.equal(sim.journey.orbit,null);
 assert.ok(sim.journey.rate>0&&sim.journey.rate<.1);
 for(let i=0;i<300;i++)sim.advance(.2);
 assert.equal(sim.journey.rate,1);
 assert.ok(sim.journey.distance>distance);
 sim.journey.reset();
 assert.equal(sim.journey.distance,0);
 assert.equal(sim.journey.rate,1);
 assert.equal(sim.journey.orbit,null);
});

test('asteroids can occupy the beam trajectory and are still avoided',()=>{
 const physics=new OrbitalGravity();
 physics.reset({x:0,y:4,z:0},{x:0,y:0,z:1.8});
 for(let i=1;i<1200;i++) {
  const body={id:0,x:40-i*8/60,y:0,z:0,radius:3.2,avoidanceRadius:6.56,mass:3.93,vx:-8};
  const nominal={x:0,y:4*Math.cos(i/60*.45),z:4*Math.sin(i/60*.45)};
  physics.advance(1/60,nominal,[body],1,4);
  const p=physics.position;
  assert.ok(Math.hypot(p.x-body.x,p.y,p.z)>=bodyClearance(body,4));
 }
});
