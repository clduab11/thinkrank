using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using ThinkRank.Core;

namespace ThinkRank.Audio
{
    /// <summary>
    /// Manages audio playback including music, sound effects, and voice audio
    /// Provides volume control, audio pooling, and mobile-optimized audio handling
    /// </summary>
    public class AudioManager : MonoBehaviour
    {
        [Header("Audio Configuration")]
        [SerializeField] private GameConfiguration gameConfig;
        [SerializeField] private AudioMixerConfiguration audioMixerConfig;

        [Header("Audio Sources")]
        [SerializeField] private AudioSource musicAudioSource;
        [SerializeField] private AudioSource uiAudioSource;
        [SerializeField] private List<AudioSource> sfxAudioSources = new List<AudioSource>();

        [Header("Audio Settings")]
        [SerializeField] private int maxSimultaneousSFX = 8;
        [SerializeField] private bool enableAudioCompression = true;
        [SerializeField] private bool enableSpatialAudio = false;

        // Audio state
        private bool isMusicEnabled = true;
        private bool isSFXEnabled = true;
        private bool isVoiceEnabled = true;
        private float masterVolume = 1f;
        private float musicVolume = 0.7f;
        private float sfxVolume = 0.8f;
        private float voiceVolume = 0.9f;

        // Audio pools
        private Queue<AudioSource> availableSFXSources = new Queue<AudioSource>();
        private Dictionary<string, AudioClip> loadedClips = new Dictionary<string, AudioClip>();
        private Dictionary<string, AudioClipData> audioClipDatabase = new Dictionary<string, AudioClipData>();

        // Music management
        private Coroutine musicFadeCoroutine;
        private AudioClip currentMusicClip;
        private AudioClip nextMusicClip;
        private bool isMusicTransitioning = false;

        // Events
        public static event Action<string> OnMusicChanged;
        public static event Action<string> OnSFXPlayed;
        public static event Action<bool> OnAudioStateChanged;

        // Properties
        public bool IsMusicEnabled => isMusicEnabled;
        public bool IsSFXEnabled => isSFXEnabled;
        public float MasterVolume => masterVolume;
        public float MusicVolume => musicVolume;
        public float SFXVolume => sfxVolume;

        /// <summary>
        /// Initialize the Audio Manager
        /// </summary>
        public void Initialize()
        {
            Debug.Log("[AudioManager] Initializing Audio Manager...");

            // Load audio preferences
            LoadAudioPreferences();

            // Setup audio sources
            SetupAudioSources();

            // Initialize audio pools
            InitializeAudioPools();

            // Load audio database
            LoadAudioDatabase();

            // Configure for mobile optimization
            ConfigureMobileAudio();

            Debug.Log("[AudioManager] Audio Manager initialized successfully");
        }

        #region Audio Source Setup

        /// <summary>
        /// Setup main audio sources
        /// </summary>
        private void SetupAudioSources()
        {
            // Create music audio source if not assigned
            if (musicAudioSource == null)
            {
                GameObject musicGO = new GameObject("MusicAudioSource");
                musicGO.transform.SetParent(transform);
                musicAudioSource = musicGO.AddComponent<AudioSource>();
            }

            // Configure music source
            musicAudioSource.loop = true;
            musicAudioSource.playOnAwake = false;
            musicAudioSource.volume = musicVolume * masterVolume;
            musicAudioSource.priority = 0; // Highest priority

            // Create UI audio source if not assigned
            if (uiAudioSource == null)
            {
                GameObject uiGO = new GameObject("UIAudioSource");
                uiGO.transform.SetParent(transform);
                uiAudioSource = uiGO.AddComponent<AudioSource>();
            }

            // Configure UI source
            uiAudioSource.loop = false;
            uiAudioSource.playOnAwake = false;
            uiAudioSource.volume = sfxVolume * masterVolume;
            uiAudioSource.priority = 64; // High priority for UI
        }

        /// <summary>
        /// Initialize audio source pools for SFX
        /// </summary>
        private void InitializeAudioPools()
        {
            // Create SFX audio sources if not enough
            while (sfxAudioSources.Count < maxSimultaneousSFX)
            {
                GameObject sfxGO = new GameObject($"SFXAudioSource_{sfxAudioSources.Count}");
                sfxGO.transform.SetParent(transform);
                AudioSource source = sfxGO.AddComponent<AudioSource>();

                source.loop = false;
                source.playOnAwake = false;
                source.volume = sfxVolume * masterVolume;
                source.priority = 128; // Normal priority

                sfxAudioSources.Add(source);
            }

            // Add all sources to available pool
            foreach (var source in sfxAudioSources)
            {
                availableSFXSources.Enqueue(source);
            }
        }

