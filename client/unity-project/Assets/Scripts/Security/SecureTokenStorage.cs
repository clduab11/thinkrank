using System;
using System.Text;
using UnityEngine;
using System.Security.Cryptography;

#if UNITY_IOS
using System.Runtime.InteropServices;
#endif

#if UNITY_ANDROID
using UnityEngine;
#endif

namespace ThinkRank.Security
{
    /// <summary>
    /// Secure token storage system replacing insecure PlayerPrefs
    /// Uses iOS Keychain, Android Keystore, and encrypted storage
    /// </summary>
    public static class SecureTokenStorage
    {
        private const string ACCESS_TOKEN_KEY = "tr_access_token";
        private const string REFRESH_TOKEN_KEY = "tr_refresh_token";
        private const string TOKEN_EXPIRY_KEY = "tr_token_expiry";
        private const string DEVICE_ID_KEY = "tr_device_id";

#if UNITY_IOS
        // iOS Keychain integration
        [DllImport("__Internal")]
        private static extern string _keychainGet(string key);
        
        [DllImport("__Internal")]
        private static extern bool _keychainSet(string key, string value);
        
        [DllImport("__Internal")]
        private static extern bool _keychainDelete(string key);
#endif

        /// <summary>
        /// Store access token securely
        /// </summary>
        public static bool StoreAccessToken(string token)
        {
            if (string.IsNullOrEmpty(token))
            {
                Debug.LogWarning("[SecureTokenStorage] Attempted to store empty access token");
                return false;
            }

            try
            {
#if UNITY_IOS && !UNITY_EDITOR
                return _keychainSet(ACCESS_TOKEN_KEY, token);
#elif UNITY_ANDROID && !UNITY_EDITOR
                return AndroidKeystoreManager.StoreSecureData(ACCESS_TOKEN_KEY, token);
#else
                // Fallback to encrypted PlayerPrefs for editor/other platforms
                return StoreEncryptedPlayerPref(ACCESS_TOKEN_KEY, token);
#endif
            }
            catch (Exception e)
            {
                Debug.LogError($"[SecureTokenStorage] Failed to store access token: {e.Message}");
                return false;
            }
        }

        /// <summary>
        /// Retrieve access token securely
        /// </summary>
        public static string GetAccessToken()
        {
            try
            {
#if UNITY_IOS && !UNITY_EDITOR
                return _keychainGet(ACCESS_TOKEN_KEY);
#elif UNITY_ANDROID && !UNITY_EDITOR
                return AndroidKeystoreManager.GetSecureData(ACCESS_TOKEN_KEY);
#else
                return GetEncryptedPlayerPref(ACCESS_TOKEN_KEY);
#endif
            }
            catch (Exception e)
            {
                Debug.LogError($"[SecureTokenStorage] Failed to retrieve access token: {e.Message}");
                return null;
            }
        }

        /// <summary>
        /// Store refresh token securely
        /// </summary>
        public static bool StoreRefreshToken(string token)
        {
            if (string.IsNullOrEmpty(token))
            {
                Debug.LogWarning("[SecureTokenStorage] Attempted to store empty refresh token");
                return false;
            }

            try
            {
#if UNITY_IOS && !UNITY_EDITOR
                return _keychainSet(REFRESH_TOKEN_KEY, token);
#elif UNITY_ANDROID && !UNITY_EDITOR
                return AndroidKeystoreManager.StoreSecureData(REFRESH_TOKEN_KEY, token);
#else
                return StoreEncryptedPlayerPref(REFRESH_TOKEN_KEY, token);
#endif
            }
            catch (Exception e)
            {
                Debug.LogError($"[SecureTokenStorage] Failed to store refresh token: {e.Message}");
                return false;
            }
        }

