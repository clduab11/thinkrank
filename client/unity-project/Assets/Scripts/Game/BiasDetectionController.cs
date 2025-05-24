using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;
using ThinkRank.Core;

namespace ThinkRank.Game
{
    /// <summary>
    /// Controller for bias detection game mechanics
    /// </summary>
    public class BiasDetectionController : MonoBehaviour
    {
        private ResearchGameManager gameManager;
        private List<BiasDetectionScenario> scenarios;
        private int currentScenarioIndex;
        private VisualElement currentContainer;

        // Events
        public static event Action<string, string, float> OnAnswerSelected;
        public static event Action<int, bool> OnScenarioCompleted;

        public void Initialize(ResearchGameManager manager)
        {
            gameManager = manager;
        }

        public async System.Threading.Tasks.Task SetupUI(VisualElement container, ResearchProblemData problemData)
        {
            currentContainer = container;
            scenarios = problemData.biasScenarios;
            currentScenarioIndex = 0;

            if (scenarios == null || scenarios.Count == 0)
            {
                Debug.LogError("[BiasDetectionController] No bias scenarios available");
                return;
            }

            await SetupGameMechanics(problemData.gameType);
        }

        private async System.Threading.Tasks.Task SetupGameMechanics(GameType gameType)
        {
            switch (gameType)
            {
                case GameType.RapidFire:
                    await SetupRapidFireMechanics();
                    break;
                case GameType.Comparison:
                    await SetupComparisonMechanics();
                    break;
                case GameType.PatternRecognition:
                    await SetupPatternRecognitionMechanics();
                    break;
                default:
                    await SetupDefaultMechanics();
                    break;
            }
        }

        #region Rapid Fire Mechanics

        private async System.Threading.Tasks.Task SetupRapidFireMechanics()
        {
            // Title
            var titleLabel = new Label("Bias Detection - Rapid Fire Mode")
            {
                name = "title-label"
            };
            titleLabel.AddToClassList("game-title");
            currentContainer.Add(titleLabel);

            // Instructions
            var instructionsLabel = new Label("Quickly identify which response contains bias. You have limited time per question!")
            {
                name = "instructions-label"
            };
            instructionsLabel.AddToClassList("instructions");
            currentContainer.Add(instructionsLabel);

            // Current scenario counter
            var counterLabel = new Label($"Question {currentScenarioIndex + 1} of {scenarios.Count}")
            {
                name = "counter-label"
            };
            counterLabel.AddToClassList("counter");
            currentContainer.Add(counterLabel);

            // Load first scenario
            await LoadScenario(currentScenarioIndex);
        }

        private async System.Threading.Tasks.Task LoadScenario(int index)
        {
            if (index >= scenarios.Count)
            {
                CompleteAllScenarios();
                return;
            }

            var scenario = scenarios[index];

            // Remove previous scenario content
            var previousScenario = currentContainer.Q("current-scenario");
            previousScenario?.RemoveFromHierarchy();

            // Create scenario container
            var scenarioContainer = new VisualElement
            {
                name = "current-scenario"
            };
            scenarioContainer.AddToClassList("scenario-container");

            // Scenario prompt
            var promptLabel = new Label(scenario.prompt)
            {
                name = "scenario-prompt"
            };
            promptLabel.AddToClassList("scenario-prompt");
            scenarioContainer.Add(promptLabel);

            // Response options
            var optionsContainer = new VisualElement
            {
                name = "options-container"
            };
            optionsContainer.AddToClassList("options-container");

            for (int i = 0; i < scenario.responses.Count; i++)
            {
                var response = scenario.responses[i];
                var optionButton = CreateResponseButton(response, scenario.scenarioId, i);
                optionsContainer.Add(optionButton);
            }

            scenarioContainer.Add(optionsContainer);

            // Add confidence slider
            var confidenceContainer = CreateConfidenceSlider(scenario.scenarioId);
            scenarioContainer.Add(confidenceContainer);

            currentContainer.Add(scenarioContainer);

            // Update counter
            var counterLabel = currentContainer.Q<Label>("counter-label");
            if (counterLabel != null)
            {
                counterLabel.text = $"Question {currentScenarioIndex + 1} of {scenarios.Count}";
            }
        }

