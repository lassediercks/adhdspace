export const MAX_SCORE_RATE=10;
export const SCORE_RANGE=12;

// Distance to the actual illuminated segments, including angled beams and
// gaps around asteroids. Overlapping beams never multiply the reward.
export function beamScoreRate(position,beams) {
  let best=0;
  for(const {center,direction,intervals,opacity} of beams) {
    if(opacity<=0)continue;
    const delta={x:position.x-(center.x??0),y:position.y-center.y,z:position.z-center.z};
    const along=delta.x*direction.x+delta.y*direction.y+delta.z*direction.z;
    for(const [start,end] of intervals) {
      const t=Math.max(start,Math.min(end,along));
      const distance=Math.hypot(delta.x-direction.x*t,delta.y-direction.y*t,delta.z-direction.z*t);
      const proximity=Math.max(0,1-distance/SCORE_RANGE);
      const rate=MAX_SCORE_RATE*proximity*proximity*(3-2*proximity)*opacity;
      best=Math.max(best,rate);
    }
  }
  return Math.min(MAX_SCORE_RATE,best);
}

export class FlightScore {
  constructor(){this.total=0;this.rate=0;}
  advance(seconds,position,beams,hasFuel=true){
    this.rate=hasFuel?beamScoreRate(position,beams):0;
    this.total+=Math.max(0,seconds)*this.rate;
  }
}