        /// <summary>
        /// Retrieve refresh token securely
        /// </summary>
        public static string GetRefreshToken()
        {
            try
            {
#if UNITY_IOS && !UNITY_EDITOR
                return _keychainGet(REFRESH_TOKEN_KEY);
#elif UNITY_ANDROID && !UNITY_EDITOR
                return AndroidKeystoreManager.GetSecureData(REFRESH_TOKEN_KEY);
#else
                return GetEncryptedPlayerPref(REFRESH_TOKEN_KEY);
#endif
            }
            catch (Exception e)
            {
                Debug.LogError($"[SecureTokenStorage] Failed to retrieve refresh token: {e.Message}");
                return null;
            }
        }

        /// <summary>
        /// Store token expiry time
        /// </summary>
        public static bool StoreTokenExpiry(DateTime expiryTime)
        {
            try
            {
                string expiryString = expiryTime.ToBinary().ToString();
#if UNITY_IOS && !UNITY_EDITOR
                return _keychainSet(TOKEN_EXPIRY_KEY, expiryString);
#elif UNITY_ANDROID && !UNITY_EDITOR
                return AndroidKeystoreManager.StoreSecureData(TOKEN_EXPIRY_KEY, expiryString);
#else
                return StoreEncryptedPlayerPref(TOKEN_EXPIRY_KEY, expiryString);
#endif
            }
            catch (Exception e)
            {
                Debug.LogError($"[SecureTokenStorage] Failed to store token expiry: {e.Message}");
                return false;
            }
        }

        /// <summary>
        /// Get token expiry time
        /// </summary>
        public static DateTime? GetTokenExpiry()
        {
            try
            {
                string expiryString;
#if UNITY_IOS && !UNITY_EDITOR
                expiryString = _keychainGet(TOKEN_EXPIRY_KEY);
#elif UNITY_ANDROID && !UNITY_EDITOR
                expiryString = AndroidKeystoreManager.GetSecureData(TOKEN_EXPIRY_KEY);
#else
                expiryString = GetEncryptedPlayerPref(TOKEN_EXPIRY_KEY);
#endif

                if (string.IsNullOrEmpty(expiryString))
                    return null;

                if (long.TryParse(expiryString, out long binaryTime))
                {
                    return DateTime.FromBinary(binaryTime);
                }
                return null;
            }
            catch (Exception e)
            {
                Debug.LogError($"[SecureTokenStorage] Failed to retrieve token expiry: {e.Message}");
                return null;
            }
        }

        /// <summary>
        /// Clear all stored tokens
        /// </summary>
        public static void ClearAllTokens()
        {
            try
            {
#if UNITY_IOS && !UNITY_EDITOR
                _keychainDelete(ACCESS_TOKEN_KEY);
                _keychainDelete(REFRESH_TOKEN_KEY);
                _keychainDelete(TOKEN_EXPIRY_KEY);
#elif UNITY_ANDROID && !UNITY_EDITOR
                AndroidKeystoreManager.DeleteSecureData(ACCESS_TOKEN_KEY);
                AndroidKeystoreManager.DeleteSecureData(REFRESH_TOKEN_KEY);
                AndroidKeystoreManager.DeleteSecureData(TOKEN_EXPIRY_KEY);
#else
                PlayerPrefs.DeleteKey(ACCESS_TOKEN_KEY + "_encrypted");
                PlayerPrefs.DeleteKey(REFRESH_TOKEN_KEY + "_encrypted");
                PlayerPrefs.DeleteKey(TOKEN_EXPIRY_KEY + "_encrypted");
                PlayerPrefs.Save();
#endif
                Debug.Log("[SecureTokenStorage] All tokens cleared successfully");
            }
            catch (Exception e)
            {
                Debug.LogError($"[SecureTokenStorage] Failed to clear tokens: {e.Message}");
            }
        }

