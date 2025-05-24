using System;
using System.Collections.Generic;
using UnityEngine;
using System.Threading.Tasks;

namespace ThinkRank.Social
{
    [System.Serializable]
    public class LeaderboardEntry
    {
        public string userId;
        public string username;
        public string displayName;
        public string avatar;
        public int score;
        public int level;
        public int rank;
        public int contributions;
        public List<string> achievements;
        public string subscriptionTier;
    }

    [System.Serializable]
    public class LeaderboardResponse
    {
        public List<LeaderboardEntry> entries;
        public int totalEntries;
        public string category;
        public string timeframe;
    }

    [System.Serializable]
    public class UserRankData
    {
        public int globalRank;
        public int categoryRank;
        public int totalUsers;
    }

    public enum LeaderboardCategory
    {
        Global,
        BiasDetection,
        Alignment,
        ContextEvaluation
    }

    public enum LeaderboardTimeframe
    {
        Daily,
        Weekly,
        Monthly,
        AllTime
    }

    public class LeaderboardManager : MonoBehaviour
    {
        [Header("Leaderboard Settings")]
        public int entriesPerPage = 20;
        public float refreshInterval = 300f; // 5 minutes
        public bool showFriendsOnly = false;

        [Header("UI References")]
        public GameObject leaderboardEntryPrefab;
        public Transform leaderboardContainer;
        public TMPro.TextMeshProUGUI categoryLabel;
        public TMPro.TextMeshProUGUI timeframeLabel;
        public TMPro.TextMeshProUGUI userRankText;

        // Events
        public static event Action<List<LeaderboardEntry>> OnLeaderboardLoaded;
        public static event Action<UserRankData> OnUserRankLoaded;
        public static event Action<string> OnLeaderboardError;

        private Dictionary<string, LeaderboardResponse> cachedLeaderboards = new Dictionary<string, LeaderboardResponse>();
        private LeaderboardCategory currentCategory = LeaderboardCategory.Global;
        private LeaderboardTimeframe currentTimeframe = LeaderboardTimeframe.AllTime;
        private float lastRefreshTime;
        private UserRankData currentUserRank;

        private void Start()
        {
            LoadLeaderboard(currentCategory, currentTimeframe);
            InvokeRepeating(nameof(RefreshLeaderboardIfNeeded), refreshInterval, refreshInterval);
        }