        #endregion

        #region Music Management

        /// <summary>
        /// Play background music with optional fade transition
        /// </summary>
        public void PlayMusic(string musicId, bool fadeTransition = true, float fadeTime = 1f)
        {
            if (!isMusicEnabled) return;

            AudioClip musicClip = GetAudioClip(musicId);
            if (musicClip == null)
            {
                Debug.LogWarning($"[AudioManager] Music clip not found: {musicId}");
                return;
            }

            if (fadeTransition && musicAudioSource.isPlaying)
            {
                StartMusicTransition(musicClip, fadeTime);
            }
            else
            {
                PlayMusicImmediate(musicClip);
            }

            currentMusicClip = musicClip;
            OnMusicChanged?.Invoke(musicId);
            Debug.Log($"[AudioManager] Playing music: {musicId}");
        }

        /// <summary>
        /// Play music immediately without transition
        /// </summary>
        private void PlayMusicImmediate(AudioClip musicClip)
        {
            musicAudioSource.clip = musicClip;
            musicAudioSource.volume = musicVolume * masterVolume;
            musicAudioSource.Play();
        }

        /// <summary>
        /// Start music transition with crossfade
        /// </summary>
        private void StartMusicTransition(AudioClip newMusicClip, float fadeTime)
        {
            if (musicFadeCoroutine != null)
            {
                StopCoroutine(musicFadeCoroutine);
            }

            nextMusicClip = newMusicClip;
            musicFadeCoroutine = StartCoroutine(MusicTransitionCoroutine(fadeTime));
        }

        /// <summary>
        /// Music transition coroutine with crossfade
        /// </summary>
        private IEnumerator MusicTransitionCoroutine(float fadeTime)
        {
            isMusicTransitioning = true;
            float targetVolume = musicVolume * masterVolume;

            // Fade out current music
            float startVolume = musicAudioSource.volume;
            float elapsed = 0f;

            while (elapsed < fadeTime)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = elapsed / fadeTime;
                musicAudioSource.volume = Mathf.Lerp(startVolume, 0f, t);
                yield return null;
            }

            // Switch to new music
            musicAudioSource.clip = nextMusicClip;
            musicAudioSource.Play();

            // Fade in new music
            elapsed = 0f;
            while (elapsed < fadeTime)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = elapsed / fadeTime;
                musicAudioSource.volume = Mathf.Lerp(0f, targetVolume, t);
                yield return null;
            }

