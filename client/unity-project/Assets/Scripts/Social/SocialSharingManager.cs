using System;
using System.Collections.Generic;
using UnityEngine;
using System.Threading.Tasks;

namespace ThinkRank.Social
{
    [System.Serializable]
    public class ShareContent
    {
        public string type; // achievement, leaderboard, research_milestone, level_up
        public string title;
        public string description;
        public string imageUrl;
        public string url;
        public List<string> hashtags;
        public Dictionary<string, object> metadata;
    }

    [System.Serializable]
    public class ShareResult
    {
        public bool success;
        public string platform;
        public string postId;
        public string url;
        public string error;
    }

    public enum SocialPlatform
    {
        Facebook,
        Instagram,
        Twitter,
        TikTok
    }

    public class SocialSharingManager : MonoBehaviour
    {
        [Header("Sharing Settings")]
        public bool enableSharing = true;
        public bool requireSubscription = true; // Premium feature
        public string defaultHashtag = "ThinkRank";

        [Header("Platform Settings")]
        public bool enableFacebook = true;
        public bool enableInstagram = true;
        public bool enableTwitter = true;
        public bool enableTikTok = true;

        [Header("UI References")]
        public GameObject sharingPanelPrefab;
        public Transform sharingUIParent;

        // Events
        public static event Action<ShareResult> OnShareCompleted;
        public static event Action<string> OnShareError;

        private Dictionary<SocialPlatform, string> platformTokens = new Dictionary<SocialPlatform, string>();
        private SubscriptionManager subscriptionManager;

        private void Start()
        {
            subscriptionManager = FindObjectOfType<SubscriptionManager>();

            if (enableSharing)
            {
                InitializeSharingPlatforms();
            }
        }

        private void InitializeSharingPlatforms()
        {
            // Initialize platform SDKs
#if UNITY_IOS || UNITY_ANDROID
            InitializeMobilePlatforms();
#else
            InitializeWebPlatforms();
#endif

            Debug.Log("Social sharing initialized");
        }

        private void InitializeMobilePlatforms()
        {
            // Initialize Facebook SDK
            if (enableFacebook)
            {
                // FB.Init(OnFacebookInit);
            }

            // Initialize other mobile SDKs as needed
        }

        private void InitializeWebPlatforms()
        {
            // Web-based sharing initialization
            Debug.Log("Web-based sharing initialized");
        }

        public async Task ShareAchievement(Achievement achievement, SocialPlatform platform)
        {
            if (!CanShare("social_sharing"))
            {
                subscriptionManager?.ShowUpgradePrompt("social_sharing", "Upgrade to Premium to share achievements!");
                return;
            }

            var shareContent = CreateAchievementShareContent(achievement);
            await ShareContent(shareContent, platform);
        }

        public async Task ShareLeaderboardPosition(int rank, string category, int score, SocialPlatform platform)
        {
            if (!CanShare("social_sharing"))
            {
                subscriptionManager?.ShowUpgradePrompt("social_sharing", "Upgrade to Premium to share leaderboard achievements!");
                return;
            }

            var shareContent = CreateLeaderboardShareContent(rank, category, score);
            await ShareContent(shareContent, platform);
        }

        public async Task ShareResearchMilestone(int contributionCount, string researchArea, SocialPlatform platform)
        {
            if (!CanShare("social_sharing"))
            {
                subscriptionManager?.ShowUpgradePrompt("social_sharing", "Upgrade to Premium to share research milestones!");
                return;
            }

            var shareContent = CreateResearchMilestoneShareContent(contributionCount, researchArea);
            await ShareContent(shareContent, platform);
        }

        public async Task ShareLevelUp(int newLevel, int totalScore, SocialPlatform platform)
        {
            if (!CanShare("social_sharing"))
            {
                subscriptionManager?.ShowUpgradePrompt("social_sharing", "Upgrade to Premium to share level progress!");
                return;
            }

            var shareContent = CreateLevelUpShareContent(newLevel, totalScore);
            await ShareContent(shareContent, platform);
        }

        private async Task ShareContent(ShareContent content, SocialPlatform platform)
        {
            try
            {
                ShareResult result = null;

                switch (platform)
                {
                    case SocialPlatform.Facebook:
                        result = await ShareToFacebook(content);
                        break;
                    case SocialPlatform.Instagram:
                        result = await ShareToInstagram(content);
                        break;
                    case SocialPlatform.Twitter:
                        result = await ShareToTwitter(content);
                        break;
                    case SocialPlatform.TikTok:
                        result = await ShareToTikTok(content);
                        break;
                }

                if (result != null)
                {
                    OnShareCompleted?.Invoke(result);

                    if (result.success)
                    {
                        ShowShareSuccessUI(platform, result);
                    }
                    else
                    {
                        OnShareError?.Invoke(result.error);
                    }
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"Sharing failed: {e.Message}");
                OnShareError?.Invoke("Sharing failed");
            }
        }

