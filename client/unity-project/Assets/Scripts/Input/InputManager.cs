using System;
using System.Collections.Generic;
using UnityEngine;
using ThinkRank.Core;

namespace ThinkRank.Input
{
    /// <summary>
    /// Manages input handling for mobile devices including touch, gestures, and hardware buttons
    /// Provides unified input system across different platforms and device types
    /// </summary>
    public class InputManager : MonoBehaviour
    {
        [Header("Input Configuration")]
        [SerializeField] private GameConfiguration gameConfig;
        [SerializeField] private bool enableGestures = true;
        [SerializeField] private bool enableHapticFeedback = true;

        // Touch handling
        private Dictionary<int, TouchData> activeTouches = new Dictionary<int, TouchData>();
        private List<TouchEvent> touchEvents = new List<TouchEvent>();

        // Gesture detection
        private GestureDetector gestureDetector;
        private float lastTapTime;
        private Vector2 lastTapPosition;
        private const float doubleTapTime = 0.3f;
        private const float doubleTapDistance = 50f;

        // Input state
        private bool inputEnabled = true;
        private bool isProcessingInput = false;

        // Events
        public static event Action<TouchEvent> OnTouchEvent;
        public static event Action<GestureEvent> OnGestureEvent;
        public static event Action<bool> OnInputStateChanged;

        // Properties
        public bool InputEnabled => inputEnabled;
        public int ActiveTouchCount => activeTouches.Count;
        public bool HasActiveTouches => activeTouches.Count > 0;

        /// <summary>
        /// Initialize the Input Manager
        /// </summary>
        public void Initialize()
        {
            Debug.Log("[InputManager] Initializing Input Manager...");

            // Initialize gesture detector
            gestureDetector = new GestureDetector();
            gestureDetector.Initialize();

            // Configure input settings
            ConfigureInputSettings();

            // Configure haptic feedback
            enableHapticFeedback = gameConfig.enableHapticFeedback;

            Debug.Log("[InputManager] Input Manager initialized successfully");
        }

        private void Update()
        {
            if (!inputEnabled || isProcessingInput) return;

            ProcessInput();
        }

        #region Input Processing

        /// <summary>
        /// Process all input sources each frame
        /// </summary>
        private void ProcessInput()
        {
            isProcessingInput = true;

            try
            {
                // Clear events from previous frame
                touchEvents.Clear();

                // Process touch input
                ProcessTouchInput();

                // Process gesture detection
                if (enableGestures)
                {
                    ProcessGestures();
                }

                // Process hardware buttons
                ProcessHardwareButtons();

                // Dispatch events
                DispatchTouchEvents();
            }
            catch (Exception e)
            {
                Debug.LogError($"[InputManager] Error processing input: {e.Message}");
            }
            finally
            {
                isProcessingInput = false;
            }
        }

        /// <summary>
        /// Process touch input from Unity Input system
        /// </summary>
        private void ProcessTouchInput()
        {
            // Handle Unity touch input
            for (int i = 0; i < UnityEngine.Input.touchCount; i++)
            {
                Touch touch = UnityEngine.Input.GetTouch(i);
                ProcessTouch(touch);
            }

            // Handle mouse input for desktop testing
            if (!Application.isMobilePlatform)
            {
                ProcessMouseInput();
            }

            // Clean up ended touches
            CleanupEndedTouches();
        }

        /// <summary>
        /// Process individual touch
        /// </summary>
        private void ProcessTouch(Touch touch)
        {
            TouchData touchData;
            TouchEventType eventType;

            switch (touch.phase)
            {
                case TouchPhase.Began:
                    touchData = CreateTouchData(touch);
                    activeTouches[touch.fingerId] = touchData;
                    eventType = TouchEventType.TouchDown;
                    break;

                case TouchPhase.Moved:
                    if (activeTouches.TryGetValue(touch.fingerId, out touchData))
                    {
                        UpdateTouchData(touchData, touch);
                        eventType = TouchEventType.TouchMove;
                    }
                    else
                    {
                        return; // Skip if touch not found
                    }
                    break;

                case TouchPhase.Stationary:
                    if (activeTouches.TryGetValue(touch.fingerId, out touchData))
                    {
                        UpdateTouchData(touchData, touch);
                        eventType = TouchEventType.TouchStationary;
                    }
                    else
                    {
                        return; // Skip if touch not found
                    }
                    break;

                case TouchPhase.Ended:
                case TouchPhase.Canceled:
                    if (activeTouches.TryGetValue(touch.fingerId, out touchData))
                    {
                        UpdateTouchData(touchData, touch);
                        eventType = touch.phase == TouchPhase.Ended ? TouchEventType.TouchUp : TouchEventType.TouchCanceled;
                        activeTouches.Remove(touch.fingerId);
                    }
                    else
                    {
                        return; // Skip if touch not found
                    }
                    break;

                default:
                    return;
            }

            // Create touch event
            var touchEvent = new TouchEvent
            {
                touchData = touchData,
                eventType = eventType,
                timestamp = Time.unscaledTime
            };

            touchEvents.Add(touchEvent);

            // Trigger haptic feedback for touch down
            if (eventType == TouchEventType.TouchDown && enableHapticFeedback)
            {
                TriggerHapticFeedback(HapticFeedbackType.LightImpact);
            }
        }

