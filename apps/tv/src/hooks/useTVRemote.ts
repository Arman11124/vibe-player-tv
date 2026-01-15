
import { useTVEventHandler } from 'react-native';

export type TVEvent = 'up' | 'down' | 'left' | 'right' | 'select' | 'playPause' | 'back' | 'menu' | 'unknown';

export const useTVRemote = (callback: (event: TVEvent) => void) => {
    const handleEvent = (evt: { eventType: string }) => {
        if (!evt || !evt.eventType) return;

        let type: TVEvent = 'unknown';
        const raw = evt.eventType.toLowerCase();

        if (raw === 'right') type = 'right';
        else if (raw === 'left') type = 'left';
        else if (raw === 'up') type = 'up';
        else if (raw === 'down') type = 'down';
        else if (['select', 'dpadcenter', 'enter'].includes(raw)) type = 'select';
        else if (raw === 'playpause') type = 'playPause';
        else if (raw === 'back' || raw === 'hardwarebackpress') type = 'back';
        else if (raw === 'menu') type = 'menu';

        callback(type);
    };

    // @ts-ignore - useTVEventHandler type definition might be missing in some setups
    useTVEventHandler(handleEvent);
};
