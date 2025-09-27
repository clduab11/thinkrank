using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using UnityEngine;
using UnityEditor;

namespace ThinkRank.Performance
{
    /// <summary>
    /// Comprehensive build analysis and reporting system for mobile optimization
    /// Provides detailed insights into build size, asset distribution, and optimization recommendations
    /// </summary>
    public class BuildAnalysisReporter
    {
        [Header("Reporting Configuration")]
        [SerializeField] private bool enableDetailedReporting = true;
        [SerializeField] private bool enableSizeTracking = true;
        [SerializeField] private bool enablePerformanceMonitoring = true;

        [Header("Report Settings")]
        [SerializeField] private string reportDirectory = "BuildReports";
        [SerializeField] private bool generateHTMLReports = true;
        [SerializeField] private bool generateJSONReports = true;

        private BuildSizeMetrics currentMetrics;
        private Dictionary<string, AssetSizeInfo> assetSizeDatabase;
        private List<BuildReportEntry> buildHistory;
        private PlatformOptimizationData platformData;

        public BuildAnalysisReporter()
        {
            assetSizeDatabase = new Dictionary<string, AssetSizeInfo>();
            buildHistory = new List<BuildReportEntry>();
            platformData = new PlatformOptimizationData();
        }

        /// <summary>
        /// Generate comprehensive build analysis report
        /// </summary>
        public void GenerateAnalysisReport(BuildSizeMetrics metrics, List<OptimizationRecommendation> recommendations)
        {
            currentMetrics = metrics;

            // Update asset database
            UpdateAssetSizeDatabase();

            // Generate reports in multiple formats
            if (generateJSONReports)
            {
                GenerateJSONReport(metrics, recommendations);
            }

            if (generateHTMLReports)
            {
                GenerateHTMLReport(metrics, recommendations);
            }

            // Update build history
            AddToBuildHistory(metrics);

            // Generate platform-specific analysis
            GeneratePlatformAnalysis();

            Debug.Log($"[BuildAnalysisReporter] Analysis report generated. Total size: {metrics.estimatedBuildSize / (1024f * 1024f):F1}MB");
        }

        /// <summary>
        /// Export optimization report with detailed metrics
        /// </summary>
        public void ExportReport(BuildSizeMetrics metrics, List<OptimizationRecommendation> recommendations)
        {
            string timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
            string basePath = Path.Combine(Application.dataPath, $"../{reportDirectory}");

            if (!Directory.Exists(basePath))
            {
                Directory.CreateDirectory(basePath);
            }

            // Export comprehensive report
            var report = new ComprehensiveBuildReport
            {
                timestamp = DateTime.Now,
                metrics = metrics,
                recommendations = recommendations,
                assetBreakdown = GenerateAssetBreakdown(),
                platformAnalysis = GeneratePlatformAnalysis(),
                optimizationHistory = buildHistory.Take(10).ToList(),
                sizeTargets = new SizeTargets
                {
                    cellularLimit = 150 * 1024 * 1024, // 150MB
                    targetSize = 100 * 1024 * 1024,    // 100MB target
                    minimumSize = 50 * 1024 * 1024     // 50MB minimum
                }
            };

            string jsonReport = JsonUtility.ToJson(report, true);
            string reportPath = Path.Combine(basePath, $"BuildReport_{timestamp}.json");
            File.WriteAllText(reportPath, jsonReport);

            Debug.Log($"[BuildAnalysisReporter] Comprehensive report exported to: {reportPath}");
        }

