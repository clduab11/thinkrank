using System;
using UnityEngine;
using UnityEngine.UIElements;
using ThinkRank.Core;
using ThinkRank.UI;

namespace ThinkRank.Game
{
    /// <summary>
    /// Main scene controller for Mind Maze gameplay
    /// Integrates with existing game architecture while providing Mind Maze specific functionality
    /// </summary>
    public class MindMazeGameScene : MonoBehaviour
    {
        [Header("Core Integration")]
        [SerializeField] private ResearchGameManager researchGameManager;
        [SerializeField] private MindMazeController mindMazeController;
        [SerializeField] private GameManager gameManager;
        [SerializeField] private UIManager uiManager;
        
        [Header("Mind Maze UI")]
        [SerializeField] private VisualTreeAsset mindMazeUI;
        [SerializeField] private VisualTreeAsset ethicalChoiceDialog;
        [SerializeField] private VisualTreeAsset progressDisplay;
        
        [Header("Scene Configuration")]
        [SerializeField] private bool startAutomatically = true;
        [SerializeField] private int initialFloorDepth = 1;
        [SerializeField] private PlayerMoralProfile testProfile;
        
        // UI Elements
        private VisualElement rootElement;
        private VisualElement gameplayContainer;
        private VisualElement ethicalChoiceContainer;
        private VisualElement progressContainer;
        private Label floorLabel;
        private Label ethicalFrameworkLabel;
        private ProgressBar consistencyBar;
        private Button nextFloorButton;
        private Button exitButton;
        
        // Game State
        private bool isGameActive = false;
        private int currentFloor = 1;
        private PlayerMoralProfile currentProfile;
        
        // Events
        public static event Action<int> OnFloorStarted;
        public static event Action<int, float> OnFloorCompleted;
        public static event Action OnGameSessionEnded;
        
        private void Awake()
        {
            // Find required components if not assigned
            if (researchGameManager == null)
                researchGameManager = FindObjectOfType<ResearchGameManager>();
                
            if (mindMazeController == null)
                mindMazeController = FindObjectOfType<MindMazeController>();
                
            if (gameManager == null)
                gameManager = GameManager.Instance;
                
            if (uiManager == null)
                uiManager = FindObjectOfType<UIManager>();
        }
        
        private void Start()
        {
            InitializeScene();
            
            if (startAutomatically)
            {
                StartMindMazeSession();
            }
        }
        
        private void InitializeScene()
        {
            Debug.Log("[MindMazeGameScene] Initializing Mind Maze scene");
            
            // Setup UI
            SetupUI();
            
            // Bind events
            BindEvents();
            
            // Initialize components
            InitializeComponents();
            
            Debug.Log("[MindMazeGameScene] Scene initialization completed");
        }
        
        private void SetupUI()
        {
            // Get root UI element
            var uiDocument = GetComponent<UIDocument>();
            if (uiDocument == null)
            {
                Debug.LogError("[MindMazeGameScene] No UIDocument component found");
                return;
            }
            
            rootElement = uiDocument.rootVisualElement;
            
            // Setup main UI structure
            if (mindMazeUI != null)
            {
                var mindMazeContainer = mindMazeUI.CloneTree();
                rootElement.Add(mindMazeContainer);
                
                // Find UI elements
                gameplayContainer = rootElement.Q<VisualElement>("gameplay-container");
                ethicalChoiceContainer = rootElement.Q<VisualElement>("ethical-choice-container");
                progressContainer = rootElement.Q<VisualElement>("progress-container");
                
                floorLabel = rootElement.Q<Label>("floor-label");
                ethicalFrameworkLabel = rootElement.Q<Label>("framework-label");
                consistencyBar = rootElement.Q<ProgressBar>("consistency-bar");
                
                nextFloorButton = rootElement.Q<Button>("next-floor-button");
                exitButton = rootElement.Q<Button>("exit-button");
                
                // Setup button callbacks
                if (nextFloorButton != null)
                    nextFloorButton.clicked += OnNextFloorClicked;
                    
                if (exitButton != null)
                    exitButton.clicked += OnExitClicked;
            }
            
            // Initially hide choice container
            if (ethicalChoiceContainer != null)
                ethicalChoiceContainer.style.display = DisplayStyle.None;
        }
        
        private void BindEvents()
        {
            // Mind Maze Controller events
            if (mindMazeController != null)
            {
                MindMazeController.OnEthicalChoiceMade += OnEthicalChoiceMade;
                MindMazeController.OnMazeTransformation += OnMazeTransformation;
                MindMazeController.OnFloorCompleted += OnFloorCompletedHandler;
                MindMazeController.OnFrameworkMastered += OnFrameworkMastered;
            }
            
            // Geometry Transformation events
            GeometryTransformationSystem.OnTransformationStarted += OnTransformationStarted;
            GeometryTransformationSystem.OnTransformationCompleted += OnTransformationCompleted;
        }
        
