import { JOURNEY_SPEED } from './flight-frame.js';
import { activeBodies, STATION_DOCKING_MARGIN } from './navigation.js';
import { bodyClearance, gravitationalAcceleration } from './orbital-gravity.js';

// Keep encounter time separate from forward journey progress. Captured flybys
// become a local body frame, so scenery does not carry the body away.
export class Journey {
  constructor() { this.reset(); }
  reset() { this.rate=1; this.distance=0; this.orbit=null; }

  advance(dt, position, velocity, asteroids, instability, radius, navigation = null) {
    if(dt<=0)return 0;
    asteroids=activeBodies(asteroids,navigation);
    if(navigation&&this.orbit&&asteroids.some(body=>body.id===this.orbit.id&&body.kind==='station')&&navigation.stationId!==this.orbit.id)this.orbit=null;
    if(navigation?.stationId!=null&&this.orbit?.id!==navigation.stationId)this.orbit=null;
    if(this.orbit&&!asteroids.some(body=>body.id===this.orbit.id))this.orbit=null;
    if(this.orbit && (navigation?navigation.mode==='rescuing':instability<.35))this.orbit=null;
    if(!this.orbit && (instability>.7||navigation?.stationId!=null) && (!navigation||navigation.mode==='derailed')) {
      let candidate=null, nearest=Infinity;
      for(const body of asteroids) {
        if(navigation&&body.kind==='station'&&navigation.stationId!==body.id)continue;
        if(navigation&&this.orbit&&asteroids.some(body=>body.id===this.orbit.id&&body.kind==='station')&&navigation.stationId!==this.orbit.id)this.orbit=null;
    if(navigation?.stationId!=null&&body.id!==navigation.stationId)continue;
        const relative={x:position.x-body.x,y:position.y-body.y,z:position.z-body.z};
        const distance=Math.hypot(relative.x,relative.y,relative.z);
        const station=body.kind==='station'&&navigation?.stationId===body.id;
        if(distance>bodyClearance(body,radius)+(station?STATION_DOCKING_MARGIN+1:9))continue;
        const v={x:velocity.x-(body.vx??0),y:velocity.y,z:velocity.z};
        const acceleration=gravitationalAcceleration(position,[body],instability);
        const mu=Math.hypot(acceleration.x,acceleration.y,acceleration.z)*distance*distance;
        const energy=(v.x*v.x+v.y*v.y+v.z*v.z)/2-mu/distance;
        if((energy>=0&&!station) || distance>=nearest)continue;
        let normal={x:relative.y*v.z-relative.z*v.y,y:relative.z*v.x-relative.x*v.z,z:relative.x*v.y-relative.y*v.x};
        const magnitude=Math.hypot(normal.x,normal.y,normal.z);
        if(magnitude<.01) {
          // A head-on encounter still needs an orbit plane perpendicular to
          // the radius; an X normal would otherwise leave zero tangent.
          const reference=Math.abs(relative.x)<Math.abs(relative.y)?{x:1,y:0,z:0}:{x:0,y:1,z:0};
          normal={x:relative.y*reference.z-relative.z*reference.y,y:relative.z*reference.x-relative.x*reference.z,z:relative.x*reference.y-relative.y*reference.x};
          const size=Math.hypot(normal.x,normal.y,normal.z);
          if(size>1e-9)for(const axis of ['x','y','z'])normal[axis]/=size;
          else normal={x:0,y:0,z:1};
        }
        else for(const axis of ['x','y','z'])normal[axis]/=magnitude;
        candidate={id:body.id,normal};nearest=distance;
      }
      if(candidate)this.orbit=candidate;
    }
    const target=this.orbit?0:1;
    this.rate+=(target-this.rate)*(1-Math.exp(-dt*2));
    if(Math.abs(this.rate-target)<.001)this.rate=target;
    const travel=dt*this.rate;
    this.distance+=travel*JOURNEY_SPEED;
    return travel;
  }
}
