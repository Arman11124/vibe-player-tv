import React, { useRef, useEffect } from 'react';
import Video, { VideoRef } from 'react-native-video';

interface Props {
    sourceUrl: string;
    isPlaying: boolean;
    onEnd: () => void;
}

export const AdAudioPlayer: React.FC<Props> = ({ sourceUrl, isPlaying, onEnd }) => {
    const videoRef = useRef<VideoRef>(null);

    useEffect(() => {
        if (!isPlaying) {
            // Optional: reset or stop
        }
    }, [isPlaying]);

    if (!sourceUrl) return null;

    return (
        <Video
            ref={videoRef}
            source={{ uri: sourceUrl }}
            style={{ width: 0, height: 0, position: 'absolute', opacity: 0 }} // Invisible
            paused={!isPlaying}
            volume={1.0} // Always full volume for ads
            playInBackground={false}
            ignoreSilentSwitch="ignore"
            onEnd={onEnd}
            onError={(e) => console.log('[AdAudioPlayer] Error:', e)}
        />
    );
};
