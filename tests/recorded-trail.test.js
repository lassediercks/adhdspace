import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RecordedTrail } from '../src/recorded-trail.js';

test('trail chunks preserve every segment, append without rebuilding, and clear on reset',()=>{
 const view=new RecordedTrail(new THREE.Group(),4);
 const samples=Array.from({length:10},(_,i)=>({x:i+100,y:i,z:0}));
 view.update(samples.slice(0,3),102);
 const first=view.group.children[0].geometry;
 view.update(samples,109);
 assert.equal(view.group.children.length,3);
 assert.equal(view.group.children[0].geometry,first);
 assert.equal(view.group.position.x,-109);
 const segments=[];
 for(const line of view.group.children) {
  const p=line.geometry.attributes.position;
  for(let i=1;i<line.geometry.drawRange.count;i++)segments.push([p.getX(i-1)+line.position.x,p.getX(i)+line.position.x]);
 }
 assert.deepEqual(segments,Array.from({length:9},(_,i)=>[100+i,101+i]));
 assert.equal(view.material.fog,false);
 assert.equal(view.material.color.getHex(),0xd5b88a);
 view.clear();assert.equal(view.group.children.length,0);
 view.update([samples[0]],100);assert.equal(view.group.children.length,1);
});
