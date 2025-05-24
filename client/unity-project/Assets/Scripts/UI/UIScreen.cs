using System;
using UnityEngine;
using UnityEngine.UIElements;
using DG.Tweening;

namespace ThinkRank.UI
{
    /// <summary>
    /// Base class for all UI screens in the ThinkRank application
    /// Provides common functionality for screen management, transitions, and responsive design
    /// </summary>
    public class UIScreen
    {
        // Screen properties
        public string ScreenId { get; private set; }
        public VisualElement RootElement { get; private set; }
        public bool IsVisible { get; private set; }
        public bool IsInitialized { get; private set; }

        // Transition properties
        protected Tween currentTransition;
        protected float transitionDuration = 0.3f;

        // Events
        public event Action<UIScreen> OnScreenShown;
        public event Action<UIScreen> OnScreenHidden;
        public event Action<UIScreen> OnScreenInitialized;

        /// <summary>
        /// Constructor for UI Screen
        /// </summary>
        public UIScreen(string screenId, VisualElement rootElement)
        {
            ScreenId = screenId;
            RootElement = rootElement;
            IsVisible = false;
            IsInitialized = false;

            // Initially hide the screen
            RootElement.style.display = DisplayStyle.None;
            RootElement.style.opacity = 0;
        }

        /// <summary>
        /// Initialize the screen - called once when screen is first loaded
        /// </summary>
        public virtual void Initialize()
        {
            if (IsInitialized) return;

            // Setup screen-specific UI elements
            SetupUIElements();

            // Bind event handlers
            BindEvents();

            // Configure responsive design
            ConfigureResponsiveDesign();

            IsInitialized = true;
            OnScreenInitialized?.Invoke(this);

            Debug.Log($"[UIScreen] Screen initialized: {ScreenId}");
        }

        /// <summary>
        /// Show the screen with optional transition
        /// </summary>
        public virtual async System.Threading.Tasks.Task Show(UITransitionType transition = UITransitionType.Fade)
        {
            if (IsVisible) return;

            // Prepare for show
            OnBeforeShow();

            // Make element visible
            RootElement.style.display = DisplayStyle.Flex;

            // Execute transition
            await ExecuteShowTransition(transition);

            IsVisible = true;
            OnAfterShow();
            OnScreenShown?.Invoke(this);

            Debug.Log($"[UIScreen] Screen shown: {ScreenId}");
        }

        /// <summary>
        /// Hide the screen with optional transition
        /// </summary>
        public virtual async System.Threading.Tasks.Task Hide(UITransitionType transition = UITransitionType.Fade)
        {
            if (!IsVisible) return;

            // Prepare for hide
            OnBeforeHide();

            // Execute transition
            await ExecuteHideTransition(transition);

            // Hide element
            RootElement.style.display = DisplayStyle.None;

            IsVisible = false;
            OnAfterHide();
            OnScreenHidden?.Invoke(this);

            Debug.Log($"[UIScreen] Screen hidden: {ScreenId}");
        }

        /// <summary>
        /// Handle screen size changes for responsive design
        /// </summary>
        public virtual void OnScreenSizeChanged(Vector2 newScreenSize)
        {
            // Override in derived classes for specific responsive behavior
            ConfigureResponsiveDesign();
        }

        /// <summary>
        /// Update method called each frame while screen is active
        /// </summary>
        public virtual void Update()
        {
            // Override in derived classes for per-frame logic
        }

        /// <summary>
        /// Cleanup method called when screen is destroyed
        /// </summary>
        public virtual void Cleanup()
        {
            // Stop any active transitions
            currentTransition?.Kill();

            // Unbind events
            UnbindEvents();

            // Custom cleanup
            OnCleanup();

            Debug.Log($"[UIScreen] Screen cleaned up: {ScreenId}");
        }

        #region Virtual Methods for Override

        /// <summary>
        /// Setup UI elements - override in derived classes
        /// </summary>
        protected virtual void SetupUIElements()
        {
            // Override in derived classes to setup specific UI elements
        }

