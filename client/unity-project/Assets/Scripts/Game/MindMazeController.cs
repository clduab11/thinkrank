using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;
using ThinkRank.Core;

namespace ThinkRank.Game
{
    /// <summary>
    /// Controller for Mind Maze ethical reasoning game mechanics
    /// Extends AlignmentController with procedural maze generation and dynamic geometry transformation
    /// </summary>
    public class MindMazeController : AlignmentController
    {
        [Header("Mind Maze Specific")]
        [SerializeField] private MazeGenerator mazeGenerator;
        [SerializeField] private EthicalDecisionEngine decisionEngine;
        [SerializeField] private GeometryTransformationSystem transformSystem;
        [SerializeField] private MoralCompassSystem compassSystem;
        [SerializeField] private MazeNavigationController navigationController;
        
        [Header("Maze Configuration")]
        [SerializeField] private int currentFloorDepth = 1;
        [SerializeField] private float transformationDuration = 2.0f;
        [SerializeField] private EthicalFramework currentFramework = EthicalFramework.Utilitarian;
        
        // Mind Maze specific state
        private MazeData currentMazeData;
        private PlayerMoralProfile playerProfile;
        private List<EthicalChoice> sessionChoices;
        private bool isTransforming = false;
        
        // Events
        public static event Action<EthicalChoice, EthicalFramework> OnEthicalChoiceMade;
        public static event Action<MazeTransformation> OnMazeTransformation;
        public static event Action<int, PlayerMoralProfile> OnFloorCompleted;
        public static event Action<EthicalFramework> OnFrameworkMastered;
        
        public override void Initialize(ResearchGameManager manager)
        {
            base.Initialize(manager);
            
            playerProfile = new PlayerMoralProfile();
            sessionChoices = new List<EthicalChoice>();
            
            // Initialize Mind Maze specific systems
            if (mazeGenerator != null)
                mazeGenerator.Initialize();
            
            if (decisionEngine != null)
                decisionEngine.Initialize();
                
            if (transformSystem != null)
                transformSystem.Initialize();
                
            if (compassSystem != null)
                compassSystem.Initialize(playerProfile);
                
            if (navigationController != null)
                navigationController.Initialize(this);
        }
        
        public async System.Threading.Tasks.Task GenerateEthicalMaze(int floorDepth, PlayerMoralProfile profile)
        {
            Debug.Log($"[MindMazeController] Generating ethical maze for floor {floorDepth}");
            
            currentFloorDepth = floorDepth;
            playerProfile = profile ?? new PlayerMoralProfile();
            
            try
            {
                // Generate maze based on player's moral reasoning patterns
                currentMazeData = await mazeGenerator.CreateMaze(floorDepth, playerProfile);
                
                // Populate with ethical scenarios appropriate to player level
                var scenarios = await GenerateEthicalScenarios(floorDepth, playerProfile);
                await PopulateMazeWithScenarios(currentMazeData, scenarios);
                
                // Initialize transformation system for dynamic geometry
                if (transformSystem != null)
                {
                    transformSystem.InitializeMaze(currentMazeData);
                }
                
                // Setup navigation controller
                if (navigationController != null)
                {
                    await navigationController.SetupMazeNavigation(currentMazeData);
                }
                
                Debug.Log($"[MindMazeController] Maze generation completed successfully");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[MindMazeController] Failed to generate ethical maze: {ex.Message}");
                throw;
            }
        }
        
        public async System.Threading.Tasks.Task<List<AlignmentScenario>> GenerateEthicalScenarios(int floorDepth, PlayerMoralProfile profile)
        {
            var scenarios = new List<AlignmentScenario>();
            
            // Determine number of scenarios based on floor depth
            int scenarioCount = Mathf.Clamp(3 + floorDepth, 3, 8);
            
            for (int i = 0; i < scenarioCount; i++)
            {
                var scenario = await CreateContextualEthicalScenario(floorDepth, profile, i);
                scenarios.Add(scenario);
            }
            
            return scenarios;
        }
        
