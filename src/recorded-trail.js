import * as THREE from 'three';

// Append-only GPU chunks keep long sessions from rewriting the entire history.
export class RecordedTrail {
  constructor(parent, capacity=2048) {
    this.capacity=capacity;
    this.group=new THREE.Group();parent.add(this.group);
    this.material=new THREE.LineBasicMaterial({color:0xd5b88a,fog:false});
    this.count=0;this.active=null;
  }
  clear() {
    for(const line of [...this.group.children]) {
      line.geometry.dispose();this.group.remove(line);
    }
    this.count=0;this.active=null;
  }
  append(point) {
    if(!this.active||this.active.used===this.capacity) {
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(this.capacity*3),3).setUsage(THREE.DynamicDrawUsage));
      geometry.setDrawRange(0,0);
      const line=new THREE.Line(geometry,this.material);
      line.position.x=point.x;line.frustumCulled=false;this.group.add(line);
      this.active={line,used:0,origin:point.x};
    }
    const chunk=this.active,attribute=chunk.line.geometry.attributes.position;
    attribute.setXYZ(chunk.used,point.x-chunk.origin,point.y,point.z);
    attribute.addUpdateRange(chunk.used*3,3);attribute.needsUpdate=true;
    chunk.line.geometry.setDrawRange(0,++chunk.used);
  }
  update(samples,forwardDistance) {
    if(samples.length<this.count)this.clear();
    for(let i=this.count;i<samples.length;i++) {
      if(this.active?.used===this.capacity) {
        this.active=null;this.append(samples[i-1]);
      }
      this.append(samples[i]);
    }
    this.count=samples.length;
    this.group.position.x=-forwardDistance;
  }
}
