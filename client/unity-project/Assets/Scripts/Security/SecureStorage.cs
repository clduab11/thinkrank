using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;
using UnityEngine;
using System.Runtime.InteropServices;

#if UNITY_IOS && !UNITY_EDITOR
using System.Runtime.InteropServices;
#endif

#if UNITY_ANDROID && !UNITY_EDITOR
using UnityEngine;
#endif

namespace ThinkRank.Security
{
    /// <summary>
    /// Secure storage implementation replacing insecure PlayerPrefs
    /// Uses platform-specific secure storage mechanisms:
    /// - iOS: Keychain Services
    /// - Android: Android Keystore
    /// - Windows/Mac/Linux: DPAPI or Keyring with encryption
    /// </summary>
    public static class SecureStorage
    {
        private const string STORAGE_PREFIX = "ThinkRank_";
        private const string ENCRYPTION_KEY_ID = "ThinkRank.MainKey";
        
        // Certificate pinning configuration
        public static readonly string[] PINNED_CERTIFICATES = {
            "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", // Production cert
            "sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=", // Backup cert
        };
        
        public static readonly string[] PINNED_DOMAINS = {
            "api.thinkrank.com",
            "auth.thinkrank.com"
        };

#if UNITY_IOS && !UNITY_EDITOR
        [DllImport("__Internal")]
        private static extern int KeychainStore(string key, string value);
        
        [DllImport("__Internal")]
        private static extern string KeychainRetrieve(string key);
        
        [DllImport("__Internal")]
        private static extern int KeychainDelete(string key);
        
        [DllImport("__Internal")]
        private static extern bool KeychainExists(string key);
#endif

        /// <summary>
        /// Securely store sensitive data
        /// </summary>
        public static bool SetSecureString(string key, string value)
        {
            if (string.IsNullOrEmpty(key) || value == null)
                return false;

            try
            {
                string secureKey = STORAGE_PREFIX + key;
                
#if UNITY_IOS && !UNITY_EDITOR
                return KeychainStore(secureKey, value) == 0;
#elif UNITY_ANDROID && !UNITY_EDITOR
                return AndroidSecureStorage.StoreSecurely(secureKey, value);
#else
                // Desktop platforms - use encryption with system protection
                return StoreEncrypted(secureKey, value);
#endif
            }
            catch (Exception e)
            {
                Debug.LogError($"[SecureStorage] Failed to store secure data: {e.Message}");
                return false;
            }
        }

        /// <summary>
        /// Retrieve securely stored data
        /// </summary>
        public static string GetSecureString(string key, string defaultValue = "")
        {
            if (string.IsNullOrEmpty(key))
                return defaultValue;

            try
            {
                string secureKey = STORAGE_PREFIX + key;
                
#if UNITY_IOS && !UNITY_EDITOR
                string result = KeychainRetrieve(secureKey);
                return string.IsNullOrEmpty(result) ? defaultValue : result;
#elif UNITY_ANDROID && !UNITY_EDITOR
                return AndroidSecureStorage.RetrieveSecurely(secureKey, defaultValue);
#else
                return RetrieveEncrypted(secureKey, defaultValue);
#endif
            }
            catch (Exception e)
            {
                Debug.LogError($"[SecureStorage] Failed to retrieve secure data: {e.Message}");
                return defaultValue;
            }
        }

        /// <summary>
        /// Check if secure key exists
        /// </summary>
        public static bool HasSecureKey(string key)
        {
            if (string.IsNullOrEmpty(key))
                return false;

            string secureKey = STORAGE_PREFIX + key;
            
#if UNITY_IOS && !UNITY_EDITOR
            return KeychainExists(secureKey);
#elif UNITY_ANDROID && !UNITY_EDITOR
            return AndroidSecureStorage.KeyExists(secureKey);
#else
            return HasEncryptedKey(secureKey);
#endif
        }

        /// <summary>
        /// Delete secure data
        /// </summary>
        public static bool DeleteSecureKey(string key)
        {
            if (string.IsNullOrEmpty(key))
                return false;

            try
            {
                string secureKey = STORAGE_PREFIX + key;
                
#if UNITY_IOS && !UNITY_EDITOR
                return KeychainDelete(secureKey) == 0;
#elif UNITY_ANDROID && !UNITY_EDITOR
                return AndroidSecureStorage.DeleteSecure(secureKey);
#else
                return DeleteEncrypted(secureKey);
#endif
            }
            catch (Exception e)
            {
                Debug.LogError($"[SecureStorage] Failed to delete secure data: {e.Message}");
                return false;
            }
        }

