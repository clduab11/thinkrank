import React from 'react';
import { cn } from '../../utils/cn';

interface ScoreDisplayProps {
  score: number;
  label?: string;
  size?: 'small' | 'medium' | 'large';
  showAnimation?: boolean;
  className?: string;
}

export const ScoreDisplay: React.FC<ScoreDisplayProps> = ({
  score,
  label = 'Score',
  size = 'medium',
  showAnimation = true,
  className,
}) => {
  const sizeClasses = {
    small: 'text-lg',
    medium: 'text-2xl',
    large: 'text-4xl',
  };

  return (
    <div className={cn('text-center', className)}>
      <p className="text-sm text-gray-600 mb-1">{label}</p>
      <p 
        className={cn(
          'font-bold text-primary-600',
          sizeClasses[size],
          showAnimation && 'transition-all duration-300'
        )}
      >
        {score.toLocaleString()}
      </p>
    </div>
  );
};