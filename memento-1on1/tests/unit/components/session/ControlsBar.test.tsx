import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ControlsBar from '@/components/session/ControlsBar';

describe('ControlsBar', () => {
  const mockSetMicOn = vi.fn();
  const mockSetIsMindMapMode = vi.fn();
  const mockHandleEndSession = vi.fn();

  const defaultProps = {
    micOn: true,
    setMicOn: mockSetMicOn,
    isMindMapMode: false,
    setIsMindMapMode: mockSetIsMindMapMode,
    handleEndSession: mockHandleEndSession,
    isEnding: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with microphone on', () => {
    render(<ControlsBar {...defaultProps} />);

    // Mic button should show audio icon (mic on)
    expect(screen.getByRole('button', { name: 'audio' })).toBeInTheDocument();
    expect(screen.getByText('Switch to MindMap')).toBeInTheDocument();
    expect(screen.getByText('End Session')).toBeInTheDocument();
  });

  it('should render with microphone off', () => {
    render(<ControlsBar {...defaultProps} micOn={false} />);

    // Mic button should show audio muted icon
    expect(screen.getByRole('button', { name: 'audio-muted' })).toBeInTheDocument();
  });

  it('should render in mind map mode', () => {
    render(<ControlsBar {...defaultProps} isMindMapMode={true} />);

    expect(screen.getByText('Switch to Video')).toBeInTheDocument();
  });

  it('should call setMicOn when microphone button is clicked', async () => {
    const user = userEvent.setup();
    render(<ControlsBar {...defaultProps} />);

    const micButton = screen.getByRole('button', { name: 'audio' });
    await user.click(micButton);

    expect(mockSetMicOn).toHaveBeenCalledWith(false);
  });

  it('should call setIsMindMapMode when mode switch button is clicked', async () => {
    const user = userEvent.setup();
    render(<ControlsBar {...defaultProps} />);

    const modeButton = screen.getByText('Switch to MindMap');
    await user.click(modeButton);

    expect(mockSetIsMindMapMode).toHaveBeenCalledWith(true);
  });

  it('should call handleEndSession when end session button is clicked', async () => {
    const user = userEvent.setup();
    render(<ControlsBar {...defaultProps} />);

    const endSessionButton = screen.getByText('End Session');
    await user.click(endSessionButton);

    expect(mockHandleEndSession).toHaveBeenCalled();
  });

  it('should show loading state on end session button when isEnding is true', () => {
    render(<ControlsBar {...defaultProps} isEnding={true} />);

    const endSessionButton = screen.getByRole('button', { name: /End Session/i });
    expect(endSessionButton).toHaveClass('ant-btn-loading');
  });

  it('should disable buttons when isEnding is true', () => {
    render(<ControlsBar {...defaultProps} isEnding={true} />);

    const micButton = screen.getByRole('button', { name: 'audio' });
    const modeButton = screen.getByRole('button', { name: /Switch to MindMap/i });
    const endSessionButton = screen.getByRole('button', { name: /End Session/i });

    // In Ant Design, loading button has ant-btn-loading class
    expect(endSessionButton).toHaveClass('ant-btn-loading');
    // Other buttons should not have loading class
    expect(micButton).not.toHaveClass('ant-btn-loading');
    expect(modeButton).not.toHaveClass('ant-btn-loading');
  });
});