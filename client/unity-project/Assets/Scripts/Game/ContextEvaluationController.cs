using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;
using ThinkRank.Core;

namespace ThinkRank.Game
{
    /// <summary>
    /// Controller for context evaluation game mechanics
    /// </summary>
    public class ContextEvaluationController : MonoBehaviour
    {
        private ResearchGameManager gameManager;
        private List<ContextScenario> scenarios;
        private int currentScenarioIndex;
        private VisualElement currentContainer;

        // Events
        public static event Action<string, string, float> OnClassificationMade;
        public static event Action<string, Dictionary<string, string>> OnContextAnalysisCompleted;
        public static event Action<int, bool> OnScenarioCompleted;

        public void Initialize(ResearchGameManager manager)
        {
            gameManager = manager;
        }

        public async System.Threading.Tasks.Task SetupUI(VisualElement container, ResearchProblemData problemData)
        {
            currentContainer = container;
            scenarios = problemData.contextScenarios;
            currentScenarioIndex = 0;

            if (scenarios == null || scenarios.Count == 0)
            {
                Debug.LogError("[ContextEvaluationController] No context scenarios available");
                return;
            }

            await SetupGameMechanics(problemData.gameType);
        }

        private async System.Threading.Tasks.Task SetupGameMechanics(GameType gameType)
        {
            switch (gameType)
            {
                case GameType.Comparison:
                    await SetupComparisonMechanics();
                    break;
                case GameType.ScenarioBased:
                    await SetupScenarioBasedMechanics();
                    break;
                case GameType.PatternRecognition:
                    await SetupPatternRecognitionMechanics();
                    break;
                default:
                    await SetupDefaultMechanics();
                    break;
            }
        }

        #region Comparison Mechanics

        private async System.Threading.Tasks.Task SetupComparisonMechanics()
        {
            // Title
            var titleLabel = new Label("Context Evaluation - Cross-Cultural Comparison")
            {
                name = "title-label"
            };
            titleLabel.AddToClassList("game-title");
            currentContainer.Add(titleLabel);

            // Instructions
            var instructionsLabel = new Label("Compare how AI responses perform across different cultural, temporal, or domain contexts:")
            {
                name = "instructions-label"
            };
            instructionsLabel.AddToClassList("instructions");
            currentContainer.Add(instructionsLabel);

            await LoadComparisonScenario(currentScenarioIndex);
        }

        private async System.Threading.Tasks.Task LoadComparisonScenario(int index)
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

            // Base scenario description
            var baseScenarioContainer = new VisualElement
            {
                name = "base-scenario-container"
            };
            baseScenarioContainer.AddToClassList("base-scenario-container");

            var baseScenarioTitle = new Label("Base Scenario:")
            {
                name = "base-scenario-title"
            };
            baseScenarioTitle.AddToClassList("section-title");
            baseScenarioContainer.Add(baseScenarioTitle);

            var baseScenarioText = new Label(scenario.baseScenario)
            {
                name = "base-scenario-text"
            };
            baseScenarioText.AddToClassList("scenario-text");
            baseScenarioContainer.Add(baseScenarioText);

            scenarioContainer.Add(baseScenarioContainer);

            // Context variants comparison
            var variantsContainer = CreateContextVariantsComparison(scenario);
            scenarioContainer.Add(variantsContainer);

            // Context analysis section
            var analysisContainer = CreateContextAnalysisSection(scenario);
            scenarioContainer.Add(analysisContainer);

            currentContainer.Add(scenarioContainer);
        }

        private VisualElement CreateContextVariantsComparison(ContextScenario scenario)
        {
            var container = new VisualElement
            {
                name = "variants-comparison"
            };
            container.AddToClassList("variants-comparison");

            var titleLabel = new Label("Context Variants:")
            {
                name = "variants-title"
            };
            titleLabel.AddToClassList("section-title");
            container.Add(titleLabel);

            // Create cards for each variant
            var variantsGrid = new VisualElement
            {
                name = "variants-grid"
            };
            variantsGrid.AddToClassList("variants-grid");

            foreach (var variant in scenario.variants)
            {
                var variantCard = CreateContextVariantCard(variant, scenario.scenarioId);
                variantsGrid.Add(variantCard);
            }

            container.Add(variantsGrid);

            return container;
        }

