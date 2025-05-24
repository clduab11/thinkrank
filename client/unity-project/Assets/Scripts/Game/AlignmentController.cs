using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;
using ThinkRank.Core;

namespace ThinkRank.Game
{
    /// <summary>
    /// Controller for human-AI alignment evaluation game mechanics
    /// </summary>
    public class AlignmentController : MonoBehaviour
    {
        private ResearchGameManager gameManager;
        private List<AlignmentScenario> scenarios;
        private int currentScenarioIndex;
        private VisualElement currentContainer;
        private Dictionary<string, ValueAlignment> currentRatings;

        // Events
        public static event Action<string, int, float> OnRatingChanged;
        public static event Action<string, Dictionary<string, int>> OnValueAlignmentCompleted;
        public static event Action<int, bool> OnScenarioCompleted;

        public void Initialize(ResearchGameManager manager)
        {
            gameManager = manager;
            currentRatings = new Dictionary<string, ValueAlignment>();
        }

        public async System.Threading.Tasks.Task SetupUI(VisualElement container, ResearchProblemData problemData)
        {
            currentContainer = container;
            scenarios = problemData.alignmentScenarios;
            currentScenarioIndex = 0;

            if (scenarios == null || scenarios.Count == 0)
            {
                Debug.LogError("[AlignmentController] No alignment scenarios available");
                return;
            }

            await SetupGameMechanics(problemData.gameType);
        }

        private async System.Threading.Tasks.Task SetupGameMechanics(GameType gameType)
        {
            switch (gameType)
            {
                case GameType.Ranking:
                    await SetupRankingMechanics();
                    break;
                case GameType.Comparison:
                    await SetupComparisonMechanics();
                    break;
                case GameType.ScenarioBased:
                    await SetupScenarioBasedMechanics();
                    break;
                default:
                    await SetupDefaultMechanics();
                    break;
            }
        }

        #region Ranking Mechanics

        private async System.Threading.Tasks.Task SetupRankingMechanics()
        {
            // Title
            var titleLabel = new Label("AI Alignment - Value Ranking")
            {
                name = "title-label"
            };
            titleLabel.AddToClassList("game-title");
            currentContainer.Add(titleLabel);

            // Instructions
            var instructionsLabel = new Label("Rank the AI responses based on how well they align with human values:")
            {
                name = "instructions-label"
            };
            instructionsLabel.AddToClassList("instructions");
            currentContainer.Add(instructionsLabel);

            await LoadRankingScenario(currentScenarioIndex);
        }

        private async System.Threading.Tasks.Task LoadRankingScenario(int index)
        {
            if (index >= scenarios.Count)
            {
                CompleteAllScenarios();
                return;
            }

            var scenario = scenarios[index];

            // Remove previous content
            var previousScenario = currentContainer.Q("current-scenario");
            previousScenario?.RemoveFromHierarchy();

            // Create scenario container
            var scenarioContainer = new VisualElement
            {
                name = "current-scenario"
            };
            scenarioContainer.AddToClassList("scenario-container");

            // Scenario description
            var situationLabel = new Label(scenario.situation)
            {
                name = "situation-label"
            };
            situationLabel.AddToClassList("situation-text");
            scenarioContainer.Add(situationLabel);

            // Value conflicts info
            if (scenario.valueConflicts != null && scenario.valueConflicts.Count > 0)
            {
                var conflictsLabel = new Label($"Value Conflicts: {string.Join(", ", scenario.valueConflicts)}")
                {
                    name = "conflicts-label"
                };
                conflictsLabel.AddToClassList("conflicts-text");
                scenarioContainer.Add(conflictsLabel);
            }

            // Rankable options
            var rankingContainer = CreateRankingInterface(scenario);
            scenarioContainer.Add(rankingContainer);

            // Value alignment evaluation
            var evaluationContainer = CreateValueEvaluationInterface(scenario);
            scenarioContainer.Add(evaluationContainer);

            currentContainer.Add(scenarioContainer);
        }

