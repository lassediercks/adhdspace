import { FlightScore } from './flight-score.js';
import { BeamNetwork, networkFlightRoute } from './beam-network.js';
import { Navigation, RESCUE_FUEL, REFUEL_SECONDS, fuelBurnRate } from './navigation.js';
import { smoothControl } from './flight-controls.js';
import { SpaceWeather, instabilityLevel } from './space-weather.js';
import { SpaceBackdrop } from './space-backdrop.js';
import { flightRoute, MAX_BEAMS } from './flight-route.js';
import './style.css';
import { RecordedTrail } from './recorded-trail.js';
import { FlightTrail } from './flight-trail.js';
import { OrbitalGravity } from './orbital-gravity.js';
import { Journey } from './journey.js';
import { OccludedBeam } from './beam.js';
import { PredictedPath } from './predicted-path.js';
import { PassingAsteroids } from './asteroids.js';
import { toonMaterial, facetedGeometry } from './toon-style.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = (id) => document.getElementById(id);
const DEFAULT_FLIGHT = Object.freeze({speed:1.5,coherence:100,radius:0,phase:1.05,elapsed:0,beamCount:1});
const state = {playing:true,...DEFAULT_FLIGHT};
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (error) {
  $('error').hidden = false;
  throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, $('app').clientHeight);
