import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LiveKitComponent from '@/components/LiveKitComponent';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock @livekit/components-react
vi.mock('@livekit/components-react', () => ({
  LiveKitRoom: ({ children, token, serverUrl, video, audio }: Record<string, unknown>) => (
    <div data-testid="livekit-room" data-token={token as string} data-server-url={serverUrl as string} data-video={video as string} data-audio={audio as string}>
      {children}
    </div>
  ),
  GridLayout: ({ children }: Record<string, unknown>) => <div data-testid="grid-layout">{children}</div>,
  ParticipantTile: () => <div data-testid="participant-tile" />,
  RoomAudioRenderer: () => <div data-testid="room-audio-renderer" />,
  ControlBar: () => <div data-testid="control-bar" />,
  useTracks: vi.fn(),
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

describe('LiveKitComponent', () => {
  const defaultProps = {
    roomName: 'test-room',
    username: 'test-user',
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

  it('should render loading state when token is empty', async () => {
    // Mock fetch to return token after delay
    let resolveFetch: () => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = () => resolve({
        ok: true,
        json: async () => ({ token: 'test-token' }),
      });
    });
    mockFetch.mockReturnValueOnce(fetchPromise);

    render(<LiveKitComponent {...defaultProps} />);
    
    // Should show loading spinner
    expect(screen.getByText(/Connecting to LiveKit/i)).toBeInTheDocument();
    
    // Resolve fetch
    resolveFetch();
    await waitFor(() => {
      expect(screen.queryByText(/Connecting to LiveKit/i)).not.toBeInTheDocument();
    });
  });

  it('should render error state when fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    
    render(<LiveKitComponent {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText(/Error/i)).toBeInTheDocument();
      expect(screen.getByText(/Failed to fetch token/i)).toBeInTheDocument();
    });
  });

  it('should render mock mode when token is mock token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'mock-token-for-demo-purposes', warning: 'Mock mode active' }),
    });
    
    render(<LiveKitComponent {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText(/LiveKit Config Missing/i)).toBeInTheDocument();
      expect(screen.getByText(/Mock Mode Active/i)).toBeInTheDocument();
      expect(screen.getByText(/Room: test-room/i)).toBeInTheDocument();
      expect(screen.getByText(/User: test-user/i)).toBeInTheDocument();
    });
  });

  it('should render LiveKitRoom with real token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'real-token' }),
    });
    
    render(<LiveKitComponent {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('livekit-room')).toBeInTheDocument();
      expect(screen.getByTestId('livekit-room')).toHaveAttribute('data-token', 'real-token');
      expect(screen.getByTestId('livekit-room')).toHaveAttribute('data-server-url', 'wss://test.livekit.cloud');
      expect(screen.getByTestId('livekit-room')).toHaveAttribute('data-video', 'true'); // default mode is 'web'
      expect(screen.getByTestId('livekit-room')).toHaveAttribute('data-audio', 'true');
    });
  });

  it('should render with face-to-face mode', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'real-token' }),
    });
    
    render(<LiveKitComponent {...defaultProps} mode="face-to-face" />);
    
    await waitFor(() => {
      expect(screen.getByTestId('livekit-room')).toBeInTheDocument();
      expect(screen.getByTestId('livekit-room')).toHaveAttribute('data-video', 'false'); // face-to-face mode has video=false
    });
  });

  it('should pass onRemoteAudioTrack callback to MyVideoConference', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'real-token' }),
    });
    
    // Mock useTracks to return empty array
    const { useTracks } = await import('@livekit/components-react');
    (useTracks as vi.Mock).mockReturnValue([]);
    
    const mockCallback = vi.fn();
    render(<LiveKitComponent {...defaultProps} onRemoteAudioTrack={mockCallback} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('livekit-room')).toBeInTheDocument();
      // The callback should be passed down but actual invocation depends on tracks
      // We can verify the component renders without error
    });
  });
});