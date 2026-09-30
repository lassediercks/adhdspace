export const ASTEROID_COUNT=20;
export const STATION_START_SECONDS=40;
export const FIRST_STATION_DISTANCE=552;
export const SUPPLY_STATION_DISTANCE=180;

// Equal-density spherical mass approximation: twice the radius gives 8× mass.
export function asteroidMass(radius) {
  return Math.pow(radius,3)*.12;
}
// Restrained stone tones; shape and scale carry most of the variation.
const palettes=[['#737d7c'],['#858b87'],['#646f70']];
function randomSource(seed) {
  return ()=>{
    seed=(seed+0x6D2B79F5)|0;
    let value=Math.imul(seed^(seed>>>15),1|seed);
    value^=value+Math.imul(value^(value>>>7),61|value);
    return ((value^(value>>>14))>>>0)/4294967296;
  };
}

// Per-body seeded randomness makes an unpredictable field reproducible inside
// the forecast, without allowing a preview to consume the live random stream.
export function spawnAsteroid(id, seed, generation=0,flightSeconds=0) {
  const random=randomSource((seed^Math.imul(id+1,0x9E3779B1)^Math.imul(generation+1,0x85EBCA6B))>>>0);
  const distant=id>=8;
  const x=generation===0
    ? (distant?(random()<.5?-1:1)*(300+random()*1700):40+random()*360)
    : (distant?650+random()*1600:260+random()*440);
  const radius=distant?2+random()*7:.65+Math.pow(random(),1.35)*5.8;
  const angle=random()*Math.PI*2;
  // Uniform area sampling: sqrt avoids concentrating rocks along the axis.
  // Asteroids have no reserved beam blockers or central exclusion.
  const extent=distant?Math.abs(x)*1.5:40;
  const radial=Math.sqrt(random())*extent;
  const y=Math.cos(angle)*radial,z=Math.sin(angle)*radial;
  const body = {
    id,seed,generation,x,y,z,radius,mass:asteroidMass(radius),
    avoidanceRadius:radius*1.025,vx:-8,recycleBehind:distant?2400:220,
    shape:[.45+random()*.55,.45+random()*.55,.45+random()*.55],
    roughness:.18+random()*.28,colors:palettes[Math.floor(random()*palettes.length)],
    geometrySeed:random()*100,
    spin:[(random()-.5)*.18,(random()-.5)*.2,(random()-.5)*.12],
  };
  // Keep one nearby station slot, with extra stations occurring randomly.
  // Their positions use the same unbiased field sampling as the rocks.
  const stationCandidate=!distant&&(id===7||random()<.12);
  const opening=id===7&&generation===0;
  body.kind=(opening||flightSeconds>=STATION_START_SECONDS)&&stationCandidate?'station':'asteroid';
  if(body.kind==='station') {
    body.radius=Math.max(2.5,body.radius);body.mass=asteroidMass(body.radius);
    body.avoidanceRadius=body.radius*1.025;body.colors=['#6bbcff'];
    body.spin=body.spin.map(value=>value*.25);
  }
  if(opening){
    body.x=FIRST_STATION_DISTANCE;
    body.y=8*Math.cos(body.geometrySeed);body.z=8*Math.sin(body.geometrySeed);
    body.openingStationSpawned=true;body.supplySpawnTime=0;
  }
  return body;
}

export function advanceFlyby(body, dt, shipPosition, progressRate, flightSeconds=0, navigation=null, supplyCenter=shipPosition) {
  // Reserve one supply slot for reachable opportunities, while other stations
  // retain random placement. This same rule runs in the forecast.
  const consumed=navigation?.consumedStations?.includes(`${body.id}:${body.generation??0}`);
  const missed=body.x<shipPosition.x-25||Math.hypot(body.y-shipPosition.y,body.z-shipPosition.z)>80;
  const needsSupply=navigation&&!navigation.refueling&&navigation.stationId!==body.id
    &&(consumed||(navigation.fuel<=60&&flightSeconds-(body.supplySpawnTime??0)>=8&&(missed||body.kind!=='station')));
  if(body.id===7&&body.seed!==undefined&&flightSeconds>=STATION_START_SECONDS&&(!body.openingStationSpawned||needsSupply)){
    const station=spawnAsteroid(body.id,body.seed,body.generation+1,flightSeconds);
    const angle=station.geometrySeed,lead=SUPPLY_STATION_DISTANCE;
    return {...station,x:shipPosition.x+lead,y:supplyCenter.y+8*Math.cos(angle),z:supplyCenter.z+8*Math.sin(angle),
      vx:-8*progressRate,openingStationSpawned:true,supplySpawnTime:flightSeconds};
  }
  let next={...body,x:body.x-dt*8,vx:-8*progressRate};
  const distance=Math.hypot(next.x-shipPosition.x,next.y-shipPosition.y,next.z-shipPosition.z);
  if(dt>0&&next.x<-(body.recycleBehind??84)&&distance>(body.seed===undefined?140:350)) {
    next=body.seed===undefined
      ? {...next,x:next.x+(body.recycleSpan??360),generation:(body.generation??0)+1}
      : {...spawnAsteroid(body.id,body.seed,body.generation+1,flightSeconds),vx:-8*progressRate,openingStationSpawned:body.openingStationSpawned,supplySpawnTime:body.supplySpawnTime};
  }
  return next;
}
