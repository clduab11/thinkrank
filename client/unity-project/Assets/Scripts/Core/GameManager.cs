/**
 * ThinkRank Unity Game Manager
 * Mobile-first game orchestration for gamified AI literacy platform
 *
 * RESPONSIBILITIES:
 * - Unity scene lifecycle management
 * - Server synchronization and state management
 * - Touch input handling and gesture recognition
 * - Offline capability and sync management
 * - Performance optimization for mobile devices
 *
 * INTEGRATION POINTS:
 * - Backend Game Service: Real-time state synchronization
 * - Social Service: Achievement and leaderboard integration
 * - Analytics Service: Performance and engagement tracking
 * - Push Notification Service: User engagement
 */

using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.Networking;
using System;
using System.Collections;
using System.Collections.Generic;
using Newtonsoft.Json;
using TMPro;
using UnityEngine.UI;

namespace ThinkRank.Core
{
    public class GameManager : MonoBehaviour
    {
        // Singleton instance
        public static GameManager Instance { get; private set; }

        // Core systems
        [SerializeField] private StateSynchronizer stateSynchronizer;
        [SerializeField] private TouchInputHandler touchInputHandler;
        [SerializeField] private OfflineManager offlineManager;
        [SerializeField] private PerformanceOptimizer performanceOptimizer;
        [SerializeField] private AudioManager audioManager;

        // UI References
        [SerializeField] private GameObject loadingScreen;
        [SerializeField] private GameObject errorPanel;
        [SerializeField] private TextMeshProUGUI errorText;
        [SerializeField] private Button retryButton;

        // Game state
        private GameState currentGameState;
        private PlayerState currentPlayerState;
        private bool isInitialized = false;
        private bool isOnline = true;
        private Queue<GameAction> pendingActions = new Queue<GameAction>();

