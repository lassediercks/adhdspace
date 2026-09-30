import { BeamNetwork, networkFlightRoute } from './beam-network.js';
import { scheduledBeamCount } from './beam-schedule.js';
import { Navigation, activeBodies } from './navigation.js';
import { smoothControl } from './flight-controls.js';
import { flightRoute } from './flight-route.js';
import { OrbitalGravity } from './orbital-gravity.js';
import { Journey } from './journey.js';
import { advanceFlyby } from './flyby-motion.js';

export const FORECAST_STEP=1/30;
export const FORECAST_SAMPLE_INTERVAL=2*FORECAST_STEP;
export const FORECAST_SECONDS=42;
export const MULTI_BEAM_FORECAST_SECONDS=90;
const damp=(value,target,rate,dt)=>target+(value-target)*Math.exp(-rate*dt);

// Forecast physics under current weather, not future random changes. No guessed helix or
// mutation of live momentum, capture state, scenery, or recorded flight history.
export function forecastFlight(snapshot, horizon=(snapshot.targetDual ? MULTI_BEAM_FORECAST_SECONDS : FORECAST_SECONDS)) {
  const physics=new OrbitalGravity();
  physics.reset(snapshot.position,snapshot.velocity);
  const journey=new Journey();
  const navigation=snapshot.navigation?new Navigation(snapshot.navigation.seed):null;
  navigation?.restore(snapshot.navigation);
  const network=snapshot.network?new BeamNetwork(snapshot.network.seed):null;
  if(network)network.restore(snapshot.network);
  journey.rate=snapshot.journey.rate;
  journey.distance=snapshot.journey.distance;
  journey.orbit=snapshot.journey.orbit?{id:snapshot.journey.orbit.id,normal:{...snapshot.journey.orbit.normal}}:null;
  let bodies=snapshot.bodies.map(body=>({...body}));
  let dual=snapshot.dual??0,flightSeconds=snapshot.flightSeconds;
  let phase=snapshot.phase,radius=snapshot.radius,instability=snapshot.instability;
  let willRefuel=false;
  const points=[snapshot.position.x,snapshot.position.y,snapshot.position.z];
  const steps=Math.floor(horizon/FORECAST_STEP);
  for(let i=1;i<=steps;i++) {
    phase+=FORECAST_STEP*.45;
    if(flightSeconds!==undefined)flightSeconds+=FORECAST_STEP/snapshot.speed;
    network?.advance(flightSeconds??0,journey.distance,FORECAST_STEP/snapshot.speed);
    const targetDual=network?network.beams.length-1:flightSeconds===undefined?(snapshot.targetDual??0):scheduledBeamCount(flightSeconds)-1;
    dual=damp(dual,targetDual,2,FORECAST_STEP);
    radius=smoothControl(radius,snapshot.targetRadius,FORECAST_STEP/snapshot.speed);
    // Hold the observed field: future random weather is unknowable. A new
    // observation will revise this route on the next forecast refresh.
    if(navigation&&network)navigation.exposure=network.exposure(journey.distance);
    navigation?.advance(FORECAST_STEP,physics.position,physics.velocity,activeBodies(bodies,navigation),instability,radius,FORECAST_STEP/snapshot.speed);
    if(navigation?.refueling)willRefuel=true;
    const previousRate=journey.rate;
    const travel=journey.advance(FORECAST_STEP,physics.position,physics.velocity,bodies,instability,radius,navigation);
    physics.velocity.x+=8*(previousRate-journey.rate);
    bodies=bodies.map(body=>advanceFlyby(body,travel,physics.position,journey.rate,flightSeconds??0,navigation));
    const sources=activeBodies(bodies,navigation);
    const body=journey.orbit&&sources.find(body=>body.id===journey.orbit.id);
    const route={phase,radius,dual,network,distance:journey.distance,forwardSpeed:journey.rate*2.8};
    const target=network?networkFlightRoute(phase,radius,dual,network,journey.distance,route.forwardSpeed):flightRoute(phase,radius,dual);
    physics.advance(FORECAST_STEP,target,sources,instability,radius,body?{body,normal:journey.orbit.normal}:null,route,navigation);
    if(i%2===0)points.push(physics.position.x+journey.distance-snapshot.journey.distance,physics.position.y,physics.position.z);
  }
  return {positions:new Float32Array(points),willRefuel};
}


export function predictPath(snapshot,horizon) {
  return forecastFlight(snapshot,horizon).positions;
}
