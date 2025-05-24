using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;
using ThinkRank.UI;
using ThinkRank.Core;
using ThinkRank.Data;
using ThinkRank.Input;

namespace ThinkRank.UI.Screens
{
    /// <summary>
    /// Game screen implementation for puzzle gameplay
    /// Provides the main game interface and puzzle interaction framework
    /// </summary>
    public class GameScreen : UIScreen
    {
        // UI Elements
        private Label scoreLabel;
        private Label levelLabel;
        private Label timerLabel;
        private Label puzzleLabel;
        private VisualElement puzzleContainer;
        private Button hintButton;
        private Button pauseButton;
        private Button submitButton;
        private ProgressBar progressBar;
        private VisualElement gameOverlay;
        private Button menuButton;

        // Game State
        private bool isGameActive = false;
        private bool isPaused = false;
        private float gameTime = 0f;
        private int currentScore = 0;
        private int currentLevel = 1;
        private float puzzleStartTime;
        private GameSession currentSession;

        // Game Configuration
        private readonly float maxPuzzleTime = 120f; // 2 minutes per puzzle

        /// <summary>
        /// Constructor
        /// </summary>
        public GameScreen(string screenId, VisualElement rootElement) : base(screenId, rootElement)
        {
        }

        #region UI Setup

        /// <summary>
        /// Setup UI elements
        /// </summary>
        protected override void SetupUIElements()
        {
            // Find HUD elements
            scoreLabel = FindElement<Label>("score-label");
            levelLabel = FindElement<Label>("level-label");
            timerLabel = FindElement<Label>("timer-label");
            puzzleLabel = FindElement<Label>("puzzle-label");
            progressBar = FindElement<ProgressBar>("progress-bar");

            // Find game elements
            puzzleContainer = FindElement<VisualElement>("puzzle-container");
            hintButton = FindElement<Button>("hint-button");
            pauseButton = FindElement<Button>("pause-button");
            submitButton = FindElement<Button>("submit-button");
            gameOverlay = FindElement<VisualElement>("game-overlay");
            menuButton = FindElement<Button>("menu-button");

            // Configure initial state
            if (gameOverlay != null)
            {
                gameOverlay.style.display = DisplayStyle.None;
            }

            if (progressBar != null)
            {
                progressBar.value = 0f;
            }

            SetupInitialGameState();
        }

        /// <summary>
        /// Setup initial game state
        /// </summary>
        private void SetupInitialGameState()
        {
            UpdateScoreDisplay(0);
            UpdateLevelDisplay(1);
            UpdateTimerDisplay(maxPuzzleTime);
        }

        #endregion

        #region Event Binding

        /// <summary>
        /// Bind event handlers
        /// </summary>
        protected override void BindEvents()
        {
            // Button events
            if (hintButton != null)
            {
                hintButton.clicked += OnHintButtonClicked;
            }

            if (pauseButton != null)
            {
                pauseButton.clicked += OnPauseButtonClicked;
            }

            if (submitButton != null)
            {
                submitButton.clicked += OnSubmitButtonClicked;
            }

            if (menuButton != null)
            {
                menuButton.clicked += OnMenuButtonClicked;
            }

            // Input events
            InputManager.OnTouchEvent += OnTouchEvent;
            InputManager.OnGestureEvent += OnGestureEvent;

            // Game state events
            GameManager.OnGameStateChanged += OnGameStateChanged;
        }

        /// <summary>
        /// Unbind event handlers
        /// </summary>
        protected override void UnbindEvents()
        {
            // Button events
            if (hintButton != null)
            {
                hintButton.clicked -= OnHintButtonClicked;
            }

            if (pauseButton != null)
            {
                pauseButton.clicked -= OnPauseButtonClicked;
            }

            if (submitButton != null)
            {
                submitButton.clicked -= OnSubmitButtonClicked;
            }

            if (menuButton != null)
            {
                menuButton.clicked -= OnMenuButtonClicked;
            }

            // Input events
            InputManager.OnTouchEvent -= OnTouchEvent;
            InputManager.OnGestureEvent -= OnGestureEvent;

            // Game state events
            GameManager.OnGameStateChanged -= OnGameStateChanged;
        }

        #endregion

        #region Event Handlers

