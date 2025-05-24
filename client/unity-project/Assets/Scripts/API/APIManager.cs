using System;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;
using Newtonsoft.Json;
using ThinkRank.Core;

namespace ThinkRank.API
{
    /// <summary>
    /// Manages all API communication with the ThinkRank backend services
    /// Handles authentication, request/response processing, and error handling
    /// </summary>
    public class APIManager : MonoBehaviour
    {
        [Header("API Configuration")]
        [SerializeField] private GameConfiguration gameConfig;

        // Authentication state
        private string accessToken;
        private string refreshToken;
        private DateTime tokenExpiryTime;
        private bool isAuthenticated = false;

        // Request management
        private Queue<APIRequest> requestQueue = new Queue<APIRequest>();
        private bool isProcessingRequests = false;
        private Dictionary<string, UnityWebRequest> activeRequests = new Dictionary<string, UnityWebRequest>();

        // Events
        public static event Action<bool> OnAuthenticationStateChanged;
        public static event Action<APIError> OnAPIError;
        public static event Action OnNetworkConnectionChanged;

        // Properties
        public bool IsAuthenticated => isAuthenticated && !IsTokenExpired();
        public bool IsOnline => Application.internetReachability != NetworkReachability.NotReachable;

        /// <summary>
        /// Initialize the API Manager
        /// </summary>
        public async System.Threading.Tasks.Task Initialize()
        {
            Debug.Log("[APIManager] Initializing API Manager...");

            // Load saved authentication data
            LoadAuthenticationData();

            // Start request processing coroutine
            StartCoroutine(ProcessRequestQueue());

            // Check connectivity
            StartCoroutine(MonitorNetworkConnection());

            // Validate existing token if present
            if (!string.IsNullOrEmpty(accessToken))
            {
                await ValidateToken();
            }

            Debug.Log($"[APIManager] Initialized - Authenticated: {IsAuthenticated}");
        }

        #region Authentication

        /// <summary>
        /// Authenticate user with email and password
        /// </summary>
        public async System.Threading.Tasks.Task<AuthResponse> LoginAsync(string email, string password, bool rememberMe = true)
        {
            var loginRequest = new LoginRequest
            {
                email = email,
                password = password,
                remember_me = rememberMe
            };

            try
            {
                var response = await SendRequestAsync<LoginRequest, AuthResponse>(
                    "POST",
                    gameConfig.GetFullAPIUrl(gameConfig.authServiceEndpoint + "/login"),
                    loginRequest
                );

                if (response.success && response.data != null)
                {
                    SetAuthenticationData(response.data);
                    SaveAuthenticationData();

                    isAuthenticated = true;
                    OnAuthenticationStateChanged?.Invoke(true);

                    Debug.Log("[APIManager] Login successful");
                    return response.data;
                }
                else
                {
                    Debug.LogWarning($"[APIManager] Login failed: {response.error?.message}");
                    return null;
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"[APIManager] Login error: {e.Message}");
                OnAPIError?.Invoke(new APIError { message = e.Message, code = "LOGIN_ERROR" });
                return null;
            }
        }

        /// <summary>
        /// Register new user account
        /// </summary>
        public async System.Threading.Tasks.Task<AuthResponse> RegisterAsync(string email, string username, string password, string confirmPassword)
        {
            var registerRequest = new RegisterRequest
            {
                email = email,
                username = username,
                password = password,
                confirm_password = confirmPassword,
                terms_accepted = true
            };

            try
            {
                var response = await SendRequestAsync<RegisterRequest, AuthResponse>(
                    "POST",
                    gameConfig.GetFullAPIUrl(gameConfig.authServiceEndpoint + "/register"),
                    registerRequest
                );

                if (response.success && response.data != null)
                {
                    SetAuthenticationData(response.data);
                    SaveAuthenticationData();

                    isAuthenticated = true;
                    OnAuthenticationStateChanged?.Invoke(true);

                    Debug.Log("[APIManager] Registration successful");
                    return response.data;
                }
                else
                {
                    Debug.LogWarning($"[APIManager] Registration failed: {response.error?.message}");
                    return null;
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"[APIManager] Registration error: {e.Message}");
                OnAPIError?.Invoke(new APIError { message = e.Message, code = "REGISTER_ERROR" });
                return null;
            }
        }

