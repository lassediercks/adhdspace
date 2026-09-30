import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OrbitalGravity, bodyClearance } from '../src/orbital-gravity.js';

function encounter(radius, dt = 1/60) {
  const gravity = new OrbitalGravity();
  const body = {x:40,y:4,z:0,radius:2.5,avoidanceRadius:5.125,mass:1.6,vx:-8};
  let minGap=Infinity, maxStep=0, previous=null, earlyDeviation=0;
  for(let time=0;time<12;time+=dt) {
    body.x=40-8*time;
    const nominal={x:0,y:radius*Math.cos(time*.45),z:radius*Math.sin(time*.45)};
    const offset=gravity.advance(dt,nominal,[body],1,radius);
    const position={x:offset.x,y:nominal.y+offset.y,z:nominal.z+offset.z};
    const gap=Math.hypot(position.x-body.x,position.y-body.y,position.z-body.z)-bodyClearance(body,radius);
    minGap=Math.min(minGap,gap);
    if(previous) maxStep=Math.max(maxStep,Math.hypot(position.x-previous.x,position.y-previous.y,position.z-previous.z));
    if(body.x>bodyClearance(body,radius)+3) earlyDeviation=Math.max(earlyDeviation,Math.hypot(offset.y,offset.z));
    previous=position;
  }
  return {minGap,maxStep,earlyDeviation};
}

test('with powered stabilizers, incoming obstacles are anticipated and passed outside their full bounds',()=>{
 for(const radius of [2,4,5.6]) {
  const result=encounter(radius);
  assert.ok(result.minGap>=-1e-5,JSON.stringify({radius,...result}));
  assert.ok(result.earlyDeviation>.3,'ship must steer before contact');
  assert.ok(result.maxStep<.6,'normal encounters must not teleport the ship');
 }
});

test('clearance follows orbit radius and remains safe at low frame rates',()=>{
 const body={radius:2,avoidanceRadius:4};
 assert.equal(bodyClearance(body,7)-bodyClearance(body,2),5);
 assert.ok(encounter(5.6,1/20).minGap>=-1e-5);
});

test('avoidance near a body is continuous and pausing freezes it',()=>{
 const physics=new OrbitalGravity();
 const nominal={x:0,y:4,z:0};
 const body={x:12,y:4,z:0,radius:2,mass:1,vx:-8};
 physics.reset(nominal,{x:0,y:0,z:1.8});
 physics.advance(1/240,nominal,[body],1,4);
 assert.ok(Math.hypot(physics.position.x,physics.position.y-4,physics.position.z)<.1);
 const frozen={...physics.position};
 physics.advance(0,nominal,[body],1,4);
 assert.deepEqual(physics.position,frozen);
});

test('guidance recovers gradually after a disturbance when gravity is lowered',()=>{
 const physics=new OrbitalGravity();
 physics.reset({x:0,y:12,z:0},{x:0,y:0,z:2});
 for(let i=1;i<=3600;i++) {
  const phase=i/60*.45;
  physics.advance(1/60,{x:0,y:4*Math.cos(phase),z:4*Math.sin(phase)},[],0,4);
 }
 assert.ok(Math.hypot(...Object.values(physics.offset))<.01);
});

test('zero gravitational pull still avoids incoming asteroids',()=>{
 const gravity=new OrbitalGravity();
 const body={x:10,y:4,z:0,radius:2,mass:1,vx:-8};
 const nominal={x:0,y:4,z:0};
 for(let i=0;i<180;i++) {
  body.x=10-i*8/60;
  const offset=gravity.advance(1/60,nominal,[body],0,4);
  assert.ok(Math.hypot(offset.x-body.x,nominal.y+offset.y-body.y,offset.z)>=bodyClearance(body,4)-1e-5);
 }
});
