const { test, expect } = require('@playwright/test');

test.describe('ThinkRank User Journey Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up test environment
    await page.goto(process.env.TEST_URL || 'http://localhost:3000');
  });

  test('Complete user registration flow', async ({ page }) => {
    // Navigate to registration
    await page.click('[data-testid="register-button"]');
    await expect(page).toHaveURL(/.*\/register/);

    // Fill registration form
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="username-input"]', 'testuser123');
    await page.fill('[data-testid="password-input"]', 'SecurePass123!');
    await page.fill('[data-testid="confirm-password-input"]', 'SecurePass123!');

    // Submit registration
    await page.click('[data-testid="submit-registration"]');

    // Verify successful registration
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page).toHaveURL(/.*\/onboarding/);
  });

  test('User login and access main game', async ({ page }) => {
    // Navigate to login
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL(/.*\/login/);

    // Fill login form
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'SecurePass123!');

    // Submit login
    await page.click('[data-testid="submit-login"]');

    // Verify successful login and navigation to main menu
    await expect(page).toHaveURL(/.*\/main-menu/);
    await expect(page.locator('[data-testid="welcome-message"]')).toBeVisible();

    // Start a research game
    await page.click('[data-testid="start-game-button"]');
    await expect(page).toHaveURL(/.*\/game/);
    await expect(page.locator('[data-testid="game-interface"]')).toBeVisible();
  });

  test('Complete research problem solving workflow', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'SecurePass123!');
    await page.click('[data-testid="submit-login"]');

    // Navigate to game
    await page.click('[data-testid="start-game-button"]');

    // Wait for game to load
    await expect(page.locator('[data-testid="research-problem"]')).toBeVisible();

    // Interact with bias detection mini-game
    await page.click('[data-testid="bias-detection-tab"]');
    await page.click('[data-testid="bias-option-1"]');
    await page.click('[data-testid="submit-bias-answer"]');

    // Verify feedback
    await expect(page.locator('[data-testid="bias-feedback"]')).toBeVisible();

    // Complete alignment task
    await page.click('[data-testid="alignment-tab"]');
    await page.drag('[data-testid="alignment-slider"]', { x: 100, y: 0 });
    await page.click('[data-testid="submit-alignment"]');

    // Submit final research contribution
    await page.fill('[data-testid="research-notes"]', 'This research shows significant bias in dataset selection.');
    await page.click('[data-testid="submit-contribution"]');

    // Verify completion and scoring
    await expect(page.locator('[data-testid="completion-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="points-earned"]')).toBeVisible();
  });

  test('Social features and leaderboard interaction', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'SecurePass123!');
    await page.click('[data-testid="submit-login"]');

    // Navigate to social tab
    await page.click('[data-testid="social-tab"]');
    await expect(page.locator('[data-testid="leaderboard"]')).toBeVisible();

    // Check user's position on leaderboard
    const userRank = await page.locator('[data-testid="user-rank"]').textContent();
    expect(parseInt(userRank)).toBeGreaterThan(0);

    // View friend suggestions
    await page.click('[data-testid="friends-tab"]');
    await expect(page.locator('[data-testid="friend-suggestions"]')).toBeVisible();

    // Send friend request
    await page.click('[data-testid="send-friend-request-1"]');
    await expect(page.locator('[data-testid="request-sent-notification"]')).toBeVisible();
  });

  test('Subscription upgrade flow', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'SecurePass123!');
    await page.click('[data-testid="submit-login"]');

    // Navigate to subscription page
    await page.click('[data-testid="upgrade-button"]');
    await expect(page).toHaveURL(/.*\/subscription/);

    // Select premium plan
    await page.click('[data-testid="premium-plan-select"]');
    await expect(page.locator('[data-testid="plan-details"]')).toBeVisible();

    // Proceed to payment (mock payment in test environment)
    await page.click('[data-testid="proceed-to-payment"]');
    await expect(page.locator('[data-testid="payment-form"]')).toBeVisible();

    // Fill payment details (test data)
    await page.fill('[data-testid="card-number"]', '4242424242424242');
    await page.fill('[data-testid="expiry-date"]', '12/25');
    await page.fill('[data-testid="cvv"]', '123');
    await page.fill('[data-testid="cardholder-name"]', 'Test User');

    // Submit payment
    await page.click('[data-testid="submit-payment"]');

    // Verify successful upgrade
    await expect(page.locator('[data-testid="upgrade-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="premium-badge"]')).toBeVisible();
  });

  test('Performance requirements validation', async ({ page }) => {
    // Measure page load time
    const startTime = Date.now();
    await page.goto('/');
    const loadTime = Date.now() - startTime;

    // Verify load time is under 3 seconds
    expect(loadTime).toBeLessThan(3000);

    // Check for 60fps during game interaction
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'SecurePass123!');
    await page.click('[data-testid="submit-login"]');

    await page.click('[data-testid="start-game-button"]');

    // Measure frame rate during interaction
    const frameRateData = await page.evaluate(() => {
      return new Promise((resolve) => {
        let frameCount = 0;
        const startTime = performance.now();

        function countFrames() {
          frameCount++;
          if (performance.now() - startTime < 1000) {
            requestAnimationFrame(countFrames);
          } else {
            resolve(frameCount);
          }
        }

        requestAnimationFrame(countFrames);
      });
    });

    // Verify 60fps performance
    expect(frameRateData).toBeGreaterThanOrEqual(55); // Allow for some variance
  });

  test('Accessibility compliance', async ({ page }) => {
    await page.goto('/');

    // Check for proper heading structure
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').count();
    expect(headings).toBeGreaterThan(0);

    // Verify all images have alt text
    const images = await page.locator('img').count();
    const imagesWithAlt = await page.locator('img[alt]').count();
    expect(imagesWithAlt).toBe(images);

    // Check for proper form labels
    const inputs = await page.locator('input').count();
    const labelsOrAriaLabels = await page.locator('input[aria-label], input[aria-labelledby], label input').count();
    expect(labelsOrAriaLabels).toBe(inputs);

    // Verify keyboard navigation
    await page.keyboard.press('Tab');
    const focusedElement = await page.locator(':focus').count();
    expect(focusedElement).toBe(1);
  });

  test('Error handling and recovery', async ({ page }) => {
    // Test network error handling
    await page.route('**/api/**', route => route.abort());

    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'SecurePass123!');
    await page.click('[data-testid="submit-login"]');

    // Verify error message is displayed
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();

    // Verify retry functionality
    await page.unroute('**/api/**');
    await page.click('[data-testid="retry-button"]');

    // Should succeed after network is restored
    await expect(page).toHaveURL(/.*\/main-menu/);
  });

  test('Data privacy and GDPR compliance', async ({ page }) => {
    await page.goto('/');

    // Check for cookie consent banner
    await expect(page.locator('[data-testid="cookie-consent"]')).toBeVisible();

    // Verify privacy policy link
    await expect(page.locator('[data-testid="privacy-policy-link"]')).toBeVisible();

    // Test data deletion request
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'SecurePass123!');
    await page.click('[data-testid="submit-login"]');

    await page.goto('/settings');
    await page.click('[data-testid="privacy-settings"]');
    await page.click('[data-testid="delete-account-button"]');

    // Verify confirmation dialog
    await expect(page.locator('[data-testid="delete-confirmation"]')).toBeVisible();
  });
});
