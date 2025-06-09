import React, { useEffect, useState } from 'react';
import { cn } from '../../utils/cn';

interface TimerProps {
  duration: number;
  onTimeUp?: () => void;
  isPaused?: boolean;
  showWarning?: boolean;
  warningThreshold?: number;
  className?: string;
}

export const Timer: React.FC<TimerProps> = ({
  duration,
  onTimeUp,
  isPaused = false,
  showWarning = true,
  warningThreshold = 5,
  className,
}) => {
  const [timeRemaining, setTimeRemaining] = useState(duration);

  useEffect(() => {
    setTimeRemaining(duration);
  }, [duration]);

  useEffect(() => {
    if (isPaused || timeRemaining <= 0) return;

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
  }, [isPaused, onTimeUp]);

  const isWarning = showWarning && timeRemaining <= warningThreshold && timeRemaining > 0;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      data-testid="timer"
      className={cn(
        'text-2xl font-bold tabular-nums',
        isWarning && 'text-error animate-pulse',
        !isWarning && 'text-gray-700',
        className
      )}
    >
      {formatTime(timeRemaining)}
    </div>
  );
};