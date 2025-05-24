using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;
using ThinkRank.Core;

namespace ThinkRank.UI
{
    /// <summary>
    /// Manages all UI operations using UI Toolkit for responsive mobile design
    /// Handles screen management, navigation, and UI element lifecycle
    /// </summary>
    public class UIManager : MonoBehaviour
    {
        [Header("UI Configuration")]
        [SerializeField] private UIDocument mainUIDocument;
        [SerializeField] private GameConfiguration gameConfig;
        [SerializeField] private List<UIScreenData> uiScreens = new List<UIScreenData>();

        // UI State Management
        private Dictionary<string, UIScreen> loadedScreens = new Dictionary<string, UIScreen>();
        private Stack<string> navigationStack = new Stack<string>();
        private string currentScreenId = "";

        // UI Root Elements
        private VisualElement rootElement;
        private VisualElement screenContainer;
        private VisualElement overlayContainer;
        private VisualElement loadingContainer;

        // Screen Transition
        private bool isTransitioning = false;

        // Events
        public static event Action<string> OnScreenChanged;
        public static event Action<string> OnScreenTransitionStarted;
        public static event Action<string> OnScreenTransitionCompleted;

        // Properties
        public string CurrentScreen => currentScreenId;
        public bool IsTransitioning => isTransitioning;
        public Vector2 ScreenSize => new Vector2(Screen.width, Screen.height);
        public float ScreenAspectRatio => (float)Screen.width / Screen.height;

        /// <summary>
        /// Initialize the UI Manager and setup responsive UI system
        /// </summary>
        public void Initialize()
        {
            Debug.Log("[UIManager] Initializing UI Manager...");

            // Get or create main UI document
            if (mainUIDocument == null)
            {
                mainUIDocument = FindObjectOfType<UIDocument>();
                if (mainUIDocument == null)
                {
                    GameObject uiDocumentGO = new GameObject("MainUIDocument");
                    mainUIDocument = uiDocumentGO.AddComponent<UIDocument>();
                    DontDestroyOnLoad(uiDocumentGO);
                }
            }

            // Setup root UI structure
            SetupRootUIStructure();

            // Configure responsive design
            ConfigureResponsiveDesign();

            // Load initial screens
            LoadInitialScreens();

            // Listen for orientation changes
            StartCoroutine(MonitorScreenChanges());

            Debug.Log("[UIManager] UI Manager initialized successfully");
        }

        #region Screen Management

        /// <summary>
        /// Navigate to a specific screen with optional transition
        /// </summary>
        public async System.Threading.Tasks.Task NavigateToScreen(string screenId, bool addToStack = true, UITransitionType transition = UITransitionType.Fade)
        {
            if (isTransitioning)
            {
                Debug.LogWarning($"[UIManager] Cannot navigate while transition in progress");
                return;
            }

            if (!loadedScreens.ContainsKey(screenId))
            {
                Debug.LogError($"[UIManager] Screen not found: {screenId}");
                return;
            }

            isTransitioning = true;
            OnScreenTransitionStarted?.Invoke(screenId);

            try
            {
                // Hide current screen
                if (!string.IsNullOrEmpty(currentScreenId) && loadedScreens.ContainsKey(currentScreenId))
                {
                    await HideScreen(currentScreenId, transition);
                }

                // Update navigation stack
                if (addToStack && !string.IsNullOrEmpty(currentScreenId))
                {
                    navigationStack.Push(currentScreenId);
                }

                // Show new screen
                await ShowScreen(screenId, transition);

                currentScreenId = screenId;
                OnScreenChanged?.Invoke(screenId);
                OnScreenTransitionCompleted?.Invoke(screenId);

                Debug.Log($"[UIManager] Navigated to screen: {screenId}");
            }
            catch (Exception e)
            {
                Debug.LogError($"[UIManager] Navigation error: {e.Message}");
            }
            finally
            {
                isTransitioning = false;
            }
        }

