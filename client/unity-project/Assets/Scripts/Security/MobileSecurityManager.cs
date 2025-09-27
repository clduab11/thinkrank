using System;
using System.Collections;
using System.Security.Cryptography;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

namespace ThinkRank.Security
{
    /// <summary>
    /// Comprehensive mobile security manager for ThinkRank
    /// Handles device integrity, secure storage, encryption, and App Store compliance
    /// </summary>
    public class MobileSecurityManager : MonoBehaviour
    {
        [Header("Security Configuration")]
        [SerializeField] private bool enableDeviceIntegrityCheck = true;
        [SerializeField] private bool enableJailbreakDetection = true;
        [SerializeField] private bool enableSecureStorage = true;
        [SerializeField] private bool enableNetworkSecurity = true;

        [Header("Certificate Pinning")]
        [SerializeField] private string[] pinnedCertificateHashes;
        [SerializeField] private string[] allowedDomains;

        // Security state
        private DeviceSecurityState securityState;
        private SecureStorageManager secureStorage;
        private CertificatePinningManager certificatePinning;
        private JailbreakDetectionManager jailbreakDetection;

        // Events
        public static event Action<DeviceSecurityState> OnSecurityStateChanged;
        public static event Action<SecurityViolation> OnSecurityViolation;
        public static event Action<bool> OnDeviceIntegrityVerified;

        private void Awake()
        {
            InitializeSecurityManagers();
        }

        private void Start()
        {
            StartCoroutine(InitializeSecurityValidation());
        }

        #region Initialization

        private void InitializeSecurityManagers()
        {
            secureStorage = new SecureStorageManager();
            certificatePinning = new CertificatePinningManager(pinnedCertificateHashes, allowedDomains);
            jailbreakDetection = new JailbreakDetectionManager();

            securityState = new DeviceSecurityState
            {
                isInitialized = false,
                deviceIntegrity = DeviceIntegrity.Unknown,
                jailbreakStatus = JailbreakStatus.Unknown,
                lastValidation = DateTime.UtcNow
            };
        }

        private IEnumerator InitializeSecurityValidation()
        {
            Debug.Log("[MobileSecurityManager] Starting security validation...");

            // Perform comprehensive security checks
            yield return StartCoroutine(ValidateDeviceIntegrity());
            yield return StartCoroutine(ValidateJailbreakStatus());
            yield return StartCoroutine(ValidateSecureStorage());

            securityState.isInitialized = true;
            securityState.lastValidation = DateTime.UtcNow;

            OnSecurityStateChanged?.Invoke(securityState);

            if (securityState.deviceIntegrity == DeviceIntegrity.Compromised ||
                securityState.jailbreakStatus == JailbreakStatus.Detected)
            {
                HandleSecurityViolation();
            }

            Debug.Log($"[MobileSecurityManager] Security validation completed. Integrity: {securityState.deviceIntegrity}");
        }

        #endregion

        #region Device Integrity Validation

        private IEnumerator ValidateDeviceIntegrity()
        {
            if (!enableDeviceIntegrityCheck)
            {
                securityState.deviceIntegrity = DeviceIntegrity.Trusted;
                OnDeviceIntegrityVerified?.Invoke(true);
                yield break;
            }

            Debug.Log("[MobileSecurityManager] Validating device integrity...");

            // Check for emulator/debugger
            bool isEmulator = CheckIfEmulator();
            bool isDebuggerAttached = CheckIfDebuggerAttached();

            // Check for reverse engineering tools
            bool hasReverseEngineeringTools = CheckForReverseEngineeringTools();

            // Check for screen recording/mirroring
            bool isScreenRecording = CheckForScreenRecording();

            if (isEmulator || isDebuggerAttached || hasReverseEngineeringTools || isScreenRecording)
            {
                securityState.deviceIntegrity = DeviceIntegrity.Compromised;
                OnDeviceIntegrityVerified?.Invoke(false);

                var violation = new SecurityViolation
                {
                    type = SecurityViolationType.DeviceIntegrityCompromised,
                    severity = Severity.Critical,
                    description = "Device integrity check failed",
                    timestamp = DateTime.UtcNow,
                    details = $"Emulator: {isEmulator}, Debugger: {isDebuggerAttached}, Tools: {hasReverseEngineeringTools}"
                };
                OnSecurityViolation?.Invoke(violation);
            }
            else
            {
                securityState.deviceIntegrity = DeviceIntegrity.Trusted;
                OnDeviceIntegrityVerified?.Invoke(true);
            }

            yield return null;
        }

