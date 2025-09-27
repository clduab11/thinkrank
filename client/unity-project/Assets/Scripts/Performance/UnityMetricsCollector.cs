using System;
using System.Collections;
using System.Collections.Generic;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using UnityEngine;
using UnityEngine.Profiling;

namespace ThinkRank.Performance
{
    /// <summary>
    /// Collects and exposes Unity performance metrics for monitoring systems
    /// Provides real-time metrics collection for frame rate, memory, and mobile device performance
    /// </summary>
    public class UnityMetricsCollector : MonoBehaviour
    {
        [Header("Metrics Configuration")]
        [SerializeField] private int metricsPort = 9090;
        [SerializeField] private float metricsUpdateInterval = 1.0f;
        [SerializeField] private bool enableDetailedMetrics = true;

        // Metrics data
        private PerformanceManager performanceManager;
        private float lastMetricsUpdate;
        private MetricsData currentMetrics;

        // Network server
        private TcpListener metricsServer;
        private Thread serverThread;
        private bool serverRunning;

        // Mobile device metrics
        private float deviceTemperature;
        private float batteryLevel;
        private string networkType;
        private float networkLatency;

        /// <summary>
        /// Initialize the metrics collector
        /// </summary>
        public void Initialize(PerformanceManager perfManager)
        {
            performanceManager = perfManager;
            currentMetrics = new MetricsData();

            if (enableDetailedMetrics)
            {
                StartMetricsServer();
                StartCoroutine(CollectMetrics());
            }

            Debug.Log($"[UnityMetricsCollector] Initialized on port {metricsPort}");
        }

        /// <summary>
        /// Start the metrics HTTP server
        /// </summary>
        private void StartMetricsServer()
        {
            try
            {
                metricsServer = new TcpListener(IPAddress.Any, metricsPort);
                serverThread = new Thread(RunMetricsServer);
                serverThread.IsBackground = true;
                serverThread.Start();

                Debug.Log($"[UnityMetricsCollector] Metrics server started on port {metricsPort}");
            }
            catch (Exception e)
            {
                Debug.LogError($"[UnityMetricsCollector] Failed to start metrics server: {e.Message}");
            }
        }

        /// <summary>
        /// Run the metrics HTTP server
        /// </summary>
        private void RunMetricsServer()
        {
            try
            {
                metricsServer.Start();
                serverRunning = true;

                while (serverRunning)
                {
                    if (metricsServer.Pending())
                    {
                        TcpClient client = metricsServer.AcceptTcpClient();
                        HandleMetricsRequest(client);
                        client.Close();
                    }
                    Thread.Sleep(10);
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"[UnityMetricsCollector] Metrics server error: {e.Message}");
            }
        }

        /// <summary>
        /// Handle incoming metrics requests
        /// </summary>
        private void HandleMetricsRequest(TcpClient client)
        {
            try
            {
                NetworkStream stream = client.GetStream();
                byte[] buffer = new byte[1024];
                int bytesRead = stream.Read(buffer, 0, buffer.Length);

                string request = Encoding.UTF8.GetString(buffer, 0, bytesRead);
                string response = GenerateMetricsResponse();

                byte[] responseBytes = Encoding.UTF8.GetBytes(response);
                stream.Write(responseBytes, 0, responseBytes.Length);
            }
            catch (Exception e)
            {
                Debug.LogError($"[UnityMetricsCollector] Error handling request: {e.Message}");
            }
        }

        /// <summary>
        /// Generate Prometheus-compatible metrics response
        /// </summary>
        private string GenerateMetricsResponse()
        {
            StringBuilder metrics = new StringBuilder();

            // Unity Performance Metrics
            metrics.AppendLine($"# HELP unity_fps_average Average FPS over the last 60 frames");
            metrics.AppendLine($"# TYPE unity_fps_average gauge");
            metrics.AppendLine($"unity_fps_average {currentMetrics.averageFPS:F2}");

            metrics.AppendLine($"# HELP unity_fps_current Current FPS");
            metrics.AppendLine($"# TYPE unity_fps_current gauge");
            metrics.AppendLine($"unity_fps_current {currentMetrics.currentFPS:F2}");

            metrics.AppendLine($"# HELP unity_memory_usage_mb Memory usage in MB");
            metrics.AppendLine($"# TYPE unity_memory_usage_mb gauge");
            metrics.AppendLine($"unity_memory_usage_mb {currentMetrics.memoryUsageMB:F2}");

            metrics.AppendLine($"# HELP unity_dropped_frames_total Total dropped frames");
            metrics.AppendLine($"# TYPE unity_dropped_frames_total counter");
            metrics.AppendLine($"unity_dropped_frames_total {currentMetrics.droppedFrames}");

            metrics.AppendLine($"# HELP unity_quality_level Current quality level");
            metrics.AppendLine($"# TYPE unity_quality_level gauge");
            metrics.AppendLine($"unity_quality_level {currentMetrics.qualityLevel}");

            // Mobile Device Metrics
            if (Application.isMobilePlatform)
            {
                metrics.AppendLine($"# HELP mobile_device_temperature_celsius Device temperature in Celsius");
                metrics.AppendLine($"# TYPE mobile_device_temperature_celsius gauge");
                metrics.AppendLine($"mobile_device_temperature_celsius {deviceTemperature:F1}");

                metrics.AppendLine($"# HELP mobile_battery_level_percent Battery level percentage");
                metrics.AppendLine($"# TYPE mobile_battery_level_percent gauge");
                metrics.AppendLine($"mobile_battery_level_percent {batteryLevel:F1}");

                metrics.AppendLine($"# HELP mobile_network_latency_ms Network latency in milliseconds");
                metrics.AppendLine($"# TYPE mobile_network_latency_ms gauge");
                metrics.AppendLine($"mobile_network_latency_ms {networkLatency:F2}");
            }

            // Game State Metrics
            metrics.AppendLine($"# HELP game_state_sync_latency_ms Game state synchronization latency");
            metrics.AppendLine($"# TYPE game_state_sync_latency_ms gauge");
            metrics.AppendLine($"game_state_sync_latency_ms {currentMetrics.gameStateSyncLatency:F2}");

            metrics.AppendLine($"# HELP active_players Current active players");
            metrics.AppendLine($"# TYPE active_players gauge");
            metrics.AppendLine($"active_players {currentMetrics.activePlayers}");

            // Performance Level
            metrics.AppendLine($"# HELP unity_performance_level Current performance level (0-4)");
            metrics.AppendLine($"# TYPE unity_performance_level gauge");
            metrics.AppendLine($"unity_performance_level {(int)currentMetrics.performanceLevel}");

            return metrics.ToString();
        }

