import * as THREE from 'three';
import { FORECAST_SAMPLE_INTERVAL } from './trajectory-prediction.js';

export class PredictedPath {
  constructor(parent) {
    this.geometry=new THREE.BufferGeometry();
    this.line=new THREE.Line(this.geometry,new THREE.LineBasicMaterial({color:0xa3c9e5,vertexColors:true,transparent:true,opacity:.32,depthWrite:false}));
    this.line.frustumCulled=false;
    parent.add(this.line);
    this.startTime=0;
    this.anchorDistance=0;
    this.pointCount=0;
    this.version=0;
    this.busy=false;
    this.queued=null;
    this.worker=new Worker(new URL('./prediction-worker.js',import.meta.url),{type:'module'});
    this.worker.onmessage=({data})=>{
      if(data.version===this.version)this.apply(new Float32Array(data.positions),data.elapsed,data.distance);
      this.busy=false;
      if(this.queued){const next=this.queued;this.queued=null;this.send(next);}
    };
  }

  invalidate() { this.version++; }

  refresh(snapshot, elapsed) {
    const request={snapshot:structuredClone(snapshot),elapsed,version:this.version};
    if(this.busy)this.queued=request;
    else this.send(request);
  }

  send(request) {
    this.busy=true;
    this.worker.postMessage(request);
  }

  apply(positions, elapsed, distance) {
    if(this.pointCount!==positions.length/3) {
      this.pointCount=positions.length/3;
      const colors=new Float32Array(positions.length);
      for(let i=0;i<this.pointCount;i++) {
        const fade=.85*Math.pow(1-i/(this.pointCount-1),.8)+.08;
        colors.set([fade,fade,fade],i*3);
      }
      this.geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
      this.geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    } else {
      this.geometry.attributes.position.array.set(positions);
      this.geometry.attributes.position.needsUpdate=true;
    }
    this.geometry.setDrawRange(0,this.pointCount);
    this.line.visible=true;
    this.startTime=elapsed;
    this.anchorDistance=distance;
  }

  follow(position, distance, elapsed) {
    if(!this.pointCount)return;
    if(elapsed<this.startTime){this.line.visible=false;return;}
    const first=Math.min(this.pointCount-1,Math.floor((elapsed-this.startTime)/FORECAST_SAMPLE_INTERVAL));
    this.line.position.x=this.anchorDistance-distance;
    // Trim time already flown; pin the remaining preview to the current ship.
    this.geometry.attributes.position.setXYZ(first,position.x-this.line.position.x,position.y,position.z);
    this.geometry.attributes.position.needsUpdate=true;
    this.geometry.setDrawRange(first,this.pointCount-first);
  }
}