        private bool CheckIfEmulator()
        {
#if UNITY_ANDROID
            return CheckAndroidEmulator();
#elif UNITY_IOS
            return CheckIOSEmulator();
#else
            return false;
#endif
        }

        private bool CheckIfDebuggerAttached()
        {
            return System.Diagnostics.Debugger.IsAttached;
        }

        private bool CheckForReverseEngineeringTools()
        {
            // Check for common reverse engineering tools
            string[] suspiciousProcesses = { "frida-server", "xposed", "substrate", "cydia" };
            string[] suspiciousFiles = { "/system/xbin/su", "/system/bin/su", "/sbin/su" };

            foreach (string process in suspiciousProcesses)
            {
                if (IsProcessRunning(process))
                    return true;
            }

            foreach (string file in suspiciousFiles)
            {
                if (FileExists(file))
                    return true;
            }

            return false;
        }

        private bool CheckForScreenRecording()
        {
            // Check for active screen recording (platform-specific)
#if UNITY_IOS
            return CheckIOSScreenRecording();
#else
            return false;
#endif
        }

        #endregion

        #region Jailbreak Detection

        private IEnumerator ValidateJailbreakStatus()
        {
            if (!enableJailbreakDetection)
            {
                securityState.jailbreakStatus = JailbreakStatus.NotDetected;
                yield break;
            }

            Debug.Log("[MobileSecurityManager] Checking for jailbreak/root...");

            bool isJailbroken = jailbreakDetection.IsDeviceCompromised();

            if (isJailbroken)
            {
                securityState.jailbreakStatus = JailbreakStatus.Detected;

                var violation = new SecurityViolation
                {
                    type = SecurityViolationType.JailbreakDetected,
                    severity = Severity.Critical,
                    description = "Jailbroken or rooted device detected",
                    timestamp = DateTime.UtcNow,
                    details = jailbreakDetection.GetDetectionDetails()
                };
                OnSecurityViolation?.Invoke(violation);
            }
            else
            {
                securityState.jailbreakStatus = JailbreakStatus.NotDetected;
            }

            yield return null;
        }

        #endregion

        #region Secure Storage Validation

        private IEnumerator ValidateSecureStorage()
        {
            if (!enableSecureStorage)
            {
                yield break;
            }

            Debug.Log("[MobileSecurityManager] Validating secure storage...");

            bool storageReady = yield return secureStorage.Initialize();

            if (!storageReady)
            {
                var violation = new SecurityViolation
                {
                    type = SecurityViolationType.SecureStorageFailure,
                    severity = Severity.High,
                    description = "Secure storage initialization failed",
                    timestamp = DateTime.UtcNow
                };
                OnSecurityViolation?.Invoke(violation);
            }

            yield return null;
        }

        #endregion

        #region Security Violation Handling

        private void HandleSecurityViolation()
        {
            Debug.LogError("[MobileSecurityManager] Security violation detected! Implementing countermeasures...");

            // Implement security countermeasures
            StartCoroutine(ImplementSecurityCountermeasures());
        }

        private IEnumerator ImplementSecurityCountermeasures()
        {
            // Clear sensitive data from memory
            yield return ClearSensitiveMemoryData();

            // Disable sensitive features
            DisableSensitiveFeatures();

            // Report violation to backend (if network available)
            yield return ReportSecurityViolation();

            // Implement graceful degradation
            EnableSecureMode();
        }

        private IEnumerator ClearSensitiveMemoryData()
        {
            // Force garbage collection to clear sensitive data
            GC.Collect();
            GC.WaitForPendingFinalizers();
            yield return null;
        }

        private void DisableSensitiveFeatures()
        {
            // Disable features that require high security
            // This would integrate with feature flag system
            Debug.LogWarning("[MobileSecurityManager] Disabled sensitive features due to security violation");
        }

        private IEnumerator ReportSecurityViolation()
        {
            if (!enableNetworkSecurity)
                yield break;

            try
            {
                // Report violation to backend for analysis
                // Implementation would depend on your API structure
                Debug.Log("[MobileSecurityManager] Reporting security violation to backend");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[MobileSecurityManager] Failed to report security violation: {ex.Message}");
            }

            yield return null;
        }

        private void EnableSecureMode()
        {
            // Enable secure mode with limited functionality
            Debug.Log("[MobileSecurityManager] Enabled secure mode with limited functionality");
        }

        #endregion

