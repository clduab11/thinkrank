using System;
using System.Collections;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Text;
using UnityEngine;
using NativeWebSocket;
using Newtonsoft.Json;

namespace ThinkRank.Networking
{
    public class WebSocketManager : MonoBehaviour
    {
        [Header("Connection Settings")]
        [SerializeField] private string serverUrl = "ws://localhost:3008";
        [SerializeField] private bool autoReconnect = true;
        [SerializeField] private float reconnectDelay = 5f;
        [SerializeField] private int maxReconnectAttempts = 10;
        
        [Header("Performance Settings")]
        [SerializeField] private int maxConnectionPoolSize = 5;
        [SerializeField] private float messageBatchInterval = 0.05f; // 50ms
        [SerializeField] private int maxBatchSize = 10;
        [SerializeField] private bool enableConnectionPool = true;
        [SerializeField] private bool enableMessageBatching = true;
        [SerializeField] private bool enableObjectPooling = true;
        
        private WebSocket websocket;
        private bool isConnecting = false;
        private bool isAuthenticated = false;
        private int reconnectAttempts = 0;
        private Coroutine reconnectCoroutine;
        
        // Connection pool for performance
        private Queue<WebSocket> connectionPool = new Queue<WebSocket>();
        private HashSet<WebSocket> activeConnections = new HashSet<WebSocket>();
        
        // Message batching system
        private ConcurrentQueue<SocketMessage> messageBatchQueue = new ConcurrentQueue<SocketMessage>();
        private Coroutine messageBatchCoroutine;
        private bool isBatchProcessingActive = false;
        
        // Object pooling for memory optimization
        private Queue<SocketMessage> messageObjectPool = new Queue<SocketMessage>();
        private StringBuilder stringBuilder = new StringBuilder(1024);
        
        // Connection health monitoring
        private float lastPingTime = 0f;
        private float pingInterval = 30f; // Ping every 30 seconds
        private Dictionary<WebSocket, DateTime> connectionHealthMap = new Dictionary<WebSocket, DateTime>();
        
        // Event system
        public static event Action OnConnected;
        public static event Action OnDisconnected;
        public static event Action<string> OnError;
        public static event Action<SocketMessage> OnMessageReceived;
        
        // Message queue for offline mode
        private ConcurrentQueue<SocketMessage> offlineMessageQueue = new ConcurrentQueue<SocketMessage>();
        private bool isOfflineMode = false;
        
        [System.Serializable]
        public class SocketMessage
        {
            public string type;
            public object data;
            public string timestamp;
            public string id;
            
            public SocketMessage(string messageType, object messageData)
            {
                type = messageType;
                data = messageData;
                timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");
                id = Guid.NewGuid().ToString();
            }
            
            // Pool-friendly reset method
            public void Reset(string messageType, object messageData)
            {
                type = messageType;
                data = messageData;
                timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");
                id = Guid.NewGuid().ToString();
            }
        }
        
        void Start()
        {
            // Initialize performance systems
            InitializePerformanceSystems();
            
            // Initialize WebSocket connection
            InitializeWebSocket();
            
            // Setup Unity lifecycle handlers
            Application.focusChanged += OnApplicationFocus;
            Application.runInBackground = true;
            
            // Start performance monitoring
            StartPerformanceMonitoring();
        }
        
        void Update()
        {
#if !UNITY_WEBGL || UNITY_EDITOR
            // Dispatch messages for all active connections
            foreach (var connection in activeConnections)
            {
                if (connection != null)
                {
                    connection.DispatchMessageQueue();
                }
            }
            
            // Process primary websocket if exists
            if (websocket != null)
            {
                websocket.DispatchMessageQueue();
            }
#endif
            
            // Health monitoring (reduced frequency)
            if (Time.time - lastPingTime > pingInterval)
            {
                MonitorConnectionHealth();
                lastPingTime = Time.time;
            }
        }
        
