using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Profiling;
using ThinkRank.Core;

namespace ThinkRank.Performance
{
    /// <summary>
    /// Manages performance monitoring, optimization, and frame rate tracking for mobile devices
    /// Ensures 60fps target is maintained and provides adaptive quality settings
    /// </summary>
    public class PerformanceManager : MonoBehaviour
    {
        [Header("Performance Configuration")]
        [SerializeField] private GameConfiguration gameConfig;
        [SerializeField] private bool enableDetailedProfiling = false;

        // Frame rate tracking
        private Queue<float> frameTimeQueue = new Queue<float>();
        private const int maxFrameSamples = 60;
        private float lastFrameTime;

        // Performance metrics
        private float currentFPS;
        private float averageFPS;
        private long currentMemoryUsage;
        private long peakMemoryUsage;
        private int droppedFrameCount;
        private float lastPerformanceCheck;

        // Quality management
        private int currentQualityLevel;
        private bool adaptiveQualityEnabled = true;
        private float lastQualityAdjustment;
        private const float qualityAdjustmentCooldown = 5f;

        // Performance thresholds
        private const float targetFrameTime = 1f / 60f; // 60 FPS
        private const float criticalFrameTime = 1f / 30f; // 30 FPS
        private const long memoryWarningThreshold = 1024L * 1024L * 1024L; // 1GB
        private const long memoryCriticalThreshold = 1536L * 1024L * 1024L; // 1.5GB

        // Bottleneck detection
        private Queue<FrameAnalysis> frameAnalysisQueue = new Queue<FrameAnalysis>();
        private const int bottleneckAnalysisFrames = 300; // 5 seconds at 60fps
        private BottleneckAnalysis currentBottleneckAnalysis;
        private float lastBottleneckCheck;
        private const float bottleneckCheckInterval = 5f;

        // Events
        public static event Action<PerformanceData> OnPerformanceUpdate;
        public static event Action<PerformanceWarning> OnPerformanceWarning;
        public static event Action<int> OnQualityLevelChanged;

        // Properties
        public float CurrentFPS => currentFPS;
        public float AverageFPS => averageFPS;
        public long CurrentMemoryUsage => currentMemoryUsage;
        public bool IsPerformanceOptimal => currentFPS >= (gameConfig.targetFrameRate * 0.9f);
        public PerformanceLevel CurrentPerformanceLevel => GetCurrentPerformanceLevel();

        /// <summary>
        /// Initialize the Performance Manager
        /// </summary>
        public void Initialize(bool enableMonitoring = true)
        {
            Debug.Log("[PerformanceManager] Initializing Performance Manager...");

            // Set initial quality level
            currentQualityLevel = QualitySettings.GetQualityLevel();

            // Configure performance settings
            ConfigurePerformanceSettings();

            if (enableMonitoring)
            {
                // Start performance monitoring
                StartCoroutine(MonitorPerformance());
                StartCoroutine(MonitorMemoryUsage());

                // Enable profiler if configured
                if (enableDetailedProfiling && Debug.isDebugBuild)
                {
                    Profiler.enabled = true;
                    Profiler.enableBinaryLog = true;
                }
            }

            Debug.Log($"[PerformanceManager] Initialized - Target FPS: {gameConfig.targetFrameRate}");
        }

        #region Performance Monitoring

        /// <summary>
        /// Monitor frame rate and performance metrics
        /// </summary>
        private IEnumerator MonitorPerformance()
        {
            while (true)
            {
                yield return new WaitForEndOfFrame();

                // Calculate frame time and FPS
                float frameTime = Time.unscaledDeltaTime;
                UpdateFrameRateMetrics(frameTime);

                // Analyze frame for bottleneck detection
                AnalyzeFrameBottlenecks(frameTime);

                // Check for performance issues
                CheckPerformanceThresholds(frameTime);

                // Update performance data every second
                if (Time.unscaledTime - lastPerformanceCheck >= 1f)
                {
                    UpdatePerformanceData();
                    lastPerformanceCheck = Time.unscaledTime;
                }

                // Adaptive quality adjustment
                if (adaptiveQualityEnabled && gameConfig.adaptiveQuality)
                {
                    CheckAndAdjustQuality();
                }
            }
        }

