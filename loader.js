const canvas1 = document.querySelector("#clock");

const usRenderDelay = 30 * 1000;
const usRenderWindow = usPerRevolution;
const usStartTime = window.performance.now() * 1000;
const laserSystem = new LaserSystem(canvas1, usRenderDelay, usRenderWindow);
const beamBuffer = new BeamAngleBuffer(bufferSize, 17, usStartTime, usPerRevolution);
const ttlBuffer = new LaserShowBuffer(bufferSize, 23, usStartTime, usPerRevolution);

const oneSec = 1000 * 1000;
const threeSec = 3 * oneSec;
const fiveSec = 5 * oneSec;
const rayCount = 7;
//ttlBuffer.addEffect(new CoverEffect(fiveSec, fiveSec));
ttlBuffer.addEffect(new FullEffect(oneSec));
//ttlBuffer.addEffect(new OpeningSunrayEffect(fiveSec / 2, rayCount, 0))
//ttlBuffer.addEffect(new SunrayEffect(fiveSec, rayCount, fiveSec));
//ttlBuffer.addEffect(new SunrayEffect(oneSec, rayCount, 0));
//ttlBuffer.addEffect(new ReverseSunrayEffect(fiveSec, rayCount, fiveSec));
//ttlBuffer.addEffect(new SunrayEffect(oneSec, rayCount, 0));
//ttlBuffer.addEffect(new ClosingSunrayEffect(fiveSec / 2, rayCount, 0))
//ttlBuffer.addEffect(new FullEffect(oneSec));
//ttlBuffer.addEffect(new UncoverEffect(fiveSec, fiveSec));
//ttlBuffer.addEffect(new EmptyEffect(oneSec));

function start() {
  let drawInterval = null;
  let isStarted = false;

  function toggle() {
    if (isStarted) {
      clearInterval(drawInterval);
      drawInterval = null;
      isStarted = false;
    } else {
      isStarted = true;
      drawInterval = setInterval(function() {
        let usNow =  window.performance.now() * 1000;
        beamBuffer.update(usNow);
        usNow =  window.performance.now() * 1000;
        ttlBuffer.update(usNow);
        laserSystem.draw(beamBuffer, ttlBuffer);
      }, 11);
    }
  }
  canvas1.addEventListener('click', toggle, false);
  toggle();
}

document.addEventListener('DOMContentLoaded', start);
