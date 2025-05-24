using System;
using UnityEngine;
using UnityEngine.UIElements;
using ThinkRank.UI;
using ThinkRank.Core;
using ThinkRank.Data;

namespace ThinkRank.UI.Screens
{
    /// <summary>
    /// Main menu screen implementation providing navigation to all game features
    /// Displays player information and provides access to game modes, profile, and settings
    /// </summary>
    public class MainMenuScreen : UIScreen
    {
        // UI Elements
        private Label playerNameLabel;
        private Label playerLevelLabel;
        private Label playerScoreLabel;
        private VisualElement playerAvatar;
        private Button playButton;
        private Button profileButton;
        private Button settingsButton;
        private Button leaderboardButton;
        private Button achievementsButton;
        private Button tutorialButton;
        private Button logoutButton;
        private VisualElement dailyPuzzlePanel;
        private Label dailyPuzzleCountLabel;
        private Button dailyPuzzleButton;
        private VisualElement newsPanel;
        private Label newsLabel;

        // State
        private PlayerData currentPlayerData;

        /// <summary>
        /// Constructor
        /// </summary>
        public MainMenuScreen(string screenId, VisualElement rootElement) : base(screenId, rootElement)
        {
        }

        #region UI Setup

        /// <summary>
        /// Setup UI elements
        /// </summary>
        protected override void SetupUIElements()
        {
            // Find player info elements
            playerNameLabel = FindElement<Label>("player-name");
            playerLevelLabel = FindElement<Label>("player-level");
            playerScoreLabel = FindElement<Label>("player-score");
            playerAvatar = FindElement<VisualElement>("player-avatar");

            // Find navigation buttons
            playButton = FindElement<Button>("play-button");
            profileButton = FindElement<Button>("profile-button");
            settingsButton = FindElement<Button>("settings-button");
            leaderboardButton = FindElement<Button>("leaderboard-button");
            achievementsButton = FindElement<Button>("achievements-button");
            tutorialButton = FindElement<Button>("tutorial-button");
            logoutButton = FindElement<Button>("logout-button");

            // Find daily puzzle elements
            dailyPuzzlePanel = FindElement<VisualElement>("daily-puzzle-panel");
            dailyPuzzleCountLabel = FindElement<Label>("daily-puzzle-count");
            dailyPuzzleButton = FindElement<Button>("daily-puzzle-button");

            // Find news elements
            newsPanel = FindElement<VisualElement>("news-panel");
            newsLabel = FindElement<Label>("news-label");

            // Setup initial state
            SetupInitialState();
        }

        /// <summary>
        /// Setup initial UI state
        /// </summary>
        private void SetupInitialState()
        {
            // Set default news if panel exists
            if (newsLabel != null)
            {
                newsLabel.text = "Welcome to ThinkRank! Solve puzzles and contribute to AI research.";
            }

            // Set daily puzzle default state
            UpdateDailyPuzzleUI();
        }

        #endregion

        #region Event Binding

        /// <summary>
        /// Bind event handlers
        /// </summary>
        protected override void BindEvents()
        {
            // Navigation button events
            if (playButton != null)
            {
                playButton.clicked += OnPlayButtonClicked;
            }

            if (profileButton != null)
            {
                profileButton.clicked += OnProfileButtonClicked;
            }

            if (settingsButton != null)
            {
                settingsButton.clicked += OnSettingsButtonClicked;
            }

            if (leaderboardButton != null)
            {
                leaderboardButton.clicked += OnLeaderboardButtonClicked;
            }

            if (achievementsButton != null)
            {
                achievementsButton.clicked += OnAchievementsButtonClicked;
            }

            if (tutorialButton != null)
            {
                tutorialButton.clicked += OnTutorialButtonClicked;
            }

            if (logoutButton != null)
            {
                logoutButton.clicked += OnLogoutButtonClicked;
            }

            if (dailyPuzzleButton != null)
            {
                dailyPuzzleButton.clicked += OnDailyPuzzleButtonClicked;
            }

            // Data events
            PlayerDataManager.OnPlayerDataLoaded += OnPlayerDataLoaded;
            PlayerDataManager.OnPlayerDataSaved += OnPlayerDataSaved;
        }