        /// <summary>
        /// Collect performance metrics
        /// </summary>
        private IEnumerator CollectMetrics()
        {
            while (true)
            {
                yield return new WaitForSeconds(metricsUpdateInterval);

                UpdateMetrics();
                CollectMobileDeviceMetrics();
            }
        }

        /// <summary>
        /// Update performance metrics from PerformanceManager
        /// </summary>
        private void UpdateMetrics()
        {
            if (performanceManager != null)
            {
                currentMetrics.currentFPS = performanceManager.CurrentFPS;
                currentMetrics.averageFPS = performanceManager.AverageFPS;
                currentMetrics.memoryUsageMB = performanceManager.CurrentMemoryUsage / (1024f * 1024f);
                currentMetrics.performanceLevel = performanceManager.CurrentPerformanceLevel;
                currentMetrics.qualityLevel = QualitySettings.GetQualityLevel();

                // Get dropped frames (this would need to be exposed by PerformanceManager)
                // currentMetrics.droppedFrames = performanceManager.GetDroppedFrameCount();
            }

            currentMetrics.timestamp = DateTime.UtcNow;
        }

        /// <summary>
        /// Collect mobile device specific metrics
        /// </summary>
        private void CollectMobileDeviceMetrics()
        {
            if (!Application.isMobilePlatform) return;

            try
            {
                // Get device temperature (Android only)
                #if UNITY_ANDROID && !UNITY_EDITOR
                using (AndroidJavaClass systemInfo = new AndroidJavaClass("android.os.SystemProperties"))
                {
                    // Note: This requires special permissions and may not be available
                    // deviceTemperature = GetDeviceTemperature();
                }
                #endif

                // Get battery level
                batteryLevel = SystemInfo.batteryLevel * 100f;

                // Get network information
                networkType = GetNetworkType();
                networkLatency = MeasureNetworkLatency();
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[UnityMetricsCollector] Error collecting mobile metrics: {e.Message}");
            }
        }

        /// <summary>
        /// Get current network type
        /// </summary>
        private string GetNetworkType()
        {
            #if UNITY_ANDROID && !UNITY_EDITOR
            try
            {
                using (AndroidJavaClass connectivityManager = new AndroidJavaClass("android.net.ConnectivityManager"))
                {
                    // This would need proper Android permissions and context
                    return "cellular"; // Simplified for example
                }
            }
            catch { }
            #endif

            return "unknown";
        }

        /// <summary>
        /// Measure network latency to game servers
        /// </summary>
        private float MeasureNetworkLatency()
        {
            // This would typically ping your game servers
            // For now, return a placeholder value
            return 50f; // 50ms placeholder
        }

        /// <summary>
        /// Clean up resources
        /// </summary>
        private void OnDestroy()
        {
            serverRunning = false;

            if (metricsServer != null)
            {
                metricsServer.Stop();
            }

            if (serverThread != null && serverThread.IsAlive)
            {
                serverThread.Abort();
            }
        }

        /// <summary>
        /// Get current metrics data
        /// </summary>
        public MetricsData GetCurrentMetrics()
        {
            return currentMetrics;
        }
    }

    /// <summary>
    /// Structure containing current metrics data
    /// </summary>
    [System.Serializable]
    public class MetricsData
    {
        public float currentFPS;
        public float averageFPS;
        public float memoryUsageMB;
        public int droppedFrames;
        public int qualityLevel;
        public PerformanceManager.PerformanceLevel performanceLevel;
        public float gameStateSyncLatency;
        public int activePlayers;
        public DateTime timestamp;
    }
}