        /// <summary>
        /// Get or generate device ID for additional security
        /// </summary>
        public static string GetDeviceId()
        {
            try
            {
                string deviceId;
#if UNITY_IOS && !UNITY_EDITOR
                deviceId = _keychainGet(DEVICE_ID_KEY);
#elif UNITY_ANDROID && !UNITY_EDITOR
                deviceId = AndroidKeystoreManager.GetSecureData(DEVICE_ID_KEY);
#else
                deviceId = GetEncryptedPlayerPref(DEVICE_ID_KEY);
#endif

                if (string.IsNullOrEmpty(deviceId))
                {
                    deviceId = Guid.NewGuid().ToString();
#if UNITY_IOS && !UNITY_EDITOR
                    _keychainSet(DEVICE_ID_KEY, deviceId);
#elif UNITY_ANDROID && !UNITY_EDITOR
                    AndroidKeystoreManager.StoreSecureData(DEVICE_ID_KEY, deviceId);
#else
                    StoreEncryptedPlayerPref(DEVICE_ID_KEY, deviceId);
#endif
                }

                return deviceId;
            }
            catch (Exception e)
            {
                Debug.LogError($"[SecureTokenStorage] Failed to get/generate device ID: {e.Message}");
                return SystemInfo.deviceUniqueIdentifier; // Fallback
            }
        }

        // Encrypted PlayerPrefs fallback for non-mobile platforms
        private static bool StoreEncryptedPlayerPref(string key, string value)
        {
            try
            {
                string encryptedValue = EncryptString(value, GetEncryptionKey());
                PlayerPrefs.SetString(key + "_encrypted", encryptedValue);
                PlayerPrefs.Save();
                return true;
            }
            catch (Exception e)
            {
                Debug.LogError($"[SecureTokenStorage] Encryption failed: {e.Message}");
                return false;
            }
        }

        private static string GetEncryptedPlayerPref(string key)
        {
            try
            {
                string encryptedValue = PlayerPrefs.GetString(key + "_encrypted", "");
                if (string.IsNullOrEmpty(encryptedValue))
                    return null;

                return DecryptString(encryptedValue, GetEncryptionKey());
            }
            catch (Exception e)
            {
                Debug.LogError($"[SecureTokenStorage] Decryption failed: {e.Message}");
                return null;
            }
        }

        private static string GetEncryptionKey()
        {
            // Generate a device-specific encryption key
            string systemInfo = SystemInfo.deviceUniqueIdentifier + Application.identifier;
            using (SHA256 sha256Hash = SHA256.Create())
            {
                byte[] bytes = sha256Hash.ComputeHash(Encoding.UTF8.GetBytes(systemInfo));
                return Convert.ToBase64String(bytes);
            }
        }

        private static string EncryptString(string plainText, string key)
        {
            byte[] iv = new byte[16];
            byte[] array;

            using (Aes aes = Aes.Create())
            {
                aes.Key = Convert.FromBase64String(key);
                aes.IV = iv;

                ICryptoTransform encryptor = aes.CreateEncryptor(aes.Key, aes.IV);

                using (System.IO.MemoryStream memoryStream = new System.IO.MemoryStream())
                {
                    using (CryptoStream cryptoStream = new CryptoStream(memoryStream, encryptor, CryptoStreamMode.Write))
                    {
                        using (System.IO.StreamWriter streamWriter = new System.IO.StreamWriter(cryptoStream))
                        {
                            streamWriter.Write(plainText);
                        }
                        array = memoryStream.ToArray();
                    }
                }
            }

            return Convert.ToBase64String(array);
        }

        private static string DecryptString(string cipherText, string key)
        {
            byte[] iv = new byte[16];
            byte[] buffer = Convert.FromBase64String(cipherText);

            using (Aes aes = Aes.Create())
            {
                aes.Key = Convert.FromBase64String(key);
                aes.IV = iv;
                ICryptoTransform decryptor = aes.CreateDecryptor(aes.Key, aes.IV);

                using (System.IO.MemoryStream memoryStream = new System.IO.MemoryStream(buffer))
                {
                    using (CryptoStream cryptoStream = new CryptoStream(memoryStream, decryptor, CryptoStreamMode.Read))
                    {
                        using (System.IO.StreamReader streamReader = new System.IO.StreamReader(cryptoStream))
                        {
                            return streamReader.ReadToEnd();
                        }
                    }
                }
            }
        }
    }

#if UNITY_ANDROID && !UNITY_EDITOR
    /// <summary>
    /// Android Keystore integration
    /// </summary>
    public static class AndroidKeystoreManager
    {
        private static AndroidJavaClass unityPlayer;
        private static AndroidJavaObject currentActivity;
        private static AndroidJavaClass keystoreHelper;

