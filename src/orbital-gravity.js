import { networkFlightRoute } from './beam-network.js';
import { derailmentRisk } from './flight-controls.js';
import { flightRoute } from './flight-route.js';
// Newtonian test-particle dynamics in a frame translating at constant velocity.
// Planets follow prescribed flybys; orbit guidance and avoidance are explicit
// thruster accelerations, not gravitational forces or position corrections.
const SHIP_EXTENT = 3;
const OMEGA = 0.45;
const MAX_GUIDANCE_ACCELERATION = 3;
const MAX_AVOIDANCE_ACCELERATION = 180;
const AXES = ['x', 'y', 'z'];
const length = v => Math.hypot(v.x, v.y, v.z);
function limit(v, max) {
  const magnitude = length(v);
  if (magnitude > max) for (const axis of AXES) v[axis] *= max / magnitude;
  return v;
}

export function bodyClearance(body, orbitRadius) {
  return (body.avoidanceRadius ?? body.radius) + orbitRadius + SHIP_EXTENT;
}

export function gravitationalAcceleration(position, asteroids, instability) {
  const strength = Math.max(0, Math.min(1, instability));
  // Space weather scales gravity; coherence separately governs navigation.
  const G = 140 * strength * strength / (1 - 0.85 * strength);
  const acceleration = { x: 0, y: 0, z: 0 };
  for (const body of asteroids) {
    const delta = {x:body.x-position.x, y:body.y-position.y, z:body.z-position.z};
    const distance = length(delta);
    // Outside a spherical body: exact inverse-square acceleration.
    // Inside: the finite field of a uniform-density sphere (no singularity).
    const denominator = Math.pow(Math.max(distance, body.radius, 1e-6), 3);
    const factor = G * body.mass / denominator;
    for (const axis of AXES) acceleration[axis] += delta[axis] * factor;
  }
  return acceleration;
}

export class OrbitalGravity {
  constructor() { this.reset(); }

  reset(position = null, velocity = null) {
    this.position = position && {...position};
    this.velocity = velocity ? {...velocity} : {x:0,y:0,z:0};
    this.offset = {x:0,y:0,z:0};
  }

  acceleration(position, velocity, nominal, asteroids, strength, radius, orbit, navigation = null) {
    const acceleration = gravitationalAcceleration(position, asteroids, strength);
    // Omitted radius means an unpowered test particle; zero is guided beam flight.
    if (radius == null) return acceleration;
    const rescuing=navigation?.mode==='rescuing';
    if(rescuing)nominal={x:0,y:0,z:0,velocity:{x:0,y:0,z:0},acceleration:{x:0,y:0,z:0}};
    let guidance = {
      x: -0.8 * position.x - 1.5 * velocity.x,
      y: (nominal.acceleration?.y ?? -OMEGA * OMEGA * nominal.y) + 0.8 * (nominal.y-position.y) + 1.5 * ((nominal.velocity?.y ?? -OMEGA*nominal.z)-velocity.y),
      z: (nominal.acceleration?.z ?? -OMEGA * OMEGA * nominal.z) + 0.8 * (nominal.z-position.z) + 1.5 * ((nominal.velocity?.z ?? OMEGA*nominal.y)-velocity.z),
    };
    if(orbit&&!rescuing) {
      const body=asteroids.find(p=>p.id===orbit.body.id)??orbit.body;
      const radial={x:position.x-body.x,y:position.y-body.y,z:position.z-body.z};
      const distance=Math.max(length(radial),.001);
      for(const axis of AXES)radial[axis]/=distance;
      const n=orbit.normal;
      const tangent={x:n.y*radial.z-n.z*radial.y,y:n.z*radial.x-n.x*radial.z,z:n.x*radial.y-n.y*radial.x};
      const tangentLength=Math.max(length(tangent),.001);
      const orbitalRadius=bodyClearance(body,radius)+5;
      const surfacePoint={x:body.x+radial.x*orbitalRadius,y:body.y+radial.y*orbitalRadius,z:body.z+radial.z*orbitalRadius};
      const g=gravitationalAcceleration(surfacePoint,[body],strength);
      const speed=Math.sqrt(length(g)*orbitalRadius);
      guidance={x:0,y:0,z:0};
      for(const axis of AXES) {
        const targetVelocity=tangent[axis]/tangentLength*speed+(axis==='x'?(body.vx??0):0);
        guidance[axis]=.8*(surfacePoint[axis]-position[axis])+1.5*(targetVelocity-velocity[axis]);
      }
    }
    const disruption=Math.min(1,derailmentRisk(strength,radius)*(navigation?.exposure??1));
    const lock=navigation?.lock??1;
    limit(guidance,rescuing?24:MAX_GUIDANCE_ACCELERATION*(orbit?1:1-.9*disruption));
    if(!orbit||rescuing) {
      const compensation=limit({x:-acceleration.x,y:-acceleration.y,z:-acceleration.z},MAX_AVOIDANCE_ACCELERATION);
      for(const axis of AXES) {
        guidance[axis]*=rescuing?1:lock;
        guidance[axis]+=compensation[axis]*(rescuing?1:(1-disruption)*lock);
      }
    }
    for(const axis of AXES)acceleration[axis]+=guidance[axis];

    const avoidance = {x:0,y:0,z:0};
    for (const body of asteroids) {
      const normal = {x:position.x-body.x,y:position.y-body.y,z:position.z-body.z};
      const distance = length(normal);
      if (distance < 1e-8) continue;
      for (const axis of AXES) normal[axis] /= distance;
      const gap = distance - bodyClearance(body, radius);
      const closing = Math.max(0, -((velocity.x-(body.vx??0))*normal.x + velocity.y*normal.y + velocity.z*normal.z));
      const brakingZone = 4 + closing * 1.5;
      const t = Math.max(0, Math.min(1, 1-gap/brakingZone));
      const activation = t*t*(3-2*t);
      const inwardAcceleration = Math.max(0,-(acceleration.x*normal.x+acceleration.y*normal.y+acceleration.z*normal.z));
      const thrust = activation * (inwardAcceleration + 8*closing + 45*activation);
      for (const axis of AXES) avoidance[axis] += normal[axis]*thrust;
    }
    limit(avoidance, MAX_AVOIDANCE_ACCELERATION);
    for (const axis of AXES) acceleration[axis] += avoidance[axis];
    return acceleration;
  }

