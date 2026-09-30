import { sceneryDistance, JOURNEY_SPEED, SCENERY_SPEED } from './flight-frame.js';
import { scheduledBeamCount } from './beam-schedule.js';
import { beamCenter, routeThroughBeams } from './flight-route.js';

export const BEAM_REVEAL_SECONDS=4;
export const BRANCH_LOOKAHEAD=240;
export const BEAM_FADE_START=40;
export const BEAM_FADE_END=80;

function randomBeam(seed,index) {
 let value=(seed^Math.imul(index+1,0x9e3779b1))>>>0;
 return ()=>{
  value=(value+0x6D2B79F5)>>>0;
  let t=Math.imul(value^(value>>>15),value|1);t^=t+Math.imul(t^(t>>>7),t|61);
  return ((t^(t>>>14))>>>0)/4294967296;
 };
}
export class BeamNetwork {
 constructor(seed=31) {
  this.seed=seed;this.beams=[{slopeY:0,slopeZ:0,bornDistance:0,divergent:false}];
  this.selected=0;this.choiceNeeded=false;this.weave=0;this.distance=0;this.seconds=0;
 }
 restore(snapshot) {Object.assign(this,snapshot);this.beams=snapshot.beams.map(beam=>({...beam}));}
 advance(seconds,distance,dt) {
  this.distance=distance;this.seconds=seconds;
  const count=scheduledBeamCount(seconds);
  while(this.beams.length<count) {
   const random=randomBeam(this.seed,this.beams.length),divergent=random()<.5;
   const slope=divergent?Math.tan((2+random()*3)*Math.PI/180):0,angle=random()*Math.PI*2;
   const parent=this.selected??0,parentBeam=this.beams[parent];
   this.beams.push({
    slopeY:(divergent?parentBeam.slopeY:0)+Math.cos(angle)*slope,
    slopeZ:(divergent?parentBeam.slopeZ:0)+Math.sin(angle)*slope,
    bornDistance:distance,bornSeconds:seconds,divergent,parent,
    forkDistance:divergent?distance+BRANCH_LOOKAHEAD*JOURNEY_SPEED/SCENERY_SPEED:null,
   });
   if(divergent)this.choiceNeeded=true;
  }
  this.beams.forEach((beam,index)=>{
   if(this.opacity(index,distance)===0)beam.retired=true;
  });
  if(!this.beams.some((beam,index)=>beam.divergent&&index!==this.selected&&this.opacity(index,distance)>0))this.choiceNeeded=false;
  const target=this.selected===null?1:0;
  this.weave+=(target-this.weave)*(1-Math.exp(-dt*.3));
 }
 rescueToPrimary() {
  // Rescue can reacquire the original route even after it left normal view.
  this.beams[0].retired=false;this.selected=0;this.choiceNeeded=false;
 }
 choose(index) {
  if(!Number.isInteger(index)||index<0||index>=this.beams.length||this.opacity(index,this.distance)<=.05)return false;
  this.selected=index;this.choiceNeeded=false;return true;
 }
 centerAt(index,distance,render=false) {
  const beam=this.beams[index];
  if(beam.forkDistance!=null){
   if(!render&&distance<beam.forkDistance)return this.centerAt(beam.parent,distance,false);
   const root=this.centerAt(beam.parent,beam.forkDistance,true),travel=sceneryDistance(distance-beam.forkDistance);
   return {y:root.y+beam.slopeY*travel,z:root.z+beam.slopeZ*travel};
  }
  const center=beamCenter(index,this.beams.length),travel=Math.max(0,distance-beam.bornDistance);
  return {y:center.y+beam.slopeY*travel,z:center.z+beam.slopeZ*travel};
 }
 centers(distance) {return this.beams.map((_,index)=>this.centerAt(index,distance));}
 renderCenters(distance) {return this.beams.map((_,index)=>this.centerAt(index,distance,true));}
 reveal(index,seconds=this.seconds) {
  if(index===0)return 1;
  const t=Math.max(0,Math.min(1,(seconds-(this.beams[index].bornSeconds??seconds-BEAM_REVEAL_SECONDS))/BEAM_REVEAL_SECONDS));
  return t*t*t*(10+t*(-15+6*t));
 }
 extent(index,distance=this.distance,seconds=this.seconds) {
  if(index===0)return {start:-10000,end:10000};
  const beam=this.beams[index],axis=this.direction(index);
  const start=beam.forkDistance!=null?sceneryDistance(beam.forkDistance-distance)/axis.x:-10000*this.reveal(index,seconds);
  return {start,end:start+20000*this.reveal(index,seconds)};
 }
 supplyCenter(position,distance) {
  const centers=this.centers(distance);
  if(this.selected!==null)return centers[this.selected];
  return centers.reduce((best,center,index)=>this.opacity(index,distance)>0
    &&Math.hypot(center.y-position.y,center.z-position.z)<Math.hypot(best.y-position.y,best.z-position.z)?center:best,centers[0]);
 }
 direction(index) {
  const beam=this.beams[index],length=Math.hypot(1,beam.slopeY,beam.slopeZ);
  return {x:1/length,y:beam.slopeY/length,z:beam.slopeZ/length};
 }
 opacity(index,distance=this.distance) {
  const beam=this.beams[index];
  if(!beam||beam.retired)return 0;
  if(index===(this.selected??0))return 1;
  // Only distance accumulated by relative divergence counts, not polygon spacing.
  const center=this.centerAt(index,distance),origin=this.centerAt(this.selected??0,distance);
  const base=beamCenter(index,this.beams.length),anchorBase=beamCenter(this.selected??0,this.beams.length);
  const separation=Math.hypot(center.y-base.y-origin.y+anchorBase.y,center.z-base.z-origin.z+anchorBase.z);
  const t=Math.max(0,Math.min(1,(separation-BEAM_FADE_START)/(BEAM_FADE_END-BEAM_FADE_START)));
  return 1-t*t*t*(t*(t*6-15)+10);
 }
 routeCenters(distance) {
  const centers=this.centers(distance),anchor=centers[this.selected??0];
  // Ease abandoned route targets home as their light fades; never steer toward
  // an invisible branch. Keep slot identities stable during the transition.
  return centers.map((center,index)=>{
   const weight=this.opacity(index,distance);
   return {y:anchor.y+(center.y-anchor.y)*weight,z:anchor.z+(center.z-anchor.z)*weight};
  });
 }
 exposure(distance) {
  const spread=Math.max(...this.beams.map((beam,index)=>Math.hypot(beam.slopeY,beam.slopeZ)*Math.max(0,distance-beam.bornDistance)*this.opacity(index,distance)));
  return 1+spread/12*this.weave;
 }
}