        private async Task<ShareResult> ShareToFacebook(ShareContent content)
        {
#if UNITY_IOS || UNITY_ANDROID
            return await ShareToFacebookMobile(content);
#else
            return await ShareToFacebookWeb(content);
#endif
        }

        private async Task<ShareResult> ShareToFacebookMobile(ShareContent content)
        {
            // Use Facebook SDK for mobile
            try
            {
                // FB.ShareLink() or similar
                Debug.Log("Sharing to Facebook (Mobile)");

                // Simulate sharing
                await Task.Delay(1000);

                return new ShareResult
                {
                    success = true,
                    platform = "facebook",
                    postId = "fb_" + System.Guid.NewGuid().ToString("N")[..8]
                };
            }
            catch (Exception e)
            {
                return new ShareResult
                {
                    success = false,
                    platform = "facebook",
                    error = e.Message
                };
            }
        }

        private async Task<ShareResult> ShareToFacebookWeb(ShareContent content)
        {
            try
            {
                var shareData = JsonUtility.ToJson(content);
                var resultData = await APIManager.Instance.ShareToFacebook(shareData);

                if (resultData != null)
                {
                    return JsonUtility.FromJson<ShareResult>(resultData);
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"Facebook web sharing failed: {e.Message}");
            }

            return new ShareResult { success = false, platform = "facebook", error = "Web sharing failed" };
        }

        private async Task<ShareResult> ShareToInstagram(ShareContent content)
        {
            try
            {
                // Instagram requires images, so generate one if needed
                if (string.IsNullOrEmpty(content.imageUrl))
                {
                    content.imageUrl = await GenerateShareImage(content);
                }

#if UNITY_IOS || UNITY_ANDROID
                return await ShareToInstagramMobile(content);
#else
                return await ShareToInstagramWeb(content);
#endif
            }
            catch (Exception e)
            {
                return new ShareResult
                {
                    success = false,
                    platform = "instagram",
                    error = e.Message
                };
            }
        }

        private async Task<ShareResult> ShareToInstagramMobile(ShareContent content)
        {
            // Use Instagram SDK or deep linking
            Debug.Log("Sharing to Instagram (Mobile)");

            // Open Instagram app with content
            string instagramUrl = $"instagram://camera?text={UnityEngine.Networking.UnityWebRequest.EscapeURL(content.description)}";
            Application.OpenURL(instagramUrl);

            await Task.Delay(500);

            return new ShareResult
            {
                success = true,
                platform = "instagram",
                postId = "ig_" + System.Guid.NewGuid().ToString("N")[..8]
            };
        }

        private async Task<ShareResult> ShareToInstagramWeb(ShareContent content)
        {
            try
            {
                var shareData = JsonUtility.ToJson(content);
                var resultData = await APIManager.Instance.ShareToInstagram(shareData);

                if (resultData != null)
                {
                    return JsonUtility.FromJson<ShareResult>(resultData);
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"Instagram web sharing failed: {e.Message}");
            }

            return new ShareResult { success = false, platform = "instagram", error = "Web sharing failed" };
        }

        private async Task<ShareResult> ShareToTwitter(ShareContent content)
        {
            try
            {
#if UNITY_IOS || UNITY_ANDROID
                return await ShareToTwitterMobile(content);
#else
                return await ShareToTwitterWeb(content);
#endif
            }
            catch (Exception e)
            {
                return new ShareResult
                {
                    success = false,
                    platform = "twitter",
                    error = e.Message
                };
            }
        }

        private async Task<ShareResult> ShareToTwitterMobile(ShareContent content)
        {
            // Use Twitter deep linking
            string tweetText = FormatTwitterContent(content);
            string twitterUrl = $"twitter://post?message={UnityEngine.Networking.UnityWebRequest.EscapeURL(tweetText)}";

            Application.OpenURL(twitterUrl);

            await Task.Delay(500);

            return new ShareResult
            {
                success = true,
                platform = "twitter",
                postId = "tw_" + System.Guid.NewGuid().ToString("N")[..8]
            };
        }

        private async Task<ShareResult> ShareToTwitterWeb(ShareContent content)
        {
            try
            {
                var shareData = JsonUtility.ToJson(content);
                var resultData = await APIManager.Instance.ShareToTwitter(shareData);

                if (resultData != null)
                {
                    return JsonUtility.FromJson<ShareResult>(resultData);
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"Twitter web sharing failed: {e.Message}");
            }

            return new ShareResult { success = false, platform = "twitter", error = "Web sharing failed" };
        }

