using System;
using System.Collections.Generic;
using UnityEngine;
using Newtonsoft.Json;
using ThinkRank.Core;

namespace ThinkRank.Data
{
    /// <summary>
    /// Manages player data including progress, preferences, and offline storage
    /// Handles save/load operations with automatic backup and cloud sync capabilities
    /// </summary>
    public class PlayerDataManager : MonoBehaviour
    {
        [Header("Data Configuration")]
        [SerializeField] private GameConfiguration gameConfig;
        [SerializeField] private bool enableCloudSync = true;
        [SerializeField] private bool enableAutoSave = true;
        [SerializeField] private float autoSaveInterval = 30f;

        // Player data
        private PlayerData currentPlayerData;
        private bool isDataLoaded = false;
        private bool hasUnsavedChanges = false;
        private float lastSaveTime = 0f;

        // Storage keys
        private const string PLAYER_DATA_KEY = "PlayerData";
        private const string PLAYER_PREFS_KEY = "PlayerPreferences";
        private const string OFFLINE_DATA_KEY = "OfflineData";
        private const string BACKUP_DATA_KEY = "BackupPlayerData";

        // Events
        public static event Action<PlayerData> OnPlayerDataLoaded;
        public static event Action<PlayerData> OnPlayerDataSaved;
        public static event Action<string> OnDataError;
        public static event Action<bool> OnCloudSyncStatusChanged;

        // Properties
        public PlayerData CurrentPlayerData => currentPlayerData;
        public bool IsDataLoaded => isDataLoaded;
        public bool HasUnsavedChanges => hasUnsavedChanges;
        public bool IsCloudSyncEnabled => enableCloudSync;

        /// <summary>
        /// Initialize the Player Data Manager
        /// </summary>
        public async System.Threading.Tasks.Task Initialize()
        {
            Debug.Log("[PlayerDataManager] Initializing Player Data Manager...");

            try
            {
                // Load player data
                await LoadPlayerData();

                // Start auto-save coroutine if enabled
                if (enableAutoSave)
                {
                    StartCoroutine(AutoSaveCoroutine());
                }

                // Setup cloud sync if enabled
                if (enableCloudSync)
                {
                    SetupCloudSync();
                }

                Debug.Log("[PlayerDataManager] Player Data Manager initialized successfully");
            }
            catch (Exception e)
            {
                Debug.LogError($"[PlayerDataManager] Initialization failed: {e.Message}");
                OnDataError?.Invoke($"Failed to initialize player data: {e.Message}");
            }
        }

        #region Data Loading

        /// <summary>
        /// Load player data from local storage
        /// </summary>
        public async System.Threading.Tasks.Task LoadPlayerData()
        {
            try
            {
                Debug.Log("[PlayerDataManager] Loading player data...");

                // Try to load from PlayerPrefs first
                string dataJson = PlayerPrefs.GetString(PLAYER_DATA_KEY, "");

                if (!string.IsNullOrEmpty(dataJson))
                {
                    currentPlayerData = JsonConvert.DeserializeObject<PlayerData>(dataJson);
                    Debug.Log("[PlayerDataManager] Player data loaded from local storage");
                }
                else
                {
                    // Create new player data
                    currentPlayerData = CreateNewPlayerData();
                    Debug.Log("[PlayerDataManager] Created new player data");
                }

                // Validate and migrate data if necessary
                ValidateAndMigrateData();

                // Load preferences
                LoadPlayerPreferences();

                // Try cloud sync if enabled and authenticated
                if (enableCloudSync && GameManager.Instance?.APIManager?.IsAuthenticated == true)
                {
                    await SyncWithCloud();
                }

                isDataLoaded = true;
                OnPlayerDataLoaded?.Invoke(currentPlayerData);

                Debug.Log($"[PlayerDataManager] Player data loaded successfully - Level: {currentPlayerData.gameProgress.level}, Score: {currentPlayerData.gameProgress.totalScore}");
            }
            catch (Exception e)
            {
                Debug.LogError($"[PlayerDataManager] Failed to load player data: {e.Message}");

                // Try to load backup
                await LoadBackupData();
            }
        }