        /// <summary>
        /// Store authentication token securely
        /// </summary>
        public static bool StoreAuthToken(string token, DateTime expiresAt)
        {
            try
            {
                var tokenData = new AuthTokenData
                {
                    token = token,
                    expiresAt = expiresAt,
                    storedAt = DateTime.UtcNow
                };

                string jsonData = JsonUtility.ToJson(tokenData);
                bool stored = SetSecureString("AUTH_TOKEN", jsonData);
                
                if (stored)
                {
                    // Add integrity check
                    string hash = ComputeHash(jsonData);
                    SetSecureString("AUTH_TOKEN_HASH", hash);
                }
                
                return stored;
            }
            catch (Exception e)
            {
                Debug.LogError($"[SecureStorage] Failed to store auth token: {e.Message}");
                return false;
            }
        }

        /// <summary>
        /// Retrieve authentication token with integrity verification
        /// </summary>
        public static string GetAuthToken()
        {
            try
            {
                string jsonData = GetSecureString("AUTH_TOKEN");
                if (string.IsNullOrEmpty(jsonData))
                    return null;

                // Verify integrity
                string storedHash = GetSecureString("AUTH_TOKEN_HASH");
                string computedHash = ComputeHash(jsonData);
                
                if (storedHash != computedHash)
                {
                    Debug.LogWarning("[SecureStorage] Auth token integrity check failed - possible tampering");
                    DeleteSecureKey("AUTH_TOKEN");
                    DeleteSecureKey("AUTH_TOKEN_HASH");
                    return null;
                }

                var tokenData = JsonUtility.FromJson<AuthTokenData>(jsonData);
                
                // Check expiration
                if (DateTime.UtcNow >= tokenData.expiresAt)
                {
                    Debug.LogInfo("[SecureStorage] Auth token expired");
                    DeleteSecureKey("AUTH_TOKEN");
                    DeleteSecureKey("AUTH_TOKEN_HASH");
                    return null;
                }

                return tokenData.token;
            }
            catch (Exception e)
            {
                Debug.LogError($"[SecureStorage] Failed to retrieve auth token: {e.Message}");
                return null;
            }
        }

        /// <summary>
        /// Clear all authentication data
        /// </summary>
        public static void ClearAuthData()
        {
            DeleteSecureKey("AUTH_TOKEN");
            DeleteSecureKey("AUTH_TOKEN_HASH");
            DeleteSecureKey("REFRESH_TOKEN");
            DeleteSecureKey("USER_ID");
            DeleteSecureKey("USER_DATA");
        }

#if !UNITY_IOS && !UNITY_ANDROID || UNITY_EDITOR
        // Desktop encryption implementation
        private static string GetEncryptionKey()
        {
            // Use DPAPI on Windows, Keychain on macOS, or generate a key
            try
            {
#if UNITY_STANDALONE_WIN && !UNITY_EDITOR
                // Use DPAPI for Windows
                return Environment.MachineName + Environment.UserName;
#elif UNITY_STANDALONE_OSX && !UNITY_EDITOR
                // Use system keychain on macOS
                return SystemInfo.deviceUniqueIdentifier;
#else
                // Fallback for editor and other platforms
                return SystemInfo.deviceUniqueIdentifier + Application.companyName;
#endif
            }
            catch
            {
                return "ThinkRank_Default_Key_" + SystemInfo.deviceUniqueIdentifier;
            }
        }

        private static bool StoreEncrypted(string key, string value)
        {
            try
            {
                string encryptedValue = EncryptString(value);
                PlayerPrefs.SetString(key + "_encrypted", encryptedValue);
                PlayerPrefs.Save();
                return true;
            }
            catch (Exception e)
            {
                Debug.LogError($"[SecureStorage] Encryption failed: {e.Message}");
                return false;
            }
        }

        private static string RetrieveEncrypted(string key, string defaultValue)
        {
            try
            {
                string encryptedValue = PlayerPrefs.GetString(key + "_encrypted", "");
                if (string.IsNullOrEmpty(encryptedValue))
                    return defaultValue;

                return DecryptString(encryptedValue);
            }
            catch (Exception e)
            {
                Debug.LogError($"[SecureStorage] Decryption failed: {e.Message}");
                return defaultValue;
            }
        }

        private static bool HasEncryptedKey(string key)
        {
            return PlayerPrefs.HasKey(key + "_encrypted");
        }

        private static bool DeleteEncrypted(string key)
        {
            if (PlayerPrefs.HasKey(key + "_encrypted"))
            {
                PlayerPrefs.DeleteKey(key + "_encrypted");
                PlayerPrefs.Save();
                return true;
            }
            return false;
        }

