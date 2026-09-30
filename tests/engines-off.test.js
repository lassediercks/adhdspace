import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OrbitalGravity,gravitationalAcceleration } from '../src/orbital-gravity.js';
import { Navigation } from '../src/navigation.js';
import { Journey } from '../src/journey.js';
import { flightRoute } from '../src/flight-route.js';
import { beamGuidanceStrength } from '../src/flight-controls.js';
import { predictPath } from '../src/trajectory-prediction.js';

test('zero stabilizers coast in a straight line instead of orbiting the beam',()=>{
 const physics=new OrbitalGravity(),nav=new Navigation();
 physics.reset({x:0,y:7,z:0},{x:0,y:0,z:2});
 for(let i=1;i<=600;i++){
  const phase=i/60*.45;
  physics.advance(1/60,flightRoute(phase,7),[],0,7,null,{phase,radius:7,dual:0},nav);
 }
 assert.ok(Math.abs(physics.position.y-7)<1e-10);
 assert.ok(Math.abs(physics.position.z-20)<1e-9);
 assert.deepEqual(physics.velocity,{x:0,y:0,z:2});
});

test('gravity is not compensated when engines are off, but rescue still provides thrust',()=>{
 const physics=new OrbitalGravity(),nav=new Navigation();
 const position={x:0,y:7,z:0},velocity={x:0,y:0,z:0};
 const bodies=[{id:0,x:100,y:30,z:0,radius:3,mass:3}];
 const gravity=gravitationalAcceleration(position,bodies,.8);
 assert.deepEqual(physics.acceleration(position,velocity,flightRoute(1,7),bodies,.8,7,null,nav),gravity);
 nav.fuel=0;
 assert.deepEqual(physics.acceleration(position,velocity,flightRoute(1,0),bodies,.8,0,null,nav),gravity);
 nav.fuel=100;nav.mode='derailed';assert.ok(nav.rescue());
 const thrust=physics.acceleration(position,velocity,flightRoute(1,7),[],0,7,null,nav);
 assert.ok(thrust.y<0);
});

test('guidance ramps down continuously near zero power and the forecast shows the same coasting',()=>{
 assert.equal(beamGuidanceStrength(7),0);
 assert.ok(beamGuidanceStrength(6.99)<.001);
 assert.ok(beamGuidanceStrength(6.3)>.49&&beamGuidanceStrength(6.3)<.51);
 const path=predictPath({position:{x:0,y:7,z:0},velocity:{x:0,y:0,z:2},journey:new Journey(),
  navigation:new Navigation(),bodies:[],phase:0,radius:7,targetRadius:7,instability:0,speed:1.5},10);
 assert.ok(Math.abs(path.at(-3)-80)<1e-6);
 assert.ok(Math.abs(path.at(-2)-7)<1e-6);
 assert.ok(Math.abs(path.at(-1)-20)<1e-6);
});
