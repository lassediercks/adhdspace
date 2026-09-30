import { forecastFlight } from './trajectory-prediction.js';

self.onmessage=({data})=>{
  const {positions,willRefuel}=forecastFlight(data.snapshot);
  self.postMessage({positions:positions.buffer,willRefuel,elapsed:data.elapsed,distance:data.snapshot.journey.distance,version:data.version},[positions.buffer]);
};
