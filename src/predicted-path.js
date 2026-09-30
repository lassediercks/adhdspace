import { instabilityLevel } from './space-weather.js';
import * as THREE from 'three';
import { FORECAST_SAMPLE_INTERVAL } from './trajectory-prediction.js';

export class PredictedPath {
  constructor(parent) {
    this.geometry=new THREE.BufferGeometry();
    this.line=new THREE.Line(this.geometry,new THREE.LineBasicMaterial({color:0xa3c9e5,vertexColors:true,transparent:true,opacity:.32,depthWrite:false}));
    this.line.frustumCulled=false;
    parent.add(this.line);
    this.willRefuel=false;
    this.weatherColor=new THREE.Color();
    this.startTime=0;
    this.anchorDistance=0;
    this.pointCount=0;
    this.version=0;
    this.busy=false;
    this.queued=null;
    this.worker=new Worker(new URL('./prediction-worker.js',import.meta.url),{type:'module'});
    this.worker.onmessage=({data})=>{
      if(data.version===this.version)this.apply(new Float32Array(data.positions),data.elapsed,data.distance,data.willRefuel);
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

  apply(positions, elapsed, distance, willRefuel=false) {
    this.willRefuel=willRefuel;
    const previous=this.geometry.attributes.position?.array;
    const displayed=new Float32Array(positions);
    if(previous) {
      const shift=(elapsed-this.startTime)/FORECAST_SAMPLE_INTERVAL;
      for(let i=0;i<positions.length/3;i++) {
        const source=i+shift,index=Math.max(0,Math.min(this.pointCount-2,Math.floor(source))),fraction=Math.max(0,Math.min(1,source-index));
        for(let axis=0;axis<3;axis++) {
          displayed[i*3+axis]=previous[index*3+axis]*(1-fraction)+previous[(index+1)*3+axis]*fraction;
        }
        displayed[i*3]+=this.anchorDistance-distance;
      }
    }
    this.targetPositions=positions;
    if(this.pointCount!==positions.length/3) {
      this.pointCount=positions.length/3;
      const colors=new Float32Array(positions.length);
      for(let i=0;i<this.pointCount;i++) {
        const fade=.85*Math.pow(1-i/(this.pointCount-1),.8)+.08;
        colors.set([fade,fade,fade],i*3);
      }
      this.geometry.setAttribute('position',new THREE.BufferAttribute(displayed,3).setUsage(THREE.DynamicDrawUsage));
      this.geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    } else {
      this.geometry.attributes.position.array.set(displayed);
      this.geometry.attributes.position.needsUpdate=true;
    }
    this.geometry.setDrawRange(0,this.pointCount);
    this.line.visible=true;
    this.startTime=elapsed;
    this.anchorDistance=distance;
  }

  follow(position, distance, elapsed, dt=1/60, instability=0) {
    const level=instabilityLevel(instability),severity=Math.max(0,(instability-.6)/.4);
    this.weatherColor.setHex(this.willRefuel?0x64b5ff:level==='high'?0xf19a7a:level==='elevated'?0xe6cb70:0xa3c9e5);
    this.line.material.color.lerp(this.weatherColor,1-Math.exp(-dt*4));
    this.line.material.opacity=this.willRefuel?.55:.32+.2*severity;
    if(!this.pointCount)return;
    if(elapsed<this.startTime){this.line.visible=false;return;}
    // Align successive forecasts in time, then ease their geometry instead of
    // snapping the entire future path when a slider target or weather changes.
    const displayed=this.geometry.attributes.position.array,blend=1-Math.exp(-dt*(1.3+severity*3));
    for(let i=0;i<displayed.length;i++)displayed[i]+=(this.targetPositions[i]-displayed[i])*blend;
    const first=Math.min(this.pointCount-1,Math.floor((elapsed-this.startTime)/FORECAST_SAMPLE_INTERVAL));
    this.line.position.x=this.anchorDistance-distance;
    // Trim time already flown; pin the remaining preview to the current ship.
    this.geometry.attributes.position.setXYZ(first,position.x-this.line.position.x,position.y,position.z);
    this.geometry.attributes.position.needsUpdate=true;
    this.geometry.setDrawRange(first,this.pointCount-first);
  }
}
