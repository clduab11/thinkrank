# ThinkRank Phase 1 Integration Guide

## Quick Start Implementation

### Backend Setup

1. **Install Dependencies**
```bash
cd backend/services/game-service
npm install
npm run build
npm run start:dev
```

2. **Environment Configuration**
```bash
# .env
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://localhost:5432/thinkrank
WEBSOCKET_URL=ws://localhost:3001
AI_SERVICE_URL=http://localhost:3002
SOCIAL_SERVICE_URL=http://localhost:3003
```

3. **Database Migration**
```bash
cd backend/services/game-service
npm run migrate
```

### Unity Client Setup

1. **Project Configuration**
```csharp
// Assets/Scripts/Core/GameConfig.cs
public static class GameConfig {
    public const string API_BASE_URL = "https://api.thinkrank.com";
    public const string WEBSOCKET_URL = "wss://api.thinkrank.com/ws";
    public const int TARGET_FPS = 60;
    public const bool ENABLE_PERFORMANCE_MONITORING = true;
}
```

2. **Build Settings**
```xml
<!-- client/build-scripts/build-config.xml -->
<build>
    <platform>Android</platform>
    <target>Android API 21+</target>
    <architecture>ARM64</architecture>
    <optimization>Disk I/O, Rendering</optimization>
</build>
```

## API Integration Points

### Core Game Engine Endpoints

#### Player Actions
```typescript
// Process any game action
POST /api/game/actions
{
  "type": "PERFORM_GACHA_PULL",
  "playerId": "player_123",
  "payload": {
    "pullType": "MULTI_10"
  }
}

// Get current game state
GET /api/game/state/{playerId}

// Real-time events via WebSocket
WS /api/game/websocket
{
  "type": "state_update",
  "data": { ... }
}
```

#### Gacha System
```typescript
// Perform gacha pull
POST /api/gacha/pull
{
  "playerId": "player_123",
  "pullType": "SINGLE"
}

// Get collection
GET /api/gacha/collection/{playerId}

// Get drop rates
GET /api/gacha/drop-rates
```

#### AI Research Integration
```typescript
// Get bias detection challenges
GET /api/research/challenges?difficulty=intermediate

// Submit challenge answer
POST /api/research/validate
{
  "challengeId": "challenge_123",
  "answer": { ... }
}

// Start research workflow
POST /api/research/workflow/start
{
  "type": "bias_detection",
  "difficulty": "adaptive"
}
```

### Mobile Client Integration

#### Unity WebSocket Manager
```csharp
public class WebSocketManager : MonoBehaviour {
    private ClientWebSocket webSocket;

    public async void Connect() {
        webSocket = new ClientWebSocket();
        await webSocket.ConnectAsync(new Uri(GameConfig.WEBSOCKET_URL));

        // Start message handling
        StartReceiving();
    }

    private async void StartReceiving() {
        var buffer = new byte[1024];

        while (webSocket.State == WebSocketState.Open) {
            var result = await webSocket.ReceiveAsync(
                new ArraySegment<byte>(buffer), CancellationToken.None);

            string message = Encoding.UTF8.GetString(buffer, 0, result.Count);
            HandleMessage(message);
        }
    }
}
```

#### Touch Input Handler
```csharp
public class TouchGachaController : MonoBehaviour {
    [SerializeField] private float minSwipeDistance = 50f;

    void Update() {
        if (Input.touchCount > 0) {
            Touch touch = Input.GetTouch(0);

            switch (touch.phase) {
                case TouchPhase.Ended:
                    if (IsValidSwipe(touch)) {
                        PerformGachaPull();
                    }
                    break;
            }
        }
    }

    private bool IsValidSwipe(Touch touch) {
        // Validate swipe gesture
        return touch.deltaPosition.magnitude > minSwipeDistance;
    }
}
```

## Performance Optimization

### Mobile Performance Targets
- **Frame Rate**: 60 FPS on high-end devices, 30 FPS minimum
- **Memory Usage**: < 200MB for Android, < 150MB for iOS
- **Load Time**: < 3 seconds for scene transitions
- **Network Latency**: < 100ms for real-time actions