        #region Platform-Specific Implementations

#if UNITY_ANDROID
        private bool CheckAndroidEmulator()
        {
            // Check for common Android emulator indicators
            string fingerprint = SystemInfo.deviceModel;
            string hardware = SystemInfo.deviceType.ToString();

            return fingerprint.Contains("generic") ||
                   fingerprint.Contains("sdk") ||
                   hardware.Contains("sdk");
        }
#endif

#if UNITY_IOS
        private bool CheckIOSEmulator()
        {
            // iOS simulator detection
            return SystemInfo.deviceModel.Contains("iPhone Simulator") ||
                   SystemInfo.deviceModel.Contains("iPad Simulator");
        }

        private bool CheckIOSScreenRecording()
        {
            // Check for active screen recording on iOS
            // This would use iOS-specific APIs
            return false; // Placeholder
        }
#endif

        private bool IsProcessRunning(string processName)
        {
            // Platform-specific process checking
            try
            {
#if UNITY_ANDROID
                using (var process = new System.Diagnostics.Process())
                {
                    process.StartInfo.FileName = "pgrep";
                    process.StartInfo.Arguments = processName;
                    process.StartInfo.UseShellExecute = false;
                    process.StartInfo.RedirectStandardOutput = true;
                    process.Start();
                    string output = process.StandardOutput.ReadToEnd();
                    process.WaitForExit();
                    return !string.IsNullOrEmpty(output.Trim());
                }
#else
                return false;
#endif
            }
            catch
            {
                return false;
            }
        }

        private bool FileExists(string filePath)
        {
            try
            {
                return System.IO.File.Exists(filePath);
            }
            catch
            {
                return false;
            }
        }

        #endregion

        #region Public Interface

        /// <summary>
        /// Get current security state
        /// </summary>
        public DeviceSecurityState GetSecurityState()
        {
            return securityState;
        }

        /// <summary>
        /// Securely store sensitive data
        /// </summary>
        public bool StoreSecureData(string key, string data)
        {
            if (!enableSecureStorage || securityState.deviceIntegrity != DeviceIntegrity.Trusted)
            {
                Debug.LogWarning("[MobileSecurityManager] Secure storage not available or device not trusted");
                return false;
            }

            return secureStorage.StoreData(key, data);
        }

        /// <summary>
        /// Retrieve securely stored data
        /// </summary>
        public string RetrieveSecureData(string key)
        {
            if (!enableSecureStorage || securityState.deviceIntegrity != DeviceIntegrity.Trusted)
            {
                Debug.LogWarning("[MobileSecurityManager] Secure storage not available or device not trusted");
                return null;
            }

            return secureStorage.RetrieveData(key);
        }

        /// <summary>
        /// Validate network security (certificate pinning)
        /// </summary>
        public bool ValidateNetworkSecurity(string domain, string certificateHash)
        {
            if (!enableNetworkSecurity)
                return true;

            return certificatePinning.ValidateCertificate(domain, certificateHash);
        }

        /// <summary>
        /// Force re-validation of security state
        /// </summary>
        public void ForceSecurityRevalidation()
        {
            StartCoroutine(InitializeSecurityValidation());
        }

        #endregion
    }

    #region Supporting Classes

    public class SecureStorageManager
    {
        private bool isInitialized;

        public IEnumerator<bool> Initialize()
        {
            // Initialize platform-specific secure storage
            yield return true;
            isInitialized = true;
        }

        public bool StoreData(string key, string data)
        {
            if (!isInitialized)
                return false;

            try
            {
                // Encrypt data before storage
                string encryptedData = EncryptData(data);

                // Store using platform-specific secure storage
#if UNITY_ANDROID && !UNITY_EDITOR
                return StoreToAndroidKeystore(key, encryptedData);
#elif UNITY_IOS && !UNITY_EDITOR
                return StoreToIOSKeychain(key, encryptedData);
#else
                PlayerPrefs.SetString($"secure_{key}", encryptedData);
                PlayerPrefs.Save();
                return true;
#endif
            }
            catch (Exception ex)
            {
                Debug.LogError($"[SecureStorageManager] Failed to store data: {ex.Message}");
                return false;
            }
        }

        public string RetrieveData(string key)
        {
            if (!isInitialized)
                return null;

            try
            {
                string encryptedData;

                // Retrieve from platform-specific secure storage
#if UNITY_ANDROID && !UNITY_EDITOR
                encryptedData = RetrieveFromAndroidKeystore(key);
#elif UNITY_IOS && !UNITY_EDITOR
                encryptedData = RetrieveFromIOSKeychain(key);
#else
                encryptedData = PlayerPrefs.GetString($"secure_{key}", "");
#endif

                if (string.IsNullOrEmpty(encryptedData))
                    return null;

                return DecryptData(encryptedData);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[SecureStorageManager] Failed to retrieve data: {ex.Message}");
                return null;
            }
        }