        /// <summary>
        /// Handle hint button click
        /// </summary>
        private void OnHintButtonClicked()
        {
            GameManager.Instance?.AudioManager?.PlayUISFX("ui_click");

            if (isGameActive)
            {
                ShowHint();
            }
        }

        /// <summary>
        /// Handle pause button click
        /// </summary>
        private void OnPauseButtonClicked()
        {
            GameManager.Instance?.AudioManager?.PlayUISFX("ui_click");

            if (isGameActive)
            {
                TogglePause();
            }
        }

        /// <summary>
        /// Handle submit button click
        /// </summary>
        private void OnSubmitButtonClicked()
        {
            GameManager.Instance?.AudioManager?.PlayUISFX("ui_click");

            if (isGameActive && !isPaused)
            {
                SubmitPuzzleSolution();
            }
        }

        /// <summary>
        /// Handle menu button click
        /// </summary>
        private async void OnMenuButtonClicked()
        {
            GameManager.Instance?.AudioManager?.PlayUISFX("ui_click");

            // Show pause overlay with menu options
            ShowPauseOverlay();
        }

        /// <summary>
        /// Handle touch events
        /// </summary>
        private void OnTouchEvent(TouchEvent touchEvent)
        {
            if (!isGameActive || isPaused) return;

            // Process touch input for puzzle interaction
            ProcessPuzzleTouch(touchEvent);
        }

        /// <summary>
        /// Handle gesture events
        /// </summary>
        private void OnGestureEvent(GestureEvent gestureEvent)
        {
            if (!isGameActive || isPaused) return;

            // Process gestures for puzzle interaction
            ProcessPuzzleGesture(gestureEvent);
        }

        /// <summary>
        /// Handle game state changes
        /// </summary>
        private void OnGameStateChanged(GameState newState)
        {
            switch (newState)
            {
                case GameState.Playing:
                    if (IsVisible && !isGameActive)
                    {
                        StartNewGame();
                    }
                    break;
                case GameState.Paused:
                    if (IsVisible && isGameActive)
                    {
                        PauseGame();
                    }
                    break;
            }
        }

        #endregion

        #region Game Logic

        /// <summary>
        /// Start a new game session
        /// </summary>
        private void StartNewGame()
        {
            Debug.Log("[GameScreen] Starting new game session");

            // Initialize game session
            currentSession = new GameSession
            {
                startTime = DateTime.UtcNow,
                currentLevel = 1,
                totalScore = 0,
                puzzlesSolved = 0
            };

            // Reset game state
            isGameActive = true;
            isPaused = false;
            gameTime = 0f;
            currentScore = 0;
            currentLevel = 1;

            // Update UI
            UpdateGameUI();

            // Load first puzzle
            LoadNextPuzzle();

            // Play game music
            GameManager.Instance?.AudioManager?.PlayMusic("background_game");
        }

        /// <summary>
        /// Load the next puzzle
        /// </summary>
        private void LoadNextPuzzle()
        {
            Debug.Log($"[GameScreen] Loading puzzle for level {currentLevel}");

            // Reset puzzle timer
            puzzleStartTime = Time.unscaledTime;

            // Generate or load puzzle (placeholder implementation)
            GeneratePuzzle(currentLevel);

            // Update UI
            if (puzzleLabel != null)
            {
                puzzleLabel.text = $"Puzzle {currentSession.puzzlesSolved + 1}";
            }

            UpdateTimerDisplay(maxPuzzleTime);
        }

        /// <summary>
        /// Generate a puzzle for the current level (placeholder)
        /// </summary>
        private void GeneratePuzzle(int level)
        {
            // This is a placeholder implementation
            // In a real game, this would generate or fetch puzzles from the server

            if (puzzleContainer != null)
            {
                // Clear previous puzzle
                puzzleContainer.Clear();

                // Create a simple placeholder puzzle UI
                var puzzleContent = new Label($"Level {level} Puzzle");
                puzzleContent.AddToClassList("puzzle-content");
                puzzleContainer.Add(puzzleContent);

                var puzzleDescription = new Label("Solve this puzzle by interacting with the elements below.");
                puzzleDescription.AddToClassList("puzzle-description");
                puzzleContainer.Add(puzzleDescription);

                // Add some interactive elements
                for (int i = 0; i < 3 + level; i++)
                {
                    var element = new Button($"Element {i + 1}");
                    element.AddToClassList("puzzle-element");
                    element.clicked += () => OnPuzzleElementClicked(element);
                    puzzleContainer.Add(element);
                }
            }
        }

