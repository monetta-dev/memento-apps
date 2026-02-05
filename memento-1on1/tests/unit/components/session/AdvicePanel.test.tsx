import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdvicePanel from '@/components/session/AdvicePanel';

describe('AdvicePanel', () => {
  it('should render with real-time advice', () => {
    const testAdvice = 'Consider asking open-ended questions to encourage discussion.';
    render(<AdvicePanel realTimeAdvice={testAdvice} />);

    expect(screen.getByText('Real-time Advice')).toBeInTheDocument();
    expect(screen.getByText(testAdvice)).toBeInTheDocument();
    
    // Should have info alert type
    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('ant-alert-info');
  });

  it('should render with empty advice', () => {
    render(<AdvicePanel realTimeAdvice="" />);

    expect(screen.getByText('Real-time Advice')).toBeInTheDocument();
    // Description may be empty but still present
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
  });

  it('should render with long advice text', () => {
    const longAdvice = 'This is a very long piece of advice that might contain multiple sentences and detailed recommendations for the manager to follow during the conversation. It should be displayed properly within the alert component.';
    render(<AdvicePanel realTimeAdvice={longAdvice} />);

    expect(screen.getByText(longAdvice)).toBeInTheDocument();
  });

  it('should have bulb icon', () => {
    render(<AdvicePanel realTimeAdvice="Test advice" />);

    // The icon is a BulbOutlined which renders as an icon with aria-label "bulb"
    // Ant Design icons have role="img"
    const icon = screen.getByRole('img', { hidden: true });
    expect(icon).toBeInTheDocument();
  });
});