# ThinkRank Pseudocode Design & Architecture

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
├─────────────────────────────────────────────────────────────────┤
│  React Web App │ React Native Mobile │ Unity WebGL (Future)     │
└────────────────┴────────────────────┴───────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway (Kong)                          │
│              Rate Limiting │ Auth │ Routing                      │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        ▼                                           ▼
┌──────────────────┐                    ┌──────────────────┐
│  REST API Layer  │                    │ WebSocket Layer  │
│   (Express.js)   │                    │  (Socket.io)     │
└──────────────────┘                    └──────────────────┘
        │                                           │
        └─────────────────────┬─────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Microservices Layer                           │
├─────────────────┬─────────────────┬─────────────────┬──────────┤
│   Auth Service  │  Game Service   │  AI Service     │  Social  │
│                 │                  │                 │  Service │
└─────────────────┴─────────────────┴─────────────────┴──────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                  │
├─────────────────┬─────────────────┬─────────────────┬──────────┤
│  PostgreSQL     │     Redis        │   Supabase     │    S3    │
│  (Primary DB)   │   (Caching)      │  (Real-time)   │ (Media)  │
└─────────────────┴─────────────────┴─────────────────┴──────────┘
```

### 1.2 Component Responsibilities

```pseudocode
COMPONENT AuthService:
    RESPONSIBILITIES:
        - User registration and authentication
        - JWT token generation and validation
        - OAuth2 provider integration
        - Password reset and 2FA
        - Session management
    
    INTERFACES:
        - POST /register(email, password, username)
        - POST /login(email, password)
        - POST /logout(token)
        - POST /refresh(refreshToken)
        - GET /verify-email(token)

COMPONENT GameService:
    RESPONSIBILITIES:
        - Game session management
        - Challenge distribution
        - Score calculation
        - Achievement tracking
        - Game state persistence
    
    INTERFACES:
        - POST /start-game(userId, mode)
        - POST /submit-answer(gameId, challengeId, answer)
        - GET /game-state(gameId)
        - POST /end-game(gameId)

COMPONENT AIService:
    RESPONSIBILITIES:
        - AI content generation
        - Detection model inference
        - Model performance tracking
        - Feedback processing
        - Research data collection
    
    INTERFACES:
        - GET /generate-challenge(type, difficulty)
        - POST /validate-detection(content, userAnswer)
        - POST /process-feedback(challengeId, feedback)
        - GET /model-metrics()

COMPONENT SocialService:
    RESPONSIBILITIES:
        - Leaderboard management
        - Friend system
        - Guild/team features
        - Chat and messaging
        - Achievement sharing
    
    INTERFACES:
        - GET /leaderboard(type, timeframe)
        - POST /add-friend(userId, friendId)
        - POST /create-guild(name, description)
        - POST /send-message(fromId, toId, message)
```

### 1.3 Data Flow Patterns

```pseudocode
PATTERN EventDrivenArchitecture:
    EVENT GameCompleted:
        PUBLISHER: GameService
        SUBSCRIBERS:
            - LeaderboardService.updateRankings()
            - AchievementService.checkUnlocks()
            - ResearchService.collectData()
            - NotificationService.notifyFriends()
    
    EVENT DetectionSubmitted:
        PUBLISHER: GameService
        SUBSCRIBERS:
            - AIService.validateDetection()
            - ScoreService.calculatePoints()
            - ResearchService.recordResponse()

PATTERN CQRSImplementation:
    COMMAND CreateGame:
        HANDLER: GameCommandHandler
        ACTIONS:
            1. Validate user eligibility
            2. Create game session
            3. Generate challenges
            4. Emit GameCreated event
    
    QUERY GetLeaderboard:
        HANDLER: LeaderboardQueryHandler
        ACTIONS:
            1. Check cache
            2. If miss, query database
            3. Transform and return data
            4. Update cache
