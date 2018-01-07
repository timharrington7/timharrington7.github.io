class EmptyEffect {
  constructor(usDisplayTime) {
    this.usDisplayTime = usDisplayTime;
  }
  setup(startPosition, usStartTime) {
    this.startPosition = startPosition;
    this.usStartTime = usStartTime;
  }
  isLaserOn(position, usTime) {
    this.usLastTime = usTime;
    return false;
  }
  isFinished(usTime) {
    return usTime >= this.usDisplayTime + this.usStartTime;
  }
}

class FullEffect extends EmptyEffect {
  constructor(usDisplayTime) {
    super(usDisplayTime)
  }
  isLaserOn(position, usTime) {
    this.usLastTime = usTime;
    return true;
  }
}

///////////////////


function randint( inLo, inHi ) {
  return Math.floor( inLo + Math.random() * ( .9999 + inHi - inLo )  )
}

function uniform( inLo, inHi ) {
  return ( Math.random() * ( inHi - inLo ) ) + inLo;
}

function randsgn() {
  if ( Math.random() < .5 )
    return -1;
  else
     return 1;
}

function wrap( inX ) {
  return inX - Math.floor( inX );
}


class NoisySineProcession extends EmptyEffect {
  constructor(usDisplayTime) {
    super(usDisplayTime)

    this.scale = Math.PI * 4 * ( randint( 1, 4 ) + 6 * randint( 0, 1 ) );
    this.walkRate = randsgn() * uniform( .1, .4 ) / 100000;

    self.N = 4
    self.phase = [0, 0, 0, 0]
    self.spd   = [0, 0, 0, 0]
    self.amp   = [0, 0, 0, 0]
    for ( let i = 0; i < self.N; i++ ) {
      self.phase[i] = uniform( 0, 2 * Math.PI )
      self.spd[i]   = uniform( .3, .5 )
      self.amp[i]   = Math.PI * uniform( 1, 4. )
    }
  }
  isLaserOn( inPos, inT ) {

    const t = .000001 * (inT - this.usStartTime)

    let offset = 0;
    for ( let i = 0; i < self.N; i++ ) {
        offset += self.amp[i] * Math.sin( self.phase[i] + self.spd[i] * t )
    }

    let mask = .5 * ( 1 + Math.sin( inPos * this.scale + offset ) )

    return Math.random() < mask;
  }
}



class SmoothSineProcession extends EmptyEffect {
  constructor(usDisplayTime) {
    super(usDisplayTime)

    this.scale = Math.PI * 2 * randint( 1, 6 );
    this.walkRate = randsgn() * uniform( .1, .35 );
    this.beamWidth = 5 + 100 * randint( 0, 2 )
    this.quarterTurn = this.scale * .25
    this.lastOn = 0
    this.confinement = uniform( 1.1, 1.4 )
  }
  isLaserOn( inPos, inT ) {


    let gap = inPos - this.lastOn
    if ( gap < 0 )
      gap += 1.

    const t = .00001 * (inT - this.usStartTime)

    let ang = inPos * this.scale + t * this.walkRate

    let mask = .5 * ( 1 + Math.sin( ang ) )

    if ( this.beamWidth * Math.pow( gap, this.confinement ) > mask ) {
      this.lastOn = inPos;
      return true;
    } else {
      return false;
    }
  }
}



class RadarScan extends EmptyEffect {
  constructor(usDisplayTime) {
    super(usDisplayTime)

    this.cursorSpeed = randsgn() * uniform( .1, .35 );
    this.cursorTrail = uniform( .1, .95 )
    this.trailFalloff = uniform( .25, .55 )
    this.gapStart = 0

  }
  isLaserOn( inPos, inT ) {
  

    const t = .000001 * (inT - this.usStartTime)

    let cursorPos = wrap( t * this.cursorSpeed )
    let diff = cursorPos - inPos

    for ( let i = 0; i < 2; i++ ) {
      if ( diff >= 0 && diff < this.cursorTrail ) {
          let L = diff / this.cursorTrail;
          if ( this.cursorSpeed < 0 )
            L = 1 - L

          let gap = inPos - this.gapStart
          if ( gap < 0 )
              gap += 1.

          if ( Math.pow( gap / this.cursorTrail, this.trailFalloff ) > L ) {
              this.gapStart = inPos
              return true;
          } else {
              return false;
          }
      }
      
      // Try wrap when i == 1
      diff += 1.
      
    }
    this.gapStart = inPos
    return false;
   
  }
}