        private void GenerateJSONReport(BuildSizeMetrics metrics, List<OptimizationRecommendation> recommendations)
        {
            var jsonReport = new BuildReportJSON
            {
                metadata = new ReportMetadata
                {
                    generatedAt = DateTime.Now,
                    unityVersion = Application.unityVersion,
                    platform = GetCurrentPlatform(),
                    reportVersion = "1.0"
                },
                summary = new BuildSummary
                {
                    totalSize = metrics.estimatedBuildSize,
                    targetSize = metrics.targetSize,
                    compressionRatio = metrics.compressionRatio,
                    sizeReduction = CalculateTotalSizeReduction(metrics)
                },
                optimizations = recommendations.Select(r => new OptimizationJSON
                {
                    type = r.type.ToString(),
                    priority = r.priority.ToString(),
                    description = r.description,
                    estimatedSavings = r.estimatedSavings
                }).ToList(),
                assets = assetSizeDatabase.Values.Select(a => new AssetInfoJSON
                {
                    path = a.path,
                    type = a.type.ToString(),
                    originalSize = a.originalSize,
                    optimizedSize = a.optimizedSize,
                    compressionRatio = a.compressionRatio
                }).ToList()
            };

            string jsonPath = Path.Combine(Application.dataPath, $"../{reportDirectory}/build_analysis_{DateTime.Now:yyyyMMdd_HHmmss}.json");
            string jsonContent = JsonUtility.ToJson(jsonReport, true);
            File.WriteAllText(jsonPath, jsonContent);

            Debug.Log($"[BuildAnalysisReporter] JSON report generated: {jsonPath}");
        }

        private void GenerateHTMLReport(BuildSizeMetrics metrics, List<OptimizationRecommendation> recommendations)
        {
            StringBuilder html = new StringBuilder();

            html.AppendLine("<!DOCTYPE html>");
            html.AppendLine("<html><head><title>Build Size Analysis Report</title>");
            html.AppendLine("<style>");
            html.AppendLine("body { font-family: Arial, sans-serif; margin: 40px; }");
            html.AppendLine("h1, h2 { color: #333; }");
            html.AppendLine(".metric { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; }");
            html.AppendLine(".warning { background: #ffebee; border-left: 4px solid #f44336; }");
            html.AppendLine(".success { background: #e8f5e8; border-left: 4px solid #4caf50; }");
            html.AppendLine(".chart { width: 100%; height: 300px; background: #f9f9f9; margin: 20px 0; }");
            html.AppendLine("</style>");
            html.AppendLine("</head><body>");

            html.AppendLine($"<h1>Build Size Analysis Report</h1>");
            html.AppendLine($"<p><strong>Generated:</strong> {DateTime.Now}</p>");
            html.AppendLine($"<p><strong>Platform:</strong> {GetCurrentPlatform()}</p>");
            html.AppendLine($"<p><strong>Unity Version:</strong> {Application.unityVersion}</p>");

            // Summary section
            html.AppendLine("<h2>Summary</h2>");
            html.AppendLine($"<div class='metric {(metrics.estimatedBuildSize > metrics.targetSize ? "warning" : "success")}'>");
            html.AppendLine($"<strong>Total Size:</strong> {metrics.estimatedBuildSize / (1024f * 1024f):F1}MB");
            html.AppendLine($"<br><strong>Target Size:</strong> {metrics.targetSize / (1024f * 1024f):F1}MB");
            html.AppendLine($"<br><strong>Compression Ratio:</strong> {metrics.compressionRatio:P}");
            html.AppendLine("</div>");

            // Asset breakdown
            html.AppendLine("<h2>Asset Breakdown</h2>");
            html.AppendLine("<div class='chart'>");
            html.AppendLine("<!-- Chart would be generated here -->");
            html.AppendLine("<p>Asset breakdown visualization would be implemented here</p>");
            html.AppendLine("</div>");

            // Recommendations
            html.AppendLine("<h2>Recommendations</h2>");
            foreach (var rec in recommendations)
            {
                html.AppendLine($"<div class='metric'>");
                html.AppendLine($"<strong>{rec.priority}:</strong> {rec.description}");
                html.AppendLine($"<br><em>Estimated Savings: {rec.estimatedSavings / 1024f:F1}KB</em>");
                html.AppendLine("</div>");
            }

            html.AppendLine("</body></html>");

            string htmlPath = Path.Combine(Application.dataPath, $"../{reportDirectory}/build_analysis_{DateTime.Now:yyyyMMdd_HHmmss}.html");
            File.WriteAllText(htmlPath, html.ToString());

            Debug.Log($"[BuildAnalysisReporter] HTML report generated: {htmlPath}");
        }

