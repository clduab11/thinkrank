using System;
using UnityEngine;
using UnityEngine.UIElements;
using ThinkRank.UI;
using ThinkRank.Core;
using ThinkRank.API;

namespace ThinkRank.UI.Screens
{
    /// <summary>
    /// Login screen implementation with email/password authentication
    /// Provides responsive design and form validation for mobile devices
    /// </summary>
    public class LoginScreen : UIScreen
    {
        // UI Elements
        private TextField emailField;
        private TextField passwordField;
        private Button loginButton;
        private Button registerButton;
        private Button forgotPasswordButton;
        private Label statusLabel;
        private VisualElement loadingIndicator;
        private Toggle rememberMeToggle;

        // State
        private bool isLoggingIn = false;

        /// <summary>
        /// Constructor
        /// </summary>
        public LoginScreen(string screenId, VisualElement rootElement) : base(screenId, rootElement)
        {
        }

        #region UI Setup

        /// <summary>
        /// Setup UI elements
        /// </summary>
        protected override void SetupUIElements()
        {
            // Find UI elements
            emailField = FindElement<TextField>("email-field");
            passwordField = FindElement<TextField>("password-field");
            loginButton = FindElement<Button>("login-button");
            registerButton = FindElement<Button>("register-button");
            forgotPasswordButton = FindElement<Button>("forgot-password-button");
            statusLabel = FindElement<Label>("status-label");
            loadingIndicator = FindElement<VisualElement>("loading-indicator");
            rememberMeToggle = FindElement<Toggle>("remember-me-toggle");

            // Configure password field
            if (passwordField != null)
            {
                passwordField.isPasswordField = true;
            }

            // Configure loading indicator
            if (loadingIndicator != null)
            {
                loadingIndicator.style.display = DisplayStyle.None;
            }

            // Set default values
            if (rememberMeToggle != null)
            {
                rememberMeToggle.value = true;
            }

            // Hide status label initially
            if (statusLabel != null)
            {
                statusLabel.style.display = DisplayStyle.None;
            }

            // Setup form validation styling
            SetupFormValidation();
        }

        /// <summary>
        /// Setup form validation visual feedback
        /// </summary>
        private void SetupFormValidation()
        {
            if (emailField != null)
            {
                emailField.RegisterValueChangedCallback(OnEmailChanged);
            }

            if (passwordField != null)
            {
                passwordField.RegisterValueChangedCallback(OnPasswordChanged);
            }
        }

        #endregion

        #region Event Binding

        /// <summary>
        /// Bind event handlers
        /// </summary>
        protected override void BindEvents()
        {
            // Button events
            if (loginButton != null)
            {
                loginButton.clicked += OnLoginButtonClicked;
            }

            if (registerButton != null)
            {
                registerButton.clicked += OnRegisterButtonClicked;
            }

            if (forgotPasswordButton != null)
            {
                forgotPasswordButton.clicked += OnForgotPasswordButtonClicked;
            }

            // Enter key handling for form submission
            if (passwordField != null)
            {
                passwordField.RegisterCallback<KeyDownEvent>(OnPasswordKeyDown);
            }

            // API events
            APIManager.OnAuthenticationStateChanged += OnAuthenticationStateChanged;
            APIManager.OnAPIError += OnAPIError;
        }

        /// <summary>
        /// Unbind event handlers
        /// </summary>
        protected override void UnbindEvents()
        {
            // Button events
            if (loginButton != null)
            {
                loginButton.clicked -= OnLoginButtonClicked;
            }

            if (registerButton != null)
            {
                registerButton.clicked -= OnRegisterButtonClicked;
            }

            if (forgotPasswordButton != null)
            {
                forgotPasswordButton.clicked -= OnForgotPasswordButtonClicked;
            }

            // Keyboard events
            if (passwordField != null)
            {
                passwordField.UnregisterCallback<KeyDownEvent>(OnPasswordKeyDown);
            }

            // API events
            APIManager.OnAuthenticationStateChanged -= OnAuthenticationStateChanged;
            APIManager.OnAPIError -= OnAPIError;
        }

        #endregion

        #region Event Handlers