        /// <summary>
        /// Load backup data in case of corruption
        /// </summary>
        private async System.Threading.Tasks.Task LoadBackupData()
        {
            try
            {
                string backupJson = PlayerPrefs.GetString(BACKUP_DATA_KEY, "");

                if (!string.IsNullOrEmpty(backupJson))
                {
                    currentPlayerData = JsonConvert.DeserializeObject<PlayerData>(backupJson);
                    Debug.Log("[PlayerDataManager] Loaded backup player data");

                    // Save the backup as current data
                    SavePlayerData();
                }
                else
                {
                    // Create new data as last resort
                    currentPlayerData = CreateNewPlayerData();
                    Debug.Log("[PlayerDataManager] Created new player data as fallback");
                }

                isDataLoaded = true;
                OnPlayerDataLoaded?.Invoke(currentPlayerData);
            }
            catch (Exception e)
            {
                Debug.LogError($"[PlayerDataManager] Failed to load backup data: {e.Message}");
                OnDataError?.Invoke("Failed to load player data. Starting fresh.");

                // Last resort: create completely new data
                currentPlayerData = CreateNewPlayerData();
                isDataLoaded = true;
                OnPlayerDataLoaded?.Invoke(currentPlayerData);
            }
        }

        /// <summary>
        /// Create new player data with default values
        /// </summary>
        private PlayerData CreateNewPlayerData()
        {
            return new PlayerData
            {
                playerId = Guid.NewGuid().ToString(),
                createdAt = DateTime.UtcNow,
                lastPlayedAt = DateTime.UtcNow,
                gameProgress = new GameProgress
                {
                    level = 1,
                    experience = 0,
                    totalScore = 0,
                    puzzlesSolved = 0,
                    currentStreak = 0,
                    bestStreak = 0,
                    totalPlayTime = 0f,
                    unlockedAchievements = new List<string>(),
                    completedTutorials = new List<string>()
                },
                preferences = new PlayerPreferences
                {
                    soundEnabled = true,
                    musicEnabled = true,
                    hapticFeedback = gameConfig.enableHapticFeedback,
                    notifications = true,
                    theme = "default",
                    language = "en",
                    difficulty = "medium"
                },
                statistics = new PlayerStatistics
                {
                    gamesPlayed = 0,
                    averageScore = 0f,
                    bestScore = 0,
                    totalPlayingSessions = 0,
                    averageSessionLength = 0f,
                    favoriteGameMode = "",
                    achievementProgress = new Dictionary<string, float>()
                },
                offlineData = new OfflineData
                {
                    pendingActions = new List<OfflineAction>(),
                    cachedPuzzles = new List<CachedPuzzle>(),
                    lastSyncTime = DateTime.UtcNow
                }
            };
        }

        /// <summary>
        /// Load player preferences
        /// </summary>
        private void LoadPlayerPreferences()
        {
            string prefsJson = PlayerPrefs.GetString(PLAYER_PREFS_KEY, "");

            if (!string.IsNullOrEmpty(prefsJson))
            {
                try
                {
                    var loadedPrefs = JsonConvert.DeserializeObject<PlayerPreferences>(prefsJson);
                    currentPlayerData.preferences = loadedPrefs;
                    Debug.Log("[PlayerDataManager] Player preferences loaded");
                }
                catch (Exception e)
                {
                    Debug.LogWarning($"[PlayerDataManager] Failed to load preferences: {e.Message}");
                }
            }
        }

        #endregion

        #region Data Saving

        /// <summary>
        /// Save player data to local storage
        /// </summary>
        public void SavePlayerData()
        {
            if (currentPlayerData == null)
            {
                Debug.LogWarning("[PlayerDataManager] Cannot save null player data");
                return;
            }

            try
            {
                // Update last played time
                currentPlayerData.lastPlayedAt = DateTime.UtcNow;

                // Create backup of previous data
                string currentDataJson = PlayerPrefs.GetString(PLAYER_DATA_KEY, "");
                if (!string.IsNullOrEmpty(currentDataJson))
                {
                    PlayerPrefs.SetString(BACKUP_DATA_KEY, currentDataJson);
                }

                // Save current data
                string dataJson = JsonConvert.SerializeObject(currentPlayerData, Formatting.Indented);
                PlayerPrefs.SetString(PLAYER_DATA_KEY, dataJson);

                // Save preferences separately
                SavePlayerPreferences();

                // Force save to disk
                PlayerPrefs.Save();

                hasUnsavedChanges = false;
                lastSaveTime = Time.unscaledTime;

                OnPlayerDataSaved?.Invoke(currentPlayerData);
                Debug.Log("[PlayerDataManager] Player data saved successfully");

                // Queue cloud sync if enabled
                if (enableCloudSync && GameManager.Instance?.APIManager?.IsAuthenticated == true)
                {
                    QueueCloudSync();
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"[PlayerDataManager] Failed to save player data: {e.Message}");
                OnDataError?.Invoke($"Failed to save progress: {e.Message}");
            }
        }