        private void UnbindEvents()
        {
            // Mind Maze Controller events
            if (mindMazeController != null)
            {
                MindMazeController.OnEthicalChoiceMade -= OnEthicalChoiceMade;
                MindMazeController.OnMazeTransformation -= OnMazeTransformation;
                MindMazeController.OnFloorCompleted -= OnFloorCompletedHandler;
                MindMazeController.OnFrameworkMastered -= OnFrameworkMastered;
            }
            
            // Geometry Transformation events
            GeometryTransformationSystem.OnTransformationStarted -= OnTransformationStarted;
            GeometryTransformationSystem.OnTransformationCompleted -= OnTransformationCompleted;
        }
        
        private void InitializeComponents()
        {
            // Initialize Mind Maze Controller
            if (mindMazeController != null && researchGameManager != null)
            {
                mindMazeController.Initialize(researchGameManager);
            }
            
            // Setup initial profile
            currentProfile = testProfile ?? new PlayerMoralProfile();
            currentFloor = initialFloorDepth;
        }
        
        public async void StartMindMazeSession()
        {
            if (isGameActive)
            {
                Debug.LogWarning("[MindMazeGameScene] Game session already active");
                return;
            }
            
            try
            {
                Debug.Log("[MindMazeGameScene] Starting Mind Maze session");
                isGameActive = true;
                
                // Update UI
                UpdateFloorDisplay();
                UpdateProgressDisplay();
                
                // Generate first maze
                if (mindMazeController != null)
                {
                    await mindMazeController.GenerateEthicalMaze(currentFloor, currentProfile);
                }
                
                OnFloorStarted?.Invoke(currentFloor);
                
                Debug.Log($"[MindMazeGameScene] Mind Maze session started on floor {currentFloor}");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[MindMazeGameScene] Failed to start Mind Maze session: {ex.Message}");
                isGameActive = false;
            }
        }
        
        public async void AdvanceToNextFloor()
        {
            if (!isGameActive)
                return;
                
            currentFloor++;
            
            try
            {
                Debug.Log($"[MindMazeGameScene] Advancing to floor {currentFloor}");
                
                // Update UI
                UpdateFloorDisplay();
                
                // Generate new maze
                if (mindMazeController != null)
                {
                    await mindMazeController.GenerateEthicalMaze(currentFloor, currentProfile);
                }
                
                OnFloorStarted?.Invoke(currentFloor);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[MindMazeGameScene] Failed to advance to floor {currentFloor}: {ex.Message}");
            }
        }
        
        public void EndMindMazeSession()
        {
            if (!isGameActive)
                return;
                
            Debug.Log("[MindMazeGameScene] Ending Mind Maze session");
            
            isGameActive = false;
            
            // Complete current session
            if (mindMazeController != null)
            {
                _ = mindMazeController.CompleteCurrentFloor();
            }
            
            OnGameSessionEnded?.Invoke();
            
            // Return to main menu or previous scene
            ReturnToMainMenu();
        }
        
        private void UpdateFloorDisplay()
        {
            if (floorLabel != null)
            {
                floorLabel.text = $"Floor {currentFloor}";
            }
        }
        
        private void UpdateProgressDisplay()
        {
            if (currentProfile == null)
                return;
                
            // Update ethical framework display
            if (ethicalFrameworkLabel != null)
            {
                var masteredCount = currentProfile.masteredFrameworks?.Count ?? 0;
                ethicalFrameworkLabel.text = $"Mastered Frameworks: {masteredCount}/4";
            }
            
            // Update consistency bar
            if (consistencyBar != null)
            {
                consistencyBar.value = currentProfile.ethicalConsistency * 100f;
                consistencyBar.title = $"Ethical Consistency: {currentProfile.ethicalConsistency:P0}";
            }
        }
        
        private void ShowEthicalChoiceDialog(EthicalChoice choice, AlignmentScenario scenario)
        {
            if (ethicalChoiceContainer == null || ethicalChoiceDialog == null)
                return;
                
            // Clear previous choice UI
            ethicalChoiceContainer.Clear();
            
            // Create choice dialog
            var choiceDialog = ethicalChoiceDialog.CloneTree();
            ethicalChoiceContainer.Add(choiceDialog);
            
            // Setup choice dialog content
            var scenarioLabel = choiceDialog.Q<Label>("scenario-text");
            if (scenarioLabel != null)
            {
                scenarioLabel.text = scenario.situation;
            }
            
            // Setup option buttons
            var optionsContainer = choiceDialog.Q<VisualElement>("options-container");
            if (optionsContainer != null && scenario.options != null)
            {
                foreach (var option in scenario.options)
                {
                    var optionButton = new Button(() => OnOptionSelected(option.optionId))
                    {
                        text = option.action + "\n" + option.description
                    };
                    optionButton.AddToClassList("ethical-option-button");
                    optionsContainer.Add(optionButton);
                }
            }
            
            // Show the dialog
            ethicalChoiceContainer.style.display = DisplayStyle.Flex;
        }
        