        private VisualElement CreateContextVariantCard(ContextVariant variant, string scenarioId)
        {
            var card = new VisualElement
            {
                name = $"variant-card-{variant.variantId}"
            };
            card.AddToClassList("context-variant-card");

            // Variant header
            var headerContainer = new VisualElement
            {
                name = "variant-header"
            };
            headerContainer.AddToClassList("variant-header");

            var descriptionLabel = new Label(variant.description)
            {
                name = "variant-description"
            };
            descriptionLabel.AddToClassList("variant-description");
            headerContainer.Add(descriptionLabel);

            card.Add(headerContainer);

            // Context information
            var contextInfoContainer = new VisualElement
            {
                name = "context-info"
            };
            contextInfoContainer.AddToClassList("context-info");

            if (!string.IsNullOrEmpty(variant.culturalContext))
            {
                var culturalLabel = new Label($"Cultural: {variant.culturalContext}")
                {
                    name = "cultural-context"
                };
                culturalLabel.AddToClassList("context-tag");
                contextInfoContainer.Add(culturalLabel);
            }

            if (!string.IsNullOrEmpty(variant.temporalContext))
            {
                var temporalLabel = new Label($"Temporal: {variant.temporalContext}")
                {
                    name = "temporal-context"
                };
                temporalLabel.AddToClassList("context-tag");
                contextInfoContainer.Add(temporalLabel);
            }

            if (!string.IsNullOrEmpty(variant.domainContext))
            {
                var domainLabel = new Label($"Domain: {variant.domainContext}")
                {
                    name = "domain-context"
                };
                domainLabel.AddToClassList("context-tag");
                contextInfoContainer.Add(domainLabel);
            }

            card.Add(contextInfoContainer);

            // Modified scenario text
            var modifiedScenarioLabel = new Label(variant.modifiedScenario)
            {
                name = "modified-scenario"
            };
            modifiedScenarioLabel.AddToClassList("modified-scenario-text");
            card.Add(modifiedScenarioLabel);

            // Appropriateness evaluation
            var evaluationContainer = CreateAppropriatenessEvaluation(variant, scenarioId);
            card.Add(evaluationContainer);

            return card;
        }

        private VisualElement CreateAppropriatenessEvaluation(ContextVariant variant, string scenarioId)
        {
            var container = new VisualElement
            {
                name = "appropriateness-evaluation"
            };
            container.AddToClassList("appropriateness-evaluation");

            var titleLabel = new Label("Appropriateness in this context:")
            {
                name = "appropriateness-title"
            };
            titleLabel.AddToClassList("evaluation-title");
            container.Add(titleLabel);

            // Appropriateness scale
            var scaleContainer = new VisualElement
            {
                name = "appropriateness-scale"
            };
            scaleContainer.AddToClassList("scale-container");

            var scaleSlider = new Slider("Appropriateness", 1f, 5f)
            {
                value = 3f,
                name = $"appropriateness-{variant.variantId}"
            };
            scaleSlider.RegisterValueChangedCallback(evt =>
            {
                OnAppropriatenessRated(scenarioId, variant.variantId, evt.newValue);
                UpdateScaleDisplay(scaleContainer, evt.newValue);
            });
            scaleContainer.Add(scaleSlider);

            var scaleLabels = new VisualElement
            {
                name = "scale-labels"
            };
            scaleLabels.AddToClassList("scale-labels");

            var labels = new string[] { "Very Inappropriate", "Inappropriate", "Neutral", "Appropriate", "Very Appropriate" };
            foreach (var label in labels)
            {
                var labelElement = new Label(label)
                {
                    name = "scale-label"
                };
                labelElement.AddToClassList("scale-label");
                scaleLabels.Add(labelElement);
            }
            scaleContainer.Add(scaleLabels);

            container.Add(scaleContainer);

            // Reasoning field
            var reasoningContainer = new VisualElement
            {
                name = "reasoning-container"
            };
            reasoningContainer.AddToClassList("reasoning-container");

            var reasoningLabel = new Label("Why is this appropriate/inappropriate in this context?")
            {
                name = "reasoning-question"
            };
            reasoningLabel.AddToClassList("question-label");
            reasoningContainer.Add(reasoningLabel);

            var reasoningField = new TextField()
            {
                name = $"reasoning-{variant.variantId}",
                multiline = true
            };
            reasoningField.AddToClassList("reasoning-text-field");
            reasoningContainer.Add(reasoningField);

            container.Add(reasoningContainer);

            return container;
        }

        #endregion

        #region Scenario-Based Mechanics

