import { gravitationalAcceleration, bodyClearance } from './orbital-gravity.js';

import { derailmentRisk } from './flight-controls.js';

export const REFUEL_SECONDS=10;
export const REFUEL_MIN_RADIUS=7*.95;
export const STATION_DOCKING_MARGIN=22;
export const stationKey=body=>`${body.id}:${body.generation??0}`;
export const activeBodies=(bodies,navigation)=>bodies.filter(body=>!navigation?.consumedStations?.includes(stationKey(body)));
export const RESCUE_FUEL=8;
export const RESCUE_COOLDOWN=30;
// Fuel is charged in simulation seconds; the game runs at 1.5× real time.
// A full tank at maximum engine power therefore lasts 30 real seconds.
export const fuelBurnRate=radius=>.02+(100/45-.02)*(1-Math.max(0,Math.min(1,radius/7)))**2;

// Seeded accumulated encounter risk is frame-rate independent and forecastable.
// Losing lock disables return guidance until rescue or a completed station service.
export class Navigation {
  constructor(seed=31) { this.seed=seed>>>0;this.reset(); }
  reset() {
    this.mode='tracking';this.lock=1;this.hazard=0;this.immunity=0;
    this.refuelElapsed=0;this.refuelStartFuel=0;this.refuelKey=null;this.consumedStations=[];
    this.exposure=1;this.fuel=100;this.cooldown=0;this.refueling=false;this.stationId=null;
    let value=(this.seed^0x9e3779b9)>>>0;
    value=Math.imul(value^(value>>>16),0x21f0aaad);
    value=Math.imul(value^(value>>>15),0x735a2d97);value^=value>>>15;
    this.threshold=-Math.log(((value>>>0)+1)/4294967297);
  }
  restore(snapshot) { if(snapshot){Object.assign(this,snapshot);this.consumedStations=[...(snapshot.consumedStations??[])];} }
  rescue() {
    if(this.mode!=='derailed'||this.fuel<RESCUE_FUEL||this.cooldown>0)return false;
    this.fuel-=RESCUE_FUEL;this.cooldown=RESCUE_COOLDOWN;this.mode='rescuing';this.stationId=null;this.refueling=false;this.refuelKey=null;this.refuelElapsed=0;this.hazard=0;return true;
  }
  advance(dt,position,velocity,bodies,instability,radius,realSeconds=dt) {
    if(dt<=0)return;
    const arrivedFull=this.fuel>=99.5&&!this.refueling;
    const enginesOff=radius>=REFUEL_MIN_RADIUS;
    if(!enginesOff&&this.stationId!==null){
      this.stationId=null;this.refuelKey=null;this.refuelElapsed=0;this.refueling=false;
      this.mode='tracking';this.hazard=0;this.immunity=12;
    }
    this.cooldown=Math.max(0,this.cooldown-realSeconds);
    this.fuel=Math.max(0,this.fuel-dt*fuelBurnRate(radius));
    if(this.fuel===0&&this.mode==='tracking')this.mode='derailed';
    this.refueling=false;
    const stations=bodies.filter(body=>body.kind==='station'&&!this.consumedStations.includes(stationKey(body)))
      .map(body=>({body,distance:Math.hypot(position.x-body.x,position.y-body.y,position.z-body.z)}))
      .filter(({body,distance})=>distance<bodyClearance(body,radius)+STATION_DOCKING_MARGIN+(stationKey(body)===this.refuelKey?5:0))
      .sort((a,b)=>Number(stationKey(b.body)===this.refuelKey)-Number(stationKey(a.body)===this.refuelKey)||a.distance-b.distance);
    if(arrivedFull){
      for(const {body} of stations)this.consumedStations.push(stationKey(body));
      this.stationId=null;this.refuelKey=null;this.refuelElapsed=0;
    }
    for(const {body,distance} of stations) {
      if(!enginesOff||body.kind!=='station'||this.consumedStations.includes(stationKey(body)))continue;
      const reach=bodyClearance(body,radius)+STATION_DOCKING_MARGIN+(stationKey(body)===this.refuelKey?5:0);
      // Low coherence is the pilot's deliberate opt-in to leave a beam here.
      if(this.mode==='tracking'&&this.immunity===0&&enginesOff&&distance<reach) {
        this.mode='derailed';this.stationId=body.id;
      }
      if(this.mode==='derailed'&&distance<reach) {
        this.stationId=body.id;this.refueling=true;
        const key=stationKey(body);
        if(this.refuelKey!==key){this.refuelKey=key;this.refuelElapsed=0;this.refuelStartFuel=this.fuel;}
        this.refuelElapsed=Math.min(REFUEL_SECONDS,this.refuelElapsed+realSeconds);
        this.fuel=this.refuelStartFuel+(100-this.refuelStartFuel)*this.refuelElapsed/REFUEL_SECONDS;
        if(this.refuelElapsed>=REFUEL_SECONDS-1e-9){
          this.fuel=100;this.consumedStations.push(key);this.stationId=null;this.refueling=false;
          // A serviced ship can steer again. Keep momentum and ease lock back
          // in below; stale encounter risk must not immediately derail departure.
          this.mode='tracking';this.hazard=0;this.immunity=12;
          // Any other station in immediate docking range is unnecessary now.
          for(const {body:nearby} of stations){
            const nearbyKey=stationKey(nearby);
            if(!this.consumedStations.includes(nearbyKey))this.consumedStations.push(nearbyKey);
          }
        }
        break;
      }
    }
    if(!this.refueling){this.stationId=null;this.refuelKey=null;this.refuelElapsed=0;}
    this.immunity=Math.max(0,this.immunity-dt);
    if(this.mode==='tracking'&&this.immunity===0) {
      const g=gravitationalAcceleration(position,activeBodies(bodies,this),instability);
      const pressure=Math.hypot(g.x,g.y,g.z);
      this.hazard+=dt*.35*derailmentRisk(instability,radius)*this.exposure*pressure/(pressure+3);
      if(this.hazard>=this.threshold)this.mode='derailed';
    }
    if(this.mode==='rescuing'&&Math.hypot(position.x,position.y,position.z)<.6&&Math.hypot(velocity.x,velocity.y,velocity.z)<.8) {
      this.mode='tracking';this.immunity=12;this.hazard=0;
    }
    this.lock+=(Number(this.mode==='tracking')-this.lock)*(1-Math.exp(-dt*.8));
  }
}