        private VisualElement CreateRankingInterface(AlignmentScenario scenario)
        {
            var container = new VisualElement
            {
                name = "ranking-container"
            };
            container.AddToClassList("ranking-container");

            var titleLabel = new Label("Rank these options from best to worst alignment:")
            {
                name = "ranking-title"
            };
            titleLabel.AddToClassList("ranking-title");
            container.Add(titleLabel);

            // Create draggable option cards
            var optionsContainer = new VisualElement
            {
                name = "draggable-options"
            };
            optionsContainer.AddToClassList("draggable-container");

            for (int i = 0; i < scenario.options.Count; i++)
            {
                var option = scenario.options[i];
                var optionCard = CreateDraggableOptionCard(option, i);
                optionsContainer.Add(optionCard);
            }

            container.Add(optionsContainer);

            // Ranking slots
            var slotsContainer = CreateRankingSlots(scenario.options.Count);
            container.Add(slotsContainer);

            return container;
        }

        private VisualElement CreateDraggableOptionCard(AlignmentOption option, int index)
        {
            var card = new VisualElement
            {
                name = $"option-card-{index}"
            };
            card.AddToClassList("draggable-card");

            // Option title
            var titleLabel = new Label($"Option {index + 1}: {option.action}")
            {
                name = "option-title"
            };
            titleLabel.AddToClassList("option-title");
            card.Add(titleLabel);

            // Option description
            var descriptionLabel = new Label(option.description)
            {
                name = "option-description"
            };
            descriptionLabel.AddToClassList("option-description");
            card.Add(descriptionLabel);

            // Value alignment preview
            var valuesContainer = CreateValuePreview(option.valueAlignment);
            card.Add(valuesContainer);

            // Add drag functionality (simplified - would need proper drag/drop implementation)
            var moveUpButton = new Button(() => MoveOptionUp(index))
            {
                text = "Move Up"
            };
            moveUpButton.AddToClassList("move-button");
            card.Add(moveUpButton);

            var moveDownButton = new Button(() => MoveOptionDown(index))
            {
                text = "Move Down"
            };
            moveDownButton.AddToClassList("move-button");
            card.Add(moveDownButton);

            return card;
        }

        private VisualElement CreateRankingSlots(int optionCount)
        {
            var container = new VisualElement
            {
                name = "ranking-slots"
            };
            container.AddToClassList("ranking-slots");

            var titleLabel = new Label("Ranking (1 = Best Alignment):")
            {
                name = "slots-title"
            };
            titleLabel.AddToClassList("slots-title");
            container.Add(titleLabel);

            for (int i = 0; i < optionCount; i++)
            {
                var slot = new VisualElement
                {
                    name = $"rank-slot-{i + 1}"
                };
                slot.AddToClassList("rank-slot");

                var slotLabel = new Label($"Rank {i + 1}")
                {
                    name = "slot-label"
                };
                slotLabel.AddToClassList("slot-label");
                slot.Add(slotLabel);

                var dropZone = new VisualElement
                {
                    name = "drop-zone"
                };
                dropZone.AddToClassList("drop-zone");
                slot.Add(dropZone);

                container.Add(slot);
            }

            return container;
        }

        #endregion

        #region Comparison Mechanics

        private async System.Threading.Tasks.Task SetupComparisonMechanics()
        {
            // Title
            var titleLabel = new Label("AI Alignment - Value Comparison")
            {
                name = "title-label"
            };
            titleLabel.AddToClassList("game-title");
            currentContainer.Add(titleLabel);

            // Instructions
            var instructionsLabel = new Label("Compare these AI responses and evaluate their alignment with human values:")
            {
                name = "instructions-label"
            };
            instructionsLabel.AddToClassList("instructions");
            currentContainer.Add(instructionsLabel);

            await LoadComparisonScenario(currentScenarioIndex);
        }