        /// <summary>
        /// Handle login button click
        /// </summary>
        private async void OnLoginButtonClicked()
        {
            if (isLoggingIn) return;

            // Validate input
            if (!ValidateInput())
            {
                return;
            }

            // Get form values
            string email = emailField?.value?.Trim() ?? "";
            string password = passwordField?.value ?? "";
            bool rememberMe = rememberMeToggle?.value ?? true;

            try
            {
                SetLoggingInState(true);
                ShowStatus("Logging in...", false);

                // Play UI sound
                GameManager.Instance?.AudioManager?.PlayUISFX("ui_click");

                // Attempt login
                var authResponse = await GameManager.Instance.APIManager.LoginAsync(email, password, rememberMe);

                if (authResponse != null)
                {
                    ShowStatus("Login successful!", false);

                    // Play success sound
                    GameManager.Instance?.AudioManager?.PlayUISFX("ui_success");

                    // Navigate to main menu after short delay
                    await System.Threading.Tasks.Task.Delay(1000);
                    await GameManager.Instance.UIManager.NavigateToScreen("mainmenu");
                }
                else
                {
                    ShowStatus("Login failed. Please check your credentials.", true);
                    GameManager.Instance?.AudioManager?.PlayUISFX("ui_error");
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"[LoginScreen] Login error: {e.Message}");
                ShowStatus("Login failed. Please try again.", true);
                GameManager.Instance?.AudioManager?.PlayUISFX("ui_error");
            }
            finally
            {
                SetLoggingInState(false);
            }
        }

        /// <summary>
        /// Handle register button click
        /// </summary>
        private async void OnRegisterButtonClicked()
        {
            GameManager.Instance?.AudioManager?.PlayUISFX("ui_click");
            await GameManager.Instance.UIManager.NavigateToScreen("register");
        }

        /// <summary>
        /// Handle forgot password button click
        /// </summary>
        private async void OnForgotPasswordButtonClicked()
        {
            GameManager.Instance?.AudioManager?.PlayUISFX("ui_click");

            // Show forgot password overlay or navigate to reset screen
            await GameManager.Instance.UIManager.ShowOverlay("forgotpassword");
        }

        /// <summary>
        /// Handle password field key down for enter key
        /// </summary>
        private void OnPasswordKeyDown(KeyDownEvent evt)
        {
            if (evt.keyCode == KeyCode.Return || evt.keyCode == KeyCode.KeypadEnter)
            {
                OnLoginButtonClicked();
                evt.PreventDefault();
            }
        }

        /// <summary>
        /// Handle email field value changes
        /// </summary>
        private void OnEmailChanged(ChangeEvent<string> evt)
        {
            ValidateEmail(evt.newValue);
        }

        /// <summary>
        /// Handle password field value changes
        /// </summary>
        private void OnPasswordChanged(ChangeEvent<string> evt)
        {
            ValidatePassword(evt.newValue);
        }

        /// <summary>
        /// Handle authentication state changes
        /// </summary>
        private void OnAuthenticationStateChanged(bool isAuthenticated)
        {
            if (isAuthenticated && IsVisible)
            {
                // User logged in successfully, navigate to main menu
                GameManager.Instance.UIManager.NavigateToScreen("mainmenu");
            }
        }

        /// <summary>
        /// Handle API errors
        /// </summary>
        private void OnAPIError(APIError error)
        {
            if (IsVisible && isLoggingIn)
            {
                ShowStatus($"Error: {error.message}", true);
                SetLoggingInState(false);
            }
        }

        #endregion

        #region Validation

        /// <summary>
        /// Validate form input
        /// </summary>
        private bool ValidateInput()
        {
            bool isValid = true;

            // Validate email
            string email = emailField?.value?.Trim() ?? "";
            if (!ValidateEmail(email))
            {
                isValid = false;
            }

            // Validate password
            string password = passwordField?.value ?? "";
            if (!ValidatePassword(password))
            {
                isValid = false;
            }

            if (!isValid)
            {
                ShowStatus("Please check your input and try again.", true);
            }

            return isValid;
        }

        /// <summary>
        /// Validate email format
        /// </summary>
        private bool ValidateEmail(string email)
        {
            if (emailField == null) return true;

            bool isValid = !string.IsNullOrWhiteSpace(email) && email.Contains("@") && email.Contains(".");

            if (isValid)
            {
                emailField.RemoveFromClassList("invalid");
                emailField.AddToClassList("valid");
            }
            else if (!string.IsNullOrEmpty(email))
            {
                emailField.RemoveFromClassList("valid");
                emailField.AddToClassList("invalid");
            }
            else
            {
                emailField.RemoveFromClassList("valid");
                emailField.RemoveFromClassList("invalid");
            }

            return isValid;
        }

