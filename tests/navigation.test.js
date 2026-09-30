import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Navigation } from '../src/navigation.js';
import { derailmentRisk,smoothControl } from '../src/flight-controls.js';
import { OrbitalGravity } from '../src/orbital-gravity.js';
import { SpaceWeather } from '../src/space-weather.js';
import { Journey } from '../src/journey.js';
import { flightRoute } from '../src/flight-route.js';
import { predictPath,FORECAST_STEP } from '../src/trajectory-prediction.js';
import { scheduledBeamCount } from '../src/beam-schedule.js';
const origin={x:0,y:0,z:0};

test('full coherence has a small nonzero derailment chance, much less than 50%',()=>{
 const body={x:15,y:0,z:0,radius:4,mass:8};
 let protectedFailures=0,exposedFailures=0;
 for(let seed=1;seed<=1000;seed++) {
  const protectedNav=new Navigation(seed),exposed=new Navigation(seed);
  protectedNav.advance(60,origin,origin,[body],1,0);
  exposed.advance(60,origin,origin,[body],1,3.5);
  protectedFailures+=protectedNav.mode==='derailed';exposedFailures+=exposed.mode==='derailed';
 }
 assert.ok(protectedFailures>0&&protectedFailures<300,`${protectedFailures}/1000`);
 assert.ok(exposedFailures>protectedFailures*3,`${protectedFailures} vs ${exposedFailures}`);
 assert.equal(derailmentRisk(.3,7),0);
});

test('coherence changes take seconds and are independent of render frame rate',()=>{
 assert.ok(smoothControl(7,0,1)>4);
 assert.ok(smoothControl(7,0,11)<.4);
 let split=7;for(let i=0;i<60;i++)split=smoothControl(split,0,1/60);
 assert.ok(Math.abs(split-smoothControl(7,0,1))<1e-12);
});

test('loss of lock persists through calm weather and high coherence until rescue',()=>{
 const navigation=new Navigation(5),physics=new OrbitalGravity();
 navigation.mode='derailed';navigation.lock=0;
 physics.reset({x:5,y:30,z:20},{x:0,y:1,z:0});
 for(let i=0;i<600;i++) {
  navigation.advance(1/60,physics.position,physics.velocity,[],0,0);
  physics.advance(1/60,flightRoute(0,0),[],0,0,null,{phase:0,radius:0,dual:0},navigation);
 }
 assert.equal(navigation.mode,'derailed');assert.ok(physics.position.y>39);
 const before={...physics.position},velocity={...physics.velocity};
 assert.equal(navigation.rescue(),true);
 assert.deepEqual(physics.position,before);assert.deepEqual(physics.velocity,velocity);
 assert.equal(navigation.rescue(),false);
 let largestStep=0;
 for(let i=0;i<2400&&navigation.mode==='rescuing';i++) {
  const previous={...physics.position};
  navigation.advance(1/60,physics.position,physics.velocity,[],0,0);
  physics.advance(1/60,flightRoute(0,0),[],0,0,null,{phase:0,radius:0,dual:0},navigation);
  largestStep=Math.max(largestStep,Math.hypot(physics.position.x-previous.x,physics.position.y-previous.y,physics.position.z-previous.z));
 }
 assert.equal(navigation.mode,'tracking');
 assert.ok(Math.hypot(physics.position.x,physics.position.y,physics.position.z)<.7);
 assert.ok(largestStep<.5);
});

test('captured asteroid releases only for rescue, not a calm weather interval',()=>{
 const journey=new Journey();journey.orbit={id:1,normal:{x:1,y:0,z:0}};
 const navigation=new Navigation();navigation.mode='derailed';
 journey.advance(1,origin,origin,[],0,0,navigation);assert.ok(journey.orbit);
 navigation.rescue();journey.advance(1,origin,origin,[],0,0,navigation);
 assert.equal(journey.orbit,null);assert.ok(journey.rate>0);
});

test('weather is reproducible, smooth, usually moderate, and reaches both extremes',()=>{
 const weather=new SpaceWeather(31),split=new SpaceWeather(31);
 let low=false,high=false,middle=0,maximumJump=0,previous=.5;
 for(let i=0;i<30000;i++) {
  const value=weather.advance(.1);
  split.advance(.05);split.advance(.05);
  assert.equal(value,split.value);
  assert.ok(value>=0&&value<=1);
  if(value===0)low=true;if(value===1)high=true;if(value>.25&&value<.75)middle++;
  maximumJump=Math.max(maximumJump,Math.abs(value-previous));previous=value;
 }
 assert.ok(low&&high);assert.ok(middle>15000);assert.ok(maximumJump<.08);
});

test('beam schedule starts at one, adds one every 30 seconds, and stops at ten',()=>{
 for(let count=1;count<10;count++) {
  assert.equal(scheduledBeamCount((count-1)*30),count);
  assert.equal(scheduledBeamCount(count*30-.001),count);
 }
 assert.equal(scheduledBeamCount(270),10);assert.equal(scheduledBeamCount(9999),10);
});

test('forecast reproduces slow controls, random weather, lock loss, and a scheduled beam',()=>{
 const physics=new OrbitalGravity(),initial=flightRoute(1.05,4),navigation=new Navigation(5),weather=new SpaceWeather(31),journey=new Journey();
 physics.reset(initial,initial.velocity);navigation.threshold=.00001;
 // Distant gravity perturbs the ship without activating near-surface avoidance.
 const bodies=[{id:0,x:60,y:10,z:0,radius:5,mass:30,vx:0}];
 weather.value=.95;weather.target=1;weather.pulseTime=30;weather.pulseTarget=1;
 const snapshot={position:physics.position,velocity:physics.velocity,journey,navigation,weather,bodies,phase:1.05,radius:4,targetRadius:0,instability:weather.value,targetInstability:weather.value,speed:1.5,dual:0,targetDual:0,flightSeconds:29};
 const original=structuredClone(snapshot),points=predictPath(snapshot,4);
 assert.deepEqual(structuredClone(snapshot),original);
 let phase=1.05,radius=4,dual=0,seconds=29,moving=bodies;
 for(let i=1;i<=120;i++) {
  const dt=FORECAST_STEP;phase+=dt*.45;seconds+=dt/1.5;
  const target=scheduledBeamCount(seconds)-1;dual=target+(dual-target)*Math.exp(-2*dt);
  radius=smoothControl(radius,0,dt/1.5);const instability=weather.advance(dt/1.5);
  navigation.advance(dt,physics.position,physics.velocity,moving,instability,radius);
  const old=journey.rate,travel=journey.advance(dt,physics.position,physics.velocity,moving,instability,radius,navigation);
  physics.velocity.x+=8*(old-journey.rate);
  moving=moving.map(body=>({...body,x:body.x-travel*8,vx:-8*journey.rate}));
  const body=journey.orbit&&moving.find(body=>body.id===journey.orbit.id);
  physics.advance(dt,flightRoute(phase,radius,dual),moving,instability,radius,body?{body,normal:journey.orbit.normal}:null,{phase,radius,dual},navigation);
  if(i%2===0) {
   const index=i/2*3;
   assert.ok(Math.hypot(points[index]-(physics.position.x+journey.distance),points[index+1]-physics.position.y,points[index+2]-physics.position.z)<1e-4);
  }
 }
 assert.equal(navigation.mode,'derailed');assert.ok(dual>.9);
});
