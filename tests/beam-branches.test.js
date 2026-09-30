import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BeamNetwork,networkFlightRoute,BRANCH_LOOKAHEAD } from '../src/beam-network.js';
import { sceneryDistance } from '../src/flight-frame.js';
import { OccludedBeam } from '../src/beam.js';

function forkNetwork(){
 for(let seed=0;seed<100;seed++){
  const network=new BeamNetwork(seed);network.advance(30,100,0);
  if(network.beams[1].divergent)return network;
 }
 throw new Error('no fork fixture');
}
test('the ship follows beam one by default even as new beams and forks appear',()=>{
 const network=new BeamNetwork();
 assert.equal(network.selected,0);assert.equal(network.weave,0);
 for(let seconds=0;seconds<=180;seconds+=5){
  network.advance(seconds,seconds*4.2,5);
  const route=networkFlightRoute(seconds*.675,0,network.beams.length-1,network,seconds*4.2,2.8);
  assert.equal(route.y,0);assert.equal(route.z,0);
  assert.equal(network.selected,0);assert.equal(network.weave,0);
 }
});

test('new beams fade in and grow over four seconds',()=>{
 const network=forkNetwork();
 assert.equal(network.reveal(1,30),0);assert.equal(network.reveal(1,32),.5);
 assert.equal(network.reveal(1,34),1);assert.equal(network.reveal(0,30),1);
 const early=network.extent(1,100,30),middle=network.extent(1,100,32),full=network.extent(1,100,34);
 assert.equal(early.end,early.start);
 assert.ok(middle.end>middle.start&&middle.end<full.end);
});

test('a diverging beam joins its parent at a visible fork ahead and selection follows the parent until the fork',()=>{
 const network=forkNetwork(),beam=network.beams[1];
 const origin=network.renderCenters(100)[1],direction=network.direction(1),extent=network.extent(1,100,34);
 assert.ok(Math.abs(direction.x*extent.start-BRANCH_LOOKAHEAD)<1e-9);
 const parentAtFork=network.centerAt(beam.parent,beam.forkDistance);
 assert.ok(Math.hypot(origin.y+direction.y*extent.start-parentAtFork.y,origin.z+direction.z*extent.start-parentAtFork.z)<1e-9);
 assert.ok(network.choose(1));
 const before=networkFlightRoute(1,0,1,network,beam.forkDistance-1,2.8);
 assert.equal(before.y,0);assert.equal(before.z,0);
 const after=networkFlightRoute(1,0,1,network,beam.forkDistance+10,2.8);
 assert.ok(Math.abs(after.y-beam.slopeY*sceneryDistance(10))<1e-8);
 assert.ok(Math.abs(after.z-beam.slopeZ*sceneryDistance(10))<1e-8);
});

test('fork beams have no light or click target behind their starting point',()=>{
 const scene=new THREE.Scene(),beam=new OccludedBeam(scene,2);
 beam.update([],{y:0,z:0},{x:1,y:0,z:0},{start:240,end:360});
 scene.updateMatrixWorld(true);
 assert.deepEqual(beam.intervals,[[240,360]]);
 const behind=new THREE.Raycaster(new THREE.Vector3(100,0,10),new THREE.Vector3(0,0,-1));
 const ahead=new THREE.Raycaster(new THREE.Vector3(260,.1,10),new THREE.Vector3(0,0,-1));
 assert.equal(behind.intersectObject(beam.pick).length,0);
 assert.ok(ahead.intersectObject(beam.pick).length>0);
});