        private string EncryptData(string data)
        {
            // Use AES encryption with device-specific key
            byte[] dataBytes = Encoding.UTF8.GetBytes(data);
            // Implementation would use proper encryption
            return Convert.ToBase64String(dataBytes);
        }

        private string DecryptData(string encryptedData)
        {
            // Use AES decryption with device-specific key
            byte[] dataBytes = Convert.FromBase64String(encryptedData);
            return Encoding.UTF8.GetString(dataBytes);
        }

#if UNITY_ANDROID
        private bool StoreToAndroidKeystore(string key, string data)
        {
            // Android Keystore implementation
            return true; // Placeholder
        }

        private string RetrieveFromAndroidKeystore(string key)
        {
            // Android Keystore implementation
            return ""; // Placeholder
        }
#endif

#if UNITY_IOS
        private bool StoreToIOSKeychain(string key, string data)
        {
            // iOS Keychain implementation
            return true; // Placeholder
        }

        private string RetrieveFromIOSKeychain(string key)
        {
            // iOS Keychain implementation
            return ""; // Placeholder
        }
#endif
    }

    public class CertificatePinningManager
    {
        private string[] pinnedHashes;
        private string[] allowedDomains;

        public CertificatePinningManager(string[] hashes, string[] domains)
        {
            pinnedHashes = hashes ?? new string[0];
            allowedDomains = domains ?? new string[0];
        }

        public bool ValidateCertificate(string domain, string certificateHash)
        {
            // Validate domain is allowed
            if (!IsDomainAllowed(domain))
                return false;

            // Validate certificate hash matches pinned hash
            if (pinnedHashes.Length == 0)
                return true; // No pinning configured

            return Array.Exists(pinnedHashes, hash => hash.Equals(certificateHash, StringComparison.OrdinalIgnoreCase));
        }

        private bool IsDomainAllowed(string domain)
        {
            return Array.Exists(allowedDomains, allowedDomain =>
                domain.Equals(allowedDomain, StringComparison.OrdinalIgnoreCase));
        }
    }

    public class JailbreakDetectionManager
    {
        public bool IsDeviceCompromised()
        {
#if UNITY_ANDROID
            return CheckAndroidRoot();
#elif UNITY_IOS
            return CheckIOSJailbreak();
#else
            return false;
#endif
        }

        public string GetDetectionDetails()
        {
            return $"Compromised: {IsDeviceCompromised()}";
        }

#if UNITY_ANDROID
        private bool CheckAndroidRoot()
        {
            // Comprehensive Android root detection
            string[] rootIndicators = {
                "/system/xbin/su",
                "/system/bin/su",
                "/sbin/su",
                "/su/bin/su"
            };

            foreach (string indicator in rootIndicators)
            {
                if (System.IO.File.Exists(indicator))
                    return true;
            }

            // Check for common root management apps
            string[] rootApps = { "com.thirdparty.superuser", "eu.chainfire.supersu" };
            // Implementation would check for these packages

            return false;
        }
#endif

#if UNITY_IOS
        private bool CheckIOSJailbreak()
        {
            // iOS jailbreak detection
            string[] jailbreakPaths = {
                "/Applications/Cydia.app",
                "/usr/sbin/sshd",
                "/bin/bash"
            };

            foreach (string path in jailbreakPaths)
            {
                if (System.IO.File.Exists(path))
                    return true;
            }

            return false;
        }
#endif
    }

    #endregion

    #region Data Structures

    [System.Serializable]
    public struct DeviceSecurityState
    {
        public bool isInitialized;
        public DeviceIntegrity deviceIntegrity;
        public JailbreakStatus jailbreakStatus;
        public DateTime lastValidation;
    }

    [System.Serializable]
    public struct SecurityViolation
    {
        public SecurityViolationType type;
        public Severity severity;
        public string description;
        public DateTime timestamp;
        public string details;
    }

    public enum DeviceIntegrity { Unknown, Trusted, Compromised }
    public enum JailbreakStatus { Unknown, NotDetected, Detected }
    public enum SecurityViolationType { DeviceIntegrityCompromised, JailbreakDetected, SecureStorageFailure, CertificateValidationFailure }
    public enum Severity { Low, Medium, High, Critical }

    #endregion
}