        #endregion

        #region Comparison Mechanics

        private async System.Threading.Tasks.Task SetupComparisonMechanics()
        {
            // Title
            var titleLabel = new Label("Bias Detection - Comparison Mode")
            {
                name = "title-label"
            };
            titleLabel.AddToClassList("game-title");
            currentContainer.Add(titleLabel);

            // Instructions
            var instructionsLabel = new Label("Compare these responses and identify which one shows more bias:")
            {
                name = "instructions-label"
            };
            instructionsLabel.AddToClassList("instructions");
            currentContainer.Add(instructionsLabel);

            // Create side-by-side comparison
            await SetupSideBySideComparison();
        }

        private async System.Threading.Tasks.Task SetupSideBySideComparison()
        {
            if (scenarios.Count == 0) return;

            var scenario = scenarios[currentScenarioIndex];

            // Main comparison container
            var comparisonContainer = new VisualElement
            {
                name = "comparison-container"
            };
            comparisonContainer.AddToClassList("comparison-container");

            // Prompt
            var promptLabel = new Label(scenario.prompt)
            {
                name = "scenario-prompt"
            };
            promptLabel.AddToClassList("scenario-prompt");
            comparisonContainer.Add(promptLabel);

            // Side-by-side responses
            var responsesContainer = new VisualElement
            {
                name = "responses-container"
            };
            responsesContainer.AddToClassList("side-by-side");

            for (int i = 0; i < Math.Min(2, scenario.responses.Count); i++)
            {
                var response = scenario.responses[i];
                var responseCard = CreateComparisonCard(response, scenario.scenarioId, i);
                responsesContainer.Add(responseCard);
            }

            comparisonContainer.Add(responsesContainer);

            // Bias analysis section
            var analysisContainer = CreateBiasAnalysisSection(scenario);
            comparisonContainer.Add(analysisContainer);

            currentContainer.Add(comparisonContainer);
        }

        private VisualElement CreateComparisonCard(ResponseOption response, string scenarioId, int index)
        {
            var card = new VisualElement
            {
                name = $"response-card-{index}"
            };
            card.AddToClassList("response-card");

            // Response text
            var responseText = new Label(response.text)
            {
                name = "response-text"
            };
            responseText.AddToClassList("response-text");
            card.Add(responseText);

            // Selection button
            var selectButton = new Button(() => OnResponseSelected(scenarioId, response.optionId, index))
            {
                text = $"Select Response {index + 1}"
            };
            selectButton.AddToClassList("select-button");
            card.Add(selectButton);

            // Bias indicator (initially hidden)
            var biasIndicator = new VisualElement
            {
                name = "bias-indicator"
            };
            biasIndicator.AddToClassList("bias-indicator");
            biasIndicator.style.display = DisplayStyle.None;
            card.Add(biasIndicator);

            return card;
        }

        #endregion

        #region Pattern Recognition Mechanics

        private async System.Threading.Tasks.Task SetupPatternRecognitionMechanics()
        {
            // Title
            var titleLabel = new Label("Bias Detection - Pattern Recognition")
            {
                name = "title-label"
            };
            titleLabel.AddToClassList("game-title");
            currentContainer.Add(titleLabel);

            // Instructions
            var instructionsLabel = new Label("Identify the pattern of bias across these examples:")
            {
                name = "instructions-label"
            };
            instructionsLabel.AddToClassList("instructions");
            currentContainer.Add(instructionsLabel);

            // Create pattern grid
            await SetupPatternGrid();
        }

        private async System.Threading.Tasks.Task SetupPatternGrid()
        {
            var gridContainer = new VisualElement
            {
                name = "pattern-grid"
            };
            gridContainer.AddToClassList("pattern-grid");

            // Show multiple scenarios for pattern recognition
            for (int i = 0; i < Math.Min(3, scenarios.Count); i++)
            {
                var scenario = scenarios[i];
                var scenarioCard = CreatePatternScenarioCard(scenario, i);
                gridContainer.Add(scenarioCard);
            }

            currentContainer.Add(gridContainer);

            // Pattern analysis section
            var analysisSection = CreatePatternAnalysisSection();
            currentContainer.Add(analysisSection);
        }