        /// <summary>
        /// Update frame rate metrics
        /// </summary>
        private void UpdateFrameRateMetrics(float frameTime)
        {
            // Add frame time to queue
            frameTimeQueue.Enqueue(frameTime);

            // Maintain queue size
            if (frameTimeQueue.Count > maxFrameSamples)
            {
                frameTimeQueue.Dequeue();
            }

            // Calculate current FPS
            currentFPS = 1f / frameTime;

            // Calculate average FPS
            if (frameTimeQueue.Count > 0)
            {
                float totalFrameTime = 0f;
                foreach (float time in frameTimeQueue)
                {
                    totalFrameTime += time;
                }
                averageFPS = frameTimeQueue.Count / totalFrameTime;
            }

            // Track dropped frames
            if (frameTime > targetFrameTime * 1.5f) // 50% above target
            {
                droppedFrameCount++;
            }

            lastFrameTime = frameTime;
        }

        /// <summary>
        /// Check performance thresholds and trigger warnings
        /// </summary>
        private void CheckPerformanceThresholds(float frameTime)
        {
            // Check for critical frame time
            if (frameTime > criticalFrameTime)
            {
                OnPerformanceWarning?.Invoke(new PerformanceWarning
                {
                    type = PerformanceWarningType.LowFrameRate,
                    message = $"Frame time exceeded critical threshold: {frameTime:F3}s",
                    severity = WarningLevel.Critical,
                    timestamp = DateTime.UtcNow
                });
            }
            // Check for warning frame time
            else if (frameTime > targetFrameTime * 1.3f) // 30% above target
            {
                OnPerformanceWarning?.Invoke(new PerformanceWarning
                {
                    type = PerformanceWarningType.FrameTimeHigh,
                    message = $"Frame time above target: {frameTime:F3}s",
                    severity = WarningLevel.Warning,
                    timestamp = DateTime.UtcNow
                });
            }
        }

        /// <summary>
        /// Update performance data and broadcast to listeners
        /// </summary>
        private void UpdatePerformanceData()
        {
            var performanceData = new PerformanceData
            {
                currentFPS = currentFPS,
                averageFPS = averageFPS,
                frameTime = lastFrameTime,
                memoryUsage = currentMemoryUsage,
                droppedFrames = droppedFrameCount,
                qualityLevel = currentQualityLevel,
                performanceLevel = CurrentPerformanceLevel,
                timestamp = DateTime.UtcNow
            };

            OnPerformanceUpdate?.Invoke(performanceData);

            // Reset dropped frame counter
            droppedFrameCount = 0;
        }

        #endregion

        #region Memory Monitoring

        /// <summary>
        /// Monitor memory usage and garbage collection
        /// </summary>
        private IEnumerator MonitorMemoryUsage()
        {
            while (true)
            {
                yield return new WaitForSeconds(2f); // Check every 2 seconds

                // Get current memory usage
                currentMemoryUsage = Profiler.GetTotalAllocatedMemory(false);

                // Track peak memory usage
                if (currentMemoryUsage > peakMemoryUsage)
                {
                    peakMemoryUsage = currentMemoryUsage;
                }

                // Check memory thresholds
                CheckMemoryThresholds();
            }
        }

        /// <summary>
        /// Check memory usage thresholds and trigger warnings
        /// </summary>
        private void CheckMemoryThresholds()
        {
            if (currentMemoryUsage > memoryCriticalThreshold)
            {
                OnPerformanceWarning?.Invoke(new PerformanceWarning
                {
                    type = PerformanceWarningType.HighMemoryUsage,
                    message = $"Critical memory usage: {currentMemoryUsage / (1024 * 1024)}MB",
                    severity = WarningLevel.Critical,
                    timestamp = DateTime.UtcNow
                });

                // Force garbage collection
                ForceGarbageCollection();
            }
            else if (currentMemoryUsage > memoryWarningThreshold)
            {
                OnPerformanceWarning?.Invoke(new PerformanceWarning
                {
                    type = PerformanceWarningType.HighMemoryUsage,
                    message = $"High memory usage: {currentMemoryUsage / (1024 * 1024)}MB",
                    severity = WarningLevel.Warning,
                    timestamp = DateTime.UtcNow
                });
            }
        }

        /// <summary>
        /// Force garbage collection to free memory
        /// </summary>
        public void ForceGarbageCollection()
        {
            Debug.Log("[PerformanceManager] Forcing garbage collection...");
            GC.Collect();
            GC.WaitForPendingFinalizers();
            GC.Collect();
        }

