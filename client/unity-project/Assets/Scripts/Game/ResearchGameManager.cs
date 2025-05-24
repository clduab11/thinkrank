using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;
using ThinkRank.Core;
using ThinkRank.Data;
using ThinkRank.API;

namespace ThinkRank.Game
{
    /// <summary>
    /// Manages research problem gameplay mechanics
    /// </summary>
    public class ResearchGameManager : MonoBehaviour
    {
        [Header("Game Configuration")]
        [SerializeField] private float defaultTimeLimit = 120f;
        [SerializeField] private int maxHintsPerProblem = 3;
        [SerializeField] private float confidenceUpdateRate = 0.1f;

        [Header("UI References")]
        [SerializeField] private VisualElement problemContainer;
        [SerializeField] private VisualElement solutionContainer;
        [SerializeField] private VisualElement progressContainer;

        // Game State
        private ResearchProblemData currentProblem;
        private PlayerSolution currentSolution;
        private GameSession currentSession;
        private float startTime;
        private float remainingTime;
        private int hintsUsed;
        private bool isGameActive;

        // Game Mechanics Controllers
        private BiasDetectionController biasController;
        private AlignmentController alignmentController;
        private ContextEvaluationController contextController;

        // Events
        public static event Action<ResearchProblemData> OnProblemLoaded;
        public static event Action<PlayerSolution> OnSolutionSubmitted;
        public static event Action<GameSession> OnSessionCompleted;
        public static event Action<float> OnConfidenceChanged;
        public static event Action<string> OnHintRequested;

        private void Awake()
        {
            InitializeControllers();
        }

        private void Start()
        {
            BindEvents();
        }

        private void Update()
        {
            if (isGameActive && remainingTime > 0)
            {
                remainingTime -= Time.deltaTime;
                UpdateTimerDisplay();

                if (remainingTime <= 0)
                {
                    TimeExpired();
                }
            }
        }

        private void OnDestroy()
        {
            UnbindEvents();
        }

        #region Initialization

        private void InitializeControllers()
        {
            biasController = gameObject.AddComponent<BiasDetectionController>();
            alignmentController = gameObject.AddComponent<AlignmentController>();
            contextController = gameObject.AddComponent<ContextEvaluationController>();

            biasController.Initialize(this);
            alignmentController.Initialize(this);
            contextController.Initialize(this);
        }

        private void BindEvents()
        {
            BiasDetectionController.OnAnswerSelected += OnAnswerSelected;
            AlignmentController.OnRatingChanged += OnRatingChanged;
            ContextEvaluationController.OnClassificationMade += OnClassificationMade;
        }

        private void UnbindEvents()
        {
            BiasDetectionController.OnAnswerSelected -= OnAnswerSelected;
            AlignmentController.OnRatingChanged -= OnRatingChanged;
            ContextEvaluationController.OnClassificationMade -= OnClassificationMade;
        }

        #endregion

        #region Public Methods

        /// <summary>
        /// Load and start a research problem
        /// </summary>
        public async void LoadProblem(ResearchProblemData problemData)
        {
            try
            {
                currentProblem = problemData;
                currentSolution = new PlayerSolution
                {
                    problemId = problemData.problemId,
                    answers = new List<PlayerAnswer>(),
                    confidence = 0.5f,
                    submittedAt = DateTime.UtcNow
                };

                // Initialize game session
                currentSession = new GameSession
                {
                    problemId = problemData.problemId,
                    startTime = DateTime.UtcNow,
                    gameType = problemData.gameType
                };

                // Setup UI and game mechanics
                await SetupProblemUI();
                StartGameTimer();

                OnProblemLoaded?.Invoke(currentProblem);

                Debug.Log($"[ResearchGameManager] Loaded problem: {problemData.title}");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[ResearchGameManager] Error loading problem: {ex.Message}");
                GameManager.Instance?.UIManager?.ShowError("Failed to load research problem");
            }
        }

