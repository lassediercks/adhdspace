// Beam placement is independent of the ship's orbit radius.
export const MAX_BEAMS = 10;
export const BEAM_SPACING = 8;
// Anchor the first two beams; remaining vertices rise above them in the YZ plane.
// Adjacent vertices stay 8 units apart for every polygon, regardless of coherence.
export function beamCenter(index, count=2) {
  if(count<=2)return {y:0,z:index*BEAM_SPACING};
  const halfAngle=Math.PI/count, radius=BEAM_SPACING/(2*Math.sin(halfAngle));
  const angle=-halfAngle+index*2*halfAngle;
  return {y:radius*(Math.cos(halfAngle)-Math.cos(angle)),z:radius*(Math.sin(angle)+Math.sin(halfAngle))};
}
export const SECOND_BEAM_CENTER = Object.freeze(beamCenter(1));

const smooth=u=>u*u*u*(10+u*(-15+6*u));
const smoothFirst=u=>30*u*u*(u-1)*(u-1);
const smoothSecond=u=>60*u*(2*u*u-3*u+1);

// Orbit each vertex, then transfer to the next. Both phases meet with zero
// transverse velocity and acceleration, including the closing polygon edge.
// At zero radius the orbit phase follows the beam, and transfers still occur.
function polygonRoute(phase, radius, count, centers=null) {
  const duration=4*Math.PI, cycle=duration*count;
  const wrapped=((phase%cycle)+cycle)%cycle;
  const index=Math.floor(wrapped/duration), local=wrapped-index*duration;
  const center=centers?.[index]??beamCenter(index,count),next=centers?.[(index+1)%count]??beamCenter((index+1)%count,count);
  const mean=centers?centers.reduce((sum,p)=>({y:sum.y+p.y/count,z:sum.z+p.z/count}),{y:0,z:0}):null;
  const startAngle=mean?Math.atan2(center.z-mean.z,center.y-mean.y):Math.PI+Math.PI/count-index*2*Math.PI/count;
  const finishAngle=mean?Math.atan2(next.z-mean.z,next.y-mean.y):startAngle-2*Math.PI/count;
  const start={y:center.y+radius*Math.cos(startAngle),z:center.z+radius*Math.sin(startAngle)};
  const finish={y:next.y+radius*Math.cos(finishAngle),z:next.z+radius*Math.sin(finishAngle)};
  if(local<3*Math.PI) {
    const u=local/(3*Math.PI), rate=.45/(3*Math.PI);
    const turn=(index%2?-1:1)*2*Math.PI;
    const theta=startAngle+turn*smooth(u);
    const speed=turn*smoothFirst(u)*rate, acceleration=turn*smoothSecond(u)*rate*rate;
    const c=Math.cos(theta),s=Math.sin(theta);
    return {x:0,y:center.y+radius*c,z:center.z+radius*s,
      velocity:{x:0,y:-radius*s*speed,z:radius*c*speed},
      acceleration:{x:0,y:-radius*(c*speed*speed+s*acceleration),z:radius*(-s*speed*speed+c*acceleration)}};
  }
  const u=(local-3*Math.PI)/Math.PI, rate=.45/Math.PI;
  const dy=finish.y-start.y,dz=finish.z-start.z;
  return {x:0,y:start.y+dy*smooth(u),z:start.z+dz*smooth(u),
    velocity:{x:0,y:dy*smoothFirst(u)*rate,z:dz*smoothFirst(u)*rate},
    acceleration:{x:0,y:dy*smoothSecond(u)*rate*rate,z:dz*smoothSecond(u)*rate*rate}};
}
function blendRoutes(a,b,t) {
  const result={};
  for(const axis of ['x','y','z'])result[axis]=a[axis]+(b[axis]-a[axis])*t;
  for(const key of ['velocity','acceleration']) {
    result[key]={};
    for(const axis of ['x','y','z'])result[key][axis]=a[key][axis]+(b[key][axis]-a[key][axis])*t;
  }
  return result;
}

// The slower transverse harmonic makes two smooth lobes around the fixed beams.
// Blend targets through finite-thrust guidance; never reposition the ship.
export function flightRoute(phase, radius, dual = 0) {
  if(dual>1) {
    const count=Math.min(MAX_BEAMS,dual+1), low=Math.floor(count), high=Math.ceil(count);
    const sample=n=>n===2?flightRoute(phase,radius,1):polygonRoute(phase,radius,n);
    return blendRoutes(sample(low),sample(high),count-low);
  }
  const w = .45, c = Math.cos(phase), s = Math.sin(phase);
  // Zero radius removes orbit width, while the fixed beam-to-beam transfer remains.
  const weight = dual;
  const center = SECOND_BEAM_CENTER.z / 2, span = center + radius;
  const h = phase / 2, mix = (a,b) => a + (b-a)*weight;
  return {
    x:0, y:mix(radius*c,radius*s), z:mix(radius*s,center+span*Math.sin(h)),
    velocity:{x:0,y:mix(-w*radius*s,w*radius*c),z:mix(w*radius*c,w*span*Math.cos(h)/2)},
    acceleration:{x:0,y:mix(-w*w*radius*c,-w*w*radius*s),z:mix(-w*w*radius*s,-w*w*span*Math.sin(h)/4)},
  };
}


// The same orbital shapes, using the actual cross-section of angled beams.
export function routeThroughBeams(phase,radius,centers) {
 if(centers.length===1) {
  const route=flightRoute(phase,radius);
  route.y+=centers[0].y;route.z+=centers[0].z;return route;
 }
 if(centers.length>2)return polygonRoute(phase,radius,centers.length,centers);
 const [a,b]=centers,dy=b.y-a.y,dz=b.z-a.z,distance=Math.max(Math.hypot(dy,dz),1e-6);
 const py=dz/distance,pz=-dy/distance,zy=dy/distance,zz=dz/distance;
 const h=phase/2,w=.45,span=distance/2+radius;
 const across=radius*Math.sin(phase),along=span*Math.sin(h);
 const va=w*radius*Math.cos(phase),vl=w/2*span*Math.cos(h);
 const aa=-w*w*radius*Math.sin(phase),al=-w*w/4*span*Math.sin(h);
 return {x:0,y:(a.y+b.y)/2+py*across+zy*along,z:(a.z+b.z)/2+pz*across+zz*along,
  velocity:{x:0,y:py*va+zy*vl,z:pz*va+zz*vl},acceleration:{x:0,y:py*aa+zy*al,z:pz*aa+zz*al}};
}
