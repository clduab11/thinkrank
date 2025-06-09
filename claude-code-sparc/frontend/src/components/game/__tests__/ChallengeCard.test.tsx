import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChallengeCard } from '../ChallengeCard';

describe('ChallengeCard', () => {
  const mockChallenge = {
    id: 'test-1',
    type: 'text' as const,
    content: 'This is a sample text that could be AI or human generated.',
  };

  const mockImageChallenge = {
    id: 'test-2',
    type: 'image' as const,
    content: 'https://example.com/image.jpg',
  };

  it('renders text challenge content', () => {
    render(
      <ChallengeCard 
        challenge={mockChallenge}
        onAnswer={vi.fn()}
      />
    );
    
    expect(screen.getByText(mockChallenge.content)).toBeInTheDocument();
  });

  it('renders image challenge content', () => {
    render(
      <ChallengeCard 
        challenge={mockImageChallenge}
        onAnswer={vi.fn()}
      />
    );
    
    const image = screen.getByRole('img', { name: /ai detection challenge/i });
    expect(image).toHaveAttribute('src', mockImageChallenge.content);
  });

  it('displays answer buttons', () => {
    render(
      <ChallengeCard 
        challenge={mockChallenge}
        onAnswer={vi.fn()}
      />
    );
    
    expect(screen.getByRole('button', { name: /ai generated/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /human created/i })).toBeInTheDocument();
  });

  it('calls onAnswer with correct value when AI button clicked', () => {
    const handleAnswer = vi.fn();
    render(
      <ChallengeCard 
        challenge={mockChallenge}
        onAnswer={handleAnswer}
      />
    );
    
    fireEvent.click(screen.getByRole('button', { name: /ai generated/i }));
    
    expect(handleAnswer).toHaveBeenCalledWith(true, undefined);
  });

  it('calls onAnswer with correct value when Human button clicked', () => {
    const handleAnswer = vi.fn();
    render(
      <ChallengeCard 
        challenge={mockChallenge}
        onAnswer={handleAnswer}
      />
    );
    
    fireEvent.click(screen.getByRole('button', { name: /human created/i }));
    
    expect(handleAnswer).toHaveBeenCalledWith(false, undefined);
  });

  it('disables buttons when disabled prop is true', () => {
    render(
      <ChallengeCard 
        challenge={mockChallenge}
        onAnswer={vi.fn()}
        disabled
      />
    );
    
    expect(screen.getByRole('button', { name: /ai generated/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /human created/i })).toBeDisabled();
  });

  it('shows loading state', () => {
    render(
      <ChallengeCard 
        challenge={mockChallenge}
        onAnswer={vi.fn()}
        isLoading
      />
    );
    
    expect(screen.getByTestId('challenge-skeleton')).toBeInTheDocument();
    expect(screen.queryByText(mockChallenge.content)).not.toBeInTheDocument();
  });

  it('applies correct styling for selected answer', () => {
    const { rerender } = render(
      <ChallengeCard 
        challenge={mockChallenge}
        onAnswer={vi.fn()}
        selectedAnswer={true}
        isCorrect={true}
      />
    );
    
    const aiButton = screen.getByRole('button', { name: /ai generated/i });
    expect(aiButton).toHaveClass('bg-success');
    
    rerender(
      <ChallengeCard 
        challenge={mockChallenge}
        onAnswer={vi.fn()}
        selectedAnswer={false}
        isCorrect={false}
      />
    );
    
    const humanButton = screen.getByRole('button', { name: /human created/i });
    expect(humanButton).toHaveClass('bg-error');
  });

  it('shows timer when timeLimit is provided', () => {
    render(
      <ChallengeCard 
        challenge={mockChallenge}
        onAnswer={vi.fn()}
        timeLimit={30}
      />
    );
    
    expect(screen.getByTestId('challenge-timer')).toBeInTheDocument();
    expect(screen.getByText('30s')).toBeInTheDocument();
  });

  it('calls onTimeUp when timer expires', () => {
    const handleTimeUp = vi.fn();
    vi.useFakeTimers();
    
    render(
      <ChallengeCard 
        challenge={mockChallenge}
        onAnswer={vi.fn()}
        timeLimit={1}
        onTimeUp={handleTimeUp}
      />
    );
    
    vi.advanceTimersByTime(1100);
    
    expect(handleTimeUp).toHaveBeenCalled();
    
    vi.useRealTimers();
  });

  it('handles keyboard navigation', async () => {
    const handleAnswer = vi.fn();
    const user = userEvent.setup();
    
    render(
      <ChallengeCard 
        challenge={mockChallenge}
        onAnswer={handleAnswer}
      />
    );
    
    const aiButton = screen.getByRole('button', { name: /ai generated/i });
    aiButton.focus();
    
    await user.keyboard('{Enter}');
    expect(handleAnswer).toHaveBeenCalledWith(true, undefined);
  });

  it('shows confidence slider when enabled', () => {
    render(
      <ChallengeCard 
        challenge={mockChallenge}
        onAnswer={vi.fn()}
        showConfidence
      />
    );
    
    expect(screen.getByLabelText(/confidence level/i)).toBeInTheDocument();
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  it('includes confidence in answer callback', () => {
    const handleAnswer = vi.fn();
    render(
      <ChallengeCard 
        challenge={mockChallenge}
        onAnswer={handleAnswer}
        showConfidence
      />
    );
    
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '75' } });
    
    fireEvent.click(screen.getByRole('button', { name: /ai generated/i }));
    
    expect(handleAnswer).toHaveBeenCalledWith(true, 75);
  });

  it('shows explanation after answer is submitted', () => {
    const explanation = 'This text was generated by GPT-4 based on patterns...';
    
    render(
      <ChallengeCard 
        challenge={mockChallenge}
        onAnswer={vi.fn()}
        selectedAnswer={true}
        explanation={explanation}
      />
    );
    
    expect(screen.getByText(explanation)).toBeInTheDocument();
  });

  it('animates card entrance', () => {
    render(
      <ChallengeCard 
        challenge={mockChallenge}
        onAnswer={vi.fn()}
      />
    );
    
    const card = screen.getByTestId('challenge-card');
    expect(card).toHaveClass('animate-slide-in');
  });

  it('handles image loading errors', () => {
    render(
      <ChallengeCard 
        challenge={mockImageChallenge}
        onAnswer={vi.fn()}
      />
    );
    
    const image = screen.getByRole('img');
    fireEvent.error(image);
    
    expect(screen.getByText(/failed to load image/i)).toBeInTheDocument();
  });

  it('supports custom className', () => {
    render(
      <ChallengeCard 
        challenge={mockChallenge}
        onAnswer={vi.fn()}
        className="custom-challenge"
      />
    );
    
    expect(screen.getByTestId('challenge-card')).toHaveClass('custom-challenge');
  });
});