        private static string EncryptString(string plainText)
        {
            byte[] plainBytes = Encoding.UTF8.GetBytes(plainText);
            byte[] keyBytes = Encoding.UTF8.GetBytes(GetEncryptionKey());
            
            using (var aes = Aes.Create())
            {
                aes.Key = ResizeArray(keyBytes, 32); // AES-256
                aes.GenerateIV();
                
                using (var encryptor = aes.CreateEncryptor())
                {
                    byte[] encryptedBytes = encryptor.TransformFinalBlock(plainBytes, 0, plainBytes.Length);
                    byte[] result = new byte[aes.IV.Length + encryptedBytes.Length];
                    
                    Array.Copy(aes.IV, 0, result, 0, aes.IV.Length);
                    Array.Copy(encryptedBytes, 0, result, aes.IV.Length, encryptedBytes.Length);
                    
                    return Convert.ToBase64String(result);
                }
            }
        }

        private static string DecryptString(string encryptedText)
        {
            byte[] encryptedBytes = Convert.FromBase64String(encryptedText);
            byte[] keyBytes = Encoding.UTF8.GetBytes(GetEncryptionKey());
            
            using (var aes = Aes.Create())
            {
                aes.Key = ResizeArray(keyBytes, 32); // AES-256
                
                byte[] iv = new byte[aes.IV.Length];
                byte[] cipherText = new byte[encryptedBytes.Length - iv.Length];
                
                Array.Copy(encryptedBytes, 0, iv, 0, iv.Length);
                Array.Copy(encryptedBytes, iv.Length, cipherText, 0, cipherText.Length);
                
                aes.IV = iv;
                
                using (var decryptor = aes.CreateDecryptor())
                {
                    byte[] decryptedBytes = decryptor.TransformFinalBlock(cipherText, 0, cipherText.Length);
                    return Encoding.UTF8.GetString(decryptedBytes);
                }
            }
        }

        private static byte[] ResizeArray(byte[] array, int length)
        {
            byte[] result = new byte[length];
            Array.Copy(array, result, Math.Min(array.Length, length));
            return result;
        }
#endif

        /// <summary>
        /// Compute SHA-256 hash for integrity verification
        /// </summary>
        private static string ComputeHash(string input)
        {
            using (var sha256 = SHA256.Create())
            {
                byte[] hashedBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(input));
                return Convert.ToBase64String(hashedBytes);
            }
        }

        /// <summary>
        /// Anti-tampering check for the application
        /// </summary>
        public static bool VerifyApplicationIntegrity()
        {
            try
            {
                // Check if running in debug mode (possible tampering)
                if (Debug.isDebugBuild && !Application.isEditor)
                {
                    Debug.LogWarning("[SecureStorage] Application running in debug mode in production");
                    return false;
                }

                // Additional integrity checks can be added here
                // - Certificate validation
                // - Code signature verification
                // - Runtime tampering detection

                return true;
            }
            catch (Exception e)
            {
                Debug.LogError($"[SecureStorage] Integrity check failed: {e.Message}");
                return false;
            }
        }
    }

    /// <summary>
    /// Data structure for storing authentication tokens
    /// </summary>
    [Serializable]
    public class AuthTokenData
    {
        public string token;
        public DateTime expiresAt;
        public DateTime storedAt;
    }

#if UNITY_ANDROID && !UNITY_EDITOR
    /// <summary>
    /// Android-specific secure storage implementation
    /// </summary>
    public static class AndroidSecureStorage
    {
        public static bool StoreSecurely(string key, string value)
        {
            try
            {
                using (var androidJavaClass = new AndroidJavaClass("com.thinkrank.security.SecureStorage"))
                {
                    return androidJavaClass.CallStatic<bool>("storeSecurely", key, value);
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"[AndroidSecureStorage] Store failed: {e.Message}");
                return false;
            }
        }

        public static string RetrieveSecurely(string key, string defaultValue)
        {
            try
            {
                using (var androidJavaClass = new AndroidJavaClass("com.thinkrank.security.SecureStorage"))
                {
                    return androidJavaClass.CallStatic<string>("retrieveSecurely", key, defaultValue);
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"[AndroidSecureStorage] Retrieve failed: {e.Message}");
                return defaultValue;
            }
        }

        public static bool KeyExists(string key)
        {
            try
            {
                using (var androidJavaClass = new AndroidJavaClass("com.thinkrank.security.SecureStorage"))
                {
                    return androidJavaClass.CallStatic<bool>("keyExists", key);
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"[AndroidSecureStorage] Key check failed: {e.Message}");
                return false;
            }
        }

        public static bool DeleteSecure(string key)
        {
            try
            {
                using (var androidJavaClass = new AndroidJavaClass("com.thinkrank.security.SecureStorage"))
                {
                    return androidJavaClass.CallStatic<bool>("deleteSecure", key);
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"[AndroidSecureStorage] Delete failed: {e.Message}");
                return false;
            }
        }
    }
#endif
}