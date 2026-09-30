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


test('launch on the beam stays straight until a flyby supplies sideways momentum',()=>{
 const physics=new OrbitalGravity(),nav=new Navigation();
 const origin={x:0,y:0,z:0};physics.reset(origin,origin);
 let phase=0;
 const tick=bodies=>{
  const dt=1/60;phase+=dt*.45;
  nav.advance(dt,physics.position,physics.velocity,bodies,.5,7);
  physics.advance(dt,flightRoute(phase,7),bodies,.5,7,null,{phase,radius:7,dual:0},nav);
 };
 for(let i=0;i<300;i++)tick([]);
 assert.deepEqual(physics.position,origin);
 assert.deepEqual(physics.velocity,origin);
 assert.equal(nav.mode,'tracking');
 // A nearby moving asteroid must pull, without hidden avoidance thrusters.
 for(let i=0;i<300;i++)tick([{id:0,kind:'asteroid',x:20-i*8/60,y:12,z:0,radius:3,mass:3.24,vx:-8}]);
 assert.ok(physics.position.y>1);
 assert.ok(physics.velocity.y>.5);
 assert.equal(nav.mode,'derailed');
 assert.deepEqual(physics.thrustAcceleration,origin);
 const before={...physics.position},velocity={...physics.velocity};
 for(let i=0;i<120;i++)tick([]);
 assert.ok(Math.abs(physics.position.y-before.y-velocity.y*2)<1e-8);
 assert.deepEqual(physics.velocity,velocity);
 const path=predictPath({position:origin,velocity:origin,journey:new Journey(),navigation:new Navigation(),
  bodies:[],phase:0,radius:7,targetRadius:7,instability:.5,speed:1.5},10);
 assert.equal(path.at(-2),0);assert.equal(path.at(-1),0);assert.ok(path.at(-3)>79);
});
