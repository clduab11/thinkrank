using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;
using ThinkRank.Core;
using ThinkRank.UI;

namespace ThinkRank.Core
{
    /// <summary>
    /// Manages scene loading, transitions, and state management
    /// Provides smooth loading screens and memory management for mobile devices
    /// </summary>
    public class SceneManager : MonoBehaviour
    {
        [Header("Scene Configuration")]
        [SerializeField] private GameConfiguration gameConfig;
        [SerializeField] private List<SceneData> sceneDatabase = new List<SceneData>();

        [Header("Loading Configuration")]
        [SerializeField] private float minimumLoadingTime = 1f;
        [SerializeField] private bool enablePreloading = true;
        [SerializeField] private bool enableMemoryManagement = true;

        // Scene state
        private string currentSceneName;
        private string previousSceneName;
        private bool isLoading = false;
        private Dictionary<string, SceneData> sceneDataLookup = new Dictionary<string, SceneData>();

        // Loading operations
        private AsyncOperation currentLoadOperation;
        private Coroutine loadingCoroutine;

        // Preloading
        private Queue<string> preloadQueue = new Queue<string>();
        private Dictionary<string, AsyncOperation> preloadedScenes = new Dictionary<string, AsyncOperation>();

        // Events
        public static event Action<string> OnSceneLoadStarted;
        public static event Action<string> OnSceneLoadCompleted;
        public static event Action<float> OnSceneLoadProgress;
        public static event Action<string> OnSceneTransitionStarted;
        public static event Action<string> OnSceneTransitionCompleted;

        // Properties
        public string CurrentScene => currentSceneName;
        public string PreviousScene => previousSceneName;
        public bool IsLoading => isLoading;
        public float LoadingProgress => currentLoadOperation?.progress ?? 0f;

        /// <summary>
        /// Initialize the Scene Manager
        /// </summary>
        public void Initialize()
        {
            Debug.Log("[SceneManager] Initializing Scene Manager...");

            // Build scene lookup dictionary
            BuildSceneLookup();

            // Get current scene
            currentSceneName = UnityEngine.SceneManagement.SceneManager.GetActiveScene().name;

            // Start preloading if enabled
            if (enablePreloading)
            {
                StartCoroutine(PreloadingCoroutine());
            }

            // Setup memory management
            if (enableMemoryManagement)
            {
                SetupMemoryManagement();
            }

            Debug.Log($"[SceneManager] Scene Manager initialized - Current scene: {currentSceneName}");
        }

        #region Scene Loading

        /// <summary>
        /// Load scene asynchronously with transition
        /// </summary>
        public async System.Threading.Tasks.Task LoadSceneAsync(string sceneName, SceneTransitionType transitionType = SceneTransitionType.Fade)
        {
            if (isLoading)
            {
                Debug.LogWarning($"[SceneManager] Scene loading already in progress, cannot load: {sceneName}");
                return;
            }

            if (!sceneDataLookup.ContainsKey(sceneName))
            {
                Debug.LogError($"[SceneManager] Scene not found in database: {sceneName}");
                return;
            }

            var sceneData = sceneDataLookup[sceneName];

            try
            {
                isLoading = true;
                OnSceneLoadStarted?.Invoke(sceneName);
                OnSceneTransitionStarted?.Invoke(sceneName);

                // Show loading UI
                ShowLoadingScreen(sceneData);

                // Start loading process
                await LoadSceneInternal(sceneName, sceneData);

                // Update scene state
                previousSceneName = currentSceneName;
                currentSceneName = sceneName;

                OnSceneLoadCompleted?.Invoke(sceneName);
                OnSceneTransitionCompleted?.Invoke(sceneName);

                Debug.Log($"[SceneManager] Scene loaded successfully: {sceneName}");
            }
            catch (Exception e)
            {
                Debug.LogError($"[SceneManager] Failed to load scene {sceneName}: {e.Message}");
                isLoading = false;
                HideLoadingScreen();
            }
        }