        // Configuration
        [SerializeField] private float syncInterval = 2.0f;
        [SerializeField] private float offlineTimeout = 30.0f;
        [SerializeField] private int maxRetryAttempts = 3;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
                InitializeGameManager();
            }
            else
            {
                Destroy(gameObject);
            }
        }

        private void InitializeGameManager()
        {
            Debug.Log("Initializing ThinkRank Game Manager");

            // Initialize subsystems
            InitializeSubsystems();

            // Setup event listeners
            SetupEventListeners();

            // Start performance monitoring
            StartCoroutine(PerformanceMonitoringCoroutine());
        }

        private void InitializeSubsystems()
        {
            // Initialize state synchronizer
            if (stateSynchronizer != null)
            {
                stateSynchronizer.Initialize();
            }

            // Initialize touch input handler
            if (touchInputHandler != null)
            {
                touchInputHandler.Initialize();
            }

            // Initialize offline manager
            if (offlineManager != null)
            {
                offlineManager.Initialize();
            }

            // Initialize performance optimizer
            if (performanceOptimizer != null)
            {
                performanceOptimizer.Initialize();
            }

            // Initialize audio manager
            if (audioManager != null)
            {
                audioManager.Initialize();
            }
        }

        private void SetupEventListeners()
        {
            // Network status changes
            NetworkManager.OnNetworkStatusChanged += HandleNetworkStatusChanged;

            // Server connection events
            WebSocketManager.OnConnected += HandleServerConnected;
            WebSocketManager.OnDisconnected += HandleServerDisconnected;
            WebSocketManager.OnMessageReceived += HandleServerMessage;

            // Retry button
            if (retryButton != null)
            {
                retryButton.onClick.AddListener(RetryConnection);
            }
        }

        private void Start()
        {
            StartCoroutine(InitializeGame());
        }

        private IEnumerator InitializeGame()
        {
            ShowLoadingScreen("Connecting to ThinkRank servers...");

            // Check network connectivity
            yield return StartCoroutine(CheckNetworkConnectivity());

            if (!isOnline)
            {
                yield return StartCoroutine(EnterOfflineMode());
                yield break;
            }

            // Authenticate with backend
            yield return StartCoroutine(AuthenticatePlayer());

            // Load initial game state
            yield return StartCoroutine(LoadGameState());

            // Initialize game scene
            yield return StartCoroutine(InitializeGameScene());

            HideLoadingScreen();
            isInitialized = true;

            Debug.Log("Game initialization complete");
        }

        private IEnumerator CheckNetworkConnectivity()
        {
            // Simple connectivity check
            using (UnityWebRequest www = UnityWebRequest.Get("https://www.google.com"))
            {
                yield return www.SendWebRequest();

                isOnline = www.result == UnityWebRequest.Result.Success;
            }
        }

        private IEnumerator AuthenticatePlayer()
        {
            // This would integrate with your authentication service
            // For now, use placeholder authentication
            Debug.Log("Authenticating player...");

            // Simulate authentication delay
            yield return new WaitForSeconds(1.0f);

            // Get player ID from PlayerPrefs or generate new one
            string playerId = PlayerPrefs.GetString("PlayerId", Guid.NewGuid().ToString());
            PlayerPrefs.SetString("PlayerId", playerId);

            Debug.Log($"Player authenticated: {playerId}");
        }

        private IEnumerator LoadGameState()
        {
            string playerId = PlayerPrefs.GetString("PlayerId");

            // Load from server if online
            if (isOnline)
            {
                yield return StartCoroutine(LoadStateFromServer(playerId));
            }
            else
            {
                yield return StartCoroutine(LoadStateFromLocal(playerId));
            }
        }

        private IEnumerator LoadStateFromServer(string playerId)
        {
            // Make API call to get current game state
            string url = $"{GetBaseUrl()}/api/game/state/{playerId}";

            using (UnityWebRequest www = UnityWebRequest.Get(url))
            {
                yield return www.SendWebRequest();

                if (www.result == UnityWebRequest.Result.Success)
                {
                    string jsonResponse = www.downloadHandler.text;
                    currentGameState = JsonConvert.DeserializeObject<GameState>(jsonResponse);
                    currentPlayerState = currentGameState.players[playerId];

                    Debug.Log("Game state loaded from server");
                }
                else
                {
                    Debug.LogError($"Failed to load game state: {www.error}");
                    yield return StartCoroutine(LoadStateFromLocal(playerId));
                }
            }
        }

        private IEnumerator LoadStateFromLocal(string playerId)
        {
            // Load cached state from PlayerPrefs
            string cachedState = PlayerPrefs.GetString($"GameState_{playerId}", "");

            if (!string.IsNullOrEmpty(cachedState))
            {
                currentGameState = JsonConvert.DeserializeObject<GameState>(cachedState);
                currentPlayerState = currentGameState.players[playerId];

                Debug.Log("Game state loaded from local cache");
            }
            else
            {
                // Create initial state
                currentGameState = CreateInitialGameState(playerId);
                currentPlayerState = currentGameState.players[playerId];

                Debug.Log("Created initial game state");
            }
        }

        private GameState CreateInitialGameState(string playerId)
        {
            return new GameState
            {
                gameId = "default",
                players = new Dictionary<string, PlayerState>
                {
                    [playerId] = new PlayerState
                    {
                        playerId = playerId,
                        level = 1,
                        experience = 0,
                        collection = new Collection { items = new Dictionary<string, CollectionItem>() },
                        progression = new PlayerProgression { level = 1, experience = 0 },
                        socialMetrics = new SocialMetrics(),
                        lastActive = DateTime.Now
                    }
                },
                currentPhase = GamePhase.WaitingForPlayers,
                timestamp = DateTime.Now,
                version = 1
            };
        }

        private IEnumerator InitializeGameScene()
        {
            // Load appropriate scene based on game state
            if (currentGameState.currentPhase == GamePhase.WaitingForPlayers)
            {
                yield return SceneManager.LoadSceneAsync("MainMenu");
            }
            else
            {
                yield return SceneManager.LoadSceneAsync("GamePlay");
            }

            yield return new WaitForSeconds(0.5f); // Wait for scene to load

            // Initialize scene-specific managers
            InitializeSceneManagers();
        }

        private void InitializeSceneManagers()
        {
            // Find and initialize scene-specific managers
            var gachaManager = FindObjectOfType<GachaManager>();
            if (gachaManager != null)
            {
                gachaManager.Initialize(currentPlayerState);
            }

            var challengeManager = FindObjectOfType<ChallengeManager>();
            if (challengeManager != null)
            {
                challengeManager.Initialize(currentPlayerState);
            }

            var socialManager = FindObjectOfType<SocialManager>();
            if (socialManager != null)
            {
                socialManager.Initialize(currentPlayerState);
            }
        }

        private void Update()
        {
            if (!isInitialized) return;

            // Handle touch input
            if (touchInputHandler != null)
            {
                touchInputHandler.Update();
            }

            // Periodic state synchronization
            if (Time.frameCount % (syncInterval * 60) == 0) // Sync every syncInterval seconds
            {
                StartCoroutine(SyncWithServer());
            }
        }

        private IEnumerator SyncWithServer()
        {
            if (!isOnline) yield break;

            // Sync pending actions
            while (pendingActions.Count > 0)
            {
                GameAction action = pendingActions.Dequeue();
                yield return StartCoroutine(SendActionToServer(action));
            }

            // Sync current state
            yield return StartCoroutine(SyncCurrentState());
        }

        private IEnumerator SendActionToServer(GameAction action)
        {
            string url = $"{GetBaseUrl()}/api/game/actions";
            string jsonPayload = JsonConvert.SerializeObject(action);

            using (UnityWebRequest www = UnityWebRequest.Post(url, jsonPayload))
            {
                www.SetRequestHeader("Content-Type", "application/json");

                yield return www.SendWebRequest();

                if (www.result != UnityWebRequest.Result.Success)
                {
                    Debug.LogError($"Failed to send action: {www.error}");
                    // Re-queue action for retry
                    pendingActions.Enqueue(action);
                }
            }
        }

        private IEnumerator SyncCurrentState()
        {
            string playerId = PlayerPrefs.GetString("PlayerId");
            string url = $"{GetBaseUrl()}/api/game/state/{playerId}";

            using (UnityWebRequest www = UnityWebRequest.Get(url))
            {
                yield return www.SendWebRequest();

                if (www.result == UnityWebRequest.Result.Success)
                {
                    string jsonResponse = www.downloadHandler.text;
                    GameState serverState = JsonConvert.DeserializeObject<GameState>(jsonResponse);

                    // Merge server state with local state
                    MergeGameState(serverState);
                }
            }
        }

        private void MergeGameState(GameState serverState)
        {
            // Simple state merge - in production, use more sophisticated conflict resolution
            if (serverState.version > currentGameState.version)
            {
                currentGameState = serverState;
                currentPlayerState = currentGameState.players[currentPlayerState.playerId];

                // Notify UI managers of state change
                NotifyStateChanged();
            }
        }

        private void NotifyStateChanged()
        {
            // Broadcast state change to all managers
            EventManager.TriggerEvent("GameStateChanged", currentGameState);
        }

        public void QueueAction(GameAction action)
        {
            pendingActions.Enqueue(action);

            // Try to send immediately if online
            if (isOnline)
            {
                StartCoroutine(SendActionToServer(action));
            }
        }

        public PlayerState GetCurrentPlayerState()
        {
            return currentPlayerState;
        }

        public GameState GetCurrentGameState()
        {
            return currentGameState;
        }

        public bool IsOnline()
        {
            return isOnline;
        }

        public bool IsInitialized()
        {
            return isInitialized;
        }

        private void HandleNetworkStatusChanged(bool online)
        {
            isOnline = online;

            if (online)
            {
                Debug.Log("Network connection restored");
                StartCoroutine(SyncWithServer());
            }
            else
            {
                Debug.Log("Network connection lost");
                StartCoroutine(EnterOfflineMode());
            }
        }

        private void HandleServerConnected()
        {
            Debug.Log("Connected to game server");
            isOnline = true;
        }

        private void HandleServerDisconnected()
        {
            Debug.Log("Disconnected from game server");
            isOnline = false;
            StartCoroutine(EnterOfflineMode());
        }

        private void HandleServerMessage(string message)
        {
            try
            {
                var messageData = JsonConvert.DeserializeObject<ServerMessage>(message);

                switch (messageData.type)
                {
                    case "state_update":
                        HandleStateUpdate(messageData.data);
                        break;
                    case "gacha_result":
                        HandleGachaResult(messageData.data);
                        break;
                    case "achievement_unlocked":
                        HandleAchievementUnlocked(messageData.data);
                        break;
                    case "challenge_completed":
                        HandleChallengeCompleted(messageData.data);
                        break;
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to handle server message: {e.Message}");
            }
        }

        private void HandleStateUpdate(string data)
        {
            GameState serverState = JsonConvert.DeserializeObject<GameState>(data);
            MergeGameState(serverState);
        }

        private void HandleGachaResult(string data)
        {
            var gachaResult = JsonConvert.DeserializeObject<GachaResult>(data);
            EventManager.TriggerEvent("GachaPullCompleted", gachaResult);
        }

        private void HandleAchievementUnlocked(string data)
        {
            var achievement = JsonConvert.DeserializeObject<Achievement>(data);
            EventManager.TriggerEvent("AchievementUnlocked", achievement);
        }

        private void HandleChallengeCompleted(string data)
        {
            var challengeResult = JsonConvert.DeserializeObject<ChallengeResult>(data);
            EventManager.TriggerEvent("ChallengeCompleted", challengeResult);
        }

        private IEnumerator EnterOfflineMode()
        {
            Debug.Log("Entering offline mode");

            // Show offline indicator
            ShowOfflineIndicator();

            // Save current state to local storage
            SaveStateToLocal();

            yield return null;
        }

        private void ShowOfflineIndicator()
        {
            // Show UI indicator that player is offline
            EventManager.TriggerEvent("OfflineModeEntered");
        }

        private void SaveStateToLocal()
        {
            string playerId = PlayerPrefs.GetString("PlayerId");
            string stateJson = JsonConvert.SerializeObject(currentGameState);
            PlayerPrefs.SetString($"GameState_{playerId}", stateJson);
            PlayerPrefs.Save();
        }

        private void ShowLoadingScreen(string message = "Loading...")
        {
            if (loadingScreen != null)
            {
                loadingScreen.SetActive(true);
                var loadingText = loadingScreen.GetComponentInChildren<TextMeshProUGUI>();
                if (loadingText != null)
                {
                    loadingText.text = message;
                }
            }
        }

        private void HideLoadingScreen()
        {
            if (loadingScreen != null)
            {
                loadingScreen.SetActive(false);
            }
        }

        private void ShowError(string errorMessage)
        {
            if (errorPanel != null)
            {
                errorPanel.SetActive(true);
                if (errorText != null)
                {
                    errorText.text = errorMessage;
                }
            }
        }

        private void HideError()
        {
            if (errorPanel != null)
            {
                errorPanel.SetActive(false);
            }
        }

        private void RetryConnection()
        {
            HideError();
            StartCoroutine(InitializeGame());
        }

        private string GetBaseUrl()
        {
            // This should come from configuration
            return "https://api.thinkrank.com";
        }

        private IEnumerator PerformanceMonitoringCoroutine()
        {
            while (true)
            {
                yield return new WaitForSeconds(30.0f); // Monitor every 30 seconds

                // Collect performance metrics
                float fps = 1.0f / Time.deltaTime;
                float memoryUsage = UnityEngine.Profiling.Profiler.GetTotalAllocatedMemoryLong() / (1024.0f * 1024.0f);

                // Log performance metrics
                Debug.Log($"Performance - FPS: {fps:F1}, Memory: {memoryUsage:F1}MB");

                // Send to analytics service if online
                if (isOnline)
                {
                    SendPerformanceMetrics(fps, memoryUsage);
                }
            }
        }

        private void SendPerformanceMetrics(float fps, float memoryUsage)
        {
            // Send performance metrics to analytics service
            // Implementation would integrate with your analytics service
        }

        private void OnApplicationPause(bool pause)
        {
            if (pause)
            {
                // Save state when app goes to background
                SaveStateToLocal();
            }
            else
            {
                // Resume operations when app comes back
                if (isOnline)
                {
                    StartCoroutine(SyncWithServer());
                }
            }
        }

        private void OnApplicationQuit()
        {
            // Final state save
            SaveStateToLocal();
        }
    }

    // Supporting data structures
    [Serializable]
    public class GameState
    {
        public string gameId;
        public Dictionary<string, PlayerState> players;
        public GamePhase currentPhase;
        public DateTime timestamp;
        public int version;
    }

    [Serializable]
    public class PlayerState
    {
        public string playerId;
        public int level;
        public int experience;
        public Collection collection;
        public PlayerProgression progression;
        public SocialMetrics socialMetrics;
        public DateTime lastActive;
    }

    [Serializable]
    public class Collection
    {
        public Dictionary<string, CollectionItem> items;
    }

    [Serializable]
    public class CollectionItem
    {
        public string id;
        public string name;
        public ItemRarity rarity;
        public ItemCategory category;
    }

    [Serializable]
    public class PlayerProgression
    {
        public int level;
        public int experience;
        public int challengesCompleted;
        public float averageAccuracy;
    }

    [Serializable]
    public class SocialMetrics
    {
        public int totalShares;
        public int totalReferrals;
        public float viralCoefficient;
        public int leaderboardRank;
    }

    [Serializable]
    public class GameAction
    {
        public ActionType type;
        public string playerId;
        public string payload;
        public DateTime timestamp;
    }

    public enum GamePhase
    {
        WaitingForPlayers,
        ActiveGameplay,
        Paused,
        Completed
    }

    public enum ActionType
    {
        PerformGachaPull,
        SubmitChallengeAnswer,
        ShareAchievement,
        StartResearchWorkflow
    }

    public enum ItemRarity
    {
        Common,
        Uncommon,
        Rare,
        Epic,
        Legendary
    }

    public enum ItemCategory
    {
        BiasDetection,
        ResearchMethodology,
        AIEthics,
        DataAnalysis,
        CriticalThinking
    }

    [Serializable]
    public class ServerMessage
    {
        public string type;
        public string data;
    }

    [Serializable]
    public class GachaResult
    {
        public bool success;
        public CollectionItem[] items;
        public int experienceGained;
    }

    [Serializable]
    public class Achievement
    {
        public string id;
        public string name;
        public string description;
        public Sprite icon;
    }

    [Serializable]
    public class ChallengeResult
    {
        public string challengeId;
        public bool isCorrect;
        public float accuracy;
        public int experienceGained;
    }
}