        /// <summary>
        /// Handle puzzle element interaction
        /// </summary>
        private void OnPuzzleElementClicked(Button element)
        {
            GameManager.Instance?.AudioManager?.PlayUISFX("ui_click");

            // Toggle element state (placeholder logic)
            if (element.ClassListContains("selected"))
            {
                element.RemoveFromClassList("selected");
            }
            else
            {
                element.AddToClassList("selected");
            }

            // Check if puzzle is solved (placeholder logic)
            CheckPuzzleCompletion();
        }

        /// <summary>
        /// Check if current puzzle is completed
        /// </summary>
        private void CheckPuzzleCompletion()
        {
            if (puzzleContainer == null) return;

            // Simple completion check: all elements selected (placeholder)
            var elements = puzzleContainer.Query<Button>().ToList();
            bool allSelected = elements.Count > 0 && elements.TrueForAll(e => e.ClassListContains("selected"));

            if (allSelected)
            {
                CompletePuzzle(true);
            }
        }

        /// <summary>
        /// Submit the current puzzle solution
        /// </summary>
        private void SubmitPuzzleSolution()
        {
            // For now, just complete the puzzle
            // In a real implementation, this would validate the solution
            CheckPuzzleCompletion();
        }

        /// <summary>
        /// Complete the current puzzle
        /// </summary>
        private void CompletePuzzle(bool solved)
        {
            if (!isGameActive) return;

            float puzzleTime = Time.unscaledTime - puzzleStartTime;
            int scoreGained = 0;

            if (solved)
            {
                // Calculate score based on time and level
                float timeBonus = Mathf.Max(0, (maxPuzzleTime - puzzleTime) / maxPuzzleTime);
                scoreGained = Mathf.RoundToInt((100 * currentLevel) * (1 + timeBonus));

                currentScore += scoreGained;
                currentSession.puzzlesSolved++;

                // Play success sound
                GameManager.Instance?.AudioManager?.PlayUISFX("puzzle_complete");

                Debug.Log($"[GameScreen] Puzzle completed! Score gained: {scoreGained}");

                // Level up check
                if (currentSession.puzzlesSolved % 3 == 0) // Level up every 3 puzzles
                {
                    LevelUp();
                }
                else
                {
                    // Load next puzzle after delay
                    StartCoroutine(LoadNextPuzzleAfterDelay(1.5f));
                }
            }
            else
            {
                // Puzzle failed (time out or wrong solution)
                GameManager.Instance?.AudioManager?.PlayUISFX("ui_error");
                ShowGameOver();
            }

            // Update player data
            UpdatePlayerProgress(scoreGained, solved);

            // Update UI
            UpdateGameUI();
        }

        /// <summary>
        /// Level up the player
        /// </summary>
        private void LevelUp()
        {
            currentLevel++;

            // Play level up sound
            GameManager.Instance?.AudioManager?.PlayUISFX("level_up");

            Debug.Log($"[GameScreen] Level up! New level: {currentLevel}");

            // Show level up effect
            ShowLevelUpEffect();

            // Load next puzzle after level up delay
            StartCoroutine(LoadNextPuzzleAfterDelay(2f));
        }

        /// <summary>
        /// Load next puzzle after delay
        /// </summary>
        private System.Collections.IEnumerator LoadNextPuzzleAfterDelay(float delay)
        {
            yield return new WaitForSeconds(delay);
            LoadNextPuzzle();
        }

        /// <summary>
        /// Update player progress data
        /// </summary>
        private void UpdatePlayerProgress(int scoreGained, bool puzzleSolved)
        {
            if (GameManager.Instance?.PlayerDataManager != null)
            {
                int experienceGained = puzzleSolved ? 10 * currentLevel : 0;
                GameManager.Instance.PlayerDataManager.UpdateGameProgress(scoreGained, experienceGained, puzzleSolved);
            }
        }

        #endregion

        #region Game Controls

        /// <summary>
        /// Toggle pause state
        /// </summary>
        private void TogglePause()
        {
            if (isPaused)
            {
                ResumeGame();
            }
            else
            {
                PauseGame();
            }
        }

