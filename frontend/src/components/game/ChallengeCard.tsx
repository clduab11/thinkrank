import React, { useState, useEffect, useCallback } from 'react';
import { Challenge } from '../../types';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { cn } from '../../utils/cn';

interface ChallengeCardProps {
  challenge: Challenge;
  onAnswer: (isAI: boolean, confidence?: number) => void;
  disabled?: boolean;
  isLoading?: boolean;
  selectedAnswer?: boolean | null;
  isCorrect?: boolean | null;
  timeLimit?: number;
  onTimeUp?: () => void;
  showConfidence?: boolean;
  explanation?: string;
  className?: string;
}

export const ChallengeCard: React.FC<ChallengeCardProps> = ({
  challenge,
  onAnswer,
  disabled = false,
  isLoading = false,
  selectedAnswer,
  isCorrect,
  timeLimit,
  onTimeUp,
  showConfidence = false,
  explanation,
  className,
}) => {
  const [confidence, setConfidence] = useState(50);
  const [timeRemaining, setTimeRemaining] = useState(timeLimit || 0);
  const [imageError, setImageError] = useState(false);

  // Handle timer
  useEffect(() => {
    if (!timeLimit || disabled || selectedAnswer !== undefined) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onTimeUp?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLimit, disabled, selectedAnswer, onTimeUp]);

  // Reset timer when challenge changes
  useEffect(() => {
    setTimeRemaining(timeLimit || 0);
  }, [challenge?.id, timeLimit]);

  const handleAnswer = useCallback((isAI: boolean) => {
    if (disabled || selectedAnswer !== undefined) return;
    onAnswer(isAI, showConfidence ? confidence : undefined);
  }, [disabled, selectedAnswer, onAnswer, showConfidence, confidence]);

  const handleImageError = (): void => {
    setImageError(true);
  };

  if (isLoading) {
    return (
      <Card
        data-testid="challenge-skeleton"
        className={cn('animate-pulse', className)}
      >
        <div className="space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          <div className="flex gap-4 mt-6">
            <div className="h-10 bg-gray-200 rounded flex-1"></div>
            <div className="h-10 bg-gray-200 rounded flex-1"></div>
          </div>
        </div>
      </Card>
    );
  }

  const getButtonVariant = (isAI: boolean): 'primary' | 'secondary' | 'danger' => {
    if (selectedAnswer === undefined) return 'primary';
    if (selectedAnswer === isAI) {
      return isCorrect ? 'primary' : 'danger';
    }
    return 'secondary';
  };

  const getButtonClass = (isAI: boolean): string => {
    if (selectedAnswer === undefined) return '';
    if (selectedAnswer === isAI) {
      return isCorrect ? 'bg-success' : 'bg-error';
    }
    return '';
  };

  return (
    <Card
      data-testid="challenge-card"
      className={cn('animate-slide-in', className)}
      padding="large"
    >
      {/* Timer */}
      {timeLimit && !disabled && selectedAnswer === undefined && (
        <div 
          data-testid="challenge-timer" 
          className={cn(
            'absolute top-4 right-4 text-lg font-bold',
            timeRemaining <= 5 ? 'text-error animate-pulse' : 'text-gray-600'
          )}
        >
          {timeRemaining}s
        </div>
      )}

      {/* Challenge Content */}
      <div className="space-y-6">
        {challenge.type === 'text' ? (
          <p className="text-lg leading-relaxed text-gray-800">
            {challenge.content}
          </p>
        ) : (
          <div className="flex justify-center">
            {imageError ? (
              <div className="text-error p-8 bg-gray-100 rounded">
                Failed to load image
              </div>
            ) : (
              <img
                src={challenge.content}
                alt="AI detection challenge"
                className="max-w-full h-auto rounded-lg shadow-md"
                onError={handleImageError}
              />
            )}
          </div>
        )}

        {/* Confidence Slider */}
        {showConfidence && selectedAnswer === undefined && (
          <div className="space-y-2">
            <label 
              htmlFor="confidence-slider" 
              className="block text-sm font-medium text-gray-700"
            >
              Confidence Level: {confidence}%
            </label>
            <input
              id="confidence-slider"
              type="range"
              min="0"
              max="100"
              value={confidence}
              onChange={(e) => setConfidence(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              disabled={disabled}
            />
          </div>
        )}

        {/* Answer Buttons */}
        <div className="flex gap-4">
          <Button
            onClick={() => handleAnswer(true)}
            disabled={disabled || selectedAnswer !== undefined}
            variant={getButtonVariant(true)}
            className={getButtonClass(true)}
            fullWidth
          >
            🤖 AI Generated
          </Button>
          <Button
            onClick={() => handleAnswer(false)}
            disabled={disabled || selectedAnswer !== undefined}
            variant={getButtonVariant(false)}
            className={getButtonClass(false)}
            fullWidth
          >
            👤 Human Created
          </Button>
        </div>

        {/* Explanation */}
        {explanation && selectedAnswer !== undefined && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-700">{explanation}</p>
          </div>
        )}
      </div>
    </Card>
  );
};