        private void UpdateAssetSizeDatabase()
        {
            // Analyze current assets and update database
            var allAssets = AssetDatabase.FindAssets("", new[] { "Assets" });

            foreach (string guid in allAssets)
            {
                string path = AssetDatabase.GUIDToAssetPath(guid);
                if (string.IsNullOrEmpty(path) || path.Contains("Editor"))
                    continue;

                var assetInfo = new AssetSizeInfo
                {
                    path = path,
                    type = DetermineAssetType(path),
                    originalSize = GetAssetSize(path),
                    optimizedSize = GetAssetSize(path), // Would be updated after optimization
                    compressionRatio = 1.0f
                };

                assetSizeDatabase[path] = assetInfo;
            }
        }

        private AssetType DetermineAssetType(string path)
        {
            string extension = Path.GetExtension(path).ToLower();

            switch (extension)
            {
                case ".png":
                case ".jpg":
                case ".jpeg":
                case ".tga":
                    return AssetType.Texture;
                case ".wav":
                case ".mp3":
                case ".ogg":
                    return AssetType.Audio;
                case ".fbx":
                case ".obj":
                case ".dae":
                    return AssetType.Mesh;
                case ".unity":
                    return AssetType.Scene;
                case ".prefab":
                    return AssetType.Prefab;
                case ".mat":
                    return AssetType.Material;
                case ".shader":
                    return AssetType.Shader;
                default:
                    return AssetType.Other;
            }
        }

        private long GetAssetSize(string path)
        {
            try
            {
                FileInfo fileInfo = new FileInfo(path);
                return fileInfo.Length;
            }
            catch
            {
                return 0;
            }
        }

        private Dictionary<AssetType, long> GenerateAssetBreakdown()
        {
            var breakdown = new Dictionary<AssetType, long>();

            foreach (var asset in assetSizeDatabase.Values)
            {
                if (!breakdown.ContainsKey(asset.type))
                    breakdown[asset.type] = 0;

                breakdown[asset.type] += asset.optimizedSize;
            }

            return breakdown;
        }

        private PlatformAnalysis GeneratePlatformAnalysis()
        {
            return new PlatformAnalysis
            {
                platform = GetCurrentPlatform(),
                il2cppEnabled = true,
                strippingEnabled = true,
                compressionEnabled = true,
                platformSpecificOptimizations = GetPlatformSpecificOptimizations()
            };
        }

        private List<string> GetPlatformSpecificOptimizations()
        {
            var optimizations = new List<string>();

#if UNITY_ANDROID
            optimizations.Add("ASTC Texture Compression");
            optimizations.Add("ETC2 Fallback Support");
            optimizations.Add("Android App Bundle");
            optimizations.Add("Play Asset Delivery");
#elif UNITY_IOS
            optimizations.Add("PVRTC Texture Compression");
            optimizations.Add("iOS App Slicing");
            optimizations.Add("On-Demand Resources");
            optimizations.Add("App Thinning");
#endif

            return optimizations;
        }

        private void AddToBuildHistory(BuildSizeMetrics metrics)
        {
            var entry = new BuildReportEntry
            {
                timestamp = DateTime.Now,
                buildSize = metrics.estimatedBuildSize,
                platform = GetCurrentPlatform(),
                unityVersion = Application.unityVersion,
                optimizationPhase = metrics.phase
            };

            buildHistory.Add(entry);

            // Keep only last 50 entries
            if (buildHistory.Count > 50)
            {
                buildHistory.RemoveRange(0, buildHistory.Count - 50);
            }
        }