### Optimization Techniques

#### Object Pooling
```csharp
public class CardPool : MonoBehaviour {
    private Queue<GameObject> pooledCards = new Queue<GameObject>();

    public GameObject GetCard() {
        if (pooledCards.Count > 0) {
            return pooledCards.Dequeue();
        }
        return Instantiate(cardPrefab);
    }

    public void ReturnCard(GameObject card) {
        card.SetActive(false);
        pooledCards.Enqueue(card);
    }
}
```

#### Texture Optimization
```csharp
public class TextureOptimizer : MonoBehaviour {
    void Start() {
        OptimizeTextures();
    }

    private void OptimizeTextures() {
        // Compress textures for mobile
        Texture2D[] textures = FindObjectsOfType<Texture2D>();
        foreach (var texture in textures) {
            texture.Compress(true);
        }
    }
}
```

## Testing Strategy

### Unit Tests
```typescript
// backend/services/game-service/src/__tests__/GameEngine.test.ts
describe('GameEngine', () => {
  let gameEngine: GameEngine;
  let mockStateManager: jest.Mocked<StateManager>;

  beforeEach(() => {
    mockStateManager = {
      getCurrentState: jest.fn(),
      saveState: jest.fn()
    } as any;

    gameEngine = new GameEngine('test-game', mockConfig);
  });

  test('should process gacha pull correctly', async () => {
    const action: GameAction = {
      type: ActionType.PERFORM_GACHA_PULL,
      playerId: 'player_123',
      payload: { pullType: PullType.SINGLE }
    };

    const result = await gameEngine.processAction(action);
    expect(result).toBeDefined();
  });
});
```

### Integration Tests
```csharp
// client/unity-project/Assets/Tests/GameManagerTests.cs
[Test]
public async Task GameManager_ShouldSyncWithServer() {
    var gameManager = new GameObject().AddComponent<GameManager>();

    // Mock network response
    var mockResponse = new GameState { /* ... */ };

    // Test sync functionality
    await gameManager.SyncWithServer();

    // Assert state was updated
    Assert.IsNotNull(gameManager.GetCurrentGameState());
}
```

## Deployment Pipeline

### Backend Deployment
```yaml
# Kubernetes deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: game-service
spec:
  replicas: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    spec:
      containers:
      - name: game-service
        image: thinkrank/game-service:v1.0.0
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
```

### Mobile App Deployment
```bash
# Build and deploy Android APK
./client/build-scripts/build-android.sh

# Deploy to Google Play
fastlane deploy_android

# Build and deploy iOS IPA
./client/build-scripts/build-ios.sh

# Deploy to App Store
fastlane deploy_ios
```

## Monitoring & Analytics

### Key Metrics to Track
```typescript
interface GameMetrics {
  performance: {
    averageFrameRate: number;
    memoryUsageMB: number;
    loadTimeSeconds: number;
    networkLatencyMs: number;
  };
  engagement: {
    dailyActiveUsers: number;
    sessionLengthMinutes: number;
    gachaPullsPerSession: number;
    challengeCompletionRate: number;
  };
  learning: {
    biasDetectionAccuracy: number;
    researchWorkflowCompletion: number;
    knowledgeRetention: number;
    learningVelocity: number;
  };
  viral: {
    viralCoefficient: number;
    shareRate: number;
    referralConversionRate: number;
    socialMediaReach: number;
  };
}
```

### Performance Monitoring
```csharp
public class PerformanceMonitor : MonoBehaviour {
    private float frameRate;
    private float memoryUsage;

    void Update() {
        // Calculate FPS
        frameRate = 1.0f / Time.deltaTime;

        // Get memory usage
        memoryUsage = UnityEngine.Profiling.Profiler.GetTotalAllocatedMemoryLong()
                     / (1024f * 1024f);

        // Log every 30 seconds
        if (Time.frameCount % 1800 == 0) {
            Debug.Log($"Performance - FPS: {frameRate:F1}, Memory: {memoryUsage:F1}MB");
        }
    }
}
```