        private async System.Threading.Tasks.Task SetupScenarioBasedMechanics()
        {
            // Title
            var titleLabel = new Label("Context Evaluation - Scenario Analysis")
            {
                name = "title-label"
            };
            titleLabel.AddToClassList("game-title");
            currentContainer.Add(titleLabel);

            // Instructions
            var instructionsLabel = new Label("Analyze how context affects the appropriateness of AI responses:")
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

            // Scenario progress indicator
            var progressContainer = new VisualElement
            {
                name = "progress-container"
            };
            progressContainer.AddToClassList("progress-container");

            var progressLabel = new Label($"Scenario {currentScenarioIndex + 1} of {scenarios.Count}")
            {
                name = "progress-label"
            };
            progressLabel.AddToClassList("progress-label");
            progressContainer.Add(progressLabel);

            var progressBar = new ProgressBar
            {
                value = (float)(currentScenarioIndex + 1) / scenarios.Count
            };
            progressContainer.Add(progressBar);

            scenarioContainer.Add(progressContainer);

            // Base scenario
            var baseContainer = CreateBaseScenarioDisplay(scenario);
            scenarioContainer.Add(baseContainer);

            // Sequential variant evaluation
            var evaluationContainer = CreateSequentialVariantEvaluation(scenario);
            scenarioContainer.Add(evaluationContainer);

            currentContainer.Add(scenarioContainer);
        }

        private VisualElement CreateBaseScenarioDisplay(ContextScenario scenario)
        {
            var container = new VisualElement
            {
                name = "base-scenario-display"
            };
            container.AddToClassList("base-scenario-display");

            var titleLabel = new Label("Original Scenario:")
            {
                name = "base-title"
            };
            titleLabel.AddToClassList("section-title");
            container.Add(titleLabel);

            var scenarioText = new Label(scenario.baseScenario)
            {
                name = "base-scenario-text"
            };
            scenarioText.AddToClassList("scenario-text");
            container.Add(scenarioText);

            // Expected differences preview
            if (scenario.expectedDifferences != null && scenario.expectedDifferences.Count > 0)
            {
                var differencesContainer = new VisualElement
                {
                    name = "expected-differences"
                };
                differencesContainer.AddToClassList("expected-differences");

                var differencesTitle = new Label("Key Considerations:")
                {
                    name = "differences-title"
                };
                differencesTitle.AddToClassList("subsection-title");
                differencesContainer.Add(differencesTitle);

                foreach (var difference in scenario.expectedDifferences)
                {
                    var differenceItem = new Label($"• {difference}")
                    {
                        name = "difference-item"
                    };
                    differenceItem.AddToClassList("difference-item");
                    differencesContainer.Add(differenceItem);
                }

                container.Add(differencesContainer);
            }

            return container;
        }

        private VisualElement CreateSequentialVariantEvaluation(ContextScenario scenario)
        {
            var container = new VisualElement
            {
                name = "sequential-evaluation"
            };
            container.AddToClassList("sequential-evaluation");

            var titleLabel = new Label("Context Variants:")
            {
                name = "variants-title"
            };
            titleLabel.AddToClassList("section-title");
            container.Add(titleLabel);

            // Create tabbed interface for variants
            var tabsContainer = new VisualElement
            {
                name = "tabs-container"
            };
            tabsContainer.AddToClassList("tabs-container");

            var tabButtons = new VisualElement
            {
                name = "tab-buttons"
            };
            tabButtons.AddToClassList("tab-buttons");

            var tabContent = new VisualElement
            {
                name = "tab-content"
            };
            tabContent.AddToClassList("tab-content");

            for (int i = 0; i < scenario.variants.Count; i++)
            {
                var variant = scenario.variants[i];

                // Create tab button
                var tabButton = new Button(() => ShowVariantTab(variant, tabContent))
                {
                    text = variant.description,
                    name = $"tab-button-{i}"
                };
                tabButton.AddToClassList("tab-button");
                if (i == 0) tabButton.AddToClassList("active-tab");
                tabButtons.Add(tabButton);
            }

            tabsContainer.Add(tabButtons);
            tabsContainer.Add(tabContent);
            container.Add(tabsContainer);

            // Show first variant by default
            if (scenario.variants.Count > 0)
            {
                ShowVariantTab(scenario.variants[0], tabContent);
            }

            // Analysis summary
            var summaryContainer = CreateAnalysisSummary(scenario);
            container.Add(summaryContainer);

            return container;
        }