        private void HideEthicalChoiceDialog()
        {
            if (ethicalChoiceContainer != null)
            {
                ethicalChoiceContainer.style.display = DisplayStyle.None;
            }
        }
        
        private void OnOptionSelected(string optionId)
        {
            Debug.Log($"[MindMazeGameScene] Player selected option: {optionId}");
            
            // Create ethical choice and submit to controller
            var choice = new EthicalChoice
            {
                scenarioIndex = 0, // This would be determined by current scenario
                selectedOptionId = optionId,
                confidence = 0.8f, // This could be gathered from UI
                reasoning = "Player choice through UI", // This could be gathered from text input
                timestamp = DateTime.UtcNow
            };
            
            // Submit choice
            if (mindMazeController != null)
            {
                _ = mindMazeController.HandleEthicalChoice(choice);
            }
            
            // Hide dialog
            HideEthicalChoiceDialog();
        }
        
        private void ReturnToMainMenu()
        {
            // Load main menu scene
            if (gameManager != null)
            {
                // This would use the existing scene management system
                UnityEngine.SceneManagement.SceneManager.LoadScene("MainMenu");
            }
        }
        
        // Event Handlers
        private void OnEthicalChoiceMade(EthicalChoice choice, EthicalFramework framework)
        {
            Debug.Log($"[MindMazeGameScene] Ethical choice made: {choice.selectedOptionId} using {framework}");
            
            // Update current profile if available
            if (mindMazeController != null)
            {
                currentProfile = mindMazeController.GetPlayerProfile();
                UpdateProgressDisplay();
            }
        }
        
        private void OnMazeTransformation(MazeTransformation transformation)
        {
            Debug.Log($"[MindMazeGameScene] Maze transformation started: {transformation.framework}");
            
            // Could show transformation feedback in UI
            ShowTransformationFeedback(transformation);
        }
        
        private void OnFloorCompletedHandler(int floorDepth, PlayerMoralProfile profile)
        {
            Debug.Log($"[MindMazeGameScene] Floor {floorDepth} completed");
            
            currentProfile = profile;
            UpdateProgressDisplay();
            
            // Show next floor button
            if (nextFloorButton != null)
            {
                nextFloorButton.style.display = DisplayStyle.Flex;
            }
            
            OnFloorCompleted?.Invoke(floorDepth, profile.ethicalConsistency);
        }
        
        private void OnFrameworkMastered(EthicalFramework framework)
        {
            Debug.Log($"[MindMazeGameScene] Framework mastered: {framework}");
            
            // Show mastery celebration
            ShowFrameworkMasteryFeedback(framework);
        }
        
        private void OnTransformationStarted(MazeTransformation transformation)
        {
            Debug.Log($"[MindMazeGameScene] Transformation started: {transformation.id}");
        }
        
        private void OnTransformationCompleted(MazeTransformation transformation)
        {
            Debug.Log($"[MindMazeGameScene] Transformation completed: {transformation.id}");
        }
        
        private void OnNextFloorClicked()
        {
            if (nextFloorButton != null)
            {
                nextFloorButton.style.display = DisplayStyle.None;
            }
            
            AdvanceToNextFloor();
        }
        
        private void OnExitClicked()
        {
            EndMindMazeSession();
        }
        
        // UI Feedback Methods
        private void ShowTransformationFeedback(MazeTransformation transformation)
        {
            // Show brief UI feedback about the transformation
            var feedbackLabel = rootElement?.Q<Label>("transformation-feedback");
            if (feedbackLabel != null)
            {
                feedbackLabel.text = $"Maze transformed through {transformation.framework} ethics";
                feedbackLabel.style.display = DisplayStyle.Flex;
                
                // Hide after delay
                _ = HideFeedbackAfterDelay(feedbackLabel, 3.0f);
            }
        }
        
        private void ShowFrameworkMasteryFeedback(EthicalFramework framework)
        {
            // Show celebration for framework mastery
            var masteryLabel = rootElement?.Q<Label>("mastery-feedback");
            if (masteryLabel != null)
            {
                masteryLabel.text = $"🎉 {framework} Ethics Mastered! 🎉";
                masteryLabel.style.display = DisplayStyle.Flex;
                
                // Hide after delay
                _ = HideFeedbackAfterDelay(masteryLabel, 5.0f);
            }
        }
        
        private async System.Threading.Tasks.Task HideFeedbackAfterDelay(VisualElement element, float delay)
        {
            await System.Threading.Tasks.Task.Delay((int)(delay * 1000));
            if (element != null)
            {
                element.style.display = DisplayStyle.None;
            }
        }
        
        private void OnDestroy()
        {
            UnbindEvents();
        }
        
        // Public API for external systems
        public bool IsGameActive => isGameActive;
        public int CurrentFloor => currentFloor;
        public PlayerMoralProfile CurrentProfile => currentProfile;
        public MindMazeController MazeController => mindMazeController;
    }
}