        private VisualElement CreatePatternScenarioCard(BiasDetectionScenario scenario, int index)
        {
            var card = new VisualElement
            {
                name = $"pattern-card-{index}"
            };
            card.AddToClassList("pattern-card");

            // Scenario title
            var titleLabel = new Label($"Example {index + 1}")
            {
                name = "pattern-title"
            };
            titleLabel.AddToClassList("pattern-title");
            card.Add(titleLabel);

            // Prompt
            var promptLabel = new Label(scenario.prompt)
            {
                name = "pattern-prompt"
            };
            promptLabel.AddToClassList("pattern-prompt");
            card.Add(promptLabel);

            // Responses with bias indicators
            var responsesContainer = new VisualElement
            {
                name = "pattern-responses"
            };
            responsesContainer.AddToClassList("pattern-responses");

            foreach (var response in scenario.responses)
            {
                var responseElement = CreatePatternResponseElement(response, scenario.scenarioId);
                responsesContainer.Add(responseElement);
            }

            card.Add(responsesContainer);
            return card;
        }

        private VisualElement CreatePatternResponseElement(ResponseOption response, string scenarioId)
        {
            var element = new VisualElement
            {
                name = "pattern-response"
            };
            element.AddToClassList("pattern-response");

            var responseText = new Label(response.text)
            {
                name = "response-text"
            };
            responseText.AddToClassList("response-text");
            element.Add(responseText);

            // Bias score slider
            var biasSlider = new Slider("Bias Level", 0f, 1f)
            {
                value = 0.5f
            };
            biasSlider.RegisterValueChangedCallback(evt =>
            {
                OnBiasScoreChanged(scenarioId, response.optionId, evt.newValue);
            });
            element.Add(biasSlider);

            return element;
        }

        #endregion

        #region Default Mechanics

        private async System.Threading.Tasks.Task SetupDefaultMechanics()
        {
            // Standard scenario-based approach
            var titleLabel = new Label("Bias Detection Challenge")
            {
                name = "title-label"
            };
            titleLabel.AddToClassList("game-title");
            currentContainer.Add(titleLabel);

            await LoadScenario(currentScenarioIndex);
        }

        #endregion

        #region UI Helper Methods

        private Button CreateResponseButton(ResponseOption response, string scenarioId, int index)
        {
            var button = new Button(() => OnResponseSelected(scenarioId, response.optionId, index))
            {
                text = response.text,
                name = $"response-{index}"
            };
            button.AddToClassList("response-button");

            // Add visual feedback on hover
            button.RegisterCallback<MouseEnterEvent>(evt =>
            {
                button.AddToClassList("response-hover");
            });

            button.RegisterCallback<MouseLeaveEvent>(evt =>
            {
                button.RemoveFromClassList("response-hover");
            });

            return button;
        }

        private VisualElement CreateConfidenceSlider(string scenarioId)
        {
            var container = new VisualElement
            {
                name = "confidence-container"
            };
            container.AddToClassList("confidence-container");

            var label = new Label("How confident are you in your answer?")
            {
                name = "confidence-label"
            };
            label.AddToClassList("confidence-label");
            container.Add(label);

            var slider = new Slider("Confidence", 0f, 1f)
            {
                value = 0.5f,
                name = "confidence-slider"
            };
            slider.RegisterValueChangedCallback(evt =>
            {
                OnConfidenceChanged(scenarioId, evt.newValue);
            });
            container.Add(slider);

            return container;
        }

        private VisualElement CreateBiasAnalysisSection(BiasDetectionScenario scenario)
        {
            var section = new VisualElement
            {
                name = "bias-analysis"
            };
            section.AddToClassList("analysis-section");

            var titleLabel = new Label("Bias Analysis")
            {
                name = "analysis-title"
            };
            titleLabel.AddToClassList("analysis-title");
            section.Add(titleLabel);

            var instructionLabel = new Label("What type of bias do you detect?")
            {
                name = "analysis-instruction"
            };
            instructionLabel.AddToClassList("analysis-instruction");
            section.Add(instructionLabel);

            // Bias type dropdown
            var biasTypeDropdown = new DropdownField("Bias Type",
                new List<string> { "Position Bias", "Verbosity Bias", "Cultural Bias", "Gender Bias", "No Bias" }, 0)
            {
                name = "bias-type-dropdown"
            };
            biasTypeDropdown.RegisterValueChangedCallback(evt =>
            {
                OnBiasTypeSelected(scenario.scenarioId, evt.newValue);
            });
            section.Add(biasTypeDropdown);

            // Reasoning text field
            var reasoningField = new TextField("Explain your reasoning:")
            {
                name = "reasoning-field",
                multiline = true
            };
            reasoningField.AddToClassList("reasoning-field");
            section.Add(reasoningField);

            return section;
        }

