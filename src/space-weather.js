// Live weather draws fresh cryptographic randomness; explicit seeds are for tests.
// A mean-reverting process has a bell-shaped distribution around 50%.
// Rare pulses hold either extreme; the actual field eases toward every target.
export const instabilityLevel=value=>value>.8?'high':value>.6?'elevated':'normal';

export class SpaceWeather {
 constructor(seed) { this.randomState=seed===undefined?null:seed>>>0;this.value=.5;this.target=.5;this.clock=0;this.pulseTime=0;this.pulseTarget=.5; }
 random() {
  if(this.randomState===null)return (crypto.getRandomValues(new Uint32Array(1))[0]+.5)/4294967296;
  this.randomState=(this.randomState+0x6D2B79F5)>>>0;
  let v=Math.imul(this.randomState^(this.randomState>>>15),1|this.randomState);
  v^=v+Math.imul(v^(v>>>7),61|v);
  return ((v^(v>>>14))>>>0)/4294967296;
 }
 restore(snapshot) { if(snapshot)Object.assign(this,snapshot); }
 advance(seconds) {
  // Fixed ticks keep the live process independent of rendering frame rate.
  this.clock+=seconds;
  while(this.clock>=.1-1e-10) {
   this.clock-=.1;
   if(this.pulseTime>0) {
    this.pulseTime=Math.max(0,this.pulseTime-.1);this.target=this.pulseTarget;
   } else if(this.random()<1-Math.exp(-.1/35)) {
    this.pulseTarget=this.random()<.5?0:1;this.pulseTime=9+this.random()*7;this.target=this.pulseTarget;
   } else {
    const normal=Math.sqrt(-2*Math.log(Math.max(this.random(),1e-10)))*Math.cos(2*Math.PI*this.random());
    const decay=Math.exp(-.1/10);
    this.target=Math.max(.05,Math.min(.95,.5+(this.target-.5)*decay+.16*Math.sqrt(1-decay*decay)*normal));
   }
   this.value+=(this.target-this.value)*(1-Math.exp(-.1*.7));
   if(this.pulseTime>0&&Math.abs(this.value-this.pulseTarget)<.002)this.value=this.pulseTarget;
  }
  return this.value;
 }
}