        private void InitializeWebSocket()
        {
            try
            {
                string authToken = PlayerPrefs.GetString("auth_token", "");
                string wsUrl = $"{serverUrl}?token={authToken}";
                
                websocket = new WebSocket(wsUrl);
                
                websocket.OnOpen += OnWebSocketOpen;
                websocket.OnError += OnWebSocketError;
                websocket.OnClose += OnWebSocketClose;
                websocket.OnMessage += OnWebSocketMessage;
                
                Debug.Log($"WebSocket initialized for URL: {serverUrl}");
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to initialize WebSocket: {e.Message}");
                OnError?.Invoke($"WebSocket initialization failed: {e.Message}");
            }
        }
        
        public async void Connect()
        {
            if (websocket == null)
            {
                InitializeWebSocket();
            }
            
            if (isConnecting || websocket.State == WebSocketState.Open)
            {
                return;
            }
            
            try
            {
                isConnecting = true;
                isOfflineMode = false;
                
                Debug.Log("Attempting to connect to WebSocket server...");
                await websocket.Connect();
            }
            catch (Exception e)
            {
                Debug.LogError($"WebSocket connection failed: {e.Message}");
                isConnecting = false;
                
                // Enable offline mode
                isOfflineMode = true;
                OnError?.Invoke($"Connection failed: {e.Message}");
                
                // Try to reconnect if enabled
                if (autoReconnect && reconnectAttempts < maxReconnectAttempts)
                {
                    StartReconnection();
                }
            }
        }
        
        public async void Disconnect()
        {
            autoReconnect = false; // Disable auto-reconnect for manual disconnect
            
            if (reconnectCoroutine != null)
            {
                StopCoroutine(reconnectCoroutine);
                reconnectCoroutine = null;
            }
            
            if (websocket != null && websocket.State == WebSocketState.Open)
            {
                await websocket.Close();
            }
            
            isAuthenticated = false;
            isOfflineMode = true;
        }
        
        private void OnWebSocketOpen()
        {
            Debug.Log("WebSocket connection opened");
            isConnecting = false;
            reconnectAttempts = 0;
            isOfflineMode = false;
            
            // Send authentication if token is available
            string authToken = PlayerPrefs.GetString("auth_token", "");
            if (!string.IsNullOrEmpty(authToken))
            {
                SendMessage("authenticate", new { token = authToken });
            }
            
            OnConnected?.Invoke();
        }
        
        private void OnWebSocketError(string error)
        {
            Debug.LogError($"WebSocket error: {error}");
            isConnecting = false;
            isOfflineMode = true;
            
            OnError?.Invoke(error);
            
            if (autoReconnect && reconnectAttempts < maxReconnectAttempts)
            {
                StartReconnection();
            }
        }
        
        private void OnWebSocketClose(WebSocketCloseCode closeCode)
        {
            Debug.Log($"WebSocket connection closed: {closeCode}");
            isConnecting = false;
            isAuthenticated = false;
            isOfflineMode = true;
            
            OnDisconnected?.Invoke();
            
            // Auto-reconnect if not manually disconnected
            if (autoReconnect && closeCode != WebSocketCloseCode.Normal && reconnectAttempts < maxReconnectAttempts)
            {
                StartReconnection();
            }
        }
        
        private void OnWebSocketMessage(byte[] data)
        {
            try
            {
                string messageStr = Encoding.UTF8.GetString(data);
                var message = JsonConvert.DeserializeObject<SocketMessage>(messageStr);
                
                Debug.Log($"Received WebSocket message: {message.type}");
                
                // Handle authentication response
                if (message.type == "authenticated")
                {
                    isAuthenticated = true;
                    ProcessOfflineQueue(); // Send queued messages
                }
                else if (message.type == "auth_error")
                {
                    Debug.LogError("Authentication failed");
                    OnError?.Invoke("Authentication failed");
                    return;
                }
                
                OnMessageReceived?.Invoke(message);
            }
            catch (Exception e)
            {
                Debug.LogError($"Error parsing WebSocket message: {e.Message}");
            }
        }
        