        /// <summary>
        /// Submit the current solution
        /// </summary>
        public async void SubmitSolution()
        {
            if (!isGameActive || currentSolution == null)
            {
                Debug.LogWarning("[ResearchGameManager] Cannot submit solution - game not active");
                return;
            }

            try
            {
                isGameActive = false;
                currentSolution.timeSpent = Time.time - startTime;
                currentSolution.submittedAt = DateTime.UtcNow;

                // Calculate final confidence based on answers
                UpdateSolutionConfidence();

                // Submit to backend
                await SubmitToBackend();

                // Calculate score
                int score = CalculateScore();

                // Update session data
                currentSession.endTime = DateTime.UtcNow;
                currentSession.score = score;
                currentSession.completed = true;

                OnSolutionSubmitted?.Invoke(currentSolution);
                OnSessionCompleted?.Invoke(currentSession);

                Debug.Log($"[ResearchGameManager] Solution submitted - Score: {score}");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[ResearchGameManager] Error submitting solution: {ex.Message}");
                GameManager.Instance?.UIManager?.ShowError("Failed to submit solution");
            }
        }

        /// <summary>
        /// Request a hint for the current problem
        /// </summary>
        public void RequestHint()
        {
            if (hintsUsed >= maxHintsPerProblem)
            {
                Debug.LogWarning("[ResearchGameManager] No more hints available");
                return;
            }

            string hint = GenerateHint();
            hintsUsed++;

            OnHintRequested?.Invoke(hint);
            Debug.Log($"[ResearchGameManager] Hint provided ({hintsUsed}/{maxHintsPerProblem})");
        }

        /// <summary>
        /// Skip the current problem (if allowed)
        /// </summary>
        public void SkipProblem()
        {
            if (!currentProblem.skipAllowed)
            {
                Debug.LogWarning("[ResearchGameManager] Skip not allowed for this problem");
                return;
            }

            // Record as skipped
            currentSession.skipped = true;
            currentSession.endTime = DateTime.UtcNow;

            OnSessionCompleted?.Invoke(currentSession);
            Debug.Log("[ResearchGameManager] Problem skipped");
        }

        #endregion

        #region Game Mechanics

        private async System.Threading.Tasks.Task SetupProblemUI()
        {
            if (problemContainer == null) return;

            // Clear previous content
            problemContainer.Clear();

            // Setup based on problem type
            switch (currentProblem.problemType)
            {
                case ProblemType.BiasDetection:
                    await biasController.SetupUI(problemContainer, currentProblem);
                    break;
                case ProblemType.Alignment:
                    await alignmentController.SetupUI(problemContainer, currentProblem);
                    break;
                case ProblemType.ContextEvaluation:
                    await contextController.SetupUI(problemContainer, currentProblem);
                    break;
            }

            SetupProgressIndicators();
        }

        private void SetupProgressIndicators()
        {
            if (progressContainer == null) return;

            progressContainer.Clear();

            // Add progress elements
            var progressBar = new ProgressBar
            {
                title = "Progress",
                value = 0f
            };
            progressContainer.Add(progressBar);

            var confidenceSlider = new Slider("Confidence", 0f, 1f)
            {
                value = currentSolution.confidence
            };
            confidenceSlider.RegisterValueChangedCallback(evt =>
            {
                currentSolution.confidence = evt.newValue;
                OnConfidenceChanged?.Invoke(evt.newValue);
            });
            progressContainer.Add(confidenceSlider);
        }

        private void StartGameTimer()
        {
            startTime = Time.time;
            remainingTime = currentProblem.timeLimit;
            isGameActive = true;
        }

        private void UpdateTimerDisplay()
        {
            // Timer UI updates would be handled by GameScreen
            // This could trigger events for UI updates
        }

        private void TimeExpired()
        {
            isGameActive = false;
            Debug.Log("[ResearchGameManager] Time expired");

            // Auto-submit current solution
            SubmitSolution();
        }

        #endregion

        #region Event Handlers

        private void OnAnswerSelected(string questionId, string answerId, float confidence)
        {
            var answer = new PlayerAnswer
            {
                questionId = questionId,
                selectedOption = answerId,
                confidence = confidence,
                reasoning = GetAnswerReasoning(questionId)
            };

            AddOrUpdateAnswer(answer);
            UpdateProgress();
        }

        private void OnRatingChanged(string questionId, int rating, float confidence)
        {
            var answer = new PlayerAnswer
            {
                questionId = questionId,
                rating = rating,
                confidence = confidence,
                reasoning = GetAnswerReasoning(questionId)
            };

            AddOrUpdateAnswer(answer);
            UpdateProgress();
        }

