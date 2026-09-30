import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Navigation, fuelBurnRate, RESCUE_FUEL, activeBodies } from '../src/navigation.js';
import { Journey } from '../src/journey.js';
import { OrbitalGravity } from '../src/orbital-gravity.js';
import { flightRoute } from '../src/flight-route.js';
import { spawnAsteroid,advanceFlyby } from '../src/flyby-motion.js';
const origin={x:0,y:0,z:0};

test('coherence trades fuel efficiency for stability and rescue spends a fixed reserve',()=>{
 assert.ok(fuelBurnRate(0)>fuelBurnRate(3.5)*3);
 assert.ok(fuelBurnRate(3.5)>fuelBurnRate(7));
 const high=new Navigation(),low=new Navigation();
 high.advance(20,origin,origin,[],0,0);low.advance(20,origin,origin,[],0,7);
 assert.ok(high.fuel<low.fuel);
 high.mode='derailed';const before=high.fuel;assert.ok(high.rescue());
 assert.equal(high.fuel,before-RESCUE_FUEL);
 high.mode='derailed';high.fuel=RESCUE_FUEL-.01;assert.equal(high.rescue(),false);
});

test('station encounters are deliberate at low coherence and charge only derailed ships',()=>{
 const station={id:7,kind:'station',x:15,y:0,z:0,radius:3,mass:3};
 const stable=new Navigation();stable.fuel=50;
 stable.advance(1,origin,origin,[station],0,0);
 assert.equal(stable.mode,'tracking');assert.equal(stable.refueling,false);assert.ok(stable.fuel<50);
 const docking=new Navigation();docking.fuel=0;
 docking.advance(1,origin,origin,[station],0,7);
 assert.equal(docking.mode,'derailed');assert.equal(docking.stationId,7);assert.ok(docking.fuel>9);
 assert.equal(docking.refueling,true);assert.ok(docking.rescue());
});

test('every field has a nearby station with randomized placement and correct mass',()=>{
 for(let seed=1;seed<=20;seed++) {
  const station=spawnAsteroid(7,seed);
  assert.equal(station.kind,'station');assert.ok(Math.hypot(station.y,station.z)>0);
  assert.equal(station.mass,station.radius**3*.12);
 }
});

test('a station refuels in ten seconds, disappears, and releases forward progress',()=>{
 const nav=new Navigation(),physics=new OrbitalGravity(),journey=new Journey(),radius=5.6;
 nav.fuel=20;nav.threshold=100;
 let body={id:7,kind:'station',x:30,y:15,z:0,radius:4,mass:7.68,avoidanceRadius:4.1,vx:-8},phase=0;
 const initial=flightRoute(phase,radius);physics.reset(initial,initial.velocity);
 function advance(){
  const dt=1/60;phase+=dt*.45;
  nav.advance(dt,physics.position,physics.velocity,[body],0,radius);
  const previous=journey.rate,travel=journey.advance(dt,physics.position,physics.velocity,[body],0,radius,nav);
  physics.velocity.x+=8*(previous-journey.rate);
  body=advanceFlyby(body,travel,physics.position,journey.rate);
  const sources=activeBodies([body],nav);
  const orbit=journey.orbit?{body,normal:journey.orbit.normal}:null;
  physics.advance(dt,flightRoute(phase,radius),sources,0,radius,orbit,{phase,radius,dual:0},nav);
 }
 for(let i=0;i<1800;i++)advance();
 assert.equal(nav.mode,'tracking');assert.equal(nav.refueling,false);
 assert.ok(nav.fuel>98);assert.equal(journey.rate,1);assert.equal(journey.orbit,null);
 assert.equal(activeBodies([body],nav).length,0);
 assert.equal(nav.rescue(),false);
 for(let i=0;i<120;i++)advance();
 assert.equal(nav.mode,'tracking');assert.equal(journey.orbit,null);
});

test('rescue boost cannot be reused during its 30-second real-time cooldown',()=>{
 const nav=new Navigation();nav.mode='derailed';assert.ok(nav.rescue());
 assert.equal(nav.cooldown,30);
 nav.mode='derailed';const fuel=nav.fuel;
 assert.equal(nav.rescue(),false);assert.equal(nav.fuel,fuel);
 nav.advance(44.85,{x:0,y:100,z:0},origin,[],0,7,29.9);
 assert.ok(nav.cooldown>0&&nav.cooldown<.11);assert.equal(nav.rescue(),false);
 nav.advance(.3,{x:0,y:100,z:0},origin,[],0,7,.2);
 assert.equal(nav.cooldown,0);assert.ok(nav.rescue());assert.equal(nav.cooldown,30);
});