        #endregion

        #region Quality Management

        /// <summary>
        /// Check and adjust quality settings based on performance
        /// </summary>
        private void CheckAndAdjustQuality()
        {
            if (Time.unscaledTime - lastQualityAdjustment < qualityAdjustmentCooldown)
                return;

            PerformanceLevel currentLevel = GetCurrentPerformanceLevel();

            switch (currentLevel)
            {
                case PerformanceLevel.Critical:
                    // Reduce quality significantly
                    if (currentQualityLevel > 0)
                    {
                        SetQualityLevel(Math.Max(0, currentQualityLevel - 2));
                    }
                    break;

                case PerformanceLevel.Poor:
                    // Reduce quality slightly
                    if (currentQualityLevel > 0)
                    {
                        SetQualityLevel(currentQualityLevel - 1);
                    }
                    break;

                case PerformanceLevel.Excellent:
                    // Increase quality if we have headroom
                    if (currentQualityLevel < QualitySettings.names.Length - 1)
                    {
                        SetQualityLevel(currentQualityLevel + 1);
                    }
                    break;
            }
        }

        /// <summary>
        /// Set quality level with optimization
        /// </summary>
        public void SetQualityLevel(int level)
        {
            level = Mathf.Clamp(level, 0, QualitySettings.names.Length - 1);

            if (level != currentQualityLevel)
            {
                currentQualityLevel = level;
                QualitySettings.SetQualityLevel(level, true);

                // Apply additional mobile optimizations
                ApplyMobileOptimizations();

                lastQualityAdjustment = Time.unscaledTime;
                OnQualityLevelChanged?.Invoke(level);

                Debug.Log($"[PerformanceManager] Quality level changed to: {QualitySettings.names[level]}");
            }
        }

        /// <summary>
        /// Apply mobile-specific optimizations
        /// </summary>
        private void ApplyMobileOptimizations()
        {
            if (gameConfig.ShouldUseLowEndOptimizations())
            {
                // Low-end device optimizations
                QualitySettings.shadowDistance = 20f;
                QualitySettings.shadows = ShadowQuality.Disable;
                QualitySettings.antiAliasing = 0;
                QualitySettings.anisotropicFiltering = AnisotropicFiltering.Disable;

                // Reduce render scale
                float renderScale = gameConfig.GetRecommendedRenderScale();
                // Note: This would need to be applied to the camera or render pipeline
            }
            else
            {
                // Mid to high-end device settings
                QualitySettings.shadowDistance = 50f;
                QualitySettings.shadows = ShadowQuality.HardOnly;
                QualitySettings.antiAliasing = 2;
                QualitySettings.anisotropicFiltering = AnisotropicFiltering.Enable;
            }
        }

        #endregion

        #region Performance Configuration

        /// <summary>
        /// Configure initial performance settings
        /// </summary>
        private void ConfigurePerformanceSettings()
        {
            // Set target frame rate
            Application.targetFrameRate = gameConfig.targetFrameRate;

            // Configure VSync
            QualitySettings.vSyncCount = 0; // Disable VSync for mobile

            // Configure rendering settings
            if (Application.isMobilePlatform)
            {
                // Mobile-specific settings
                Screen.sleepTimeout = SleepTimeout.NeverSleep;

                // Set appropriate quality level for device
                int recommendedQuality = GetRecommendedQualityLevel();
                SetQualityLevel(recommendedQuality);
            }

            // Configure profiler settings
            if (enableDetailedProfiling)
            {
                Profiler.SetAreaEnabled(ProfilerArea.CPU, true);
                Profiler.SetAreaEnabled(ProfilerArea.Memory, true);
                Profiler.SetAreaEnabled(ProfilerArea.Rendering, true);
            }
        }

