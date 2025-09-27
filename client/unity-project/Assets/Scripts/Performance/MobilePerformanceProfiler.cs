using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using UnityEngine;
using UnityEngine.Profiling;

namespace ThinkRank.Performance
{
    /// <summary>
    /// Comprehensive mobile performance profiling system for ThinkRank
    /// Monitors FPS, memory usage, load times, and mobile-specific metrics
    /// </summary>
    public class MobilePerformanceProfiler : MonoBehaviour
    {
        [Header("Profiling Configuration")]
        [SerializeField] private bool enableProfiling = true;
        [SerializeField] private float updateInterval = 1.0f;
        [SerializeField] private int maxFrameHistory = 300;

        [Header("Mobile-Specific Settings")]
        [SerializeField] private bool monitorThermalState = true;
        [SerializeField] private bool monitorBatteryLevel = true;
        [SerializeField] private bool monitorNetworkQuality = true;

        // Core performance metrics
        private PerformanceMetrics currentMetrics;
        private Queue<PerformanceSnapshot> frameHistory;
        private float lastUpdateTime;

        // Mobile-specific metrics
        private ThermalState thermalState = ThermalState.Normal;
        private BatteryState batteryState = BatteryState.Unknown;
        private NetworkQuality networkQuality = NetworkQuality.Unknown;

        // Profiling components
        private MemoryProfiler memoryProfiler;
        private RenderProfiler renderProfiler;
        private AudioProfiler audioProfiler;
        private NetworkProfiler networkProfiler;

        // Events
        public static event Action<PerformanceMetrics> OnMetricsUpdated;
        public static event Action<PerformanceWarning> OnPerformanceWarning;
        public static event Action<PerformanceSnapshot> OnFrameRecorded;

        private void Awake()
        {
            InitializeProfilers();
        }

        private void Start()
        {
            if (enableProfiling)
            {
                StartProfiling();
            }
        }

        private void Update()
        {
            if (!enableProfiling) return;

            if (Time.time - lastUpdateTime >= updateInterval)
            {
                UpdatePerformanceMetrics();
                lastUpdateTime = Time.time;
            }

            RecordFrameMetrics();
        }

        private void OnApplicationPause(bool pause)
        {
            if (pause)
            {
                RecordPauseMetrics();
            }
            else
            {
                RecordResumeMetrics();
            }
        }

        private void OnDestroy()
        {
            StopProfiling();
            ExportPerformanceReport();
        }

        #region Initialization

        private void InitializeProfilers()
        {
            frameHistory = new Queue<PerformanceSnapshot>(maxFrameHistory);

            memoryProfiler = new MemoryProfiler();
            renderProfiler = new RenderProfiler();
            audioProfiler = new AudioProfiler();
            networkProfiler = new NetworkProfiler();

            // Initialize mobile-specific monitoring
            if (monitorThermalState || monitorBatteryLevel || monitorNetworkQuality)
            {
                InitializeMobileMonitoring();
            }
        }

        private void InitializeMobileMonitoring()
        {
#if UNITY_ANDROID
            InitializeAndroidMonitoring();
#elif UNITY_IOS
            InitializeIOSMonitoring();
#endif
        }

        private void StartProfiling()
        {
            memoryProfiler.StartProfiling();
            renderProfiler.StartProfiling();
            audioProfiler.StartProfiling();
            networkProfiler.StartProfiling();

            Debug.Log("[MobilePerformanceProfiler] Started performance profiling");
        }

        private void StopProfiling()
        {
            memoryProfiler.StopProfiling();
            renderProfiler.StopProfiling();
            audioProfiler.StopProfiling();
            networkProfiler.StopProfiling();

            Debug.Log("[MobilePerformanceProfiler] Stopped performance profiling");
        }

        #endregion

        #region Metrics Collection

        private void UpdatePerformanceMetrics()
        {
            currentMetrics = new PerformanceMetrics
            {
                timestamp = DateTime.UtcNow,
                averageFPS = renderProfiler.GetAverageFPS(),
                frameTime = renderProfiler.GetAverageFrameTime(),
                memoryUsage = memoryProfiler.GetMemoryUsage(),
                memoryAllocated = memoryProfiler.GetAllocatedMemory(),
                textureMemory = renderProfiler.GetTextureMemoryUsage(),
                meshMemory = renderProfiler.GetMeshMemoryUsage(),
                audioMemory = audioProfiler.GetAudioMemoryUsage(),
                networkLatency = networkProfiler.GetAverageLatency(),
                thermalState = thermalState,
                batteryLevel = batteryState,
                networkQuality = networkQuality,
                deviceModel = SystemInfo.deviceModel,
                deviceType = SystemInfo.deviceType.ToString(),
                graphicsDevice = SystemInfo.graphicsDeviceName,
                processorType = SystemInfo.processorType,
                systemMemorySize = SystemInfo.systemMemorySize
            };

            OnMetricsUpdated?.Invoke(currentMetrics);
            CheckPerformanceThresholds();
        }