        /// <summary>
        /// Bind event handlers - override in derived classes
        /// </summary>
        protected virtual void BindEvents()
        {
            // Override in derived classes to bind specific events
        }

        /// <summary>
        /// Unbind event handlers - override in derived classes
        /// </summary>
        protected virtual void UnbindEvents()
        {
            // Override in derived classes to unbind specific events
        }

        /// <summary>
        /// Configure responsive design - override in derived classes
        /// </summary>
        protected virtual void ConfigureResponsiveDesign()
        {
            // Override in derived classes for specific responsive behavior
        }

        /// <summary>
        /// Called before screen is shown
        /// </summary>
        protected virtual void OnBeforeShow()
        {
            // Override in derived classes for pre-show logic
        }

        /// <summary>
        /// Called after screen is shown
        /// </summary>
        protected virtual void OnAfterShow()
        {
            // Override in derived classes for post-show logic
        }

        /// <summary>
        /// Called before screen is hidden
        /// </summary>
        protected virtual void OnBeforeHide()
        {
            // Override in derived classes for pre-hide logic
        }

        /// <summary>
        /// Called after screen is hidden
        /// </summary>
        protected virtual void OnAfterHide()
        {
            // Override in derived classes for post-hide logic
        }

        /// <summary>
        /// Custom cleanup logic - override in derived classes
        /// </summary>
        protected virtual void OnCleanup()
        {
            // Override in derived classes for custom cleanup
        }

        #endregion

        #region Transition Methods

        /// <summary>
        /// Execute show transition animation
        /// </summary>
        protected virtual async System.Threading.Tasks.Task ExecuteShowTransition(UITransitionType transition)
        {
            currentTransition?.Kill();

            switch (transition)
            {
                case UITransitionType.None:
                    RootElement.style.opacity = 1;
                    break;

                case UITransitionType.Fade:
                    await ExecuteFadeIn();
                    break;

                case UITransitionType.Slide:
                    await ExecuteSlideIn();
                    break;

                case UITransitionType.Scale:
                    await ExecuteScaleIn();
                    break;

                case UITransitionType.Custom:
                    await ExecuteCustomShowTransition();
                    break;
            }
        }

        /// <summary>
        /// Execute hide transition animation
        /// </summary>
        protected virtual async System.Threading.Tasks.Task ExecuteHideTransition(UITransitionType transition)
        {
            currentTransition?.Kill();

            switch (transition)
            {
                case UITransitionType.None:
                    RootElement.style.opacity = 0;
                    break;

                case UITransitionType.Fade:
                    await ExecuteFadeOut();
                    break;

                case UITransitionType.Slide:
                    await ExecuteSlideOut();
                    break;

                case UITransitionType.Scale:
                    await ExecuteScaleOut();
                    break;

                case UITransitionType.Custom:
                    await ExecuteCustomHideTransition();
                    break;
            }
        }

        /// <summary>
        /// Fade in transition
        /// </summary>
        protected async System.Threading.Tasks.Task ExecuteFadeIn()
        {
            RootElement.style.opacity = 0;
            var tcs = new System.Threading.Tasks.TaskCompletionSource<bool>();

            currentTransition = DOVirtual.Float(0, 1, transitionDuration, (value) =>
            {
                RootElement.style.opacity = value;
            }).OnComplete(() => tcs.SetResult(true));

            await tcs.Task;
        }

        /// <summary>
        /// Fade out transition
        /// </summary>
        protected async System.Threading.Tasks.Task ExecuteFadeOut()
        {
            var tcs = new System.Threading.Tasks.TaskCompletionSource<bool>();

            currentTransition = DOVirtual.Float(1, 0, transitionDuration, (value) =>
            {
                RootElement.style.opacity = value;
            }).OnComplete(() => tcs.SetResult(true));

            await tcs.Task;
        }