        /// <summary>
        /// Get recommended quality level based on device capabilities
        /// </summary>
        private int GetRecommendedQualityLevel()
        {
            // Analyze device capabilities
            int memoryMB = SystemInfo.systemMemorySize;
            int graphicsMemoryMB = SystemInfo.graphicsMemorySize;
            int processorFrequency = SystemInfo.processorFrequency;

            // Simple heuristic for quality level
            if (memoryMB >= 6000 && graphicsMemoryMB >= 2000 && processorFrequency >= 2500)
            {
                return QualitySettings.names.Length - 1; // Highest quality
            }
            else if (memoryMB >= 4000 && graphicsMemoryMB >= 1000 && processorFrequency >= 2000)
            {
                return QualitySettings.names.Length - 2; // High quality
            }
            else if (memoryMB >= 3000 && processorFrequency >= 1500)
            {
                return QualitySettings.names.Length / 2; // Medium quality
            }
            else
            {
                return 0; // Lowest quality
            }
        }

        #endregion

        #region Performance Analysis

        /// <summary>
        /// Get current performance level assessment
        /// </summary>
        private PerformanceLevel GetCurrentPerformanceLevel()
        {
            if (averageFPS >= gameConfig.targetFrameRate * 1.1f) // 10% above target
            {
                return PerformanceLevel.Excellent;
            }
            else if (averageFPS >= gameConfig.targetFrameRate * 0.9f) // Within 10% of target
            {
                return PerformanceLevel.Good;
            }
            else if (averageFPS >= gameConfig.targetFrameRate * 0.7f) // Within 30% of target
            {
                return PerformanceLevel.Fair;
            }
            else if (averageFPS >= 30f) // Above 30 FPS
            {
                return PerformanceLevel.Poor;
            }
            else
            {
                return PerformanceLevel.Critical;
            }
        }

        /// <summary>
        /// Get detailed performance report
        /// </summary>
        public PerformanceReport GetPerformanceReport()
        {
            return new PerformanceReport
            {
                currentFPS = currentFPS,
                averageFPS = averageFPS,
                minFPS = GetMinFPS(),
                maxFPS = GetMaxFPS(),
                frameTimeVariance = GetFrameTimeVariance(),
                memoryUsage = currentMemoryUsage,
                peakMemoryUsage = peakMemoryUsage,
                qualityLevel = currentQualityLevel,
                performanceLevel = CurrentPerformanceLevel,
                totalDroppedFrames = droppedFrameCount,
                deviceInfo = GetDeviceInfo(),
                timestamp = DateTime.UtcNow
            };
        }

        /// <summary>
        /// Get minimum FPS from recent samples
        /// </summary>
        private float GetMinFPS()
        {
            float maxFrameTime = 0f;
            foreach (float frameTime in frameTimeQueue)
            {
                if (frameTime > maxFrameTime)
                    maxFrameTime = frameTime;
            }
            return maxFrameTime > 0 ? 1f / maxFrameTime : 0f;
        }

        /// <summary>
        /// Get maximum FPS from recent samples
        /// </summary>
        private float GetMaxFPS()
        {
            float minFrameTime = float.MaxValue;
            foreach (float frameTime in frameTimeQueue)
            {
                if (frameTime < minFrameTime)
                    minFrameTime = frameTime;
            }
            return minFrameTime < float.MaxValue ? 1f / minFrameTime : 0f;
        }

        /// <summary>
        /// Get frame time variance for stability analysis
        /// </summary>
        private float GetFrameTimeVariance()
        {
            if (frameTimeQueue.Count < 2) return 0f;

            float mean = 0f;
            foreach (float frameTime in frameTimeQueue)
            {
                mean += frameTime;
            }
            mean /= frameTimeQueue.Count;

            float variance = 0f;
            foreach (float frameTime in frameTimeQueue)
            {
                variance += Mathf.Pow(frameTime - mean, 2);
            }
            variance /= frameTimeQueue.Count;

            return variance;
        }

        /// <summary>
        /// Get device information for performance analysis
        /// </summary>
        private DeviceInfo GetDeviceInfo()
        {
            return new DeviceInfo
            {
                deviceModel = SystemInfo.deviceModel,
                deviceName = SystemInfo.deviceName,
                operatingSystem = SystemInfo.operatingSystem,
                processorType = SystemInfo.processorType,
                processorCount = SystemInfo.processorCount,
                processorFrequency = SystemInfo.processorFrequency,
                systemMemorySize = SystemInfo.systemMemorySize,
                graphicsDeviceName = SystemInfo.graphicsDeviceName,
                graphicsMemorySize = SystemInfo.graphicsMemorySize,
                maxTextureSize = SystemInfo.maxTextureSize,
                supportsInstancing = SystemInfo.supportsInstancing
            };
        }

        #endregion