```

## 2. Core Algorithms

### 2.1 AI Detection Challenge Generation

```pseudocode
ALGORITHM GenerateDetectionChallenge:
    INPUT: userId, difficulty, type
    OUTPUT: Challenge object
    
    FUNCTION generateChallenge():
        userProfile = getUserProfile(userId)
        performanceHistory = getPerformanceHistory(userId)
        
        // Adaptive difficulty calculation
        adjustedDifficulty = calculateAdaptiveDifficulty(
            baseDifficulty: difficulty,
            userAccuracy: performanceHistory.accuracy,
            streakLength: performanceHistory.currentStreak
        )
        
        IF type == "text":
            content = selectTextContent(adjustedDifficulty)
            IF random() < 0.5:
                // Generate AI content
                aiContent = generateAIText(content, adjustedDifficulty)
                return Challenge(
                    content: aiContent,
                    isAI: true,
                    originalContent: content,
                    markers: identifyAIMarkers(aiContent)
                )
            ELSE:
                // Use human content
                return Challenge(
                    content: content,
                    isAI: false,
                    source: content.source
                )
        
        ELSE IF type == "image":
            baseImage = selectImageContent(adjustedDifficulty)
            IF random() < 0.5:
                aiImage = generateAIImage(baseImage, adjustedDifficulty)
                return Challenge(
                    content: aiImage,
                    isAI: true,
                    technique: aiImage.generationMethod,
                    artifacts: detectAIArtifacts(aiImage)
                )
            ELSE:
                return Challenge(
                    content: baseImage,
                    isAI: false,
                    metadata: baseImage.metadata
                )

FUNCTION calculateAdaptiveDifficulty(baseDifficulty, userAccuracy, streakLength):
    // Dynamic difficulty adjustment
    difficultyModifier = 0
    
    IF userAccuracy > 0.8 AND streakLength > 5:
        difficultyModifier = 0.2
    ELSE IF userAccuracy > 0.7:
        difficultyModifier = 0.1
    ELSE IF userAccuracy < 0.5:
        difficultyModifier = -0.1
    
    return CLAMP(baseDifficulty + difficultyModifier, 0.1, 1.0)
```

### 2.2 Score Calculation Algorithm

```pseudocode
ALGORITHM CalculateScore:
    INPUT: response, timeSpent, difficulty, streak
    OUTPUT: score, bonuses
    
    FUNCTION calculateScore():
        baseScore = 100 * difficulty
        
        // Time bonus (faster = more points)
        timeBonus = MAX(0, (30 - timeSpent) * 2)
        
        // Accuracy multiplier
        IF response.isCorrect:
            accuracyMultiplier = 1.0
        ELSE:
            accuracyMultiplier = 0.0
            streak = 0  // Reset streak
        
        // Streak bonus
        streakBonus = MIN(streak * 10, 100)
        
        // Difficulty multiplier
        difficultyMultiplier = 1 + (difficulty - 0.5)
        
        // Calculate final score
        finalScore = (baseScore + timeBonus + streakBonus) * 
                     accuracyMultiplier * difficultyMultiplier
        
        // XP calculation
        xpGained = FLOOR(finalScore / 10)
        
        return {
            score: ROUND(finalScore),
            xp: xpGained,
            bonuses: {
                time: timeBonus,
                streak: streakBonus,
                difficulty: difficultyMultiplier
            }
        }
```

### 2.3 Leaderboard Ranking Algorithm

```pseudocode
ALGORITHM UpdateLeaderboard:
    INPUT: userId, newScore, leaderboardType
    OUTPUT: newRank, rankChange
    
    FUNCTION updateLeaderboard():
        // Use Redis sorted sets for efficiency
        currentRank = redis.zrevrank(leaderboardType, userId)
        
        // Update score
        redis.zadd(leaderboardType, newScore, userId)
        
        // Get new rank
        newRank = redis.zrevrank(leaderboardType, userId)
        
        // Calculate rank change
        IF currentRank != null:
            rankChange = currentRank - newRank
        ELSE:
            rankChange = 0
        
        // Update user statistics
        updateUserStats(userId, {
            bestRank: MIN(getUserStat(userId, 'bestRank'), newRank),
            totalGames: INCREMENT(getUserStat(userId, 'totalGames')),
            totalScore: INCREMENT(getUserStat(userId, 'totalScore'), newScore)
        })
        
        // Emit events for achievements
        IF newRank == 1:
            emit('FirstPlace', userId)
        IF newRank <= 10 AND currentRank > 10:
            emit('Top10Entry', userId)
        
        return {
            rank: newRank + 1,  // Convert to 1-based
            change: rankChange,
            percentile: calculatePercentile(newRank)
        }