        private async System.Threading.Tasks.Task<AlignmentScenario> CreateContextualEthicalScenario(int floorDepth, PlayerMoralProfile profile, int scenarioIndex)
        {
            // Create scenarios that build on each other and test ethical consistency
            var scenario = new AlignmentScenario
            {
                scenarioId = $"maze_floor_{floorDepth}_scenario_{scenarioIndex}",
                situation = GenerateScenarioSituation(floorDepth, profile, scenarioIndex),
                options = GenerateEthicalOptions(floorDepth, profile),
                valueConflicts = GenerateValueConflicts(floorDepth),
                ethicalFramework = DetermineScenarioFramework(profile, scenarioIndex)
            };
            
            return scenario;
        }
        
        private string GenerateScenarioSituation(int floorDepth, PlayerMoralProfile profile, int scenarioIndex)
        {
            // AI-specific ethical scenarios that increase in complexity
            var situations = new List<string>
            {
                "An AI hiring system shows higher accuracy when using demographic data, but this may perpetuate historical biases. The company needs to decide on implementation.",
                "A healthcare AI can save more lives by prioritizing certain patient demographics, but this conflicts with principles of equal treatment. How should it be configured?",
                "An autonomous vehicle's decision algorithm must choose between protecting passengers versus pedestrians in unavoidable accident scenarios. What ethical framework should guide this?",
                "A social media AI can reduce harmful content by analyzing private messages, but this violates user privacy. How should the platform balance safety and privacy?",
                "An AI judge recommendation system is more efficient but less transparent than human judges. Should it be implemented in the criminal justice system?"
            };
            
            // Select appropriate scenario based on floor depth and previous choices
            int situationIndex = (scenarioIndex + floorDepth) % situations.Count;
            return situations[situationIndex];
        }
        
        private List<AlignmentOption> GenerateEthicalOptions(int floorDepth, PlayerMoralProfile profile)
        {
            var options = new List<AlignmentOption>();
            
            // Utilitarian option
            options.Add(new AlignmentOption
            {
                optionId = "utilitarian",
                action = "Maximize Overall Benefit",
                description = "Choose the option that produces the greatest good for the greatest number of people, even if some individuals may be disadvantaged.",
                valueAlignment = new ValueAlignment { helpfulness = 5, harmlessness = 3, honesty = 4, fairness = 3, autonomy = 2 },
                consequences = new List<string> { "Higher overall utility", "Potential individual harm", "Quantifiable outcomes" }
            });
            
            // Deontological option
            options.Add(new AlignmentOption
            {
                optionId = "deontological",
                action = "Follow Universal Principles",
                description = "Apply consistent moral rules that could be universally adopted, regardless of specific outcomes.",
                valueAlignment = new ValueAlignment { helpfulness = 3, harmlessness = 5, honesty = 5, fairness = 5, autonomy = 4 },
                consequences = new List<string> { "Consistent moral framework", "May not optimize outcomes", "Respects individual dignity" }
            });
            
            // Virtue ethics option (unlocked at higher floors)
            if (floorDepth > 2)
            {
                options.Add(new AlignmentOption
                {
                    optionId = "virtue_ethics",
                    action = "Cultivate Virtuous Character",
                    description = "Focus on developing and expressing virtuous character traits in AI systems and their deployment.",
                    valueAlignment = new ValueAlignment { helpfulness = 4, harmlessness = 4, honesty = 5, fairness = 4, autonomy = 5 },
                    consequences = new List<string> { "Character-based decision making", "Context-sensitive responses", "Long-term wisdom development" }
                });
            }
            
            return options;
        }
        
        private List<string> GenerateValueConflicts(int floorDepth)
        {
            var conflicts = new List<string>
            {
                "Individual Privacy vs. Collective Safety",
                "Efficiency vs. Fairness",
                "Transparency vs. Effectiveness",
                "Innovation vs. Precaution",
                "Autonomy vs. Beneficence"
            };
            
            // Return appropriate number of conflicts based on complexity
            int conflictCount = Mathf.Min(2 + floorDepth / 2, conflicts.Count);
            return conflicts.GetRange(0, conflictCount);
        }
        