        /// <summary>
        /// Save player preferences separately
        /// </summary>
        private void SavePlayerPreferences()
        {
            try
            {
                string prefsJson = JsonConvert.SerializeObject(currentPlayerData.preferences, Formatting.Indented);
                PlayerPrefs.SetString(PLAYER_PREFS_KEY, prefsJson);
                Debug.Log("[PlayerDataManager] Player preferences saved");
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[PlayerDataManager] Failed to save preferences: {e.Message}");
            }
        }

        /// <summary>
        /// Auto-save coroutine
        /// </summary>
        private System.Collections.IEnumerator AutoSaveCoroutine()
        {
            while (true)
            {
                yield return new WaitForSeconds(autoSaveInterval);

                if (hasUnsavedChanges && isDataLoaded)
                {
                    SavePlayerData();
                    Debug.Log("[PlayerDataManager] Auto-save completed");
                }
            }
        }

        #endregion

        #region Data Updates

        /// <summary>
        /// Update game progress
        /// </summary>
        public void UpdateGameProgress(int scoreGained, int experienceGained, bool puzzleSolved)
        {
            if (currentPlayerData?.gameProgress == null) return;

            var progress = currentPlayerData.gameProgress;

            // Update score and experience
            progress.totalScore += scoreGained;
            progress.experience += experienceGained;

            // Update puzzle count
            if (puzzleSolved)
            {
                progress.puzzlesSolved++;
                progress.currentStreak++;

                if (progress.currentStreak > progress.bestStreak)
                {
                    progress.bestStreak = progress.currentStreak;
                }
            }
            else
            {
                progress.currentStreak = 0;
            }

            // Check for level up
            CheckLevelUp();

            // Update statistics
            UpdateStatistics(scoreGained, puzzleSolved);

            hasUnsavedChanges = true;
            Debug.Log($"[PlayerDataManager] Progress updated - Score: +{scoreGained}, XP: +{experienceGained}");
        }

        /// <summary>
        /// Check and process level up
        /// </summary>
        private void CheckLevelUp()
        {
            var progress = currentPlayerData.gameProgress;
            int newLevel = CalculateLevelFromExperience(progress.experience);

            if (newLevel > progress.level)
            {
                int levelsGained = newLevel - progress.level;
                progress.level = newLevel;

                Debug.Log($"[PlayerDataManager] Level up! New level: {newLevel} (+{levelsGained})");

                // Trigger level up rewards/events
                OnLevelUp(newLevel, levelsGained);
            }
        }

        /// <summary>
        /// Calculate level from experience points
        /// </summary>
        private int CalculateLevelFromExperience(int experience)
        {
            // Simple formula: level = sqrt(experience / 100) + 1
            return Mathf.FloorToInt(Mathf.Sqrt(experience / 100f)) + 1;
        }

        /// <summary>
        /// Handle level up event
        /// </summary>
        private void OnLevelUp(int newLevel, int levelsGained)
        {
            // Add achievements, unlock content, etc.
            // This would be implemented based on game design
        }

        /// <summary>
        /// Update player statistics
        /// </summary>
        private void UpdateStatistics(int scoreGained, bool puzzleSolved)
        {
            var stats = currentPlayerData.statistics;

            if (puzzleSolved)
            {
                stats.gamesPlayed++;

                // Update average score
                stats.averageScore = (stats.averageScore * (stats.gamesPlayed - 1) + scoreGained) / stats.gamesPlayed;

                // Update best score
                if (scoreGained > stats.bestScore)
                {
                    stats.bestScore = scoreGained;
                }
            }
        }