```

### 2.4 AI Model Serving Algorithm

```pseudocode
ALGORITHM ServeAIDetection:
    INPUT: content, contentType
    OUTPUT: detectionResult
    
    FUNCTION detectAIContent():
        // Model selection based on content type
        model = selectModel(contentType)
        
        // Preprocess content
        IF contentType == "text":
            processed = preprocessText(content)
            embeddings = generateTextEmbeddings(processed)
        ELSE IF contentType == "image":
            processed = preprocessImage(content)
            features = extractImageFeatures(processed)
        
        // Run inference with caching
        cacheKey = hash(content + model.version)
        cachedResult = cache.get(cacheKey)
        
        IF cachedResult:
            return cachedResult
        
        // Perform inference
        prediction = model.predict(processed)
        
        // Post-process results
        result = {
            isAI: prediction.probability > 0.7,
            confidence: prediction.probability,
            technique: identifyTechnique(prediction.features),
            explanation: generateExplanation(prediction)
        }
        
        // Cache result
        cache.set(cacheKey, result, TTL: 3600)
        
        return result
```

## 3. Test Strategy

### 3.1 Unit Testing Approach (TDD London School)

```pseudocode
TEST_SUITE AuthService:
    SETUP:
        mockDatabase = createMockDatabase()
        mockRedis = createMockRedis()
        authService = new AuthService(mockDatabase, mockRedis)
    
    TEST "should register new user with valid data":
        // Arrange
        userData = {
            email: "test@example.com",
            password: "SecurePass123!",
            username: "testuser"
        }
        
        // Act
        result = authService.register(userData)
        
        // Assert
        EXPECT(result.success).toBe(true)
        EXPECT(result.user.email).toBe(userData.email)
        EXPECT(mockDatabase.users.create).toHaveBeenCalledWith(userData)
        EXPECT(mockRedis.set).toHaveBeenCalled()
    
    TEST "should reject registration with existing email":
        // Arrange
        mockDatabase.users.findByEmail.returns(existingUser)
        
        // Act & Assert
        EXPECT(() => authService.register(userData))
            .toThrow("Email already registered")

TEST_SUITE GameService:
    TEST "should calculate score correctly with streak bonus":
        // Arrange
        gameService = new GameService()
        response = {
            isCorrect: true,
            timeSpent: 15,
            difficulty: 0.7
        }
        playerState = {
            streak: 5
        }
        
        // Act
        score = gameService.calculateScore(response, playerState)
        
        // Assert
        EXPECT(score.total).toBe(185) // Base + time + streak
        EXPECT(score.bonuses.streak).toBe(50)
        EXPECT(playerState.streak).toBe(6)
```

### 3.2 Integration Testing Strategy

```pseudocode
INTEGRATION_TEST "Game Flow End-to-End":
    SETUP:
        testUser = await createTestUser()
        authToken = await authenticateUser(testUser)
    
    TEST "complete game session flow":
        // Start game
        gameResponse = await api.post('/games/start', {
            mode: 'quick-play'
        }, authToken)
        
        EXPECT(gameResponse.status).toBe(201)
        EXPECT(gameResponse.data.challenges).toHaveLength(10)
        
        gameId = gameResponse.data.gameId
        
        // Submit answers
        FOR challenge IN gameResponse.data.challenges:
            answer = {
                challengeId: challenge.id,
                isAI: determineAnswer(challenge),
                timeSpent: random(5, 25)
            }
            
            submitResponse = await api.post(
                `/games/${gameId}/submit`,
                answer,
                authToken
            )
            
            EXPECT(submitResponse.status).toBe(200)
            EXPECT(submitResponse.data.score).toBeGreaterThan(0)
        
        // Complete game
        completeResponse = await api.post(
            `/games/${gameId}/complete`,
            {},
            authToken
        )
        
        EXPECT(completeResponse.data.totalScore).toBeGreaterThan(0)
        EXPECT(completeResponse.data.accuracy).toBeBetween(0, 1)
        
        // Verify leaderboard update
        leaderboard = await api.get('/leaderboard/global')
        userEntry = leaderboard.data.find(e => e.userId === testUser.id)
        
        EXPECT(userEntry).toBeDefined()
        EXPECT(userEntry.score).toBe(completeResponse.data.totalScore)
