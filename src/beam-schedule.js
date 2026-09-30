import { MAX_BEAMS } from './flight-route.js';
export const BEAM_INTERVAL=30;
export const scheduledBeamCount=seconds=>Math.min(MAX_BEAMS,1+Math.floor((Math.max(0,seconds)+1e-9)/BEAM_INTERVAL));