        private async System.Threading.Tasks.Task LoadComparisonScenario(int index)
        {
            if (index >= scenarios.Count) return;

            var scenario = scenarios[index];

            // Create comparison interface
            var comparisonContainer = new VisualElement
            {
                name = "comparison-container"
            };
            comparisonContainer.AddToClassList("comparison-container");

            // Scenario context
            var contextLabel = new Label(scenario.situation)
            {
                name = "scenario-context"
            };
            contextLabel.AddToClassList("scenario-context");
            comparisonContainer.Add(contextLabel);

            // Side-by-side options
            var optionsContainer = new VisualElement
            {
                name = "options-comparison"
            };
            optionsContainer.AddToClassList("side-by-side");

            for (int i = 0; i < Math.Min(2, scenario.options.Count); i++)
            {
                var option = scenario.options[i];
                var optionCard = CreateComparisonOptionCard(option, i);
                optionsContainer.Add(optionCard);
            }

            comparisonContainer.Add(optionsContainer);

            // Detailed value evaluation
            var evaluationContainer = CreateDetailedValueEvaluation(scenario);
            comparisonContainer.Add(evaluationContainer);

            currentContainer.Add(comparisonContainer);
        }

        private VisualElement CreateComparisonOptionCard(AlignmentOption option, int index)
        {
            var card = new VisualElement
            {
                name = $"comparison-card-{index}"
            };
            card.AddToClassList("comparison-card");

            // Header
            var headerLabel = new Label($"Option {index + 1}")
            {
                name = "card-header"
            };
            headerLabel.AddToClassList("card-header");
            card.Add(headerLabel);

            // Action
            var actionLabel = new Label(option.action)
            {
                name = "card-action"
            };
            actionLabel.AddToClassList("card-action");
            card.Add(actionLabel);

            // Description
            var descriptionLabel = new Label(option.description)
            {
                name = "card-description"
            };
            descriptionLabel.AddToClassList("card-description");
            card.Add(descriptionLabel);

            // Value alignment bars
            var valuesContainer = CreateValueAlignmentBars(option.valueAlignment, $"option-{index}");
            card.Add(valuesContainer);

            // Consequences
            if (option.consequences != null && option.consequences.Count > 0)
            {
                var consequencesContainer = new VisualElement
                {
                    name = "consequences-container"
                };
                consequencesContainer.AddToClassList("consequences-container");

                var consequencesTitle = new Label("Potential Consequences:")
                {
                    name = "consequences-title"
                };
                consequencesTitle.AddToClassList("consequences-title");
                consequencesContainer.Add(consequencesTitle);

                foreach (var consequence in option.consequences)
                {
                    var consequenceLabel = new Label($"• {consequence}")
                    {
                        name = "consequence-item"
                    };
                    consequenceLabel.AddToClassList("consequence-item");
                    consequencesContainer.Add(consequenceLabel);
                }

                card.Add(consequencesContainer);
            }

            // Selection button
            var selectButton = new Button(() => OnOptionSelected(option.optionId, index))
            {
                text = "Select This Option"
            };
            selectButton.AddToClassList("select-option-button");
            card.Add(selectButton);

            return card;
        }

        #endregion

        #region Scenario-Based Mechanics

        private async System.Threading.Tasks.Task SetupScenarioBasedMechanics()
        {
            // Title
            var titleLabel = new Label("AI Alignment - Ethical Scenarios")
            {
                name = "title-label"
            };
            titleLabel.AddToClassList("game-title");
            currentContainer.Add(titleLabel);

            // Instructions
            var instructionsLabel = new Label("Evaluate AI responses in complex ethical scenarios:")
            {
                name = "instructions-label"
            };
            instructionsLabel.AddToClassList("instructions");
            currentContainer.Add(instructionsLabel);

            await LoadScenarioBasedInterface(currentScenarioIndex);
        }

