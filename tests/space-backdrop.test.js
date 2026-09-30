import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SpaceBackdrop } from '../src/space-backdrop.js';

test('distant scenery follows journey progress, freezes on capture, and resets',()=>{
 const backdrop=new SpaceBackdrop(new THREE.Scene());
 const first=backdrop.layers[0].positions[0],planet=backdrop.planets[0].mesh.position.clone();
 assert.equal(backdrop.layers.reduce((sum,l)=>sum+l.positions.length/3,0),4850);
 assert.ok(backdrop.planets.every(p=>Math.hypot(p.mesh.position.y,p.mesh.position.z)-p.mesh.scale.x>180));
 backdrop.advance(2);
 assert.ok(Math.abs(backdrop.layers[0].positions[0]-(first-2))<1e-4);
 assert.equal(backdrop.planets[0].mesh.position.x,planet.x-2);
 const frozen=backdrop.layers[0].positions.slice();
 backdrop.advance(0);assert.deepEqual(backdrop.layers[0].positions,frozen);
 assert.equal(backdrop.planets[0].mesh.position.x,planet.x-2);
 backdrop.reset();assert.equal(backdrop.layers[0].positions[0],first);
 assert.deepEqual(backdrop.planets[0].mesh.position,planet);
});
