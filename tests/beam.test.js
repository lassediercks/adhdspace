import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { blockedBeamIntervals, visibleBeamIntervals, OccludedBeam } from '../src/beam.js';
import { PassingAsteroids } from '../src/asteroids.js';

function rock(x,y=0) {
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(4,2,2),new THREE.MeshBasicMaterial());
 mesh.position.set(x,y,0);return mesh;
}

test('beam stops at the near rock surface and resumes beyond the far surface',()=>{
 const blocked=blockedBeamIntervals([rock(10)]);
 assert.deepEqual(blocked,[[8,12]]);
 assert.deepEqual(visibleBeamIntervals(blocked,-20,20,0),[[-20,8],[12,20]]);
});

test('overlapping blockers merge and bodies away from the beam do not interrupt it',()=>{
 const blocked=blockedBeamIntervals([rock(10),rock(12),rock(5,8)]);
 assert.deepEqual(visibleBeamIntervals(blocked,-20,20,0),[[-20,8],[14,20]]);
 assert.deepEqual(visibleBeamIntervals(blockedBeamIntervals([rock(5,8)]),-20,20),[[-20,20]]);
});

test('occlusion tracks the actual rotating geometry and includes beam-edge grazing',()=>{
 const body=rock(10);
 body.rotation.z=Math.PI/4;
 const rotated=blockedBeamIntervals([body],0)[0];
 assert.ok(Math.abs(rotated[0]-(10-Math.sqrt(2)))<1e-6);
 assert.ok(Math.abs(rotated[1]-(10+Math.sqrt(2)))<1e-6);
 assert.equal(blockedBeamIntervals([rock(10,1.1)],0).length,0);
 assert.equal(blockedBeamIntervals([rock(10,1.1)],.14).length,1);
});

test('real tumbling asteroids clip both beam layers, which return when unobstructed',()=>{
 const scene=new THREE.Scene(),asteroids=new PassingAsteroids(scene,{seed:31});
 // Place real meshes across the beam explicitly, independent of spawn luck.
 asteroids.asteroids.slice(0,2).forEach((body,i)=>Object.assign(body.definition,{x:20+i*30,y:0,z:0}));
 const beam=new OccludedBeam(scene,asteroids.asteroids.length+1);
 const bodies=asteroids.asteroids.map(body=>body.outline);
 for(let i=0;i<20;i++) {
  asteroids.update(.1);
  const blocked=blockedBeamIntervals(bodies);
  assert.ok(blocked.length>=2);
  const visible=visibleBeamIntervals(blocked);
  for(const [start,end] of visible)for(const [near,far] of blocked)assert.ok(end<=near||start>=far);
  beam.update(bodies);
  assert.equal(beam.core.count,visible.length);
  assert.equal(beam.rim.count,visible.length);
 }
 beam.update([]);
 assert.equal(beam.core.count,1);
 assert.equal(beam.rim.count,1);
});