        /// <summary>
        /// Unbind event handlers
        /// </summary>
        protected override void UnbindEvents()
        {
            // Navigation button events
            if (playButton != null)
            {
                playButton.clicked -= OnPlayButtonClicked;
            }

            if (profileButton != null)
            {
                profileButton.clicked -= OnProfileButtonClicked;
            }

            if (settingsButton != null)
            {
                settingsButton.clicked -= OnSettingsButtonClicked;
            }

            if (leaderboardButton != null)
            {
                leaderboardButton.clicked -= OnLeaderboardButtonClicked;
            }

            if (achievementsButton != null)
            {
                achievementsButton.clicked -= OnAchievementsButtonClicked;
            }

            if (tutorialButton != null)
            {
                tutorialButton.clicked -= OnTutorialButtonClicked;
            }

            if (logoutButton != null)
            {
                logoutButton.clicked -= OnLogoutButtonClicked;
            }

            if (dailyPuzzleButton != null)
            {
                dailyPuzzleButton.clicked -= OnDailyPuzzleButtonClicked;
            }

            // Data events
            PlayerDataManager.OnPlayerDataLoaded -= OnPlayerDataLoaded;
            PlayerDataManager.OnPlayerDataSaved -= OnPlayerDataSaved;
        }

        #endregion

        #region Event Handlers

        /// <summary>
        /// Handle play button click
        /// </summary>
        private async void OnPlayButtonClicked()
        {
            GameManager.Instance?.AudioManager?.PlayUISFX("ui_click");

            // Check if user needs tutorial
            if (ShouldShowTutorial())
            {
                await GameManager.Instance.UIManager.NavigateToScreen("tutorial");
            }
            else
            {
                await GameManager.Instance.SceneManager.GoToGame();
            }
        }

        /// <summary>
        /// Handle profile button click
        /// </summary>
        private async void OnProfileButtonClicked()
        {
            GameManager.Instance?.AudioManager?.PlayUISFX("ui_click");
            await GameManager.Instance.UIManager.NavigateToScreen("profile");
        }

        /// <summary>
        /// Handle settings button click
        /// </summary>
        private async void OnSettingsButtonClicked()
        {
            GameManager.Instance?.AudioManager?.PlayUISFX("ui_click");
            await GameManager.Instance.UIManager.NavigateToScreen("settings");
        }

        /// <summary>
        /// Handle leaderboard button click
        /// </summary>
        private async void OnLeaderboardButtonClicked()
        {
            GameManager.Instance?.AudioManager?.PlayUISFX("ui_click");
            await GameManager.Instance.UIManager.NavigateToScreen("leaderboard");
        }

        /// <summary>
        /// Handle achievements button click
        /// </summary>
        private async void OnAchievementsButtonClicked()
        {
            GameManager.Instance?.AudioManager?.PlayUISFX("ui_click");
            await GameManager.Instance.UIManager.ShowOverlay("achievements");
        }

        /// <summary>
        /// Handle tutorial button click
        /// </summary>
        private async void OnTutorialButtonClicked()
        {
            GameManager.Instance?.AudioManager?.PlayUISFX("ui_click");
            await GameManager.Instance.UIManager.NavigateToScreen("tutorial");
        }

        /// <summary>
        /// Handle logout button click
        /// </summary>
        private async void OnLogoutButtonClicked()
        {
            GameManager.Instance?.AudioManager?.PlayUISFX("ui_click");

            // Show confirmation dialog
            await GameManager.Instance.UIManager.ShowOverlay("logout-confirmation");
        }

        /// <summary>
        /// Handle daily puzzle button click
        /// </summary>
        private async void OnDailyPuzzleButtonClicked()
        {
            GameManager.Instance?.AudioManager?.PlayUISFX("ui_click");

            // Check if daily puzzles are available
            if (HasDailyPuzzlesRemaining())
            {
                // Start daily puzzle mode
                await StartDailyPuzzle();
            }
            else
            {
                ShowDailyPuzzleLimitMessage();
            }
        }

