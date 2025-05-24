using System;
using UnityEngine;
using UnityEngine.UIElements;
using ThinkRank.UI;
using ThinkRank.Core;
using ThinkRank.API;

namespace ThinkRank.UI.Screens
{
    /// <summary>
    /// Registration screen implementation for new user account creation
    /// Provides form validation and responsive design for mobile devices
    /// </summary>
    public class RegisterScreen : UIScreen
    {
        // UI Elements
        private TextField usernameField;
        private TextField emailField;
        private TextField passwordField;
        private TextField confirmPasswordField;
        private Button registerButton;
        private Button loginButton;
        private Toggle termsToggle;
        private Label statusLabel;
        private VisualElement loadingIndicator;
        private Label passwordStrengthLabel;

        // State
        private bool isRegistering = false;

        /// <summary>
        /// Constructor
        /// </summary>
        public RegisterScreen(string screenId, VisualElement rootElement) : base(screenId, rootElement)
        {
        }

        #region UI Setup

        /// <summary>
        /// Setup UI elements
        /// </summary>
        protected override void SetupUIElements()
        {
            // Find UI elements
            usernameField = FindElement<TextField>("username-field");
            emailField = FindElement<TextField>("email-field");
            passwordField = FindElement<TextField>("password-field");
            confirmPasswordField = FindElement<TextField>("confirm-password-field");
            registerButton = FindElement<Button>("register-button");
            loginButton = FindElement<Button>("login-button");
            termsToggle = FindElement<Toggle>("terms-toggle");
            statusLabel = FindElement<Label>("status-label");
            loadingIndicator = FindElement<VisualElement>("loading-indicator");
            passwordStrengthLabel = FindElement<Label>("password-strength-label");

            // Configure password fields
            if (passwordField != null)
            {
                passwordField.isPasswordField = true;
            }

            if (confirmPasswordField != null)
            {
                confirmPasswordField.isPasswordField = true;
            }

            // Configure loading indicator
            if (loadingIndicator != null)
            {
                loadingIndicator.style.display = DisplayStyle.None;
            }

            // Hide status labels initially
            if (statusLabel != null)
            {
                statusLabel.style.display = DisplayStyle.None;
            }

            if (passwordStrengthLabel != null)
            {
                passwordStrengthLabel.style.display = DisplayStyle.None;
            }

            // Setup form validation
            SetupFormValidation();
        }

