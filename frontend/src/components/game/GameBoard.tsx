import React from 'react';
import { Game, Challenge, GameMode } from '../../types';
import { ChallengeCard } from './ChallengeCard';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { cn } from '../../utils/cn';

interface GameBoardProps {
  game: Game;
  currentChallenge: Challenge | null;
  onAnswer: (isAI: boolean, confidence?: number) => void;
  currentChallengeIndex?: number;
  totalChallenges?: number;
  streak?: number;
  isLoading?: boolean;
  onPause?: () => void;
  onQuit?: () => void;
  onPlayAgain?: () => void;
  timeLimit?: number;
  finalScore?: number;
  finalAccuracy?: number;
  showBonus?: number;
  tournamentPosition?: number;
  totalPlayers?: number;
  className?: string;
}

const gameModeLabels: Record<GameMode, string> = {
  'quick-play': 'Quick Play',
  'daily-challenge': 'Daily Challenge',
  'research-mode': 'Research Mode',
  'tournament': 'Tournament',
};

export const GameBoard: React.FC<GameBoardProps> = ({
  game,
  currentChallenge,
  onAnswer,
  currentChallengeIndex = 0,
  totalChallenges = 0,
  streak = 0,
  isLoading = false,
  onPause,
  onQuit,
  onPlayAgain,
  timeLimit,
  finalScore,
  finalAccuracy,
  showBonus,
  tournamentPosition,
  totalPlayers,
  className,
}) => {
  const isGameOver = game.status === 'completed';

  return (
    <div
      data-testid="game-board"
      className={cn('max-w-4xl mx-auto p-4 space-y-6', className)}
    >
      {/* Game Header */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-gray-900">
              {gameModeLabels[game.mode]}
            </h2>
            {totalChallenges > 0 && !isGameOver && (
              <p className="text-sm text-gray-600">
                Challenge {currentChallengeIndex + 1} of {totalChallenges}
              </p>
            )}
            {game.mode === 'tournament' && tournamentPosition && totalPlayers && (
              <p className="text-sm text-gray-600">
                Position: {tournamentPosition}/{totalPlayers}
              </p>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Score Display */}
            <div className="text-right">
              <p className="text-sm text-gray-600">Score</p>
              <p className="text-2xl font-bold text-primary-600">
                {game.score}
              </p>
              {showBonus && (
                <p className="text-lg font-bold text-success animate-bounce">
                  +{showBonus}
                </p>
              )}
            </div>

            {/* Accuracy Display */}
            {game.accuracy !== undefined && (
              <div className="text-right">
                <p className="text-sm text-gray-600">Accuracy</p>
                <p className="text-2xl font-bold text-secondary-600">
                  {game.accuracy}%
                </p>
              </div>
            )}

            {/* Streak Display */}
            {streak > 0 && !isGameOver && (
              <div className="text-right">
                <p className="text-sm text-gray-600">Streak</p>
                <p className="text-2xl font-bold text-warning flex items-center gap-1">
                  <span data-testid="streak-fire">🔥</span>
                  {streak}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {!isGameOver && (
          <div className="flex gap-2 mt-4">
            {onPause && (
              <Button
                onClick={onPause}
                variant="secondary"
                size="small"
              >
                ⏸️ Pause
              </Button>
            )}
            {onQuit && (
              <Button
                onClick={onQuit}
                variant="danger"
                size="small"
              >
                🚪 Quit
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* Game Content */}
      {isGameOver ? (
        <Card className="p-8 text-center">
          <h3 className="text-3xl font-bold mb-4">Game Over!</h3>
          <div className="space-y-2 mb-6">
            <p className="text-xl">
              Final Score: {finalScore ?? game.score}
            </p>
            {(finalAccuracy ?? game.accuracy) !== undefined && (
              <p className="text-xl">
                Accuracy: {finalAccuracy ?? game.accuracy}%
              </p>
            )}
          </div>
          {onPlayAgain && (
            <Button
              onClick={onPlayAgain}
              size="large"
            >
              🎮 Play Again
            </Button>
          )}
        </Card>
      ) : (
        currentChallenge ? (
          <ChallengeCard
            challenge={currentChallenge}
            onAnswer={onAnswer}
            isLoading={isLoading}
            timeLimit={timeLimit}
            showConfidence={game.mode === 'research-mode'}
          />
        ) : (
          <ChallengeCard
            challenge={{ id: '', type: 'text', content: '' }}
            onAnswer={onAnswer}
            isLoading={true}
            timeLimit={timeLimit}
            showConfidence={game.mode === 'research-mode'}
          />
        )
      )}
    </div>
  );
};