using System;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace ThinkRank.Core
{
    /// <summary>
    /// Main game manager that handles application lifecycle, initialization, and high-level game state
    /// Singleton pattern ensures single instance across the application
    /// </summary>
    public class GameManager : MonoBehaviour
    {
        #region Singleton
        private static GameManager _instance;
        public static GameManager Instance
        {
            get
            {
                if (_instance == null)
                {
                    _instance = FindObjectOfType<GameManager>();
                    if (_instance == null)
                    {
                        GameObject go = new GameObject("GameManager");
                        _instance = go.AddComponent<GameManager>();
                        DontDestroyOnLoad(go);
                    }
                }
                return _instance;
            }
        }
        #endregion

        [Header("Game Configuration")]
        [SerializeField] private GameConfiguration gameConfig;

        [Header("Performance Monitoring")]
        [SerializeField] private bool enablePerformanceMonitoring = true;
        [SerializeField] private float targetFrameRate = 60f;

        // Core Systems
        public SceneManager SceneManager { get; private set; }
        public UIManager UIManager { get; private set; }
        public APIManager APIManager { get; private set; }
        public AudioManager AudioManager { get; private set; }
        public InputManager InputManager { get; private set; }
        public PerformanceManager PerformanceManager { get; private set; }
        public PlayerDataManager PlayerDataManager { get; private set; }

        // Game State
        public GameState CurrentGameState { get; private set; } = GameState.Initializing;

        // Events
        public static event Action<GameState> OnGameStateChanged;
        public static event Action OnGameInitialized;
        public static event Action OnApplicationPaused;
        public static event Action OnApplicationResumed;

        private void Awake()
        {
            // Ensure singleton
            if (_instance != null && _instance != this)
            {
                Destroy(gameObject);
                return;
            }

            _instance = this;
            DontDestroyOnLoad(gameObject);

            InitializeApplication();
        }

        private async void Start()
        {
            await InitializeSystems();
            ChangeGameState(GameState.MainMenu);
            OnGameInitialized?.Invoke();
        }

        /// <summary>
        /// Initialize application-level settings and configurations
        /// </summary>
        private void InitializeApplication()
        {
            // Set target frame rate for mobile optimization
            Application.targetFrameRate = (int)targetFrameRate;

            // Configure quality settings for mobile
            QualitySettings.vSyncCount = 0; // Disable VSync for mobile

            // Configure input for mobile
            Input.multiTouchEnabled = true;

            // Set screen orientation handling
            Screen.autorotateToPortrait = true;
            Screen.autorotateToPortraitUpsideDown = false;
            Screen.autorotateToLandscapeLeft = true;
            Screen.autorotateToLandscapeRight = true;

            // Prevent screen dimming
            Screen.sleepTimeout = SleepTimeout.NeverSleep;

            Debug.Log($"[GameManager] Application initialized - Target FPS: {targetFrameRate}");
        }

        /// <summary>
        /// Initialize all core game systems in proper order
        /// </summary>
        private async System.Threading.Tasks.Task InitializeSystems()
        {
            try
            {
                Debug.Log("[GameManager] Initializing core systems...");

                // Initialize Performance Manager first for monitoring
                PerformanceManager = gameObject.AddComponent<PerformanceManager>();
                PerformanceManager.Initialize(enablePerformanceMonitoring);

                // Initialize API Manager for backend communication
                APIManager = gameObject.AddComponent<APIManager>();
                await APIManager.Initialize();

                // Initialize Player Data Manager
                PlayerDataManager = gameObject.AddComponent<PlayerDataManager>();
                await PlayerDataManager.Initialize();

                // Initialize UI Manager
                UIManager = FindObjectOfType<UIManager>();
                if (UIManager == null)
                {
                    UIManager = gameObject.AddComponent<UIManager>();
                }
                UIManager.Initialize();

                // Initialize Audio Manager
                AudioManager = gameObject.AddComponent<AudioManager>();
                AudioManager.Initialize();

                // Initialize Input Manager
                InputManager = gameObject.AddComponent<InputManager>();
                InputManager.Initialize();

                // Initialize Scene Manager last
                SceneManager = gameObject.AddComponent<SceneManager>();
                SceneManager.Initialize();

                Debug.Log("[GameManager] All systems initialized successfully");
            }
            catch (Exception e)
            {
                Debug.LogError($"[GameManager] Failed to initialize systems: {e.Message}");
                ChangeGameState(GameState.Error);
            }
        }

        /// <summary>
        /// Change the current game state and notify listeners
        /// </summary>
        public void ChangeGameState(GameState newState)
        {
            if (CurrentGameState == newState) return;

            GameState previousState = CurrentGameState;
            CurrentGameState = newState;

            Debug.Log($"[GameManager] Game state changed: {previousState} -> {newState}");
            OnGameStateChanged?.Invoke(newState);
        }

        /// <summary>
        /// Handle application pause/resume for mobile lifecycle
        /// </summary>
        private void OnApplicationPause(bool pauseStatus)
        {
            if (pauseStatus)
            {
                OnApplicationPaused?.Invoke();
                PlayerDataManager?.SavePlayerData();
                Debug.Log("[GameManager] Application paused - Data saved");
            }
            else
            {
                OnApplicationResumed?.Invoke();
                Debug.Log("[GameManager] Application resumed");
            }
        }

        /// <summary>
        /// Handle application focus for desktop/mobile compatibility
        /// </summary>
        private void OnApplicationFocus(bool hasFocus)
        {
            if (!hasFocus)
            {
                PlayerDataManager?.SavePlayerData();
            }
        }

        /// <summary>
        /// Clean shutdown handling
        /// </summary>
        private void OnApplicationQuit()
        {
            PlayerDataManager?.SavePlayerData();
            Debug.Log("[GameManager] Application quit - Final data save completed");
        }

        /// <summary>
        /// Get current frame rate for performance monitoring
        /// </summary>
        public float GetCurrentFPS()
        {
            return PerformanceManager?.CurrentFPS ?? 0f;
        }

        /// <summary>
        /// Check if target performance is being met
        /// </summary>
        public bool IsPerformanceOptimal()
        {
            return GetCurrentFPS() >= (targetFrameRate * 0.9f); // 90% of target
        }
    }

    /// <summary>
    /// Enumeration of possible game states
    /// </summary>
    public enum GameState
    {
        Initializing,
        MainMenu,
        Playing,
        Paused,
        GameOver,
        Loading,
        Settings,
        Profile,
        Leaderboard,
        Tutorial,
        Error
    }
}