        private string DetermineScenarioFramework(PlayerMoralProfile profile, int scenarioIndex)
        {
            // Rotate through frameworks to ensure exposure to different approaches
            var frameworks = new[] { "Utilitarian", "Deontological", "Virtue Ethics", "Care Ethics" };
            return frameworks[scenarioIndex % frameworks.Length];
        }
        
        private async System.Threading.Tasks.Task PopulateMazeWithScenarios(MazeData mazeData, List<AlignmentScenario> scenarios)
        {
            if (mazeData?.decisionPoints == null || scenarios == null)
                return;
                
            for (int i = 0; i < Mathf.Min(mazeData.decisionPoints.Count, scenarios.Count); i++)
            {
                var decisionPoint = mazeData.decisionPoints[i];
                var scenario = scenarios[i];
                
                decisionPoint.ethicalScenario = scenario;
                decisionPoint.position = mazeData.geometry.GetDecisionPointPosition(i);
                decisionPoint.requiredFramework = DetermineRequiredFramework(scenario);
            }
        }
        
        private EthicalFramework DetermineRequiredFramework(AlignmentScenario scenario)
        {
            // Determine which ethical framework this scenario is designed to teach
            if (scenario.ethicalFramework.Contains("Utilitarian"))
                return EthicalFramework.Utilitarian;
            else if (scenario.ethicalFramework.Contains("Deontological"))
                return EthicalFramework.Deontological;
            else if (scenario.ethicalFramework.Contains("Virtue"))
                return EthicalFramework.VirtueEthics;
            else
                return EthicalFramework.CareEthics;
        }
        
        public async System.Threading.Tasks.Task HandleEthicalChoice(EthicalChoice choice)
        {
            if (isTransforming)
            {
                Debug.LogWarning("[MindMazeController] Cannot process choice during maze transformation");
                return;
            }
            
            isTransforming = true;
            
            try
            {
                // Process choice through existing alignment system
                await base.ProcessEthicalChoice(choice);
                
                // Add to session choices for pattern analysis
                sessionChoices.Add(choice);
                
                // Calculate maze transformation based on choice
                var transformation = await decisionEngine.CalculateTransformation(choice, currentMazeData);
                
                // Apply transformation to maze geometry
                if (transformSystem != null)
                {
                    await transformSystem.ApplyTransformation(transformation);
                }
                
                // Update moral compass and player profile
                if (compassSystem != null)
                {
                    compassSystem.UpdateProfile(choice, currentScenarios[choice.scenarioIndex]);
                }
                
                // Check for framework mastery
                CheckFrameworkMastery(choice);
                
                // Trigger events
                OnEthicalChoiceMade?.Invoke(choice, currentFramework);
                OnMazeTransformation?.Invoke(transformation);
                
                Debug.Log($"[MindMazeController] Processed ethical choice: {choice.selectedOptionId}");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[MindMazeController] Failed to handle ethical choice: {ex.Message}");
            }
            finally
            {
                isTransforming = false;
            }
        }
        
        private async System.Threading.Tasks.Task ProcessEthicalChoice(EthicalChoice choice)
        {
            // Find the corresponding alignment scenario and option
            if (choice.scenarioIndex >= 0 && choice.scenarioIndex < currentScenarios.Count)
            {
                var scenario = currentScenarios[choice.scenarioIndex];
                var selectedOption = scenario.options.Find(opt => opt.optionId == choice.selectedOptionId);
                
                if (selectedOption != null)
                {
                    // Update current solution with the choice
                    if (currentSolution?.answers != null)
                    {
                        var answer = new PlayerAnswer
                        {
                            questionId = scenario.scenarioId,
                            selectedOption = choice.selectedOptionId,
                            rating = CalculateChoiceRating(selectedOption),
                            confidence = choice.confidence,
                            reasoning = choice.reasoning
                        };
                        
                        currentSolution.answers.Add(answer);
                    }
                    
                    // Trigger alignment events
                    OnValueAlignmentCompleted?.Invoke(scenario.scenarioId, ConvertValueAlignment(selectedOption.valueAlignment));
                }
            }
        }
        