class PulseCannon extends EmptyEffect {
  constructor(usDisplayTime) {
    super(usDisplayTime)

    this.switchModes = Math.random() < .3
    this.modeScale = -1

    this.pulseDuration = uniform( .55, 1.55 )
    this.pulseWidth    = uniform( .02, .06 )
    this.pulseFalloff  = uniform( .2, .9 )
    this.pulseDelay    = uniform( .1, .8 )

    this.pulsePos = 0
    this.pulseStart = -55
    this.pulsePosStep = 0

    if ( this.switchModes ) {
      this.randomPulsePosMode = 1
    } else {
      if ( Math.random() < .5 ) {
        this.pulsePosStep = uniform( .02, .04 )
        this.pulseDelay = .1
      }
    }
  }
  isLaserOn( inPos, inT ) {
  
    const t = .000001 * (inT - this.usStartTime)
    let dt = Math.abs( this.pulseStart - t ) / this.pulseDuration

    if ( dt > 1.0 ) {

        if ( dt < 1.0 + this.pulseDelay / this.pulseDuration )
          return false;

        if ( this.switchModes || this.modeScale < 0 ) {
          this.modeScale = 1.0 / randint( 1, 4 )
        }

        if ( this.pulsePosStep > 0 ) {
          this.pulsePos += this.pulsePosStep
          while ( this.pulsePos >= this.modeScale ) {
            this.pulsePos -= this.modeScale;
          }
        } else {
          this.pulsePos = uniform( 0, this.modeScale )
        }

        this.pulseStart = t
        dt = 0

    }


    let diff = this.pulsePos - inPos

    while ( diff <= 1 + this.pulseWidth ) {
      if ( diff >= - this.pulseWidth && diff <= this.pulseWidth ) {
          let L = 1 - Math.abs( diff / this.pulseWidth )
          let scale = 1.5 * Math.exp( - dt * dt * 3 * this.pulseDuration )

          let X = Math.pow( Math.random() * scale, 1.4 )

          if ( Math.exp( - X ) < L ) {
              return true;
          } else {
              return false;
          }
      }
      
      // Try wrap when i == 1
      diff += this.modeScale
      
    }
    return false;
   
  }
}




/*
class ClockEffect extends EmptyEffect {
  constructor(usDisplayTime) {
    super(usDisplayTime)

    const w = .03
    this.quad_lo = [ .2 - w, .45 - w, .70 - w, .95 - w ];
    this.quad_hi = [ .2 + w, .45 + w, .70 + w, .95 + w ];
  
    this.nextQuad = 2
    this.doingQuad = false;
  }
  isLaserOn( inPos, inT ) {
  
    //let dt = inT - this.prevT
    //if ( dt < 0 )
    //  dt = 0
    //this.prevT = inT
    //this.dtAvg = .9 * this.dtAvg + .1 * dt

    //const t = .00001 * (inT - this.usStartTime)

    let pos = inPos + .5;
    pos = pos - Math.floor( pos )
    if ( pos >= this.quad_lo[ this.nextQuad ] && pos <= this.quad_hi[ this.nextQuad ] ) {
      this.doingQuad = true;
      return true;
    }
    if ( this.doingQuad ) {
      this.nextQuad = ( this.nextQuad + 1 ) % 4;
      this.doingQuad = false;
    }
    return false;
    
  }
}
*/

// clock idea

// beams turn on and off

// mini stripes 




/////////////////




class SunrayEffect extends EmptyEffect {
  constructor(usDisplayTime, beamCount, usRotationTime = 0) {
    super(usDisplayTime);
    this.usDisplayTime = usDisplayTime;
    this.beamCount = beamCount;
    this.bucketWidth = 1 / beamCount;
    this.usRotationTime = usRotationTime;
  }
  isLaserOn(position, usTime) {
    this.usLastTime = usTime;
    let rotationProgress = 0;
    if (this.usRotationTime) {
      const delta = (usTime - this.usStartTime) % this.usRotationTime;
      rotationProgress = delta / this.usRotationTime;
    }
    position = (position + rotationProgress) % 1;
    position = (position / this.bucketWidth) % 1;
    return this.isBeamInOnWindow(position, rotationProgress);
  }  
  isBeamInOnWindow(position, rotationProgress) {
    if (position < .5) {
      return true;
    } else {
      return false;
    }   
  }
  isFinished() {
    return this.usLastTime >= this.usDisplayTime + this.usStartTime;
  }
}

class ReverseSunrayEffect extends SunrayEffect {
  isLaserOn(position, usStartTime) {
    return super.isLaserOn(1 - position, usStartTime);
  }
  isBeamInOnWindow(position) {
    if (position < .5) {
      return false;
    } else {
      return true;
    }   
  }
}

class CoverEffect extends EmptyEffect {
  constructor(usDisplayTime) {
    super(usDisplayTime);
    this.usDisplayTime = usDisplayTime;
  }
  isLaserOn(position, usTime) {
    this.usLastTime = usTime;
    const delta = (usTime - this.usStartTime) % this.usDisplayTime;
    const rotationProgress = delta / this.usDisplayTime;
    if (position < rotationProgress) {
      return true;
    }
    return false;
  }  
}

class UncoverEffect extends EmptyEffect {
  constructor(usDisplayTime) {
    super(usDisplayTime);
    this.usDisplayTime = usDisplayTime;
  }
  isLaserOn(position, usTime) {
    this.usLastTime = usTime;
    const delta = (usTime - this.usStartTime) % this.usDisplayTime;
    const rotationProgress = delta / this.usDisplayTime;
    if (position < rotationProgress) {
      return false;
    }
    return true;
  }  
}