        public async Task LoadLeaderboard(LeaderboardCategory category, LeaderboardTimeframe timeframe)
        {
            currentCategory = category;
            currentTimeframe = timeframe;

            string cacheKey = $"{category}_{timeframe}_{showFriendsOnly}";

            // Check cache first
            if (cachedLeaderboards.ContainsKey(cacheKey) &&
                Time.time - lastRefreshTime < refreshInterval)
            {
                var cached = cachedLeaderboards[cacheKey];
                OnLeaderboardLoaded?.Invoke(cached.entries);
                UpdateUI(cached);
                return;
            }

            try
            {
                string leaderboardData;

                if (showFriendsOnly)
                {
                    leaderboardData = await APIManager.Instance.GetFriendsLeaderboard();
                }
                else if (category == LeaderboardCategory.Global)
                {
                    leaderboardData = await APIManager.Instance.GetGlobalLeaderboard(
                        timeframe.ToString().ToLower(),
                        entriesPerPage
                    );
                }
                else
                {
                    leaderboardData = await APIManager.Instance.GetCategoryLeaderboard(
                        category.ToString().ToLower(),
                        timeframe.ToString().ToLower(),
                        entriesPerPage
                    );
                }

                if (leaderboardData != null)
                {
                    var response = JsonUtility.FromJson<LeaderboardResponse>(leaderboardData);
                    cachedLeaderboards[cacheKey] = response;
                    lastRefreshTime = Time.time;

                    OnLeaderboardLoaded?.Invoke(response.entries);
                    UpdateUI(response);

                    Debug.Log($"Loaded {response.entries.Count} leaderboard entries for {category}");
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to load leaderboard: {e.Message}");
                OnLeaderboardError?.Invoke("Failed to load leaderboard");
            }
        }

        public async Task LoadUserRank(string userId, LeaderboardCategory? category = null)
        {
            try
            {
                string rankData;

                if (category.HasValue && category.Value != LeaderboardCategory.Global)
                {
                    rankData = await APIManager.Instance.GetUserCategoryRank(userId, category.Value.ToString().ToLower());
                }
                else
                {
                    rankData = await APIManager.Instance.GetUserRank(userId);
                }

                if (rankData != null)
                {
                    currentUserRank = JsonUtility.FromJson<UserRankData>(rankData);
                    OnUserRankLoaded?.Invoke(currentUserRank);
                    UpdateUserRankDisplay();
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to load user rank: {e.Message}");
                OnLeaderboardError?.Invoke("Failed to load rank");
            }
        }

        public void SetCategory(LeaderboardCategory category)
        {
            if (currentCategory != category)
            {
                LoadLeaderboard(category, currentTimeframe);
            }
        }

        public void SetTimeframe(LeaderboardTimeframe timeframe)
        {
            if (currentTimeframe != timeframe)
            {
                LoadLeaderboard(currentCategory, timeframe);
            }
        }

        public void ToggleFriendsOnly()
        {
            showFriendsOnly = !showFriendsOnly;
            LoadLeaderboard(currentCategory, currentTimeframe);
        }

        public void RefreshLeaderboard()
        {
            // Force refresh by clearing cache
            string cacheKey = $"{currentCategory}_{currentTimeframe}_{showFriendsOnly}";
            if (cachedLeaderboards.ContainsKey(cacheKey))
            {
                cachedLeaderboards.Remove(cacheKey);
            }

            LoadLeaderboard(currentCategory, currentTimeframe);
        }

        private void RefreshLeaderboardIfNeeded()
        {
            if (Time.time - lastRefreshTime >= refreshInterval)
            {
                RefreshLeaderboard();
            }
        }

        private void UpdateUI(LeaderboardResponse response)
        {
            // Update category and timeframe labels
            if (categoryLabel != null)
            {
                string categoryText = showFriendsOnly ? "Friends" : currentCategory.ToString();
                categoryLabel.text = categoryText;
            }

            if (timeframeLabel != null)
            {
                timeframeLabel.text = currentTimeframe.ToString();
            }

            // Clear existing entries
            foreach (Transform child in leaderboardContainer)
            {
                Destroy(child.gameObject);
            }

            // Create new entries
            foreach (var entry in response.entries)
            {
                CreateLeaderboardEntry(entry);
            }
        }

        private void CreateLeaderboardEntry(LeaderboardEntry entry)
        {
            if (leaderboardEntryPrefab == null || leaderboardContainer == null)
                return;

            var entryObj = Instantiate(leaderboardEntryPrefab, leaderboardContainer);
            var entryUI = entryObj.GetComponent<LeaderboardEntryUI>();

            if (entryUI != null)
            {
                entryUI.SetupEntry(entry);
            }
        }

        private void UpdateUserRankDisplay()
        {
            if (userRankText != null && currentUserRank != null)
            {
                string rankText = currentCategory == LeaderboardCategory.Global
                    ? $"Global Rank: #{currentUserRank.globalRank:N0}"
                    : $"Category Rank: #{currentUserRank.categoryRank:N0}";

                userRankText.text = rankText;
            }
        }

        public LeaderboardEntry GetEntryByUserId(string userId)
        {
            string cacheKey = $"{currentCategory}_{currentTimeframe}_{showFriendsOnly}";

            if (cachedLeaderboards.ContainsKey(cacheKey))
            {
                var leaderboard = cachedLeaderboards[cacheKey];
                return leaderboard.entries.Find(e => e.userId == userId);
            }

            return null;
        }

        public int GetUserPosition(string userId)
        {
            var entry = GetEntryByUserId(userId);
            return entry?.rank ?? -1;
        }

        public void ClearCache()
        {
            cachedLeaderboards.Clear();
            lastRefreshTime = 0f;
        }

        // UI Event Handlers
        public void OnCategoryButtonClicked(int categoryIndex)
        {
            if (categoryIndex >= 0 && categoryIndex < System.Enum.GetValues(typeof(LeaderboardCategory)).Length)
            {
                SetCategory((LeaderboardCategory)categoryIndex);
            }
        }

        public void OnTimeframeButtonClicked(int timeframeIndex)
        {
            if (timeframeIndex >= 0 && timeframeIndex < System.Enum.GetValues(typeof(LeaderboardTimeframe)).Length)
            {
                SetTimeframe((LeaderboardTimeframe)timeframeIndex);
            }
        }

        public void OnFriendsToggleClicked()
        {
            ToggleFriendsOnly();
        }

        public void OnRefreshButtonClicked()
        {
            RefreshLeaderboard();
        }

        private void OnDestroy()
        {
            ClearCache();
            CancelInvoke();
        }
    }

    // UI Component for individual leaderboard entries
    public class LeaderboardEntryUI : MonoBehaviour
    {
        [Header("UI References")]
        public TMPro.TextMeshProUGUI rankText;
        public TMPro.TextMeshProUGUI usernameText;
        public TMPro.TextMeshProUGUI scoreText;
        public TMPro.TextMeshProUGUI levelText;
        public UnityEngine.UI.Image avatarImage;
        public UnityEngine.UI.Image tierBadge;
        public GameObject[] achievementIcons;
        public UnityEngine.UI.Button profileButton;

        private LeaderboardEntry entryData;

        public void SetupEntry(LeaderboardEntry entry)
        {
            entryData = entry;

            if (rankText != null)
                rankText.text = $"#{entry.rank}";

            if (usernameText != null)
                usernameText.text = !string.IsNullOrEmpty(entry.displayName) ? entry.displayName : entry.username;

            if (scoreText != null)
                scoreText.text = entry.score.ToString("N0");

            if (levelText != null)
                levelText.text = $"Lvl {entry.level}";

            // Set tier badge color
            if (tierBadge != null)
            {
                tierBadge.color = GetTierColor(entry.subscriptionTier);
            }

            // Setup achievements display
            SetupAchievements(entry.achievements);

            // Setup profile button
            if (profileButton != null)
            {
                profileButton.onClick.RemoveAllListeners();
                profileButton.onClick.AddListener(() => OnProfileButtonClicked());
            }

            // Load avatar if available
            if (!string.IsNullOrEmpty(entry.avatar))
            {
                StartCoroutine(LoadAvatar(entry.avatar));
            }
        }

        private Color GetTierColor(string tier)
        {
            switch (tier?.ToLower())
            {
                case "free": return Color.gray;
                case "premium": return new Color(0.2f, 0.6f, 1f); // Blue
                case "pro": return new Color(1f, 0.8f, 0f); // Gold
                default: return Color.white;
            }
        }

        private void SetupAchievements(List<string> achievements)
        {
            if (achievementIcons == null) return;

            // Hide all achievement icons first
            foreach (var icon in achievementIcons)
            {
                icon.SetActive(false);
            }

            // Show achievements up to available slots
            for (int i = 0; i < Mathf.Min(achievements?.Count ?? 0, achievementIcons.Length); i++)
            {
                achievementIcons[i].SetActive(true);
                // Here you could set specific achievement icons based on achievement IDs
            }
        }

        private System.Collections.IEnumerator LoadAvatar(string avatarUrl)
        {
            if (avatarImage == null) yield break;

            using (var www = UnityEngine.Networking.UnityWebRequestTexture.GetTexture(avatarUrl))
            {
                yield return www.SendWebRequest();

                if (www.result == UnityEngine.Networking.UnityWebRequest.Result.Success)
                {
                    var texture = UnityEngine.Networking.DownloadHandlerTexture.GetContent(www);
                    var sprite = Sprite.Create(texture, new Rect(0, 0, texture.width, texture.height), Vector2.one * 0.5f);
                    avatarImage.sprite = sprite;
                }
            }
        }

        private void OnProfileButtonClicked()
        {
            if (entryData != null)
            {
                // Open user profile or send event
                Debug.Log($"Opening profile for user: {entryData.username}");
                // You could trigger a profile view event here
            }
        }
    }
}