renderer.toneMapping = THREE.NoToneMapping;
renderer.toneMappingExposure = 1.05;
$('viewport').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#101828');
scene.fog = new THREE.FogExp2('#101828', 0.00045);
const camera = new THREE.PerspectiveCamera(43, innerWidth / $('app').clientHeight, 0.1, 6000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.045;
controls.enablePan = false;
controls.minDistance = 12;
controls.maxDistance = 250;
controls.autoRotate = false;
const defaultCameraOffset = new THREE.Vector3(18, 13, 28);
camera.position.copy(defaultCameraOffset);
// A single key light and restrained ambient fill preserve crisp cel-shading bands.
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const key = new THREE.DirectionalLight(0xffffff, 1.5);
key.position.set(4, 12, 10); scene.add(key);

const backdrop=new SpaceBackdrop(scene);
const ship = new THREE.Group(); scene.add(ship);
const hull = toonMaterial(0xc4ceca);
const dark = toonMaterial(0x34413f);
const panel = hull;
const teal = toonMaterial(0xa4d8c7);
const glass = dark;
function mesh(geometry, material, position=[0,0,0]) {
 const m = new THREE.Mesh(facetedGeometry(geometry), material);
 m.position.set(...position); ship.add(m);
 return m;
}
function box(size,position,material=panel){return mesh(new THREE.BoxGeometry(...size),material,position);}
function poly(vertices,indices,material){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return mesh(g,material);}
// Faceted fuselage, swept wings, raised cockpit, twin engine nacelles.
poly([2.3,0,0, .25,.38,-.4, .25,.38,.4, -1.4,.2,-.48,-1.4,.2,.48, -1.45,-.27,-.38,-1.45,-.27,.38, .4,-.24,-.29,.4,-.24,.29], [0,2,1,1,2,4,1,4,3,3,4,6,3,6,5,0,1,7,1,3,5,1,5,7,0,8,2,2,8,6,2,6,4,0,7,8,7,5,6,7,6,8],hull);
for(const side of [-1,1]){
 poly([.6,0,side*.28,-1.45,.04,side*2.05,-1.9,-.04,side*2.1,-1.48,-.11,side*.32,.4,-.1,side*.28], [0,1,2,0,2,3,0,3,4,4,3,2,4,2,1,4,1,0],panel);
 const nacelle=mesh(new THREE.CylinderGeometry(.19,.24,1.85,8),dark,[-.88,-.015,side*.89]);nacelle.rotation.z=Math.PI/2;
 const engine=mesh(new THREE.CylinderGeometry(.16,.18,.12,16),teal,[-1.84,-.015,side*.89]);engine.rotation.z=Math.PI/2;
 const cowling=box([.55,.19,.36],[-.72,.14,side*.89],hull);
 poly([-1.35,.13,side*.34,-1.6,.93,side*.57,-.84,.24,side*.34,-1.36,.12,side*.4],[0,1,2,2,1,3,0,3,1,0,2,3],dark);
}
const cockpit=mesh(new THREE.IcosahedronGeometry(1,0),glass,[.45,.34,0]);cockpit.scale.set(.82,.23,.26);
const exhaust=[];
for(const side of [-1,1]){
 const plume=mesh(new THREE.ConeGeometry(.14,1.5,5,1,true),new THREE.MeshBasicMaterial({color:0xa4d8c7,transparent:true,opacity:.95,depthWrite:false}),[-2.58,-.015,side*.89]);plume.rotation.z=Math.PI/2;exhaust.push(plume);
}
const trailGroup=new THREE.Group();scene.add(trailGroup);
const flownTrail = new FlightTrail();
const recordedTrail = new RecordedTrail(trailGroup);
const prediction = new PredictedPath(trailGroup);
let predictionDirty=true, predictionCooldown=0, predictionBodies='';
const asteroids = new PassingAsteroids(scene);
const beams = Array.from({length:MAX_BEAMS},()=>new OccludedBeam(scene, asteroids.asteroids.length + 1));

const gravity = new OrbitalGravity();
const journey = new Journey();
const score = new FlightScore();
const navigation = new Navigation(asteroids.seed);
const network = new BeamNetwork(asteroids.seed);
beams.forEach((beam,index)=>{beam.pick.userData.beamIndex=index;});
const weather = new SpaceWeather();
const nominalPosition = new THREE.Vector3();
const previousPosition = new THREE.Vector3();
let currentInstability = weather.value;
const initialRoute=flightRoute(state.phase,state.radius,state.beamCount-1);
ship.position.copy(initialRoute);
gravity.reset(ship.position,initialRoute.velocity);
const direction=new THREE.Vector3(), shipAxis=new THREE.Vector3(1,0,0);
const targetRotation=new THREE.Quaternion(),bankRotation=new THREE.Quaternion().setFromAxisAngle(shipAxis,-.16);
const clock=new THREE.Clock();
let currentDual=state.beamCount-1;
let currentRadius=state.radius, cameraTransition=false;
function animate(){
 requestAnimationFrame(animate);
 const dt=Math.min(clock.getDelta(),.05);
 const step=state.playing?dt*state.speed:0;
 state.elapsed+=step;state.phase+=step*.45;
 network.advance(state.elapsed/state.speed,journey.distance,dt);
 const beamCount=network.beams.length;
 if(beamCount!==state.beamCount){state.beamCount=beamCount;predictionDirty=true;}
 if(state.playing)currentRadius=smoothControl(currentRadius,state.radius,dt);
 currentDual=THREE.MathUtils.damp(currentDual,state.beamCount-1,2,step);
 const r=currentRadius, a=state.phase;
 previousPosition.copy(ship.position);
 if(step>0)currentInstability=weather.advance(dt);
 navigation.exposure=network.exposure(journey.distance);
 navigation.advance(step,ship.position,gravity.velocity,asteroids.sources,currentInstability,currentRadius,dt);
 updateRescueControl();updateWeatherIndicator();updateFuelIndicator();
 const previousRate=journey.rate;
 const journeyStep=journey.advance(step,ship.position,gravity.velocity,asteroids.sources,currentInstability,currentRadius,navigation);
 // Moving into/out of the local body frame preserves relative velocity.
 gravity.velocity.x+=8*(previousRate-journey.rate);
 const sources = asteroids.update(journeyStep, ship.position, journey.rate, step, navigation.consumedStations, state.elapsed/state.speed, navigation);
 const beamObstacles=asteroids.asteroids.filter(body=>body.group.visible).map(body=>body.outline);
 const centers=network.centers(journey.distance);
 beams.forEach((beam,index)=>{
  const opacity=index<state.beamCount?network.opacity(index,journey.distance):0;
  beam.core.visible=beam.rim.visible=opacity>0;
  beam.pick.visible=opacity>.05;
  beam.core.material.opacity=opacity;beam.rim.material.opacity=.18*opacity;
  if(opacity>0){
   beam.update(beamObstacles,centers[index],network.direction(index));
   beam.core.material.color.setHex(network.selected===null||network.selected===index?0xafffe4:0x688e82);
  }
 });
 $('beam-choice').hidden=!network.choiceNeeded&&network.selected===null;
 $('beam-choice').textContent=network.choiceNeeded?'Beams diverging · click a beam to follow':`Following beam ${(network.selected??0)+1}`;
 const orbitPlanet=journey.orbit&&sources.find(p=>p.id===journey.orbit.id);
 const orbit=orbitPlanet?{body:orbitPlanet,normal:journey.orbit.normal}:null;
 const route={phase:a,radius:r,dual:currentDual,network,distance:journey.distance,forwardSpeed:journey.rate*2.8};
 const target=networkFlightRoute(a,r,currentDual,network,journey.distance,journey.rate*2.8);
 nominalPosition.copy(target);
 const offset = gravity.advance(step, target, sources, currentInstability, currentRadius, orbit, route, navigation);
 ship.position.set(nominalPosition.x + offset.x, nominalPosition.y + offset.y, nominalPosition.z + offset.z);
 score.advance(state.playing?dt:0,ship.position,beams.slice(0,state.beamCount).map((beam,index)=>({
   center:centers[index],direction:network.direction(index),intervals:beam.intervals??[],
   opacity:network.opacity(index,journey.distance),
 })));
 $('score-output').textContent=Math.floor(score.total).toLocaleString('en-US');
 $('score-rate').textContent=`+${score.rate.toFixed(1)} pts / s`;

 if (step > 0) {
   direction.copy(ship.position).sub(previousPosition);
   direction.x += journeyStep * 2.8;
   direction.normalize();
 } else if (state.elapsed === 0) {
   direction.set(2.8,-Math.sin(a)*r*.45,Math.cos(a)*r*.45).normalize();
 }
 if(direction.lengthSq()>1e-8){
  targetRotation.setFromUnitVectors(shipAxis,direction).multiply(bankRotation);
  ship.quaternion.slerp(targetRotation,1-Math.exp(-dt*5));
 }
 exhaust.forEach((e,i)=>{e.scale.y=1+Math.sin(state.elapsed*32+i)*.07;e.material.opacity= .8*(state.playing?1:.55);});
 const forwardDistance = journey.distance;
 if (step > 0 || flownTrail.samples.length === 0) flownTrail.record(forwardDistance, ship.position);
 recordedTrail.update(flownTrail.samples,forwardDistance);
 predictionCooldown+=dt;
 const bodySignature=sources.map(body=>`${body.id}:${body.generation}`).join('|');
 if(predictionDirty||bodySignature!==predictionBodies||(step>0&&predictionCooldown>=.2)) {
  if(predictionDirty||bodySignature!==predictionBodies)prediction.invalidate();
  prediction.refresh({
    position:gravity.position,velocity:gravity.velocity,journey,navigation,network,bodies:asteroids.asteroids.map(body=>body.definition),
    flightSeconds:state.elapsed/state.speed,
    dual:currentDual,targetDual:state.beamCount-1,
    phase:state.phase,radius:currentRadius,targetRadius:state.radius,
    instability:currentInstability,targetInstability:currentInstability,speed:state.speed,
  },state.elapsed);
  predictionDirty=false;predictionCooldown=0;predictionBodies=bodySignature;
 }
 prediction.follow(ship.position,journey.distance,state.elapsed,dt,currentInstability);
 backdrop.advance(journeyStep*2.8);
 // Translate the camera with the ship, preserving the user's orbit and zoom.
 // Target the ship every frame, including beam transfers and asteroid capture.
 const cameraShift=ship.position.clone().sub(controls.target);
 camera.position.add(cameraShift);
 controls.target.copy(ship.position);
 if(cameraTransition){
  const resetPosition=ship.position.clone().add(defaultCameraOffset);
  camera.position.lerp(resetPosition,1-Math.exp(-dt*4));
  if(camera.position.distanceTo(resetPosition)<.06)cameraTransition=false;
 }
 controls.update();
 renderer.render(scene, camera);
}
function syncCoherence(){
 const input=$('coherence');input.value=state.coherence;
 input.style.setProperty('--fill',`${state.coherence}%`);
 $('coherence-output').textContent=`${state.coherence}%`;
}
$('coherence').addEventListener('input',()=>{
 state.coherence=Number($('coherence').value);state.radius=7*(1-state.coherence/100);
 predictionDirty=true;syncCoherence();
});
syncCoherence();window.addEventListener('pageshow',syncCoherence);
controls.addEventListener('start',()=>{cameraTransition=false;});
function updateWeatherIndicator(){
 const level=instabilityLevel(currentInstability);
 $('instability-panel').dataset.level=level;
 $('instability-level').textContent=level==='high'?'HIGH':level==='elevated'?'ELEVATED':'NORMAL';
 const value=Math.round(currentInstability*100);
 $('instability-output').textContent=`${value}%`;
 $('instability-meter').setAttribute('aria-valuenow',value);
 $('instability-meter').setAttribute('aria-valuetext',`${value}% · ${level}`);
 $('weather-fill').style.height=`${value}%`;
}
function updateFuelIndicator(){
 const value=Math.round(navigation.fuel);
 $('fuel-output').textContent=`${value}%`;
 $('fuel-meter').setAttribute('aria-valuenow',value);
 $('fuel-fill').style.height=`${navigation.fuel}%`;
 $('fuel-label').textContent=navigation.refueling?'REFUELING':'FUEL';
 const burn=navigation.fuel>0?fuelBurnRate(currentRadius)*state.speed:0;
 $('engine-fuel-rate').textContent=`−${burn.toFixed(2)}% / s`;
 $('out-of-fuel-notice').hidden=navigation.fuel>0||navigation.refueling;
 const rate=navigation.refueling?(100-navigation.refuelStartFuel)/REFUEL_SECONDS:-burn;
 $('refueling-notice').hidden=!navigation.refueling;
 $('refueling-progress').value=navigation.refuelElapsed;
 $('refueling-time').textContent=`${Math.ceil(REFUEL_SECONDS-navigation.refuelElapsed)}s to full`;
 $('fuel-rate').textContent=`${rate>0?'+':'−'}${Math.abs(rate).toFixed(2)}% / s`;
}
function updateRescueControl(){
 const button=$('rescue');button.disabled=navigation.mode!=='derailed'||navigation.fuel<RESCUE_FUEL||navigation.cooldown>0;
 const remaining=Math.ceil(navigation.cooldown);
 const label=navigation.mode==='rescuing'?'Boosting':'Rescue boost';
 button.textContent=remaining>0?`${label} · ${remaining}s`:label;
 button.title=navigation.cooldown>0?`Rescue recharging — ${remaining}s remaining`:navigation.fuel<RESCUE_FUEL?'Refuel at a station — rescue needs 8% fuel':navigation.mode==='derailed'?'Boost back to the primary beam (8% fuel)':'Available when beam lock is lost';
}
$('rescue').addEventListener('click',()=>{
 if(navigation.rescue()){network.rescueToPrimary();predictionDirty=true;updateRescueControl();}
});
updateRescueControl();updateWeatherIndicator();updateFuelIndicator();
const beamRaycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
let pointerStart=null;
function beamAtPointer(event){
 const rect=renderer.domElement.getBoundingClientRect();
 pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
 beamRaycaster.setFromCamera(pointer,camera);
 return beamRaycaster.intersectObjects(beams.slice(0,state.beamCount).filter(beam=>beam.pick.visible).map(beam=>beam.pick),false)[0]?.object.userData.beamIndex;
}
renderer.domElement.addEventListener('pointerdown',event=>{pointerStart={x:event.clientX,y:event.clientY};});
renderer.domElement.addEventListener('pointerup',event=>{
 if(pointerStart&&Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y)<6){
  const index=beamAtPointer(event);
  if(index!==undefined&&network.choose(index))predictionDirty=true;
 }
 pointerStart=null;
});
renderer.domElement.addEventListener('pointermove',event=>{renderer.domElement.style.cursor=beamAtPointer(event)===undefined?'grab':'pointer';});
$('info-button').addEventListener('click',()=>$('info-dialog').showModal());
$('close-info').addEventListener('click',()=>$('info-dialog').close());
$('resume-exploring').addEventListener('click',()=>$('info-dialog').close());
$('info-dialog').addEventListener('click',e=>{if(e.target===$('info-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
function resize(){const w=innerWidth,h=$('app').clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);}
window.addEventListener('resize',resize);
animate();
