// Count elapsed playback, not clicks, seek jumps, buffering or playback-rate changes.
export class PlaybackMeter {
  constructor() { this.seconds = 0; this.previous = null; }
  resetSample() { this.previous = null; }
  sample(media, now) {
    if (media.paused || media.seeking || media.ended || media.readyState < 3) {
      this.resetSample(); return this.seconds;
    }
    const current = { time: media.currentTime, wall: now, rate: media.playbackRate };
    if (this.previous) {
      const wall = (now - this.previous.wall) / 1000;
      const played = (current.time - this.previous.time) / current.rate;
      if (wall > 0 && wall <= 2 && played > 0 && played <= wall + 0.15 && current.rate === this.previous.rate) {
        this.seconds += Math.min(wall, played);
      }
    }
    this.previous = current;
    return this.seconds;
  }
}