        private async System.Threading.Tasks.Task LoadScenarioBasedInterface(int index)
        {
            if (index >= scenarios.Count) return;

            var scenario = scenarios[index];

            var scenarioContainer = new VisualElement
            {
                name = "scenario-based-container"
            };
            scenarioContainer.AddToClassList("scenario-container");

            // Ethical framework info
            var frameworkLabel = new Label($"Ethical Framework: {scenario.ethicalFramework}")
            {
                name = "framework-label"
            };
            frameworkLabel.AddToClassList("framework-label");
            scenarioContainer.Add(frameworkLabel);

            // Situation description
            var situationContainer = new VisualElement
            {
                name = "situation-container"
            };
            situationContainer.AddToClassList("situation-container");

            var situationTitle = new Label("Scenario:")
            {
                name = "situation-title"
            };
            situationTitle.AddToClassList("section-title");
            situationContainer.Add(situationTitle);

            var situationText = new Label(scenario.situation)
            {
                name = "situation-text"
            };
            situationText.AddToClassList("situation-text");
            situationContainer.Add(situationText);

            scenarioContainer.Add(situationContainer);

            // Options evaluation
            var optionsContainer = new VisualElement
            {
                name = "options-evaluation"
            };
            optionsContainer.AddToClassList("options-evaluation");

            foreach (var option in scenario.options)
            {
                var evaluationCard = CreateScenarioEvaluationCard(option, scenario.scenarioId);
                optionsContainer.Add(evaluationCard);
            }

            scenarioContainer.Add(optionsContainer);

            // Final evaluation section
            var finalEvaluationContainer = CreateFinalEvaluationSection(scenario);
            scenarioContainer.Add(finalEvaluationContainer);

            currentContainer.Add(scenarioContainer);
        }

        private VisualElement CreateScenarioEvaluationCard(AlignmentOption option, string scenarioId)
        {
            var card = new VisualElement
            {
                name = $"eval-card-{option.optionId}"
            };
            card.AddToClassList("evaluation-card");

            // Option header
            var headerContainer = new VisualElement
            {
                name = "eval-header"
            };
            headerContainer.AddToClassList("eval-header");

            var actionLabel = new Label(option.action)
            {
                name = "eval-action"
            };
            actionLabel.AddToClassList("eval-action");
            headerContainer.Add(actionLabel);

            var descriptionLabel = new Label(option.description)
            {
                name = "eval-description"
            };
            descriptionLabel.AddToClassList("eval-description");
            headerContainer.Add(descriptionLabel);

            card.Add(headerContainer);

            // Interactive value rating
            var ratingContainer = CreateInteractiveValueRating(option, scenarioId);
            card.Add(ratingContainer);

            return card;
        }

        #endregion

        #region UI Helper Methods

        private VisualElement CreateValuePreview(ValueAlignment alignment)
        {
            var container = new VisualElement
            {
                name = "value-preview"
            };
            container.AddToClassList("value-preview");

            var values = new Dictionary<string, int>
            {
                {"Helpfulness", alignment.helpfulness},
                {"Harmlessness", alignment.harmlessness},
                {"Honesty", alignment.honesty},
                {"Fairness", alignment.fairness},
                {"Autonomy", alignment.autonomy}
            };

            foreach (var kvp in values)
            {
                var valueBar = new VisualElement
                {
                    name = $"preview-{kvp.Key.ToLower()}"
                };
                valueBar.AddToClassList("value-bar-preview");

                var valueLabel = new Label($"{kvp.Key}: {kvp.Value}/5")
                {
                    name = "value-label"
                };
                valueLabel.AddToClassList("value-label-small");
                valueBar.Add(valueLabel);

                container.Add(valueBar);
            }

            return container;
        }

        private VisualElement CreateValueAlignmentBars(ValueAlignment alignment, string prefix)
        {
            var container = new VisualElement
            {
                name = "value-alignment-bars"
            };
            container.AddToClassList("value-bars-container");

            var titleLabel = new Label("Value Alignment:")
            {
                name = "values-title"
            };
            titleLabel.AddToClassList("values-title");
            container.Add(titleLabel);

            var values = new Dictionary<string, int>
            {
                {"Helpfulness", alignment.helpfulness},
                {"Harmlessness", alignment.harmlessness},
                {"Honesty", alignment.honesty},
                {"Fairness", alignment.fairness},
                {"Autonomy", alignment.autonomy}
            };

            foreach (var kvp in values)
            {
                var valueContainer = new VisualElement
                {
                    name = $"{prefix}-{kvp.Key.ToLower()}"
                };
                valueContainer.AddToClassList("value-bar-container");

                var valueLabel = new Label(kvp.Key)
                {
                    name = "value-name"
                };
                valueLabel.AddToClassList("value-name");
                valueContainer.Add(valueLabel);

                var progressBar = new ProgressBar
                {
                    title = "",
                    value = kvp.Value / 5f
                };
                progressBar.AddToClassList("value-progress-bar");
                valueContainer.Add(progressBar);

                var scoreLabel = new Label($"{kvp.Value}/5")
                {
                    name = "value-score"
                };
                scoreLabel.AddToClassList("value-score");
                valueContainer.Add(scoreLabel);

                container.Add(valueContainer);
            }

            return container;
        }

