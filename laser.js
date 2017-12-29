class LaserSystem {
  constructor(canvas, usRenderDelay, usRenderWindow) {
    this.centerX = canvas.width / 2;
    this.centerY = canvas.height / 2;
    const context = canvas.getContext("2d");
    context.lineWidth = laserLineWidth;
    context.strokeStyle = '#DD0000';
    this.radius = canvas.width / 2;
    this.context = context;
    this.canvasW = canvas.width;
    this.canvasH = canvas.height;
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
    this.context.clearRect(0, 0,this.canvasW, this.canvasH);
    this.context.fillStyle = 'black'; 
    this.context.fillRect(0, 0, this.canvasW, this.canvasH)
    beamBuffer.playBeams(usStart, usEnd, (position, usTime) => {
      const isOn = cursor.isOn(usTime, position);
      if (isOn) {
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
      // Limit the previous time to at most 3000 times the step size (to
      // support pausing/resuming the simulation)
      const usPrev = Math.max(this.times[(this.curIndex - 1) % this.size],
        usNow - (5000 + usRenderDelay + usRenderWindow));
      let usStep = usPrev + this.usStepSize;
      do {
        const usDelta = (usStep - this.usStartTime) % this.usPerRevolution;
        this.values[this.curIndex % this.size] = this.computeValue(
          usDelta / this.usPerRevolution, usStep);
        this.times[this.curIndex % this.size] = usStep;
        usStep += this.usStepSize;
        this.curIndex++;
        if (this.curIndex === this.size) {
          debug('buffer is now full');
          this.isBufferFull = true;
        }
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
    if (usStart < this.usStartTime) {
      throw new Error('requested a time outside of the buffer window');
    }
    let endIndex = this.curIndex;
    let index = endIndex;

    // Find the first beam with time > usStart, but watch out for the buffer
    // edges
    let isSeeking = true;
    do {
      if ((index % this.size) === 0) {
        if (this.isBufferFull) {
          //debug('buffer is full; wrapping around')
          index = this.size - 1;
        } else {
          isSeeking = false;
          break;
        }
      } else {
        index--;
      }
      const cursorTime = this.times[index % this.size];
      if (!cursorTime) {
        throw new Error('empty time')
      }
      isSeeking = Boolean(cursorTime > usStart);
      if (index === endIndex + 1) {
        throw new Error('buffer underflow');
      }
    } while (isSeeking);
    
    if (index < endIndex) {
      //index++;
    } else {
      throw new Error('invariant violated');
    }

    const firstTime = this.times[index % this.size];
    if (!firstTime || (firstTime + 100) < usStart) {
      throw new Error('invariant violated');
    }

    if (firstTime > usEnd) {
      console.log('no beams found in range');
    }

    // Play the beams until the buffer runs out or a
    // beam with time > usEnd is reached
    let t0;
    do {
      const angle = this.values[index % this.size];
      const t1 = this.times[index % this.size];
      if (!t1) {
        throw new Error('empty time');
      }
      if (t0 && t1 && t0 > t1) {
        throw new Error('non-monotonic times');
      }
      cb(angle, t1);
      index++;
      t0 = t1;
      if ((index % this.size) === (endIndex % this.size)) {
        debug('hit end of range')
        break;
      }
      if (this.times[index % this.size] >= usEnd) {
        //debug('hit end of window')
        break;
      }
    } while (true);
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
  constructor(buffer, usStart) {
    this.buffer = buffer;
    this.cursor = buffer.curIndex;
    this.seek(usStart);
  }
  decrement() {
    if ((this.cursor % this.buffer.size) === 0) {
      if (this.buffer.isBufferFull) {
        //debug('buffer is full; wrapping around')
        this.cursor = this.buffer.size - 1;
      } else {
        return false;
      }
    } else {
      this.cursor--;
    }
    const endOfBuffer = (this.buffer.curIndex + 1) % this.buffer.size;
    return (endOfBuffer !== (this.cursor % this.buffer.size))
  }
  increment() {
    this.cursor++;
    const endOfBuffer = this.buffer.curIndex % this.buffer.size;
    return (endOfBuffer !== (this.cursor % this.buffer.size));
  }
  seek(usTargetTime, reentrantCount = 0) {
    if (this.buffer.times[this.cursor % this.buffer.size] > usTargetTime) {
      //debug('case 1');
      while (this.buffer.times[this.cursor % this.buffer.size] >= usTargetTime) {
        if (!this.decrement()) {
          console.log('cursor hit end of buffer 1');
          break;
        }
      }
    } else if (this.buffer.times[this.cursor % this.buffer.size] === usTargetTime) {
      //debug('case 2');
      while (this.buffer.times[this.cursor % this.buffer.size] === usTargetTime) {
        if (!this.decrement()) {
          console.log('cursor hit end of buffer 2');
          break;
        }
      }
    } else if (this.buffer.times[this.cursor % this.buffer.size] < usTargetTime) {     
      //debug('case 3');
      while (this.buffer.times[this.cursor % this.buffer.size] < usTargetTime) {
        if (!this.increment()) {
          console.log('cursor hit end of buffer 3');
          break;
        }
      }
      if (reentrantCount > 2) {
        console.log('seek is oscillating');
        return;
      }
      this.seek(usTargetTime, reentrantCount + 1);
    }
  }
  isOn(usBeamTime, position) {
    this.seek(usBeamTime);
    const bufferTime = this.buffer.times[this.cursor % this.buffer.size];
    if (bufferTime >= usBeamTime + 100) {
      throw new Error('invariant violated');
    }
    return this.buffer.values[this.cursor % this.buffer.size];
  }
}
