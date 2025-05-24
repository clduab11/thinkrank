using System;
using System.Collections.Generic;
using UnityEngine;
using System.Threading.Tasks;

namespace ThinkRank.Social
{
    [System.Serializable]
    public class Achievement
    {
        public string id;
        public string name;
        public string description;
        public string category;
        public AchievementRequirement requirements;
        public AchievementReward reward;
        public string rarity; // common, rare, epic, legendary
        public string icon;
        public bool isHidden;
        public bool isUnlocked;
        public string unlockedAt;
    }

    [System.Serializable]
    public class AchievementRequirement
    {
        public string type; // score, contributions, streak, level, research_quality, social
        public int threshold;
        public Dictionary<string, object> metadata;
    }

    [System.Serializable]
    public class AchievementReward
    {
        public string type; // badge, points, title
        public object value;
    }

    [System.Serializable]
    public class AchievementProgress
    {
        public string achievementId;
        public int currentValue;
        public int requiredValue;
        public float percentage;
        public bool isUnlocked;
        public string unlockedAt;
    }

    [System.Serializable]
    public class AchievementResponse
    {
        public List<Achievement> achievements;
        public int totalAchievements;
        public int unlockedCount;
    }

    [System.Serializable]
    public class AchievementProgressResponse
    {
        public List<AchievementProgress> progress;
    }

    public class AchievementManager : MonoBehaviour
    {
        [Header("Achievement Settings")]
        public bool enableAchievements = true;
        public float checkInterval = 30f; // Check for new achievements every 30 seconds
        public bool showNotifications = true;

        [Header("UI References")]
        public GameObject achievementNotificationPrefab;
        public Transform notificationParent;
        public GameObject achievementItemPrefab;
        public Transform achievementListParent;

        [Header("Achievement Categories")]
        public string[] categories = { "progress", "research", "engagement", "quality", "social" };

        // Events
        public static event Action<List<Achievement>> OnAchievementsLoaded;
        public static event Action<Achievement> OnAchievementUnlocked;
        public static event Action<List<AchievementProgress>> OnProgressUpdated;
        public static event Action<string> OnAchievementError;

        private List<Achievement> allAchievements = new List<Achievement>();
        private List<Achievement> userAchievements = new List<Achievement>();
        private List<AchievementProgress> achievementProgress = new List<AchievementProgress>();
        private float lastCheckTime;

        private void Start()
        {
            if (enableAchievements)
            {
                InitializeAchievements();
                InvokeRepeating(nameof(CheckForNewAchievements), checkInterval, checkInterval);
            }
        }

        private async void InitializeAchievements()
        {
            await LoadAvailableAchievements();
            await LoadUserAchievements();
            await LoadAchievementProgress();
        }