        /// <summary>
        /// Internal scene loading implementation
        /// </summary>
        private async System.Threading.Tasks.Task LoadSceneInternal(string sceneName, SceneData sceneData)
        {
            float startTime = Time.unscaledTime;

            // Check if scene is preloaded
            if (preloadedScenes.ContainsKey(sceneName))
            {
                Debug.Log($"[SceneManager] Using preloaded scene: {sceneName}");
                currentLoadOperation = preloadedScenes[sceneName];
                preloadedScenes.Remove(sceneName);
            }
            else
            {
                // Start loading scene
                currentLoadOperation = UnityEngine.SceneManagement.SceneManager.LoadSceneAsync(sceneName);
                currentLoadOperation.allowSceneActivation = false;
            }

            // Wait for loading to complete
            while (!currentLoadOperation.isDone)
            {
                float progress = Mathf.Clamp01(currentLoadOperation.progress / 0.9f);
                OnSceneLoadProgress?.Invoke(progress);

                // Allow scene activation when loading is complete
                if (currentLoadOperation.progress >= 0.9f)
                {
                    // Ensure minimum loading time for smooth UX
                    float elapsedTime = Time.unscaledTime - startTime;
                    if (elapsedTime < minimumLoadingTime)
                    {
                        await System.Threading.Tasks.Task.Delay((int)((minimumLoadingTime - elapsedTime) * 1000));
                    }

                    currentLoadOperation.allowSceneActivation = true;
                }

                await System.Threading.Tasks.Task.Yield();
            }

            // Perform post-load operations
            await PostLoadOperations(sceneData);

            // Clean up
            currentLoadOperation = null;
            isLoading = false;
            HideLoadingScreen();
        }

        /// <summary>
        /// Perform post-load operations
        /// </summary>
        private async System.Threading.Tasks.Task PostLoadOperations(SceneData sceneData)
        {
            // Force garbage collection if enabled
            if (enableMemoryManagement)
            {
                Resources.UnloadUnusedAssets();
                GC.Collect();
                await System.Threading.Tasks.Task.Yield();
            }

            // Initialize scene-specific systems
            InitializeSceneServices(sceneData);

            // Queue next scenes for preloading
            QueuePreloadScenes(sceneData.preloadScenes);
        }

        /// <summary>
        /// Initialize scene-specific services
        /// </summary>
        private void InitializeSceneServices(SceneData sceneData)
        {
            // Initialize UI for the scene
            if (GameManager.Instance?.UIManager != null)
            {
                if (!string.IsNullOrEmpty(sceneData.defaultUIScreen))
                {
                    GameManager.Instance.UIManager.NavigateToScreen(sceneData.defaultUIScreen, false);
                }
            }

            // Play scene music
            if (GameManager.Instance?.AudioManager != null && !string.IsNullOrEmpty(sceneData.backgroundMusic))
            {
                GameManager.Instance.AudioManager.PlayMusic(sceneData.backgroundMusic);
            }

            // Update game state
            if (GameManager.Instance != null)
            {
                GameManager.Instance.ChangeGameState(sceneData.gameState);
            }
        }

        #endregion

        #region Scene Preloading

        /// <summary>
        /// Preloading coroutine
        /// </summary>
        private IEnumerator PreloadingCoroutine()
        {
            while (true)
            {
                yield return new WaitForSeconds(1f); // Check every second

                if (!isLoading && preloadQueue.Count > 0)
                {
                    string sceneToPreload = preloadQueue.Dequeue();
                    yield return StartCoroutine(PreloadSceneCoroutine(sceneToPreload));
                }
            }
        }

        /// <summary>
        /// Preload a scene
        /// </summary>
        private IEnumerator PreloadSceneCoroutine(string sceneName)
        {
            if (preloadedScenes.ContainsKey(sceneName) || sceneName == currentSceneName)
            {
                yield break; // Already preloaded or current scene
            }

            Debug.Log($"[SceneManager] Preloading scene: {sceneName}");

            var loadOperation = UnityEngine.SceneManagement.SceneManager.LoadSceneAsync(sceneName);
            loadOperation.allowSceneActivation = false;

            while (loadOperation.progress < 0.9f)
            {
                yield return null;
            }

            preloadedScenes[sceneName] = loadOperation;
            Debug.Log($"[SceneManager] Scene preloaded: {sceneName}");
        }

