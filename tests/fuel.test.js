import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Navigation, fuelBurnRate, RESCUE_FUEL } from '../src/navigation.js';
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

test('a station captures, retains, and refuels the ship until rescue releases it',()=>{
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
  const orbit=journey.orbit?{body,normal:journey.orbit.normal}:null;
  physics.advance(dt,flightRoute(phase,radius),[body],0,radius,orbit,{phase,radius,dual:0},nav);
 }
 for(let i=0;i<1800;i++)advance();
 assert.equal(nav.mode,'derailed');assert.equal(nav.refueling,true);
 assert.equal(nav.fuel,100);assert.equal(journey.rate,0);assert.equal(journey.orbit.id,7);
 const x=body.x;for(let i=0;i<120;i++)advance();assert.equal(body.x,x);
 assert.ok(nav.rescue());
 for(let i=0;i<2400&&nav.mode==='rescuing';i++)advance();
 assert.equal(nav.mode,'tracking');assert.equal(journey.orbit,null);
});
