import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion,Vector3 } from 'three';
import { OrbitalGravity,MAX_THRUST_JERK } from '../src/orbital-gravity.js';
import { ShipAttitude,MAX_ANGULAR_ACCELERATION,MAX_ANGULAR_SPEED } from '../src/ship-attitude.js';
import { predictPath,FORECAST_STEP } from '../src/trajectory-prediction.js';
import { Navigation } from '../src/navigation.js';
import { Journey } from '../src/journey.js';
import { sceneryDistance } from '../src/flight-frame.js';
import { flightRoute } from '../src/flight-route.js';
const zero={x:0,y:0,z:0};

test('steering and rescue changes ramp thrust without discarding momentum',()=>{
 const physics=new OrbitalGravity(),nav=new Navigation();
 physics.reset(zero,{x:0,y:0,z:8},zero);
 nav.mode='derailed';nav.rescue();
 const dt=1/120;let previous={...physics.thrustAcceleration};
 for(let i=0;i<120;i++){
  physics.advance(dt,zero,[],0,0,null,null,nav);
  const thrust=physics.thrustAcceleration;
  assert.ok(Math.hypot(thrust.x-previous.x,thrust.y-previous.y,thrust.z-previous.z)<=MAX_THRUST_JERK*dt+1e-9);
  if(i===0)assert.ok(physics.velocity.z>7.99);
  previous={...thrust};
 }
 assert.ok(physics.velocity.z<7);
});

test('heading turns have bounded angular speed and acceleration, including reversals',()=>{
 const attitude=new ShipAttitude(),orientation=new Quaternion();
 const target=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI);
 const dt=1/60;let velocity=new Vector3();
 for(let i=0;i<240;i++){
  if(i===50)target.identity();
  const before=orientation.clone();
  attitude.advance(orientation,target,dt);
  assert.ok(attitude.angularVelocity.distanceTo(velocity)<=MAX_ANGULAR_ACCELERATION*dt+1e-9);
  assert.ok(attitude.angularVelocity.length()<=MAX_ANGULAR_SPEED+1e-9);
  assert.ok(before.angleTo(orientation)<=MAX_ANGULAR_SPEED*dt+1e-8);
  if(i===0)assert.ok(before.angleTo(orientation)<.001);
  velocity.copy(attitude.angularVelocity);
 }
 assert.ok(orientation.angleTo(target)<.01);
});

test('forecast preserves existing thrust momentum instead of restarting the controller',()=>{
 const physics=new OrbitalGravity(),navigation=new Navigation(),journey=new Journey();
 physics.reset(zero,zero,{x:0,y:2,z:0});
 const snapshot={position:physics.position,velocity:physics.velocity,thrustAcceleration:physics.thrustAcceleration,
  navigation,journey,bodies:[],phase:0,radius:0,targetRadius:0,instability:0,speed:1.5};
 const before=structuredClone(snapshot),points=predictPath(snapshot,2);
 assert.deepEqual(structuredClone(snapshot),before);
 let phase=0;
 for(let i=1;i<=60;i++){
  const dt=FORECAST_STEP;phase+=dt*.45;
  navigation.advance(dt,physics.position,physics.velocity,[],0,0,dt/1.5);
  journey.advance(dt,physics.position,physics.velocity,[],0,0,navigation);
  physics.advance(dt,flightRoute(phase,0),[],0,0,null,{phase,radius:0,dual:0},navigation);
  if(i%2===0){
   const at=i/2*3;
   assert.ok(Math.hypot(points[at]-physics.position.x-sceneryDistance(journey.distance),points[at+1]-physics.position.y,points[at+2]-physics.position.z)<1e-5);
  }
 }
});
