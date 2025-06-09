import React from 'react';
import { LeaderboardEntry } from '../../types';
import { Card } from '../common/Card';
import { cn } from '../../utils/cn';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  currentUserId?: string;
  showTopN?: number;
  isLoading?: boolean;
  className?: string;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  entries,
  currentUserId,
  showTopN = 10,
  isLoading = false,
  className,
}) => {
  const displayEntries = showTopN ? entries.slice(0, showTopN) : entries;

  if (isLoading) {
    return (
      <Card className={cn('p-4', className)}>
        <div className="animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-200 rounded"></div>
              <div className="flex-1 h-4 bg-gray-200 rounded"></div>
              <div className="w-16 h-4 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn('p-4', className)}>
      <h3 className="text-lg font-bold mb-4">Leaderboard</h3>
      <div className="space-y-2">
        {displayEntries.map((entry) => {
          const isCurrentUser = entry.userId === currentUserId;
          
          return (
            <div
              key={entry.userId}
              className={cn(
                'flex items-center gap-3 p-2 rounded-lg transition-colors',
                isCurrentUser && 'bg-primary-50 border border-primary-200'
              )}
            >
              <div className={cn(
                'w-8 h-8 flex items-center justify-center rounded font-bold',
                entry.rank === 1 && 'bg-yellow-400 text-yellow-900',
                entry.rank === 2 && 'bg-gray-300 text-gray-900',
                entry.rank === 3 && 'bg-orange-400 text-orange-900',
                entry.rank > 3 && 'bg-gray-100 text-gray-700'
              )}>
                {entry.rank}
              </div>
              
              <div className="flex items-center gap-2 flex-1">
                {entry.avatar && (
                  <img 
                    src={entry.avatar} 
                    alt={entry.username}
                    className="w-6 h-6 rounded-full"
                  />
                )}
                <span className={cn(
                  'font-medium',
                  isCurrentUser && 'text-primary-700'
                )}>
                  {entry.username}
                </span>
              </div>
              
              <div className="text-right">
                <p className="font-bold">{entry.score.toLocaleString()}</p>
                <p className="text-xs text-gray-500">{entry.games} games</p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};