        /// <summary>
        /// Pause the game
        /// </summary>
        private void PauseGame()
        {
            isPaused = true;
            ShowPauseOverlay();
            Debug.Log("[GameScreen] Game paused");
        }

        /// <summary>
        /// Resume the game
        /// </summary>
        private void ResumeGame()
        {
            isPaused = false;
            HidePauseOverlay();
            Debug.Log("[GameScreen] Game resumed");
        }

        /// <summary>
        /// Show hint for current puzzle
        /// </summary>
        private void ShowHint()
        {
            // Placeholder hint implementation
            Debug.Log("[GameScreen] Hint requested");

            // In a real implementation, this would show puzzle-specific hints
            if (puzzleLabel != null)
            {
                puzzleLabel.text = "Hint: Try selecting elements in order!";
                StartCoroutine(ClearHintAfterDelay(3f));
            }
        }

        /// <summary>
        /// Clear hint text after delay
        /// </summary>
        private System.Collections.IEnumerator ClearHintAfterDelay(float delay)
        {
            yield return new WaitForSeconds(delay);

            if (puzzleLabel != null)
            {
                puzzleLabel.text = $"Puzzle {currentSession.puzzlesSolved + 1}";
            }
        }

        #endregion

        #region UI Updates

        /// <summary>
        /// Update game UI elements
        /// </summary>
        private void UpdateGameUI()
        {
            UpdateScoreDisplay(currentScore);
            UpdateLevelDisplay(currentLevel);
            UpdateProgressBar();
        }

        /// <summary>
        /// Update score display
        /// </summary>
        private void UpdateScoreDisplay(int score)
        {
            if (scoreLabel != null)
            {
                scoreLabel.text = $"Score: {score:N0}";
            }
        }

        /// <summary>
        /// Update level display
        /// </summary>
        private void UpdateLevelDisplay(int level)
        {
            if (levelLabel != null)
            {
                levelLabel.text = $"Level {level}";
            }
        }

        /// <summary>
        /// Update timer display
        /// </summary>
        private void UpdateTimerDisplay(float timeRemaining)
        {
            if (timerLabel != null)
            {
                int minutes = Mathf.FloorToInt(timeRemaining / 60);
                int seconds = Mathf.FloorToInt(timeRemaining % 60);
                timerLabel.text = $"{minutes:00}:{seconds:00}";

                // Color code based on time remaining
                if (timeRemaining < 30f)
                {
                    timerLabel.AddToClassList("warning");
                }
                else
                {
                    timerLabel.RemoveFromClassList("warning");
                }
            }
        }

        /// <summary>
        /// Update progress bar
        /// </summary>
        private void UpdateProgressBar()
        {
            if (progressBar != null && currentSession != null)
            {
                // Show progress within current level (puzzles solved % 3)
                float progress = (currentSession.puzzlesSolved % 3) / 3f;
                progressBar.value = progress;
            }
        }

        /// <summary>
        /// Show level up effect
        /// </summary>
        private void ShowLevelUpEffect()
        {
            // Placeholder for level up visual effect
            Debug.Log("[GameScreen] Showing level up effect");
        }

        /// <summary>
        /// Show pause overlay
        /// </summary>
        private void ShowPauseOverlay()
        {
            if (gameOverlay != null)
            {
                gameOverlay.style.display = DisplayStyle.Flex;

                // Add pause menu content
                gameOverlay.Clear();

                var pauseTitle = new Label("Game Paused");
                pauseTitle.AddToClassList("pause-title");
                gameOverlay.Add(pauseTitle);

                var resumeButton = new Button("Resume");
                resumeButton.clicked += () => ResumeGame();
                gameOverlay.Add(resumeButton);

                var mainMenuButton = new Button("Main Menu");
                mainMenuButton.clicked += async () => await ReturnToMainMenu();
                gameOverlay.Add(mainMenuButton);
            }
        }

        /// <summary>
        /// Hide pause overlay
        /// </summary>
        private void HidePauseOverlay()
        {
            if (gameOverlay != null)
            {
                gameOverlay.style.display = DisplayStyle.None;
            }
        }