## Security Implementation

### Authentication Flow
```typescript
public async Task<bool> AuthenticatePlayer(string playerId) {
    // JWT-based authentication
    var token = await GetAuthToken(playerId);

    // Validate token with auth service
    var isValid = await ValidateToken(token);

    if (isValid) {
        PlayerPrefs.SetString("AuthToken", token);
        return true;
    }

    return false;
}
```

### Data Protection
```csharp
// Encrypted local storage
public class SecureStorage {
    private string encryptionKey = "your-encryption-key";

    public void SaveGameState(GameState state) {
        string json = JsonConvert.SerializeObject(state);
        string encrypted = EncryptData(json, encryptionKey);
        PlayerPrefs.SetString("GameState", encrypted);
    }

    public GameState LoadGameState() {
        string encrypted = PlayerPrefs.GetString("GameState");
        string json = DecryptData(encrypted, encryptionKey);
        return JsonConvert.DeserializeObject<GameState>(json);
    }
}
```

## Troubleshooting Guide

### Common Issues

#### 1. WebSocket Connection Issues
```csharp
// Check network connectivity
public bool IsNetworkAvailable() {
    return Application.internetReachability != NetworkReachability.NotReachable;
}

// Retry connection with exponential backoff
private async void RetryConnection() {
    int retryCount = 0;
    int maxRetries = 5;

    while (retryCount < maxRetries) {
        if (await AttemptConnection()) {
            return;
        }

        retryCount++;
        await Task.Delay(Math.Pow(2, retryCount) * 1000); // Exponential backoff
    }
}
```

#### 2. Performance Issues
```csharp
// Reduce rendering quality on low-end devices
private void OptimizeForDevice() {
    if (SystemInfo.systemMemorySize < 2048) {
        QualitySettings.SetQualityLevel(0); // Low quality
    } else if (SystemInfo.systemMemorySize < 4096) {
        QualitySettings.SetQualityLevel(1); // Medium quality
    } else {
        QualitySettings.SetQualityLevel(2); // High quality
    }
}
```

#### 3. Memory Leaks
```csharp
// Monitor memory usage
private void CheckMemoryUsage() {
    float memoryMB = UnityEngine.Profiling.Profiler.GetTotalAllocatedMemoryLong()
                    / (1024f * 1024f);

    if (memoryMB > 150) {
        // Trigger garbage collection
        GC.Collect();
        Resources.UnloadUnusedAssets();
    }
}
```

## Next Steps

### Immediate Actions (Week 1)
1. Set up development environment
2. Implement core GameEngine class
3. Create basic gacha pull functionality
4. Build simple bias detection challenge
5. Test mobile client integration

### Short-term Goals (Week 2-4)
1. Implement full gacha system with animations
2. Add comprehensive bias detection challenges
3. Create social sharing features
4. Optimize mobile performance
5. Conduct user testing

### Long-term Vision (Week 5-8)
1. Advanced AI model integration
2. Comprehensive analytics dashboard
3. Multi-language support
4. AR/VR bias detection challenges
5. Machine learning model improvement

## Support Resources

### Documentation
- [API Reference](docs/API.md)
- [Architecture Overview](docs/ARCHITECTURE.md)
- [Security Guidelines](docs/security-guidelines.md)

### Development Tools
- Unity 2022.3 LTS
- Node.js 18+
- TypeScript 4.9+
- Redis 6.0+
- PostgreSQL 14+

### Community
- [Discord Server](https://discord.gg/thinkrank)
- [GitHub Repository](https://github.com/thinkrank)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/thinkrank)

## Contributing

### Code Style Guidelines
- Use TypeScript for backend services
- Follow C# naming conventions for Unity scripts
- Write comprehensive unit tests
- Document all public APIs
- Use meaningful commit messages

### Pull Request Process
1. Fork the repository
2. Create feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit pull request with detailed description

### Quality Assurance
- All code must pass linting
- Minimum 80% test coverage
- Performance benchmarks must be met
- Security review required for new features

---

**ThinkRank Team** - Building the future of AI literacy education through gamification and viral mechanics.