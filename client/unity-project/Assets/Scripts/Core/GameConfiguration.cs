using UnityEngine;

namespace ThinkRank.Core
{
    /// <summary>
    /// ScriptableObject configuration for game settings and parameters
    /// Allows for easy tweaking of game values without code changes
    /// </summary>
    [CreateAssetMenu(fileName = "GameConfiguration", menuName = "ThinkRank/Game Configuration")]
    public class GameConfiguration : ScriptableObject
    {
        [Header("Performance Settings")]
        [SerializeField] [Range(30, 120)] public int targetFrameRate = 60;
        [SerializeField] public bool enablePerformanceMonitoring = true;
        [SerializeField] [Range(0.1f, 2.0f)] public float performanceWarningThreshold = 0.8f;

        [Header("API Configuration")]
        [SerializeField] public string apiBaseUrl = "https://api.thinkrank.com";
        [SerializeField] public string authServiceEndpoint = "/auth";
        [SerializeField] public string gameServiceEndpoint = "/game";
        [SerializeField] [Range(5, 60)] public int requestTimeoutSeconds = 30;
        [SerializeField] [Range(1, 5)] public int maxRetryAttempts = 3;

        [Header("Authentication Settings")]
        [SerializeField] public bool rememberUserLogin = true;
        [SerializeField] [Range(1, 30)] public int tokenRefreshDays = 7;
        [SerializeField] public bool enableBiometricAuth = true;

        [Header("Game Mechanics")]
        [SerializeField] [Range(1, 10)] public int dailyPuzzleLimit = 5;
        [SerializeField] [Range(10, 300)] public int puzzleTimeoutSeconds = 120;
        [SerializeField] [Range(1, 100)] public int baseScorePerPuzzle = 10;
        [SerializeField] [Range(1.0f, 5.0f)] public float difficultyMultiplier = 1.5f;

        [Header("UI/UX Settings")]
        [SerializeField] public bool enableHapticFeedback = true;
        [SerializeField] public bool enableSoundEffects = true;
        [SerializeField] [Range(0.1f, 2.0f)] public float uiAnimationSpeed = 1.0f;
        [SerializeField] [Range(0.5f, 3.0f)] public float tutorialSpeed = 1.0f;

        [Header("Mobile Optimization")]
        [SerializeField] public bool adaptiveQuality = true;
        [SerializeField] [Range(0.5f, 1.0f)] public float lowEndDeviceRenderScale = 0.75f;
        [SerializeField] public bool enableObjectPooling = true;
        [SerializeField] [Range(10, 100)] public int objectPoolSize = 50;

        [Header("Analytics")]
        [SerializeField] public bool enableAnalytics = true;
        [SerializeField] public bool enableCrashReporting = true;
        [SerializeField] [Range(1, 60)] public int analyticsFlushIntervalSeconds = 30;

        [Header("Offline Mode")]
        [SerializeField] public bool enableOfflineMode = true;
        [SerializeField] [Range(1, 100)] public int maxOfflinePuzzles = 20;
        [SerializeField] [Range(1, 7)] public int offlineDataRetentionDays = 3;

        [Header("Social Features")]
        [SerializeField] public bool enableSocialSharing = true;
        [SerializeField] public bool enableLeaderboards = true;
        [SerializeField] [Range(5, 100)] public int leaderboardDisplayLimit = 50;

        [Header("Debug Settings")]
        [SerializeField] public bool enableDebugUI = false;
        [SerializeField] public bool enableConsoleLogging = true;
        [SerializeField] public LogLevel logLevel = LogLevel.Info;

        /// <summary>
        /// Validate configuration values and log warnings for invalid settings
        /// </summary>
        private void OnValidate()
        {
            if (targetFrameRate < 30)
            {
                Debug.LogWarning("[GameConfiguration] Target frame rate below 30 may cause poor user experience");
            }

            if (requestTimeoutSeconds < 10)
            {
                Debug.LogWarning("[GameConfiguration] Request timeout too low, may cause network issues");
            }

            if (puzzleTimeoutSeconds < 30)
            {
                Debug.LogWarning("[GameConfiguration] Puzzle timeout may be too short for complex problems");
            }

            if (string.IsNullOrEmpty(apiBaseUrl))
            {
                Debug.LogError("[GameConfiguration] API Base URL must be configured");
            }
        }

        /// <summary>
        /// Get complete API endpoint URL
        /// </summary>
        public string GetFullAPIUrl(string endpoint)
        {
            return apiBaseUrl.TrimEnd('/') + endpoint;
        }

        /// <summary>
        /// Check if device should use low-end optimizations
        /// </summary>
        public bool ShouldUseLowEndOptimizations()
        {
            // Check device specifications for optimization decisions
            return SystemInfo.systemMemorySize < 3000 || // Less than 3GB RAM
                   SystemInfo.processorFrequency < 2000 || // Less than 2GHz CPU
                   SystemInfo.graphicsMemorySize < 1000;   // Less than 1GB VRAM
        }

        /// <summary>
        /// Get recommended render scale based on device capabilities
        /// </summary>
        public float GetRecommendedRenderScale()
        {
            if (!adaptiveQuality) return 1.0f;

            return ShouldUseLowEndOptimizations() ? lowEndDeviceRenderScale : 1.0f;
        }
    }

    /// <summary>
    /// Log level enumeration for debug configuration
    /// </summary>
    public enum LogLevel
    {
        Error,
        Warning,
        Info,
        Debug,
        Verbose
    }
}