        /// <summary>
        /// Handle player data loaded
        /// </summary>
        private void OnPlayerDataLoaded(PlayerData playerData)
        {
            currentPlayerData = playerData;
            UpdatePlayerInfoUI();
            UpdateDailyPuzzleUI();
        }

        /// <summary>
        /// Handle player data saved
        /// </summary>
        private void OnPlayerDataSaved(PlayerData playerData)
        {
            currentPlayerData = playerData;
            UpdatePlayerInfoUI();
        }

        #endregion

        #region UI Updates

        /// <summary>
        /// Update player information display
        /// </summary>
        private void UpdatePlayerInfoUI()
        {
            if (currentPlayerData?.gameProgress == null) return;

            var progress = currentPlayerData.gameProgress;

            // Update player name
            if (playerNameLabel != null)
            {
                string displayName = !string.IsNullOrEmpty(currentPlayerData.gameProgress?.ToString())
                    ? "Player" // Would get from user profile
                    : "Guest";
                playerNameLabel.text = displayName;
            }

            // Update level
            if (playerLevelLabel != null)
            {
                playerLevelLabel.text = $"Level {progress.level}";
            }

            // Update score
            if (playerScoreLabel != null)
            {
                playerScoreLabel.text = $"Score: {progress.totalScore:N0}";
            }

            // Update avatar (placeholder implementation)
            if (playerAvatar != null)
            {
                // Set avatar image or initials
                playerAvatar.style.backgroundColor = GetPlayerColor(progress.level);
            }
        }

        /// <summary>
        /// Update daily puzzle UI
        /// </summary>
        private void UpdateDailyPuzzleUI()
        {
            if (dailyPuzzleCountLabel == null) return;

            int remaining = GetDailyPuzzlesRemaining();
            int total = GameManager.Instance?.gameConfig?.dailyPuzzleLimit ?? 5;

            dailyPuzzleCountLabel.text = $"{remaining}/{total} Daily Puzzles";

            // Update button state
            if (dailyPuzzleButton != null)
            {
                SetElementInteractable(dailyPuzzleButton, remaining > 0);
            }
        }

        /// <summary>
        /// Get player color based on level
        /// </summary>
        private Color GetPlayerColor(int level)
        {
            // Simple color progression based on level
            float hue = (level * 30f) % 360f / 360f;
            return Color.HSVToRGB(hue, 0.7f, 0.9f);
        }

        #endregion

        #region Game Logic

        /// <summary>
        /// Check if user should see tutorial
        /// </summary>
        private bool ShouldShowTutorial()
        {
            if (currentPlayerData?.gameProgress == null) return true;

            // Show tutorial if user hasn't completed basic tutorial
            return !currentPlayerData.gameProgress.completedTutorials.Contains("basic_gameplay");
        }

        /// <summary>
        /// Check if daily puzzles are remaining
        /// </summary>
        private bool HasDailyPuzzlesRemaining()
        {
            return GetDailyPuzzlesRemaining() > 0;
        }

        /// <summary>
        /// Get remaining daily puzzles count
        /// </summary>
        private int GetDailyPuzzlesRemaining()
        {
            // This would check against server data for daily puzzle tracking
            // For now, use a simple local implementation
            int dailyLimit = GameManager.Instance?.gameConfig?.dailyPuzzleLimit ?? 5;

            // Check if we have local tracking for today
            string today = DateTime.Now.ToString("yyyy-MM-dd");
            string lastPuzzleDate = PlayerPrefs.GetString("LastDailyPuzzleDate", "");
            int puzzlesToday = PlayerPrefs.GetInt("DailyPuzzlesToday", 0);

            if (lastPuzzleDate != today)
            {
                // Reset daily count
                puzzlesToday = 0;
                PlayerPrefs.SetString("LastDailyPuzzleDate", today);
                PlayerPrefs.SetInt("DailyPuzzlesToday", 0);
            }

            return Mathf.Max(0, dailyLimit - puzzlesToday);
        }

