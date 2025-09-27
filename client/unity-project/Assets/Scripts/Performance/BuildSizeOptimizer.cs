using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEditor;

namespace ThinkRank.Performance
{
    /// <summary>
    /// Comprehensive build size optimization system for mobile compliance
    /// Targets 30%+ bundle size reduction while maintaining performance and quality
    /// </summary>
    public class BuildSizeOptimizer : MonoBehaviour
    {
        [Header("Optimization Configuration")]
        [SerializeField] private bool enableAssetOptimization = true;
        [SerializeField] private bool enableCodeOptimization = true;
        [SerializeField] private bool enableBuildAnalysis = true;

        [Header("Size Targets")]
        [SerializeField] private long targetSizeMB = 150; // App Store cellular limit
        [SerializeField] private float targetReductionPercent = 30f;

        [Header("Quality Settings")]
        [SerializeField] private TextureCompressionQuality textureQuality = TextureCompressionQuality.High;
        [SerializeField] private AudioCompressionQuality audioQuality = AudioCompressionQuality.High;
        [SerializeField] private MeshOptimizationLevel meshOptimization = MeshOptimizationLevel.Medium;

        // Optimization components
        private AssetOptimizationPipeline assetPipeline;
        private CodeOptimizationManager codeOptimizer;
        private BuildAnalysisReporter buildAnalyzer;
        private PlatformOptimizationManager platformOptimizer;
        private QualityAssuranceValidator qaValidator;

        // Build metrics
        private BuildSizeMetrics currentMetrics;
        private Dictionary<string, long> assetSizeMap;
        private List<OptimizationRecommendation> recommendations;

        // Events
        public static event Action<BuildSizeMetrics> OnOptimizationProgress;
        public static event Action<OptimizationComplete> OnOptimizationComplete;
        public static event Action<SizeWarning> OnSizeWarning;

        private void Awake()
        {
            InitializeOptimizationSystem();
        }

        private void Start()
        {
            if (enableBuildAnalysis)
            {
                StartCoroutine(AnalyzeCurrentBuild());
            }
        }

        #region Initialization

        private void InitializeOptimizationSystem()
        {
            assetSizeMap = new Dictionary<string, long>();
            recommendations = new List<OptimizationRecommendation>();

            if (enableAssetOptimization)
            {
                assetPipeline = new AssetOptimizationPipeline(textureQuality, audioQuality, meshOptimization);
            }

            if (enableCodeOptimization)
            {
                codeOptimizer = new CodeOptimizationManager();
            }

            if (enableBuildAnalysis)
            {
                buildAnalyzer = new BuildAnalysisReporter();
                qaValidator = new QualityAssuranceValidator();
                platformOptimizer = new PlatformOptimizationManager();
            }

            Debug.Log("[BuildSizeOptimizer] Optimization system initialized");
        }

        #endregion

        #region Public Interface

        /// <summary>
        /// Start comprehensive build size optimization
        /// </summary>
        public void StartOptimization()
        {
            StartCoroutine(RunFullOptimization());
        }

        /// <summary>
        /// Get current build size metrics
        /// </summary>
        public BuildSizeMetrics GetCurrentMetrics()
        {
            return currentMetrics;
        }

        /// <summary>
        /// Get optimization recommendations
        /// </summary>
        public List<OptimizationRecommendation> GetRecommendations()
        {
            return recommendations;
        }

        /// <summary>
        /// Export optimization report
        /// </summary>
        public void ExportOptimizationReport()
        {
            buildAnalyzer.ExportReport(currentMetrics, recommendations);
        }

        #endregion

        #region Optimization Pipeline

        private IEnumerator RunFullOptimization()
        {
            Debug.Log("[BuildSizeOptimizer] Starting comprehensive optimization...");

            float startTime = Time.time;
            long initialSize = GetEstimatedBuildSize();

            // Phase 1: Asset Optimization
            if (enableAssetOptimization)
            {
                yield return StartCoroutine(RunAssetOptimization());
            }

            // Phase 2: Code Optimization
            if (enableCodeOptimization)
            {
                yield return StartCoroutine(RunCodeOptimization());
            }

            // Phase 3: Platform-Specific Optimization
            yield return StartCoroutine(RunPlatformOptimization());

            // Phase 4: Quality Assurance
            yield return StartCoroutine(RunQualityAssurance());

            // Final Analysis
            yield return StartCoroutine(FinalizeOptimization());

            float duration = Time.time - startTime;
            long finalSize = GetEstimatedBuildSize();
            float reductionPercent = initialSize > 0 ? (1f - (float)finalSize / initialSize) * 100f : 0f;

            var complete = new OptimizationComplete
            {
                success = true,
                initialSize = initialSize,
                finalSize = finalSize,
                reductionPercent = reductionPercent,
                duration = duration,
                targetAchieved = finalSize <= targetSizeMB * 1024 * 1024
            };

            OnOptimizationComplete?.Invoke(complete);
            Debug.Log($"[BuildSizeOptimizer] Optimization complete! Size reduction: {reductionPercent:F1}% ({initialSize / (1024f * 1024f):F1}MB → {finalSize / (1024f * 1024f):F1}MB)");
        }