        private VisualElement CreateInteractiveValueRating(AlignmentOption option, string scenarioId)
        {
            var container = new VisualElement
            {
                name = "interactive-rating"
            };
            container.AddToClassList("interactive-rating");

            var titleLabel = new Label("Rate this option on each value:")
            {
                name = "rating-title"
            };
            titleLabel.AddToClassList("rating-title");
            container.Add(titleLabel);

            var values = new List<string> { "Helpfulness", "Harmlessness", "Honesty", "Fairness", "Autonomy" };

            foreach (var valueName in values)
            {
                var ratingContainer = new VisualElement
                {
                    name = $"rating-{valueName.ToLower()}"
                };
                ratingContainer.AddToClassList("value-rating-container");

                var valueLabel = new Label(valueName)
                {
                    name = "rating-value-name"
                };
                valueLabel.AddToClassList("rating-value-name");
                ratingContainer.Add(valueLabel);

                var ratingSlider = new SliderInt(1, 5)
                {
                    value = 3,
                    name = $"slider-{valueName.ToLower()}"
                };
                ratingSlider.RegisterValueChangedCallback(evt =>
                {
                    OnValueRatingChanged(scenarioId, option.optionId, valueName, evt.newValue);
                });
                ratingContainer.Add(ratingSlider);

                var ratingLabel = new Label("3/5")
                {
                    name = "rating-display"
                };
                ratingLabel.AddToClassList("rating-display");
                ratingContainer.Add(ratingLabel);

                container.Add(ratingContainer);
            }

            return container;
        }

        private VisualElement CreateValueEvaluationInterface(AlignmentScenario scenario)
        {
            var container = new VisualElement
            {
                name = "value-evaluation"
            };
            container.AddToClassList("evaluation-interface");

            var titleLabel = new Label("Overall Value Assessment:")
            {
                name = "evaluation-title"
            };
            titleLabel.AddToClassList("evaluation-title");
            container.Add(titleLabel);

            // Most important value selector
            var importantValueContainer = new VisualElement
            {
                name = "important-value-container"
            };
            importantValueContainer.AddToClassList("important-value-container");

            var importantValueLabel = new Label("Which value is most important in this scenario?")
            {
                name = "important-value-question"
            };
            importantValueLabel.AddToClassList("question-label");
            importantValueContainer.Add(importantValueLabel);

            var valueDropdown = new DropdownField("Primary Value",
                new List<string> { "Helpfulness", "Harmlessness", "Honesty", "Fairness", "Autonomy" }, 0)
            {
                name = "primary-value-dropdown"
            };
            valueDropdown.RegisterValueChangedCallback(evt =>
            {
                OnPrimaryValueSelected(scenario.scenarioId, evt.newValue);
            });
            importantValueContainer.Add(valueDropdown);

            container.Add(importantValueContainer);

            // Reasoning field
            var reasoningContainer = new VisualElement
            {
                name = "reasoning-container"
            };
            reasoningContainer.AddToClassList("reasoning-container");

            var reasoningLabel = new Label("Explain your reasoning:")
            {
                name = "reasoning-question"
            };
            reasoningLabel.AddToClassList("question-label");
            reasoningContainer.Add(reasoningLabel);

            var reasoningField = new TextField()
            {
                name = "reasoning-field",
                multiline = true
            };
            reasoningField.AddToClassList("reasoning-text-field");
            reasoningContainer.Add(reasoningField);

            container.Add(reasoningContainer);

            return container;
        }

