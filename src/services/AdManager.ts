import axios from 'axios';

// Simple EventEmitter replacement for React Native
class SimpleEventEmitter {
    private listeners: { [key: string]: Function[] } = {};

    on(event: string, fn: Function) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(fn);
    }

    off(event: string, fn: Function) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(l => l !== fn);
    }

    removeAllListeners(event?: string) {
        if (event) {
            delete this.listeners[event];
        } else {
            this.listeners = {};
        }
    }

    emit(event: string, ...args: any[]) {
        if (!this.listeners[event]) return;
        this.listeners[event].forEach(fn => fn(...args));
    }
}

export interface AdCreative {
    id: string;
    audioUrl: string; // URL to MP3 on R2
    qrUrl: string;    // URL to PNG on R2
    cta: string;      // Call to Action text
    weight: number;   // 1-10 probability weight
}

export interface AdConfig {
    enabled: boolean;
    startDelay: number;       // Seconds before first ad
    interval: number;         // Seconds between ads
    minMovieDuration: number; // Minutes
    volumeDuckLevel: number;  // 0.0 - 1.0 (Target volume for movie)
    creatives: AdCreative[];
}

const DEFAULT_CONFIG: AdConfig = {
    enabled: true,
    startDelay: 600, // 10 minutes
    interval: 1200,  // 20 minutes
    minMovieDuration: 20,
    volumeDuckLevel: 0.2, // 20% volume
    creatives: [
        {
            id: 'default_promo',
            audioUrl: 'https://pub-f554625ae7d9498295b958c27891275d.r2.dev/audio_promo_generic.mp3', // Placeholder
            qrUrl: 'https://pub-f554625ae7d9498295b958c27891275d.r2.dev/qr_telegram.png',             // Placeholder
            cta: 'Подпишись на канал',
            weight: 10
        }
    ]
};

class AdManager extends SimpleEventEmitter {
    private static instance: AdManager;
    private config: AdConfig = DEFAULT_CONFIG;
    private timer: NodeJS.Timeout | null = null;
    private nextAdTime: number = 0;
    private isPlayingAd: boolean = false;

    private constructor() {
        super();
    }

    public static getInstance(): AdManager {
        if (!AdManager.instance) {
            AdManager.instance = new AdManager();
        }
        return AdManager.instance;
    }

    public async init(configUrl?: string) {
        if (configUrl) {
            try {
                const response = await axios.get(configUrl);
                this.config = { ...DEFAULT_CONFIG, ...response.data };
                console.log('[AdManager] Config loaded:', this.config);
            } catch (e) {
                console.warn('[AdManager] Failed to load remote config, using default', e);
            }
        }
    }

    public startSession(movieDurationMinutes: number) {
        this.stopSession(); // Clear any existing

        if (!this.config.enabled || movieDurationMinutes < this.config.minMovieDuration) {
            console.log('[AdManager] Ads disabled for this session (too short or disabled)');
            return;
        }

        console.log(`[AdManager] Session started. First ad in ${this.config.startDelay}s`);

        // Schedule first ad
        this.scheduleNextAd(this.config.startDelay);
    }

    public stopSession() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.isPlayingAd = false;
        this.removeAllListeners('ad_start');
        this.removeAllListeners('ad_end');
        console.log('[AdManager] Session stopped');
    }

    public notifyAdFinished() {
        this.isPlayingAd = false;
        this.emit('ad_end');
        console.log(`[AdManager] Ad finished. Next one in ${this.config.interval}s`);
        this.scheduleNextAd(this.config.interval);
    }

    // Dev Helper to force inject ad immediately
    public debugTriggerAd() {
        console.log('[AdManager] DEBUG: Triggering ad immediately');
        this.triggerAd();
    }

    private scheduleNextAd(delaySeconds: number) {
        if (this.timer) clearTimeout(this.timer);

        this.timer = setTimeout(() => {
            this.triggerAd();
        }, delaySeconds * 1000);
    }

    private triggerAd() {
        if (this.isPlayingAd) return;

        const creative = this.selectCreative();
        if (!creative) return;

        this.isPlayingAd = true;
        console.log('[AdManager] Starting Ad Break:', creative.id);

        this.emit('ad_start', {
            creative,
            duckLevel: this.config.volumeDuckLevel
        });
    }

    private selectCreative(): AdCreative | null {
        if (!this.config.creatives || this.config.creatives.length === 0) return null;

        // Simple weighted random (or just random for now if weights equal)
        const randomIndex = Math.floor(Math.random() * this.config.creatives.length);
        return this.config.creatives[randomIndex];
    }
}

export default AdManager.getInstance();
