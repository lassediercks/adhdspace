// Journey distance drives beam layouts and the recorded trail. Encounter scenery
// uses a faster moving frame; forecasts must undo that frame's translation to
// place future interactions at the bodies' currently visible positions.
export const JOURNEY_SPEED=2.8;
export const SCENERY_SPEED=8;
export const sceneryDistance=journeyDistance=>journeyDistance*SCENERY_SPEED/JOURNEY_SPEED;