        /// <summary>
        /// Queue scenes for preloading
        /// </summary>
        private void QueuePreloadScenes(List<string> sceneNames)
        {
            if (sceneNames == null) return;

            foreach (string sceneName in sceneNames)
            {
                if (!preloadQueue.Contains(sceneName) && !preloadedScenes.ContainsKey(sceneName))
                {
                    preloadQueue.Enqueue(sceneName);
                }
            }
        }

        #endregion

        #region Loading Screen Management

        /// <summary>
        /// Show loading screen
        /// </summary>
        private void ShowLoadingScreen(SceneData sceneData)
        {
            if (GameManager.Instance?.UIManager != null)
            {
                string loadingMessage = !string.IsNullOrEmpty(sceneData.loadingText)
                    ? sceneData.loadingText
                    : "Loading...";

                GameManager.Instance.UIManager.ShowLoading(loadingMessage);
            }
        }

        /// <summary>
        /// Hide loading screen
        /// </summary>
        private void HideLoadingScreen()
        {
            if (GameManager.Instance?.UIManager != null)
            {
                GameManager.Instance.UIManager.HideLoading();
            }
        }

        #endregion

        #region Memory Management

        /// <summary>
        /// Setup memory management
        /// </summary>
        private void SetupMemoryManagement()
        {
            // Monitor memory usage
            StartCoroutine(MemoryMonitorCoroutine());
        }

        /// <summary>
        /// Memory monitoring coroutine
        /// </summary>
        private IEnumerator MemoryMonitorCoroutine()
        {
            while (true)
            {
                yield return new WaitForSeconds(10f); // Check every 10 seconds

                // Clean up unused preloaded scenes on low memory
                long memoryUsage = GC.GetTotalMemory(false);
                if (memoryUsage > 100 * 1024 * 1024) // 100MB threshold
                {
                    CleanupPreloadedScenes();
                }
            }
        }

        /// <summary>
        /// Clean up preloaded scenes to free memory
        /// </summary>
        private void CleanupPreloadedScenes()
        {
            if (preloadedScenes.Count > 2) // Keep at most 2 preloaded scenes
            {
                var scenesToRemove = new List<string>();
                int removeCount = preloadedScenes.Count - 2;

                foreach (var kvp in preloadedScenes)
                {
                    if (removeCount <= 0) break;
                    scenesToRemove.Add(kvp.Key);
                    removeCount--;
                }

                foreach (string sceneName in scenesToRemove)
                {
                    preloadedScenes.Remove(sceneName);
                    Debug.Log($"[SceneManager] Cleaned up preloaded scene: {sceneName}");
                }

                Resources.UnloadUnusedAssets();
            }
        }

        #endregion

        #region Scene Database

        /// <summary>
        /// Build scene lookup dictionary
        /// </summary>
        private void BuildSceneLookup()
        {
            sceneDataLookup.Clear();

            // Add default scenes if database is empty
            if (sceneDatabase.Count == 0)
            {
                CreateDefaultSceneDatabase();
            }

            foreach (var sceneData in sceneDatabase)
            {
                sceneDataLookup[sceneData.sceneName] = sceneData;
            }

            Debug.Log($"[SceneManager] Scene database built with {sceneDataLookup.Count} scenes");
        }

