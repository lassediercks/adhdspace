import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SpaceWeather,instabilityLevel } from '../src/space-weather.js';
import { predictPath } from '../src/trajectory-prediction.js';
import { Navigation } from '../src/navigation.js';
import { Journey } from '../src/journey.js';
import { flightRoute } from '../src/flight-route.js';

test('weather severity changes strictly above sixty and eighty percent',()=>{
 assert.equal(instabilityLevel(.6),'normal');
 assert.equal(instabilityLevel(.60001),'elevated');
 assert.equal(instabilityLevel(.8),'elevated');
 assert.equal(instabilityLevel(.80001),'high');
});

test('live weather draws fresh entropy as it advances instead of replaying the asteroid seed',t=>{
 let calls=0;
 t.mock.method(globalThis.crypto,'getRandomValues',array=>{
  calls++;array[0]=Math.imul(calls,0x9e3779b1)>>>0;return array;
 });
 const weather=new SpaceWeather();
 assert.equal(weather.randomState,null);
 weather.advance(1);const firstCalls=calls,firstValue=weather.value;
 weather.advance(1);
 assert.ok(firstCalls>0&&calls>firstCalls);
 assert.notEqual(weather.value,firstValue);
});

test('forecast cannot see future random pulses and revises when live instability changes',()=>{
 const initial=flightRoute(1.05,4),nav=new Navigation();nav.threshold=100;
 const input={position:initial,velocity:initial.velocity,journey:new Journey(),navigation:nav,
  bodies:[{id:0,x:60,y:15,z:0,radius:5,mass:30,vx:0}],
  phase:1.05,radius:4,targetRadius:4,instability:.5,targetInstability:1,speed:1.5};
 const rising={...input,weather:{randomState:1,value:.5,target:1,pulseTime:10,pulseTarget:1}};
 const falling={...input,weather:{randomState:900,value:.5,target:0,pulseTime:10,pulseTarget:0}};
 const before=structuredClone(rising);
 const baseline=predictPath(rising,8);
 assert.deepEqual(baseline,predictPath(falling,8));
 assert.deepEqual(structuredClone(rising),before);
 const changed=predictPath({...input,instability:.95},8);
 let displacement=0;
 for(let i=0;i<baseline.length;i+=3)
  displacement=Math.max(displacement,Math.hypot(changed[i]-baseline[i],changed[i+1]-baseline[i+1],changed[i+2]-baseline[i+2]));
 assert.ok(displacement>1,`updated field must visibly change forecast, got ${displacement}`);
 assert.deepEqual([...changed.slice(0,3)],[...baseline.slice(0,3)]);
});