        public void SendMessage(string messageType, object data)
        {
            var message = GetPooledMessage(messageType, data);
            
            if (isOfflineMode || websocket?.State != WebSocketState.Open || !isAuthenticated)
            {
                // Queue message for later sending
                offlineMessageQueue.Enqueue(message);
                Debug.Log($"Message queued for offline mode: {messageType}");
                return;
            }
            
            // Use message batching if enabled
            if (enableMessageBatching && isBatchProcessingActive)
            {
                messageBatchQueue.Enqueue(message);
                return;
            }
            
            // Send immediately if batching is disabled
            try
            {
                string jsonMessage = JsonConvert.SerializeObject(message);
                websocket.SendText(jsonMessage);
                Debug.Log($"Sent WebSocket message: {messageType}");
                
                // Return message to pool
                ReturnMessageToPool(message);
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to send WebSocket message: {e.Message}");
                
                // Queue message for retry
                offlineMessageQueue.Enqueue(message);
            }
        }
        
        private void ProcessOfflineQueue()
        {
            while (offlineMessageQueue.Count > 0)
            {
                var message = offlineMessageQueue.Dequeue();
                
                try
                {
                    string jsonMessage = JsonConvert.SerializeObject(message);
                    websocket.SendText(jsonMessage);
                    Debug.Log($"Sent queued message: {message.type}");
                }
                catch (Exception e)
                {
                    Debug.LogError($"Failed to send queued message: {e.Message}");
                    // Put message back in queue
                    offlineMessageQueue.Enqueue(message);
                    break;
                }
            }
        }
        
        private void StartReconnection()
        {
            if (reconnectCoroutine != null)
            {
                StopCoroutine(reconnectCoroutine);
            }
            
            reconnectCoroutine = StartCoroutine(ReconnectionCoroutine());
        }
        
        private IEnumerator ReconnectionCoroutine()
        {
            while (reconnectAttempts < maxReconnectAttempts && autoReconnect)
            {
                reconnectAttempts++;
                
                Debug.Log($"Attempting to reconnect... (Attempt {reconnectAttempts}/{maxReconnectAttempts})");
                
                yield return new WaitForSeconds(reconnectDelay);
                
                if (websocket?.State != WebSocketState.Open)
                {
                    Connect();
                    
                    // Wait a bit to see if connection succeeds
                    yield return new WaitForSeconds(2f);
                    
                    if (websocket?.State == WebSocketState.Open)
                    {
                        Debug.Log("Reconnection successful!");
                        break;
                    }
                }
                else
                {
                    break; // Already connected
                }
                
                // Exponential backoff
                reconnectDelay = Mathf.Min(reconnectDelay * 1.5f, 30f);
            }
            
            if (reconnectAttempts >= maxReconnectAttempts)
            {
                Debug.LogError("Max reconnection attempts reached. Giving up.");
                OnError?.Invoke("Max reconnection attempts reached");
            }
            
            reconnectCoroutine = null;
        }
        
        private void OnApplicationFocus(bool hasFocus)
        {
            if (hasFocus && isOfflineMode && autoReconnect)
            {
                // Try to reconnect when app regains focus
                reconnectAttempts = 0;
                reconnectDelay = 5f;
                StartReconnection();
            }
        }
        
        private void OnApplicationPause(bool pauseStatus)
        {
            if (pauseStatus)
            {
                // Send heartbeat to maintain connection
                SendHeartbeat();
            }
        }
        
        private void SendHeartbeat()
        {
            if (websocket?.State == WebSocketState.Open && isAuthenticated)
            {
                SendMessage("ping", new { timestamp = DateTime.UtcNow });
            }
        }
        
        #region Performance Optimization Methods
        
        private void InitializePerformanceSystems()
        {
            // Initialize object pools
            if (enableObjectPooling)
            {
                for (int i = 0; i < 50; i++) // Pre-allocate 50 message objects
                {
                    messageObjectPool.Enqueue(new SocketMessage("", null));
                }
            }
            
            // Start message batching if enabled
            if (enableMessageBatching)
            {
                messageBatchCoroutine = StartCoroutine(MessageBatchProcessor());
                isBatchProcessingActive = true;
            }
            
            Debug.Log("Performance systems initialized");
        }
        