        /// <summary>
        /// Navigate back to previous screen in stack
        /// </summary>
        public async System.Threading.Tasks.Task NavigateBack(UITransitionType transition = UITransitionType.Slide)
        {
            if (navigationStack.Count == 0)
            {
                Debug.LogWarning("[UIManager] No previous screen in navigation stack");
                return;
            }

            string previousScreen = navigationStack.Pop();
            await NavigateToScreen(previousScreen, false, transition);
        }

        /// <summary>
        /// Show overlay screen without affecting navigation stack
        /// </summary>
        public async System.Threading.Tasks.Task ShowOverlay(string overlayId, UITransitionType transition = UITransitionType.Fade)
        {
            if (!loadedScreens.ContainsKey(overlayId))
            {
                Debug.LogError($"[UIManager] Overlay not found: {overlayId}");
                return;
            }

            var overlay = loadedScreens[overlayId];
            overlay.RootElement.style.position = Position.Absolute;
            overlay.RootElement.style.top = 0;
            overlay.RootElement.style.left = 0;
            overlay.RootElement.style.width = Length.Percent(100);
            overlay.RootElement.style.height = Length.Percent(100);

            overlayContainer.Add(overlay.RootElement);
            await overlay.Show(transition);

            Debug.Log($"[UIManager] Overlay shown: {overlayId}");
        }

        /// <summary>
        /// Hide overlay screen
        /// </summary>
        public async System.Threading.Tasks.Task HideOverlay(string overlayId, UITransitionType transition = UITransitionType.Fade)
        {
            if (!loadedScreens.ContainsKey(overlayId))
            {
                Debug.LogError($"[UIManager] Overlay not found: {overlayId}");
                return;
            }

            var overlay = loadedScreens[overlayId];
            await overlay.Hide(transition);
            overlayContainer.Remove(overlay.RootElement);

            Debug.Log($"[UIManager] Overlay hidden: {overlayId}");
        }

        #endregion

        #region Screen Loading

        /// <summary>
        /// Load and initialize a UI screen
        /// </summary>
        public UIScreen LoadScreen(string screenId, VisualTreeAsset visualTreeAsset)
        {
            if (loadedScreens.ContainsKey(screenId))
            {
                Debug.LogWarning($"[UIManager] Screen already loaded: {screenId}");
                return loadedScreens[screenId];
            }

            // Create screen instance
            var screenElement = visualTreeAsset.CloneTree();
            var screen = CreateUIScreenInstance(screenId, screenElement);

            // Configure for responsive design
            ConfigureScreenForResponsiveDesign(screenElement);

            // Initialize screen
            screen.Initialize();

            // Store loaded screen
            loadedScreens[screenId] = screen;

            Debug.Log($"[UIManager] Screen loaded: {screenId}");
            return screen;
        }

        /// <summary>
        /// Create UI screen instance based on screen type
        /// </summary>
        private UIScreen CreateUIScreenInstance(string screenId, VisualElement element)
        {
            // Factory pattern for different screen types
            switch (screenId.ToLower())
            {
                case "mainmenu":
                    return new MainMenuScreen(screenId, element);
                case "login":
                    return new LoginScreen(screenId, element);
                case "register":
                    return new RegisterScreen(screenId, element);
                case "game":
                    return new GameScreen(screenId, element);
                case "profile":
                    return new ProfileScreen(screenId, element);
                case "settings":
                    return new SettingsScreen(screenId, element);
                case "leaderboard":
                    return new LeaderboardScreen(screenId, element);
                default:
                    return new UIScreen(screenId, element);
            }
        }

        #endregion

        #region Responsive Design

