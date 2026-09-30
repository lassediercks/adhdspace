import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forecastFlight } from '../src/trajectory-prediction.js';
import { Navigation } from '../src/navigation.js';
import { Journey } from '../src/journey.js';
import { flightRoute } from '../src/flight-route.js';

function snapshot(radius=5.6,instability=0){
 const route=flightRoute(1.05,radius),navigation=new Navigation();
 navigation.fuel=50;navigation.threshold=100;
 return {position:route,velocity:route.velocity,navigation,journey:new Journey(),
  bodies:[{id:7,kind:'station',x:30,y:15,z:0,radius:3,mass:3,vx:-8}],
  phase:1.05,radius,targetRadius:radius,instability,speed:1.5};
}
test('forecast identifies actual refueling opportunities without mutating live fuel or station state',()=>{
 const input=snapshot(),before=structuredClone(input);
 assert.equal(forecastFlight(input,8).willRefuel,true);
 assert.deepEqual(structuredClone(input),before);
 const far=snapshot();far.bodies[0].y=200;
 assert.equal(forecastFlight(far,8).willRefuel,false);
 const consumed=snapshot();consumed.navigation.consumedStations=['7:0'];
 assert.equal(forecastFlight(consumed,8).willRefuel,false);
});
test('blue requires docking eligibility, not merely intersecting a station on a fully stabilized route',()=>{
 const stable=snapshot(0);stable.bodies[0].x=10;stable.bodies[0].y=0;
 assert.equal(forecastFlight(stable,1).willRefuel,false);
 stable.navigation.mode='derailed';stable.instability=.95;
 assert.equal(forecastFlight(stable,1).willRefuel,true);
});