        private void ShowVariantTab(ContextVariant variant, VisualElement tabContent)
        {
            tabContent.Clear();

            // Update active tab styling
            var tabButtons = currentContainer.Query<Button>().Where(b => b.name.StartsWith("tab-button-")).ToList();
            foreach (var button in tabButtons)
            {
                button.RemoveFromClassList("active-tab");
            }

            var activeButton = tabButtons.Find(b => b.text == variant.description);
            activeButton?.AddToClassList("active-tab");

            // Variant content
            var variantContainer = new VisualElement
            {
                name = "variant-content"
            };
            variantContainer.AddToClassList("variant-content");

            // Context tags
            var contextTagsContainer = new VisualElement
            {
                name = "context-tags"
            };
            contextTagsContainer.AddToClassList("context-tags");

            if (!string.IsNullOrEmpty(variant.culturalContext))
            {
                var tag = CreateContextTag("Cultural", variant.culturalContext);
                contextTagsContainer.Add(tag);
            }

            if (!string.IsNullOrEmpty(variant.temporalContext))
            {
                var tag = CreateContextTag("Temporal", variant.temporalContext);
                contextTagsContainer.Add(tag);
            }

            if (!string.IsNullOrEmpty(variant.domainContext))
            {
                var tag = CreateContextTag("Domain", variant.domainContext);
                contextTagsContainer.Add(tag);
            }

            variantContainer.Add(contextTagsContainer);

            // Modified scenario
            var modifiedScenarioLabel = new Label(variant.modifiedScenario)
            {
                name = "modified-scenario"
            };
            modifiedScenarioLabel.AddToClassList("modified-scenario-text");
            variantContainer.Add(modifiedScenarioLabel);

            // Evaluation interface
            var evaluationInterface = CreateDetailedEvaluationInterface(variant);
            variantContainer.Add(evaluationInterface);

            tabContent.Add(variantContainer);
        }

        private VisualElement CreateContextTag(string type, string value)
        {
            var tag = new VisualElement
            {
                name = $"tag-{type.ToLower()}"
            };
            tag.AddToClassList("context-tag");

            var typeLabel = new Label(type)
            {
                name = "tag-type"
            };
            typeLabel.AddToClassList("tag-type");
            tag.Add(typeLabel);

            var valueLabel = new Label(value)
            {
                name = "tag-value"
            };
            valueLabel.AddToClassList("tag-value");
            tag.Add(valueLabel);

            return tag;
        }

        private VisualElement CreateDetailedEvaluationInterface(ContextVariant variant)
        {
            var container = new VisualElement
            {
                name = "detailed-evaluation"
            };
            container.AddToClassList("detailed-evaluation");

            // Appropriateness classification
            var classificationContainer = new VisualElement
            {
                name = "classification-container"
            };
            classificationContainer.AddToClassList("classification-container");

            var classificationLabel = new Label("How appropriate is this response in this context?")
            {
                name = "classification-question"
            };
            classificationLabel.AddToClassList("question-label");
            classificationContainer.Add(classificationLabel);

            var classificationDropdown = new DropdownField("Classification",
                new List<string> { "Highly Appropriate", "Appropriate", "Neutral", "Inappropriate", "Highly Inappropriate" }, 2)
            {
                name = $"classification-{variant.variantId}"
            };
            classificationDropdown.RegisterValueChangedCallback(evt =>
            {
                OnClassificationChanged(variant.variantId, evt.newValue);
            });
            classificationContainer.Add(classificationDropdown);

            container.Add(classificationContainer);

            // Specific issues identification
            var issuesContainer = new VisualElement
            {
                name = "issues-container"
            };
            issuesContainer.AddToClassList("issues-container");

            var issuesLabel = new Label("What specific issues do you identify?")
            {
                name = "issues-question"
            };
            issuesLabel.AddToClassList("question-label");
            issuesContainer.Add(issuesLabel);

            var issuesCheckboxes = new VisualElement
            {
                name = "issues-checkboxes"
            };
            issuesCheckboxes.AddToClassList("checkboxes-container");

            var issueTypes = new List<string>
            {
                "Cultural insensitivity",
                "Temporal inappropriateness",
                "Domain mismatch",
                "Language barrier",
                "Value conflicts",
                "Context misunderstanding"
            };

            foreach (var issueType in issueTypes)
            {
                var checkbox = new Toggle(issueType)
                {
                    name = $"issue-{issueType.Replace(" ", "-").ToLower()}"
                };
                checkbox.RegisterValueChangedCallback(evt =>
                {
                    OnIssueToggled(variant.variantId, issueType, evt.newValue);
                });
                issuesCheckboxes.Add(checkbox);
            }

            issuesContainer.Add(issuesCheckboxes);
            container.Add(issuesContainer);

            // Improvement suggestions
            var improvementsContainer = new VisualElement
            {
                name = "improvements-container"
            };
            improvementsContainer.AddToClassList("improvements-container");

            var improvementsLabel = new Label("How could this response be improved for this context?")
            {
                name = "improvements-question"
            };
            improvementsLabel.AddToClassList("question-label");
            improvementsContainer.Add(improvementsLabel);

            var improvementsField = new TextField()
            {
                name = $"improvements-{variant.variantId}",
                multiline = true
            };
            improvementsField.AddToClassList("improvements-text-field");
            improvementsContainer.Add(improvementsField);

            container.Add(improvementsContainer);

            return container;
        }