        /// <summary>
        /// Refresh authentication token
        /// </summary>
        public async System.Threading.Tasks.Task<bool> RefreshTokenAsync()
        {
            if (string.IsNullOrEmpty(refreshToken))
            {
                Debug.LogWarning("[APIManager] No refresh token available");
                return false;
            }

            var refreshRequest = new RefreshTokenRequest
            {
                refresh_token = refreshToken
            };

            try
            {
                var response = await SendRequestAsync<RefreshTokenRequest, AuthResponse>(
                    "POST",
                    gameConfig.GetFullAPIUrl(gameConfig.authServiceEndpoint + "/refresh"),
                    refreshRequest
                );

                if (response.success && response.data != null)
                {
                    SetAuthenticationData(response.data);
                    SaveAuthenticationData();

                    Debug.Log("[APIManager] Token refreshed successfully");
                    return true;
                }
                else
                {
                    Debug.LogWarning("[APIManager] Token refresh failed");
                    Logout();
                    return false;
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"[APIManager] Token refresh error: {e.Message}");
                Logout();
                return false;
            }
        }

        /// <summary>
        /// Validate current token with server
        /// </summary>
        public async System.Threading.Tasks.Task<bool> ValidateToken()
        {
            if (string.IsNullOrEmpty(accessToken))
                return false;

            try
            {
                var response = await SendRequestAsync<object, object>(
                    "GET",
                    gameConfig.GetFullAPIUrl(gameConfig.authServiceEndpoint + "/validate"),
                    null
                );

                if (response.success)
                {
                    isAuthenticated = true;
                    OnAuthenticationStateChanged?.Invoke(true);
                    return true;
                }
                else
                {
                    // Token is invalid, try to refresh
                    return await RefreshTokenAsync();
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"[APIManager] Token validation error: {e.Message}");
                return await RefreshTokenAsync();
            }
        }

        /// <summary>
        /// Logout user and clear authentication data
        /// </summary>
        public void Logout()
        {
            accessToken = null;
            refreshToken = null;
            tokenExpiryTime = DateTime.MinValue;
            isAuthenticated = false;

            ClearAuthenticationData();
            OnAuthenticationStateChanged?.Invoke(false);

            Debug.Log("[APIManager] User logged out");
        }

        #endregion

        #region HTTP Requests

        /// <summary>
        /// Send generic HTTP request with automatic authentication and error handling
        /// </summary>
        public async System.Threading.Tasks.Task<ApiResponse<TResponse>> SendRequestAsync<TRequest, TResponse>(
            string method,
            string url,
            TRequest requestData = default(TRequest))
        {
            // Check network connectivity
            if (!IsOnline)
            {
                return new ApiResponse<TResponse>
                {
                    success = false,
                    error = new APIError { code = "NETWORK_ERROR", message = "No internet connection" }
                };
            }

            // Auto-refresh token if needed
            if (IsTokenExpired() && !string.IsNullOrEmpty(refreshToken))
            {
                await RefreshTokenAsync();
            }

            string requestId = Guid.NewGuid().ToString();
            UnityWebRequest request = null;

            try
            {
                // Create request
                request = CreateUnityWebRequest(method, url, requestData);

                // Add authentication header if available
                if (!string.IsNullOrEmpty(accessToken))
                {
                    request.SetRequestHeader("Authorization", $"Bearer {accessToken}");
                }

                // Track active request
                activeRequests[requestId] = request;

                // Send request
                var operation = request.SendWebRequest();
                await WaitForWebRequest(operation);

                // Process response
                return ProcessResponse<TResponse>(request);
            }
            catch (Exception e)
            {
                Debug.LogError($"[APIManager] Request error: {e.Message}");
                return new ApiResponse<TResponse>
                {
                    success = false,
                    error = new APIError { code = "REQUEST_ERROR", message = e.Message }
                };
            }
            finally
            {
                // Cleanup
                activeRequests.Remove(requestId);
                request?.Dispose();
            }
        }

