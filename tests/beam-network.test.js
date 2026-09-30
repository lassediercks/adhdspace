import { sceneryDistance } from '../src/flight-frame.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BeamNetwork,networkFlightRoute } from '../src/beam-network.js';
import { blockedBeamIntervals,OccludedBeam } from '../src/beam.js';
import { OrbitalGravity } from '../src/orbital-gravity.js';
import { Navigation } from '../src/navigation.js';
import { Journey } from '../src/journey.js';
import { predictPath,FORECAST_STEP } from '../src/trajectory-prediction.js';

test('each added beam has an unbiased seeded chance of a slight divergence',()=>{
 let divergent=0;
 for(let seed=0;seed<1000;seed++) {
  const a=new BeamNetwork(seed),b=new BeamNetwork(seed);
  a.advance(30,100,0);b.advance(30,100,0);assert.deepEqual(a,b);
  const beam=a.beams[1];divergent+=beam.divergent;
  const angle=Math.atan(Math.hypot(beam.slopeY,beam.slopeZ))*180/Math.PI;
  if(beam.divergent)assert.ok(angle>=2&&angle<=5);else assert.equal(angle,0);
 }
 assert.ok(divergent>450&&divergent<550,`${divergent}/1000`);
});

test('divergence widens oscillation and risk until a smooth pilot selection settles it',()=>{
 const network=new BeamNetwork(1);network.advance(30,0,0);
 // Controlled fork geometry isolates widening from the seeded chance.
 network.beams[1]={slopeY:.05,slopeZ:.03,bornDistance:0,divergent:true};network.choiceNeeded=true;
 assert.ok(network.exposure(300)>network.exposure(100));
 const near=network.centers(10),far=network.centers(300);
 assert.ok(Math.hypot(far[1].y,far[1].z)>Math.hypot(near[1].y,near[1].z));
 const before=networkFlightRoute(1,0,1,network,300,2.8);
 assert.ok(network.choose(1));
 assert.deepEqual(networkFlightRoute(1,0,1,network,300,2.8),before);
 network.advance(40,300,30);
 const selected=networkFlightRoute(1,0,1,network,300,2.8),center=network.centers(300)[1];
 assert.ok(Math.hypot(selected.y-center.y,selected.z-center.z)<.01);
 assert.ok(network.exposure(300)<1.01);
 assert.ok(selected.velocity.y>0&&selected.velocity.z>0);
 assert.equal(network.choose(10),false);
});

test('angled beams clip the real rock silhouette and have a forgiving clickable width',()=>{
 const scene=new THREE.Scene(),axis=new THREE.Vector3(1,.1,0).normalize();
 const rock=new THREE.Mesh(new THREE.BoxGeometry(4,2,2),new THREE.MeshBasicMaterial());
 rock.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0),axis);rock.position.copy(axis).multiplyScalar(80);scene.add(rock);
 const blocked=blockedBeamIntervals([rock],0,{y:0,z:0},axis);
 assert.ok(Math.abs(blocked[0][0]-78)<1e-8&&Math.abs(blocked[0][1]-82)<1e-8);
 assert.equal(blockedBeamIntervals([rock]).length,0);
 const beam=new OccludedBeam(scene,2);beam.update([],{y:0,z:0},axis);scene.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(new THREE.Vector3(10,1.3,10),new THREE.Vector3(0,0,-1));
 assert.equal(ray.intersectObject(beam.core).length,0);
 assert.ok(ray.intersectObject(beam.pick).length>0);
});

test('forecast shares scheduled divergence and click selection with live flight',()=>{
 const network=new BeamNetwork(4),navigation=new Navigation(4),journey=new Journey(),physics=new OrbitalGravity();
 network.advance(30,20,0);network.choose(1);
 const initial=networkFlightRoute(1,2,1,network,0,2.8);physics.reset(initial,initial.velocity);
 const snapshot={position:physics.position,velocity:physics.velocity,journey,navigation,network,bodies:[],phase:1,radius:2,targetRadius:2,instability:0,targetInstability:0,speed:1.5,dual:1,targetDual:1,flightSeconds:59};
 const forecast=predictPath(snapshot,4),copy=structuredClone(snapshot);
 assert.deepEqual(structuredClone(snapshot),copy);
 let phase=1,seconds=59,dual=1;
 for(let i=1;i<=120;i++) {
  const dt=FORECAST_STEP;phase+=dt*.45;seconds+=dt/1.5;
  network.advance(seconds,journey.distance,dt/1.5);
  dual=network.beams.length-1+(dual-(network.beams.length-1))*Math.exp(-2*dt);
  navigation.exposure=network.exposure(journey.distance);
  navigation.advance(dt,physics.position,physics.velocity,[],0,2,dt/1.5);
  journey.advance(dt,physics.position,physics.velocity,[],0,2,navigation);
  const target=networkFlightRoute(phase,2,dual,network,journey.distance,2.8);
  physics.advance(dt,target,[],0,2,null,{phase,radius:2,dual,network,distance:journey.distance,forwardSpeed:2.8},navigation);
  if(i%2===0) {
   const at=i/2*3;
   assert.ok(Math.hypot(forecast[at]-physics.position.x-sceneryDistance(journey.distance),forecast[at+1]-physics.position.y,forecast[at+2]-physics.position.z)<1e-4);
  }
 }
});


test('far branches fade smoothly, retire permanently and reject clicks without hiding the followed beam',()=>{
 const network=new BeamNetwork();network.advance(30,0,0);
 network.beams[1]={slopeY:.05,slopeZ:0,bornDistance:0,divergent:true};
 assert.equal(network.opacity(1,800),1);
 assert.ok(Math.abs(network.opacity(1,1200)-.5)<1e-10);
 assert.equal(network.opacity(1,1600),0);
 const before=networkFlightRoute(8,3,1,network,1599.99,2.8);
 network.advance(30,1600,1/60);
 assert.equal(network.choose(1),false);assert.equal(network.beams[1].retired,true);
 assert.equal(network.opacity(0,1600),1);
 const after=networkFlightRoute(8,3,1,network,1600,2.8);
 assert.ok(Math.hypot(after.y-before.y,after.z-before.z)<.001);
 assert.ok(Math.hypot(after.velocity.y-before.velocity.y,after.velocity.z-before.velocity.z)<.001);
 network.advance(30,0,0);assert.equal(network.opacity(1),0);
 const followed=new BeamNetwork();followed.advance(30,0,0);
 followed.beams[1]={slopeY:.05,slopeZ:0,bornDistance:0,divergent:true};
 assert.ok(followed.choose(1));followed.advance(30,2000,1);
 assert.equal(followed.opacity(1),1);assert.equal(followed.opacity(0),0);
 assert.equal(followed.choose(0),false);
 followed.rescueToPrimary();assert.equal(followed.selected,0);assert.equal(followed.opacity(0),1);
});

test('parallel beams keep their brightness even on a long journey',()=>{
 const network=new BeamNetwork();network.advance(30,0,0);
 network.beams[1]={slopeY:0,slopeZ:0,bornDistance:0,divergent:false};
 network.advance(30,100000,1);
 assert.equal(network.opacity(0),1);assert.equal(network.opacity(1),1);
 assert.ok(network.choose(1));
});
