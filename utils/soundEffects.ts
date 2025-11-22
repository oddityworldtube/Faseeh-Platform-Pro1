
// Sound URLs (compatible formats & reliable CDN)
// Note: Use widely-supported formats and enable crossOrigin for CDN-hosted files.
const SOUNDS = {
  CLICK: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3', // Pop
  SUCCESS: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3', // Chime
  ERROR: 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3', // Buzz
  CORRECT: 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3', // Win
  WRONG: 'https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3', // Fail
  HOVER: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3', // Soft tick
};

type SoundType = keyof typeof SOUNDS;

class SoundManager {
  private audioCache: Record<string, HTMLAudioElement> = {};
  private enabled: boolean = true;

  constructor() {
    // Preload sounds
    if (typeof window !== 'undefined') {
      Object.values(SOUNDS).forEach(url => {
        const audio = new Audio();
        audio.src = url;
        audio.preload = 'auto';
        audio.crossOrigin = 'anonymous';
        audio.volume = 0.45;
        // Load the audio into browser cache
        audio.load();
        this.audioCache[url] = audio;
      });
    }
  }

  play(type: SoundType) {
    if (!this.enabled) return;
    const url = SOUNDS[type];
    const original = this.audioCache[url];
    if (original) {
      // Clone to allow overlapping plays and avoid locking the original element
      const clone = original.cloneNode(true) as HTMLAudioElement;
      clone.currentTime = 0;
      clone.play().catch(e => {
        // Commonly fails when not triggered by user gesture; silently ignore
        console.debug('Audio play failed', e);
      });
    }
  }

  toggle(state: boolean) {
    this.enabled = state;
  }
}

export const soundManager = new SoundManager();
