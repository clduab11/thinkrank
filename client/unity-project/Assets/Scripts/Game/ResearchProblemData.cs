using System;
using System.Collections.Generic;
using UnityEngine;

namespace ThinkRank.Game
{
    /// <summary>
    /// ScriptableObject for storing research problem data
    /// </summary>
    [CreateAssetMenu(fileName = "New Research Problem", menuName = "ThinkRank/Research Problem")]
    public class ResearchProblemData : ScriptableObject
    {
        [Header("Problem Information")]
        public string problemId;
        public string title;
        [TextArea(3, 5)]
        public string description;
        public ProblemType problemType;
        public int difficultyLevel = 1;

        [Header("Game Configuration")]
        public GameType gameType;
        public float timeLimit = 120f;
        public bool hintAvailable = true;
        public bool skipAllowed = false;

        [Header("Problem Data")]
        public List<BiasDetectionScenario> biasScenarios;
        public List<AlignmentScenario> alignmentScenarios;
        public List<ContextScenario> contextScenarios;

        [Header("Validation")]
        public float requiredAccuracy = 0.7f;
        public ValidationMethod validationMethod = ValidationMethod.Automatic;

        [Header("Scoring")]
        public int basePoints = 100;
        public float difficultyMultiplier = 1.0f;
        public float timeBonus = 0.5f;
    }

    [System.Serializable]
    public enum ProblemType
    {
        BiasDetection,
        Alignment,
        ContextEvaluation
    }

    [System.Serializable]
    public enum GameType
    {
        RapidFire,
        Comparison,
        Ranking,
        ScenarioBased,
        PatternRecognition
    }

    [System.Serializable]
    public enum ValidationMethod
    {
        Automatic,
        PeerReview,
        ExpertReview,
        Hybrid
    }

    [System.Serializable]
    public class BiasDetectionScenario
    {
        public string scenarioId;
        [TextArea(2, 4)]
        public string prompt;
        public List<ResponseOption> responses;
        [TextArea(2, 3)]
        public string biasPattern;
        [TextArea(2, 3)]
        public string explanation;
    }

    [System.Serializable]
    public class ResponseOption
    {
        public string optionId;
        [TextArea(2, 4)]
        public string text;
        [Range(0f, 1f)]
        public float biasScore;
        [TextArea(1, 3)]
        public string explanation;
        public bool correctChoice;
    }

    [System.Serializable]
    public class AlignmentScenario
    {
        public string scenarioId;
        [TextArea(3, 5)]
        public string situation;
        public List<AlignmentOption> options;
        public List<string> valueConflicts;
        public string ethicalFramework;
    }

    [System.Serializable]
    public class AlignmentOption
    {
        public string optionId;
        [TextArea(1, 3)]
        public string action;
        [TextArea(2, 4)]
        public string description;
        public ValueAlignment valueAlignment;
        public List<string> consequences;
    }

    [System.Serializable]
    public class ValueAlignment
    {
        [Range(1, 5)] public int helpfulness = 3;
        [Range(1, 5)] public int harmlessness = 3;
        [Range(1, 5)] public int honesty = 3;
        [Range(1, 5)] public int fairness = 3;
        [Range(1, 5)] public int autonomy = 3;
    }

    [System.Serializable]
    public class ContextScenario
    {
        public string scenarioId;
        [TextArea(2, 4)]
        public string baseScenario;
        public List<ContextVariant> variants;
        public List<string> expectedDifferences;
    }

    [System.Serializable]
    public class ContextVariant
    {
        public string variantId;
        [TextArea(1, 2)]
        public string description;
        [TextArea(2, 4)]
        public string modifiedScenario;
        public string culturalContext;
        public string temporalContext;
        public string domainContext;
    }

    /// <summary>
    /// Player solution data
    /// </summary>
    [System.Serializable]
    public class PlayerSolution
    {
        public string problemId;
        public List<PlayerAnswer> answers;
        public float confidence;
        public string reasoning;
        public float timeSpent;
        public DateTime submittedAt;
    }

    [System.Serializable]
    public class PlayerAnswer
    {
        public string questionId;
        public string selectedOption;
        public int rating;
        public string classification;
        public float confidence;
        public string reasoning;
    }
}