        private async Task<ShareResult> ShareToTikTok(ShareContent content)
        {
            try
            {
                // TikTok typically requires video content
                string tiktokText = FormatTikTokContent(content);
                string tiktokUrl = $"https://www.tiktok.com/share?text={UnityEngine.Networking.UnityWebRequest.EscapeURL(tiktokText)}";

                Application.OpenURL(tiktokUrl);

                await Task.Delay(500);

                return new ShareResult
                {
                    success = true,
                    platform = "tiktok",
                    postId = "tt_" + System.Guid.NewGuid().ToString("N")[..8]
                };
            }
            catch (Exception e)
            {
                return new ShareResult
                {
                    success = false,
                    platform = "tiktok",
                    error = e.Message
                };
            }
        }

        private ShareContent CreateAchievementShareContent(Achievement achievement)
        {
            var userProfile = FindObjectOfType<SocialManager>()?.GetCurrentUserProfile();
            string userName = userProfile?.username ?? "Player";

            return new ShareContent
            {
                type = "achievement",
                title = $"🎉 Achievement Unlocked: {achievement.name}!",
                description = $"I just earned \"{achievement.name}\" on ThinkRank! {achievement.description} 🧠✨",
                hashtags = new List<string> { defaultHashtag, "AIResearch", "Achievement", "Gaming", "Education" },
                metadata = new Dictionary<string, object>
                {
                    { "userName", userName },
                    { "achievementName", achievement.name }
                }
            };
        }

        private ShareContent CreateLeaderboardShareContent(int rank, string category, int score)
        {
            var userProfile = FindObjectOfType<SocialManager>()?.GetCurrentUserProfile();
            string userName = userProfile?.username ?? "Player";
            string rankSuffix = GetOrdinalSuffix(rank);

            return new ShareContent
            {
                type = "leaderboard",
                title = $"🏆 Ranked {rank}{rankSuffix} in {category}!",
                description = $"I'm currently ranked {rank}{rankSuffix} on the ThinkRank {category} leaderboard with {score:N0} points! 🚀",
                hashtags = new List<string> { defaultHashtag, "Leaderboard", "AIResearch", "Competition" },
                metadata = new Dictionary<string, object>
                {
                    { "rank", rank },
                    { "category", category },
                    { "score", score },
                    { "userName", userName }
                }
            };
        }

        private ShareContent CreateResearchMilestoneShareContent(int contributionCount, string researchArea)
        {
            var userProfile = FindObjectOfType<SocialManager>()?.GetCurrentUserProfile();
            string userName = userProfile?.username ?? "Player";
            string countSuffix = GetOrdinalSuffix(contributionCount);

            return new ShareContent
            {
                type = "research_milestone",
                title = "🔬 Research Milestone Reached!",
                description = $"I've just submitted my {contributionCount}{countSuffix} research contribution on ThinkRank! Contributing to {researchArea} research. 🧠🔬",
                hashtags = new List<string> { defaultHashtag, "Research", "AI", "Science", "Contribution" },
                metadata = new Dictionary<string, object>
                {
                    { "contributionCount", contributionCount },
                    { "researchArea", researchArea },
                    { "userName", userName }
                }
            };
        }

        private ShareContent CreateLevelUpShareContent(int newLevel, int totalScore)
        {
            var userProfile = FindObjectOfType<SocialManager>()?.GetCurrentUserProfile();
            string userName = userProfile?.username ?? "Player";

            return new ShareContent
            {
                type = "level_up",
                title = $"⭐ Level Up! Reached Level {newLevel}!",
                description = $"Just leveled up to Level {newLevel} on ThinkRank with {totalScore:N0} total points! Ready for more AI research challenges! 🎮🧠",
                hashtags = new List<string> { defaultHashtag, "LevelUp", "Gaming", "AIResearch", "Progress" },
                metadata = new Dictionary<string, object>
                {
                    { "newLevel", newLevel },
                    { "totalScore", totalScore },
                    { "userName", userName }
                }
            };
        }

        private string FormatTwitterContent(ShareContent content)
        {
            string tweet = $"{content.title}\n\n{content.description}";
            string hashtags = string.Join(" ", content.hashtags?.ConvertAll(tag => $"#{tag}") ?? new List<string>());

            // Twitter's character limit
            int maxLength = 280;
            int reservedLength = hashtags.Length + 10; // +10 for spacing
            int availableLength = maxLength - reservedLength;

            if (tweet.Length > availableLength)
            {
                tweet = tweet.Substring(0, availableLength - 3) + "...";
            }

            return $"{tweet}\n\n{hashtags}";
        }

        private string FormatTikTokContent(ShareContent content)
        {
            string hashtags = string.Join(" ", content.hashtags?.ConvertAll(tag => $"#{tag}") ?? new List<string>());
            return $"{content.title}\n\n{content.description}\n\n{hashtags}";
        }