        private void OnClassificationMade(string questionId, string classification, float confidence)
        {
            var answer = new PlayerAnswer
            {
                questionId = questionId,
                classification = classification,
                confidence = confidence,
                reasoning = GetAnswerReasoning(questionId)
            };

            AddOrUpdateAnswer(answer);
            UpdateProgress();
        }

        #endregion

        #region Helper Methods

        private void AddOrUpdateAnswer(PlayerAnswer answer)
        {
            var existingAnswer = currentSolution.answers.Find(a => a.questionId == answer.questionId);
            if (existingAnswer != null)
            {
                currentSolution.answers.Remove(existingAnswer);
            }

            currentSolution.answers.Add(answer);
        }

        private void UpdateProgress()
        {
            int totalQuestions = GetTotalQuestions();
            int answeredQuestions = currentSolution.answers.Count;

            float progress = totalQuestions > 0 ? (float)answeredQuestions / totalQuestions : 0f;

            // Update progress UI
            var progressBar = progressContainer?.Q<ProgressBar>();
            if (progressBar != null)
            {
                progressBar.value = progress;
            }
        }

        private int GetTotalQuestions()
        {
            switch (currentProblem.problemType)
            {
                case ProblemType.BiasDetection:
                    return currentProblem.biasScenarios?.Count ?? 0;
                case ProblemType.Alignment:
                    return currentProblem.alignmentScenarios?.Count ?? 0;
                case ProblemType.ContextEvaluation:
                    return currentProblem.contextScenarios?.Count ?? 0;
                default:
                    return 0;
            }
        }

        private string GetAnswerReasoning(string questionId)
        {
            // This would get reasoning from UI input fields
            // For now, return empty string
            return "";
        }

        private void UpdateSolutionConfidence()
        {
            if (currentSolution.answers.Count == 0) return;

            float totalConfidence = 0f;
            foreach (var answer in currentSolution.answers)
            {
                totalConfidence += answer.confidence;
            }

            currentSolution.confidence = totalConfidence / currentSolution.answers.Count;
        }

        private async System.Threading.Tasks.Task SubmitToBackend()
        {
            try
            {
                var apiManager = GameManager.Instance?.APIManager;
                if (apiManager != null)
                {
                    await apiManager.SubmitResearchContribution(currentSolution);
                }
            }
            catch (Exception ex)
            {
                Debug.LogError($"[ResearchGameManager] Backend submission failed: {ex.Message}");
                // Continue with local processing even if backend fails
            }
        }

        private int CalculateScore()
        {
            float baseScore = currentProblem.basePoints;
            float difficultyBonus = baseScore * (currentProblem.difficultyLevel - 1) * 0.1f;
            float timeBonus = 0f;

            if (remainingTime > 0)
            {
                float timeRatio = remainingTime / currentProblem.timeLimit;
                timeBonus = baseScore * timeRatio * currentProblem.timeBonus;
            }

            float confidenceBonus = baseScore * currentSolution.confidence * 0.2f;
            float hintPenalty = hintsUsed * (baseScore * 0.05f);

            int finalScore = Mathf.RoundToInt(baseScore + difficultyBonus + timeBonus + confidenceBonus - hintPenalty);
            return Mathf.Max(0, finalScore);
        }

        private string GenerateHint()
        {
            // Generate contextual hints based on problem type and current state
            switch (currentProblem.problemType)
            {
                case ProblemType.BiasDetection:
                    return "Look for patterns in language that might indicate bias in the responses.";
                case ProblemType.Alignment:
                    return "Consider which values are most important in this ethical scenario.";
                case ProblemType.ContextEvaluation:
                    return "Think about how cultural or temporal context might affect the appropriateness of the response.";
                default:
                    return "Take your time to carefully analyze all available information.";
            }
        }

        #endregion

        #region Data Classes

        [System.Serializable]
        public class GameSession
        {
            public string problemId;
            public DateTime startTime;
            public DateTime endTime;
            public GameType gameType;
            public int score;
            public bool completed;
            public bool skipped;
        }

        #endregion
    }
}
