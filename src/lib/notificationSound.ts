export const NOTIFICATION_SOUND_URL =
  'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

const SOUND_PREF_KEY = 'hatly_notification_sound_enabled_v1';

let sharedAudio: HTMLAudioElement | null = null;
let lastPlayedAt = 0;

function getAudioElement(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') {
    return null;
  }
  if (!sharedAudio) {
    sharedAudio = new Audio(NOTIFICATION_SOUND_URL);
    sharedAudio.preload = 'auto';
    sharedAudio.volume = 0.85;
  }
  return sharedAudio;
}

export function isNotificationSoundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_PREF_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function setNotificationSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SOUND_PREF_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore storage errors
  }
}

export interface PlaySoundResult {
  played: boolean;
  blocked: boolean;
}

/**
 * Plays the Hatly order notification alert sound via HTML5 Audio API.
 * Handles browser autoplay restrictions gracefully by reporting `blocked: true`
 * when the browser denies playback prior to a user gesture.
 */
export async function playNotificationSound(options?: {
  force?: boolean;
}): Promise<PlaySoundResult> {
  if (!options?.force && !isNotificationSoundEnabled()) {
    return { played: false, blocked: false };
  }

  const now = Date.now();
  if (!options?.force && now - lastPlayedAt < 1200) {
    return { played: false, blocked: false };
  }

  const audio = getAudioElement();
  if (!audio) {
    return { played: false, blocked: false };
  }

  try {
    audio.pause();
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      await playPromise;
    }
    lastPlayedAt = Date.now();
    return { played: true, blocked: false };
  } catch (err) {
    const errorName = err instanceof Error ? err.name : '';
    const isAutoplayBlocked =
      errorName === 'NotAllowedError' ||
      errorName === 'AbortError' ||
      String(err).toLowerCase().includes('not allowed') ||
      String(err).toLowerCase().includes('user didn\'t interact');

    console.warn('[Hatly Notifications] Audio playback blocked or failed:', err);
    return { played: false, blocked: isAutoplayBlocked || true };
  }
}

/**
 * Called directly from a user tap/click to unlock HTML5 audio autoplay
 * and confirm sound playback.
 */
export async function enableAndTestNotificationSound(): Promise<boolean> {
  setNotificationSoundEnabled(true);
  const res = await playNotificationSound({ force: true });
  return res.played;
}