        /// <summary>
        /// Create UnityWebRequest with proper configuration
        /// </summary>
        private UnityWebRequest CreateUnityWebRequest<TRequest>(string method, string url, TRequest requestData)
        {
            UnityWebRequest request;

            switch (method.ToUpper())
            {
                case "GET":
                    request = UnityWebRequest.Get(url);
                    break;
                case "POST":
                case "PUT":
                case "PATCH":
                    string jsonData = requestData != null ? JsonConvert.SerializeObject(requestData) : "{}";
                    byte[] bodyRaw = Encoding.UTF8.GetBytes(jsonData);
                    request = new UnityWebRequest(url, method);
                    request.uploadHandler = new UploadHandlerRaw(bodyRaw);
                    request.downloadHandler = new DownloadHandlerBuffer();
                    request.SetRequestHeader("Content-Type", "application/json");
                    break;
                case "DELETE":
                    request = UnityWebRequest.Delete(url);
                    break;
                default:
                    throw new ArgumentException($"Unsupported HTTP method: {method}");
            }

            // Set timeout
            request.timeout = gameConfig.requestTimeoutSeconds;

            // Set standard headers
            request.SetRequestHeader("User-Agent", $"ThinkRank-Unity/{Application.version}");
            request.SetRequestHeader("Accept", "application/json");

            return request;
        }

        /// <summary>
        /// Wait for web request completion with proper async handling
        /// </summary>
        private async System.Threading.Tasks.Task WaitForWebRequest(UnityWebRequestAsyncOperation operation)
        {
            while (!operation.isDone)
            {
                await System.Threading.Tasks.Task.Yield();
            }
        }

        /// <summary>
        /// Process UnityWebRequest response and convert to ApiResponse
        /// </summary>
        private ApiResponse<TResponse> ProcessResponse<TResponse>(UnityWebRequest request)
        {
            if (request.result == UnityWebRequest.Result.Success)
            {
                try
                {
                    string responseText = request.downloadHandler.text;
                    var apiResponse = JsonConvert.DeserializeObject<ApiResponse<TResponse>>(responseText);
                    return apiResponse;
                }
                catch (Exception e)
                {
                    Debug.LogError($"[APIManager] Response parsing error: {e.Message}");
                    return new ApiResponse<TResponse>
                    {
                        success = false,
                        error = new APIError { code = "PARSE_ERROR", message = "Failed to parse response" }
                    };
                }
            }
            else
            {
                string errorMessage = $"HTTP {request.responseCode}: {request.error}";
                Debug.LogError($"[APIManager] Request failed: {errorMessage}");

                return new ApiResponse<TResponse>
                {
                    success = false,
                    error = new APIError
                    {
                        code = request.responseCode.ToString(),
                        message = errorMessage
                    }
                };
            }
        }

        #endregion

        #region Token Management

        private void SetAuthenticationData(AuthResponse authResponse)
        {
            accessToken = authResponse.access_token;
            refreshToken = authResponse.refresh_token;
            tokenExpiryTime = DateTime.UtcNow.AddSeconds(authResponse.expires_in);
        }

        private bool IsTokenExpired()
        {
            return DateTime.UtcNow >= tokenExpiryTime.AddMinutes(-5); // 5 minute buffer
        }

