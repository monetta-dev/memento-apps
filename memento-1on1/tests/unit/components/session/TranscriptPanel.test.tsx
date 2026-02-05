import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TranscriptPanel, { TranscriptMessage } from '@/components/session/TranscriptPanel';

describe('TranscriptPanel', () => {
  const mockMessages: TranscriptMessage[] = [
    { speaker: 'manager', text: 'Hello, how are you?', time: '10:00 AM' },
    { speaker: 'subordinate', text: 'I am doing well, thank you.', time: '10:01 AM' },
    { speaker: 'manager', text: 'Great to hear that.', time: '10:02 AM' },
  ];

  const mockLogEndRef = {
    current: document.createElement('div'),
  };

  const defaultProps = {
    messages: mockMessages,
    logEndRef: mockLogEndRef as React.RefObject<HTMLDivElement>,
  };

  it('should render with messages', () => {
    render(<TranscriptPanel {...defaultProps} />);

    expect(screen.getByText(/Live Transcript/i)).toBeInTheDocument();
    expect(screen.getByText('Hello, how are you?')).toBeInTheDocument();
    expect(screen.getByText('I am doing well, thank you.')).toBeInTheDocument();
    expect(screen.getByText('Great to hear that.')).toBeInTheDocument();
    
    // Should show timestamps
    expect(screen.getByText('10:00 AM')).toBeInTheDocument();
    expect(screen.getByText('10:01 AM')).toBeInTheDocument();
    expect(screen.getByText('10:02 AM')).toBeInTheDocument();
  });

  it('should render manager messages with blue background', () => {
    render(<TranscriptPanel {...defaultProps} />);

    const managerMessages = screen.getAllByText(/Hello|Great/);
    managerMessages.forEach(message => {
      const messageContainer = message.closest('div');
      expect(messageContainer).toHaveStyle('background: #1890ff');
      expect(messageContainer).toHaveStyle('color: #fff');
    });
  });

  it('should render subordinate messages with gray background', () => {
    render(<TranscriptPanel {...defaultProps} />);

    const subordinateMessage = screen.getByText('I am doing well, thank you.');
    const messageContainer = subordinateMessage.closest('div');
    expect(messageContainer).toHaveStyle('background: #f0f0f0');
    expect(messageContainer).toHaveStyle('color: #000');
  });

  it('should align manager messages to the right', () => {
    render(<TranscriptPanel {...defaultProps} />);

    const managerMessages = screen.getAllByText(/Hello|Great/);
    managerMessages.forEach(message => {
      const flexContainer = message.closest('.ant-flex');
      expect(flexContainer).toHaveStyle('align-items: flex-end');
    });
  });

  it('should align subordinate messages to the left', () => {
    render(<TranscriptPanel {...defaultProps} />);

    const subordinateMessage = screen.getByText('I am doing well, thank you.');
    const flexContainer = subordinateMessage.closest('.ant-flex');
    expect(flexContainer).toHaveStyle('align-items: flex-start');
  });

  it('should render empty state when no messages', () => {
    render(<TranscriptPanel messages={[]} logEndRef={mockLogEndRef as React.RefObject<HTMLDivElement>} />);

    expect(screen.getByText(/Waiting for conversation/i)).toBeInTheDocument();
    expect(screen.getByText('Waiting for conversation... (Speak into microphone)')).toBeInTheDocument();
    expect(screen.queryByText('Hello, how are you?')).not.toBeInTheDocument();
  });

  it('should handle custom speaker names', () => {
    const customMessages: TranscriptMessage[] = [
      { speaker: 'other', text: 'Custom speaker message', time: '10:03 AM' },
    ];
    
    render(<TranscriptPanel messages={customMessages} logEndRef={mockLogEndRef as React.RefObject<HTMLDivElement>} />);

    expect(screen.getByText('Custom speaker message')).toBeInTheDocument();
    // Custom speaker should be treated as subordinate (default styling)
    const messageContainer = screen.getByText('Custom speaker message').closest('div');
    expect(messageContainer).toHaveStyle('background: #f0f0f0');
  });


});