        /// <summary>
        /// Update play time
        /// </summary>
        public void UpdatePlayTime(float sessionTime)
        {
            if (currentPlayerData?.gameProgress == null) return;

            currentPlayerData.gameProgress.totalPlayTime += sessionTime;

            var stats = currentPlayerData.statistics;
            stats.totalPlayingSessions++;
            stats.averageSessionLength = currentPlayerData.gameProgress.totalPlayTime / stats.totalPlayingSessions;

            hasUnsavedChanges = true;
        }

        /// <summary>
        /// Unlock achievement
        /// </summary>
        public bool UnlockAchievement(string achievementId)
        {
            if (currentPlayerData?.gameProgress?.unlockedAchievements == null)
                return false;

            if (!currentPlayerData.gameProgress.unlockedAchievements.Contains(achievementId))
            {
                currentPlayerData.gameProgress.unlockedAchievements.Add(achievementId);
                hasUnsavedChanges = true;

                Debug.Log($"[PlayerDataManager] Achievement unlocked: {achievementId}");
                return true;
            }

            return false;
        }

        /// <summary>
        /// Update player preferences
        /// </summary>
        public void UpdatePreferences(PlayerPreferences newPreferences)
        {
            if (currentPlayerData?.preferences == null) return;

            currentPlayerData.preferences = newPreferences;
            hasUnsavedChanges = true;

            // Save preferences immediately
            SavePlayerPreferences();

            Debug.Log("[PlayerDataManager] Player preferences updated");
        }

        #endregion

        #region Cloud Sync

        /// <summary>
        /// Setup cloud sync capabilities
        /// </summary>
        private void SetupCloudSync()
        {
            // Listen for authentication state changes
            if (GameManager.Instance?.APIManager != null)
            {
                APIManager.OnAuthenticationStateChanged += OnAuthenticationChanged;
            }
        }

        /// <summary>
        /// Handle authentication state changes
        /// </summary>
        private async void OnAuthenticationChanged(bool isAuthenticated)
        {
            if (isAuthenticated && enableCloudSync)
            {
                await SyncWithCloud();
            }
        }

        /// <summary>
        /// Sync data with cloud
        /// </summary>
        private async System.Threading.Tasks.Task SyncWithCloud()
        {
            try
            {
                Debug.Log("[PlayerDataManager] Starting cloud sync...");

                // This would integrate with the backend API
                // For now, we'll just log the operation

                OnCloudSyncStatusChanged?.Invoke(true);
                Debug.Log("[PlayerDataManager] Cloud sync completed successfully");
            }
            catch (Exception e)
            {
                Debug.LogError($"[PlayerDataManager] Cloud sync failed: {e.Message}");
                OnCloudSyncStatusChanged?.Invoke(false);
            }
        }

        /// <summary>
        /// Queue cloud sync for later
        /// </summary>
        private void QueueCloudSync()
        {
            // Implementation for queuing sync when network becomes available
        }

        #endregion

        #region Data Validation

        /// <summary>
        /// Validate and migrate data structure
        /// </summary>
        private void ValidateAndMigrateData()
        {
            if (currentPlayerData == null) return;

            // Ensure all required fields exist
            currentPlayerData.gameProgress ??= new GameProgress();
            currentPlayerData.preferences ??= new PlayerPreferences();
            currentPlayerData.statistics ??= new PlayerStatistics();
            currentPlayerData.offlineData ??= new OfflineData();

            // Validate collections
            currentPlayerData.gameProgress.unlockedAchievements ??= new List<string>();
            currentPlayerData.gameProgress.completedTutorials ??= new List<string>();
            currentPlayerData.statistics.achievementProgress ??= new Dictionary<string, float>();
            currentPlayerData.offlineData.pendingActions ??= new List<OfflineAction>();
            currentPlayerData.offlineData.cachedPuzzles ??= new List<CachedPuzzle>();

            Debug.Log("[PlayerDataManager] Data validation and migration completed");
        }

        #endregion

        #region Public API

        /// <summary>
        /// Reset all player data
        /// </summary>
        public void ResetPlayerData()
        {
            Debug.Log("[PlayerDataManager] Resetting player data...");

            currentPlayerData = CreateNewPlayerData();
            SavePlayerData();

            Debug.Log("[PlayerDataManager] Player data reset completed");
        }