        #endregion

        #region Pattern Recognition Mechanics

        private async System.Threading.Tasks.Task SetupPatternRecognitionMechanics()
        {
            // Title
            var titleLabel = new Label("Context Evaluation - Pattern Analysis")
            {
                name = "title-label"
            };
            titleLabel.AddToClassList("game-title");
            currentContainer.Add(titleLabel);

            // Instructions
            var instructionsLabel = new Label("Identify patterns in how context affects AI response appropriateness:")
            {
                name = "instructions-label"
            };
            instructionsLabel.AddToClassList("instructions");
            currentContainer.Add(instructionsLabel);

            await SetupPatternAnalysisInterface();
        }

        private async System.Threading.Tasks.Task SetupPatternAnalysisInterface()
        {
            var patternContainer = new VisualElement
            {
                name = "pattern-analysis-container"
            };
            patternContainer.AddToClassList("pattern-container");

            // Show multiple scenarios for pattern identification
            var scenariosGrid = new VisualElement
            {
                name = "scenarios-grid"
            };
            scenariosGrid.AddToClassList("scenarios-grid");

            for (int i = 0; i < Math.Min(3, scenarios.Count); i++)
            {
                var scenario = scenarios[i];
                var scenarioCard = CreatePatternScenarioCard(scenario, i);
                scenariosGrid.Add(scenarioCard);
            }

            patternContainer.Add(scenariosGrid);

            // Pattern identification section
            var patternIdentificationContainer = CreatePatternIdentificationSection();
            patternContainer.Add(patternIdentificationContainer);

            currentContainer.Add(patternContainer);
        }

        private VisualElement CreatePatternScenarioCard(ContextScenario scenario, int index)
        {
            var card = new VisualElement
            {
                name = $"pattern-scenario-{index}"
            };
            card.AddToClassList("pattern-scenario-card");

            var titleLabel = new Label($"Scenario {index + 1}")
            {
                name = "pattern-scenario-title"
            };
            titleLabel.AddToClassList("pattern-scenario-title");
            card.Add(titleLabel);

            var baseScenarioLabel = new Label(scenario.baseScenario)
            {
                name = "pattern-base-scenario"
            };
            baseScenarioLabel.AddToClassList("pattern-base-scenario");
            card.Add(baseScenarioLabel);

            // Mini variant comparison
            var miniVariantsContainer = new VisualElement
            {
                name = "mini-variants"
            };
            miniVariantsContainer.AddToClassList("mini-variants");

            foreach (var variant in scenario.variants)
            {
                var miniVariant = CreateMiniVariantDisplay(variant);
                miniVariantsContainer.Add(miniVariant);
            }

            card.Add(miniVariantsContainer);

            return card;
        }

        private VisualElement CreateMiniVariantDisplay(ContextVariant variant)
        {
            var container = new VisualElement
            {
                name = "mini-variant"
            };
            container.AddToClassList("mini-variant");

            var descriptionLabel = new Label(variant.description)
            {
                name = "mini-description"
            };
            descriptionLabel.AddToClassList("mini-description");
            container.Add(descriptionLabel);

            var contextInfo = new Label(GetContextSummary(variant))
            {
                name = "mini-context"
            };
            contextInfo.AddToClassList("mini-context");
            container.Add(contextInfo);

            // Quick appropriateness rating
            var ratingSlider = new Slider("", 1f, 5f)
            {
                value = 3f,
                name = $"mini-rating-{variant.variantId}"
            };
            ratingSlider.RegisterValueChangedCallback(evt =>
            {
                OnMiniRatingChanged(variant.variantId, evt.newValue);
            });
            container.Add(ratingSlider);

            return container;
        }

