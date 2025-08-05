using System;
using System.Collections.Generic;
using UnityEngine;
using Newtonsoft.Json;

namespace ThinkRank.Networking
{
    public class GameStateSync : MonoBehaviour
    {
        [Header("Sync Settings")]
        [SerializeField] private float syncBatchInterval = 0.05f; // 50ms batching for better performance
        [SerializeField] private bool enableDeltaSync = true;
        [SerializeField] private bool enableStateCompression = true;
        [SerializeField] private bool enableAdaptiveQuality = true;
        [SerializeField] private int maxStateHistorySize = 50; // Reduced for memory efficiency
        [SerializeField] private float adaptiveQualityThreshold = 100f; // ms latency threshold
        
        private WebSocketManager webSocketManager;
        private Dictionary<string, object> currentGameState = new Dictionary<string, object>();
        private Dictionary<string, object> lastSyncedState = new Dictionary<string, object>();
        private Queue<StateUpdate> pendingUpdates = new Queue<StateUpdate>();
        private List<StateSnapshot> stateHistory = new List<StateSnapshot>();
        
        // Performance optimization fields
        private Dictionary<string, object> deltaChanges = new Dictionary<string, object>();
        private Queue<StateUpdate> updatePool = new Queue<StateUpdate>();
        private StringBuilder jsonBuilder = new StringBuilder(2048);
        private float currentNetworkLatency = 0f;
        private int currentQuality = 100; // 100% = full quality
        private Coroutine adaptiveQualityCoroutine;
        
        // Events
        public static event Action<GameStateData> OnGameStateReceived;
        public static event Action<string, object> OnGameStateUpdated;
        public static event Action<string> OnGameJoined;
        public static event Action<string> OnGameLeft;
        public static event Action<PlayerData> OnPlayerJoined;
        public static event Action<PlayerData> OnPlayerLeft;
        
        [System.Serializable]
        public class StateUpdate
        {
            public string key;
            public object value;
            public float timestamp;
            public string updateId;
            
            public StateUpdate(string stateKey, object stateValue)
            {
                key = stateKey;
                value = stateValue;
                timestamp = Time.time;
                updateId = Guid.NewGuid().ToString();
            }
        }
        
        [System.Serializable]
        public class StateSnapshot
        {
            public Dictionary<string, object> state;
            public float timestamp;
            public int version;
            
            public StateSnapshot(Dictionary<string, object> gameState, int stateVersion)
            {
                state = new Dictionary<string, object>(gameState);
                timestamp = Time.time;
                version = stateVersion;
            }
        }
        
        [System.Serializable]
        public class GameStateData
        {
            public string id;
            public string type;
            public string status;
            public List<PlayerData> players;
            public int currentRound;
            public int totalRounds;
            public object state;
            public int version;
            public string lastUpdated;
        }
        
        [System.Serializable]
        public class PlayerData
        {
            public string id;
            public string username;
            public string joinedAt;
            public string status;
            public float score;
            public object progress;
        }
        
        [System.Serializable]
        public class GameActionResult
        {
            public string userId;
            public string action;
            public object result;
            public string timestamp;
        }
        
        void Start()
        {
            webSocketManager = FindObjectOfType<WebSocketManager>();
            
            if (webSocketManager == null)
            {
                Debug.LogError("WebSocketManager not found! GameStateSync requires WebSocketManager.");
                return;
            }
            
            // Initialize performance systems
            InitializePerformanceSystems();
            
            // Subscribe to WebSocket events
            WebSocketManager.OnMessageReceived += HandleWebSocketMessage;
            WebSocketManager.OnConnected += OnWebSocketConnected;
            WebSocketManager.OnDisconnected += OnWebSocketDisconnected;
            
            // Start optimized processing coroutines
            StartCoroutine(StateSyncBatchProcessor());
            
            if (enableAdaptiveQuality)
            {
                adaptiveQualityCoroutine = StartCoroutine(AdaptiveQualityManager());
            }
        }
        