        /// <summary>
        /// Show game over screen
        /// </summary>
        private void ShowGameOver()
        {
            isGameActive = false;

            if (gameOverlay != null)
            {
                gameOverlay.style.display = DisplayStyle.Flex;
                gameOverlay.Clear();

                var gameOverTitle = new Label("Game Over");
                gameOverTitle.AddToClassList("game-over-title");
                gameOverlay.Add(gameOverTitle);

                var finalScore = new Label($"Final Score: {currentScore:N0}");
                finalScore.AddToClassList("final-score");
                gameOverlay.Add(finalScore);

                var playAgainButton = new Button("Play Again");
                playAgainButton.clicked += () => StartNewGame();
                gameOverlay.Add(playAgainButton);

                var mainMenuButton = new Button("Main Menu");
                mainMenuButton.clicked += async () => await ReturnToMainMenu();
                gameOverlay.Add(mainMenuButton);
            }
        }

        /// <summary>
        /// Return to main menu
        /// </summary>
        private async System.Threading.Tasks.Task ReturnToMainMenu()
        {
            isGameActive = false;
            await GameManager.Instance.SceneManager.GoToMainMenu();
        }

        #endregion

        #region Input Processing

        /// <summary>
        /// Process touch input for puzzle interaction
        /// </summary>
        private void ProcessPuzzleTouch(TouchEvent touchEvent)
        {
            // Basic touch processing for puzzle interaction
            // This would be expanded based on specific puzzle mechanics

            if (touchEvent.eventType == TouchEventType.TouchDown)
            {
                // Handle puzzle touch interaction
                Vector2 screenPos = touchEvent.touchData.currentPosition;
                // Convert to world/puzzle coordinates and process
            }
        }

        /// <summary>
        /// Process gesture input for puzzle interaction
        /// </summary>
        private void ProcessPuzzleGesture(GestureEvent gestureEvent)
        {
            // Process gestures for puzzle mechanics
            switch (gestureEvent.gestureType)
            {
                case GestureType.Swipe:
                    // Handle swipe gestures for puzzle navigation
                    break;
                case GestureType.Pinch:
                    // Handle pinch for zoom/scale operations
                    break;
                case GestureType.DoubleTap:
                    // Handle double tap for special actions
                    break;
            }
        }

        #endregion

        #region Screen Lifecycle

        /// <summary>
        /// Called before screen is shown
        /// </summary>
        protected override void OnBeforeShow()
        {
            // Initialize game state
            if (GameManager.Instance?.CurrentGameState == GameState.Playing)
            {
                StartNewGame();
            }
        }

        /// <summary>
        /// Called after screen is hidden
        /// </summary>
        protected override void OnAfterHide()
        {
            // Save game progress and cleanup
            if (isGameActive)
            {
                EndGameSession();
            }
        }

        /// <summary>
        /// Update method called each frame
        /// </summary>
        public override void Update()
        {
            if (!isGameActive || isPaused) return;

            // Update game timer
            gameTime += Time.unscaledDeltaTime;

            // Update puzzle timer
            float puzzleTimeRemaining = maxPuzzleTime - (Time.unscaledTime - puzzleStartTime);
            UpdateTimerDisplay(puzzleTimeRemaining);

            // Check for time out
            if (puzzleTimeRemaining <= 0)
            {
                CompletePuzzle(false); // Time out
            }
        }

        /// <summary>
        /// End current game session
        /// </summary>
        private void EndGameSession()
        {
            if (currentSession == null) return;

            // Update session data
            currentSession.endTime = DateTime.UtcNow;
            currentSession.totalScore = currentScore;
            currentSession.sessionDuration = gameTime;

            // Update player data manager
            if (GameManager.Instance?.PlayerDataManager != null)
            {
                GameManager.Instance.PlayerDataManager.UpdatePlayTime(gameTime);
            }

            Debug.Log($"[GameScreen] Game session ended - Score: {currentScore}, Time: {gameTime:F1}s");

            isGameActive = false;
        }

        #endregion
    }

    #region Data Structures

    /// <summary>
    /// Game session data
    /// </summary>
    [System.Serializable]
    public class GameSession
    {
        public DateTime startTime;
        public DateTime endTime;
        public int currentLevel;
        public int totalScore;
        public int puzzlesSolved;
        public float sessionDuration;
    }

    #endregion
}