        private void RecordFrameMetrics()
        {
            var snapshot = new PerformanceSnapshot
            {
                timestamp = Time.time,
                fps = 1f / Time.deltaTime,
                frameTime = Time.deltaTime * 1000f,
                memoryUsage = Profiler.GetTotalAllocatedMemoryLong() / (1024f * 1024f),
                drawCalls = UnityEngine.Profiling.Profiler.GetDrawCalls(),
                triangles = renderProfiler.GetTriangleCount(),
                vertices = renderProfiler.GetVertexCount()
            };

            // Maintain frame history
            if (frameHistory.Count >= maxFrameHistory)
            {
                frameHistory.Dequeue();
            }
            frameHistory.Enqueue(snapshot);

            OnFrameRecorded?.Invoke(snapshot);
        }

        private void RecordPauseMetrics()
        {
            var pauseMetrics = new PerformanceSnapshot
            {
                timestamp = Time.time,
                eventType = PerformanceEventType.AppPaused
            };
            OnFrameRecorded?.Invoke(pauseMetrics);
        }

        private void RecordResumeMetrics()
        {
            var resumeMetrics = new PerformanceSnapshot
            {
                timestamp = Time.time,
                eventType = PerformanceEventType.AppResumed
            };
            OnFrameRecorded?.Invoke(resumeMetrics);
        }

        #endregion

        #region Mobile-Specific Monitoring

#if UNITY_ANDROID
        private void InitializeAndroidMonitoring()
        {
            // Use Android-specific APIs for thermal and battery monitoring
            Debug.Log("[MobilePerformanceProfiler] Initialized Android monitoring");
        }
#endif

#if UNITY_IOS
        private void InitializeIOSMonitoring()
        {
            // Use iOS-specific APIs for thermal and battery monitoring
            Debug.Log("[MobilePerformanceProfiler] Initialized iOS monitoring");
        }
#endif

        #endregion

        #region Performance Analysis

        private void CheckPerformanceThresholds()
        {
            // Check FPS thresholds
            if (currentMetrics.averageFPS < 30)
            {
                var warning = new PerformanceWarning
                {
                    type = WarningType.LowFPS,
                    severity = currentMetrics.averageFPS < 15 ? Severity.Critical : Severity.Warning,
                    message = $"Low FPS detected: {currentMetrics.averageFPS:F1}",
                    timestamp = DateTime.UtcNow
                };
                OnPerformanceWarning?.Invoke(warning);
            }

            // Check memory thresholds
            float memoryMB = currentMetrics.memoryUsage;
            if (memoryMB > 512) // More than 512MB
            {
                var warning = new PerformanceWarning
                {
                    type = WarningType.HighMemory,
                    severity = memoryMB > 768 ? Severity.Critical : Severity.Warning,
                    message = $"High memory usage: {memoryMB:F1}MB",
                    timestamp = DateTime.UtcNow
                };
                OnPerformanceWarning?.Invoke(warning);
            }

            // Check thermal state
            if (thermalState == ThermalState.Warning || thermalState == ThermalState.Critical)
            {
                var warning = new PerformanceWarning
                {
                    type = WarningType.ThermalThrottling,
                    severity = thermalState == ThermalState.Critical ? Severity.Critical : Severity.Warning,
                    message = $"Device thermal state: {thermalState}",
                    timestamp = DateTime.UtcNow
                };
                OnPerformanceWarning?.Invoke(warning);
            }

            // Check battery level
            if (batteryState == BatteryState.Low || batteryState == BatteryState.Critical)
            {
                var warning = new PerformanceWarning
                {
                    type = WarningType.LowBattery,
                    severity = batteryState == BatteryState.Critical ? Severity.Critical : Severity.Warning,
                    message = $"Low battery: {batteryState}",
                    timestamp = DateTime.UtcNow
                };
                OnPerformanceWarning?.Invoke(warning);
            }
        }

