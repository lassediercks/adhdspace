import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { flightRoute, SECOND_BEAM_CENTER, beamCenter, BEAM_SPACING } from '../src/flight-route.js';
import { OrbitalGravity } from '../src/orbital-gravity.js';
import { blockedBeamIntervals } from '../src/beam.js';
import { predictPath, FORECAST_STEP } from '../src/trajectory-prediction.js';
import { Journey } from '../src/journey.js';

test('figure eight encloses each beam with opposite winding and a smooth crossing',()=>{
 const winding = (center,radius) => {
  let total=0, previous;
  for(let i=0;i<=2000;i++) {
   const p=flightRoute(i/2000*4*Math.PI,radius,1);
   const angle=Math.atan2(p.y,p.z-center);
   if(previous!==undefined)total+=Math.atan2(Math.sin(angle-previous),Math.cos(angle-previous));
   previous=angle;
  }
  return Math.round(total/(2*Math.PI));
 };
 for(const radius of [1,2,4,7]) {
  assert.equal(winding(0,radius),1);
  assert.equal(winding(SECOND_BEAM_CENTER.z,radius),-1);
 }
 const a=flightRoute(0,4,1), b=flightRoute(2*Math.PI,4,1);
 assert.ok(Math.hypot(a.y-b.y,a.z-b.z)<1e-10);
 assert.ok(Math.hypot(a.velocity.y,a.velocity.z)>1);
});

test('finite thrust tracks a complete figure eight at maximum radius',()=>{
 const physics=new OrbitalGravity(), radius=7, dt=1/120;
 const initial=flightRoute(0,radius,1);physics.reset(initial,initial.velocity);
 for(let t=dt;t<28;t+=dt) {
  const phase=t*.45,target=flightRoute(phase,radius,1);
  physics.advance(dt,target,[],0,radius,null,{phase,radius,dual:1});
  assert.ok(Math.hypot(physics.position.y-target.y,physics.position.z-target.z)<.004);
 }
});

test('forecast matches live transition into the second-beam route',()=>{
 const radius=4, initial=flightRoute(1.05,radius,0), physics=new OrbitalGravity();
 physics.reset(initial,initial.velocity);
 const snapshot={position:physics.position,velocity:physics.velocity,journey:new Journey(),bodies:[],phase:1.05,radius,targetRadius:radius,instability:0,targetInstability:0,speed:1.5,dual:0,targetDual:1};
 const points=predictPath(snapshot,4);let phase=snapshot.phase,dual=0;
 for(let i=1;i<=120;i++) {
  phase+=FORECAST_STEP*.45;dual=1+(dual-1)*Math.exp(-2*FORECAST_STEP);
  physics.advance(FORECAST_STEP,flightRoute(phase,radius,dual),[],0,radius,null,{phase,radius,dual});
  if(i%2===0) {
   const index=i/2*3;
   assert.ok(Math.abs(points[index+1]-physics.position.y)<1e-5);
   assert.ok(Math.abs(points[index+2]-physics.position.z)<1e-5);
  }
 }
});

test('a rock on the second beam clips only that beam',()=>{
 const rock=new THREE.Mesh(new THREE.BoxGeometry(4,4,4),new THREE.MeshBasicMaterial());
 rock.position.set(10,0,8);
 assert.equal(blockedBeamIntervals([rock]).length,0);
 assert.deepEqual(blockedBeamIntervals([rock],.14,{y:0,z:8}),[[8,12]]);
});

test('zero radius flies straight along a single beam',()=>{
 for(const dual of [0]) {
  const physics=new OrbitalGravity();
  physics.reset({x:0,y:0,z:0},{x:0,y:0,z:0});
  for(let i=0;i<300;i++) {
   const route={phase:i/60*.45,radius:0,dual};
   const target=flightRoute(route.phase,0,dual);
   physics.advance(1/60,target,[],0,0,null,route);
   assert.equal(Math.hypot(physics.position.y,physics.position.z),0);
  }
  const points=predictPath({position:physics.position,velocity:physics.velocity,journey:new Journey(),bodies:[],phase:2,radius:0,targetRadius:0,instability:0,targetInstability:0,speed:1.5,dual,targetDual:dual},2);
  assert.ok(points.at(-3)>0,'forward travel continues');
  for(let i=0;i<points.length;i+=3)assert.equal(Math.hypot(points[i+1],points[i+2]),0);
 }
});

test('changing radius to zero smoothly removes orbital momentum and centers the ship',()=>{
 const physics=new OrbitalGravity(), initial=flightRoute(1.05,4);
 physics.reset(initial,initial.velocity);
 let radius=4;
 for(let i=1;i<=1800;i++) {
  radius*=Math.exp(-4/90);
  const route={phase:1.05+i/60*.45,radius,dual:0};
  const previous={...physics.position};
  physics.advance(1/60,flightRoute(route.phase,radius),[],0,radius,null,route);
  assert.ok(Math.hypot(physics.position.y-previous.y,physics.position.z-previous.z)<.1);
 }
 assert.ok(Math.hypot(physics.position.y,physics.position.z)<1e-7);
 assert.ok(Math.hypot(physics.velocity.y,physics.velocity.z)<1e-7);
 // A disturbance at exactly zero still gets corrected by guidance.
 physics.position.y=1;
 for(let i=0;i<1800;i++)physics.advance(1/60,flightRoute(0,0),[],0,0,null,{phase:0,radius:0,dual:0});
 assert.ok(Math.abs(physics.position.y)<1e-7);
});