// Include beam drift in target velocity and acceleration, so steering remains
// smooth as the ship advances along an angled beam. No live state is mutated.
export function networkFlightRoute(phase,radius,dual,network,distance,forwardSpeed) {
 const sample=offset=>{
  const centers=network.routeCenters(distance+forwardSpeed*offset),orientation=network.centers(distance+forwardSpeed*offset);
  const count=Math.min(centers.length,Math.max(1,dual+1)),low=Math.floor(count),high=Math.ceil(count),blend=count-low;
  const a=routeThroughBeams(phase+.45*offset,radius,centers.slice(0,low),orientation.slice(0,low));
  const b=routeThroughBeams(phase+.45*offset,radius,centers.slice(0,high),orientation.slice(0,high));
  const y=a.y+(b.y-a.y)*blend,z=a.z+(b.z-a.z)*blend;
  if(network.selected===null)return {x:0,y,z};
  const chosen=routeThroughBeams(phase+.45*offset,radius,[centers[network.selected]]);
  return {x:0,y:chosen.y+(y-chosen.y)*network.weave,z:chosen.z+(z-chosen.z)*network.weave};
 };
 const h=.005,position=sample(0),before=sample(-h),after=sample(h);
 return {...position,velocity:{x:0,y:(after.y-before.y)/(2*h),z:(after.z-before.z)/(2*h)},
  acceleration:{x:0,y:(after.y-2*position.y+before.y)/(h*h),z:(after.z-2*position.z+before.z)/(h*h)}};
}