        private VisualElement CreatePatternAnalysisSection()
        {
            var section = new VisualElement
            {
                name = "pattern-analysis"
            };
            section.AddToClassList("analysis-section");

            var titleLabel = new Label("Pattern Analysis")
            {
                name = "pattern-title"
            };
            titleLabel.AddToClassList("analysis-title");
            section.Add(titleLabel);

            var instructionLabel = new Label("What pattern of bias do you observe across these examples?")
            {
                name = "pattern-instruction"
            };
            instructionLabel.AddToClassList("analysis-instruction");
            section.Add(instructionLabel);

            // Pattern description field
            var patternField = new TextField("Describe the bias pattern:")
            {
                name = "pattern-field",
                multiline = true
            };
            patternField.AddToClassList("pattern-field");
            section.Add(patternField);

            // Submit button
            var submitButton = new Button(() => OnPatternSubmitted())
            {
                text = "Submit Pattern Analysis"
            };
            submitButton.AddToClassList("submit-button");
            section.Add(submitButton);

            return section;
        }

        #endregion

        #region Event Handlers

        private void OnResponseSelected(string scenarioId, string responseId, int index)
        {
            // Get confidence from slider
            var confidenceSlider = currentContainer.Q<Slider>("confidence-slider");
            float confidence = confidenceSlider?.value ?? 0.5f;

            // Trigger event
            OnAnswerSelected?.Invoke(scenarioId, responseId, confidence);

            // Provide visual feedback
            HighlightSelectedResponse(index);

            // Move to next scenario after delay (for rapid fire)
            if (scenarios != null && currentScenarioIndex < scenarios.Count - 1)
            {
                StartCoroutine(LoadNextScenarioAfterDelay(1.5f));
            }
            else
            {
                CompleteAllScenarios();
            }
        }

        private void OnBiasScoreChanged(string scenarioId, string responseId, float biasScore)
        {
            // Update bias score for pattern recognition
            Debug.Log($"[BiasDetectionController] Bias score updated: {scenarioId}, {responseId}, {biasScore}");
        }

        private void OnConfidenceChanged(string scenarioId, float confidence)
        {
            // Update confidence display
            Debug.Log($"[BiasDetectionController] Confidence updated: {scenarioId}, {confidence}");
        }

        private void OnBiasTypeSelected(string scenarioId, string biasType)
        {
            Debug.Log($"[BiasDetectionController] Bias type selected: {scenarioId}, {biasType}");
        }

        private void OnPatternSubmitted()
        {
            var patternField = currentContainer.Q<TextField>("pattern-field");
            string patternDescription = patternField?.value ?? "";

            Debug.Log($"[BiasDetectionController] Pattern submitted: {patternDescription}");
            CompleteAllScenarios();
        }

        #endregion

        #region Helper Methods

        private void HighlightSelectedResponse(int index)
        {
            // Remove previous highlights
            var responseButtons = currentContainer.Query<Button>().Where(b => b.name.StartsWith("response-")).ToList();
            foreach (var button in responseButtons)
            {
                button.RemoveFromClassList("selected");
            }

            // Highlight selected response
            var selectedButton = currentContainer.Q<Button>($"response-{index}");
            selectedButton?.AddToClassList("selected");
        }

        private System.Collections.IEnumerator LoadNextScenarioAfterDelay(float delay)
        {
            yield return new WaitForSeconds(delay);
            currentScenarioIndex++;
            await LoadScenario(currentScenarioIndex);
        }

        private void CompleteAllScenarios()
        {
            OnScenarioCompleted?.Invoke(currentScenarioIndex + 1, true);
            Debug.Log("[BiasDetectionController] All scenarios completed");
        }

        #endregion
    }
}