        #region Bottleneck Detection

        /// <summary>
        /// Analyze frame for performance bottlenecks
        /// </summary>
        private void AnalyzeFrameBottlenecks(float frameTime)
        {
            var frameAnalysis = new FrameAnalysis
            {
                frameTime = frameTime,
                timestamp = Time.unscaledTime,
                cpuUsage = GetCPUUsage(),
                gpuUsage = GetGPUUsage(),
                memoryPressure = GetMemoryPressure(),
                drawCalls = UnityEngine.Profiling.Profiler.GetDrawCalls(),
                triangles = UnityEngine.Profiling.Profiler.GetTriangles(),
                vertices = UnityEngine.Profiling.Profiler.GetVertices()
            };

            // Add to analysis queue
            frameAnalysisQueue.Enqueue(frameAnalysis);

            // Maintain queue size
            if (frameAnalysisQueue.Count > bottleneckAnalysisFrames)
            {
                frameAnalysisQueue.Dequeue();
            }

            // Check for bottleneck analysis update
            if (Time.unscaledTime - lastBottleneckCheck > bottleneckCheckInterval)
            {
                UpdateBottleneckAnalysis();
                lastBottleneckCheck = Time.unscaledTime;
            }
        }

        /// <summary>
        /// Update comprehensive bottleneck analysis
        /// </summary>
        private void UpdateBottleneckAnalysis()
        {
            if (frameAnalysisQueue.Count < 30) return; // Need at least 30 frames

            currentBottleneckAnalysis = new BottleneckAnalysis
            {
                analysisPeriod = bottleneckCheckInterval,
                totalFrames = frameAnalysisQueue.Count,
                averageFrameTime = CalculateAverageFrameTime(),
                frameTimeVariance = CalculateFrameTimeVariance(),
                bottleneckType = IdentifyPrimaryBottleneck(),
                bottleneckSeverity = CalculateBottleneckSeverity(),
                recommendations = GenerateOptimizationRecommendations(),
                timestamp = DateTime.UtcNow
            };

            // Trigger bottleneck alert if severe
            if (currentBottleneckAnalysis.bottleneckSeverity >= BottleneckSeverity.High)
            {
                TriggerBottleneckAlert();
            }
        }

        /// <summary>
        /// Calculate average frame time from analysis queue
        /// </summary>
        private float CalculateAverageFrameTime()
        {
            float total = 0f;
            foreach (var analysis in frameAnalysisQueue)
            {
                total += analysis.frameTime;
            }
            return total / frameAnalysisQueue.Count;
        }

        /// <summary>
        /// Calculate frame time variance
        /// </summary>
        private float CalculateFrameTimeVariance()
        {
            float mean = CalculateAverageFrameTime();
            float variance = 0f;

            foreach (var analysis in frameAnalysisQueue)
            {
                variance += Mathf.Pow(analysis.frameTime - mean, 2);
            }
            variance /= frameAnalysisQueue.Count;

            return variance;
        }

        /// <summary>
        /// Identify the primary performance bottleneck
        /// </summary>
        private BottleneckType IdentifyPrimaryBottleneck()
        {
            float avgFrameTime = CalculateAverageFrameTime();
            float avgCPU = CalculateAverageCPUUsage();
            float avgGPU = CalculateAverageGPUUsage();
            float avgMemory = CalculateAverageMemoryPressure();

            // Simple heuristic for bottleneck identification
            if (avgFrameTime > targetFrameTime * 1.5f)
            {
                if (avgCPU > 80f) return BottleneckType.CPU;
                if (avgGPU > 85f) return BottleneckType.GPU;
                if (avgMemory > 0.8f) return BottleneckType.Memory;
                if (GetAverageDrawCalls() > 500) return BottleneckType.DrawCalls;
                if (GetAverageTriangles() > 100000) return BottleneckType.Geometry;
            }

            return BottleneckType.None;
        }

        /// <summary>
        /// Calculate bottleneck severity
        /// </summary>
        private BottleneckSeverity CalculateBottleneckSeverity()
        {
            float avgFrameTime = CalculateAverageFrameTime();
            float variance = currentBottleneckAnalysis?.frameTimeVariance ?? 0f;

            if (avgFrameTime > targetFrameTime * 2f || variance > 0.001f)
                return BottleneckSeverity.Critical;
            else if (avgFrameTime > targetFrameTime * 1.5f)
                return BottleneckSeverity.High;
            else if (avgFrameTime > targetFrameTime * 1.2f)
                return BottleneckSeverity.Medium;
            else
                return BottleneckSeverity.Low;
        }