        public async Task LoadAvailableAchievements()
        {
            try
            {
                var achievementData = await APIManager.Instance.GetAvailableAchievements();
                if (achievementData != null)
                {
                    var response = JsonUtility.FromJson<AchievementResponse>(achievementData);
                    allAchievements = response.achievements;

                    Debug.Log($"Loaded {allAchievements.Count} available achievements");
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to load available achievements: {e.Message}");
                OnAchievementError?.Invoke("Failed to load achievements");
            }
        }

        public async Task LoadUserAchievements()
        {
            try
            {
                var userId = APIManager.Instance.GetCurrentUserId();
                var achievementData = await APIManager.Instance.GetUserAchievements(userId);

                if (achievementData != null)
                {
                    var response = JsonUtility.FromJson<AchievementResponse>(achievementData);
                    userAchievements = response.achievements;

                    OnAchievementsLoaded?.Invoke(userAchievements);
                    UpdateAchievementUI();

                    Debug.Log($"Loaded {userAchievements.Count} user achievements");
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to load user achievements: {e.Message}");
                OnAchievementError?.Invoke("Failed to load user achievements");
            }
        }

        public async Task LoadAchievementProgress()
        {
            try
            {
                var userId = APIManager.Instance.GetCurrentUserId();
                var progressData = await APIManager.Instance.GetAchievementProgress(userId);

                if (progressData != null)
                {
                    var response = JsonUtility.FromJson<AchievementProgressResponse>(progressData);
                    achievementProgress = response.progress;

                    OnProgressUpdated?.Invoke(achievementProgress);
                    UpdateProgressUI();

                    Debug.Log($"Loaded progress for {achievementProgress.Count} achievements");
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to load achievement progress: {e.Message}");
                OnAchievementError?.Invoke("Failed to load progress");
            }
        }

        public async Task CheckForNewAchievements()
        {
            if (Time.time - lastCheckTime < checkInterval)
                return;

            try
            {
                var userId = APIManager.Instance.GetCurrentUserId();
                var newAchievementsData = await APIManager.Instance.CheckAchievements(userId);

                if (newAchievementsData != null)
                {
                    var response = JsonUtility.FromJson<AchievementResponse>(newAchievementsData);

                    foreach (var achievement in response.achievements)
                    {
                        if (!IsAchievementUnlocked(achievement.id))
                        {
                            UnlockAchievement(achievement);
                        }
                    }
                }

                lastCheckTime = Time.time;
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to check for new achievements: {e.Message}");
            }
        }

        private void UnlockAchievement(Achievement achievement)
        {
            // Add to user achievements if not already there
            if (!userAchievements.Exists(a => a.id == achievement.id))
            {
                achievement.isUnlocked = true;
                achievement.unlockedAt = DateTime.Now.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");
                userAchievements.Add(achievement);

                OnAchievementUnlocked?.Invoke(achievement);

                if (showNotifications)
                {
                    ShowAchievementNotification(achievement);
                }

                // Play unlock sound/animation
                PlayAchievementUnlockFeedback(achievement);

                Debug.Log($"Achievement unlocked: {achievement.name}");
            }
        }

        private void ShowAchievementNotification(Achievement achievement)
        {
            if (achievementNotificationPrefab != null && notificationParent != null)
            {
                var notification = Instantiate(achievementNotificationPrefab, notificationParent);
                var notificationUI = notification.GetComponent<AchievementNotificationUI>();

                if (notificationUI != null)
                {
                    notificationUI.SetupNotification(achievement);
                }
            }
        }

        private void PlayAchievementUnlockFeedback(Achievement achievement)
        {
            // Play appropriate sound based on rarity
            string soundEffect = "achievement_" + achievement.rarity;
            AudioManager.Instance?.PlaySFX(soundEffect);

            // Trigger particle effect or screen flash
            // You could implement visual feedback here
        }

        private void UpdateAchievementUI()
        {
            if (achievementItemPrefab == null || achievementListParent == null)
                return;

            // Clear existing achievement items
            foreach (Transform child in achievementListParent)
            {
                Destroy(child.gameObject);
            }

            // Create achievement items for all achievements (locked and unlocked)
            foreach (var achievement in allAchievements)
            {
                var isUnlocked = IsAchievementUnlocked(achievement.id);
                var progress = GetAchievementProgress(achievement.id);

                CreateAchievementItem(achievement, isUnlocked, progress);
            }
        }

        private void UpdateProgressUI()
        {
            // Update existing achievement items with progress information
            var achievementItems = achievementListParent.GetComponentsInChildren<AchievementItemUI>();

            foreach (var item in achievementItems)
            {
                var progress = GetAchievementProgress(item.GetAchievementId());
                if (progress != null)
                {
                    item.UpdateProgress(progress);
                }
            }
        }

        private void CreateAchievementItem(Achievement achievement, bool isUnlocked, AchievementProgress progress)
        {
            var itemObj = Instantiate(achievementItemPrefab, achievementListParent);
            var itemUI = itemObj.GetComponent<AchievementItemUI>();

            if (itemUI != null)
            {
                itemUI.SetupAchievement(achievement, isUnlocked, progress);
            }
        }

        public bool IsAchievementUnlocked(string achievementId)
        {
            return userAchievements.Exists(a => a.id == achievementId);
        }

        public AchievementProgress GetAchievementProgress(string achievementId)
        {
            return achievementProgress.Find(p => p.achievementId == achievementId);
        }

        public Achievement GetAchievementById(string achievementId)
        {
            return allAchievements.Find(a => a.id == achievementId);
        }

        public List<Achievement> GetAchievementsByCategory(string category)
        {
            return allAchievements.FindAll(a => a.category == category);
        }

        public List<Achievement> GetUnlockedAchievements()
        {
            return userAchievements;
        }

        public int GetUnlockedCount()
        {
            return userAchievements.Count;
        }

        public int GetTotalCount()
        {
            return allAchievements.Count;
        }

        public float GetCompletionPercentage()
        {
            if (allAchievements.Count == 0) return 0f;
            return (float)userAchievements.Count / allAchievements.Count * 100f;
        }

        // UI Event Handlers
        public void OnCategoryFilterChanged(int categoryIndex)
        {
            if (categoryIndex >= 0 && categoryIndex < categories.Length)
            {
                FilterAchievementsByCategory(categories[categoryIndex]);
            }
            else if (categoryIndex == 0) // "All" category
            {
                ShowAllAchievements();
            }
        }

        private void FilterAchievementsByCategory(string category)
        {
            foreach (Transform child in achievementListParent)
            {
                var itemUI = child.GetComponent<AchievementItemUI>();
                if (itemUI != null)
                {
                    var achievement = GetAchievementById(itemUI.GetAchievementId());
                    child.gameObject.SetActive(achievement?.category == category);
                }
            }
        }

        private void ShowAllAchievements()
        {
            foreach (Transform child in achievementListParent)
            {
                child.gameObject.SetActive(true);
            }
        }

        public void OnRefreshButtonClicked()
        {
            InitializeAchievements();
        }

        private void OnDestroy()
        {
            CancelInvoke();
        }
    }

    // UI Component for achievement notifications
    public class AchievementNotificationUI : MonoBehaviour
    {
        [Header("UI References")]
        public TMPro.TextMeshProUGUI titleText;
        public TMPro.TextMeshProUGUI nameText;
        public TMPro.TextMeshProUGUI descriptionText;
        public UnityEngine.UI.Image iconImage;
        public UnityEngine.UI.Image rarityBorder;
        public float displayDuration = 3f;
        public float animationDuration = 0.5f;

        public void SetupNotification(Achievement achievement)
        {
            if (titleText != null)
                titleText.text = "Achievement Unlocked!";

            if (nameText != null)
                nameText.text = achievement.name;

            if (descriptionText != null)
                descriptionText.text = achievement.description;

            if (rarityBorder != null)
                rarityBorder.color = GetRarityColor(achievement.rarity);

            // Load achievement icon
            if (!string.IsNullOrEmpty(achievement.icon))
            {
                StartCoroutine(LoadAchievementIcon(achievement.icon));
            }

            // Animate notification
            StartCoroutine(AnimateNotification());
        }

        private Color GetRarityColor(string rarity)
        {
            switch (rarity?.ToLower())
            {
                case "common": return Color.gray;
                case "rare": return Color.blue;
                case "epic": return Color.magenta;
                case "legendary": return Color.yellow;
                default: return Color.white;
            }
        }

        private System.Collections.IEnumerator LoadAchievementIcon(string iconPath)
        {
            // In a real implementation, you'd load the icon from resources or URL
            // For now, we'll just use a placeholder
            yield return null;
        }

        private System.Collections.IEnumerator AnimateNotification()
        {
            // Slide in animation
            var startPos = transform.position + Vector3.right * 500f;
            var targetPos = transform.position;

            float elapsed = 0f;
            while (elapsed < animationDuration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / animationDuration;
                transform.position = Vector3.Lerp(startPos, targetPos, t);
                yield return null;
            }

            // Wait for display duration
            yield return new WaitForSeconds(displayDuration);

            // Slide out animation
            var endPos = targetPos + Vector3.right * 500f;
            elapsed = 0f;
            while (elapsed < animationDuration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / animationDuration;
                transform.position = Vector3.Lerp(targetPos, endPos, t);
                yield return null;
            }

            Destroy(gameObject);
        }
    }

    // UI Component for achievement list items
    public class AchievementItemUI : MonoBehaviour
    {
        [Header("UI References")]
        public TMPro.TextMeshProUGUI nameText;
        public TMPro.TextMeshProUGUI descriptionText;
        public TMPro.TextMeshProUGUI progressText;
        public UnityEngine.UI.Image iconImage;
        public UnityEngine.UI.Image rarityBorder;
        public UnityEngine.UI.Slider progressBar;
        public GameObject lockedOverlay;
        public GameObject unlockedCheckmark;

        private string achievementId;

        public void SetupAchievement(Achievement achievement, bool isUnlocked, AchievementProgress progress)
        {
            achievementId = achievement.id;

            if (nameText != null)
                nameText.text = achievement.name;

            if (descriptionText != null)
                descriptionText.text = achievement.isHidden && !isUnlocked ? "???" : achievement.description;

            if (rarityBorder != null)
                rarityBorder.color = GetRarityColor(achievement.rarity);

            if (lockedOverlay != null)
                lockedOverlay.SetActive(!isUnlocked);

            if (unlockedCheckmark != null)
                unlockedCheckmark.SetActive(isUnlocked);

            UpdateProgress(progress);
        }

        public void UpdateProgress(AchievementProgress progress)
        {
            if (progress == null) return;

            if (progressText != null)
            {
                progressText.text = $"{progress.currentValue}/{progress.requiredValue}";
            }

            if (progressBar != null)
            {
                progressBar.value = progress.percentage / 100f;
            }
        }

        private Color GetRarityColor(string rarity)
        {
            switch (rarity?.ToLower())
            {
                case "common": return Color.gray;
                case "rare": return Color.blue;
                case "epic": return Color.magenta;
                case "legendary": return Color.yellow;
                default: return Color.white;
            }
        }

        public string GetAchievementId()
        {
            return achievementId;
        }
    }
}