        private void HandleWebSocketMessage(WebSocketManager.SocketMessage message)
        {
            switch (message.type)
            {
                case "game_state":
                    HandleGameStateMessage(message.data);
                    break;
                    
                case "game_action_result":
                    HandleGameActionResult(message.data);
                    break;
                    
                case "player_joined":
                    HandlePlayerJoined(message.data);
                    break;
                    
                case "player_left":
                    HandlePlayerLeft(message.data);
                    break;
                    
                case "game_update":
                    HandleGameUpdate(message.data);
                    break;
                    
                case "state_sync_request":
                    HandleStateSyncRequest(message.data);
                    break;
                    
                case "connection_restored":
                    HandleConnectionRestored(message.data);
                    break;
            }
        }
        
        private void HandleGameStateMessage(object data)
        {
            try
            {
                string jsonData = JsonConvert.SerializeObject(data);
                var gameState = JsonConvert.DeserializeObject<GameStateData>(jsonData);
                
                Debug.Log($"Received game state for game {gameState.id}");
                
                // Update local game state
                UpdateLocalGameState(gameState);
                
                // Create snapshot
                CreateStateSnapshot(gameState.version);
                
                OnGameStateReceived?.Invoke(gameState);
            }
            catch (Exception e)
            {
                Debug.LogError($"Error handling game state message: {e.Message}");
            }
        }
        
        private void HandleGameActionResult(object data)
        {
            try
            {
                string jsonData = JsonConvert.SerializeObject(data);
                var actionResult = JsonConvert.DeserializeObject<GameActionResult>(jsonData);
                
                Debug.Log($"Game action result: {actionResult.action} by {actionResult.userId}");
                
                // Apply action result to local state
                ApplyActionResult(actionResult);
            }
            catch (Exception e)
            {
                Debug.LogError($"Error handling game action result: {e.Message}");
            }
        }
        
        private void HandlePlayerJoined(object data)
        {
            try
            {
                string jsonData = JsonConvert.SerializeObject(data);
                var playerData = JsonConvert.DeserializeObject<PlayerData>(jsonData);
                
                Debug.Log($"Player joined: {playerData.username}");
                OnPlayerJoined?.Invoke(playerData);
            }
            catch (Exception e)
            {
                Debug.LogError($"Error handling player joined: {e.Message}");
            }
        }
        
        private void HandlePlayerLeft(object data)
        {
            try
            {
                string jsonData = JsonConvert.SerializeObject(data);
                var playerData = JsonConvert.DeserializeObject<PlayerData>(jsonData);
                
                Debug.Log($"Player left: {playerData.username}");
                OnPlayerLeft?.Invoke(playerData);
            }
            catch (Exception e)
            {
                Debug.LogError($"Error handling player left: {e.Message}");
            }
        }
        
        private void HandleGameUpdate(object data)
        {
            try
            {
                var updateData = JsonConvert.DeserializeObject<Dictionary<string, object>>(
                    JsonConvert.SerializeObject(data)
                );
                
                foreach (var kvp in updateData)
                {
                    UpdateGameStateProperty(kvp.Key, kvp.Value);
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"Error handling game update: {e.Message}");
            }
        }
        
        private void HandleStateSyncRequest(object data)
        {
            // Server is requesting full state sync (conflict resolution)
            Debug.Log("Server requested state sync");
            SendFullStateSync();
        }
        
        private void HandleConnectionRestored(object data)
        {
            Debug.Log("Connection restored, requesting state sync");
            RequestStateSynchronization();
        }
        
        private void OnWebSocketConnected()
        {
            Debug.Log("WebSocket connected, ready for game state sync");
        }
        
        private void OnWebSocketDisconnected()
        {
            Debug.Log("WebSocket disconnected, state sync paused");
        }
        
        // Local state management
        public void UpdateGameStateProperty(string key, object value)
        {
            bool hasChanged = false;
            
            if (currentGameState.ContainsKey(key))
            {
                // Check if value actually changed
                if (!AreEqual(currentGameState[key], value))
                {
                    currentGameState[key] = value;
                    hasChanged = true;
                }
            }
            else
            {
                currentGameState[key] = value;
                hasChanged = true;
            }
            
            if (hasChanged)
            {
                // Store in delta changes for compression
                if (enableDeltaSync)
                {
                    deltaChanges[key] = value;
                }
                
                QueueStateUpdate(key, value);
                OnGameStateUpdated?.Invoke(key, value);
            }
        }
        