```

### 3.3 Performance Testing Strategy

```pseudocode
PERFORMANCE_TEST "API Response Times":
    TEST "should handle 1000 concurrent game sessions":
        users = createVirtualUsers(1000)
        
        results = await runConcurrent(users, async (user) => {
            startTime = Date.now()
            
            // Authenticate
            auth = await api.post('/auth/login', user.credentials)
            
            // Start game
            game = await api.post('/games/start', { mode: 'quick' })
            
            // Submit 10 answers
            FOR i IN range(10):
                await api.post(`/games/${game.id}/submit`, {
                    challengeId: game.challenges[i].id,
                    isAI: random(true, false)
                })
            
            endTime = Date.now()
            return endTime - startTime
        })
        
        percentile95 = calculatePercentile(results, 95)
        EXPECT(percentile95).toBeLessThan(5000) // 5 seconds

LOAD_TEST "Leaderboard Updates":
    TEST "should maintain sub-100ms updates under load":
        // Simulate 10,000 score updates per minute
        rate = 167 // per second
        duration = 60 // seconds
        
        results = await artillery.run({
            target: API_URL,
            phases: [{
                duration: duration,
                arrivalRate: rate
            }],
            scenarios: [{
                flow: [
                    { post: { url: "/games/complete" } }
                ]
            }]
        })
        
        EXPECT(results.latency.p99).toBeLessThan(100)
        EXPECT(results.errors).toBe(0)
```

### 3.4 Security Testing

```pseudocode
SECURITY_TEST "Authentication":
    TEST "should prevent JWT token reuse after logout":
        token = await login(testUser)
        await logout(token)
        
        response = await api.get('/profile', token)
        EXPECT(response.status).toBe(401)
    
    TEST "should rate limit failed login attempts":
        FOR i IN range(10):
            await api.post('/auth/login', {
                email: 'test@example.com',
                password: 'wrong'
            })
        
        response = await api.post('/auth/login', validCredentials)
        EXPECT(response.status).toBe(429) // Too Many Requests

SECURITY_TEST "Input Validation":
    TEST "should sanitize user inputs":
        maliciousInputs = [
            "<script>alert('xss')</script>",
            "'; DROP TABLE users; --",
            "../../../etc/passwd"
        ]
        
        FOR input IN maliciousInputs:
            response = await api.post('/profile/update', {
                bio: input
            })
            
            profile = await api.get('/profile')
            EXPECT(profile.data.bio).not.toContain('<script>')
            EXPECT(profile.data.bio).not.toContain('DROP TABLE')
```

## 4. Architecture Patterns

### 4.1 Event Sourcing for Game State

```pseudocode
PATTERN GameEventSourcing:
    EVENTS:
        - GameStarted(gameId, userId, mode, timestamp)
        - ChallengePresented(gameId, challengeId, content, timestamp)
        - AnswerSubmitted(gameId, challengeId, answer, timeSpent, timestamp)
        - ScoreCalculated(gameId, points, bonuses, timestamp)
        - GameCompleted(gameId, totalScore, accuracy, timestamp)
    
    AGGREGATE GameAggregate:
        STATE:
            gameId: string
            userId: string
            status: GameStatus
            challenges: Challenge[]
            answers: Answer[]
            score: number
            startTime: timestamp
            endTime: timestamp
        
        APPLY_EVENT GameStarted(event):
            this.gameId = event.gameId
            this.userId = event.userId
            this.status = 'active'
            this.startTime = event.timestamp
        
        APPLY_EVENT AnswerSubmitted(event):
            this.answers.push({
                challengeId: event.challengeId,
                answer: event.answer,
                timeSpent: event.timeSpent
            })
        
        REPLAY_EVENTS(events):
            FOR event IN events:
                this.apply(event)
            return this