        private long CalculateTotalSizeReduction(BuildSizeMetrics metrics)
        {
            return (metrics.textureMemorySaved +
                   metrics.audioMemorySaved +
                   metrics.meshMemorySaved);
        }

        private string GetCurrentPlatform()
        {
#if UNITY_ANDROID
            return "Android";
#elif UNITY_IOS
            return "iOS";
#else
            return "Standalone";
#endif
        }

        #region Public Interface

        /// <summary>
        /// Get asset size information for a specific asset
        /// </summary>
        public AssetSizeInfo GetAssetInfo(string assetPath)
        {
            return assetSizeDatabase.ContainsKey(assetPath) ? assetSizeDatabase[assetPath] : null;
        }

        /// <summary>
        /// Get build history
        /// </summary>
        public BuildReportEntry[] GetBuildHistory()
        {
            return buildHistory.ToArray();
        }

        /// <summary>
        /// Compare current build with previous builds
        /// </summary>
        public BuildComparison CompareWithPreviousBuilds()
        {
            if (buildHistory.Count < 2)
                return null;

            var current = buildHistory.Last();
            var previous = buildHistory[buildHistory.Count - 2];

            return new BuildComparison
            {
                currentBuild = current,
                previousBuild = previous,
                sizeDifference = current.buildSize - previous.buildSize,
                percentChange = previous.buildSize > 0 ? (float)(current.buildSize - previous.buildSize) / previous.buildSize : 0
            };
        }

        #endregion
    }

    #region Data Structures

    [System.Serializable]
    public struct AssetSizeInfo
    {
        public string path;
        public AssetType type;
        public long originalSize;
        public long optimizedSize;
        public float compressionRatio;
    }

    [System.Serializable]
    public struct BuildReportEntry
    {
        public DateTime timestamp;
        public long buildSize;
        public string platform;
        public string unityVersion;
        public OptimizationPhase optimizationPhase;
    }

    [System.Serializable]
    public struct ComprehensiveBuildReport
    {
        public DateTime timestamp;
        public BuildSizeMetrics metrics;
        public List<OptimizationRecommendation> recommendations;
        public Dictionary<AssetType, long> assetBreakdown;
        public PlatformAnalysis platformAnalysis;
        public List<BuildReportEntry> optimizationHistory;
        public SizeTargets sizeTargets;
    }

    [System.Serializable]
    public struct SizeTargets
    {
        public long cellularLimit;
        public long targetSize;
        public long minimumSize;
    }

    [System.Serializable]
    public struct PlatformAnalysis
    {
        public string platform;
        public bool il2cppEnabled;
        public bool strippingEnabled;
        public bool compressionEnabled;
        public List<string> platformSpecificOptimizations;
    }

    [System.Serializable]
    public struct BuildComparison
    {
        public BuildReportEntry currentBuild;
        public BuildReportEntry previousBuild;
        public long sizeDifference;
        public float percentChange;
    }

    [System.Serializable]
    public struct ReportMetadata
    {
        public DateTime generatedAt;
        public string unityVersion;
        public string platform;
        public string reportVersion;
    }

    [System.Serializable]
    public struct BuildSummary
    {
        public long totalSize;
        public long targetSize;
        public float compressionRatio;
        public long sizeReduction;
    }

    [System.Serializable]
    public struct OptimizationJSON
    {
        public string type;
        public string priority;
        public string description;
        public float estimatedSavings;
    }

    [System.Serializable]
    public struct AssetInfoJSON
    {
        public string path;
        public string type;
        public long originalSize;
        public long optimizedSize;
        public float compressionRatio;
    }

    [System.Serializable]
    public struct BuildReportJSON
    {
        public ReportMetadata metadata;
        public BuildSummary summary;
        public List<OptimizationJSON> optimizations;
        public List<AssetInfoJSON> assets;
    }

    #endregion
}