        private void StartPerformanceMonitoring()
        {
            InvokeRepeating(nameof(PerformanceHealthCheck), 60f, 60f); // Every minute
        }
        
        private void PerformanceHealthCheck()
        {
            // Monitor memory usage
            long memoryUsage = GC.GetTotalMemory(false);
            Debug.Log($"WebSocket Memory Usage: {memoryUsage / 1024 / 1024}MB");
            
            // Monitor connection pool efficiency
            if (enableConnectionPool)
            {
                Debug.Log($"Connection Pool - Available: {connectionPool.Count}, Active: {activeConnections.Count}");
            }
            
            // Monitor message queue sizes
            Debug.Log($"Message Queues - Batch: {messageBatchQueue.Count}, Offline: {offlineMessageQueue.Count}");
            
            // Trigger GC if memory usage is high
            if (memoryUsage > 100 * 1024 * 1024) // 100MB threshold
            {
                GC.Collect();
                Debug.LogWarning("High memory usage detected, triggering GC");
            }
        }
        
        private WebSocket GetPooledConnection()
        {
            if (!enableConnectionPool || connectionPool.Count == 0)
            {
                return CreateNewConnection();
            }
            
            var connection = connectionPool.Dequeue();
            activeConnections.Add(connection);
            connectionHealthMap[connection] = DateTime.UtcNow;
            
            return connection;
        }
        
        private void ReturnConnectionToPool(WebSocket connection)
        {
            if (!enableConnectionPool || connectionPool.Count >= maxConnectionPoolSize)
            {
                connection?.Close();
                return;
            }
            
            activeConnections.Remove(connection);
            connectionHealthMap.Remove(connection);
            
            if (connection?.State == WebSocketState.Open)
            {
                connectionPool.Enqueue(connection);
            }
            else
            {
                connection?.Close();
            }
        }
        
        private WebSocket CreateNewConnection()
        {
            string authToken = PlayerPrefs.GetString("auth_token", "");
            string wsUrl = $"{serverUrl}?token={authToken}";
            
            var newConnection = new WebSocket(wsUrl);
            newConnection.OnOpen += OnWebSocketOpen;
            newConnection.OnError += OnWebSocketError;
            newConnection.OnClose += OnWebSocketClose;
            newConnection.OnMessage += OnWebSocketMessage;
            
            activeConnections.Add(newConnection);
            connectionHealthMap[newConnection] = DateTime.UtcNow;
            
            return newConnection;
        }
        
        private SocketMessage GetPooledMessage(string messageType, object data)
        {
            if (!enableObjectPooling || messageObjectPool.Count == 0)
            {
                return new SocketMessage(messageType, data);
            }
            
            var message = messageObjectPool.Dequeue();
            message.Reset(messageType, data);
            return message;
        }
        
        private void ReturnMessageToPool(SocketMessage message)
        {
            if (!enableObjectPooling || messageObjectPool.Count >= 100)
            {
                return; // Let GC handle it
            }
            
            // Clear sensitive data
            message.type = "";
            message.data = null;
            message.timestamp = "";
            message.id = "";
            
            messageObjectPool.Enqueue(message);
        }
        
        private IEnumerator MessageBatchProcessor()
        {
            var batchedMessages = new List<SocketMessage>(maxBatchSize);
            
            while (isBatchProcessingActive)
            {
                yield return new WaitForSeconds(messageBatchInterval);
                
                if (messageBatchQueue.IsEmpty || !IsConnected)
                {
                    continue;
                }
                
                // Collect messages for batching
                batchedMessages.Clear();
                int batchCount = 0;
                
                while (batchCount < maxBatchSize && messageBatchQueue.TryDequeue(out SocketMessage message))
                {
                    batchedMessages.Add(message);
                    batchCount++;
                }
                
                if (batchedMessages.Count > 0)
                {
                    SendBatchedMessages(batchedMessages);
                }
            }
        }
        
