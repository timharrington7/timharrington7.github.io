Math.TAU = 2 * Math.PI;

const scaleFactor = 1;
const laserLineWidth = 1;

const RPS = scaleFactor * 50;
const size = scaleFactor * 4000;
const usPerRevolution = (1000 * 1000) / RPS;
const usRenderDelay = 30 * 1000;
const usRenderWindow = usPerRevolution;
const updateIntervalMs = 7 / scaleFactor;
const drawIntervalMs = 29;
const ttlStepSizeUs = 17 / scaleFactor;
const beamStepSizeUs = 13 / scaleFactor;

function debug(str) {
  console.log(str);
}