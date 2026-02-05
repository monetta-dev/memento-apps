import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import VideoPanel from '@/components/session/VideoPanel';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock MediaStream
global.MediaStream = vi.fn(() => ({
  getAudioTracks: vi.fn(() => []),
  getTracks: vi.fn(() => []),
}));

// Mock for useTracks
const { useTracksMock } = vi.hoisted(() => ({
  useTracksMock: vi.fn(() => []),
}));

// Mock TranscriptionHandler
vi.mock('@/components/TranscriptionHandler', () => ({
  default: ({ isMicOn, onTranscript, remoteAudioStream }: Record<string, unknown>) => (
    <div 
      data-testid="transcription-handler" 
      data-mic-on={isMicOn as boolean}
      data-has-remote-stream={!!remoteAudioStream}
    >
      TranscriptionHandler
      {onTranscript && <button onClick={() => (onTranscript as (text: string, speaker: string) => void)('test transcript', 'manager')}>Simulate transcript</button>}
    </div>
  ),
}));

// Mock @livekit/components-react
vi.mock('@livekit/components-react', () => ({
  LiveKitRoom: ({ children, token, serverUrl, video, audio }: Record<string, unknown>) => (
    <div 
      data-testid="livekit-room" 
      data-token={token as string} 
      data-server-url={serverUrl as string} 
      data-video={video as string} 
      data-audio={audio as string}
    >
      {children}
    </div>
  ),
  GridLayout: ({ children }: Record<string, unknown>) => <div data-testid="grid-layout">{children}</div>,
  ParticipantTile: () => <div data-testid="participant-tile" />,
  RoomAudioRenderer: () => <div data-testid="room-audio-renderer" />,
  ControlBar: () => <div data-testid="control-bar" />,
  useTracks: useTracksMock,
  useParticipants: vi.fn(() => []),
}));

// Mock @livekit/components-styles (CSS import)
vi.mock('@livekit/components-styles', () => ({}));

// Mock livekit-client
vi.mock('livekit-client', () => ({
  Track: {
    Source: {
      Camera: 'camera',
      ScreenShare: 'screen_share',
      Microphone: 'microphone',
    },
  },
}));

describe('VideoPanel', () => {
  const mockSessionData = {
    id: 'session-123',
    theme: 'Performance Review',
    mode: 'web' as const,
    subordinateId: 'sub-456',
  };

  const defaultProps = {
    micOn: true,
    remoteAudioStream: null,
    onTranscript: vi.fn(),
    onRemoteAudioTrack: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock fetch response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'test-token' }),
    });
    // Mock environment variable
    process.env.NEXT_PUBLIC_LIVEKIT_URL = 'wss://test.livekit.cloud';
  });

  it('should render with session data', async () => {
    render(<VideoPanel sessionData={mockSessionData} {...defaultProps} />);

    // Should show transcription handler
    expect(screen.getByTestId('transcription-handler')).toBeInTheDocument();
    
    // Should show loading state initially (token empty)
    expect(screen.getByText(/Connecting to LiveKit/i)).toBeInTheDocument();
    
    // Wait for token fetch and LiveKitRoom to render
    await waitFor(() => {
      expect(screen.getByTestId('livekit-room')).toBeInTheDocument();
    });
  });

  it('should render without session data', () => {
    render(<VideoPanel {...defaultProps} />);

    // Should show initialization message
    expect(screen.getByText(/Initializing Session/i)).toBeInTheDocument();
    // Should not show LiveKitRoom (no session data)
    expect(screen.queryByTestId('livekit-room')).not.toBeInTheDocument();
    // Should still show transcription handler
    expect(screen.getByTestId('transcription-handler')).toBeInTheDocument();
  });

  it('should pass micOn prop to TranscriptionHandler', async () => {
    render(<VideoPanel sessionData={mockSessionData} {...defaultProps} micOn={false} />);

    const transcriptionHandler = screen.getByTestId('transcription-handler');
    expect(transcriptionHandler).toHaveAttribute('data-mic-on', 'false');
  });

  it('should pass remoteAudioStream prop to TranscriptionHandler', async () => {
    const mockStream = new MediaStream();
    render(
      <VideoPanel 
        sessionData={mockSessionData} 
        {...defaultProps} 
        remoteAudioStream={mockStream} 
      />
    );

    const transcriptionHandler = screen.getByTestId('transcription-handler');
    expect(transcriptionHandler).toHaveAttribute('data-has-remote-stream', 'true');
  });

  it('should call onTranscript when TranscriptionHandler triggers it', async () => {
    const mockOnTranscript = vi.fn();
    render(
      <VideoPanel 
        sessionData={mockSessionData} 
        {...defaultProps} 
        onTranscript={mockOnTranscript} 
      />
    );

    // Wait for LiveKitRoom to render
    await waitFor(() => {
      expect(screen.getByTestId('livekit-room')).toBeInTheDocument();
    });

    // Find and click the simulate transcript button
    const simulateButton = screen.getByText('Simulate transcript');
    simulateButton.click();

    expect(mockOnTranscript).toHaveBeenCalledWith('test transcript', 'manager');
  });

  it('should pass onRemoteAudioTrack callback to LiveKitComponent', async () => {
    const mockOnRemoteAudioTrack = vi.fn();
    render(
      <VideoPanel 
        sessionData={mockSessionData} 
        {...defaultProps} 
        onRemoteAudioTrack={mockOnRemoteAudioTrack} 
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('livekit-room')).toBeInTheDocument();
    });
    
    // The callback should be passed to LiveKitComponent (via MyVideoConference)
    // Since we mocked LiveKitRoom, we can't directly test the prop passing
    // but we can verify the component renders without errors
    expect(screen.getByTestId('transcription-handler')).toBeInTheDocument();
  });

  it('should handle face-to-face mode', async () => {
    const faceToFaceSessionData = {
      ...mockSessionData,
      mode: 'face-to-face' as const,
    };
    
    render(<VideoPanel sessionData={faceToFaceSessionData} {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('livekit-room')).toBeInTheDocument();
      // face-to-face mode should have video=false
      expect(screen.getByTestId('livekit-room')).toHaveAttribute('data-video', 'false');
    });
  });

  it('should show mock token UI when token is mock', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'mock-token-for-demo-purposes', warning: 'Mock mode active' }),
    });

    render(<VideoPanel sessionData={mockSessionData} {...defaultProps} />);

    // Wait for token fetch and mock mode UI
    await waitFor(() => {
      expect(screen.getByText(/LiveKit Config Missing/i)).toBeInTheDocument();
      expect(screen.getByText(/Mock Mode Active/i)).toBeInTheDocument();
    });
  });
});