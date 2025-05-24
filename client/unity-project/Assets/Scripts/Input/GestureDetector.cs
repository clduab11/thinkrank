using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace ThinkRank.Input
{
    /// <summary>
    /// Detects gestures from touch input for mobile interaction
    /// Supports tap, double-tap, long press, swipe, pinch, and pan gestures
    /// </summary>
    public class GestureDetector
    {
        // Gesture configuration
        private const float tapMaxDuration = 0.3f;
        private const float tapMaxDistance = 50f;
        private const float doubleTapMaxInterval = 0.4f;
        private const float longPressMinDuration = 0.5f;
        private const float swipeMinDistance = 100f;
        private const float swipeMaxDuration = 0.5f;
        private const float pinchMinDistance = 50f;

        // State tracking
        private Queue<GestureEvent> pendingGestures = new Queue<GestureEvent>();
        private Dictionary<int, TouchState> touchStates = new Dictionary<int, TouchState>();
        private float lastTapTime = 0f;
        private Vector2 lastTapPosition = Vector2.zero;
        private bool isLongPressDetected = false;
        private bool isPinchGesture = false;
        private bool isPanGesture = false;

        // Multi-touch state
        private Vector2 previousPinchCenter;
        private float previousPinchDistance;
        private Vector2 previousPanPosition;

        /// <summary>
        /// Initialize the gesture detector
        /// </summary>
        public void Initialize()
        {
            Debug.Log("[GestureDetector] Gesture detector initialized");
        }

        /// <summary>
        /// Process current touches and detect gestures
        /// </summary>
        public void ProcessTouches(IEnumerable<TouchData> activeTouches, List<TouchEvent> touchEvents)
        {
            // Update touch states
            UpdateTouchStates(activeTouches, touchEvents);

            // Detect gestures based on current state
            DetectGestures(activeTouches);
        }

        /// <summary>
        /// Check if there are pending gestures to process
        /// </summary>
        public bool HasPendingGestures()
        {
            return pendingGestures.Count > 0;
        }

        /// <summary>
        /// Get the next pending gesture
        /// </summary>
        public GestureEvent GetNextGesture()
        {
            return pendingGestures.Count > 0 ? pendingGestures.Dequeue() : null;
        }

        #region Touch State Management

        /// <summary>
        /// Update touch states based on current input
        /// </summary>
        private void UpdateTouchStates(IEnumerable<TouchData> activeTouches, List<TouchEvent> touchEvents)
        {
            // Process touch events to update states
            foreach (var touchEvent in touchEvents)
            {
                int fingerId = touchEvent.touchData.fingerId;

                switch (touchEvent.eventType)
                {
                    case TouchEventType.TouchDown:
                        touchStates[fingerId] = new TouchState
                        {
                            touchData = touchEvent.touchData,
                            startTime = touchEvent.timestamp,
                            lastUpdateTime = touchEvent.timestamp,
                            state = TouchPhase.Began,
                            hasMovedSignificantly = false,
                            longPressTriggered = false
                        };
                        break;

                    case TouchEventType.TouchMove:
                        if (touchStates.ContainsKey(fingerId))
                        {
                            var touchState = touchStates[fingerId];
                            touchState.touchData = touchEvent.touchData;
                            touchState.lastUpdateTime = touchEvent.timestamp;
                            touchState.state = TouchPhase.Moved;

                            // Check if touch has moved significantly
                            float distance = Vector2.Distance(touchState.touchData.startPosition, touchState.touchData.currentPosition);
                            if (distance > tapMaxDistance)
                            {
                                touchState.hasMovedSignificantly = true;
                            }
                        }
                        break;

                    case TouchEventType.TouchUp:
                        if (touchStates.ContainsKey(fingerId))
                        {
                            var touchState = touchStates[fingerId];
                            touchState.touchData = touchEvent.touchData;
                            touchState.lastUpdateTime = touchEvent.timestamp;
                            touchState.state = TouchPhase.Ended;
                        }
                        break;

                    case TouchEventType.TouchCanceled:
                        touchStates.Remove(fingerId);
                        break;
                }
            }

            // Remove ended touches
            var endedTouches = touchStates.Where(kvp => kvp.Value.state == TouchPhase.Ended).Select(kvp => kvp.Key).ToList();
            foreach (int fingerId in endedTouches)
            {
                touchStates.Remove(fingerId);
            }
        }

        #endregion

        #region Gesture Detection

        /// <summary>
        /// Detect gestures from current touch states
        /// </summary>
        private void DetectGestures(IEnumerable<TouchData> activeTouches)
        {
            var touchList = activeTouches.ToList();

            if (touchList.Count == 0)
            {
                // Reset multi-touch gesture states
                isPinchGesture = false;
                isPanGesture = false;
                return;
            }

            if (touchList.Count == 1)
            {
                DetectSingleTouchGestures(touchList[0]);
            }
            else if (touchList.Count == 2)
            {
                DetectTwoTouchGestures(touchList[0], touchList[1]);
            }
            else
            {
                DetectMultiTouchGestures(touchList);
            }
        }

        /// <summary>
        /// Detect single touch gestures (tap, double-tap, long press, swipe)
        /// </summary>
        private void DetectSingleTouchGestures(TouchData touch)
        {
            if (!touchStates.ContainsKey(touch.fingerId))
                return;

            var touchState = touchStates[touch.fingerId];

            // Long press detection
            if (!touchState.longPressTriggered &&
                !touchState.hasMovedSignificantly &&
                touch.Duration >= longPressMinDuration)
            {
                touchState.longPressTriggered = true;

                var longPressGesture = new GestureEvent
                {
                    gestureType = GestureType.LongPress,
                    position = touch.currentPosition,
                    direction = Vector2.zero,
                    magnitude = 0f,
                    duration = touch.Duration,
                    touchCount = 1,
                    timestamp = Time.unscaledTime
                };

                pendingGestures.Enqueue(longPressGesture);
                Debug.Log($"[GestureDetector] Long press detected at {touch.currentPosition}");
            }

            // Check for tap/swipe on touch end
            if (touchState.state == TouchPhase.Ended)
            {
                float duration = touch.Duration;
                float distance = touch.Distance;

                if (duration <= swipeMaxDuration && distance >= swipeMinDistance)
                {
                    // Swipe gesture
                    var swipeGesture = new GestureEvent
                    {
                        gestureType = GestureType.Swipe,
                        position = touch.startPosition,
                        direction = touch.Direction,
                        magnitude = distance,
                        duration = duration,
                        touchCount = 1,
                        timestamp = Time.unscaledTime
                    };

                    pendingGestures.Enqueue(swipeGesture);
                    Debug.Log($"[GestureDetector] Swipe detected: {touch.Direction} ({distance:F1}px)");
                }
                else if (duration <= tapMaxDuration && distance <= tapMaxDistance && !touchState.longPressTriggered)
                {
                    // Tap gesture - check for double tap
                    float timeSinceLastTap = Time.unscaledTime - lastTapTime;
                    float distanceFromLastTap = Vector2.Distance(touch.currentPosition, lastTapPosition);

                    if (timeSinceLastTap <= doubleTapMaxInterval && distanceFromLastTap <= tapMaxDistance)
                    {
                        // Double tap
                        var doubleTapGesture = new GestureEvent
                        {
                            gestureType = GestureType.DoubleTap,
                            position = touch.currentPosition,
                            direction = Vector2.zero,
                            magnitude = 0f,
                            duration = duration,
                            touchCount = 1,
                            timestamp = Time.unscaledTime
                        };

                        pendingGestures.Enqueue(doubleTapGesture);
                        Debug.Log($"[GestureDetector] Double tap detected at {touch.currentPosition}");

                        // Reset last tap to prevent triple tap
                        lastTapTime = 0f;
                    }
                    else
                    {
                        // Single tap
                        var tapGesture = new GestureEvent
                        {
                            gestureType = GestureType.Tap,
                            position = touch.currentPosition,
                            direction = Vector2.zero,
                            magnitude = 0f,
                            duration = duration,
                            touchCount = 1,
                            timestamp = Time.unscaledTime
                        };

                        pendingGestures.Enqueue(tapGesture);
                        Debug.Log($"[GestureDetector] Tap detected at {touch.currentPosition}");

                        // Store for potential double tap
                        lastTapTime = Time.unscaledTime;
                        lastTapPosition = touch.currentPosition;
                    }
                }
            }
        }

        /// <summary>
        /// Detect two touch gestures (pinch, pan, rotate)
        /// </summary>
        private void DetectTwoTouchGestures(TouchData touch1, TouchData touch2)
        {
            Vector2 currentCenter = (touch1.currentPosition + touch2.currentPosition) * 0.5f;
            float currentDistance = Vector2.Distance(touch1.currentPosition, touch2.currentPosition);

            // Initialize pinch/pan tracking
            if (!isPinchGesture && !isPanGesture)
            {
                previousPinchCenter = currentCenter;
                previousPinchDistance = currentDistance;
                previousPanPosition = currentCenter;

                // Determine if this is likely a pinch or pan gesture
                float movement1 = touch1.Distance;
                float movement2 = touch2.Distance;

                if (movement1 > tapMaxDistance || movement2 > tapMaxDistance)
                {
                    // Check if touches are moving toward/away from each other (pinch) or together (pan)
                    Vector2 touch1Dir = (touch1.currentPosition - touch1.startPosition).normalized;
                    Vector2 touch2Dir = (touch2.currentPosition - touch2.startPosition).normalized;
                    float directionDot = Vector2.Dot(touch1Dir, touch2Dir);

                    if (directionDot < 0.5f) // Touches moving in different directions
                    {
                        isPinchGesture = true;
                    }
                    else // Touches moving in similar directions
                    {
                        isPanGesture = true;
                    }
                }
            }

            // Process pinch gesture
            if (isPinchGesture)
            {
                float distanceDelta = currentDistance - previousPinchDistance;

                if (Mathf.Abs(distanceDelta) > pinchMinDistance * 0.1f) // Sensitivity threshold
                {
                    var pinchGesture = new GestureEvent
                    {
                        gestureType = GestureType.Pinch,
                        position = currentCenter,
                        direction = Vector2.zero,
                        magnitude = distanceDelta,
                        duration = Mathf.Max(touch1.Duration, touch2.Duration),
                        touchCount = 2,
                        timestamp = Time.unscaledTime
                    };

                    pendingGestures.Enqueue(pinchGesture);
                }

                previousPinchDistance = currentDistance;
            }

            // Process pan gesture
            if (isPanGesture)
            {
                Vector2 panDelta = currentCenter - previousPanPosition;

                if (panDelta.magnitude > tapMaxDistance * 0.1f) // Sensitivity threshold
                {
                    var panGesture = new GestureEvent
                    {
                        gestureType = GestureType.Pan,
                        position = currentCenter,
                        direction = panDelta.normalized,
                        magnitude = panDelta.magnitude,
                        duration = Mathf.Max(touch1.Duration, touch2.Duration),
                        touchCount = 2,
                        timestamp = Time.unscaledTime
                    };

                    pendingGestures.Enqueue(panGesture);
                }

                previousPanPosition = currentCenter;
            }
        }

        /// <summary>
        /// Detect multi-touch gestures (3+ fingers)
        /// </summary>
        private void DetectMultiTouchGestures(List<TouchData> touches)
        {
            // Calculate center of all touches
            Vector2 center = Vector2.zero;
            foreach (var touch in touches)
            {
                center += touch.currentPosition;
            }
            center /= touches.Count;

            // For now, treat 3+ touch as a pan gesture
            Vector2 previousCenter = Vector2.zero;
            foreach (var touch in touches)
            {
                previousCenter += touch.previousPosition;
            }
            previousCenter /= touches.Count;

            Vector2 panDelta = center - previousCenter;

            if (panDelta.magnitude > tapMaxDistance * 0.1f)
            {
                var multiTouchPan = new GestureEvent
                {
                    gestureType = GestureType.Pan,
                    position = center,
                    direction = panDelta.normalized,
                    magnitude = panDelta.magnitude,
                    duration = touches.Max(t => t.Duration),
                    touchCount = touches.Count,
                    timestamp = Time.unscaledTime
                };

                pendingGestures.Enqueue(multiTouchPan);
            }
        }

        #endregion

        #region Utility Methods

        /// <summary>
        /// Get swipe direction from vector
        /// </summary>
        private SwipeDirection GetSwipeDirection(Vector2 direction)
        {
            float angle = Mathf.Atan2(direction.y, direction.x) * Mathf.Rad2Deg;

            if (angle >= -45f && angle < 45f)
                return SwipeDirection.Right;
            else if (angle >= 45f && angle < 135f)
                return SwipeDirection.Up;
            else if (angle >= 135f || angle < -135f)
                return SwipeDirection.Left;
            else
                return SwipeDirection.Down;
        }

        /// <summary>
        /// Reset gesture detector state
        /// </summary>
        public void Reset()
        {
            pendingGestures.Clear();
            touchStates.Clear();
            lastTapTime = 0f;
            lastTapPosition = Vector2.zero;
            isLongPressDetected = false;
            isPinchGesture = false;
            isPanGesture = false;

            Debug.Log("[GestureDetector] Gesture detector reset");
        }

        #endregion
    }

    #region Data Structures

    /// <summary>
    /// Touch state for gesture detection
    /// </summary>
    public class TouchState
    {
        public TouchData touchData;
        public float startTime;
        public float lastUpdateTime;
        public TouchPhase state;
        public bool hasMovedSignificantly;
        public bool longPressTriggered;
    }

    /// <summary>
    /// Swipe direction enumeration
    /// </summary>
    public enum SwipeDirection
    {
        Up,
        Down,
        Left,
        Right
    }

    #endregion
}
