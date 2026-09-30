import { Quaternion,Vector3 } from 'three';
export const MAX_ANGULAR_SPEED=1.2;
export const MAX_ANGULAR_ACCELERATION=2.4;

// Rotational inertia: heading has angular momentum rather than snapping to the
// velocity direction. Maneuvering thrusters can steer while the hull turns.
export class ShipAttitude {
 constructor(){
  this.angularVelocity=new Vector3();
  this.error=new Quaternion();this.rotation=new Quaternion();
  this.axis=new Vector3();this.desired=new Vector3();this.change=new Vector3();
 }
 advance(current,target,seconds){
  if(seconds<=0)return;
  const steps=Math.ceil(seconds/(1/120)),dt=seconds/steps;
  for(let i=0;i<steps;i++){
   this.error.copy(current).invert().premultiply(target).normalize();
   if(this.error.w<0)this.error.set(-this.error.x,-this.error.y,-this.error.z,-this.error.w);
   const angle=2*Math.acos(Math.min(1,Math.max(-1,this.error.w)));
   this.axis.set(this.error.x,this.error.y,this.error.z).normalize();
   const speed=Math.min(MAX_ANGULAR_SPEED,angle*3,Math.sqrt(2*MAX_ANGULAR_ACCELERATION*angle));
   this.desired.copy(this.axis).multiplyScalar(speed);
   this.change.copy(this.desired).sub(this.angularVelocity).clampLength(0,MAX_ANGULAR_ACCELERATION*dt);
   this.angularVelocity.add(this.change);
   const actualSpeed=this.angularVelocity.length();
   if(actualSpeed>1e-10){
    this.axis.copy(this.angularVelocity).multiplyScalar(1/actualSpeed);
    this.rotation.setFromAxisAngle(this.axis,actualSpeed*dt);
    current.premultiply(this.rotation).normalize();
   }
  }
 }
}