            musicAudioSource.volume = targetVolume;
            isMusicTransitioning = false;
            musicFadeCoroutine = null;
        }

        /// <summary>
        /// Stop music with optional fade out
        /// </summary>
        public void StopMusic(bool fadeOut = true, float fadeTime = 1f)
        {
            if (fadeOut && musicAudioSource.isPlaying)
            {
                if (musicFadeCoroutine != null)
                {
                    StopCoroutine(musicFadeCoroutine);
                }
                musicFadeCoroutine = StartCoroutine(FadeOutMusicCoroutine(fadeTime));
            }
            else
            {
                musicAudioSource.Stop();
            }

            currentMusicClip = null;
            Debug.Log("[AudioManager] Music stopped");
        }

        /// <summary>
        /// Fade out music coroutine
        /// </summary>
        private IEnumerator FadeOutMusicCoroutine(float fadeTime)
        {
            float startVolume = musicAudioSource.volume;
            float elapsed = 0f;

            while (elapsed < fadeTime && musicAudioSource.isPlaying)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = elapsed / fadeTime;
                musicAudioSource.volume = Mathf.Lerp(startVolume, 0f, t);
                yield return null;
            }

            musicAudioSource.Stop();
            musicAudioSource.volume = musicVolume * masterVolume;
            musicFadeCoroutine = null;
        }

        #endregion

        #region Sound Effects

        /// <summary>
        /// Play sound effect
        /// </summary>
        public void PlaySFX(string sfxId, float pitch = 1f, float volumeMultiplier = 1f)
        {
            if (!isSFXEnabled) return;

            AudioClip sfxClip = GetAudioClip(sfxId);
            if (sfxClip == null)
            {
                Debug.LogWarning($"[AudioManager] SFX clip not found: {sfxId}");
                return;
            }

            AudioSource source = GetAvailableSFXSource();
            if (source != null)
            {
                source.clip = sfxClip;
                source.volume = sfxVolume * masterVolume * volumeMultiplier;
                source.pitch = pitch;
                source.Play();

                // Return source to pool when finished
                StartCoroutine(ReturnSFXSourceWhenFinished(source, sfxClip.length / pitch));

                OnSFXPlayed?.Invoke(sfxId);
            }
            else
            {
                Debug.LogWarning("[AudioManager] No available SFX audio sources");
            }
        }

        /// <summary>
        /// Play UI sound effect
        /// </summary>
        public void PlayUISFX(string sfxId, float volumeMultiplier = 1f)
        {
            if (!isSFXEnabled) return;

            AudioClip sfxClip = GetAudioClip(sfxId);
            if (sfxClip == null)
            {
                Debug.LogWarning($"[AudioManager] UI SFX clip not found: {sfxId}");
                return;
            }

            uiAudioSource.PlayOneShot(sfxClip, sfxVolume * masterVolume * volumeMultiplier);
            OnSFXPlayed?.Invoke(sfxId);
        }

        /// <summary>
        /// Get available SFX audio source from pool
        /// </summary>
        private AudioSource GetAvailableSFXSource()
        {
            if (availableSFXSources.Count > 0)
            {
                return availableSFXSources.Dequeue();
            }

            // Find a source that's not playing
            foreach (var source in sfxAudioSources)
            {
                if (!source.isPlaying)
                {
                    return source;
                }
            }

            return null;
        }

        /// <summary>
        /// Return SFX source to pool when finished
        /// </summary>
        private IEnumerator ReturnSFXSourceWhenFinished(AudioSource source, float duration)
        {
            yield return new WaitForSeconds(duration + 0.1f); // Small buffer

            if (source != null && !source.isPlaying)
            {
                availableSFXSources.Enqueue(source);
            }
        }

        #endregion

        #region 3D Audio

        /// <summary>
        /// Play 3D positioned audio
        /// </summary>
        public void Play3DSFX(string sfxId, Vector3 position, float maxDistance = 10f, float volumeMultiplier = 1f)
        {
            if (!isSFXEnabled || !enableSpatialAudio)
            {
                PlaySFX(sfxId, 1f, volumeMultiplier);
                return;
            }

            AudioClip sfxClip = GetAudioClip(sfxId);
            if (sfxClip == null) return;

            AudioSource source = GetAvailableSFXSource();
            if (source != null)
            {
                source.clip = sfxClip;
                source.volume = sfxVolume * masterVolume * volumeMultiplier;
                source.spatialBlend = 1f; // 3D
                source.maxDistance = maxDistance;
                source.rolloffMode = AudioRolloffMode.Logarithmic;

                source.transform.position = position;
                source.Play();

                StartCoroutine(ReturnSFXSourceWhenFinished(source, sfxClip.length));
            }
        }

        #endregion

        #region Volume Control

        /// <summary>
        /// Set master volume
        /// </summary>
        public void SetMasterVolume(float volume)
        {
            masterVolume = Mathf.Clamp01(volume);
            UpdateAllVolumes();
            SaveAudioPreferences();

            Debug.Log($"[AudioManager] Master volume set to: {masterVolume:F2}");
        }

        /// <summary>
        /// Set music volume
        /// </summary>
        public void SetMusicVolume(float volume)
        {
            musicVolume = Mathf.Clamp01(volume);
            musicAudioSource.volume = musicVolume * masterVolume;
            SaveAudioPreferences();

            Debug.Log($"[AudioManager] Music volume set to: {musicVolume:F2}");
        }

        /// <summary>
        /// Set SFX volume
        /// </summary>
        public void SetSFXVolume(float volume)
        {
            sfxVolume = Mathf.Clamp01(volume);
            UpdateSFXVolumes();
            SaveAudioPreferences();

            Debug.Log($"[AudioManager] SFX volume set to: {sfxVolume:F2}");
        }

        /// <summary>
        /// Update all audio source volumes
        /// </summary>
        private void UpdateAllVolumes()
        {
            musicAudioSource.volume = musicVolume * masterVolume;
            UpdateSFXVolumes();
        }

        /// <summary>
        /// Update SFX audio source volumes
        /// </summary>
        private void UpdateSFXVolumes()
        {
            uiAudioSource.volume = sfxVolume * masterVolume;

            foreach (var source in sfxAudioSources)
            {
                if (!source.isPlaying)
                {
                    source.volume = sfxVolume * masterVolume;
                }
            }
        }

        #endregion

        #region Audio Enable/Disable

        /// <summary>
        /// Enable or disable music
        /// </summary>
        public void SetMusicEnabled(bool enabled)
        {
            isMusicEnabled = enabled;

            if (!enabled && musicAudioSource.isPlaying)
            {
                musicAudioSource.Pause();
            }
            else if (enabled && currentMusicClip != null)
            {
                musicAudioSource.UnPause();
            }

            OnAudioStateChanged?.Invoke(enabled);
            SaveAudioPreferences();

            Debug.Log($"[AudioManager] Music {(enabled ? "enabled" : "disabled")}");
        }

        /// <summary>
        /// Enable or disable sound effects
        /// </summary>
        public void SetSFXEnabled(bool enabled)
        {
            isSFXEnabled = enabled;

            if (!enabled)
            {
                // Stop all playing SFX
                foreach (var source in sfxAudioSources)
                {
                    if (source.isPlaying)
                    {
                        source.Stop();
                    }
                }
                uiAudioSource.Stop();
            }

            OnAudioStateChanged?.Invoke(enabled);
            SaveAudioPreferences();

            Debug.Log($"[AudioManager] SFX {(enabled ? "enabled" : "disabled")}");
        }

        #endregion

        #region Audio Loading

        /// <summary>
        /// Load audio database
        /// </summary>
        private void LoadAudioDatabase()
        {
            // This would typically load from a ScriptableObject or JSON file
            // For now, we'll set up some basic entries

            audioClipDatabase["ui_click"] = new AudioClipData { path = "Audio/UI/Click", volume = 1f, pitch = 1f };
            audioClipDatabase["ui_hover"] = new AudioClipData { path = "Audio/UI/Hover", volume = 0.8f, pitch = 1f };
            audioClipDatabase["ui_success"] = new AudioClipData { path = "Audio/UI/Success", volume = 1f, pitch = 1f };
            audioClipDatabase["ui_error"] = new AudioClipData { path = "Audio/UI/Error", volume = 1f, pitch = 1f };
            audioClipDatabase["puzzle_complete"] = new AudioClipData { path = "Audio/Game/PuzzleComplete", volume = 1f, pitch = 1f };
            audioClipDatabase["level_up"] = new AudioClipData { path = "Audio/Game/LevelUp", volume = 1f, pitch = 1f };
            audioClipDatabase["background_menu"] = new AudioClipData { path = "Audio/Music/MenuTheme", volume = 0.7f, pitch = 1f };
            audioClipDatabase["background_game"] = new AudioClipData { path = "Audio/Music/GameTheme", volume = 0.7f, pitch = 1f };

            Debug.Log($"[AudioManager] Audio database loaded with {audioClipDatabase.Count} entries");
        }

        /// <summary>
        /// Get audio clip by ID
        /// </summary>
        private AudioClip GetAudioClip(string audioId)
        {
            // Check if already loaded
            if (loadedClips.ContainsKey(audioId))
            {
                return loadedClips[audioId];
            }

            // Try to load from database
            if (audioClipDatabase.ContainsKey(audioId))
            {
                var clipData = audioClipDatabase[audioId];
                AudioClip clip = Resources.Load<AudioClip>(clipData.path);

                if (clip != null)
                {
                    loadedClips[audioId] = clip;
                    return clip;
                }
                else
                {
                    Debug.LogWarning($"[AudioManager] Could not load audio clip: {clipData.path}");
                }
            }

            return null;
        }

        #endregion

        #region Mobile Optimization

        /// <summary>
        /// Configure audio for mobile devices
        /// </summary>
        private void ConfigureMobileAudio()
        {
            if (Application.isMobilePlatform)
            {
                // Reduce audio quality for better performance on mobile
                AudioSettings.outputSampleRate = 22050; // Lower sample rate

                // Configure audio compression
                if (enableAudioCompression)
                {
                    // This would be configured in import settings for audio clips
                    Debug.Log("[AudioManager] Audio compression enabled for mobile");
                }

                // Disable 3D audio on low-end devices
                if (gameConfig.ShouldUseLowEndOptimizations())
                {
                    enableSpatialAudio = false;
                    Debug.Log("[AudioManager] Spatial audio disabled for low-end device");
                }
            }
        }

        #endregion

        #region Preferences

        /// <summary>
        /// Load audio preferences from player data
        /// </summary>
        private void LoadAudioPreferences()
        {
            // Get preferences from PlayerDataManager when available
            if (GameManager.Instance?.PlayerDataManager?.CurrentPlayerData?.preferences != null)
            {
                var prefs = GameManager.Instance.PlayerDataManager.CurrentPlayerData.preferences;
                isMusicEnabled = prefs.musicEnabled;
                isSFXEnabled = prefs.soundEnabled;
            }
            else
            {
                // Fallback to PlayerPrefs
                isMusicEnabled = PlayerPrefs.GetInt("AudioMusicEnabled", 1) == 1;
                isSFXEnabled = PlayerPrefs.GetInt("AudioSFXEnabled", 1) == 1;
                masterVolume = PlayerPrefs.GetFloat("AudioMasterVolume", 1f);
                musicVolume = PlayerPrefs.GetFloat("AudioMusicVolume", 0.7f);
                sfxVolume = PlayerPrefs.GetFloat("AudioSFXVolume", 0.8f);
            }
        }

        /// <summary>
        /// Save audio preferences
        /// </summary>
        private void SaveAudioPreferences()
        {
            // Save to PlayerDataManager if available
            if (GameManager.Instance?.PlayerDataManager?.CurrentPlayerData?.preferences != null)
            {
                var prefs = GameManager.Instance.PlayerDataManager.CurrentPlayerData.preferences;
                prefs.musicEnabled = isMusicEnabled;
                prefs.soundEnabled = isSFXEnabled;
                // Note: Volume levels would need to be added to PlayerPreferences structure
            }

            // Also save to PlayerPrefs as backup
            PlayerPrefs.SetInt("AudioMusicEnabled", isMusicEnabled ? 1 : 0);
            PlayerPrefs.SetInt("AudioSFXEnabled", isSFXEnabled ? 1 : 0);
            PlayerPrefs.SetFloat("AudioMasterVolume", masterVolume);
            PlayerPrefs.SetFloat("AudioMusicVolume", musicVolume);
            PlayerPrefs.SetFloat("AudioSFXVolume", sfxVolume);
            PlayerPrefs.Save();
        }

        #endregion

        #region Public API

        /// <summary>
        /// Pause all audio
        /// </summary>
        public void PauseAll()
        {
            musicAudioSource.Pause();

            foreach (var source in sfxAudioSources)
            {
                if (source.isPlaying)
                {
                    source.Pause();
                }
            }

            Debug.Log("[AudioManager] All audio paused");
        }

        /// <summary>
        /// Resume all audio
        /// </summary>
        public void ResumeAll()
        {
            if (isMusicEnabled)
            {
                musicAudioSource.UnPause();
            }

            if (isSFXEnabled)
            {
                foreach (var source in sfxAudioSources)
                {
                    source.UnPause();
                }
            }

            Debug.Log("[AudioManager] All audio resumed");
        }

        /// <summary>
        /// Stop all audio
        /// </summary>
        public void StopAll()
        {
            musicAudioSource.Stop();
            uiAudioSource.Stop();

            foreach (var source in sfxAudioSources)
            {
                source.Stop();
            }

            Debug.Log("[AudioManager] All audio stopped");
        }

        #endregion

        private void OnApplicationPause(bool pauseStatus)
        {
            if (pauseStatus)
            {
                PauseAll();
            }
            else
            {
                ResumeAll();
            }
        }
    }

    #region Data Structures

    /// <summary>
    /// Audio clip data for database
    /// </summary>
    [System.Serializable]
    public class AudioClipData
    {
        public string path;
        public float volume = 1f;
        public float pitch = 1f;
        public bool loop = false;
        public float delay = 0f;
    }

    /// <summary>
    /// Audio mixer configuration (placeholder for future AudioMixer integration)
    /// </summary>
    [System.Serializable]
    public class AudioMixerConfiguration
    {
        public string masterMixerGroup = "Master";
        public string musicMixerGroup = "Music";
        public string sfxMixerGroup = "SFX";
        public string voiceMixerGroup = "Voice";
    }

    #endregion
}
