class LaserSystem {
  constructor(canvas, usRenderDelay, usRenderWindow) {
    this.centerX = canvas.width / 2;
    this.centerY = canvas.height / 2;
    const context = canvas.getContext("2d");
    context.lineWidth = 2;
    context.strokeStyle = '#DD0000';
    this.radius = canvas.width / 2;
    this.context = context;
    this.usRenderWindow = usRenderWindow;
    this.usRenderDelay = usRenderDelay;
  }
  _paintBeam(progress) {
    const radians = (Math.TAU * progress) - (Math.TAU/4);
    const len = 2* this.radius;
    const targetX = this.centerX + Math.cos(radians) * len;
    const targetY = this.centerY + Math.sin(radians) * len;
    this.context.beginPath();
    this.context.moveTo(this.centerX, this.centerY); // Start at the center
    this.context.lineTo(targetX, targetY); // Draw a line outwards
    this.context.stroke();
  }
  draw(beamBuffer, showBuffer) {
    const usNow = window.performance.now() * 1000;   
    const usEnd = usNow - this.usRenderDelay;
    const usStart = usNow - this.usRenderDelay - this.usRenderWindow;
    const cursor = new BeamBufferCursor(showBuffer, usStart)
    this.context.clearRect(0,0,600,600);
    beamBuffer.playBeams(usStart, usEnd, (position, usTime) => {
      if (cursor.isOn(usTime, position)) {
        this._paintBeam(position);
      }
    });
  }
}

class BeamBuffer {
  constructor(bufferSize, usStepSize, usStartTime, usPerRevolution) {
    this.usPerRevolution = usPerRevolution;
    this.size = bufferSize;
    this.usStartTime = usStartTime;
    this.values = [];
    this.times = [];
    for (let i = 0; i < this.size; i++) {
      this.values[i] = false;
      this.times[i] = null;
    }
    this.curIndex = 0;
    this.usStepSize = usStepSize;
  }  
  update(usNow) {
    if (this.curIndex === 0) {
      const usDelta = (usNow - this.usStartTime) % this.usPerRevolution;
      this.values[this.curIndex] = this.computeValue(
        usDelta / this.usPerRevolution, usNow);
      this.times[this.curIndex] = usNow;
      this.curIndex++;
    } else {
      // Limit the previous time to at most 1000 times the step size (to
      // support pausing/resuming the simulation)
      const usPrev = Math.max(this.times[(this.curIndex - 1) % this.size],
        usNow - (this.usStepSize * 1000));
      let usStep = usPrev + this.usStepSize;
      do {
        const usDelta = (usStep - this.usStartTime) % this.usPerRevolution;
        this.values[this.curIndex % this.size] = this.computeValue(
          usDelta / this.usPerRevolution, usStep);
        this.times[this.curIndex % this.size] = usStep;
        usStep += this.usStepSize;
        this.curIndex++;
        if (this.curIndex === 2 * this.size) {
          this.curIndex = this.size;
        }
      } while (usStep <= usNow)
    }
  }
  computeValue(position, usTime) {
    throw new Error('not implemented in base class');
  }
}

// Compute the beam progress around the circle (expressed as a value between 0
// and 1) every few microseconds
class BeamAngleBuffer extends BeamBuffer {
  playBeams(usStart, usEnd, cb) {
    let endIndex = this.curIndex;
    let index = this.curIndex;
    // Find the first beam with time > usStart
    do {
      index--;
    } while (this.times[index % this.size] > usStart)
    index++;
    // Play the beams until the buffer runs out or a
    // beam with time > usEnd is reached
    do {
      const angle = this.values[index % this.size];
      if (angle > -1) {
        cb(angle, this.times[index % this.size]);
      }
      index++;
    } while (index < endIndex && this.times[index % this.size] < usEnd);
  }
  computeValue(position, usTime) {
    return position;
  }
}

class TtlBuffer extends BeamBuffer {
  constructor(bufferSize, usStepSize, usStartTime, usPerRevolution) {
    super(bufferSize, usStepSize, usStartTime, usPerRevolution);
    this.effects = [];
    this.currentEffectPos = -1;
  }
  addEffect(showEffect) {
    this.effects.push(showEffect);
  }
  getNextEffect() {
    this.currentEffectPos++;
    return this.effects[this.currentEffectPos % this.effects.length];
  }
  computeValue(position, time) {
    if (!this.effect || this.effect.isFinished()) {
      this.effect = this.getNextEffect();
      this.effect.setup(position, time);
    }
    return this.effect.isLaserOn(position, time);
  }
}

class BeamBufferCursor {
  constructor(showBuffer, usStart) {
    this.buffer = showBuffer;
    this.cursor = showBuffer.curIndex;
    this.seek(usStart);
  }
  decrement() {
    if ((this.buffer.curIndex % this.buffer.size) === ((this.cursor - 1) % this.buffer.size)) {
      return false;
    }
    this.cursor--;
  }
  increment() {
    if ((this.buffer.curIndex % this.buffer.size) === ((this.cursor + 1) % this.buffer.size)) {
      return false;
    }
    this.cursor++;
  }
  seek(usStep, reentrantCount = 0) {
    if (this.buffer.times[this.cursor % this.buffer.size] > usStep) {
      //console.log('case 1');
      while (this.buffer.times[this.cursor % this.buffer.size] >= usStep) {
        if (!this.decrement()) {
          break;
        }
      }
    } else if (this.buffer.times[this.cursor % this.buffer.size] === usStep) {
      //console.log('case 2');
      while (this.buffer.times[this.cursor % this.buffer.size] === usStep) {
        if (!this.decrement()) {
          break;
        }
      }
    } else if (this.buffer.times[this.cursor % this.buffer.size] < usStep) {     
      //console.log('case 3');
      while (this.buffer.times[this.cursor % this.buffer.size] < usStep) {
        if (!this.increment()) {
          break;
        }
      }
      // I don't know what's going on here. There's a weird case where
      // seeking "converges" over 100s of reentrant calls. Not work
      // troubleshooting because the overall simulation is good enough
      // but still super weird.
      if (reentrantCount < 1000) {
        this.seek(usStep, reentrantCount + 1);
      }
    }
  }
  isOn(usBeamTime, position) {
    this.seek(usBeamTime);
    const bufferTime = this.buffer.times[this.cursor % this.buffer.size];
    // TODO: why is this invariant violated sometimes (expressed as a statment that
    // should alwasy be false):
    // bufferTime >= usBeamTime && this.buffer.times[(this.cursor - 1) % this.buffer.size]
    const isOn = this.buffer.values[this.cursor % this.buffer.size];
    return isOn;
  }
}