        private void SendBatchedMessages(List<SocketMessage> messages)
        {
            try
            {
                // Use StringBuilder for efficient string concatenation
                stringBuilder.Clear();
                stringBuilder.Append("{");
                stringBuilder.Append("\"type\":\"batch\",");
                stringBuilder.Append("\"messages\":[");
                
                for (int i = 0; i < messages.Count; i++)
                {
                    if (i > 0) stringBuilder.Append(",");
                    
                    string messageJson = JsonConvert.SerializeObject(messages[i]);
                    stringBuilder.Append(messageJson);
                    
                    // Return message to pool
                    ReturnMessageToPool(messages[i]);
                }
                
                stringBuilder.Append("],");
                stringBuilder.Append($"\"batchId\":\"{Guid.NewGuid()}\",");
                stringBuilder.Append($"\"timestamp\":\"{DateTime.UtcNow:yyyy-MM-ddTHH:mm:ss.fffZ}\"}");
                
                websocket.SendText(stringBuilder.ToString());
                
                Debug.Log($"Sent batch of {messages.Count} messages");
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to send batched messages: {e.Message}");
                
                // Re-queue messages on failure
                foreach (var message in messages)
                {
                    messageBatchQueue.Enqueue(message);
                }
            }
        }
        
        private void MonitorConnectionHealth()
        {
            var currentTime = DateTime.UtcNow;
            var unhealthyConnections = new List<WebSocket>();
            
            foreach (var kvp in connectionHealthMap)
            {
                if ((currentTime - kvp.Value).TotalMinutes > 5) // 5 minutes without activity
                {
                    unhealthyConnections.Add(kvp.Key);
                }
            }
            
            // Clean up unhealthy connections
            foreach (var connection in unhealthyConnections)
            {
                Debug.LogWarning("Removing unhealthy connection from pool");
                activeConnections.Remove(connection);
                connectionHealthMap.Remove(connection);
                connection?.Close();
            }
        }
        
        #endregion
        
        // Game-specific methods
        public void JoinGame(string gameId, string gameType)
        {
            SendMessage("join_game", new { gameId, gameType });
        }
        
        public void LeaveGame(string gameId)
        {
            SendMessage("leave_game", new { gameId });
        }
        
        public void SendGameAction(string gameId, string action, object payload)
        {
            SendMessage("game_action", new { gameId, action, payload });
        }
        
        public void SendChatMessage(string target, string type, string message)
        {
            SendMessage("send_message", new { target, type, message });
        }
        
        public void Subscribe(string channel)
        {
            SendMessage("subscribe", new { channel });
        }
        
        public void Unsubscribe(string channel)
        {
            SendMessage("unsubscribe", new { channel });
        }
        
        // State management
        public bool IsConnected => websocket?.State == WebSocketState.Open && isAuthenticated;
        public bool IsOffline => isOfflineMode;
        public int QueuedMessageCount => offlineMessageQueue.Count;
        public int ReconnectAttempts => reconnectAttempts;
        
        // Performance metrics
        public int ActiveConnectionCount => activeConnections.Count;
        public int PooledConnectionCount => connectionPool.Count;
        public int BatchQueueCount => messageBatchQueue.Count;
        public int MessagePoolCount => messageObjectPool.Count;
        
        void OnDestroy()
        {
            Application.focusChanged -= OnApplicationFocus;
            
            // Stop performance systems
            isBatchProcessingActive = false;
            if (messageBatchCoroutine != null)
            {
                StopCoroutine(messageBatchCoroutine);
            }
            
            CancelInvoke(nameof(PerformanceHealthCheck));
            
            // Clean up all connections
            if (websocket != null)
            {
                websocket.Close();
            }
            
            foreach (var connection in activeConnections)
            {
                connection?.Close();
            }
            
            while (connectionPool.Count > 0)
            {
                var connection = connectionPool.Dequeue();
                connection?.Close();
            }
            
            activeConnections.Clear();
            connectionHealthMap.Clear();
            
            Debug.Log("WebSocket performance systems cleaned up");
        }
    }
}