test('radius changes expand lobes around fixed beams and preserve their crossing',()=>{
 for(const radius of [1,2,4,7]) {
  assert.ok(Math.abs(flightRoute(3*Math.PI,radius,1).z+radius)<1e-10);
  assert.ok(Math.abs(flightRoute(Math.PI,radius,1).z-(SECOND_BEAM_CENTER.z+radius))<1e-10);
  assert.equal(flightRoute(0,radius,1).z,SECOND_BEAM_CENTER.z/2);
 }

});

test('3–10 beams form regular polygons with fixed edge spacing',()=>{
 for(let count=3;count<=10;count++) {
  const points=Array.from({length:count},(_,i)=>beamCenter(i,count));
  const center=points.reduce((sum,p)=>({y:sum.y+p.y/count,z:sum.z+p.z/count}),{y:0,z:0});
  const radius=Math.hypot(points[0].y-center.y,points[0].z-center.z);
  for(let i=0;i<count;i++) {
   const p=points[i],next=points[(i+1)%count];
   assert.ok(Math.abs(Math.hypot(p.y-next.y,p.z-next.z)-BEAM_SPACING)<1e-10);
   assert.ok(Math.abs(Math.hypot(p.y-center.y,p.z-center.z)-radius)<1e-10);
  }
  assert.ok(points.some(p=>p.y>1));
  assert.deepEqual(points[0],{y:0,z:0});
 }
 const triangle=beamCenter(2,3);
 assert.ok(Math.abs(triangle.y-4*Math.sqrt(3))<1e-10);
 assert.ok(Math.abs(triangle.z-4)<1e-10);
 const square=Array.from({length:4},(_,i)=>beamCenter(i,4));
 const expected=[[0,0],[0,8],[8,8],[8,0]];
 square.forEach((p,i)=>assert.ok(Math.hypot(p.y-expected[i][0],p.z-expected[i][1])<1e-10));
});

test('polygon routes orbit each beam, close smoothly, and stay within engine authority',()=>{
 for(let count=3;count<=10;count++) {
  const physics=new OrbitalGravity(),radius=7,dual=count-1;
  const initial=flightRoute(0,radius,dual);physics.reset(initial,initial.velocity);
  const dt=1/60,seconds=count*4*Math.PI/.45;
  for(let i=1;i<=Math.ceil(seconds/dt);i++) {
   const phase=Math.min(i*dt,seconds)*.45,target=flightRoute(phase,radius,dual);
   physics.advance(Math.min(i*dt,seconds)-(i-1)*dt,target,[],0,radius,null,{phase,radius,dual});
   assert.ok(Math.hypot(physics.position.y-target.y,physics.position.z-target.z)<.01);
  }
  for(let beam=0;beam<count;beam++) {
   const center=beamCenter(beam,count);
   let previous=null,winding=0;
   for(let i=0;i<=100;i++) {
    const p=flightRoute(beam*4*Math.PI+i/100*3*Math.PI,radius,dual);
    assert.ok(Math.abs(Math.hypot(p.y-center.y,p.z-center.z)-radius)<1e-8);
    const angle=Math.atan2(p.z-center.z,p.y-center.y);
    if(previous!==null)winding+=Math.atan2(Math.sin(angle-previous),Math.cos(angle-previous));
    previous=angle;
   }
   assert.equal(Math.abs(Math.round(winding/(2*Math.PI))),1);
   for(const boundary of [beam*4*Math.PI,beam*4*Math.PI+3*Math.PI]) {
    const a=flightRoute(boundary-1e-6,radius,dual),b=flightRoute(boundary+1e-6,radius,dual);
    assert.ok(Math.hypot(a.y-b.y,a.z-b.z)<1e-4);
    for(const key of ['velocity','acceleration'])assert.ok(Math.hypot(a[key].y-b[key].y,a[key].z-b[key].z)<1e-4);
   }
  }
 }
});

test('100% coherence visits each polygon vertex and transfers along polygon edges',()=>{
 for(let count=3;count<=10;count++) {
  for(let beam=0;beam<count;beam++) {
   const center=beamCenter(beam,count),next=beamCenter((beam+1)%count,count);
   const atBeam=flightRoute(beam*4*Math.PI+Math.PI,0,count-1);
   assert.ok(Math.hypot(atBeam.y-center.y,atBeam.z-center.z)<1e-10);
   for(let i=0;i<=20;i++) {
    const point=flightRoute((beam*4+3+i/20)*Math.PI,0,count-1);
    const dy=next.y-center.y,dz=next.z-center.z;
    assert.ok(Math.abs((point.y-center.y)*dz-(point.z-center.z)*dy)<1e-8);
    const t=((point.y-center.y)*dy+(point.z-center.z)*dz)/(BEAM_SPACING**2);
    assert.ok(t>=-1e-10&&t<=1+1e-10);
   }
  }
 }
});

test('asteroids clip raised polygon beams at their actual Y and Z offsets',()=>{
 const center=beamCenter(2,3);
 const rock=new THREE.Mesh(new THREE.BoxGeometry(4,2,2),new THREE.MeshBasicMaterial());
 rock.position.set(10,center.y,center.z);
 assert.equal(blockedBeamIntervals([rock]).length,0);
 assert.deepEqual(blockedBeamIntervals([rock],.14,center),[[8,12]]);
});
