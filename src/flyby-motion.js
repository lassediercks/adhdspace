export const ASTEROID_COUNT=20;

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
export function spawnAsteroid(id, seed, generation=0) {
  const random=randomSource((seed^Math.imul(id+1,0x9E3779B1)^Math.imul(generation+1,0x85EBCA6B))>>>0);
  const distant=id>=8;
  const x=generation===0
    ? (distant?(random()<.5?-1:1)*(300+random()*1700):40+random()*360)
    : (distant?650+random()*1600:260+random()*440);
  const radius=distant?2+random()*7:.65+Math.pow(random(),1.35)*5.8;
  const angle=random()*Math.PI*2;
  // Uniform area sampling: sqrt avoids concentrating rocks along the axis.
  // No reserved beam blockers, central exclusion, or scripted opening encounters.
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
  body.kind=!distant&&(id===7||random()<.12)?'station':'asteroid';
  if(body.kind==='station') {
    body.radius=Math.max(2.5,body.radius);body.mass=asteroidMass(body.radius);
    body.avoidanceRadius=body.radius*1.025;body.colors=['#6bbcff'];
    body.spin=body.spin.map(value=>value*.25);
  }
  return body;
}

export function advanceFlyby(body, dt, shipPosition, progressRate) {
  let next={...body,x:body.x-dt*8,vx:-8*progressRate};
  const distance=Math.hypot(next.x-shipPosition.x,next.y-shipPosition.y,next.z-shipPosition.z);
  if(dt>0&&next.x<-(body.recycleBehind??84)&&distance>(body.seed===undefined?140:350)) {
    next=body.seed===undefined
      ? {...next,x:next.x+(body.recycleSpan??360),generation:(body.generation??0)+1}
      : {...spawnAsteroid(body.id,body.seed,body.generation+1),vx:-8*progressRate};
  }
  return next;
}
