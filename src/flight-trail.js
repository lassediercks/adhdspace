// Store immutable world positions, then translate them into the moving camera frame.
// Radius changes never recalculate positions that the ship has already visited.
export class FlightTrail {
  constructor(capacity = Infinity, length = Infinity) {
    this.capacity = capacity;
    this.length = length;
    this.samples = [];
    this.pathDistance = 0;
  }

  record(forwardDistance, position) {
    const last = this.samples.at(-1);
    const segment=last?Math.hypot(forwardDistance+position.x-last.x,position.y-last.y,position.z-last.z):0;
    if (last && segment < 0.04) return;
    this.pathDistance+=segment;
    this.samples.push({
      forwardDistance,
      pathDistance:this.pathDistance,
      x: forwardDistance + position.x,
      y: position.y,
      z: position.z,
    });
    while (this.samples.length > this.capacity ||
      this.pathDistance - this.samples[0].pathDistance > this.length) {
      this.samples.shift();
    }
  }

  writeBuffers(forwardDistance, positions, colors) {
    this.samples.forEach((point, index) => {
      positions.set([point.x - forwardDistance, point.y, point.z], index * 3);
      colors.set([0.72, 0.48, 0.25], index * 3);
    });
    return this.samples.length;
  }

  clear() {
    this.samples.length = 0;
    this.pathDistance = 0;
  }
}