  advance(dt, nominal, asteroids, instability, orbitRadius = null, orbit = null, route = null, navigation = null) {
    if (dt <= 0) return this.offset;
    if (!this.position) {
      const angle = -OMEGA*dt;
      this.position = {x:nominal.x,y:nominal.y*Math.cos(angle)-nominal.z*Math.sin(angle),z:nominal.y*Math.sin(angle)+nominal.z*Math.cos(angle)};
      this.velocity = {x:0,y:-OMEGA*this.position.z,z:OMEGA*this.position.y};
    }
    const steps = Math.ceil(dt/(1/240));
    const h = dt/steps;
    // Snapshot positions are at the end of the render interval. Interpolate each
    // moving source and nominal orbit through the interval, avoiding frame-rate kicks.
    const atTime = offset => {
      const angle = OMEGA*offset;
      return {
        target:route?.network ? networkFlightRoute(route.phase+OMEGA*offset,route.radius,route.dual,route.network,route.distance+route.forwardSpeed*offset,route.forwardSpeed) : route ? flightRoute(route.phase+OMEGA*offset,route.radius,route.dual) : {x:nominal.x,y:nominal.y*Math.cos(angle)-nominal.z*Math.sin(angle),z:nominal.y*Math.sin(angle)+nominal.z*Math.cos(angle)},
        sources:asteroids.map(p=>({...p,x:p.x+(p.vx??0)*offset})),
      };
    };
    for(let step=0;step<steps;step++) {
      const start=atTime(step*h-dt);
      const a=this.acceleration(this.position,this.velocity,start.target,start.sources,instability,orbitRadius,orbit,navigation);
      for(const axis of AXES) {
        this.velocity[axis]+=a[axis]*h/2;
        this.position[axis]+=this.velocity[axis]*h;
      }
      const end=atTime((step+1)*h-dt);
      const b=this.acceleration(this.position,this.velocity,end.target,end.sources,instability,orbitRadius,orbit,navigation);
      for(const axis of AXES) this.velocity[axis]+=b[axis]*h/2;
    }
    for(const axis of AXES) this.offset[axis]=this.position[axis]-nominal[axis];
    return this.offset;
  }
}
