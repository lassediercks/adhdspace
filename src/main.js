import { SpaceBackdrop } from './space-backdrop.js';
import { flightRoute, beamCenter, MAX_BEAMS } from './flight-route.js';
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
const state = { playing: !matchMedia('(prefers-reduced-motion: reduce)').matches, speed: 1.5, radius: 4, instability: 0, phase: 1.05, elapsed: 0, trail: true, beamCount:1 };
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
const orbitPosition = new THREE.Vector3(17, 13, 28);
const lookTarget = new THREE.Vector3(-1, 0, 0);
camera.position.copy(orbitPosition);
controls.target.copy(lookTarget);
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
const beamObstacles = asteroids.asteroids.map(body=>body.outline);
const gravity = new OrbitalGravity();
const journey = new Journey();
const nominalPosition = new THREE.Vector3();
const previousPosition = new THREE.Vector3();
let currentInstability = 0;
ship.position.set(0, Math.cos(state.phase) * 4, Math.sin(state.phase) * 4);
gravity.reset(ship.position, {x:0,y:-ship.position.z*.45,z:ship.position.y*.45});
const direction=new THREE.Vector3(), shipAxis=new THREE.Vector3(1,0,0);
const clock=new THREE.Clock();
let currentDual=0;
let currentRadius=4, cameraTransition=false;
function animate(){
 requestAnimationFrame(animate);
 const dt=Math.min(clock.getDelta(),.05);
 const step=state.playing?dt*state.speed:0;
 state.elapsed+=step;state.phase+=step*.45;
 if(state.playing)currentRadius=THREE.MathUtils.damp(currentRadius,state.radius,4,dt);
 currentDual=THREE.MathUtils.damp(currentDual,state.beamCount-1,2,step);
 const r=currentRadius, a=state.phase;
 previousPosition.copy(ship.position);
 if (step > 0) currentInstability = THREE.MathUtils.damp(currentInstability, state.instability / 100, 3, step);
 const previousRate=journey.rate;
 const journeyStep=journey.advance(step,ship.position,gravity.velocity,asteroids.sources,currentInstability,currentRadius);
 // Moving into/out of the local body frame preserves relative velocity.
 gravity.velocity.x+=8*(previousRate-journey.rate);
 const sources = asteroids.update(journeyStep, ship.position, journey.rate, step);
 beams.forEach((beam,index)=>{
  beam.core.visible=beam.rim.visible=index<state.beamCount;
  if(index<state.beamCount)beam.update(beamObstacles,beamCenter(index,state.beamCount));
 });
 const orbitPlanet=journey.orbit&&sources.find(p=>p.id===journey.orbit.id);
 const orbit=orbitPlanet?{body:orbitPlanet,normal:journey.orbit.normal}:null;
 const route={phase:a,radius:r,dual:currentDual};
 const target=flightRoute(a,r,currentDual);
 nominalPosition.copy(target);
 const offset = gravity.advance(step, target, sources, currentInstability, currentRadius, orbit, route);
 ship.position.set(nominalPosition.x + offset.x, nominalPosition.y + offset.y, nominalPosition.z + offset.z);
 if (step > 0) {
   direction.copy(ship.position).sub(previousPosition);
   direction.x += journeyStep * 2.8;
   direction.normalize();
 } else if (state.elapsed === 0) {
   direction.set(2.8,-Math.sin(a)*r*.45,Math.cos(a)*r*.45).normalize();
 }
 ship.quaternion.setFromUnitVectors(shipAxis,direction);
 ship.rotateX(-.16);
 exhaust.forEach((e,i)=>{e.scale.y=1+Math.sin(state.elapsed*32+i)*.07;e.material.opacity= .8*(state.playing?1:.55);});
 const forwardDistance = journey.distance;
 if (step > 0 || flownTrail.samples.length === 0) flownTrail.record(forwardDistance, ship.position);
 recordedTrail.update(flownTrail.samples,forwardDistance);
 predictionCooldown+=dt;
 const bodySignature=sources.map(body=>`${body.id}:${body.generation}`).join('|');
 if(predictionDirty||bodySignature!==predictionBodies||(step>0&&predictionCooldown>=.2)) {
  if(predictionDirty||bodySignature!==predictionBodies)prediction.invalidate();
  prediction.refresh({
    position:gravity.position,velocity:gravity.velocity,journey,bodies:sources,
    dual:currentDual,targetDual:state.beamCount-1,
    phase:state.phase,radius:currentRadius,targetRadius:state.radius,
    instability:currentInstability,targetInstability:state.instability/100,speed:state.speed,
  },state.elapsed);
  predictionDirty=false;predictionCooldown=0;predictionBodies=bodySignature;
 }
 prediction.follow(ship.position,journey.distance,state.elapsed);
 backdrop.advance(journeyStep*2.8);
 if(cameraTransition){
  camera.position.lerp(orbitPosition,1-Math.exp(-dt*4));
  controls.target.lerp(lookTarget,1-Math.exp(-dt*4));
  if(camera.position.distanceTo(orbitPosition)<.06)cameraTransition=false;
 } else {
  // Preserve the user's orbit/zoom while smoothly following an escaping ship.
  const escapeBlend=THREE.MathUtils.clamp((ship.position.length()-8)/12,0,1);
  const target=lookTarget.clone().addScaledVector(ship.position,escapeBlend);
  const shift=target.sub(controls.target).multiplyScalar(1-Math.exp(-dt*2));
  controls.target.add(shift);camera.position.add(shift);
 }
 controls.update();
 renderer.render(scene, camera);
}
function updatePlayback(){
 $('play').setAttribute('aria-label',state.playing?'Pause flight':'Resume flight');
 $('pause-icon').innerHTML=state.playing?'<path d="M8 6v12M16 6v12" stroke="currentColor" stroke-width="2.5"/>':'<path d="m8 5 11 7-11 7Z" fill="currentColor"/>';
}
$('play').addEventListener('click',()=>{state.playing=!state.playing;updatePlayback();});
function updateSlider(input){input.style.setProperty('--fill',`${(input.value-input.min)/(input.max-input.min)*100}%`);}
for(const id of ['coherence','instability']){
 const input=$(id);updateSlider(input);
 input.addEventListener('input',()=>{
  predictionDirty=true;
  const value=Number(input.value);
  if(id==='coherence')state.radius=7*(1-value/100);else state.instability=value;
  updateSlider(input);$(`${id}-output`).textContent=`${value}%`;
 });
}
controls.addEventListener('start',()=>{cameraTransition=false;});
function updateBeamControls(){
 $('beam-count').textContent=state.beamCount;
 $('remove-beam').disabled=state.beamCount===1;
 $('add-beam').disabled=state.beamCount===MAX_BEAMS;
}
for(const [id,delta] of [['remove-beam',-1],['add-beam',1]])$(id).addEventListener('click',()=>{
 state.beamCount=THREE.MathUtils.clamp(state.beamCount+delta,1,MAX_BEAMS);
 predictionDirty=true;updateBeamControls();
});
updateBeamControls();
$('trail').addEventListener('click',()=>{state.trail=!state.trail;trailGroup.visible=state.trail;$('trail').setAttribute('aria-checked',state.trail);});
function reset(){backdrop.reset();currentDual=0;state.beamCount=1;updateBeamControls();predictionDirty=true;journey.reset();flownTrail.clear();recordedTrail.clear();gravity.reset();asteroids.reset();currentInstability=0;Object.assign(state,{speed:1.5,radius:4,instability:0,phase:1.05,elapsed:0,trail:true});currentRadius=4;ship.position.set(0,Math.cos(state.phase)*4,Math.sin(state.phase)*4);gravity.reset(ship.position,{x:0,y:-ship.position.z*.45,z:ship.position.y*.45});trailGroup.visible=true;$('trail').setAttribute('aria-checked','true');for(const id of ['coherence','instability']){const value=id==='coherence'?Math.round(100*(1-state.radius/7)):state.instability;$(id).value=value;updateSlider($(id));$(`${id}-output`).textContent=`${value}%`;}cameraTransition=true;updatePlayback();}
$('reset').addEventListener('click',reset);
$('info-button').addEventListener('click',()=>$('info-dialog').showModal());
$('close-info').addEventListener('click',()=>$('info-dialog').close());
$('resume-exploring').addEventListener('click',()=>$('info-dialog').close());
$('info-dialog').addEventListener('click',e=>{if(e.target===$('info-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
window.addEventListener('keydown',e=>{if(['INPUT','BUTTON','A'].includes(document.activeElement.tagName)||$('info-dialog').open)return;if(e.code==='Space'){e.preventDefault();$('play').click();}if(e.key.toLowerCase()==='r')reset();});
function resize(){const w=innerWidth,h=$('app').clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);}
window.addEventListener('resize',resize);
updatePlayback();animate();
