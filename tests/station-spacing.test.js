import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceFlybyField,spawnAsteroid,MIN_STATION_SEPARATION } from '../src/flyby-motion.js';
import { Navigation,activeBodies } from '../src/navigation.js';
import { Journey } from '../src/journey.js';
const origin={x:0,y:0,z:0};

test('simultaneous supply and random station spawns keep docking envelopes separate',()=>{
 let pairs=0;
 for(let seed=0;seed<200;seed++){
  const nav=new Navigation();nav.fuel=50;
  const bodies=Array.from({length:20},(_,id)=>({...spawnAsteroid(id,seed),x:-5000}));
  nav.consumedStations=['7:0'];
  const before=structuredClone(bodies);
  const next=advanceFlybyField(bodies,1,origin,1,60,nav,origin);
  assert.deepEqual(bodies,before);
  const stations=activeBodies(next,nav).filter(body=>body.kind==='station');
  for(let i=0;i<stations.length;i++)for(let j=i+1;j<stations.length;j++){
   const a=stations[i],b=stations[j];pairs++;
   assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)>=MIN_STATION_SEPARATION,
     `seed ${seed}: stations ${a.id} and ${b.id}`);
  }
  assert.equal(next[7].x,180,'reliable supply wins simultaneous placement priority');
 }
 assert.ok(pairs>100);
});

test('a new station is separated before display without moving an existing station',()=>{
 let seed=0;
 while(spawnAsteroid(0,seed,1,60).kind!=='station')seed++;
 const arrival=spawnAsteroid(0,seed,1,60);
 const existing={...spawnAsteroid(7,31),x:arrival.x+9,y:arrival.y,z:arrival.z};
 const bodies=[{...spawnAsteroid(0,seed),x:-5000},existing];
 const next=advanceFlybyField(bodies,1,origin,1,60);
 assert.equal(next[1].x,existing.x-8);
 assert.equal(next[1].y,existing.y);assert.equal(next[1].generation,existing.generation);
 assert.ok(Math.hypot(next[0].x-next[1].x,next[0].y-next[1].y,next[0].z-next[1].z)>=90);
});

test('docking stays on one station through competing nearby stations and finishes normally',()=>{
 const nav=new Navigation(),journey=new Journey();nav.fuel=20;
 const a={id:7,generation:0,kind:'station',x:15,y:0,z:0,radius:3,mass:3,vx:0};
 const b={id:6,generation:0,kind:'station',x:16,y:0,z:0,radius:3,mass:3,vx:0};
 nav.advance(.1,origin,origin,[a,b],0,5.6,.1);
 assert.equal(nav.stationId,7);
 journey.orbit={id:6,normal:{x:0,y:0,z:1}};
 journey.advance(.1,origin,origin,[a,b],0,5.6,nav);
 assert.equal(journey.orbit.id,7,'orbital capture must use the station actually refueling');
 b.x=14;
 for(let i=0;i<98;i++){
  nav.advance(.1,origin,origin,[b,a],0,5.6,.1);
  assert.equal(nav.stationId,7);assert.equal(nav.refuelKey,'7:0');
 }
 nav.advance(.1,origin,origin,[b,a],0,5.6,.1);
 assert.equal(nav.fuel,100);assert.deepEqual(nav.consumedStations,['7:0','6:0']);
 assert.equal(nav.mode,'tracking');assert.equal(nav.refueling,false);
 const travel=journey.advance(.1,origin,origin,[b,a],0,5.6,nav);
 assert.equal(journey.orbit,null);assert.ok(travel>0);
 nav.advance(.1,origin,origin,[b,a],0,5.6,.1);
 assert.equal(nav.refueling,false,'departure immunity prevents immediate capture by the neighbor');
});
