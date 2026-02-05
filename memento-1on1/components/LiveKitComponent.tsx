'use client';

import React, { useEffect, useState } from 'react';
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
  useParticipants,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';
import { Spin, Alert } from 'antd';

interface LiveKitComponentProps {
  roomName: string;
  username: string;
  mode?: 'web' | 'face-to-face';
  onRemoteAudioTrack?: (stream: MediaStream | null) => void;
}

export default function LiveKitComponent({ roomName, username, mode = 'web', onRemoteAudioTrack }: LiveKitComponentProps) {
  const [token, setToken] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        console.log('Fetching LiveKit token for room:', roomName, 'username:', username);
        const resp = await fetch(
          `/api/livekit/token?room=${roomName}&username=${encodeURIComponent(username)}`
        );
        const data = await resp.json();
        console.log('LiveKit token response:', { hasToken: !!data.token, hasWarning: !!data.warning });

        if (data.token === 'mock-token-for-demo-purposes' || data.warning) {
          console.warn(data.warning);
          // If we get a mock token, we can't really connect to LiveKit Cloud.
          // We will handle this gracefully in the UI.
        }

        setToken(data.token);
      } catch (e) {
        console.error(e);
        setError('トークンの取得に失敗しました');
      }
    })();
  }, [roomName, username]);

  if (error) {
    return <Alert message="エラー" description={error} type="error" showIcon />;
  }

  if (token === '') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
         <Spin>LiveKitに接続中...</Spin>
      </div>
    );
  }

  // Handle Mock Token Scenario
  if (token === 'mock-token-for-demo-purposes') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', background: '#111', color: '#fff' }}>
         <h2>LiveKit設定がありません</h2>
         <p>.env.localファイルでLIVEKIT_API_KEYとLIVEKIT_API_SECRETを設定して、実際のビデオ通話を有効にしてください。</p>
         <div style={{ padding: 20, border: '1px dashed #666', borderRadius: 8, marginTop: 20 }}>
           <p><strong>モックモード有効:</strong></p>
          <p>Room: {roomName}</p>
          <p>User: {username}</p>
        </div>
      </div>
    );
  }

  const handleConnected = () => {
    console.log('LiveKit room connected');
  };

  const handleDisconnected = () => {
    console.log('LiveKit room disconnected');
  };

  return (
    <LiveKitRoom
      video={mode === 'web'}
      audio={true}
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      data-lk-theme="default"
      style={{ height: '100%' }}
      onConnected={handleConnected}
      onDisconnected={handleDisconnected}
    >
      <MyVideoConference username={username} onRemoteAudioTrack={onRemoteAudioTrack} />
      <RoomAudioRenderer />
      <ControlBar />
    </LiveKitRoom>
  );
}

function MyVideoConference({ username, onRemoteAudioTrack }: { 
  username: string;
  onRemoteAudioTrack?: (stream: MediaStream | null) => void 
}) {
  // Use custom layout or default VideoConference component
  // Here we use a standard grid layout for simplicity
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
      { source: Track.Source.Microphone, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const participants = useParticipants();

  console.log('MyVideoConference participants:', participants.map(p => ({
    identity: p.identity,
    sid: p.sid,
    trackPublicationCount: p.trackPublications.size,
    // tracks: [...p.trackPublications.values()].map(t => ({ kind: t.kind, trackSid: t.trackSid }))
  })));
  console.log('MyVideoConference tracks:', tracks.map(t => ({
    source: t.source,
    participant: t.participant?.identity,
    subscribed: t.publication?.isSubscribed,
    trackSid: t.publication?.trackSid
  })));

  const prevTrackSids = React.useRef<string>('');

  // Effect to extract remote audio tracks and create MediaStream
  useEffect(() => {
    if (!onRemoteAudioTrack) return;

    const remoteAudioTracks = tracks.filter(
      track => track.source === Track.Source.Microphone && track.participant?.identity !== username
    );

    // Create a unique signature for the current tracks to avoid unnecessary updates
    const currentTrackSids = remoteAudioTracks
      .map(t => t.publication?.trackSid || t.participant.identity)
      .sort()
      .join(',');

    // Check if tracks have actually changed
    if (currentTrackSids === prevTrackSids.current && (currentTrackSids !== '' || remoteAudioTracks.length === 0)) {
      return;
    }

    prevTrackSids.current = currentTrackSids;

    if (remoteAudioTracks.length > 0) {
      // Create a MediaStream from remote audio tracks
      const stream = new MediaStream();
      remoteAudioTracks.forEach(track => {
        // @ts-expect-error: LiveKit track type does not expose mediaStreamTrack directly
        if (track.mediaStreamTrack) {
          // @ts-expect-error: LiveKit track type does not expose mediaStreamTrack directly
          stream.addTrack(track.mediaStreamTrack);
        }
      });
      // Only emit if we actually added tracks
      if (stream.getAudioTracks().length > 0) {
        onRemoteAudioTrack(stream);
      } else {
        onRemoteAudioTrack(null);
      }
    } else {
      onRemoteAudioTrack(null);
    }
  }, [tracks, onRemoteAudioTrack, username]);

  return (
    <GridLayout tracks={tracks} style={{ height: 'calc(100% - var(--lk-control-bar-height))' }}>
      <ParticipantTile />
    </GridLayout>
  );
}
