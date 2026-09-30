import { gravitationalAcceleration, bodyClearance } from './orbital-gravity.js';

import { derailmentRisk } from './flight-controls.js';

export const RESCUE_FUEL=8;
export const fuelBurnRate=radius=>.02+.38*(1-Math.max(0,Math.min(1,radius/7)))**2;

// Seeded accumulated encounter risk is frame-rate independent and forecastable.
// Losing lock disables return guidance until the pilot explicitly requests rescue.
export class Navigation {
  constructor(seed=31) { this.seed=seed>>>0;this.reset(); }
  reset() {
    this.mode='tracking';this.lock=1;this.hazard=0;this.immunity=0;
    this.fuel=100;this.refueling=false;this.stationId=null;
    let value=(this.seed^0x9e3779b9)>>>0;
    value=Math.imul(value^(value>>>16),0x21f0aaad);
    value=Math.imul(value^(value>>>15),0x735a2d97);value^=value>>>15;
    this.threshold=-Math.log(((value>>>0)+1)/4294967297);
  }
  restore(snapshot) { if(snapshot)Object.assign(this,snapshot); }
  rescue() {
    if(this.mode!=='derailed'||this.fuel<RESCUE_FUEL)return false;
    this.fuel-=RESCUE_FUEL;this.mode='rescuing';this.stationId=null;this.refueling=false;this.hazard=0;return true;
  }
  advance(dt,position,velocity,bodies,instability,radius) {
    if(dt<=0)return;
    this.fuel=Math.max(0,this.fuel-dt*fuelBurnRate(radius));
    if(this.fuel===0&&this.mode==='tracking')this.mode='derailed';
    this.refueling=false;
    for(const body of bodies) {
      if(body.kind!=='station')continue;
      const distance=Math.hypot(position.x-body.x,position.y-body.y,position.z-body.z);
      const reach=bodyClearance(body,radius)+10;
      // Low coherence is the pilot's deliberate opt-in to leave a beam here.
      if(this.mode==='tracking'&&this.immunity===0&&radius>=4.2&&distance<reach) {
        this.mode='derailed';this.stationId=body.id;
      }
      if(this.mode==='derailed'&&distance<reach) {
        this.stationId=body.id;this.refueling=true;
        this.fuel=Math.min(100,this.fuel+dt*10);
      }
    }
    this.immunity=Math.max(0,this.immunity-dt);
    if(this.mode==='tracking'&&this.immunity===0) {
      const g=gravitationalAcceleration(position,bodies,instability);
      const pressure=Math.hypot(g.x,g.y,g.z);
      this.hazard+=dt*.35*derailmentRisk(instability,radius)*pressure/(pressure+3);
      if(this.hazard>=this.threshold)this.mode='derailed';
    }
    if(this.mode==='rescuing'&&Math.hypot(position.x,position.y,position.z)<.6&&Math.hypot(velocity.x,velocity.y,velocity.z)<.8) {
      this.mode='tracking';this.immunity=12;this.hazard=0;
    }
    this.lock+=(Number(this.mode==='tracking')-this.lock)*(1-Math.exp(-dt*.8));
  }
}