        /// <summary>
        /// Generate optimization recommendations
        /// </summary>
        private List<string> GenerateOptimizationRecommendations()
        {
            var recommendations = new List<string>();
            var bottleneck = IdentifyPrimaryBottleneck();

            switch (bottleneck)
            {
                case BottleneckType.CPU:
                    recommendations.Add("Reduce script execution time");
                    recommendations.Add("Optimize physics calculations");
                    recommendations.Add("Consider object pooling");
                    break;

                case BottleneckType.GPU:
                    recommendations.Add("Reduce shader complexity");
                    recommendations.Add("Optimize texture sizes");
                    recommendations.Add("Use texture atlasing");
                    break;

                case BottleneckType.Memory:
                    recommendations.Add("Implement object pooling");
                    recommendations.Add("Reduce texture memory usage");
                    recommendations.Add("Unload unused assets");
                    break;

                case BottleneckType.DrawCalls:
                    recommendations.Add("Use batching techniques");
                    recommendations.Add("Combine meshes");
                    recommendations.Add("Reduce material count");
                    break;

                case BottleneckType.Geometry:
                    recommendations.Add("Optimize mesh complexity");
                    recommendations.Add("Use LOD systems");
                    recommendations.Add("Reduce polygon count");
                    break;
            }

            return recommendations;
        }

        /// <summary>
        /// Trigger bottleneck alert
        /// </summary>
        private void TriggerBottleneckAlert()
        {
            if (currentBottleneckAnalysis == null) return;

            OnPerformanceWarning?.Invoke(new PerformanceWarning
            {
                type = PerformanceWarningType.SystemOverload,
                message = $"Performance bottleneck detected: {currentBottleneckAnalysis.bottleneckType} ({currentBottleneckAnalysis.bottleneckSeverity})",
                severity = currentBottleneckAnalysis.bottleneckSeverity >= BottleneckSeverity.Critical ?
                    WarningLevel.Critical : WarningLevel.Warning,
                timestamp = DateTime.UtcNow
            });
        }

        /// <summary>
        /// Get current bottleneck analysis
        /// </summary>
        public BottleneckAnalysis GetCurrentBottleneckAnalysis()
        {
            return currentBottleneckAnalysis;
        }

        // Helper methods for bottleneck analysis
        private float GetCPUUsage() => UnityEngine.Profiling.Profiler.GetTotalAllocatedMemory(false) > 0 ?
            Mathf.Clamp01(UnityEngine.Profiling.Profiler.GetMonoUsedSize() / (float)UnityEngine.Profiling.Profiler.GetMonoHeapSize()) : 0f;

        private float GetGPUUsage() => 0.5f; // Placeholder - would need platform-specific GPU monitoring

        private float GetMemoryPressure() => currentMemoryUsage / (float)memoryCriticalThreshold;

        private float CalculateAverageCPUUsage()
        {
            float total = 0f;
            int count = 0;
            foreach (var analysis in frameAnalysisQueue)
            {
                total += analysis.cpuUsage;
                count++;
            }
            return count > 0 ? total / count : 0f;
        }

        private float CalculateAverageGPUUsage()
        {
            float total = 0f;
            int count = 0;
            foreach (var analysis in frameAnalysisQueue)
            {
                total += analysis.gpuUsage;
                count++;
            }
            return count > 0 ? total / count : 0f;
        }

        private float CalculateAverageMemoryPressure()
        {
            float total = 0f;
            int count = 0;
            foreach (var analysis in frameAnalysisQueue)
            {
                total += analysis.memoryPressure;
                count++;
            }
            return count > 0 ? total / count : 0f;
        }

        private int GetAverageDrawCalls()
        {
            int total = 0;
            foreach (var analysis in frameAnalysisQueue)
            {
                total += analysis.drawCalls;
            }
            return total / frameAnalysisQueue.Count;
        }

        private int GetAverageTriangles()
        {
            int total = 0;
            foreach (var analysis in frameAnalysisQueue)
            {
                total += analysis.triangles;
            }
            return total / frameAnalysisQueue.Count;
        }

        #endregion