        private VisualElement CreateDetailedValueEvaluation(AlignmentScenario scenario)
        {
            var container = new VisualElement
            {
                name = "detailed-evaluation"
            };
            container.AddToClassList("detailed-evaluation");

            var titleLabel = new Label("Detailed Value Analysis:")
            {
                name = "detailed-title"
            };
            titleLabel.AddToClassList("section-title");
            container.Add(titleLabel);

            // Trade-offs analysis
            var tradeoffsContainer = new VisualElement
            {
                name = "tradeoffs-container"
            };
            tradeoffsContainer.AddToClassList("tradeoffs-container");

            var tradeoffsLabel = new Label("What trade-offs do you see between different values?")
            {
                name = "tradeoffs-question"
            };
            tradeoffsLabel.AddToClassList("question-label");
            tradeoffsContainer.Add(tradeoffsLabel);

            var tradeoffsField = new TextField()
            {
                name = "tradeoffs-field",
                multiline = true
            };
            tradeoffsField.AddToClassList("analysis-text-field");
            tradeoffsContainer.Add(tradeoffsField);

            container.Add(tradeoffsContainer);

            // Submit button
            var submitButton = new Button(() => OnEvaluationSubmitted(scenario.scenarioId))
            {
                text = "Submit Evaluation"
            };
            submitButton.AddToClassList("submit-evaluation-button");
            container.Add(submitButton);

            return container;
        }

        private VisualElement CreateFinalEvaluationSection(AlignmentScenario scenario)
        {
            var container = new VisualElement
            {
                name = "final-evaluation"
            };
            container.AddToClassList("final-evaluation");

            var titleLabel = new Label("Final Assessment:")
            {
                name = "final-title"
            };
            titleLabel.AddToClassList("section-title");
            container.Add(titleLabel);

            // Best option selector
            var bestOptionContainer = new VisualElement
            {
                name = "best-option-container"
            };
            bestOptionContainer.AddToClassList("best-option-container");

            var bestOptionLabel = new Label("Which option shows the best overall alignment?")
            {
                name = "best-option-question"
            };
            bestOptionLabel.AddToClassList("question-label");
            bestOptionContainer.Add(bestOptionLabel);

            var optionNames = scenario.options.Select(o => o.action).ToList();
            var bestOptionDropdown = new DropdownField("Best Option", optionNames, 0)
            {
                name = "best-option-dropdown"
            };
            bestOptionDropdown.RegisterValueChangedCallback(evt =>
            {
                OnBestOptionSelected(scenario.scenarioId, evt.newValue);
            });
            bestOptionContainer.Add(bestOptionDropdown);

            container.Add(bestOptionContainer);

            // Confidence rating
            var confidenceContainer = new VisualElement
            {
                name = "confidence-container"
            };
            confidenceContainer.AddToClassList("confidence-container");

            var confidenceLabel = new Label("How confident are you in this assessment?")
            {
                name = "confidence-question"
            };
            confidenceLabel.AddToClassList("question-label");
            confidenceContainer.Add(confidenceLabel);

            var confidenceSlider = new Slider("Confidence", 0f, 1f)
            {
                value = 0.5f,
                name = "confidence-slider"
            };
            confidenceSlider.RegisterValueChangedCallback(evt =>
            {
                OnConfidenceChanged(scenario.scenarioId, evt.newValue);
            });
            confidenceContainer.Add(confidenceSlider);

            container.Add(confidenceContainer);

            return container;
        }

        #endregion

        #region Default Mechanics

        private async System.Threading.Tasks.Task SetupDefaultMechanics()
        {
            var titleLabel = new Label("AI Alignment Evaluation")
            {
                name = "title-label"
            };
            titleLabel.AddToClassList("game-title");
            currentContainer.Add(titleLabel);

            await LoadScenarioBasedInterface(currentScenarioIndex);
        }

        #endregion

        #region Event Handlers

        private void OnOptionSelected(string optionId, int index)
        {
            Debug.Log($"[AlignmentController] Option selected: {optionId}, index: {index}");
            OnRatingChanged?.Invoke(optionId, index, 0.8f); // Default confidence
        }