        private IEnumerator RunAssetOptimization()
        {
            Debug.Log("[BuildSizeOptimizer] Running asset optimization...");

            var progress = new BuildSizeMetrics { phase = OptimizationPhase.AssetOptimization };
            OnOptimizationProgress?.Invoke(progress);

            yield return StartCoroutine(assetPipeline.OptimizeAllAssets());

            // Update metrics after asset optimization
            currentMetrics.textureMemorySaved = assetPipeline.GetTextureMemorySaved();
            currentMetrics.audioMemorySaved = assetPipeline.GetAudioMemorySaved();
            currentMetrics.meshMemorySaved = assetPipeline.GetMeshMemorySaved();

            yield return null;
        }

        private IEnumerator RunCodeOptimization()
        {
            Debug.Log("[BuildSizeOptimizer] Running code optimization...");

            var progress = new BuildSizeMetrics { phase = OptimizationPhase.CodeOptimization };
            OnOptimizationProgress?.Invoke(progress);

            yield return StartCoroutine(codeOptimizer.OptimizeCode());

            // Update metrics after code optimization
            currentMetrics.deadCodeEliminated = codeOptimizer.GetDeadCodeEliminated();
            currentMetrics.methodsStripped = codeOptimizer.GetMethodsStripped();

            yield return null;
        }

        private IEnumerator RunPlatformOptimization()
        {
            Debug.Log("[BuildSizeOptimizer] Running platform-specific optimization...");

            var progress = new BuildSizeMetrics { phase = OptimizationPhase.PlatformOptimization };
            OnOptimizationProgress?.Invoke(progress);

            yield return StartCoroutine(platformOptimizer.OptimizeForPlatform());

            yield return null;
        }

        private IEnumerator RunQualityAssurance()
        {
            Debug.Log("[BuildSizeOptimizer] Running quality assurance validation...");

            var progress = new BuildSizeMetrics { phase = OptimizationPhase.QualityAssurance };
            OnOptimizationProgress?.Invoke(progress);

            bool qualityMaintained = yield return qaValidator.ValidateQuality();

            if (!qualityMaintained)
            {
                Debug.LogWarning("[BuildSizeOptimizer] Quality validation failed - some optimizations may need adjustment");
            }

            yield return null;
        }

        private IEnumerator FinalizeOptimization()
        {
            Debug.Log("[BuildSizeOptimizer] Finalizing optimization...");

            // Generate final metrics
            currentMetrics = new BuildSizeMetrics
            {
                phase = OptimizationPhase.Complete,
                timestamp = DateTime.UtcNow,
                estimatedBuildSize = GetEstimatedBuildSize(),
                targetSize = targetSizeMB * 1024 * 1024,
                compressionRatio = CalculateCompressionRatio()
            };

            // Generate recommendations
            recommendations = GenerateRecommendations();

            // Check size warnings
            CheckSizeWarnings();

            yield return null;
        }

        #endregion

        #region Analysis Methods

        private long GetEstimatedBuildSize()
        {
            // This would integrate with Unity's build reporting system
            // For now, return a placeholder based on asset analysis
            return assetPipeline?.GetEstimatedSizeReduction() ?? 0;
        }

        private float CalculateCompressionRatio()
        {
            long originalSize = GetEstimatedBuildSize() + GetTotalSizeReduction();
            long finalSize = GetEstimatedBuildSize();

            return originalSize > 0 ? (float)finalSize / originalSize : 1f;
        }

        private long GetTotalSizeReduction()
        {
            return (currentMetrics.textureMemorySaved +
                   currentMetrics.audioMemorySaved +
                   currentMetrics.meshMemorySaved);
        }

