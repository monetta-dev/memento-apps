import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SessionHeader from '@/components/session/SessionHeader';

describe('SessionHeader', () => {
  const mockSubordinate = {
    id: 'sub-123',
    name: 'John Doe',
  };

  const mockSessionData = {
    id: 'session-456',
    theme: 'Performance Review',
    mode: 'web' as const,
    subordinateId: 'sub-123',
  };

  it('should render with subordinate and session data', () => {
    render(<SessionHeader subordinate={mockSubordinate} sessionData={mockSessionData} />);

    expect(screen.getByText(/1on1 with John Doe/i)).toBeInTheDocument();
    expect(screen.getByText('Performance Review')).toBeInTheDocument();
    expect(screen.getByText('Web Mode')).toBeInTheDocument();
    expect(screen.getByText(new Date().toDateString())).toBeInTheDocument();
  });

  it('should render with default text when subordinate is missing', () => {
    render(<SessionHeader sessionData={mockSessionData} />);

    expect(screen.getByText(/1on1 with Subordinate/i)).toBeInTheDocument();
    expect(screen.getByText('Performance Review')).toBeInTheDocument();
    expect(screen.getByText('Web Mode')).toBeInTheDocument();
  });

  it('should render with default text when session data is missing', () => {
    render(<SessionHeader subordinate={mockSubordinate} />);

    expect(screen.getByText(/1on1 with John Doe/i)).toBeInTheDocument();
    expect(screen.getByText(new Date().toDateString())).toBeInTheDocument();
    // Theme tag should not be present
    expect(screen.queryByText('Performance Review')).not.toBeInTheDocument();
  });

  it('should render face-to-face mode correctly', () => {
    const faceToFaceSessionData = {
      ...mockSessionData,
      mode: 'face-to-face' as const,
    };
    render(<SessionHeader subordinate={mockSubordinate} sessionData={faceToFaceSessionData} />);

    expect(screen.getByText('Face-to-Face')).toBeInTheDocument();
    expect(screen.queryByText('Web Mode')).not.toBeInTheDocument();
  });

  it('should render without any props', () => {
    render(<SessionHeader />);

    expect(screen.getByText(/1on1 with Subordinate/i)).toBeInTheDocument();
    expect(screen.getByText(new Date().toDateString())).toBeInTheDocument();
  });
});