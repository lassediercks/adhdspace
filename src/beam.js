import * as THREE from 'three';

// Query the actual transformed rock silhouettes, not their physics spheres.
// Rays across the beam's width also account for grazing contact with its rim.
export function blockedBeamIntervals(meshes, beamRadius = .14, center = {y:0,z:0}, direction = {x:1,y:0,z:0}) {
  const forward = new THREE.Raycaster();
  const backward = new THREE.Raycaster();
  const origin=new THREE.Vector3(center.x??0,center.y,center.z);
  const axis=new THREE.Vector3(direction.x,direction.y,direction.z).normalize();
  const reverse=axis.clone().negate();
  const rotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1,0,0),axis);
  const sphere = new THREE.Sphere();
  const offsets = [[0,0]];
  for(let i=0;i<12;i++) offsets.push([Math.cos(i*Math.PI/6)*beamRadius,Math.sin(i*Math.PI/6)*beamRadius]);
  const intervals = [];
  for(const mesh of meshes) {
    mesh.updateWorldMatrix(true,false);
    if(!mesh.geometry.boundingSphere)mesh.geometry.computeBoundingSphere();
    sphere.copy(mesh.geometry.boundingSphere).applyMatrix4(mesh.matrixWorld);
    const relative=sphere.center.clone().sub(origin),along=relative.dot(axis);
    if(relative.clone().addScaledVector(axis,-along).length()>sphere.radius+beamRadius)continue;
    let entry=Infinity,exit=-Infinity;
    for(const [y,z] of offsets) {
      const offset=new THREE.Vector3(0,y,z).applyQuaternion(rotation).add(origin);
      forward.set(offset.clone().addScaledVector(axis,along-sphere.radius-1),axis);
      backward.set(offset.clone().addScaledVector(axis,along+sphere.radius+1),reverse);
      // Opposite rays find both ends with either front- or back-facing materials.
      for(const hit of [...forward.intersectObject(mesh,false),...backward.intersectObject(mesh,false)]) {
        entry=Math.min(entry,hit.point.clone().sub(origin).dot(axis));
        exit=Math.max(exit,hit.point.clone().sub(origin).dot(axis));
      }
    }
    if(Number.isFinite(entry)&&Number.isFinite(exit))intervals.push([entry,exit]);
  }
  return intervals;
}

export function visibleBeamIntervals(blocked, start=-10000, end=10000, gap=.025) {
  const sorted=blocked.map(([a,b])=>[Math.max(start,a-gap),Math.min(end,b+gap)])
    .filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0]);
  const segments=[];
  let cursor=start;
  for(const [a,b] of sorted) {
    if(a>cursor)segments.push([cursor,a]);
    cursor=Math.max(cursor,b);
  }
  if(cursor<end)segments.push([cursor,end]);
  return segments;
}

export class OccludedBeam {
  constructor(scene, capacity) {
    const geometry=new THREE.CylinderGeometry(1,1,1,6,1,false);
    geometry.rotateZ(Math.PI/2);
    this.core=new THREE.InstancedMesh(geometry,new THREE.MeshBasicMaterial({color:0xafffe4,transparent:true,depthWrite:false}),capacity);
    this.rim=new THREE.InstancedMesh(geometry,new THREE.MeshBasicMaterial({color:0x41bdac,transparent:true,opacity:.18,depthWrite:false}),capacity);
    this.pick=new THREE.InstancedMesh(geometry,new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false,depthTest:false}),capacity);
    this.core.frustumCulled=this.rim.frustumCulled=this.pick.frustumCulled=false;
    this.core.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rim.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.matrix=new THREE.Matrix4();
    scene.add(this.core,this.rim,this.pick);
  }

  update(meshes, center = {y:0,z:0}, direction = {x:1,y:0,z:0}) {
    const intervals=this.intervals=visibleBeamIntervals(blockedBeamIntervals(meshes,.14,center,direction));
    this.core.count=this.rim.count=this.pick.count=intervals.length;
    const axis=new THREE.Vector3(direction.x,direction.y,direction.z).normalize();
    const rotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1,0,0),axis);
    const origin=new THREE.Vector3(center.x??0,center.y,center.z);
    intervals.forEach(([start,end],i)=>{
      for(const [mesh,radius] of [[this.core,.055],[this.rim,.14],[this.pick,.45]]) {
        this.matrix.compose(origin.clone().addScaledVector(axis,(start+end)/2),rotation,new THREE.Vector3(end-start,radius,radius));
        mesh.setMatrixAt(i,this.matrix);
      }
    });
    this.core.instanceMatrix.needsUpdate=this.rim.instanceMatrix.needsUpdate=this.pick.instanceMatrix.needsUpdate=true;
    this.pick.boundingSphere=null;
  }
}
