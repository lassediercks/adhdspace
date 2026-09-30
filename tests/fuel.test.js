import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Navigation, fuelBurnRate, RESCUE_FUEL, activeBodies } from '../src/navigation.js';
import { Journey } from '../src/journey.js';
import { OrbitalGravity } from '../src/orbital-gravity.js';
import { flightRoute } from '../src/flight-route.js';
import { spawnAsteroid,advanceFlyby,STATION_START_SECONDS } from '../src/flyby-motion.js';
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

test('unlocked fields have a nearby station with randomized placement and correct mass',()=>{
 for(let seed=1;seed<=20;seed++) {
  const station=spawnAsteroid(7,seed,1,STATION_START_SECONDS);
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
 assert.ok(nav.fuel>96);assert.equal(journey.rate,1);assert.equal(journey.orbit,null);
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


test('full engines exhaust fuel before any stations may spawn; conserving fuel lasts longer',()=>{
 const full=new Navigation(),economy=new Navigation();
 full.advance(100/fuelBurnRate(0)+.001,origin,origin,[],0,0);
 assert.equal(full.fuel,0);
 assert.ok(100/fuelBurnRate(0)/1.5<STATION_START_SECONDS);
 economy.advance(STATION_START_SECONDS*1.5,origin,origin,[],0,7);
 assert.ok(economy.fuel>90);
 for(let seed=0;seed<20;seed++)for(let id=0;id<20;id++){
  assert.equal(spawnAsteroid(id,seed).kind,'asteroid');
  const old={...spawnAsteroid(id,seed),x:-5000};
  assert.equal(advanceFlyby(old,1,origin,1,STATION_START_SECONDS-.001).kind,'asteroid');
 }
 const old={...spawnAsteroid(7,31),x:-5000};
 assert.equal(advanceFlyby(old,1,origin,1,STATION_START_SECONDS).kind,'station');
});


test('opening fuel budget requires lowering engines in the first thirty seconds',()=>{
 const full=new Navigation(),saving=new Navigation();
 let radius=0;
 for(let frame=0;frame<30*60;frame++){
  const dt=1/60;
  full.advance(dt*1.5,origin,origin,[],0,0,dt);
  // Pilot pulls the lever to 20% after ten seconds; engine response stays gradual.
  if(frame>=10*60)radius=5.6+(radius-5.6)*Math.exp(-.3*dt);
  saving.advance(dt*1.5,origin,origin,[],0,radius,dt);
 }
 assert.ok(full.fuel<1e-8);assert.ok(saving.fuel>40);
 for(let frame=30*60;frame<STATION_START_SECONDS*60;frame++){
  const dt=1/60;radius=5.6+(radius-5.6)*Math.exp(-.3*dt);
  saving.advance(dt*1.5,origin,origin,[],0,radius,dt);
 }
 assert.ok(saving.fuel>15);
});


test('the opening station appears ahead at forty seconds, within a six-second approach, only once',()=>{
 const ship={x:400,y:120,z:-70};
 for(let seed=0;seed<100;seed++){
  let body=spawnAsteroid(7,seed);
  body=advanceFlyby(body,0,ship,1,39.99);assert.equal(body.kind,'asteroid');
  const station=advanceFlyby(body,0,ship,1,40);
  assert.equal(station.kind,'station');assert.equal(station.openingStationSpawned,true);
  assert.equal(station.x-ship.x,72);
  assert.ok(Math.abs(Math.hypot(station.y-ship.y,station.z-ship.z)-8)<1e-8);
  const approaching=advanceFlyby(station,6*1.5,ship,1,46);
  assert.equal(approaching.generation,station.generation);
  assert.ok(Math.hypot(approaching.x-ship.x,approaching.y-ship.y,approaching.z-ship.z)<9);
  const recycled=advanceFlyby({...station,x:-5000},1,origin,1,100);
  assert.equal(recycled.openingStationSpawned,true);
  assert.equal(advanceFlyby(recycled,0,ship,1,101).generation,recycled.generation);
 }
});

test('an economical opening flight can reach and finish refueling before its tank empties',()=>{
 for(const seed of [1,7,31,82,133]){
  const nav=new Navigation(seed),physics=new OrbitalGravity(),journey=new Journey();
  let body=spawnAsteroid(7,seed),phase=1.05,radius=0;
  physics.reset(flightRoute(phase,radius),origin);
  let completedAt=null,minimumFuel=100;
  for(let frame=1;frame<=70*60;frame++){
   const dt=1/60,step=dt*1.5,time=frame*dt;
   if(time>=10)radius=5.6+(radius-5.6)*Math.exp(-.3*dt);
   phase+=step*.45;
   // Isolate the opening station from unrelated asteroid derailments.
   let sources=body.kind==='station'?activeBodies([body],nav):[];
   nav.advance(step,physics.position,physics.velocity,sources,0,radius,dt);
   minimumFuel=Math.min(minimumFuel,nav.fuel);
   const previous=journey.rate;
   const travel=journey.advance(step,physics.position,physics.velocity,sources,0,radius,nav);
   physics.velocity.x+=8*(previous-journey.rate);
   body=advanceFlyby(body,travel,physics.position,journey.rate,time);
   sources=body.kind==='station'?activeBodies([body],nav):[];
   const orbit=journey.orbit&&sources.length?{body,normal:journey.orbit.normal}:null;
   physics.advance(step,flightRoute(phase,radius),sources,0,radius,orbit,{phase,radius,dual:0},nav);
   if(nav.consumedStations.length){completedAt=time;break;}
  }
  assert.ok(completedAt>=50&&completedAt<65,`seed ${seed}: completion ${completedAt}`);
  assert.ok(minimumFuel>20,`seed ${seed}: fuel ${minimumFuel}`);
  assert.equal(nav.fuel,100);
 }
});