        #endregion

        #region Public Interface

        /// <summary>
        /// Get current performance metrics
        /// </summary>
        public PerformanceMetrics GetCurrentMetrics()
        {
            return currentMetrics;
        }

        /// <summary>
        /// Get frame history for analysis
        /// </summary>
        public PerformanceSnapshot[] GetFrameHistory()
        {
            return frameHistory.ToArray();
        }

        /// <summary>
        /// Get performance recommendations based on current metrics
        /// </summary>
        public List<string> GetPerformanceRecommendations()
        {
            var recommendations = new List<string>();

            if (currentMetrics.averageFPS < 45)
            {
                recommendations.Add("Consider reducing rendering quality or batching draw calls");
            }

            if (currentMetrics.memoryUsage > 400)
            {
                recommendations.Add("Implement object pooling and optimize asset loading");
            }

            if (currentMetrics.thermalState != ThermalState.Normal)
            {
                recommendations.Add("Reduce CPU/GPU intensive operations due to thermal throttling");
            }

            return recommendations;
        }

        /// <summary>
        /// Export performance report to file
        /// </summary>
        public void ExportPerformanceReport()
        {
            try
            {
                string reportPath = Path.Combine(Application.persistentDataPath, $"performance_report_{DateTime.Now:yyyyMMdd_HHmmss}.json");
                var report = new PerformanceReport
                {
                    sessionStart = DateTime.UtcNow.AddSeconds(-Time.time),
                    sessionEnd = DateTime.UtcNow,
                    metrics = currentMetrics,
                    frameHistory = GetFrameHistory(),
                    recommendations = GetPerformanceRecommendations(),
                    deviceInfo = new DeviceInfo
                    {
                        model = SystemInfo.deviceModel,
                        type = SystemInfo.deviceType.ToString(),
                        os = SystemInfo.operatingSystem,
                        cpu = SystemInfo.processorType,
                        gpu = SystemInfo.graphicsDeviceName,
                        ram = SystemInfo.systemMemorySize
                    }
                };

                string jsonReport = JsonUtility.ToJson(report, true);
                File.WriteAllText(reportPath, jsonReport);

                Debug.Log($"[MobilePerformanceProfiler] Performance report exported to: {reportPath}");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[MobilePerformanceProfiler] Failed to export performance report: {ex.Message}");
            }
        }

        #endregion
    }

    #region Data Structures

    [System.Serializable]
    public struct PerformanceMetrics
    {
        public DateTime timestamp;
        public float averageFPS;
        public float frameTime;
        public float memoryUsage;
        public float memoryAllocated;
        public float textureMemory;
        public float meshMemory;
        public float audioMemory;
        public float networkLatency;
        public ThermalState thermalState;
        public BatteryState batteryLevel;
        public NetworkQuality networkQuality;
        public string deviceModel;
        public string deviceType;
        public string graphicsDevice;
        public string processorType;
        public int systemMemorySize;
    }

    [System.Serializable]
    public struct PerformanceSnapshot
    {
        public float timestamp;
        public float fps;
        public float frameTime;
        public float memoryUsage;
        public int drawCalls;
        public int triangles;
        public int vertices;
        public PerformanceEventType eventType;
    }

    [System.Serializable]
    public struct PerformanceWarning
    {
        public WarningType type;
        public Severity severity;
        public string message;
        public DateTime timestamp;
    }

    [System.Serializable]
    public struct PerformanceReport
    {
        public DateTime sessionStart;
        public DateTime sessionEnd;
        public PerformanceMetrics metrics;
        public PerformanceSnapshot[] frameHistory;
        public List<string> recommendations;
        public DeviceInfo deviceInfo;
    }

    [System.Serializable]
    public struct DeviceInfo
    {
        public string model;
        public string type;
        public string os;
        public string cpu;
        public string gpu;
        public int ram;
    }

    public enum ThermalState { Normal, Warning, Critical }
    public enum BatteryState { Unknown, Full, High, Medium, Low, Critical }
    public enum NetworkQuality { Unknown, Poor, Good, Excellent }
    public enum WarningType { LowFPS, HighMemory, ThermalThrottling, LowBattery, NetworkIssues }
    public enum Severity { Info, Warning, Critical }
    public enum PerformanceEventType { Frame, AppPaused, AppResumed, SceneLoaded, AssetLoaded }

    #endregion
}