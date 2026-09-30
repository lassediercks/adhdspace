import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FlightTrail } from '../src/flight-trail.js';

test('radius changes and mutable ship positions cannot rewrite flown history', () => {
  const trail = new FlightTrail();
  const ship = {x:0,y:4,z:0};
  trail.record(0, ship);
  ship.y = 7;
  trail.record(1, ship);
  const positions = new Float32Array(6), colors = new Float32Array(6);
  assert.equal(trail.writeBuffers(1, positions, colors), 2);
  assert.deepEqual([...positions], [-1,4,0,0,7,0]);
  trail.writeBuffers(2, positions, colors);
  assert.deepEqual([...positions], [-2,4,0,-1,7,0]);
});

test('paused flight does not append or change recorded positions', () => {
  const trail = new FlightTrail();
  trail.record(2, {x:0,y:4,z:1});
  trail.record(2, {x:0,y:4,z:1});
  assert.equal(trail.samples.length, 1);
  assert.equal(trail.samples[0].y, 4);
});

test('history is bounded and reset leaves no fabricated trail', () => {
  const trail = new FlightTrail(4, 3);
  for(let x=0;x<10;x++) trail.record(x, {x:0,y:0,z:0});
  assert.equal(trail.samples.length, 4);
  assert.equal(trail.samples[0].forwardDistance, 6);
  trail.record(15, {x:0,y:4,z:0});
  assert.equal(trail.samples.length, 1);
  trail.clear();
  assert.equal(trail.writeBuffers(0, new Float32Array(12), new Float32Array(12)), 0);
});

test('a local body orbit continues recording while forward progress is stopped',()=>{
 const trail=new FlightTrail();
 trail.record(5,{x:1,y:4,z:0});
 trail.record(5,{x:2,y:3,z:1});
 assert.equal(trail.samples.length,2);
 assert.deepEqual(trail.samples.map(p=>[p.x,p.y,p.z]),[[6,4,0],[7,3,1]]);
});

test('old and new trail samples keep the same brightness',()=>{
 const trail=new FlightTrail();
 trail.record(0,{x:0,y:0,z:0});trail.record(60,{x:0,y:0,z:0});
 const colors=new Float32Array(6);
 trail.writeBuffers(60,new Float32Array(6),colors);
 assert.deepEqual([...colors.slice(0,3)],[...colors.slice(3)]);
 assert.ok(colors[0]>.7);
});


test('default history retains the whole session beyond the old length and sample limits',()=>{
 const trail=new FlightTrail();
 for(let i=0;i<10000;i++)trail.record(i,{x:0,y:Math.sin(i),z:0});
 assert.equal(trail.samples.length,10000);
 assert.equal(trail.samples[0].x,0);
 assert.equal(trail.samples.at(-1).x,9999);
});