        private Dictionary<string, int> ConvertValueAlignment(ValueAlignment alignment)
        {
            return new Dictionary<string, int>
            {
                ["helpfulness"] = alignment.helpfulness,
                ["harmlessness"] = alignment.harmlessness,
                ["honesty"] = alignment.honesty,
                ["fairness"] = alignment.fairness,
                ["autonomy"] = alignment.autonomy
            };
        }
        
        private int CalculateChoiceRating(AlignmentOption option)
        {
            // Calculate rating based on value alignment strength
            var alignment = option.valueAlignment;
            return (alignment.helpfulness + alignment.harmlessness + alignment.honesty + alignment.fairness + alignment.autonomy) / 5;
        }
        
        private void CheckFrameworkMastery(EthicalChoice choice)
        {
            var framework = DetermineChoiceFramework(choice);
            if (HasMasteredFramework(framework))
            {
                OnFrameworkMastered?.Invoke(framework);
            }
        }
        
        private EthicalFramework DetermineChoiceFramework(EthicalChoice choice)
        {
            // Analyze choice pattern to determine which framework was applied
            if (choice.selectedOptionId.Contains("utilitarian"))
                return EthicalFramework.Utilitarian;
            else if (choice.selectedOptionId.Contains("deontological"))
                return EthicalFramework.Deontological;
            else if (choice.selectedOptionId.Contains("virtue"))
                return EthicalFramework.VirtueEthics;
            else
                return EthicalFramework.CareEthics;
        }
        
        private bool HasMasteredFramework(EthicalFramework framework)
        {
            // Check if player has consistently applied this framework
            var frameworkChoices = sessionChoices.FindAll(c => DetermineChoiceFramework(c) == framework);
            return frameworkChoices.Count >= 3 && CalculateConsistencyScore(frameworkChoices) > 0.8f;
        }
        
        private float CalculateConsistencyScore(List<EthicalChoice> choices)
        {
            if (choices.Count < 2) return 0f;
            
            // Calculate consistency in ethical reasoning patterns
            float consistencySum = 0f;
            for (int i = 1; i < choices.Count; i++)
            {
                // Simple consistency metric - in practice this would be more sophisticated
                consistencySum += choices[i].confidence > 0.7f ? 1f : 0.5f;
            }
            
            return consistencySum / (choices.Count - 1);
        }
        
        public async System.Threading.Tasks.Task CompleteCurrentFloor()
        {
            Debug.Log($"[MindMazeController] Completing floor {currentFloorDepth}");
            
            // Calculate final floor performance
            var floorPerformance = CalculateFloorPerformance();
            
            // Update player profile based on session choices
            UpdatePlayerProfile(floorPerformance);
            
            // Trigger floor completion event
            OnFloorCompleted?.Invoke(currentFloorDepth, playerProfile);
            
            // Prepare for next floor or end session
            if (ShouldAdvanceToNextFloor(floorPerformance))
            {
                await GenerateEthicalMaze(currentFloorDepth + 1, playerProfile);
            }
            else
            {
                await EndMazeSession();
            }
        }
        
        private FloorPerformance CalculateFloorPerformance()
        {
            return new FloorPerformance
            {
                choicesMade = sessionChoices.Count,
                averageConfidence = CalculateAverageConfidence(),
                ethicalConsistency = CalculateEthicalConsistency(),
                frameworksUsed = GetFrameworksUsed(),
                completionTime = Time.time - sessionStartTime
            };
        }
        
        private float CalculateAverageConfidence()
        {
            if (sessionChoices.Count == 0) return 0f;
            return sessionChoices.Average(c => c.confidence);
        }
        