test('a partial tank takes exactly ten real seconds and consumed generations stay absent',()=>{
 const nav=new Navigation();nav.mode='derailed';nav.fuel=60;
 const station={id:7,generation:0,kind:'station',x:15,y:0,z:0,radius:3,mass:3};
 nav.advance(7.5,origin,origin,[station],0,7,5);
 assert.ok(nav.fuel>79&&nav.fuel<81);assert.equal(nav.refueling,true);
 const clone=new Navigation();clone.restore(nav);
 clone.advance(7.5,origin,origin,[station],0,7,5);
 assert.equal(nav.consumedStations.length,0);
 nav.advance(7.35,origin,origin,[station],0,7,4.9);
 assert.equal(nav.refueling,true);
 nav.advance(.15,origin,origin,[station],0,7,.1);
 assert.equal(nav.fuel,100);assert.equal(nav.refueling,false);
 assert.equal(activeBodies([station],nav).length,0);
 assert.equal(activeBodies([{...station,generation:1}],nav).length,1);
});

test('zero engines and zero gravity do not stall a captured ship',()=>{
 const physics=new OrbitalGravity(),nav=new Navigation();nav.mode='derailed';nav.lock=0;
 const body={id:1,x:0,y:0,z:0,radius:3,mass:3,vx:0};
 physics.reset({x:0,y:18,z:0},origin);
 const orbit={body,normal:{x:1,y:0,z:0}};
 for(let i=0;i<3600;i++)physics.advance(1/60,flightRoute(0,7),[body],0,7,orbit,null,nav);
 assert.ok(Math.hypot(...Object.values(physics.velocity))>1.5);
 const before={...physics.position};
 for(let i=0;i<60;i++)physics.advance(1/60,flightRoute(0,7),[body],0,7,orbit,null,nav);
 assert.ok(Math.hypot(physics.position.x-before.x,physics.position.y-before.y,physics.position.z-before.z)>1.5);
});


test('a head-on station capture has a nonzero orbit tangent at zero engine power',()=>{
 const journey=new Journey(),nav=new Navigation();nav.mode='derailed';nav.stationId=7;
 const body={id:7,kind:'station',x:15,y:0,z:0,radius:3,mass:3,vx:0};
 journey.advance(1/60,origin,origin,[body],0,7,nav);
 assert.ok(journey.orbit);
 const n=journey.orbit.normal;
 assert.ok(Math.hypot(n.y,n.z)>.99);
 const physics=new OrbitalGravity();physics.reset(origin,origin);
 for(let i=0;i<600;i++)physics.advance(1/60,flightRoute(0,7),[body],0,7,{body,normal:n},null,nav);
 assert.ok(Math.hypot(physics.velocity.y,physics.velocity.z)>.5);
});


test('completed refueling restores smooth stabilization without carrying old derailment risk',()=>{
 const nav=new Navigation(),physics=new OrbitalGravity(),journey=new Journey();
 nav.mode='derailed';nav.lock=0;nav.fuel=20;nav.hazard=nav.threshold+1;
 const station={id:7,kind:'station',x:15,y:0,z:0,radius:3,mass:3,vx:0};
 physics.reset({x:0,y:7,z:0},{x:0,y:0,z:1.8});
 let phase=0,radius=7;
 for(let i=0;i<599;i++)nav.advance(1/40,physics.position,physics.velocity,[station],0,radius,1/60);
 assert.equal(nav.mode,'derailed');assert.equal(nav.lock,0);
 const position={...physics.position},velocity={...physics.velocity};
 nav.advance(1/40,physics.position,physics.velocity,[station],0,radius,1/60);
 assert.equal(nav.mode,'tracking');assert.equal(nav.hazard,0);assert.ok(nav.immunity>11);
 assert.ok(nav.lock>0&&nav.lock<.03);
 assert.deepEqual(physics.position,position);assert.deepEqual(physics.velocity,velocity);
 // Turn engines up to 100% through the same smoothing used in live flight.
 let largestStep=0;
 for(let i=0;i<2400;i++){
  const dt=1/60;phase+=dt*.45;radius*=Math.exp(-.3*dt/1.5);
  const bodies=activeBodies([station],nav);
  nav.advance(dt,physics.position,physics.velocity,bodies,0,radius,dt/1.5);
  journey.advance(dt,physics.position,physics.velocity,bodies,0,radius,nav);
  const before={...physics.position};
  physics.advance(dt,flightRoute(phase,radius),bodies,0,radius,null,{phase,radius,dual:0},nav);
  largestStep=Math.max(largestStep,Math.hypot(physics.position.x-before.x,physics.position.y-before.y,physics.position.z-before.z));
 }
 assert.equal(nav.mode,'tracking');assert.ok(nav.lock>.99);
 assert.ok(Math.hypot(physics.position.y,physics.position.z)<.1);
 assert.ok(largestStep<.2);
});