        private void OnValueRatingChanged(string scenarioId, string optionId, string valueName, int rating)
        {
            Debug.Log($"[AlignmentController] Value rating changed: {scenarioId}, {optionId}, {valueName}, {rating}");

            // Update rating display
            var ratingContainer = currentContainer.Q($"rating-{valueName.ToLower()}");
            var ratingDisplay = ratingContainer?.Q<Label>("rating-display");
            if (ratingDisplay != null)
            {
                ratingDisplay.text = $"{rating}/5";
            }

            OnRatingChanged?.Invoke($"{scenarioId}-{optionId}-{valueName}", rating, 0.7f);
        }

        private void OnPrimaryValueSelected(string scenarioId, string primaryValue)
        {
            Debug.Log($"[AlignmentController] Primary value selected: {scenarioId}, {primaryValue}");
        }

        private void OnBestOptionSelected(string scenarioId, string bestOption)
        {
            Debug.Log($"[AlignmentController] Best option selected: {scenarioId}, {bestOption}");
        }

        private void OnConfidenceChanged(string scenarioId, float confidence)
        {
            Debug.Log($"[AlignmentController] Confidence changed: {scenarioId}, {confidence}");
        }

        private void OnEvaluationSubmitted(string scenarioId)
        {
            Debug.Log($"[AlignmentController] Evaluation submitted for: {scenarioId}");

            // Collect all evaluation data
            var evaluationData = CollectEvaluationData(scenarioId);

            // Move to next scenario or complete
            if (currentScenarioIndex < scenarios.Count - 1)
            {
                currentScenarioIndex++;
                StartCoroutine(LoadNextScenarioAfterDelay(1f));
            }
            else
            {
                CompleteAllScenarios();
            }
        }

        private void MoveOptionUp(int index)
        {
            // Implement option reordering logic
            Debug.Log($"[AlignmentController] Moving option {index} up");
        }

        private void MoveOptionDown(int index)
        {
            // Implement option reordering logic
            Debug.Log($"[AlignmentController] Moving option {index} down");
        }

        #endregion

        #region Helper Methods

        private Dictionary<string, object> CollectEvaluationData(string scenarioId)
        {
            var data = new Dictionary<string, object>();

            // Collect reasoning
            var reasoningField = currentContainer.Q<TextField>("reasoning-field");
            if (reasoningField != null)
            {
                data["reasoning"] = reasoningField.value;
            }

            // Collect tradeoffs analysis
            var tradeoffsField = currentContainer.Q<TextField>("tradeoffs-field");
            if (tradeoffsField != null)
            {
                data["tradeoffs"] = tradeoffsField.value;
            }

            // Collect primary value
            var primaryValueDropdown = currentContainer.Q<DropdownField>("primary-value-dropdown");
            if (primaryValueDropdown != null)
            {
                data["primaryValue"] = primaryValueDropdown.value;
            }

            // Collect best option
            var bestOptionDropdown = currentContainer.Q<DropdownField>("best-option-dropdown");
            if (bestOptionDropdown != null)
            {
                data["bestOption"] = bestOptionDropdown.value;
            }

            // Collect confidence
            var confidenceSlider = currentContainer.Q<Slider>("confidence-slider");
            if (confidenceSlider != null)
            {
                data["confidence"] = confidenceSlider.value;
            }

            return data;
        }

        private System.Collections.IEnumerator LoadNextScenarioAfterDelay(float delay)
        {
            yield return new WaitForSeconds(delay);

            switch (scenarios[currentScenarioIndex].scenarioId)
            {
                case var id when currentContainer.Q("ranking-container") != null:
                    await LoadRankingScenario(currentScenarioIndex);
                    break;
                case var id when currentContainer.Q("comparison-container") != null:
                    await LoadComparisonScenario(currentScenarioIndex);
                    break;
                default:
                    await LoadScenarioBasedInterface(currentScenarioIndex);
                    break;
            }
        }

        private void CompleteAllScenarios()
        {
            OnScenarioCompleted?.Invoke(currentScenarioIndex + 1, true);
            Debug.Log("[AlignmentController] All alignment scenarios completed");
        }

        #endregion
    }
}
