import { bodyClearance, gravitationalAcceleration } from './orbital-gravity.js';

// Keep encounter time separate from forward journey progress. Captured flybys
// become a local body frame, so scenery does not carry the body away.
export class Journey {
  constructor() { this.reset(); }
  reset() { this.rate=1; this.distance=0; this.orbit=null; }

  advance(dt, position, velocity, asteroids, instability, radius) {
    if(dt<=0)return 0;
    if(this.orbit && instability<.35)this.orbit=null;
    if(!this.orbit && instability>.7) {
      let candidate=null, nearest=Infinity;
      for(const body of asteroids) {
        const relative={x:position.x-body.x,y:position.y-body.y,z:position.z-body.z};
        const distance=Math.hypot(relative.x,relative.y,relative.z);
        if(distance>bodyClearance(body,radius)+9)continue;
        const v={x:velocity.x-(body.vx??0),y:velocity.y,z:velocity.z};
        const acceleration=gravitationalAcceleration(position,[body],instability);
        const mu=Math.hypot(acceleration.x,acceleration.y,acceleration.z)*distance*distance;
        const energy=(v.x*v.x+v.y*v.y+v.z*v.z)/2-mu/distance;
        if(energy>=0 || distance>=nearest)continue;
        let normal={x:relative.y*v.z-relative.z*v.y,y:relative.z*v.x-relative.x*v.z,z:relative.x*v.y-relative.y*v.x};
        const magnitude=Math.hypot(normal.x,normal.y,normal.z);
        if(magnitude<.01)normal={x:1,y:0,z:0};
        else for(const axis of ['x','y','z'])normal[axis]/=magnitude;
        candidate={id:body.id,normal};nearest=distance;
      }
      if(candidate)this.orbit=candidate;
    }
    const target=this.orbit?0:1;
    this.rate+=(target-this.rate)*(1-Math.exp(-dt*2));
    if(Math.abs(this.rate-target)<.001)this.rate=target;
    const travel=dt*this.rate;
    this.distance+=travel*2.8;
    return travel;
  }
}