        private float CalculateEthicalConsistency()
        {
            // Measure consistency in ethical reasoning across choices
            var frameworks = sessionChoices.Select(c => DetermineChoiceFramework(c)).ToList();
            var uniqueFrameworks = frameworks.Distinct().Count();
            
            // Higher consistency for fewer framework switches
            return uniqueFrameworks <= 2 ? 1.0f : 1.0f / uniqueFrameworks;
        }
        
        private List<EthicalFramework> GetFrameworksUsed()
        {
            return sessionChoices.Select(c => DetermineChoiceFramework(c)).Distinct().ToList();
        }
        
        private void UpdatePlayerProfile(FloorPerformance performance)
        {
            playerProfile.ethicalConsistency = performance.ethicalConsistency;
            playerProfile.averageConfidence = performance.averageConfidence;
            playerProfile.completedFloors++;
            playerProfile.masteredFrameworks.AddRange(performance.frameworksUsed.Where(f => !playerProfile.masteredFrameworks.Contains(f)));
        }
        
        private bool ShouldAdvanceToNextFloor(FloorPerformance performance)
        {
            // Advance if player shows good understanding and consistency
            return performance.ethicalConsistency > 0.6f && performance.averageConfidence > 0.5f;
        }
        
        private async System.Threading.Tasks.Task EndMazeSession()
        {
            Debug.Log("[MindMazeController] Ending maze session");
            
            // Submit research data
            if (gameManager != null)
            {
                await SubmitMazeResearchData();
            }
            
            // Reset session state
            sessionChoices.Clear();
            currentFloorDepth = 1;
        }
        
        private async System.Threading.Tasks.Task SubmitMazeResearchData()
        {
            // Package ethical reasoning data for research contribution
            var researchData = new MazeResearchContribution
            {
                playerId = "anonymous_" + System.Guid.NewGuid().ToString("N")[..8],
                sessionChoices = sessionChoices.ToArray(),
                playerProfile = playerProfile,
                sessionPerformance = CalculateFloorPerformance()
            };
            
            // Submit through existing research systems
            // This would integrate with the existing research API
            Debug.Log($"[MindMazeController] Submitted research data with {sessionChoices.Count} ethical choices");
        }
        
        // Getters for other systems
        public MazeData GetCurrentMazeData() => currentMazeData;
        public PlayerMoralProfile GetPlayerProfile() => playerProfile;
        public List<EthicalChoice> GetSessionChoices() => new List<EthicalChoice>(sessionChoices);
        public bool IsTransforming() => isTransforming;
        
        private float sessionStartTime;
        private List<AlignmentScenario> currentScenarios;
        private PlayerSolution currentSolution;
        
        protected override void Start()
        {
            base.Start();
            sessionStartTime = Time.time;
        }
    }
    
    // Supporting data structures
    [System.Serializable]
    public class EthicalChoice
    {
        public int scenarioIndex;
        public string selectedOptionId;
        public float confidence;
        public string reasoning;
        public DateTime timestamp;
    }
    
    [System.Serializable]
    public class PlayerMoralProfile
    {
        public float ethicalConsistency = 0.5f;
        public float averageConfidence = 0.5f;
        public int completedFloors = 0;
        public List<EthicalFramework> masteredFrameworks = new List<EthicalFramework>();
        public Dictionary<string, float> frameworkProficiency = new Dictionary<string, float>();
    }
    
    [System.Serializable]
    public class FloorPerformance
    {
        public int choicesMade;
        public float averageConfidence;
        public float ethicalConsistency;
        public List<EthicalFramework> frameworksUsed;
        public float completionTime;
    }
    
    [System.Serializable]
    public class MazeResearchContribution
    {
        public string playerId;
        public EthicalChoice[] sessionChoices;
        public PlayerMoralProfile playerProfile;
        public FloorPerformance sessionPerformance;
    }
    
    public enum EthicalFramework
    {
        Utilitarian,
        Deontological,
        VirtueEthics,
        CareEthics
    }
}