'use client';

import React from 'react';
import LiveKitComponent from '@/components/LiveKitComponent';

interface SessionData {
  id: string;
  theme: string;
  mode: 'web' | 'face-to-face';
  subordinateId: string;
}

interface VideoPanelProps {
  sessionData?: SessionData;
  micOn?: boolean;
  remoteAudioStream?: MediaStream | null;
  onTranscript?: (text: string, speaker: 'manager' | 'subordinate') => void;
  onRemoteAudioTrack: (stream: MediaStream | null) => void;
  username?: string;
}

const VideoPanel: React.FC<VideoPanelProps> = ({
  sessionData,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  micOn: _micOn,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  remoteAudioStream: _remoteAudioStream,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onTranscript: _onTranscript,
  onRemoteAudioTrack,
   username = "マネージャー",
}) => {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000' }}>
      {sessionData ? (
        <LiveKitComponent
          roomName={`session-${sessionData.id}`}
          username={username}
          mode={sessionData.mode}
          onRemoteAudioTrack={onRemoteAudioTrack}
        />
      ) : (
        <div style={{ color: '#fff', textAlign: 'center', marginTop: 100 }}>
           セッションを初期化中...
        </div>
      )}
    </div>
  );
};

export default VideoPanel;