        public T GetGameStateProperty<T>(string key, T defaultValue = default(T))
        {
            if (currentGameState.ContainsKey(key))
            {
                try
                {
                    return (T)currentGameState[key];
                }
                catch
                {
                    return defaultValue;
                }
            }
            
            return defaultValue;
        }
        
        public void SetPlayerProgress(string playerId, object progress)
        {
            UpdateGameStateProperty($"player_{playerId}_progress", progress);
        }
        
        public void SetPlayerScore(string playerId, float score)
        {
            UpdateGameStateProperty($"player_{playerId}_score", score);
        }
        
        public void SetGameRound(int round)
        {
            UpdateGameStateProperty("currentRound", round);
        }
        
        public void SetGameStatus(string status)
        {
            UpdateGameStateProperty("gameStatus", status);
        }
        
        private void QueueStateUpdate(string key, object value)
        {
            if (enableDeltaSync)
            {
                pendingUpdates.Enqueue(new StateUpdate(key, value));
            }
        }
        
        private System.Collections.IEnumerator StateSyncBatchProcessor()
        {
            while (true)
            {
                yield return new WaitForSeconds(syncBatchInterval);
                
                if (pendingUpdates.Count > 0 && webSocketManager.IsConnected)
                {
                    ProcessPendingUpdatesOptimized();
                }
            }
        }
        
        #region Performance Optimization Methods
        
