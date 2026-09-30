import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FlightScore,beamScoreRate,MAX_SCORE_RATE,SCORE_RANGE } from '../src/flight-score.js';

const beam={center:{y:0,z:0},direction:{x:1,y:0,z:0},intervals:[[-10000,10000]],opacity:1};
const origin={x:0,y:0,z:0};
test('being on a beam earns most; rewards decrease smoothly to zero with distance',()=>{
 assert.equal(beamScoreRate(origin,[beam]),MAX_SCORE_RATE);
 let previous=MAX_SCORE_RATE;
 for(let y=.1;y<=SCORE_RANGE;y+=.1){
  const rate=beamScoreRate({x:0,y,z:0},[beam]);
  assert.ok(rate<previous);previous=rate;
 }
 assert.equal(beamScoreRate({x:0,y:20,z:0},[beam]),0);
 assert.equal(beamScoreRate(origin,[]),0);
});
test('scoring uses true angled light segments, excludes vanished beams and never stacks rewards',()=>{
 const direction={x:Math.SQRT1_2,y:Math.SQRT1_2,z:0};
 const angled={...beam,direction,center:{y:10,z:4}};
 assert.equal(beamScoreRate({x:20,y:30,z:4},[angled]),MAX_SCORE_RATE);
 assert.equal(beamScoreRate(origin,[beam,beam]),MAX_SCORE_RATE);
 assert.equal(beamScoreRate(origin,[{...beam,opacity:0}]),0);
 assert.equal(beamScoreRate(origin,[{...beam,opacity:.5}]),MAX_SCORE_RATE/2);
 assert.equal(beamScoreRate(origin,[{...beam,intervals:[[-100,-20],[20,100]]}]),0);
});
test('points accumulate per real second independent of frame rate and are retained off beam',()=>{
 const slow=new FlightScore(),fast=new FlightScore();
 for(let i=0;i<300;i++)slow.advance(1/30,origin,[beam]);
 for(let i=0;i<1440;i++)fast.advance(1/144,origin,[beam]);
 assert.ok(Math.abs(slow.total-100)<1e-9);assert.ok(Math.abs(slow.total-fast.total)<1e-9);
 const before=slow.total;
 slow.advance(60,{x:0,y:30,z:0},[beam]);assert.equal(slow.total,before);assert.equal(slow.rate,0);
 slow.advance(0,origin,[beam]);assert.equal(slow.total,before);
});