        /// <summary>
        /// Setup form validation
        /// </summary>
        private void SetupFormValidation()
        {
            if (usernameField != null)
            {
                usernameField.RegisterValueChangedCallback(OnUsernameChanged);
            }

            if (emailField != null)
            {
                emailField.RegisterValueChangedCallback(OnEmailChanged);
            }

            if (passwordField != null)
            {
                passwordField.RegisterValueChangedCallback(OnPasswordChanged);
            }

            if (confirmPasswordField != null)
            {
                confirmPasswordField.RegisterValueChangedCallback(OnConfirmPasswordChanged);
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
            if (registerButton != null)
            {
                registerButton.clicked += OnRegisterButtonClicked;
            }

            if (loginButton != null)
            {
                loginButton.clicked += OnLoginButtonClicked;
            }

            // Enter key handling
            if (confirmPasswordField != null)
            {
                confirmPasswordField.RegisterCallback<KeyDownEvent>(OnConfirmPasswordKeyDown);
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
            if (registerButton != null)
            {
                registerButton.clicked -= OnRegisterButtonClicked;
            }

            if (loginButton != null)
            {
                loginButton.clicked -= OnLoginButtonClicked;
            }

            // Keyboard events
            if (confirmPasswordField != null)
            {
                confirmPasswordField.UnregisterCallback<KeyDownEvent>(OnConfirmPasswordKeyDown);
            }

            // API events
            APIManager.OnAuthenticationStateChanged -= OnAuthenticationStateChanged;
            APIManager.OnAPIError -= OnAPIError;
        }

        #endregion

        #region Event Handlers

        /// <summary>
        /// Handle register button click
        /// </summary>
        private async void OnRegisterButtonClicked()
        {
            if (isRegistering) return;

            // Validate input
            if (!ValidateInput())
            {
                return;
            }

            // Get form values
            string username = usernameField?.value?.Trim() ?? "";
            string email = emailField?.value?.Trim() ?? "";
            string password = passwordField?.value ?? "";
            string confirmPassword = confirmPasswordField?.value ?? "";
            bool termsAccepted = termsToggle?.value ?? false;

            if (!termsAccepted)
            {
                ShowStatus("Please accept the terms and conditions.", true);
                return;
            }

            try
            {
                SetRegisteringState(true);
                ShowStatus("Creating account...", false);

                // Play UI sound
                GameManager.Instance?.AudioManager?.PlayUISFX("ui_click");

                // Attempt registration
                var authResponse = await GameManager.Instance.APIManager.RegisterAsync(email, username, password, confirmPassword);

                if (authResponse != null)
                {
                    ShowStatus("Account created successfully!", false);

                    // Play success sound
                    GameManager.Instance?.AudioManager?.PlayUISFX("ui_success");

                    // Navigate to main menu after short delay
                    await System.Threading.Tasks.Task.Delay(1000);
                    await GameManager.Instance.UIManager.NavigateToScreen("mainmenu");
                }
                else
                {
                    ShowStatus("Registration failed. Please try again.", true);
                    GameManager.Instance?.AudioManager?.PlayUISFX("ui_error");
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"[RegisterScreen] Registration error: {e.Message}");
                ShowStatus("Registration failed. Please try again.", true);
                GameManager.Instance?.AudioManager?.PlayUISFX("ui_error");
            }
            finally
            {
                SetRegisteringState(false);
            }
        }

        /// <summary>
        /// Handle login button click
        /// </summary>
        private async void OnLoginButtonClicked()
        {
            GameManager.Instance?.AudioManager?.PlayUISFX("ui_click");
            await GameManager.Instance.UIManager.NavigateBack();
        }

        /// <summary>
        /// Handle confirm password key down
        /// </summary>
        private void OnConfirmPasswordKeyDown(KeyDownEvent evt)
        {
            if (evt.keyCode == KeyCode.Return || evt.keyCode == KeyCode.KeypadEnter)
            {
                OnRegisterButtonClicked();
                evt.PreventDefault();
            }
        }

        /// <summary>
        /// Handle username field changes
        /// </summary>
        private void OnUsernameChanged(ChangeEvent<string> evt)
        {
            ValidateUsername(evt.newValue);
        }

        /// <summary>
        /// Handle email field changes
        /// </summary>
        private void OnEmailChanged(ChangeEvent<string> evt)
        {
            ValidateEmail(evt.newValue);
        }

        /// <summary>
        /// Handle password field changes
        /// </summary>
        private void OnPasswordChanged(ChangeEvent<string> evt)
        {
            ValidatePassword(evt.newValue);
            UpdatePasswordStrength(evt.newValue);

            // Re-validate confirm password if it has a value
            if (!string.IsNullOrEmpty(confirmPasswordField?.value))
            {
                ValidateConfirmPassword(confirmPasswordField.value);
            }
        }

        /// <summary>
        /// Handle confirm password field changes
        /// </summary>
        private void OnConfirmPasswordChanged(ChangeEvent<string> evt)
        {
            ValidateConfirmPassword(evt.newValue);
        }

        /// <summary>
        /// Handle authentication state changes
        /// </summary>
        private void OnAuthenticationStateChanged(bool isAuthenticated)
        {
            if (isAuthenticated && IsVisible)
            {
                // User registered successfully, navigate to main menu
                GameManager.Instance.UIManager.NavigateToScreen("mainmenu");
            }
        }

        /// <summary>
        /// Handle API errors
        /// </summary>
        private void OnAPIError(APIError error)
        {
            if (IsVisible && isRegistering)
            {
                ShowStatus($"Error: {error.message}", true);
                SetRegisteringState(false);
            }
        }

        #endregion

        #region Validation

        /// <summary>
        /// Validate all form input
        /// </summary>
        private bool ValidateInput()
        {
            bool isValid = true;

            // Validate username
            string username = usernameField?.value?.Trim() ?? "";
            if (!ValidateUsername(username))
            {
                isValid = false;
            }

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

            // Validate confirm password
            string confirmPassword = confirmPasswordField?.value ?? "";
            if (!ValidateConfirmPassword(confirmPassword))
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
        /// Validate username
        /// </summary>
        private bool ValidateUsername(string username)
        {
            if (usernameField == null) return true;

            bool isValid = !string.IsNullOrWhiteSpace(username) &&
                          username.Length >= 3 &&
                          username.Length <= 20 &&
                          System.Text.RegularExpressions.Regex.IsMatch(username, @"^[a-zA-Z0-9_]+$");

            UpdateFieldValidation(usernameField, isValid, !string.IsNullOrEmpty(username));
            return isValid;
        }

        /// <summary>
        /// Validate email format
        /// </summary>
        private bool ValidateEmail(string email)
        {
            if (emailField == null) return true;

            bool isValid = !string.IsNullOrWhiteSpace(email) &&
                          email.Contains("@") &&
                          email.Contains(".") &&
                          System.Text.RegularExpressions.Regex.IsMatch(email, @"^[^@\s]+@[^@\s]+\.[^@\s]+$");

            UpdateFieldValidation(emailField, isValid, !string.IsNullOrEmpty(email));
            return isValid;
        }

        /// <summary>
        /// Validate password strength
        /// </summary>
        private bool ValidatePassword(string password)
        {
            if (passwordField == null) return true;

            bool isValid = !string.IsNullOrWhiteSpace(password) && password.Length >= 8;

            UpdateFieldValidation(passwordField, isValid, !string.IsNullOrEmpty(password));
            return isValid;
        }

        /// <summary>
        /// Validate password confirmation
        /// </summary>
        private bool ValidateConfirmPassword(string confirmPassword)
        {
            if (confirmPasswordField == null) return true;

            string password = passwordField?.value ?? "";
            bool isValid = !string.IsNullOrEmpty(confirmPassword) && confirmPassword == password;

            UpdateFieldValidation(confirmPasswordField, isValid, !string.IsNullOrEmpty(confirmPassword));
            return isValid;
        }

        /// <summary>
        /// Update field validation styling
        /// </summary>
        private void UpdateFieldValidation(VisualElement field, bool isValid, bool hasValue)
        {
            if (field == null) return;

            field.RemoveFromClassList("valid");
            field.RemoveFromClassList("invalid");

            if (hasValue)
            {
                field.AddToClassList(isValid ? "valid" : "invalid");
            }
        }

        /// <summary>
        /// Update password strength indicator
        /// </summary>
        private void UpdatePasswordStrength(string password)
        {
            if (passwordStrengthLabel == null) return;

            if (string.IsNullOrEmpty(password))
            {
                passwordStrengthLabel.style.display = DisplayStyle.None;
                return;
            }

            passwordStrengthLabel.style.display = DisplayStyle.Flex;

            int strength = CalculatePasswordStrength(password);
            string strengthText;
            string strengthClass;

            switch (strength)
            {
                case 0:
                case 1:
                    strengthText = "Weak";
                    strengthClass = "weak";
                    break;
                case 2:
                    strengthText = "Fair";
                    strengthClass = "fair";
                    break;
                case 3:
                    strengthText = "Good";
                    strengthClass = "good";
                    break;
                case 4:
                default:
                    strengthText = "Strong";
                    strengthClass = "strong";
                    break;
            }

            passwordStrengthLabel.text = $"Password Strength: {strengthText}";
            passwordStrengthLabel.RemoveFromClassList("weak");
            passwordStrengthLabel.RemoveFromClassList("fair");
            passwordStrengthLabel.RemoveFromClassList("good");
            passwordStrengthLabel.RemoveFromClassList("strong");
            passwordStrengthLabel.AddToClassList(strengthClass);
        }

        /// <summary>
        /// Calculate password strength (0-4)
        /// </summary>
        private int CalculatePasswordStrength(string password)
        {
            if (string.IsNullOrEmpty(password)) return 0;

            int score = 0;

            // Length
            if (password.Length >= 8) score++;
            if (password.Length >= 12) score++;

            // Character variety
            if (System.Text.RegularExpressions.Regex.IsMatch(password, @"[a-z]")) score++;
            if (System.Text.RegularExpressions.Regex.IsMatch(password, @"[A-Z]")) score++;
            if (System.Text.RegularExpressions.Regex.IsMatch(password, @"\d")) score++;
            if (System.Text.RegularExpressions.Regex.IsMatch(password, @"[!@#$%^&*(),.?\"":{}|<>]")) score++;

            return Mathf.Min(score, 4);
        }

        #endregion

        #region UI State Management

        /// <summary>
        /// Set registering state
        /// </summary>
        private void SetRegisteringState(bool registering)
        {
            isRegistering = registering;

            // Update UI elements
            SetElementInteractable(usernameField, !registering);
            SetElementInteractable(emailField, !registering);
            SetElementInteractable(passwordField, !registering);
            SetElementInteractable(confirmPasswordField, !registering);
            SetElementInteractable(registerButton, !registering);
            SetElementInteractable(loginButton, !registering);
            SetElementInteractable(termsToggle, !registering);

            // Show/hide loading indicator
            if (loadingIndicator != null)
            {
                loadingIndicator.style.display = registering ? DisplayStyle.Flex : DisplayStyle.None;
            }

            // Update register button text
            if (registerButton != null)
            {
                registerButton.text = registering ? "Creating Account..." : "Create Account";
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
            if (!isRegistering)
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
            // Clear form
            ClearForm();

            // Focus username field
            usernameField?.Focus();
        }

        /// <summary>
        /// Called after screen is hidden
        /// </summary>
        protected override void OnAfterHide()
        {
            // Clear sensitive data
            ClearForm();

            // Reset UI state
            SetRegisteringState(false);

            if (statusLabel != null)
            {
                statusLabel.style.display = DisplayStyle.None;
            }

            if (passwordStrengthLabel != null)
            {
                passwordStrengthLabel.style.display = DisplayStyle.None;
            }
        }

        /// <summary>
        /// Clear form data
        /// </summary>
        private void ClearForm()
        {
            if (usernameField != null)
            {
                usernameField.value = "";
            }

            if (emailField != null)
            {
                emailField.value = "";
            }

            if (passwordField != null)
            {
                passwordField.value = "";
            }

            if (confirmPasswordField != null)
            {
                confirmPasswordField.value = "";
            }

            if (termsToggle != null)
            {
                termsToggle.value = false;
            }
        }

        #endregion

        #region Responsive Design

        /// <summary>
        /// Configure responsive design
        /// </summary>
        protected override void ConfigureResponsiveDesign()
        {
            // Apply responsive layout similar to LoginScreen
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