        private VisualElement CreatePatternIdentificationSection()
        {
            var container = new VisualElement
            {
                name = "pattern-identification"
            };
            container.AddToClassList("pattern-identification");

            var titleLabel = new Label("Pattern Analysis:")
            {
                name = "pattern-title"
            };
            titleLabel.AddToClassList("section-title");
            container.Add(titleLabel);

            // Pattern questions
            var questionsContainer = new VisualElement
            {
                name = "pattern-questions"
            };
            questionsContainer.AddToClassList("pattern-questions");

            // Cultural pattern question
            var culturalContainer = CreatePatternQuestion(
                "Cultural Patterns",
                "What patterns do you notice in how cultural context affects appropriateness?",
                "cultural-pattern"
            );
            questionsContainer.Add(culturalContainer);

            // Temporal pattern question
            var temporalContainer = CreatePatternQuestion(
                "Temporal Patterns",
                "How does the time period or era affect response appropriateness?",
                "temporal-pattern"
            );
            questionsContainer.Add(temporalContainer);

            // Domain pattern question
            var domainContainer = CreatePatternQuestion(
                "Domain Patterns",
                "What differences do you observe across different domains or fields?",
                "domain-pattern"
            );
            questionsContainer.Add(domainContainer);

            container.Add(questionsContainer);

            // Submit pattern analysis
            var submitButton = new Button(() => OnPatternAnalysisSubmitted())
            {
                text = "Submit Pattern Analysis"
            };
            submitButton.AddToClassList("submit-pattern-button");
            container.Add(submitButton);

            return container;
        }

        private VisualElement CreatePatternQuestion(string title, string question, string fieldName)
        {
            var container = new VisualElement
            {
                name = $"{fieldName}-container"
            };
            container.AddToClassList("pattern-question-container");

            var titleLabel = new Label(title)
            {
                name = $"{fieldName}-title"
            };
            titleLabel.AddToClassList("pattern-question-title");
            container.Add(titleLabel);

            var questionLabel = new Label(question)
            {
                name = $"{fieldName}-question"
            };
            questionLabel.AddToClassList("pattern-question-text");
            container.Add(questionLabel);

            var answerField = new TextField()
            {
                name = $"{fieldName}-answer",
                multiline = true
            };
            answerField.AddToClassList("pattern-answer-field");
            container.Add(answerField);

            return container;
        }

        #endregion

        #region UI Helper Methods

        private void UpdateScaleDisplay(VisualElement scaleContainer, float value)
        {
            var scaleLabels = scaleContainer.Q("scale-labels");
            if (scaleLabels != null)
            {
                var labels = scaleLabels.Query<Label>().ToList();
                for (int i = 0; i < labels.Count; i++)
                {
                    labels[i].RemoveFromClassList("active-scale-label");
                    if (i == Mathf.RoundToInt(value) - 1)
                    {
                        labels[i].AddToClassList("active-scale-label");
                    }
                }
            }
        }

        private string GetContextSummary(ContextVariant variant)
        {
            var contexts = new List<string>();
            if (!string.IsNullOrEmpty(variant.culturalContext)) contexts.Add($"Cultural: {variant.culturalContext}");
            if (!string.IsNullOrEmpty(variant.temporalContext)) contexts.Add($"Temporal: {variant.temporalContext}");
            if (!string.IsNullOrEmpty(variant.domainContext)) contexts.Add($"Domain: {variant.domainContext}");

            return string.Join(" | ", contexts);
        }

        private VisualElement CreateContextAnalysisSection(ContextScenario scenario)
        {
            var container = new VisualElement
            {
                name = "context-analysis"
            };
            container.AddToClassList("context-analysis");

            var titleLabel = new Label("Cross-Context Analysis:")
            {
                name = "analysis-title"
            };
            titleLabel.AddToClassList("section-title");
            container.Add(titleLabel);

            // Comparison matrix
            var matrixContainer = CreateComparisonMatrix(scenario);
            container.Add(matrixContainer);

            // Overall assessment
            var assessmentContainer = CreateOverallAssessment(scenario);
            container.Add(assessmentContainer);

            return container;
        }