        private void SaveAuthenticationData()
        {
            if (gameConfig.rememberUserLogin)
            {
                PlayerPrefs.SetString("AccessToken", accessToken ?? "");
                PlayerPrefs.SetString("RefreshToken", refreshToken ?? "");
                PlayerPrefs.SetString("TokenExpiry", tokenExpiryTime.ToBinary().ToString());
                PlayerPrefs.Save();
            }
        }

        private void LoadAuthenticationData()
        {
            if (gameConfig.rememberUserLogin)
            {
                accessToken = PlayerPrefs.GetString("AccessToken", "");
                refreshToken = PlayerPrefs.GetString("RefreshToken", "");

                string expiryString = PlayerPrefs.GetString("TokenExpiry", "");
                if (!string.IsNullOrEmpty(expiryString) && long.TryParse(expiryString, out long expiryBinary))
                {
                    tokenExpiryTime = DateTime.FromBinary(expiryBinary);
                }
            }
        }

        private void ClearAuthenticationData()
        {
            PlayerPrefs.DeleteKey("AccessToken");
            PlayerPrefs.DeleteKey("RefreshToken");
            PlayerPrefs.DeleteKey("TokenExpiry");
            PlayerPrefs.Save();
        }

        #endregion

        #region Network Monitoring

        private IEnumerator MonitorNetworkConnection()
        {
            bool wasOnline = IsOnline;

            while (true)
            {
                yield return new WaitForSeconds(5f); // Check every 5 seconds

                bool isOnlineNow = IsOnline;
                if (wasOnline != isOnlineNow)
                {
                    OnNetworkConnectionChanged?.Invoke();
                    Debug.Log($"[APIManager] Network status changed: {(isOnlineNow ? "Online" : "Offline")}");
                    wasOnline = isOnlineNow;
                }
            }
        }

        #endregion

        #region Request Queue

        private IEnumerator ProcessRequestQueue()
        {
            while (true)
            {
                if (requestQueue.Count > 0 && !isProcessingRequests)
                {
                    isProcessingRequests = true;
                    var request = requestQueue.Dequeue();

                    // Process queued request
                    yield return StartCoroutine(ProcessQueuedRequest(request));

                    isProcessingRequests = false;
                }

                yield return new WaitForSeconds(0.1f);
            }
        }

        private IEnumerator ProcessQueuedRequest(APIRequest request)
        {
            // Implementation for queued request processing
            // This would be used for offline queue when network becomes available
            yield return null;
        }

        #endregion
    }

    /// <summary>
    /// API request data structure for queuing
    /// </summary>
    [System.Serializable]
    public class APIRequest
    {
        public string method;
        public string url;
        public string data;
        public DateTime timestamp;
        public int retryCount;
    }
}

#region API Data Types

// API response wrapper matching backend
[System.Serializable]
public class ApiResponse<T>
{
    public bool success;
    public T data;
    public APIError error;
    public ApiMeta meta;
}

[System.Serializable]
public class ApiMeta
{
    public string timestamp;
    public string request_id;
    public string version;
}

[System.Serializable]
public class APIError
{
    public string code;
    public string message;
    public object details;
}

// Authentication types matching backend
[System.Serializable]
public class LoginRequest
{
    public string email;
    public string password;
    public bool remember_me;
}

[System.Serializable]
public class RegisterRequest
{
    public string email;
    public string username;
    public string password;
    public string confirm_password;
    public bool terms_accepted;
}

[System.Serializable]
public class RefreshTokenRequest
{
    public string refresh_token;
}

[System.Serializable]
public class AuthResponse
{
    public UserProfile user;
    public string access_token;
    public string refresh_token;
    public int expires_in;
}

[System.Serializable]
public class UserProfile
{
    public string id;
    public string email;
    public string username;
    public string display_name;
    public string avatar_url;
    public string bio;
    public UserPreferences preferences;
    public DateTime created_at;
    public DateTime updated_at;
}

[System.Serializable]
public class UserPreferences
{
    public bool notifications;
    public string privacy;
    public string theme;
}

#endregion
