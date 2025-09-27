# ThinkRank Performance Monitoring Setup

## Overview

This document describes the comprehensive performance monitoring setup for ThinkRank, focusing on achieving and maintaining 60fps targets across mobile devices and real-time multiplayer scenarios.

## Architecture

### Components

1. **Unity Client Monitoring**
   - `PerformanceManager.cs`: Core frame rate and memory monitoring
   - `UnityMetricsCollector.cs`: Prometheus metrics exporter
   - Real-time performance data collection

2. **Infrastructure Monitoring**
   - Prometheus: Metrics collection and storage
   - Grafana: Visualization and alerting
   - Custom alerting rules for Unity performance

3. **Alerting System**
   - Frame rate degradation alerts
   - Memory usage warnings
   - Mobile device overheating detection
   - Network latency monitoring

## Quick Start

### 1. Unity Client Setup

Add the `UnityMetricsCollector` component to your main game object:

```csharp
using ThinkRank.Performance;

public class GameManager : MonoBehaviour
{
    private PerformanceManager performanceManager;
    private UnityMetricsCollector metricsCollector;

    void Start()
    {
        // Initialize performance monitoring
        performanceManager = GetComponent<PerformanceManager>();
        if (performanceManager == null)
        {
            performanceManager = gameObject.AddComponent<PerformanceManager>();
        }
        performanceManager.Initialize();

        // Initialize metrics collection
        metricsCollector = gameObject.AddComponent<UnityMetricsCollector>();
        metricsCollector.Initialize(performanceManager);
    }
}
```

### 2. Infrastructure Setup

Deploy the monitoring stack using the provided Kubernetes configurations:

```bash
# Deploy Prometheus with Unity-specific configuration
kubectl apply -f infrastructure/monitoring/prometheus-config.yaml

# Deploy Unity performance alerts
kubectl apply -f infrastructure/monitoring/unity-performance-alerts.yaml

# Deploy Grafana dashboards
kubectl apply -f infrastructure/monitoring/grafana-dashboards.yaml
```

### 3. Access Monitoring

- **Grafana Dashboard**: http://your-grafana-url
- **Prometheus Metrics**: http://your-prometheus-url
- **Unity Metrics**: http://unity-client-ip:9090/metrics

## Metrics Reference

### Unity Performance Metrics

| Metric | Description | Threshold | Alert Level |
|--------|-------------|-----------|-------------|
| `unity_fps_average` | Average FPS over 60 frames | < 54 | Warning |
| `unity_fps_current` | Current frame rate | < 30 | Critical |
| `unity_memory_usage_mb` | Memory usage in MB | > 1500 | Warning |
| `unity_dropped_frames_total` | Total dropped frames | > 300/5min | Warning |
| `unity_quality_level` | Current quality setting | < 2 (5min) | Info |

### Mobile Device Metrics

| Metric | Description | Threshold | Alert Level |
|--------|-------------|-----------|-------------|
| `mobile_device_temperature_celsius` | Device temperature | > 70 | Warning |
| `mobile_battery_level_percent` | Battery level | < 20 | Info |
| `mobile_network_latency_ms` | Network latency | > 200 | Warning |

### Game State Metrics

| Metric | Description | Threshold | Alert Level |
|--------|-------------|-----------|-------------|
| `game_state_sync_latency_ms` | Sync latency | > 100 | Warning |
| `game_state_sync_failures_total` | Sync failures | > 5% | Critical |
| `active_players` | Current player count | Δ > 100 | Warning |

## Alert Configuration

### Frame Rate Alerts

- **Warning**: FPS < 54 (90% of 60fps target) for 2+ minutes
- **Critical**: FPS < 30 for 1+ minute
- **Action**: Automatic quality reduction and performance optimization

### Memory Alerts

- **Warning**: Memory > 1500MB for 3+ minutes
- **Critical**: Memory > 2048MB for 1+ minute
- **Action**: Force garbage collection and quality reduction

### Network Alerts

- **Warning**: Latency > 200ms for 3+ minutes
- **Critical**: Sync failure rate > 5% for 3+ minutes
- **Action**: Network optimization and player notification

## Performance Optimization Guidelines

### Frame Rate Optimization

1. **Monitor Baseline**: Establish 60fps baseline during normal gameplay
2. **Identify Bottlenecks**: Use frame time analysis to find slow operations
3. **Adaptive Quality**: Automatically reduce settings when performance drops
4. **Memory Management**: Regular garbage collection and texture optimization

### Mobile Optimization

1. **Device Detection**: Automatically detect device capabilities
2. **Battery Awareness**: Reduce quality when battery is low
3. **Thermal Management**: Monitor device temperature
4. **Network Adaptation**: Adjust sync frequency based on connection quality

### Network Optimization

1. **Latency Monitoring**: Track ping times to game servers
2. **Sync Optimization**: Reduce sync frequency during poor connections
3. **Prediction**: Use client-side prediction to hide latency
4. **Compression**: Compress game state updates

## Troubleshooting

### Common Issues

#### Low Frame Rate

1. Check `unity_fps_average` metric in Grafana
2. Look for correlated memory usage spikes
3. Review dropped frames counter
4. Check for render thread blocking

#### High Memory Usage

1. Monitor `unity_memory_usage_mb` trend
2. Check garbage collection frequency
3. Review texture and asset memory usage
4. Force garbage collection if needed

#### Network Issues

1. Monitor `mobile_network_latency_ms`
2. Check `game_state_sync_failures_total`
3. Review network type and signal strength
4. Test with different network conditions

### Debug Commands

```csharp
// Get current performance report
PerformanceReport report = performanceManager.GetPerformanceReport();

// Force optimization
performanceManager.OptimizePerformance();

// Enable detailed profiling
performanceManager.EnableDetailedProfiling(true);

// Get metrics data
MetricsData metrics = metricsCollector.GetCurrentMetrics();
```

## Best Practices

### Development

1. **Profile Early**: Start monitoring during development
2. **Set Baselines**: Establish performance targets for each platform
3. **Test on Devices**: Use real mobile devices for testing
4. **Monitor Trends**: Track performance over time

### Production

1. **Alert Responsiveness**: Respond to alerts within SLA
2. **Performance Budget**: Maintain 60fps target across all devices
3. **User Experience**: Prioritize smooth gameplay over visual quality
4. **Continuous Improvement**: Regularly optimize based on metrics

### Monitoring

1. **Minimal Overhead**: Ensure monitoring doesn't impact performance
2. **Relevant Metrics**: Only collect necessary performance data
3. **Regular Review**: Weekly review of performance trends
4. **Actionable Alerts**: Configure alerts that require specific actions

## Maintenance

### Regular Tasks

1. **Weekly**: Review performance trends and alerts
2. **Monthly**: Update device capability database
3. **Quarterly**: Review and optimize alert thresholds
4. **As Needed**: Update monitoring configuration for new features

### Updates

When deploying updates:

1. Monitor performance metrics during rollout
2. Compare before/after performance baselines
3. Adjust quality settings if needed
4. Update alert thresholds based on new baselines

## Support

For monitoring-related issues:

1. Check Grafana dashboards for current status
2. Review Prometheus metrics for detailed data
3. Check Unity logs for client-side issues
4. Contact the development team for configuration changes