        #region Public API

        /// <summary>
        /// Enable or disable adaptive quality
        /// </summary>
        public void SetAdaptiveQuality(bool enabled)
        {
            adaptiveQualityEnabled = enabled;
            Debug.Log($"[PerformanceManager] Adaptive quality: {(enabled ? "Enabled" : "Disabled")}");
        }

        /// <summary>
        /// Manually trigger performance optimization
        /// </summary>
        public void OptimizePerformance()
        {
            Debug.Log("[PerformanceManager] Manual performance optimization triggered");

            // Force garbage collection
            ForceGarbageCollection();

            // Adjust quality if needed
            if (CurrentPerformanceLevel <= PerformanceLevel.Poor)
            {
                SetQualityLevel(Math.Max(0, currentQualityLevel - 1));
            }
        }

        #endregion
    }

    #region Bottleneck Analysis Data Structures

    /// <summary>
    /// Individual frame analysis for bottleneck detection
    /// </summary>
    [System.Serializable]
    public class FrameAnalysis
    {
        public float frameTime;
        public float timestamp;
        public float cpuUsage;
        public float gpuUsage;
        public float memoryPressure;
        public int drawCalls;
        public int triangles;
        public int vertices;
    }

    /// <summary>
    /// Comprehensive bottleneck analysis results
    /// </summary>
    [System.Serializable]
    public class BottleneckAnalysis
    {
        public float analysisPeriod;
        public int totalFrames;
        public float averageFrameTime;
        public float frameTimeVariance;
        public BottleneckType bottleneckType;
        public BottleneckSeverity bottleneckSeverity;
        public List<string> recommendations;
        public DateTime timestamp;
    }

    /// <summary>
    /// Types of performance bottlenecks
    /// </summary>
    public enum BottleneckType
    {
        None,
        CPU,
        GPU,
        Memory,
        DrawCalls,
        Geometry,
        Network,
        Physics
    }

    /// <summary>
    /// Severity levels for bottleneck analysis
    /// </summary>
    public enum BottleneckSeverity
    {
        Low,
        Medium,
        High,
        Critical
    }

    #endregion

    #region Data Structures

    /// <summary>
    /// Performance data structure
    /// </summary>
    [System.Serializable]
    public class PerformanceData
    {
        public float currentFPS;
        public float averageFPS;
        public float frameTime;
        public long memoryUsage;
        public int droppedFrames;
        public int qualityLevel;
        public PerformanceLevel performanceLevel;
        public DateTime timestamp;
    }

    /// <summary>
    /// Performance warning structure
    /// </summary>
    [System.Serializable]
    public class PerformanceWarning
    {
        public PerformanceWarningType type;
        public string message;
        public WarningLevel severity;
        public DateTime timestamp;
    }

    /// <summary>
    /// Detailed performance report
    /// </summary>
    [System.Serializable]
    public class PerformanceReport
    {
        public float currentFPS;
        public float averageFPS;
        public float minFPS;
        public float maxFPS;
        public float frameTimeVariance;
        public long memoryUsage;
        public long peakMemoryUsage;
        public int qualityLevel;
        public PerformanceLevel performanceLevel;
        public int totalDroppedFrames;
        public DeviceInfo deviceInfo;
        public DateTime timestamp;
    }

    /// <summary>
    /// Device information structure
    /// </summary>
    [System.Serializable]
    public class DeviceInfo
    {
        public string deviceModel;
        public string deviceName;
        public string operatingSystem;
        public string processorType;
        public int processorCount;
        public int processorFrequency;
        public int systemMemorySize;
        public string graphicsDeviceName;
        public int graphicsMemorySize;
        public int maxTextureSize;
        public bool supportsInstancing;
    }

    /// <summary>
    /// Performance level enumeration
    /// </summary>
    public enum PerformanceLevel
    {
        Critical,
        Poor,
        Fair,
        Good,
        Excellent
    }

    /// <summary>
    /// Performance warning type enumeration
    /// </summary>
    public enum PerformanceWarningType
    {
        LowFrameRate,
        FrameTimeHigh,
        HighMemoryUsage,
        QualityReduced,
        SystemOverload
    }

    /// <summary>
    /// Warning severity levels
    /// </summary>
    public enum WarningLevel
    {
        Info,
        Warning,
        Critical
    }

    #endregion
}