        private VisualElement CreateComparisonMatrix(ContextScenario scenario)
        {
            var container = new VisualElement
            {
                name = "comparison-matrix"
            };
            container.AddToClassList("comparison-matrix");

            var titleLabel = new Label("Context Comparison Matrix:")
            {
                name = "matrix-title"
            };
            titleLabel.AddToClassList("subsection-title");
            container.Add(titleLabel);

            // Create table-like structure
            var tableContainer = new VisualElement
            {
                name = "matrix-table"
            };
            tableContainer.AddToClassList("matrix-table");

            // Header row
            var headerRow = new VisualElement
            {
                name = "matrix-header"
            };
            headerRow.AddToClassList("matrix-row");

            var contextHeaderLabel = new Label("Context")
            {
                name = "context-header"
            };
            contextHeaderLabel.AddToClassList("matrix-cell-header");
            headerRow.Add(contextHeaderLabel);

            var appropriatenessHeaderLabel = new Label("Appropriateness")
            {
                name = "appropriateness-header"
            };
            appropriatenessHeaderLabel.AddToClassList("matrix-cell-header");
            headerRow.Add(appropriatenessHeaderLabel);

            var reasonHeaderLabel = new Label("Key Factors")
            {
                name = "reason-header"
            };
            reasonHeaderLabel.AddToClassList("matrix-cell-header");
            headerRow.Add(reasonHeaderLabel);

            tableContainer.Add(headerRow);

            // Data rows for each variant
            foreach (var variant in scenario.variants)
            {
                var dataRow = CreateMatrixRow(variant);
                tableContainer.Add(dataRow);
            }

            container.Add(tableContainer);
            return container;
        }

        private VisualElement CreateMatrixRow(ContextVariant variant)
        {
            var row = new VisualElement
            {
                name = $"matrix-row-{variant.variantId}"
            };
            row.AddToClassList("matrix-row");

            var contextCell = new Label(variant.description)
            {
                name = "context-cell"
            };
            contextCell.AddToClassList("matrix-cell");
            row.Add(contextCell);

            var appropriatenessCell = new VisualElement
            {
                name = "appropriateness-cell"
            };
            appropriatenessCell.AddToClassList("matrix-cell");

            var quickRating = new SliderInt(1, 5)
            {
                value = 3,
                name = $"quick-rating-{variant.variantId}"
            };
            quickRating.RegisterValueChangedCallback(evt =>
            {
                OnQuickRatingChanged(variant.variantId, evt.newValue);
            });
            appropriatenessCell.Add(quickRating);

            row.Add(appropriatenessCell);

            var factorsCell = new TextField()
            {
                name = $"factors-{variant.variantId}",
                placeholder = "Key factors affecting appropriateness..."
            };
            factorsCell.AddToClassList("matrix-cell");
            factorsCell.AddToClassList("factors-field");
            row.Add(factorsCell);

            return row;
        }

        private VisualElement CreateOverallAssessment(ContextScenario scenario)
        {
            var container = new VisualElement
            {
                name = "overall-assessment"
            };
            container.AddToClassList("overall-assessment");

            var titleLabel = new Label("Overall Assessment:")
            {
                name = "assessment-title"
            };
            titleLabel.AddToClassList("subsection-title");
            container.Add(titleLabel);

            // Most/least appropriate context
            var rankingContainer = new VisualElement
            {
                name = "context-ranking"
            };
            rankingContainer.AddToClassList("context-ranking");

            var mostAppropriateLabel = new Label("Most appropriate context:")
            {
                name = "most-appropriate-label"
            };
            mostAppropriateLabel.AddToClassList("ranking-label");
            rankingContainer.Add(mostAppropriateLabel);

            var contextOptions = scenario.variants.Select(v => v.description).ToList();
            var mostAppropriateDropdown = new DropdownField("", contextOptions, 0)
            {
                name = "most-appropriate-dropdown"
            };
            mostAppropriateDropdown.RegisterValueChangedCallback(evt =>
            {
                OnMostAppropriateSelected(scenario.scenarioId, evt.newValue);
            });
            rankingContainer.Add(mostAppropriateDropdown);

            container.Add(rankingContainer);

            // Summary reasoning
            var summaryContainer = new VisualElement
            {
                name = "summary-reasoning"
            };
            summaryContainer.AddToClassList("summary-reasoning");

            var summaryLabel = new Label("Summarize the key contextual factors that affect appropriateness:")
            {
                name = "summary-question"
            };
            summaryLabel.AddToClassList("question-label");
            summaryContainer.Add(summaryLabel);

            var summaryField = new TextField()
            {
                name = "summary-field",
                multiline = true
            };
            summaryField.AddToClassList("summary-text-field");
            summaryContainer.Add(summaryField);

            container.Add(summaryContainer);

            // Submit button
            var submitButton = new Button(() => OnContextAnalysisSubmitted(scenario.scenarioId))
            {
                text = "Submit Context Analysis"
            };
            submitButton.AddToClassList("submit-analysis-button");
            container.Add(submitButton);

            return container;
        }