        /// <summary>
        /// Start daily puzzle mode
        /// </summary>
        private async System.Threading.Tasks.Task StartDailyPuzzle()
        {
            // Increment daily puzzle count
            int puzzlesToday = PlayerPrefs.GetInt("DailyPuzzlesToday", 0) + 1;
            PlayerPrefs.SetInt("DailyPuzzlesToday", puzzlesToday);
            PlayerPrefs.Save();

            // Update UI
            UpdateDailyPuzzleUI();

            // Navigate to game with daily puzzle mode
            await GameManager.Instance.SceneManager.GoToGame();
        }

        /// <summary>
        /// Show daily puzzle limit message
        /// </summary>
        private async void ShowDailyPuzzleLimitMessage()
        {
            // Show overlay with limit information
            await GameManager.Instance.UIManager.ShowOverlay("daily-puzzle-limit");
        }

        #endregion

        #region Screen Lifecycle

        /// <summary>
        /// Called before screen is shown
        /// </summary>
        protected override void OnBeforeShow()
        {
            // Load current player data
            currentPlayerData = GameManager.Instance?.PlayerDataManager?.CurrentPlayerData;

            // Update UI
            UpdatePlayerInfoUI();
            UpdateDailyPuzzleUI();

            // Play background music
            GameManager.Instance?.AudioManager?.PlayMusic("background_menu");
        }

        /// <summary>
        /// Called after screen is shown
        /// </summary>
        protected override void OnAfterShow()
        {
            // Check for achievements or notifications
            CheckForNotifications();
        }

        /// <summary>
        /// Check for notifications to display
        /// </summary>
        private void CheckForNotifications()
        {
            // Check for level up notifications, new achievements, etc.
            // This would integrate with a notification system
        }

        #endregion

        #region Responsive Design

        /// <summary>
        /// Configure responsive design
        /// </summary>
        protected override void ConfigureResponsiveDesign()
        {
            float screenWidth = Screen.width;
            float screenHeight = Screen.height;
            bool isLandscape = screenWidth > screenHeight;

            // Add responsive classes
            RootElement.RemoveFromClassList("portrait");
            RootElement.RemoveFromClassList("landscape");
            RootElement.AddToClassList(isLandscape ? "landscape" : "portrait");

            // Add device size classes
            RootElement.RemoveFromClassList("small");
            RootElement.RemoveFromClassList("medium");
            RootElement.RemoveFromClassList("large");

            if (screenWidth < 768)
            {
                RootElement.AddToClassList("small");
                // On small screens, stack elements vertically
                AdjustLayoutForSmallScreen();
            }
            else if (screenWidth < 1024)
            {
                RootElement.AddToClassList("medium");
                AdjustLayoutForMediumScreen();
            }
            else
            {
                RootElement.AddToClassList("large");
                AdjustLayoutForLargeScreen();
            }
        }

        /// <summary>
        /// Adjust layout for small screens
        /// </summary>
        private void AdjustLayoutForSmallScreen()
        {
            // Hide less important elements on small screens
            if (newsPanel != null)
            {
                newsPanel.style.display = DisplayStyle.None;
            }

            // Make buttons full width
            SetButtonsFullWidth(true);
        }

        /// <summary>
        /// Adjust layout for medium screens
        /// </summary>
        private void AdjustLayoutForMediumScreen()
        {
            // Show all elements
            if (newsPanel != null)
            {
                newsPanel.style.display = DisplayStyle.Flex;
            }

            SetButtonsFullWidth(false);
        }

        /// <summary>
        /// Adjust layout for large screens
        /// </summary>
        private void AdjustLayoutForLargeScreen()
        {
            // Optimize for large screens with side-by-side layout
            if (newsPanel != null)
            {
                newsPanel.style.display = DisplayStyle.Flex;
            }

            SetButtonsFullWidth(false);
        }

        /// <summary>
        /// Set buttons to full width or auto width
        /// </summary>
        private void SetButtonsFullWidth(bool fullWidth)
        {
            var buttons = new[] { playButton, profileButton, settingsButton, leaderboardButton };

            foreach (var button in buttons)
            {
                if (button != null)
                {
                    button.style.width = fullWidth ? Length.Percent(100) : StyleKeyword.Auto;
                }
            }
        }

        #endregion
    }
}
