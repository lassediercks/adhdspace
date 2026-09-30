import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OrbitalGravity, gravitationalAcceleration } from '../src/orbital-gravity.js';
const magnitude = v => Math.hypot(v.x,v.y,v.z);
const origin={x:0,y:0,z:0};
const body={...origin,radius:1,mass:1};

test('gravity obeys inverse-square distance and linear mass outside a body',()=>{
 const near=gravitationalAcceleration({x:10,y:0,z:0},[body],1);
 const far=gravitationalAcceleration({x:20,y:0,z:0},[body],1);
 assert.ok(near.x<0);
 assert.ok(Math.abs(near.x/far.x-4)<1e-12);
 const heavy=gravitationalAcceleration({x:10,y:0,z:0},[{...body,mass:2}],1);
 assert.ok(Math.abs(heavy.x/near.x-2)<1e-12);
 assert.equal(magnitude(gravitationalAcceleration({x:10,y:0,z:0},[body],0)),0);
});

test('unforced flight conserves momentum without damping or position correction',()=>{
 const physics=new OrbitalGravity();
 physics.reset({x:0,y:2,z:3},{x:4,y:5,z:6});
 for(let i=0;i<600;i++) physics.advance(1/60,origin,[],0);
 assert.deepEqual(physics.velocity,{x:4,y:5,z:6});
 for(const [axis,expected] of Object.entries({x:40,y:52,z:63})) assert.ok(Math.abs(physics.position[axis]-expected)<1e-8);
});

test('a static-body orbit conserves energy and angular momentum',()=>{
 const physics=new OrbitalGravity();
 const mu=140/(1-.85);
 const speed=Math.sqrt(mu/10);
 physics.reset({x:10,y:0,z:0},{x:0,y:speed,z:0});
 const initialEnergy=-mu/20, initialMomentum=10*speed;
 for(let i=0;i<6000;i++) physics.advance(1/240,origin,[body],1);
 const p=physics.position,v=physics.velocity;
 const energy=magnitude(v)**2/2-mu/magnitude(p);
 const momentum=p.x*v.y-p.y*v.x;
 assert.ok(Math.abs((energy-initialEnergy)/initialEnergy)<1e-6);
 assert.ok(Math.abs((momentum-initialMomentum)/initialMomentum)<1e-9);
});

test('changing gravity changes acceleration without teleporting; pausing freezes the state',()=>{
 const physics=new OrbitalGravity();
 physics.reset({x:10,y:0,z:0},{x:0,y:0,z:0});
 physics.advance(1/240,origin,[body],1);
 assert.ok(physics.position.x<10&&physics.position.x>9.99);
 const position={...physics.position},velocity={...physics.velocity};
 physics.advance(0,origin,[body],0);
 assert.deepEqual(physics.position,position);
 assert.deepEqual(physics.velocity,velocity);
 physics.reset();
 assert.equal(physics.position,null);
 assert.equal(magnitude(physics.offset),0);
});

test('fixed-size substeps agree across render frame rates',()=>{
 const a=new OrbitalGravity(),b=new OrbitalGravity();
 for(const p of [a,b])p.reset({x:10,y:0,z:0},{x:0,y:9,z:0});
 for(let i=0;i<120;i++)a.advance(1/60,origin,[body],1);
 for(let i=0;i<40;i++)b.advance(1/20,origin,[body],1);
 for(const axis of ['x','y','z'])assert.ok(Math.abs(a.position[axis]-b.position[axis])<1e-9);
});

test('the uniform sphere interior has a finite field at its center',()=>{
 assert.equal(magnitude(gravitationalAcceleration(origin,[body],1)),0);
 assert.ok(Number.isFinite(magnitude(gravitationalAcceleration({x:.001,y:0,z:0},[body],1))));
});