        /// <summary>
        /// Setup root UI structure for responsive design
        /// </summary>
        private void SetupRootUIStructure()
        {
            rootElement = mainUIDocument.rootVisualElement;
            rootElement.style.width = Length.Percent(100);
            rootElement.style.height = Length.Percent(100);

            // Create main containers
            screenContainer = new VisualElement();
            screenContainer.name = "screen-container";
            screenContainer.style.width = Length.Percent(100);
            screenContainer.style.height = Length.Percent(100);
            screenContainer.style.position = Position.Relative;

            overlayContainer = new VisualElement();
            overlayContainer.name = "overlay-container";
            overlayContainer.style.width = Length.Percent(100);
            overlayContainer.style.height = Length.Percent(100);
            overlayContainer.style.position = Position.Absolute;
            overlayContainer.style.top = 0;
            overlayContainer.style.left = 0;

            loadingContainer = new VisualElement();
            loadingContainer.name = "loading-container";
            loadingContainer.style.width = Length.Percent(100);
            loadingContainer.style.height = Length.Percent(100);
            loadingContainer.style.position = Position.Absolute;
            loadingContainer.style.top = 0;
            loadingContainer.style.left = 0;
            loadingContainer.style.display = DisplayStyle.None;

            // Add to root
            rootElement.Add(screenContainer);
            rootElement.Add(overlayContainer);
            rootElement.Add(loadingContainer);
        }

        /// <summary>
        /// Configure responsive design based on screen size and device type
        /// </summary>
        private void ConfigureResponsiveDesign()
        {
            // Determine device type and orientation
            DeviceType deviceType = GetDeviceType();
            ScreenOrientation orientation = GetScreenOrientation();

            // Apply responsive styles
            ApplyResponsiveStyles(deviceType, orientation);

            Debug.Log($"[UIManager] Responsive design configured - Device: {deviceType}, Orientation: {orientation}");
        }

        /// <summary>
        /// Configure individual screen for responsive design
        /// </summary>
        private void ConfigureScreenForResponsiveDesign(VisualElement screenElement)
        {
            screenElement.style.width = Length.Percent(100);
            screenElement.style.height = Length.Percent(100);
            screenElement.style.position = Position.Absolute;
            screenElement.style.top = 0;
            screenElement.style.left = 0;

            // Apply safe area handling for mobile devices
            ApplySafeAreaPadding(screenElement);
        }

        /// <summary>
        /// Apply safe area padding for notched devices
        /// </summary>
        private void ApplySafeAreaPadding(VisualElement element)
        {
            Rect safeArea = Screen.safeArea;
            float screenWidth = Screen.width;
            float screenHeight = Screen.height;

            // Calculate safe area percentages
            float topPadding = (screenHeight - safeArea.y - safeArea.height) / screenHeight * 100;
            float bottomPadding = safeArea.y / screenHeight * 100;
            float leftPadding = safeArea.x / screenWidth * 100;
            float rightPadding = (screenWidth - safeArea.x - safeArea.width) / screenWidth * 100;

            // Apply padding
            element.style.paddingTop = Length.Percent(topPadding);
            element.style.paddingBottom = Length.Percent(bottomPadding);
            element.style.paddingLeft = Length.Percent(leftPadding);
            element.style.paddingRight = Length.Percent(rightPadding);
        }

        #endregion

        #region Screen Transitions

        /// <summary>
        /// Show screen with transition animation
        /// </summary>
        private async System.Threading.Tasks.Task ShowScreen(string screenId, UITransitionType transition)
        {
            var screen = loadedScreens[screenId];
            screenContainer.Add(screen.RootElement);

            await screen.Show(transition);
        }

        /// <summary>
        /// Hide screen with transition animation
        /// </summary>
        private async System.Threading.Tasks.Task HideScreen(string screenId, UITransitionType transition)
        {
            var screen = loadedScreens[screenId];
            await screen.Hide(transition);
            screenContainer.Remove(screen.RootElement);
        }

        #endregion

        #region Loading Management