        private async Task<string> GenerateShareImage(ShareContent content)
        {
            try
            {
                // Call API to generate dynamic share image
                var imageData = await APIManager.Instance.GenerateShareImage(JsonUtility.ToJson(content));
                if (imageData != null)
                {
                    var response = JsonUtility.FromJson<GenerateImageResponse>(imageData);
                    return response.imageUrl;
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to generate share image: {e.Message}");
            }

            // Return default placeholder image
            return "https://placeholder-image-url.com/share.png";
        }

        private string GetOrdinalSuffix(int num)
        {
            int j = num % 10;
            int k = num % 100;

            if (j == 1 && k != 11) return "st";
            if (j == 2 && k != 12) return "nd";
            if (j == 3 && k != 13) return "rd";
            return "th";
        }

        private bool CanShare(string featureName)
        {
            if (!enableSharing) return false;
            if (!requireSubscription) return true;

            return subscriptionManager?.HasFeature(featureName) ?? false;
        }

        private void ShowShareSuccessUI(SocialPlatform platform, ShareResult result)
        {
            Debug.Log($"Successfully shared to {platform}!");

            // Show success notification
            // You could implement a toast notification here
        }

        public void ShowSharingPanel(ShareContent content)
        {
            if (sharingPanelPrefab != null && sharingUIParent != null)
            {
                var panel = Instantiate(sharingPanelPrefab, sharingUIParent);
                var panelUI = panel.GetComponent<SharingPanelUI>();

                if (panelUI != null)
                {
                    panelUI.SetupSharing(content, GetAvailablePlatforms());
                }
            }
        }

        private List<SocialPlatform> GetAvailablePlatforms()
        {
            var platforms = new List<SocialPlatform>();

            if (enableFacebook) platforms.Add(SocialPlatform.Facebook);
            if (enableInstagram) platforms.Add(SocialPlatform.Instagram);
            if (enableTwitter) platforms.Add(SocialPlatform.Twitter);
            if (enableTikTok) platforms.Add(SocialPlatform.TikTok);

            return platforms;
        }

        // UI Event Handlers
        public async void OnPlatformButtonClicked(int platformIndex)
        {
            if (platformIndex >= 0 && platformIndex < System.Enum.GetValues(typeof(SocialPlatform)).Length)
            {
                var platform = (SocialPlatform)platformIndex;
                // Get current share content from UI or cache
                // await ShareContent(currentShareContent, platform);
            }
        }
    }

    // UI Component for sharing panel
    public class SharingPanelUI : MonoBehaviour
    {
        [Header("UI References")]
        public TMPro.TextMeshProUGUI titleText;
        public TMPro.TextMeshProUGUI descriptionText;
        public Transform platformButtonsContainer;
        public GameObject platformButtonPrefab;
        public UnityEngine.UI.Button closeButton;

        private ShareContent currentContent;
        private SocialSharingManager sharingManager;

        private void Start()
        {
            sharingManager = FindObjectOfType<SocialSharingManager>();

            if (closeButton != null)
            {
                closeButton.onClick.RemoveAllListeners();
                closeButton.onClick.AddListener(() => Destroy(gameObject));
            }
        }

        public void SetupSharing(ShareContent content, List<SocialPlatform> availablePlatforms)
        {
            currentContent = content;

            if (titleText != null)
                titleText.text = content.title;

            if (descriptionText != null)
                descriptionText.text = content.description;

            SetupPlatformButtons(availablePlatforms);
        }

        private void SetupPlatformButtons(List<SocialPlatform> platforms)
        {
            if (platformButtonsContainer == null || platformButtonPrefab == null)
                return;

            // Clear existing buttons
            foreach (Transform child in platformButtonsContainer)
            {
                Destroy(child.gameObject);
            }

            // Create platform buttons
            foreach (var platform in platforms)
            {
                var buttonObj = Instantiate(platformButtonPrefab, platformButtonsContainer);
                var button = buttonObj.GetComponent<UnityEngine.UI.Button>();
                var buttonText = buttonObj.GetComponentInChildren<TMPro.TextMeshProUGUI>();

                if (buttonText != null)
                    buttonText.text = platform.ToString();

                if (button != null)
                {
                    var platformCopy = platform; // Capture for closure
                    button.onClick.AddListener(async () => await OnPlatformButtonClicked(platformCopy));
                }
            }
        }

        private async Task OnPlatformButtonClicked(SocialPlatform platform)
        {
            if (sharingManager != null && currentContent != null)
            {
                switch (currentContent.type)
                {
                    case "achievement":
                        // Would need achievement data
                        break;
                    case "leaderboard":
                        // Would need leaderboard data
                        break;
                    case "research_milestone":
                        // Would need research data
                        break;
                    case "level_up":
                        // Would need level data
                        break;
                }

                Destroy(gameObject); // Close panel after sharing
            }
        }
    }

    [System.Serializable]
    public class GenerateImageResponse
    {
        public string imageUrl;
    }
}