        /// <summary>
        /// Process mouse input for desktop testing
        /// </summary>
        private void ProcessMouseInput()
        {
            Vector2 mousePosition = UnityEngine.Input.mousePosition;

            // Mouse down
            if (UnityEngine.Input.GetMouseButtonDown(0))
            {
                var touchData = new TouchData
                {
                    fingerId = 0,
                    startPosition = mousePosition,
                    currentPosition = mousePosition,
                    previousPosition = mousePosition,
                    deltaPosition = Vector2.zero,
                    totalDelta = Vector2.zero,
                    startTime = Time.unscaledTime,
                    lastUpdateTime = Time.unscaledTime,
                    pressure = 1f,
                    radius = 10f
                };

                activeTouches[0] = touchData;

                touchEvents.Add(new TouchEvent
                {
                    touchData = touchData,
                    eventType = TouchEventType.TouchDown,
                    timestamp = Time.unscaledTime
                });
            }
            // Mouse move
            else if (UnityEngine.Input.GetMouseButton(0) && activeTouches.ContainsKey(0))
            {
                var touchData = activeTouches[0];
                touchData.previousPosition = touchData.currentPosition;
                touchData.currentPosition = mousePosition;
                touchData.deltaPosition = touchData.currentPosition - touchData.previousPosition;
                touchData.totalDelta = touchData.currentPosition - touchData.startPosition;
                touchData.lastUpdateTime = Time.unscaledTime;

                touchEvents.Add(new TouchEvent
                {
                    touchData = touchData,
                    eventType = TouchEventType.TouchMove,
                    timestamp = Time.unscaledTime
                });
            }
            // Mouse up
            else if (UnityEngine.Input.GetMouseButtonUp(0) && activeTouches.ContainsKey(0))
            {
                var touchData = activeTouches[0];
                touchData.currentPosition = mousePosition;
                touchData.lastUpdateTime = Time.unscaledTime;

                touchEvents.Add(new TouchEvent
                {
                    touchData = touchData,
                    eventType = TouchEventType.TouchUp,
                    timestamp = Time.unscaledTime
                });

                activeTouches.Remove(0);
            }
        }

        #endregion

        #region Touch Data Management

        /// <summary>
        /// Create new touch data from Unity Touch
        /// </summary>
        private TouchData CreateTouchData(Touch touch)
        {
            return new TouchData
            {
                fingerId = touch.fingerId,
                startPosition = touch.position,
                currentPosition = touch.position,
                previousPosition = touch.position,
                deltaPosition = touch.deltaPosition,
                totalDelta = Vector2.zero,
                startTime = Time.unscaledTime,
                lastUpdateTime = Time.unscaledTime,
                pressure = touch.pressure,
                radius = touch.radius
            };
        }

        /// <summary>
        /// Update existing touch data
        /// </summary>
        private void UpdateTouchData(TouchData touchData, Touch touch)
        {
            touchData.previousPosition = touchData.currentPosition;
            touchData.currentPosition = touch.position;
            touchData.deltaPosition = touch.deltaPosition;
            touchData.totalDelta = touchData.currentPosition - touchData.startPosition;
            touchData.lastUpdateTime = Time.unscaledTime;
            touchData.pressure = touch.pressure;
            touchData.radius = touch.radius;
        }

        /// <summary>
        /// Clean up touches that have ended
        /// </summary>
        private void CleanupEndedTouches()
        {
            // Remove touches that haven't been updated recently (shouldn't happen normally)
            var touchesToRemove = new List<int>();
            foreach (var kvp in activeTouches)
            {
                if (Time.unscaledTime - kvp.Value.lastUpdateTime > 1f)
                {
                    touchesToRemove.Add(kvp.Key);
                }
            }

            foreach (int fingerId in touchesToRemove)
            {
                activeTouches.Remove(fingerId);
                Debug.LogWarning($"[InputManager] Cleaned up stale touch: {fingerId}");
            }
        }