        /// <summary>
        /// Slide in transition
        /// </summary>
        protected async System.Threading.Tasks.Task ExecuteSlideIn()
        {
            RootElement.style.opacity = 1;
            RootElement.style.translate = new Translate(Length.Percent(100), 0);

            var tcs = new System.Threading.Tasks.TaskCompletionSource<bool>();

            currentTransition = DOVirtual.Float(100, 0, transitionDuration, (value) =>
            {
                RootElement.style.translate = new Translate(Length.Percent(value), 0);
            }).SetEase(Ease.OutCubic).OnComplete(() => tcs.SetResult(true));

            await tcs.Task;
        }

        /// <summary>
        /// Slide out transition
        /// </summary>
        protected async System.Threading.Tasks.Task ExecuteSlideOut()
        {
            var tcs = new System.Threading.Tasks.TaskCompletionSource<bool>();

            currentTransition = DOVirtual.Float(0, -100, transitionDuration, (value) =>
            {
                RootElement.style.translate = new Translate(Length.Percent(value), 0);
            }).SetEase(Ease.InCubic).OnComplete(() => tcs.SetResult(true));

            await tcs.Task;
        }

        /// <summary>
        /// Scale in transition
        /// </summary>
        protected async System.Threading.Tasks.Task ExecuteScaleIn()
        {
            RootElement.style.opacity = 1;
            RootElement.style.scale = new Scale(Vector3.zero);

            var tcs = new System.Threading.Tasks.TaskCompletionSource<bool>();

            currentTransition = DOVirtual.Float(0, 1, transitionDuration, (value) =>
            {
                RootElement.style.scale = new Scale(Vector3.one * value);
            }).SetEase(Ease.OutBack).OnComplete(() => tcs.SetResult(true));

            await tcs.Task;
        }

        /// <summary>
        /// Scale out transition
        /// </summary>
        protected async System.Threading.Tasks.Task ExecuteScaleOut()
        {
            var tcs = new System.Threading.Tasks.TaskCompletionSource<bool>();

            currentTransition = DOVirtual.Float(1, 0, transitionDuration, (value) =>
            {
                RootElement.style.scale = new Scale(Vector3.one * value);
            }).SetEase(Ease.InBack).OnComplete(() => tcs.SetResult(true));

            await tcs.Task;
        }

        /// <summary>
        /// Custom show transition - override in derived classes
        /// </summary>
        protected virtual async System.Threading.Tasks.Task ExecuteCustomShowTransition()
        {
            // Default to fade if not overridden
            await ExecuteFadeIn();
        }

        /// <summary>
        /// Custom hide transition - override in derived classes
        /// </summary>
        protected virtual async System.Threading.Tasks.Task ExecuteCustomHideTransition()
        {
            // Default to fade if not overridden
            await ExecuteFadeOut();
        }

        #endregion

        #region Utility Methods

        /// <summary>
        /// Find child element by name
        /// </summary>
        protected T FindElement<T>(string elementName) where T : VisualElement
        {
            return RootElement.Q<T>(elementName);
        }

        /// <summary>
        /// Find child element by class
        /// </summary>
        protected T FindElementByClass<T>(string className) where T : VisualElement
        {
            return RootElement.Q<T>(className: className);
        }

        /// <summary>
        /// Add class to root element
        /// </summary>
        protected void AddClass(string className)
        {
            RootElement.AddToClassList(className);
        }

        /// <summary>
        /// Remove class from root element
        /// </summary>
        protected void RemoveClass(string className)
        {
            RootElement.RemoveFromClassList(className);
        }

        /// <summary>
        /// Toggle class on root element
        /// </summary>
        protected void ToggleClass(string className)
        {
            RootElement.ToggleInClassList(className);
        }

        /// <summary>
        /// Set element visibility
        /// </summary>
        protected void SetElementVisibility(VisualElement element, bool visible)
        {
            element.style.display = visible ? DisplayStyle.Flex : DisplayStyle.None;
        }

        /// <summary>
        /// Enable/disable element interaction
        /// </summary>
        protected void SetElementInteractable(VisualElement element, bool interactable)
        {
            element.SetEnabled(interactable);
            element.style.opacity = interactable ? 1f : 0.5f;
        }

        #endregion
    }
}
