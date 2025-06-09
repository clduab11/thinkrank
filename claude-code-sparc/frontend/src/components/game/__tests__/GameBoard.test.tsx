import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameBoard } from '../GameBoard';
import { Game, GameMode } from '../../../types';

describe('GameBoard', () => {
  const mockGame: Game = {
    id: 'test-game-1',
    mode: 'quick-play' as GameMode,
    status: 'active',
    score: 150,
    accuracy: 75,
    startedAt: '2024-01-01T00:00:00Z',
  };

  const mockChallenge = {
    id: 'challenge-1',
    type: 'text' as const,
    content: 'This is a test challenge.',
  };

  it('renders game mode title', () => {
    render(
      <GameBoard 
        game={mockGame}
        currentChallenge={mockChallenge}
        onAnswer={vi.fn()}
      />
    );
    
    expect(screen.getByText(/quick play/i)).toBeInTheDocument();
  });

  it('displays current score', () => {
    render(
      <GameBoard 
        game={mockGame}
        currentChallenge={mockChallenge}
        onAnswer={vi.fn()}
      />
    );
    
    expect(screen.getByText(/score: 150/i)).toBeInTheDocument();
  });

  it('displays accuracy percentage', () => {
    render(
      <GameBoard 
        game={mockGame}
        currentChallenge={mockChallenge}
        onAnswer={vi.fn()}
      />
    );
    
    expect(screen.getByText(/75%/i)).toBeInTheDocument();
  });

  it('shows progress indicator', () => {
    render(
      <GameBoard 
        game={mockGame}
        currentChallenge={mockChallenge}
        currentChallengeIndex={3}
        totalChallenges={10}
        onAnswer={vi.fn()}
      />
    );
    
    expect(screen.getByText(/challenge 4 of 10/i)).toBeInTheDocument();
  });

  it('renders challenge card', () => {
    render(
      <GameBoard 
        game={mockGame}
        currentChallenge={mockChallenge}
        onAnswer={vi.fn()}
      />
    );
    
    expect(screen.getByText(mockChallenge.content)).toBeInTheDocument();
  });

  it('shows loading state when challenge is loading', () => {
    render(
      <GameBoard 
        game={mockGame}
        currentChallenge={null}
        isLoading
        onAnswer={vi.fn()}
      />
    );
    
    expect(screen.getByTestId('challenge-skeleton')).toBeInTheDocument();
  });

  it('displays streak counter', () => {
    render(
      <GameBoard 
        game={mockGame}
        currentChallenge={mockChallenge}
        streak={5}
        onAnswer={vi.fn()}
      />
    );
    
    expect(screen.getByText(/streak: 5/i)).toBeInTheDocument();
    expect(screen.getByTestId('streak-fire')).toBeInTheDocument();
  });

  it('shows pause button', () => {
    render(
      <GameBoard 
        game={mockGame}
        currentChallenge={mockChallenge}
        onAnswer={vi.fn()}
        onPause={vi.fn()}
      />
    );
    
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
  });

  it('calls onPause when pause button clicked', () => {
    const handlePause = vi.fn();
    render(
      <GameBoard 
        game={mockGame}
        currentChallenge={mockChallenge}
        onAnswer={vi.fn()}
        onPause={handlePause}
      />
    );
    
    screen.getByRole('button', { name: /pause/i }).click();
    expect(handlePause).toHaveBeenCalled();
  });

  it('shows quit button', () => {
    render(
      <GameBoard 
        game={mockGame}
        currentChallenge={mockChallenge}
        onAnswer={vi.fn()}
        onQuit={vi.fn()}
      />
    );
    
    expect(screen.getByRole('button', { name: /quit/i })).toBeInTheDocument();
  });

  it('calls onQuit when quit button clicked', () => {
    const handleQuit = vi.fn();
    render(
      <GameBoard 
        game={mockGame}
        currentChallenge={mockChallenge}
        onAnswer={vi.fn()}
        onQuit={handleQuit}
      />
    );
    
    screen.getByRole('button', { name: /quit/i }).click();
    expect(handleQuit).toHaveBeenCalled();
  });

  it('passes time limit to challenge card', () => {
    render(
      <GameBoard 
        game={mockGame}
        currentChallenge={mockChallenge}
        timeLimit={30}
        onAnswer={vi.fn()}
      />
    );
    
    expect(screen.getByTestId('challenge-timer')).toBeInTheDocument();
  });

  it('shows game over state', () => {
    render(
      <GameBoard 
        game={{ ...mockGame, status: 'completed' }}
        currentChallenge={null}
        onAnswer={vi.fn()}
        finalScore={500}
        finalAccuracy={85}
      />
    );
    
    expect(screen.getByText(/game over/i)).toBeInTheDocument();
    expect(screen.getByText(/final score: 500/i)).toBeInTheDocument();
    expect(screen.getByText(/accuracy: 85%/i)).toBeInTheDocument();
  });

  it('shows play again button in game over state', () => {
    render(
      <GameBoard 
        game={{ ...mockGame, status: 'completed' }}
        currentChallenge={null}
        onAnswer={vi.fn()}
        onPlayAgain={vi.fn()}
      />
    );
    
    expect(screen.getByRole('button', { name: /play again/i })).toBeInTheDocument();
  });

  it('calls onPlayAgain when play again clicked', () => {
    const handlePlayAgain = vi.fn();
    render(
      <GameBoard 
        game={{ ...mockGame, status: 'completed' }}
        currentChallenge={null}
        onAnswer={vi.fn()}
        onPlayAgain={handlePlayAgain}
      />
    );
    
    screen.getByRole('button', { name: /play again/i }).click();
    expect(handlePlayAgain).toHaveBeenCalled();
  });

  it('applies custom className', () => {
    render(
      <GameBoard 
        game={mockGame}
        currentChallenge={mockChallenge}
        onAnswer={vi.fn()}
        className="custom-board"
      />
    );
    
    expect(screen.getByTestId('game-board')).toHaveClass('custom-board');
  });

  it('shows bonus points animation', () => {
    render(
      <GameBoard 
        game={mockGame}
        currentChallenge={mockChallenge}
        onAnswer={vi.fn()}
        showBonus={50}
      />
    );
    
    expect(screen.getByText('+50')).toBeInTheDocument();
    expect(screen.getByText('+50')).toHaveClass('animate-bounce');
  });

  it('displays mode-specific UI elements', () => {
    render(
      <GameBoard 
        game={{ ...mockGame, mode: 'tournament' as GameMode }}
        currentChallenge={mockChallenge}
        onAnswer={vi.fn()}
        tournamentPosition={3}
        totalPlayers={50}
      />
    );
    
    expect(screen.getByText(/tournament/i)).toBeInTheDocument();
    expect(screen.getByText(/position: 3\/50/i)).toBeInTheDocument();
  });
});