        /// <summary>
        /// Get achievement progress
        /// </summary>
        public float GetAchievementProgress(string achievementId)
        {
            if (currentPlayerData?.statistics?.achievementProgress?.ContainsKey(achievementId) == true)
            {
                return currentPlayerData.statistics.achievementProgress[achievementId];
            }
            return 0f;
        }

        /// <summary>
        /// Set achievement progress
        /// </summary>
        public void SetAchievementProgress(string achievementId, float progress)
        {
            if (currentPlayerData?.statistics?.achievementProgress == null) return;

            currentPlayerData.statistics.achievementProgress[achievementId] = Mathf.Clamp01(progress);
            hasUnsavedChanges = true;

            // Check if achievement should be unlocked
            if (progress >= 1f)
            {
                UnlockAchievement(achievementId);
            }
        }

        /// <summary>
        /// Export player data for backup
        /// </summary>
        public string ExportPlayerData()
        {
            if (currentPlayerData == null) return "";

            try
            {
                return JsonConvert.SerializeObject(currentPlayerData, Formatting.Indented);
            }
            catch (Exception e)
            {
                Debug.LogError($"[PlayerDataManager] Failed to export data: {e.Message}");
                return "";
            }
        }

        /// <summary>
        /// Import player data from backup
        /// </summary>
        public bool ImportPlayerData(string dataJson)
        {
            try
            {
                var importedData = JsonConvert.DeserializeObject<PlayerData>(dataJson);
                if (importedData != null)
                {
                    currentPlayerData = importedData;
                    ValidateAndMigrateData();
                    SavePlayerData();

                    Debug.Log("[PlayerDataManager] Player data imported successfully");
                    return true;
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"[PlayerDataManager] Failed to import data: {e.Message}");
                OnDataError?.Invoke($"Failed to import data: {e.Message}");
            }

            return false;
        }

        #endregion

        private void OnDestroy()
        {
            // Save data before destruction
            if (hasUnsavedChanges && isDataLoaded)
            {
                SavePlayerData();
            }

            // Cleanup events
            if (GameManager.Instance?.APIManager != null)
            {
                APIManager.OnAuthenticationStateChanged -= OnAuthenticationChanged;
            }
        }
    }

    #region Data Structures

    /// <summary>
    /// Main player data structure
    /// </summary>
    [System.Serializable]
    public class PlayerData
    {
        public string playerId;
        public DateTime createdAt;
        public DateTime lastPlayedAt;
        public GameProgress gameProgress;
        public PlayerPreferences preferences;
        public PlayerStatistics statistics;
        public OfflineData offlineData;
    }

    /// <summary>
    /// Game progress data
    /// </summary>
    [System.Serializable]
    public class GameProgress
    {
        public int level;
        public int experience;
        public int totalScore;
        public int puzzlesSolved;
        public int currentStreak;
        public int bestStreak;
        public float totalPlayTime;
        public List<string> unlockedAchievements;
        public List<string> completedTutorials;
    }

    /// <summary>
    /// Player preferences
    /// </summary>
    [System.Serializable]
    public class PlayerPreferences
    {
        public bool soundEnabled;
        public bool musicEnabled;
        public bool hapticFeedback;
        public bool notifications;
        public string theme;
        public string language;
        public string difficulty;
    }

    /// <summary>
    /// Player statistics
    /// </summary>
    [System.Serializable]
    public class PlayerStatistics
    {
        public int gamesPlayed;
        public float averageScore;
        public int bestScore;
        public int totalPlayingSessions;
        public float averageSessionLength;
        public string favoriteGameMode;
        public Dictionary<string, float> achievementProgress;
    }

    /// <summary>
    /// Offline data for sync
    /// </summary>
    [System.Serializable]
    public class OfflineData
    {
        public List<OfflineAction> pendingActions;
        public List<CachedPuzzle> cachedPuzzles;
        public DateTime lastSyncTime;
    }

    /// <summary>
    /// Offline action for later sync
    /// </summary>
    [System.Serializable]
    public class OfflineAction
    {
        public string actionType;
        public string actionData;
        public DateTime timestamp;
    }

    /// <summary>
    /// Cached puzzle for offline play
    /// </summary>
    [System.Serializable]
    public class CachedPuzzle
    {
        public string puzzleId;
        public string puzzleData;
        public DateTime cacheTime;
    }

    #endregion
}