class OpeningSunrayEffect extends SunrayEffect {
  isBeamInOnWindow(position, rotationProgress) {
    const delta = (this.usLastTime - this.usStartTime) % this.usDisplayTime;
    const displayProgress = (delta / this.usDisplayTime) / 2;
    if ((1 - position) < displayProgress) {
      return false;
    }
    return true;
  }
}

class ClosingSunrayEffect extends SunrayEffect {
  isBeamInOnWindow(position, rotationProgress) {
    const delta = (this.usLastTime - this.usStartTime) % this.usDisplayTime;
    const displayProgress = (delta / this.usDisplayTime) / 2;
    if (position < displayProgress + 0.5) {
      return true;
    }
    return false;
  }
}

class HalfEffect extends EmptyEffect {
  isLaserOn(position, usTime) {
    return position < .5;
  }
}

class FadeAndUnfadeEffect extends EmptyEffect {
  constructor(usDisplayTime, options = {}) {    
    super(usDisplayTime);
    const {delayUs = -1, transitionUs = -1, invert = false} = options;
    this.invert = invert;
    this.fadeDurationUs = usDisplayTime;
    this.fadeDelayUs = (delayUs === -1) ? 0 * 1000 * 1000 : delayUs;
    this.transitionUs = (transitionUs === -1) ? 300 * 1000 : transitionUs;
    this.transitionProgress = this.transitionUs / this.fadeDurationUs;
    this.cycleTimeUs = this.fadeDurationUs + this.fadeDelayUs;
    this.darkWindowUs = 40 * 1000;
    this.darkWindowProgress = this.darkWindowUs / this.fadeDurationUs;
    this.dimFn = ldim;
  }
  isLaserOn(position, usTime) {
    const usNow = window.performance.now() * 1000;
    const elapsedUs = usNow - this.usStartTime;
    const curCycleUs = elapsedUs % this.cycleTimeUs;
    if (curCycleUs < this.fadeDelayUs) {
      // not currently shimmering
      return true;
    }
    const shimmerCycleUs = curCycleUs - this.fadeDelayUs;
    const curShimmerProgress = shimmerCycleUs / this.fadeDurationUs;
    let x, p;
    if (curShimmerProgress > (this.transitionProgress + this.darkWindowProgress)) {
      // gradually increase intensity
      const windowSize = 1 - this.transitionProgress - this.darkWindowProgress;
      const windowStart = this.transitionProgress + this.darkWindowProgress;
      const windowProgress = (curShimmerProgress - windowStart) / windowSize;
      return tdim(1 - windowProgress);
    } else if (curShimmerProgress < (this.transitionProgress - this.darkWindowProgress)) {
      const windowSize = this.transitionProgress - this.darkWindowProgress;
      const windowStart = 0;
      const windowProgress = (curShimmerProgress - windowStart) / windowSize;
      // gradually decrease intensity
      return tdim(windowProgress);
    } else {
      return tdim(1);
    }
  }
}

// Brightest at position = 0
// Darkest at position = 1
function tdim(position) {
  const cliff = 0.8 * Math.PI / 2;
  let x = cliff * position;
  const p = Math.tan(x)/Math.tan(cliff);
  return (1-p) > Math.random();
}

function ldim(position) {
  return position > Math.random();
}

class CompositeEffect extends EmptyEffect {
  constructor(usDisplayTime) {
    super(usDisplayTime);
    this.effects = [];
    this.currentEffectPos = -1;
  }
  addEffect(effect) {
    this.effects.push(effect);
  }
  getNextEffect() {
    this.currentEffectPos++;
    return this.effects[this.currentEffectPos % this.effects.length];
  }
  isLaserOn(position, usTime) {
    if (!this.effect || this.effect.isFinished(usTime)) {
      this.effect = this.getNextEffect();
      this.effect.setup(position, usTime);
    }
    return this.effect.isLaserOn(position, usTime);
  }
}

class BeatEffect extends CompositeEffect {
  constructor(bpm, beatCount, useFade = false) {
    const beatIntervalUs = (60 / bpm) * 1000 * 1000;
    if (useFade) {
      super(beatIntervalUs * beatCount);
      const fadeOptions = {
        delayUs: 0,
        transitionUs: beatIntervalUs / 3
      };
      for (let i = 0; i < bpm; i++) {
        this.addEffect(new FadeAndUnfadeEffect(beatIntervalUs, fadeOptions));
      }
    } else {
      super(beatIntervalUs * (beatCount + 1));
      const beatFlashDurationUs = 300 * 1000; // 200 ms
      for (let i = 0; i < bpm + 1; i++) {
        this.addEffect(new FullEffect(beatFlashDurationUs / 2));
        this.addEffect(new EmptyEffect(beatIntervalUs - beatFlashDurationUs));
        this.addEffect(new FullEffect(beatFlashDurationUs));
      }
    }
  }
}