        #endregion

        #region Default Mechanics

        private async System.Threading.Tasks.Task SetupDefaultMechanics()
        {
            var titleLabel = new Label("Context Evaluation Challenge")
            {
                name = "title-label"
            };
            titleLabel.AddToClassList("game-title");
            currentContainer.Add(titleLabel);

            await LoadComparisonScenario(currentScenarioIndex);
        }

        #endregion

        #region Event Handlers

        private void OnAppropriatenessRated(string scenarioId, string variantId, float rating)
        {
            Debug.Log($"[ContextEvaluationController] Appropriateness rated: {scenarioId}, {variantId}, {rating}");
            OnClassificationMade?.Invoke($"{scenarioId}-{variantId}", rating.ToString(), 0.7f);
        }

        private void OnClassificationChanged(string variantId, string classification)
        {
            Debug.Log($"[ContextEvaluationController] Classification changed: {variantId}, {classification}");
            OnClassificationMade?.Invoke(variantId, classification, 0.8f);
        }

        private void OnIssueToggled(string variantId, string issueType, bool isSelected)
        {
            Debug.Log($"[ContextEvaluationController] Issue toggled: {variantId}, {issueType}, {isSelected}");
        }

        private void OnMiniRatingChanged(string variantId, float rating)
        {
            Debug.Log($"[ContextEvaluationController] Mini rating changed: {variantId}, {rating}");
        }

        private void OnQuickRatingChanged(string variantId, int rating)
        {
            Debug.Log($"[ContextEvaluationController] Quick rating changed: {variantId}, {rating}");
        }

        private void OnMostAppropriateSelected(string scenarioId, string mostAppropriate)
        {
            Debug.Log($"[ContextEvaluationController] Most appropriate selected: {scenarioId}, {mostAppropriate}");
        }

        private void OnContextAnalysisSubmitted(string scenarioId)
        {
            Debug.Log($"[ContextEvaluationController] Context analysis submitted: {scenarioId}");

            // Collect analysis data
            var analysisData = CollectContextAnalysisData(scenarioId);
            OnContextAnalysisCompleted?.Invoke(scenarioId, analysisData);

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

        private void OnPatternAnalysisSubmitted()
        {
            Debug.Log("[ContextEvaluationController] Pattern analysis submitted");

            // Collect pattern data
            var patternData = CollectPatternAnalysisData();
            OnContextAnalysisCompleted?.Invoke("pattern-analysis", patternData);

            CompleteAllScenarios();
        }

        #endregion

        #region Helper Methods

        private Dictionary<string, string> CollectContextAnalysisData(string scenarioId)
        {
            var data = new Dictionary<string, string>();

            // Collect summary reasoning
            var summaryField = currentContainer.Q<TextField>("summary-field");
            if (summaryField != null)
            {
                data["summary"] = summaryField.value;
            }

            // Collect most appropriate context
            var mostAppropriateDropdown = currentContainer.Q<DropdownField>("most-appropriate-dropdown");
            if (mostAppropriateDropdown != null)
            {
                data["mostAppropriate"] = mostAppropriateDropdown.value;
            }

            return data;
        }

        private Dictionary<string, string> CollectPatternAnalysisData()
        {
            var data = new Dictionary<string, string>();

            // Collect pattern answers
            var culturalField = currentContainer.Q<TextField>("cultural-pattern-answer");
            if (culturalField != null)
            {
                data["culturalPattern"] = culturalField.value;
            }

            var temporalField = currentContainer.Q<TextField>("temporal-pattern-answer");
            if (temporalField != null)
            {
                data["temporalPattern"] = temporalField.value;
            }

            var domainField = currentContainer.Q<TextField>("domain-pattern-answer");
            if (domainField != null)
            {
                data["domainPattern"] = domainField.value;
            }

            return data;
        }

        private System.Collections.IEnumerator LoadNextScenarioAfterDelay(float delay)
        {
            yield return new WaitForSeconds(delay);
            await LoadComparisonScenario(currentScenarioIndex);
        }

        private void CompleteAllScenarios()
        {
            OnScenarioCompleted?.Invoke(currentScenarioIndex + 1, true);
            Debug.Log("[ContextEvaluationController] All context evaluation scenarios completed");
        }

        #endregion
    }
}