        /// <summary>
        /// Create default scene database
        /// </summary>
        private void CreateDefaultSceneDatabase()
        {
            sceneDatabase.Add(new SceneData
            {
                sceneName = "MainMenu",
                displayName = "Main Menu",
                gameState = GameState.MainMenu,
                defaultUIScreen = "mainmenu",
                backgroundMusic = "background_menu",
                loadingText = "Loading Main Menu...",
                preloadScenes = new List<string> { "Game", "Profile" }
            });

            sceneDatabase.Add(new SceneData
            {
                sceneName = "Game",
                displayName = "Game",
                gameState = GameState.Playing,
                defaultUIScreen = "game",
                backgroundMusic = "background_game",
                loadingText = "Loading Game...",
                preloadScenes = new List<string> { "MainMenu" }
            });

            sceneDatabase.Add(new SceneData
            {
                sceneName = "Profile",
                displayName = "Profile",
                gameState = GameState.Profile,
                defaultUIScreen = "profile",
                backgroundMusic = "background_menu",
                loadingText = "Loading Profile...",
                preloadScenes = new List<string> { "MainMenu" }
            });
        }

        #endregion

        #region Navigation Helpers

        /// <summary>
        /// Go to main menu
        /// </summary>
        public async System.Threading.Tasks.Task GoToMainMenu()
        {
            await LoadSceneAsync("MainMenu");
        }

        /// <summary>
        /// Go to game scene
        /// </summary>
        public async System.Threading.Tasks.Task GoToGame()
        {
            await LoadSceneAsync("Game");
        }

        /// <summary>
        /// Go to profile scene
        /// </summary>
        public async System.Threading.Tasks.Task GoToProfile()
        {
            await LoadSceneAsync("Profile");
        }

        /// <summary>
        /// Go back to previous scene
        /// </summary>
        public async System.Threading.Tasks.Task GoToPreviousScene()
        {
            if (!string.IsNullOrEmpty(previousSceneName))
            {
                await LoadSceneAsync(previousSceneName);
            }
            else
            {
                await GoToMainMenu();
            }
        }

        /// <summary>
        /// Restart current scene
        /// </summary>
        public async System.Threading.Tasks.Task RestartCurrentScene()
        {
            if (!string.IsNullOrEmpty(currentSceneName))
            {
                await LoadSceneAsync(currentSceneName);
            }
        }

        #endregion

        #region Public API

        /// <summary>
        /// Get scene data by name
        /// </summary>
        public SceneData GetSceneData(string sceneName)
        {
            sceneDataLookup.TryGetValue(sceneName, out SceneData sceneData);
            return sceneData;
        }

        /// <summary>
        /// Check if scene exists in database
        /// </summary>
        public bool SceneExists(string sceneName)
        {
            return sceneDataLookup.ContainsKey(sceneName);
        }

        /// <summary>
        /// Get all available scenes
        /// </summary>
        public List<string> GetAllSceneNames()
        {
            return new List<string>(sceneDataLookup.Keys);
        }

        /// <summary>
        /// Cancel current loading operation
        /// </summary>
        public void CancelLoading()
        {
            if (loadingCoroutine != null)
            {
                StopCoroutine(loadingCoroutine);
                loadingCoroutine = null;
            }

            isLoading = false;
            HideLoadingScreen();

            Debug.Log("[SceneManager] Scene loading cancelled");
        }

        #endregion

        private void OnDestroy()
        {
            // Clean up preloaded scenes
            preloadedScenes.Clear();
            preloadQueue.Clear();
        }
    }

    #region Data Structures

    /// <summary>
    /// Scene data configuration
    /// </summary>
    [System.Serializable]
    public class SceneData
    {
        [Header("Scene Information")]
        public string sceneName;
        public string displayName;
        public string description;

        [Header("Scene Configuration")]
        public GameState gameState = GameState.MainMenu;
        public string defaultUIScreen;
        public string backgroundMusic;
        public string loadingText = "Loading...";

        [Header("Optimization")]
        public List<string> preloadScenes = new List<string>();
        public bool enableMemoryCleanup = true;
        public bool requiresAuth = false;

        [Header("Visual")]
        public Sprite loadingBackground;
        public Color loadingBackgroundColor = Color.black;
    }

    /// <summary>
    /// Scene transition types
    /// </summary>
    public enum SceneTransitionType
    {
        None,
        Fade,
        Slide,
        Scale,
        Custom
    }

    #endregion
}