        #endregion

        #region Gesture Processing

        /// <summary>
        /// Process gesture detection
        /// </summary>
        private void ProcessGestures()
        {
            gestureDetector.ProcessTouches(activeTouches.Values, touchEvents);

            // Process detected gestures
            while (gestureDetector.HasPendingGestures())
            {
                var gesture = gestureDetector.GetNextGesture();
                OnGestureEvent?.Invoke(gesture);

                // Trigger haptic feedback for gestures
                if (enableHapticFeedback)
                {
                    TriggerHapticFeedbackForGesture(gesture.gestureType);
                }
            }
        }

        #endregion

        #region Hardware Button Processing

        /// <summary>
        /// Process hardware button input (Android back button, etc.)
        /// </summary>
        private void ProcessHardwareButtons()
        {
            // Android back button
            if (UnityEngine.Input.GetKeyDown(KeyCode.Escape))
            {
                HandleBackButton();
            }

            // Volume buttons for debug (if enabled)
            if (Debug.isDebugBuild)
            {
                if (UnityEngine.Input.GetKeyDown(KeyCode.VolumeUp))
                {
                    HandleVolumeUp();
                }
                if (UnityEngine.Input.GetKeyDown(KeyCode.VolumeDown))
                {
                    HandleVolumeDown();
                }
            }
        }

        /// <summary>
        /// Handle back button press
        /// </summary>
        private void HandleBackButton()
        {
            Debug.Log("[InputManager] Back button pressed");

            // Create back button event
            var backButtonEvent = new HardwareButtonEvent
            {
                buttonType = HardwareButtonType.Back,
                timestamp = Time.unscaledTime
            };

            // Let the UI Manager handle back navigation
            if (GameManager.Instance?.UIManager != null)
            {
                GameManager.Instance.UIManager.NavigateBack();
            }
        }

        /// <summary>
        /// Handle volume up for debug
        /// </summary>
        private void HandleVolumeUp()
        {
            if (GameManager.Instance?.PerformanceManager != null)
            {
                var report = GameManager.Instance.PerformanceManager.GetPerformanceReport();
                Debug.Log($"[InputManager] Performance Report - FPS: {report.currentFPS:F1}, Memory: {report.memoryUsage / (1024 * 1024)}MB");
            }
        }

        /// <summary>
        /// Handle volume down for debug
        /// </summary>
        private void HandleVolumeDown()
        {
            if (GameManager.Instance?.PerformanceManager != null)
            {
                GameManager.Instance.PerformanceManager.OptimizePerformance();
                Debug.Log("[InputManager] Performance optimization triggered");
            }
        }

        #endregion

        #region Event Dispatching

        /// <summary>
        /// Dispatch touch events to listeners
        /// </summary>
        private void DispatchTouchEvents()
        {
            foreach (var touchEvent in touchEvents)
            {
                OnTouchEvent?.Invoke(touchEvent);
            }
        }

        #endregion

        #region Haptic Feedback

        /// <summary>
        /// Trigger haptic feedback
        /// </summary>
        public void TriggerHapticFeedback(HapticFeedbackType feedbackType)
        {
            if (!enableHapticFeedback) return;

            switch (feedbackType)
            {
                case HapticFeedbackType.LightImpact:
                    Handheld.Vibrate();
                    break;
                case HapticFeedbackType.MediumImpact:
                    Handheld.Vibrate();
                    break;
                case HapticFeedbackType.HeavyImpact:
                    Handheld.Vibrate();
                    break;
                case HapticFeedbackType.Selection:
                    // Light vibration for selection
                    break;
                case HapticFeedbackType.Success:
                    Handheld.Vibrate();
                    break;
                case HapticFeedbackType.Warning:
                    Handheld.Vibrate();
                    break;
                case HapticFeedbackType.Error:
                    Handheld.Vibrate();
                    break;
            }
        }

        /// <summary>
        /// Trigger haptic feedback for gesture
        /// </summary>
        private void TriggerHapticFeedbackForGesture(GestureType gestureType)
        {
            switch (gestureType)
            {
                case GestureType.Tap:
                    TriggerHapticFeedback(HapticFeedbackType.LightImpact);
                    break;
                case GestureType.DoubleTap:
                    TriggerHapticFeedback(HapticFeedbackType.MediumImpact);
                    break;
                case GestureType.LongPress:
                    TriggerHapticFeedback(HapticFeedbackType.HeavyImpact);
                    break;
                case GestureType.Swipe:
                    TriggerHapticFeedback(HapticFeedbackType.Selection);
                    break;
                case GestureType.Pinch:
                    TriggerHapticFeedback(HapticFeedbackType.Selection);
                    break;
            }
        }