        /// <summary>
        /// Show loading screen
        /// </summary>
        public void ShowLoading(string message = "Loading...")
        {
            loadingContainer.style.display = DisplayStyle.Flex;
            // Add loading UI elements and animation
        }

        /// <summary>
        /// Hide loading screen
        /// </summary>
        public void HideLoading()
        {
            loadingContainer.style.display = DisplayStyle.None;
        }

        #endregion

        #region Utility Methods

        /// <summary>
        /// Get device type based on screen size and input method
        /// </summary>
        private DeviceType GetDeviceType()
        {
            if (Application.isMobilePlatform)
            {
                // Check screen size to distinguish tablet from phone
                float screenDiagonal = Mathf.Sqrt(Screen.width * Screen.width + Screen.height * Screen.height) / Screen.dpi;
                return screenDiagonal > 6.5f ? DeviceType.Tablet : DeviceType.Phone;
            }
            return DeviceType.Desktop;
        }

        /// <summary>
        /// Get current screen orientation
        /// </summary>
        private ScreenOrientation GetScreenOrientation()
        {
            return Screen.width > Screen.height ? ScreenOrientation.Landscape : ScreenOrientation.Portrait;
        }

        /// <summary>
        /// Apply responsive styles based on device and orientation
        /// </summary>
        private void ApplyResponsiveStyles(DeviceType deviceType, ScreenOrientation orientation)
        {
            // Implementation for different responsive breakpoints
            string responsiveClass = $"{deviceType.ToString().ToLower()}-{orientation.ToString().ToLower()}";
            rootElement.AddToClassList(responsiveClass);
        }

        /// <summary>
        /// Load initial screens defined in configuration
        /// </summary>
        private void LoadInitialScreens()
        {
            foreach (var screenData in uiScreens)
            {
                if (screenData.loadOnStart && screenData.visualTreeAsset != null)
                {
                    LoadScreen(screenData.screenId, screenData.visualTreeAsset);
                }
            }
        }

        /// <summary>
        /// Monitor screen changes for responsive design updates
        /// </summary>
        private System.Collections.IEnumerator MonitorScreenChanges()
        {
            Vector2 lastScreenSize = ScreenSize;
            ScreenOrientation lastOrientation = GetScreenOrientation();

            while (true)
            {
                yield return new WaitForSeconds(0.5f);

                Vector2 currentScreenSize = ScreenSize;
                ScreenOrientation currentOrientation = GetScreenOrientation();

                if (lastScreenSize != currentScreenSize || lastOrientation != currentOrientation)
                {
                    ConfigureResponsiveDesign();
                    OnScreenSizeChanged();

                    lastScreenSize = currentScreenSize;
                    lastOrientation = currentOrientation;
                }
            }
        }

        /// <summary>
        /// Handle screen size changes
        /// </summary>
        private void OnScreenSizeChanged()
        {
            // Update all loaded screens for new screen size
            foreach (var screen in loadedScreens.Values)
            {
                screen.OnScreenSizeChanged(ScreenSize);
            }

            Debug.Log($"[UIManager] Screen size changed: {ScreenSize}");
        }

        #endregion
    }

    #region Data Structures

    /// <summary>
    /// UI Screen data for configuration
    /// </summary>
    [System.Serializable]
    public class UIScreenData
    {
        public string screenId;
        public VisualTreeAsset visualTreeAsset;
        public bool loadOnStart;
        public bool isOverlay;
    }

    /// <summary>
    /// Device type enumeration for responsive design
    /// </summary>
    public enum DeviceType
    {
        Phone,
        Tablet,
        Desktop
    }

    /// <summary>
    /// Screen orientation enumeration
    /// </summary>
    public enum ScreenOrientation
    {
        Portrait,
        Landscape
    }

    /// <summary>
    /// UI transition types for screen animations
    /// </summary>
    public enum UITransitionType
    {
        None,
        Fade,
        Slide,
        Scale,
        Custom
    }

    #endregion
}
