import { flightRoute } from './flight-route.js';
import { OrbitalGravity } from './orbital-gravity.js';
import { Journey } from './journey.js';
import { advanceFlyby } from './flyby-motion.js';

export const FORECAST_STEP=1/30;
export const FORECAST_SAMPLE_INTERVAL=2*FORECAST_STEP;
export const FORECAST_SECONDS=14;
const damp=(value,target,rate,dt)=>target+(value-target)*Math.exp(-rate*dt);

// Forecast a private copy of the actual simulation. No guessed helix and no
// mutation of live momentum, capture state, scenery, or recorded flight history.
export function predictPath(snapshot, horizon=(snapshot.targetDual ? 30 : FORECAST_SECONDS)) {
  const physics=new OrbitalGravity();
  physics.reset(snapshot.position,snapshot.velocity);
  const journey=new Journey();
  journey.rate=snapshot.journey.rate;
  journey.distance=snapshot.journey.distance;
  journey.orbit=snapshot.journey.orbit?{id:snapshot.journey.orbit.id,normal:{...snapshot.journey.orbit.normal}}:null;
  let bodies=snapshot.bodies.map(body=>({...body}));
  let dual=snapshot.dual??0;
  let phase=snapshot.phase,radius=snapshot.radius,instability=snapshot.instability;
  const points=[snapshot.position.x,snapshot.position.y,snapshot.position.z];
  const steps=Math.floor(horizon/FORECAST_STEP);
  for(let i=1;i<=steps;i++) {
    phase+=FORECAST_STEP*.45;
    dual=damp(dual,snapshot.targetDual??0,2,FORECAST_STEP);
    radius=damp(radius,snapshot.targetRadius,4,FORECAST_STEP/snapshot.speed);
    instability=damp(instability,snapshot.targetInstability,3,FORECAST_STEP);
    const previousRate=journey.rate;
    const travel=journey.advance(FORECAST_STEP,physics.position,physics.velocity,bodies,instability,radius);
    physics.velocity.x+=8*(previousRate-journey.rate);
    bodies=bodies.map(body=>advanceFlyby(body,travel,physics.position,journey.rate));
    const body=journey.orbit&&bodies.find(body=>body.id===journey.orbit.id);
    physics.advance(FORECAST_STEP,flightRoute(phase,radius,dual),bodies,instability,radius,body?{body,normal:journey.orbit.normal}:null,{phase,radius,dual});
    if(i%2===0)points.push(physics.position.x+journey.distance-snapshot.journey.distance,physics.position.y,physics.position.z);
  }
  return new Float32Array(points);
}

