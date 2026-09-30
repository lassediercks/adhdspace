import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PredictedPath } from '../src/predicted-path.js';

test('new forecast positions ease into view instead of snapping on control changes',()=>{
 const previousWorker=globalThis.Worker;
 globalThis.Worker=class { postMessage(){} };
 let preview;
 try {preview=new PredictedPath(new THREE.Group());}finally{globalThis.Worker=previousWorker;}
 preview.apply(new Float32Array([0,0,0,1,0,0,2,0,0]),0,0);
 preview.apply(new Float32Array([0,0,0,1,10,0,2,10,0]),0,0);
 assert.equal(preview.geometry.attributes.position.getY(1),0);
 preview.follow({x:0,y:0,z:0},0,0,.1);
 assert.ok(preview.geometry.attributes.position.getY(1)>0&&preview.geometry.attributes.position.getY(1)<2);
 for(let i=0;i<100;i++)preview.follow({x:0,y:0,z:0},0,0,.1);
 assert.ok(preview.geometry.attributes.position.getY(1)>9.99);
});
