import * as THREE from 'three';
import { toonMaterial, facetedGeometry } from './toon-style.js';

// Decorative distant scenery: movement uses journey progress, so capture and
// pause also stop the background. Distance alone produces the parallax layers.
export class SpaceBackdrop {
  constructor(scene, seed=91) {
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    this.layers=[];
    for(const [count,span,near,far,size,opacity] of [
      [650,1800,40,280,1.2,.7],
      [1600,5000,280,1500,1,.55],
      [2600,9000,1500,3600,.8,.4],
    ]) {
      const positions=new Float32Array(count*3),colors=new Float32Array(count*3);
      for(let i=0;i<count;i++) {
        const angle=random()*Math.PI*2,radius=Math.sqrt(near*near+random()*(far*far-near*near));
        positions.set([(random()-.5)*span,Math.cos(angle)*radius,Math.sin(angle)*radius],i*3);
        const brightness=.35+random()*.65;
        colors.set([brightness,brightness,brightness],i*3);
      }
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
      const points=new THREE.Points(geometry,new THREE.PointsMaterial({size,vertexColors:true,transparent:true,opacity,sizeAttenuation:false,depthWrite:false,fog:false}));
      points.frustumCulled=false;scene.add(points);
      this.layers.push({positions,initial:positions.slice(),geometry,span});
    }
    const geometry=facetedGeometry(new THREE.IcosahedronGeometry(1,1));
    const materials=[0x637571,0x7a807a,0x56676b].map(color=>toonMaterial(color));
    this.planets=Array.from({length:22},(_,i)=>{
      const nearby=i<6;
      const angle=random()*Math.PI*2,radial=nearby?220+random()*280:650+random()*1400;
      const planet=new THREE.Mesh(geometry,materials[i%materials.length]);
      planet.position.set((random()-.5)*(nearby?1600:6400),Math.cos(angle)*radial,Math.sin(angle)*radial);
      planet.scale.setScalar(nearby?14+random()*20:25+random()*55);
      planet.rotation.set(random()*Math.PI,random()*Math.PI,0);
      scene.add(planet);
      return {mesh:planet,initial:planet.position.clone(),span:nearby?3600:8000};
    });
  }

  advance(distance) {
    if(distance===0)return;
    for(const {positions,geometry,span} of this.layers) {
      for(let i=0;i<positions.length;i+=3) {
        positions[i]-=distance;
        if(positions[i]<-span/2)positions[i]+=Math.ceil((-span/2-positions[i])/span)*span;
      }
      geometry.attributes.position.needsUpdate=true;
    }
    for(const {mesh,span} of this.planets) {
      mesh.position.x-=distance;
      if(mesh.position.x<-span/2)mesh.position.x+=Math.ceil((-span/2-mesh.position.x)/span)*span;
    }
  }

  reset() {
    for(const layer of this.layers) {
      layer.positions.set(layer.initial);layer.geometry.attributes.position.needsUpdate=true;
    }
    for(const planet of this.planets)planet.mesh.position.copy(planet.initial);
  }
}