        static AndroidKeystoreManager()
        {
            try
            {
                unityPlayer = new AndroidJavaClass("com.unity3d.player.UnityPlayer");
                currentActivity = unityPlayer.GetStatic<AndroidJavaObject>("currentActivity");
                keystoreHelper = new AndroidJavaClass("com.thinkrank.KeystoreHelper");
            }
            catch (Exception e)
            {
                Debug.LogError($"[AndroidKeystoreManager] Initialization failed: {e.Message}");
            }
        }

        public static bool StoreSecureData(string key, string value)
        {
            try
            {
                return keystoreHelper.CallStatic<bool>("storeSecureData", currentActivity, key, value);
            }
            catch (Exception e)
            {
                Debug.LogError($"[AndroidKeystoreManager] Store failed: {e.Message}");
                return false;
            }
        }

        public static string GetSecureData(string key)
        {
            try
            {
                return keystoreHelper.CallStatic<string>("getSecureData", currentActivity, key);
            }
            catch (Exception e)
            {
                Debug.LogError($"[AndroidKeystoreManager] Retrieve failed: {e.Message}");
                return null;
            }
        }

        public static bool DeleteSecureData(string key)
        {
            try
            {
                return keystoreHelper.CallStatic<bool>("deleteSecureData", currentActivity, key);
            }
            catch (Exception e)
            {
                Debug.LogError($"[AndroidKeystoreManager] Delete failed: {e.Message}");
                return false;
            }
        }
    }
#endif

    /// <summary>
    /// Security validation utilities
    /// </summary>
    public static class SecurityValidation
    {
        /// <summary>
        /// Check if device is rooted/jailbroken
        /// </summary>
        public static bool IsDeviceCompromised()
        {
#if UNITY_ANDROID && !UNITY_EDITOR
            return CheckAndroidRoot();
#elif UNITY_IOS && !UNITY_EDITOR
            return CheckiOSJailbreak();
#else
            return false; // Assume safe in editor/other platforms
#endif
        }

#if UNITY_ANDROID && !UNITY_EDITOR
        private static bool CheckAndroidRoot()
        {
            try
            {
                // Check for common root indicators
                string[] rootPaths = {
                    "/system/app/Superuser.apk",
                    "/sbin/su",
                    "/system/bin/su",
                    "/system/xbin/su",
                    "/data/local/xbin/su",
                    "/data/local/bin/su",
                    "/system/sd/xbin/su",
                    "/system/bin/failsafe/su",
                    "/data/local/su"
                };

                foreach (string path in rootPaths)
                {
                    if (System.IO.File.Exists(path))
                    {
                        Debug.LogWarning($"[SecurityValidation] Root indicator found: {path}");
                        return true;
                    }
                }

                return false;
            }
            catch (Exception e)
            {
                Debug.LogError($"[SecurityValidation] Root check failed: {e.Message}");
                return false;
            }
        }
#endif

#if UNITY_IOS && !UNITY_EDITOR
        private static bool CheckiOSJailbreak()
        {
            try
            {
                // Check for common jailbreak indicators
                string[] jailbreakPaths = {
                    "/Applications/Cydia.app",
                    "/Library/MobileSubstrate/MobileSubstrate.dylib",
                    "/bin/bash",
                    "/usr/sbin/sshd",
                    "/etc/apt"
                };

                foreach (string path in jailbreakPaths)
                {
                    if (System.IO.File.Exists(path))
                    {
                        Debug.LogWarning($"[SecurityValidation] Jailbreak indicator found: {path}");
                        return true;
                    }
                }

                return false;
            }
            catch (Exception e)
            {
                Debug.LogError($"[SecurityValidation] Jailbreak check failed: {e.Message}");
                return false;
            }
        }
#endif
    }
}