```

### 4.2 Repository Pattern

```pseudocode
INTERFACE IUserRepository:
    create(userData: UserData): Promise<User>
    findById(id: string): Promise<User>
    findByEmail(email: string): Promise<User>
    update(id: string, updates: Partial<User>): Promise<User>
    delete(id: string): Promise<boolean>

CLASS PostgresUserRepository IMPLEMENTS IUserRepository:
    CONSTRUCTOR(db: DatabaseConnection):
        this.db = db
    
    ASYNC create(userData):
        result = await this.db.query(
            'INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING *',
            [userData.email, userData.username, userData.passwordHash]
        )
        return this.mapToUser(result.rows[0])
    
    ASYNC findById(id):
        result = await this.db.query(
            'SELECT * FROM users WHERE id = $1',
            [id]
        )
        IF result.rows.length == 0:
            return null
        return this.mapToUser(result.rows[0])
```

### 4.3 Strategy Pattern for AI Models

```pseudocode
INTERFACE IDetectionStrategy:
    detect(content: any): Promise<DetectionResult>
    getConfidenceThreshold(): number

CLASS TextGPTDetectionStrategy IMPLEMENTS IDetectionStrategy:
    ASYNC detect(content):
        embeddings = await this.generateEmbeddings(content)
        prediction = await this.model.predict(embeddings)
        return {
            isAI: prediction.score > this.getConfidenceThreshold(),
            confidence: prediction.score,
            technique: 'GPT-style generation'
        }
    
    getConfidenceThreshold():
        return 0.75

CLASS ImageDiffusionDetectionStrategy IMPLEMENTS IDetectionStrategy:
    ASYNC detect(content):
        features = await this.extractFeatures(content)
        artifacts = await this.detectArtifacts(features)
        return {
            isAI: artifacts.count > 0,
            confidence: artifacts.confidence,
            technique: 'Diffusion model generation'
        }

CLASS DetectionContext:
    CONSTRUCTOR():
        this.strategies = new Map()
        this.strategies.set('text', new TextGPTDetectionStrategy())
        this.strategies.set('image', new ImageDiffusionDetectionStrategy())
    
    ASYNC detect(content, type):
        strategy = this.strategies.get(type)
        IF !strategy:
            throw new Error('Unknown content type')
        return strategy.detect(content)
```

## 5. Error Handling and Recovery

```pseudocode
PATTERN CircuitBreaker:
    CLASS CircuitBreaker:
        CONSTRUCTOR(threshold, timeout):
            this.failureCount = 0
            this.threshold = threshold
            this.timeout = timeout
            this.state = 'CLOSED'
            this.nextAttempt = Date.now()
        
        ASYNC call(fn):
            IF this.state == 'OPEN':
                IF Date.now() > this.nextAttempt:
                    this.state = 'HALF_OPEN'
                ELSE:
                    throw new Error('Circuit breaker is OPEN')
            
            TRY:
                result = await fn()
                this.onSuccess()
                return result
            CATCH error:
                this.onFailure()
                throw error
        
        onSuccess():
            this.failureCount = 0
            this.state = 'CLOSED'
        
        onFailure():
            this.failureCount++
            IF this.failureCount >= this.threshold:
                this.state = 'OPEN'
                this.nextAttempt = Date.now() + this.timeout

PATTERN RetryWithBackoff:
    ASYNC retryWithExponentialBackoff(fn, maxRetries = 3):
        FOR attempt IN range(maxRetries):
            TRY:
                return await fn()
            CATCH error:
                IF attempt == maxRetries - 1:
                    throw error
                
                delay = Math.pow(2, attempt) * 1000
                await sleep(delay)
```

This pseudocode design provides a comprehensive foundation for the ThinkRank platform, covering system architecture, core algorithms, testing strategies, and architectural patterns necessary for building a scalable, maintainable gamified AI literacy platform.