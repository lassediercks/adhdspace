import { predictPath } from './trajectory-prediction.js';

self.onmessage=({data})=>{
  const positions=predictPath(data.snapshot);
  self.postMessage({positions:positions.buffer,elapsed:data.elapsed,distance:data.snapshot.journey.distance,version:data.version},[positions.buffer]);
};
