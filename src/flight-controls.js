export const CONTROL_RESPONSE=.3;
export const smoothControl=(value,target,seconds)=>target+(value-target)*Math.exp(-CONTROL_RESPONSE*seconds);
const clamp=value=>Math.max(0,Math.min(1,value));
// Strong coherence greatly reduces risk, without granting absolute immunity.
export function derailmentRisk(instability,radius) {
 const t=clamp((instability-.35)/.65),disruption=t*t*(3-2*t);
 return disruption*(.015+.985*clamp(radius/7)**2);
}


// The final fifth of engine power smoothly relinquishes beam guidance.
// At zero, existing momentum and gravity determine the path.
export function beamGuidanceStrength(radius) {
 const power=clamp((1-radius/7)/.2);
 return power*power*(3-2*power);
}
