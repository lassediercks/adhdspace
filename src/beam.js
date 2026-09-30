import * as THREE from 'three';

// Query the actual transformed rock silhouettes, not their physics spheres.
// Rays across the beam's width also account for grazing contact with its rim.
export function blockedBeamIntervals(meshes, beamRadius = .14, center = {y:0,z:0}) {
  const forward = new THREE.Raycaster();
  const backward = new THREE.Raycaster();
  const positiveX = new THREE.Vector3(1,0,0), negativeX = new THREE.Vector3(-1,0,0);
  const sphere = new THREE.Sphere();
  const offsets = [[0,0]];
  for(let i=0;i<12;i++) offsets.push([Math.cos(i*Math.PI/6)*beamRadius,Math.sin(i*Math.PI/6)*beamRadius]);
  const intervals = [];
  for(const mesh of meshes) {
    mesh.updateWorldMatrix(true,false);
    if(!mesh.geometry.boundingSphere)mesh.geometry.computeBoundingSphere();
    sphere.copy(mesh.geometry.boundingSphere).applyMatrix4(mesh.matrixWorld);
    if(Math.hypot(sphere.center.y-center.y,sphere.center.z-center.z)>sphere.radius+beamRadius)continue;
    let entry=Infinity,exit=-Infinity;
    for(const [y,z] of offsets) {
      forward.set(new THREE.Vector3(sphere.center.x-sphere.radius-1,y+center.y,z+center.z),positiveX);
      backward.set(new THREE.Vector3(sphere.center.x+sphere.radius+1,y+center.y,z+center.z),negativeX);
      // Opposite rays find both ends with either front- or back-facing materials.
      for(const hit of [...forward.intersectObject(mesh,false),...backward.intersectObject(mesh,false)]) {
        entry=Math.min(entry,hit.point.x);
        exit=Math.max(exit,hit.point.x);
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
    this.core=new THREE.InstancedMesh(geometry,new THREE.MeshBasicMaterial({color:0xafffe4}),capacity);
    this.rim=new THREE.InstancedMesh(geometry,new THREE.MeshBasicMaterial({color:0x41bdac,transparent:true,opacity:.18,depthWrite:false}),capacity);
    this.core.frustumCulled=this.rim.frustumCulled=false;
    this.core.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rim.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.matrix=new THREE.Matrix4();
    scene.add(this.core,this.rim);
  }

  update(meshes, center = {y:0,z:0}) {
    const intervals=visibleBeamIntervals(blockedBeamIntervals(meshes,.14,center));
    this.core.count=this.rim.count=intervals.length;
    intervals.forEach(([start,end],i)=>{
      for(const [mesh,radius] of [[this.core,.055],[this.rim,.14]]) {
        this.matrix.makeScale(end-start,radius,radius);
        this.matrix.setPosition((start+end)/2,center.y,center.z);
        mesh.setMatrixAt(i,this.matrix);
      }
    });
    this.core.instanceMatrix.needsUpdate=this.rim.instanceMatrix.needsUpdate=true;
  }
}