        #endregion

        #region Input Configuration

        /// <summary>
        /// Configure input settings
        /// </summary>
        private void ConfigureInputSettings()
        {
            // Enable multi-touch
            UnityEngine.Input.multiTouchEnabled = true;

            // Configure touch sensitivity
            UnityEngine.Input.simulateMouseWithTouches = false;

            // Set input handling for mobile
            if (Application.isMobilePlatform)
            {
                // Mobile-specific input settings
                QualitySettings.vSyncCount = 0;
            }
        }

        #endregion

        #region Public API

        /// <summary>
        /// Enable or disable input processing
        /// </summary>
        public void SetInputEnabled(bool enabled)
        {
            if (inputEnabled != enabled)
            {
                inputEnabled = enabled;

                // Clear active touches when disabling input
                if (!enabled)
                {
                    activeTouches.Clear();
                    touchEvents.Clear();
                }

                OnInputStateChanged?.Invoke(enabled);
                Debug.Log($"[InputManager] Input {(enabled ? "enabled" : "disabled")}");
            }
        }

        /// <summary>
        /// Enable or disable haptic feedback
        /// </summary>
        public void SetHapticFeedback(bool enabled)
        {
            enableHapticFeedback = enabled;
            Debug.Log($"[InputManager] Haptic feedback {(enabled ? "enabled" : "disabled")}");
        }

        /// <summary>
        /// Get touch data by finger ID
        /// </summary>
        public TouchData GetTouchData(int fingerId)
        {
            activeTouches.TryGetValue(fingerId, out TouchData touchData);
            return touchData;
        }

        /// <summary>
        /// Get all active touch data
        /// </summary>
        public IEnumerable<TouchData> GetAllActiveTouches()
        {
            return activeTouches.Values;
        }

        /// <summary>
        /// Check if specific finger is touching
        /// </summary>
        public bool IsFingerTouching(int fingerId)
        {
            return activeTouches.ContainsKey(fingerId);
        }

        #endregion
    }

    #region Data Structures

    /// <summary>
    /// Touch data structure
    /// </summary>
    [System.Serializable]
    public class TouchData
    {
        public int fingerId;
        public Vector2 startPosition;
        public Vector2 currentPosition;
        public Vector2 previousPosition;
        public Vector2 deltaPosition;
        public Vector2 totalDelta;
        public float startTime;
        public float lastUpdateTime;
        public float pressure;
        public float radius;

        public float Duration => Time.unscaledTime - startTime;
        public float Distance => totalDelta.magnitude;
        public Vector2 Direction => totalDelta.normalized;
        public float Speed => deltaPosition.magnitude / Time.unscaledDeltaTime;
    }

    /// <summary>
    /// Touch event structure
    /// </summary>
    [System.Serializable]
    public class TouchEvent
    {
        public TouchData touchData;
        public TouchEventType eventType;
        public float timestamp;
    }

    /// <summary>
    /// Gesture event structure
    /// </summary>
    [System.Serializable]
    public class GestureEvent
    {
        public GestureType gestureType;
        public Vector2 position;
        public Vector2 direction;
        public float magnitude;
        public float duration;
        public int touchCount;
        public float timestamp;
    }

    /// <summary>
    /// Hardware button event structure
    /// </summary>
    [System.Serializable]
    public class HardwareButtonEvent
    {
        public HardwareButtonType buttonType;
        public float timestamp;
    }

    /// <summary>
    /// Touch event types
    /// </summary>
    public enum TouchEventType
    {
        TouchDown,
        TouchMove,
        TouchUp,
        TouchStationary,
        TouchCanceled
    }

    /// <summary>
    /// Gesture types
    /// </summary>
    public enum GestureType
    {
        Tap,
        DoubleTap,
        LongPress,
        Swipe,
        Pinch,
        Rotate,
        Pan
    }

    /// <summary>
    /// Hardware button types
    /// </summary>
    public enum HardwareButtonType
    {
        Back,
        Menu,
        Home,
        VolumeUp,
        VolumeDown
    }

    /// <summary>
    /// Haptic feedback types
    /// </summary>
    public enum HapticFeedbackType
    {
        LightImpact,
        MediumImpact,
        HeavyImpact,
        Selection,
        Success,
        Warning,
        Error
    }

    #endregion
}