        /// <summary>
        /// Validate password requirements
        /// </summary>
        private bool ValidatePassword(string password)
        {
            if (passwordField == null) return true;

            bool isValid = !string.IsNullOrWhiteSpace(password) && password.Length >= 6;

            if (isValid)
            {
                passwordField.RemoveFromClassList("invalid");
                passwordField.AddToClassList("valid");
            }
            else if (!string.IsNullOrEmpty(password))
            {
                passwordField.RemoveFromClassList("valid");
                passwordField.AddToClassList("invalid");
            }
            else
            {
                passwordField.RemoveFromClassList("valid");
                passwordField.RemoveFromClassList("invalid");
            }

            return isValid;
        }

        #endregion

        #region UI State Management

        /// <summary>
        /// Set logging in state
        /// </summary>
        private void SetLoggingInState(bool loggingIn)
        {
            isLoggingIn = loggingIn;

            // Update UI elements
            SetElementInteractable(emailField, !loggingIn);
            SetElementInteractable(passwordField, !loggingIn);
            SetElementInteractable(loginButton, !loggingIn);
            SetElementInteractable(registerButton, !loggingIn);
            SetElementInteractable(forgotPasswordButton, !loggingIn);
            SetElementInteractable(rememberMeToggle, !loggingIn);

            // Show/hide loading indicator
            if (loadingIndicator != null)
            {
                loadingIndicator.style.display = loggingIn ? DisplayStyle.Flex : DisplayStyle.None;
            }

            // Update login button text
            if (loginButton != null)
            {
                loginButton.text = loggingIn ? "Logging in..." : "Login";
            }
        }

        /// <summary>
        /// Show status message
        /// </summary>
        private void ShowStatus(string message, bool isError)
        {
            if (statusLabel == null) return;

            statusLabel.text = message;
            statusLabel.style.display = DisplayStyle.Flex;

            // Style based on error state
            statusLabel.RemoveFromClassList("error");
            statusLabel.RemoveFromClassList("success");
            statusLabel.AddToClassList(isError ? "error" : "success");

            // Auto-hide after delay
            if (!isLoggingIn)
            {
                StartCoroutine(HideStatusAfterDelay(3f));
            }
        }

        /// <summary>
        /// Hide status message after delay
        /// </summary>
        private System.Collections.IEnumerator HideStatusAfterDelay(float delay)
        {
            yield return new WaitForSeconds(delay);

            if (statusLabel != null)
            {
                statusLabel.style.display = DisplayStyle.None;
            }
        }

        #endregion

        #region Screen Lifecycle

        /// <summary>
        /// Called before screen is shown
        /// </summary>
        protected override void OnBeforeShow()
        {
            // Clear form if not remember me
            if (rememberMeToggle?.value == false)
            {
                ClearForm();
            }

            // Focus email field
            emailField?.Focus();
        }

        /// <summary>
        /// Called after screen is hidden
        /// </summary>
        protected override void OnAfterHide()
        {
            // Clear sensitive data if not remember me
            if (rememberMeToggle?.value == false)
            {
                ClearForm();
            }

            // Reset UI state
            SetLoggingInState(false);

            if (statusLabel != null)
            {
                statusLabel.style.display = DisplayStyle.None;
            }
        }

        /// <summary>
        /// Clear form data
        /// </summary>
        private void ClearForm()
        {
            if (emailField != null)
            {
                emailField.value = "";
            }

            if (passwordField != null)
            {
                passwordField.value = "";
            }
        }

        #endregion

        #region Responsive Design

        /// <summary>
        /// Configure responsive design
        /// </summary>
        protected override void ConfigureResponsiveDesign()
        {
            // Adjust layout based on screen size and orientation
            float screenWidth = Screen.width;
            float screenHeight = Screen.height;
            bool isLandscape = screenWidth > screenHeight;

            // Add responsive classes
            RootElement.RemoveFromClassList("portrait");
            RootElement.RemoveFromClassList("landscape");
            RootElement.AddToClassList(isLandscape ? "landscape" : "portrait");

            // Add device size classes
            RootElement.RemoveFromClassList("small");
            RootElement.RemoveFromClassList("medium");
            RootElement.RemoveFromClassList("large");

            if (screenWidth < 768)
            {
                RootElement.AddToClassList("small");
            }
            else if (screenWidth < 1024)
            {
                RootElement.AddToClassList("medium");
            }
            else
            {
                RootElement.AddToClassList("large");
            }
        }

        #endregion
    }
}
