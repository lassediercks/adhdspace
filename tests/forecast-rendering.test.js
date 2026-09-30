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

test('high instability makes revised forecasts more visible and responsive without snapping',()=>{
 const previousWorker=globalThis.Worker;
 globalThis.Worker=class { postMessage(){} };
 let calm,high;
 try {calm=new PredictedPath(new THREE.Group());high=new PredictedPath(new THREE.Group());}
 finally{globalThis.Worker=previousWorker;}
 for(const preview of [calm,high]){
  preview.apply(new Float32Array([0,0,0,1,0,0,2,0,0]),0,0);
  preview.apply(new Float32Array([0,0,0,1,10,0,2,10,0]),0,0);
 }
 calm.follow({x:0,y:0,z:0},0,0,.1,.5);
 high.follow({x:0,y:0,z:0},0,0,.1,1);
 assert.ok(high.geometry.attributes.position.getY(1)>calm.geometry.attributes.position.getY(1));
 assert.ok(high.geometry.attributes.position.getY(1)<5);
 assert.ok(high.line.material.opacity>calm.line.material.opacity);
 assert.equal(high.geometry.attributes.position.getY(0),0);
});

test('a refueling forecast turns blue even in high weather and clears when the opportunity is lost',()=>{
 const previousWorker=globalThis.Worker;globalThis.Worker=class { postMessage(){} };
 let preview;
 try {preview=new PredictedPath(new THREE.Group());}finally{globalThis.Worker=previousWorker;}
 const points=new Float32Array([0,0,0,1,0,0,2,0,0]);
 preview.apply(points,0,0,true);
 preview.follow({x:0,y:0,z:0},0,0,10,1);
 assert.equal(preview.line.material.color.getHex(),0x64b5ff);
 assert.equal(preview.line.material.opacity,.55);
 preview.apply(points,0,0,false);
 preview.follow({x:0,y:0,z:0},0,0,10,1);
 assert.equal(preview.line.material.color.getHex(),0xf19a7a);
});

test('forecast geometry moves with visible asteroids between worker updates and refreshes',()=>{
 const previousWorker=globalThis.Worker;globalThis.Worker=class { postMessage(){} };
 let preview;
 try {preview=new PredictedPath(new THREE.Group());}finally{globalThis.Worker=previousWorker;}
 preview.apply(new Float32Array([0,0,0,80,10,0,80,0,10]),0,0);
 // One simulated second moves scenery eight units while journey advances 2.8.
 preview.follow({x:0,y:0,z:0},2.8,0,0);
 assert.equal(preview.line.position.x,-8);
 assert.equal(preview.geometry.attributes.position.getX(1)+preview.line.position.x,72);
 preview.apply(new Float32Array([0,0,0,72,10,0,72,0,10]),0,2.8);
 preview.follow({x:0,y:0,z:0},2.8,0,0);
 assert.equal(preview.geometry.attributes.position.getX(1)+preview.line.position.x,72);
});