        private void InitializePerformanceSystems()
        {
            // Pre-allocate update objects for pooling
            for (int i = 0; i < 50; i++)
            {
                updatePool.Enqueue(new StateUpdate(\"\", null));
            }
            
            Debug.Log(\"GameStateSync performance systems initialized\");
        }
        
        private IEnumerator AdaptiveQualityManager()
        {
            while (true)
            {
                yield return new WaitForSeconds(1f); // Check every second
                
                // Measure network latency (simplified estimation)
                float avgLatency = EstimateNetworkLatency();
                currentNetworkLatency = avgLatency;
                
                // Adjust quality based on latency
                if (avgLatency > adaptiveQualityThreshold)
                {
                    // Reduce quality to maintain performance
                    currentQuality = Mathf.Max(25, currentQuality - 10);
                    syncBatchInterval = Mathf.Min(0.2f, syncBatchInterval + 0.01f);
                }
                else if (avgLatency < adaptiveQualityThreshold * 0.5f)
                {
                    // Increase quality when network is good
                    currentQuality = Mathf.Min(100, currentQuality + 5);
                    syncBatchInterval = Mathf.Max(0.05f, syncBatchInterval - 0.005f);
                }
                
                Debug.Log($"Adaptive Quality: {currentQuality}%, Latency: {avgLatency}ms, Interval: {syncBatchInterval}s");
            }
        }
        
        private float EstimateNetworkLatency()
        {
            // Simple estimation based on message processing time
            // In production, you'd want more sophisticated measurement
            return UnityEngine.Random.Range(50f, 200f); // Placeholder
        }
        
        private StateUpdate GetPooledUpdate(string key, object value)
        {
            if (updatePool.Count > 0)
            {
                var update = updatePool.Dequeue();
                update.key = key;
                update.value = value;
                update.timestamp = Time.time;
                update.updateId = System.Guid.NewGuid().ToString();
                return update;
            }
            
            return new StateUpdate(key, value);
        }
        
        private void ReturnUpdateToPool(StateUpdate update)
        {
            if (updatePool.Count < 100) // Limit pool size
            {
                // Clear sensitive data
                update.key = "";
                update.value = null;
                updatePool.Enqueue(update);
            }
        }
        
        private void ProcessPendingUpdatesOptimized()
        {
            if (!enableDeltaSync)
            {
                ProcessPendingUpdates(); // Fallback to original method
                return;
            }
            
            if (deltaChanges.Count == 0) return;
            
            try
            {
                // Create compressed delta update
                var deltaUpdate = CreateCompressedDeltaUpdate();
                
                if (deltaUpdate != null)
                {
                    webSocketManager.SendMessage("game_state_delta", deltaUpdate);
                    
                    // Clear processed deltas
                    deltaChanges.Clear();
                    
                    // Update last synced state
                    foreach (var kvp in currentGameState)
                    {
                        lastSyncedState[kvp.Key] = kvp.Value;
                    }
                    
                    Debug.Log($"Sent optimized delta update with {deltaUpdate.changes.Count} changes");
                }
            }
            catch (System.Exception e)
            {
                Debug.LogError($"Error processing optimized updates: {e.Message}");
                // Fallback to original method
                ProcessPendingUpdates();
            }
        }
        
        private DeltaUpdate CreateCompressedDeltaUpdate()
        {
            if (deltaChanges.Count == 0) return null;
            
            var changes = new Dictionary<string, object>();
            
            // Apply quality reduction if needed
            foreach (var kvp in deltaChanges)
            {
                if (ShouldIncludeInDelta(kvp.Key, kvp.Value))
                {
                    changes[kvp.Key] = ApplyQualityReduction(kvp.Key, kvp.Value);
                }
            }
            
            if (changes.Count == 0) return null;
            
            return new DeltaUpdate
            {
                changes = changes,
                timestamp = Time.time,
                version = GetGameStateProperty<int>("version", 0) + 1,
                deltaId = System.Guid.NewGuid().ToString(),
                quality = currentQuality
            };
        }
        
        private bool ShouldIncludeInDelta(string key, object value)
        {
            // Skip non-essential updates when quality is reduced
            if (currentQuality < 50)
            {
                // Only include critical state changes
                if (key.Contains("score") || key.Contains("round") || key.Contains("status"))
                {
                    return true;
                }
                
                // Skip position updates when quality is low
                if (key.Contains("position") || key.Contains("rotation"))
                {
                    return false;
                }
            }
            
            return true;
        }
        
        private object ApplyQualityReduction(string key, object value)
        {
            if (currentQuality >= 100) return value;
            
            // Reduce precision for numeric values when quality is low
            if (value is float floatValue && currentQuality < 75)
            {
                // Reduce precision for position/rotation data
                if (key.Contains("position") || key.Contains("rotation"))
                {
                    return Mathf.Round(floatValue * 10f) / 10f; // 1 decimal place
                }
            }
            
            return value;
        }
        
        #endregion
        
        [System.Serializable]
        public class DeltaUpdate
        {
            public Dictionary<string, object> changes;
            public float timestamp;
            public int version;
            public string deltaId;
            public int quality;
        }"}
        
        private void ProcessPendingUpdates()
        {
            var updates = new List<StateUpdate>();
            
            // Collect all pending updates
            while (pendingUpdates.Count > 0)
            {
                updates.Add(pendingUpdates.Dequeue());
            }
            
            if (updates.Count == 0) return;
            
            // Send batched updates
            var updateData = new
            {
                type = "state_update",
                updates = updates.ConvertAll(u => new { u.key, u.value, u.timestamp, u.updateId }),
                batchId = Guid.NewGuid().ToString(),
                timestamp = Time.time
            };
            
            webSocketManager.SendMessage("game_state_update", updateData);
            
            Debug.Log($"Sent {updates.Count} state updates to server");
        }
        
        private void UpdateLocalGameState(GameStateData gameState)
        {
            // Update core game properties
            currentGameState["gameId"] = gameState.id;
            currentGameState["gameType"] = gameState.type;
            currentGameState["gameStatus"] = gameState.status;
            currentGameState["currentRound"] = gameState.currentRound;
            currentGameState["totalRounds"] = gameState.totalRounds;
            currentGameState["version"] = gameState.version;
            
            // Update player data
            if (gameState.players != null)
            {
                for (int i = 0; i < gameState.players.Count; i++)
                {
                    var player = gameState.players[i];
                    currentGameState[$"player_{player.id}_username"] = player.username;
                    currentGameState[$"player_{player.id}_status"] = player.status;
                    currentGameState[$"player_{player.id}_score"] = player.score;
                    currentGameState[$"player_{player.id}_progress"] = player.progress;
                }
            }
            
            // Update game-specific state
            if (gameState.state != null)
            {
                var stateDict = JsonConvert.DeserializeObject<Dictionary<string, object>>(
                    JsonConvert.SerializeObject(gameState.state)
                );
                
                foreach (var kvp in stateDict)
                {
                    currentGameState[kvp.Key] = kvp.Value;
                }
            }
            
            // Update last synced state
            lastSyncedState = new Dictionary<string, object>(currentGameState);
        }
        
        private void ApplyActionResult(GameActionResult actionResult)
        {
            // Apply action result to appropriate state properties
            switch (actionResult.action)
            {
                case "submit_answer":
                    if (actionResult.result != null)
                    {
                        var resultDict = JsonConvert.DeserializeObject<Dictionary<string, object>>(
                            JsonConvert.SerializeObject(actionResult.result)
                        );
                        
                        foreach (var kvp in resultDict)
                        {
                            UpdateGameStateProperty($"action_result_{kvp.Key}", kvp.Value);
                        }
                    }
                    break;
                    
                case "select_response":
                    UpdateGameStateProperty($"player_{actionResult.userId}_last_response", actionResult.result);
                    break;
                    
                case "evaluate_context":
                    UpdateGameStateProperty($"player_{actionResult.userId}_evaluation", actionResult.result);
                    break;
            }
        }
        
        private void CreateStateSnapshot(int version)
        {
            var snapshot = new StateSnapshot(currentGameState, version);
            stateHistory.Add(snapshot);
            
            // Limit history size
            while (stateHistory.Count > maxStateHistorySize)
            {
                stateHistory.RemoveAt(0);
            }
        }
        
        public StateSnapshot GetStateSnapshot(int version)
        {
            return stateHistory.Find(s => s.version == version);
        }
        
        public StateSnapshot GetLatestSnapshot()
        {
            return stateHistory.Count > 0 ? stateHistory[stateHistory.Count - 1] : null;
        }
        
        private void SendFullStateSync()
        {
            var syncData = new
            {
                currentState = currentGameState,
                version = GetGameStateProperty<int>("version", 0),
                timestamp = Time.time
            };
            
            webSocketManager.SendMessage("full_state_sync", syncData);
        }
        
        private void RequestStateSynchronization()
        {
            var requestData = new
            {
                lastKnownVersion = GetGameStateProperty<int>("version", 0),
                timestamp = Time.time
            };
            
            webSocketManager.SendMessage("request_state_sync", requestData);
        }
        
        // Conflict resolution
        public void ResolveStateConflict(Dictionary<string, object> serverState, int serverVersion)
        {
            Debug.Log($"Resolving state conflict. Server version: {serverVersion}");
            
            // Simple last-write-wins strategy
            // In production, you might want more sophisticated conflict resolution
            currentGameState = new Dictionary<string, object>(serverState);
            UpdateGameStateProperty("version", serverVersion);
            
            CreateStateSnapshot(serverVersion);
        }
        
        // Utility methods
        private bool AreEqual(object obj1, object obj2)
        {
            if (obj1 == null && obj2 == null) return true;
            if (obj1 == null || obj2 == null) return false;
            
            return obj1.Equals(obj2);
        }
        
        // Public API for game components
        public Dictionary<string, object> GetCurrentGameState()
        {
            return new Dictionary<string, object>(currentGameState);
        }
        
        public bool IsStateSynced()
        {
            return webSocketManager.IsConnected && AreStatesEqual(currentGameState, lastSyncedState);
        }
        
        private bool AreStatesEqual(Dictionary<string, object> state1, Dictionary<string, object> state2)
        {
            if (state1.Count != state2.Count) return false;
            
            foreach (var kvp in state1)
            {
                if (!state2.ContainsKey(kvp.Key) || !AreEqual(kvp.Value, state2[kvp.Key]))
                {
                    return false;
                }
            }
            
            return true;
        }
        
        void OnDestroy()
        {
            // Unsubscribe from events
            WebSocketManager.OnMessageReceived -= HandleWebSocketMessage;
            WebSocketManager.OnConnected -= OnWebSocketConnected;
            WebSocketManager.OnDisconnected -= OnWebSocketDisconnected;
        }
    }
}