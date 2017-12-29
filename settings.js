Math.TAU = 2 * Math.PI;
const RPS = 100;
const size = 3000;
const usPerRevolution = (1000 * 1000) / RPS;
const usRenderDelay = 30 * 1000;
const usRenderWindow = usPerRevolution;
const updateIntervalMs = 7;
const drawIntervalMs = 17;

function debug(str) {
  console.log(str);
}