        private void CheckSizeWarnings()
        {
            long currentSize = currentMetrics.estimatedBuildSize;

            if (currentSize > targetSizeMB * 1024 * 1024)
            {
                var warning = new SizeWarning
                {
                    type = SizeWarningType.ExceedsTarget,
                    severity = currentSize > targetSizeMB * 1024 * 1024 * 1.1f ? Severity.Critical : Severity.Warning,
                    message = $"Build size ({currentSize / (1024f * 1024f):F1}MB) exceeds target ({targetSizeMB}MB)",
                    timestamp = DateTime.UtcNow
                };
                OnSizeWarning?.Invoke(warning);
            }
        }

        private List<OptimizationRecommendation> GenerateRecommendations()
        {
            var recs = new List<OptimizationRecommendation>();

            // Analyze current metrics and suggest improvements
            if (currentMetrics.estimatedBuildSize > targetSizeMB * 1024 * 1024)
            {
                recs.Add(new OptimizationRecommendation
                {
                    type = RecommendationType.SizeReduction,
                    priority = Priority.High,
                    description = "Enable aggressive texture compression to meet size targets",
                    estimatedSavings = currentMetrics.textureMemorySaved * 0.3f
                });
            }

            if (currentMetrics.deadCodeEliminated < 1000)
            {
                recs.Add(new OptimizationRecommendation
                {
                    type = RecommendationType.CodeOptimization,
                    priority = Priority.Medium,
                    description = "Configure Link.xml to strip unused code",
                    estimatedSavings = 500 * 1024 // ~500KB
                });
            }

            return recs;
        }

        private IEnumerator AnalyzeCurrentBuild()
        {
            Debug.Log("[BuildSizeOptimizer] Analyzing current build size...");

            // Analyze existing assets
            yield return StartCoroutine(AnalyzeAssetSizes());

            // Generate initial recommendations
            recommendations = GenerateRecommendations();

            Debug.Log($"[BuildSizeOptimizer] Build analysis complete. Current size: {GetEstimatedBuildSize() / (1024f * 1024f):F1}MB");
        }

        private IEnumerator AnalyzeAssetSizes()
        {
            // Analyze texture sizes
            var textures = Resources.FindObjectsOfTypeAll<Texture2D>();
            foreach (var texture in textures)
            {
                string path = AssetDatabase.GetAssetPath(texture);
                if (!string.IsNullOrEmpty(path))
                {
                    long size = CalculateTextureSize(texture);
                    assetSizeMap[path] = size;
                }
            }

            yield return null;
        }

        private long CalculateTextureSize(Texture2D texture)
        {
            // Calculate estimated size based on texture properties
            return (long)texture.width * texture.height * GetBytesPerPixel(texture.format);
        }

        private int GetBytesPerPixel(TextureFormat format)
        {
            // Return bytes per pixel based on texture format
            switch (format)
            {
                case TextureFormat.RGBA32: return 4;
                case TextureFormat.RGB24: return 3;
                case TextureFormat.RGBA4444: return 2;
                case TextureFormat.R8: return 1;
                default: return 4;
            }
        }

        #endregion
    }

    #region Data Structures

    [System.Serializable]
    public struct BuildSizeMetrics
    {
        public OptimizationPhase phase;
        public DateTime timestamp;
        public long estimatedBuildSize;
        public long targetSize;
        public float compressionRatio;
        public long textureMemorySaved;
        public long audioMemorySaved;
        public long meshMemorySaved;
        public int deadCodeEliminated;
        public int methodsStripped;
    }

    [System.Serializable]
    public struct OptimizationComplete
    {
        public bool success;
        public long initialSize;
        public long finalSize;
        public float reductionPercent;
        public float duration;
        public bool targetAchieved;
    }

    [System.Serializable]
    public struct SizeWarning
    {
        public SizeWarningType type;
        public Severity severity;
        public string message;
        public DateTime timestamp;
    }

    [System.Serializable]
    public struct OptimizationRecommendation
    {
        public RecommendationType type;
        public Priority priority;
        public string description;
        public float estimatedSavings;
    }

    public enum OptimizationPhase { None, AssetOptimization, CodeOptimization, PlatformOptimization, QualityAssurance, Complete }
    public enum SizeWarningType { ExceedsTarget, QualityDegradation, PerformanceImpact }
    public enum RecommendationType { SizeReduction, CodeOptimization, AssetOptimization, PlatformOptimization }
    public enum Priority { Low, Medium, High, Critical }
    public enum Severity { Info, Warning, Critical }

    #endregion
}