import { logger } from '@thinkrank/shared';
import axios from 'axios';

export interface ShareContent {
  type: 'achievement' | 'leaderboard' | 'research_milestone' | 'level_up';
  title: string;
  description: string;
  imageUrl?: string;
  url?: string;
  hashtags?: string[];
  metadata?: Record<string, any>;
}

export interface SharePlatform {
  platform: 'facebook' | 'instagram' | 'twitter' | 'tiktok';
  accessToken?: string;
  userId?: string;
}

export interface ShareResult {
  success: boolean;
  platform: string;
  postId?: string;
  url?: string;
  error?: string;
}

class SharingService {

  async shareToFacebook(
    content: ShareContent,
    accessToken: string,
    userId: string
  ): Promise<ShareResult> {
    try {
      const postData = {
        message: `${content.title}\n\n${content.description}\n\n${content.hashtags?.map(tag => `#${tag}`).join(' ') || ''}`,
        link: content.url || process.env.APP_URL,
        privacy: { value: 'PUBLIC' }
      };

      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${userId}/feed`,
        postData,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        platform: 'facebook',
        postId: response.data.id,
        url: `https://facebook.com/${response.data.id}`
      };

    } catch (error: any) {
      logger.error('Facebook sharing failed', { error: error.message, content });
      return {
        success: false,
        platform: 'facebook',
        error: error.response?.data?.error?.message || error.message
      };
    }
  }

  async shareToInstagram(
    content: ShareContent,
    accessToken: string,
    userId: string
  ): Promise<ShareResult> {
    try {
      if (!content.imageUrl) {
        return {
          success: false,
          platform: 'instagram',
          error: 'Instagram sharing requires an image'
        };
      }

      // Step 1: Create media container
      const mediaResponse = await axios.post(
        `https://graph.facebook.com/v18.0/${userId}/media`,
        {
          image_url: content.imageUrl,
          caption: `${content.title}\n${content.description}\n\n${content.hashtags?.map(tag => `#${tag}`).join(' ') || ''}`
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const creationId = mediaResponse.data.id;

      // Step 2: Publish the media
      const publishResponse = await axios.post(
        `https://graph.facebook.com/v18.0/${userId}/media_publish`,
        {
          creation_id: creationId
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        platform: 'instagram',
        postId: publishResponse.data.id,
        url: `https://instagram.com/p/${publishResponse.data.id}`
      };

    } catch (error: any) {
      logger.error('Instagram sharing failed', { error: error.message, content });
      return {
        success: false,
        platform: 'instagram',
        error: error.response?.data?.error?.message || error.message
      };
    }
  }

  async shareToTwitter(
    content: ShareContent,
    accessToken: string,
    userId: string
  ): Promise<ShareResult> {
    try {
      const tweetText = this.formatTwitterContent(content);

      const response = await axios.post(
        'https://api.twitter.com/2/tweets',
        {
          text: tweetText
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const tweetId = response.data.data.id;

      return {
        success: true,
        platform: 'twitter',
        postId: tweetId,
        url: `https://twitter.com/${userId}/status/${tweetId}`
      };

    } catch (error: any) {
      logger.error('Twitter sharing failed', { error: error.message, content });
      return {
        success: false,
        platform: 'twitter',
        error: error.response?.data?.errors?.[0]?.detail || error.message
      };
    }
  }

  async shareToTikTok(
    content: ShareContent,
    accessToken: string,
    userId: string
  ): Promise<ShareResult> {
    try {
      // TikTok sharing is more complex and typically requires video content
      // For now, we'll create a text-based post or redirect to TikTok with pre-filled content

      const tiktokText = this.formatTikTokContent(content);

      // TikTok API is more restrictive - typically used for analytics rather than posting
      // In practice, you'd redirect users to TikTok app with pre-filled content
      const shareUrl = `https://www.tiktok.com/share?text=${encodeURIComponent(tiktokText)}`;

      return {
        success: true,
        platform: 'tiktok',
        url: shareUrl
      };

    } catch (error: any) {
      logger.error('TikTok sharing failed', { error: error.message, content });
      return {
        success: false,
        platform: 'tiktok',
        error: error.message
      };
    }
  }

  async generateShareImage(content: ShareContent): Promise<string | null> {
    try {
      // In a real implementation, you'd generate dynamic images using a service like:
      // - Canvas API
      // - Sharp (Node.js image processing)
      // - External service like Bannerbear or Placid

      // For now, return a placeholder that could be dynamically generated
      const baseUrl = process.env.CDN_URL || process.env.APP_URL;
      const imageParams = new URLSearchParams({
        type: content.type,
        title: content.title,
        description: content.description.substring(0, 100)
      });

      return `${baseUrl}/api/share/generate-image?${imageParams.toString()}`;

    } catch (error) {
      logger.error('Image generation failed', { error, content });
      return null;
    }
  }

  createAchievementShare(
    achievementName: string,
    achievementDescription: string,
    userName: string,
    userLevel: number
  ): ShareContent {
    return {
      type: 'achievement',
      title: `🎉 Achievement Unlocked: ${achievementName}!`,
      description: `I just earned "${achievementName}" on ThinkRank! ${achievementDescription} 🧠✨`,
      hashtags: ['ThinkRank', 'AIResearch', 'Achievement', 'Gaming', 'Education'],
      metadata: {
        userName,
        userLevel,
        achievementName
      }
    };
  }

  createLeaderboardShare(
    rank: number,
    category: string,
    score: number,
    userName: string
  ): ShareContent {
    const rankSuffix = this.getOrdinalSuffix(rank);

    return {
      type: 'leaderboard',
      title: `🏆 Ranked ${rank}${rankSuffix} in ${category}!`,
      description: `I'm currently ranked ${rank}${rankSuffix} on the ThinkRank ${category} leaderboard with ${score.toLocaleString()} points! 🚀`,
      hashtags: ['ThinkRank', 'Leaderboard', 'AIResearch', 'Competition'],
      metadata: {
        rank,
        category,
        score,
        userName
      }
    };
  }

  createResearchMilestoneShare(
    contributionCount: number,
    researchImpact: string,
    userName: string
  ): ShareContent {
    return {
      type: 'research_milestone',
      title: `🔬 Research Milestone Reached!`,
      description: `I've just submitted my ${contributionCount}${this.getOrdinalSuffix(contributionCount)} research contribution on ThinkRank! Contributing to ${researchImpact} research. 🧠🔬`,
      hashtags: ['ThinkRank', 'Research', 'AI', 'Science', 'Contribution'],
      metadata: {
        contributionCount,
        researchImpact,
        userName
      }
    };
  }

  createLevelUpShare(
    newLevel: number,
    totalScore: number,
    userName: string
  ): ShareContent {
    return {
      type: 'level_up',
      title: `⭐ Level Up! Reached Level ${newLevel}!`,
      description: `Just leveled up to Level ${newLevel} on ThinkRank with ${totalScore.toLocaleString()} total points! Ready for more AI research challenges! 🎮🧠`,
      hashtags: ['ThinkRank', 'LevelUp', 'Gaming', 'AIResearch', 'Progress'],
      metadata: {
        newLevel,
        totalScore,
        userName
      }
    };
  }

  private formatTwitterContent(content: ShareContent): string {
    const maxLength = 280;
    let tweet = `${content.title}\n\n${content.description}`;

    const hashtags = content.hashtags?.map(tag => `#${tag}`).join(' ') || '';
    const url = content.url || process.env.APP_URL;

    // Reserve space for hashtags and URL
    const reservedLength = hashtags.length + (url ? url.length + 1 : 0) + 10; // +10 for spacing
    const availableLength = maxLength - reservedLength;

    if (tweet.length > availableLength) {
      tweet = tweet.substring(0, availableLength - 3) + '...';
    }

    const parts = [tweet, hashtags];
    if (url) parts.push(url);

    return parts.filter(part => part).join('\n\n');
  }

  private formatTikTokContent(content: ShareContent): string {
    const hashtags = content.hashtags?.map(tag => `#${tag}`).join(' ') || '';
    return `${content.title}\n\n${content.description}\n\n${hashtags}`;
  }

  private getOrdinalSuffix(num: number): string {
    const j = num % 10;
    const k = num % 100;

    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  }

  async validatePlatformToken(platform: string, accessToken: string): Promise<boolean> {
    try {
      switch (platform) {
        case 'facebook':
        case 'instagram':
          const fbResponse = await axios.get(
            `https://graph.facebook.com/me?access_token=${accessToken}`
          );
          return fbResponse.status === 200;

        case 'twitter':
          const twitterResponse = await axios.get(
            'https://api.twitter.com/2/users/me',
            {
              headers: { 'Authorization': `Bearer ${accessToken}` }
            }
          );
          return twitterResponse.status === 200;

        case 'tiktok':
          // TikTok token validation would go here
          return true; // Simplified for now

        default:
          return false;
      }
    } catch (error) {
      logger.error('Token validation failed', { platform, error });
      return false;
    }
  }

  generateShareableUrl(content: ShareContent, userId: string): string {
    const baseUrl = process.env.APP_URL || 'https://thinkrank.app';
    const params = new URLSearchParams({
      type: content.type,
      user: userId,
      utm_source: 'social_share',
      utm_medium: 'social',
      utm_campaign: content.type
    });

    return `${baseUrl}/shared?${params.toString()}`;
  }
}

export const sharingService = new SharingService();
