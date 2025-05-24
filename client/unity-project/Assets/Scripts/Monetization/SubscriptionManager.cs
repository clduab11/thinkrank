using System;
using System.Collections.Generic;
using UnityEngine;
using System.Threading.Tasks;

namespace ThinkRank.Monetization
{
    [System.Serializable]
    public class SubscriptionPlan
    {
        public string id;
        public string name;
        public string tier; // free, premium, pro
        public string description;
        public float price;
        public string currency;
        public string billingPeriod; // monthly, yearly
        public List<string> features;
        public string storeProductId; // App Store/Google Play product ID
    }

    [System.Serializable]
    public class Subscription
    {
        public string id;
        public string userId;
        public string tierType;
        public string startDate;
        public string endDate;
        public bool autoRenewal;
        public string status;
        public SubscriptionPlan plan;
    }

    [System.Serializable]
    public class UsageStats
    {
        public string userId;
        public CurrentPeriod currentPeriod;
        public int problemsSolved;
        public int dailyLimit;
        public int remaining;
        public string resetDate;
    }

    [System.Serializable]
    public class CurrentPeriod
    {
        public string startDate;
        public string endDate;
    }

    [System.Serializable]
    public class SubscriptionFeatures
    {
        public int dailyProblemsLimit;
        public bool hasAdsRemoved;
        public bool hasSocialSharing;
        public bool hasProgressAnalytics;
        public bool hasForumAccess;
        public bool hasVotingRights;
        public bool hasEarlyAccess;
        public bool hasCoAuthorshipEligibility;
        public bool hasDirectInstitutionContact;
        public bool hasCustomChallenges;
        public bool hasAdvancedAnalytics;
    }

    public enum SubscriptionTier
    {
        Free,
        Premium,
        Pro
    }

    public class SubscriptionManager : MonoBehaviour
    {
        [Header("Subscription Settings")]
        public bool enableSubscriptions = true;
        public float statusCheckInterval = 300f; // 5 minutes

        [Header("UI References")]
        public GameObject subscriptionPanelPrefab;
        public GameObject upgradePromptPrefab;
        public Transform subscriptionUIParent;

        // Events
        public static event Action<Subscription> OnSubscriptionChanged;
        public static event Action<UsageStats> OnUsageStatsUpdated;
        public static event Action<SubscriptionTier> OnTierChanged;
        public static event Action<string> OnSubscriptionError;
        public static event Action<string> OnFeatureBlocked;

        private Subscription currentSubscription;
        private List<SubscriptionPlan> availablePlans = new List<SubscriptionPlan>();
        private UsageStats currentUsageStats;
        private SubscriptionFeatures currentFeatures;
        private SubscriptionTier currentTier = SubscriptionTier.Free;

        // Predefined feature sets for each tier
        private Dictionary<SubscriptionTier, SubscriptionFeatures> tierFeatures = new Dictionary<SubscriptionTier, SubscriptionFeatures>
        {
            {
                SubscriptionTier.Free,
                new SubscriptionFeatures
                {
                    dailyProblemsLimit = 3,
                    hasAdsRemoved = false,
                    hasSocialSharing = false,
                    hasProgressAnalytics = false,
                    hasForumAccess = false,
                    hasVotingRights = false,
                    hasEarlyAccess = false,
                    hasCoAuthorshipEligibility = false,
                    hasDirectInstitutionContact = false,
                    hasCustomChallenges = false,
                    hasAdvancedAnalytics = false
                }
            },
            {
                SubscriptionTier.Premium,
                new SubscriptionFeatures
                {
                    dailyProblemsLimit = -1, // unlimited
                    hasAdsRemoved = true,
                    hasSocialSharing = true,
                    hasProgressAnalytics = true,
                    hasForumAccess = true,
                    hasVotingRights = false,
                    hasEarlyAccess = false,
                    hasCoAuthorshipEligibility = false,
                    hasDirectInstitutionContact = false,
                    hasCustomChallenges = false,
                    hasAdvancedAnalytics = false
                }
            },
            {
                SubscriptionTier.Pro,
                new SubscriptionFeatures
                {
                    dailyProblemsLimit = -1, // unlimited
                    hasAdsRemoved = true,
                    hasSocialSharing = true,
                    hasProgressAnalytics = true,
                    hasForumAccess = true,
                    hasVotingRights = true,
                    hasEarlyAccess = true,
                    hasCoAuthorshipEligibility = true,
                    hasDirectInstitutionContact = true,
                    hasCustomChallenges = true,
                    hasAdvancedAnalytics = true
                }
            }
        };

        private void Awake()
        {
            if (FindObjectsOfType<SubscriptionManager>().Length > 1)
            {
                Destroy(gameObject);
                return;
            }

            DontDestroyOnLoad(gameObject);
        }

        private void Start()
        {
            if (enableSubscriptions)
            {
                InitializeSubscriptionSystem();
                InvokeRepeating(nameof(CheckSubscriptionStatus), statusCheckInterval, statusCheckInterval);
            }
        }

        private async void InitializeSubscriptionSystem()
        {
            await LoadAvailablePlans();
            await LoadCurrentSubscription();
            await LoadUsageStats();
            UpdateFeatures();
        }

        public async Task LoadAvailablePlans()
        {
            try
            {
                var plansData = await APIManager.Instance.GetSubscriptionPlans();
                if (plansData != null)
                {
                    var response = JsonUtility.FromJson<SubscriptionPlansResponse>(plansData);
                    availablePlans = response.plans;

                    Debug.Log($"Loaded {availablePlans.Count} subscription plans");
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to load subscription plans: {e.Message}");
                OnSubscriptionError?.Invoke("Failed to load plans");
            }
        }

        public async Task LoadCurrentSubscription()
        {
            try
            {
                var subscriptionData = await APIManager.Instance.GetCurrentSubscription();
                if (subscriptionData != null)
                {
                    currentSubscription = JsonUtility.FromJson<Subscription>(subscriptionData);

                    // Update current tier
                    if (Enum.TryParse(currentSubscription.tierType, true, out SubscriptionTier tier))
                    {
                        SetCurrentTier(tier);
                    }

                    OnSubscriptionChanged?.Invoke(currentSubscription);
                    Debug.Log($"Current subscription: {currentSubscription.tierType}");
                }
                else
                {
                    // No active subscription, user is on free tier
                    SetCurrentTier(SubscriptionTier.Free);
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to load current subscription: {e.Message}");
                SetCurrentTier(SubscriptionTier.Free); // Default to free on error
            }
        }

        public async Task LoadUsageStats()
        {
            try
            {
                var usageData = await APIManager.Instance.GetUsageStats();
                if (usageData != null)
                {
                    currentUsageStats = JsonUtility.FromJson<UsageStats>(usageData);
                    OnUsageStatsUpdated?.Invoke(currentUsageStats);

                    Debug.Log($"Usage: {currentUsageStats.problemsSolved}/{currentUsageStats.dailyLimit}");
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to load usage stats: {e.Message}");
            }
        }

        private void SetCurrentTier(SubscriptionTier tier)
        {
            if (currentTier != tier)
            {
                currentTier = tier;
                UpdateFeatures();
                OnTierChanged?.Invoke(tier);
            }
        }

        private void UpdateFeatures()
        {
            if (tierFeatures.ContainsKey(currentTier))
            {
                currentFeatures = tierFeatures[currentTier];
            }
        }

        public bool HasFeature(string featureName)
        {
            if (currentFeatures == null) return false;

            return featureName switch
            {
                "ads_removed" => currentFeatures.hasAdsRemoved,
                "social_sharing" => currentFeatures.hasSocialSharing,
                "progress_analytics" => currentFeatures.hasProgressAnalytics,
                "forum_access" => currentFeatures.hasForumAccess,
                "voting_rights" => currentFeatures.hasVotingRights,
                "early_access" => currentFeatures.hasEarlyAccess,
                "coauthorship" => currentFeatures.hasCoAuthorshipEligibility,
                "institution_contact" => currentFeatures.hasDirectInstitutionContact,
                "custom_challenges" => currentFeatures.hasCustomChallenges,
                "advanced_analytics" => currentFeatures.hasAdvancedAnalytics,
                _ => false
            };
        }

        public bool CanSolveProblems()
        {
            if (currentUsageStats == null) return true;

            // Unlimited for premium and pro
            if (currentFeatures?.dailyProblemsLimit == -1) return true;

            // Check daily limit for free tier
            return currentUsageStats.remaining > 0;
        }

        public int GetRemainingProblems()
        {
            if (currentFeatures?.dailyProblemsLimit == -1) return -1; // unlimited
            return currentUsageStats?.remaining ?? 0;
        }

        public async Task<bool> PurchaseSubscription(string planId)
        {
            try
            {
                var plan = availablePlans.Find(p => p.id == planId);
                if (plan == null)
                {
                    OnSubscriptionError?.Invoke("Invalid plan selected");
                    return false;
                }

#if UNITY_IOS
                return await PurchaseViaAppStore(plan);
#elif UNITY_ANDROID
                return await PurchaseViaGooglePlay(plan);
#else
                return await PurchaseViaWeb(plan);
#endif
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to purchase subscription: {e.Message}");
                OnSubscriptionError?.Invoke("Purchase failed");
                return false;
            }
        }

        private async Task<bool> PurchaseViaAppStore(SubscriptionPlan plan)
        {
            // iOS App Store purchase logic
            Debug.Log($"Initiating App Store purchase for {plan.name}");

            // This would integrate with Unity's In-App Purchasing system
            // For now, simulate the process
            var success = await SimulatePurchase(plan);

            if (success)
            {
                await ProcessSuccessfulPurchase(plan);
            }

            return success;
        }

        private async Task<bool> PurchaseViaGooglePlay(SubscriptionPlan plan)
        {
            // Google Play purchase logic
            Debug.Log($"Initiating Google Play purchase for {plan.name}");

            // This would integrate with Google Play Billing
            // For now, simulate the process
            var success = await SimulatePurchase(plan);

            if (success)
            {
                await ProcessSuccessfulPurchase(plan);
            }

            return success;
        }

        private async Task<bool> PurchaseViaWeb(SubscriptionPlan plan)
        {
            // Web-based purchase (Stripe, etc.)
            Debug.Log($"Initiating web purchase for {plan.name}");

            try
            {
                var purchaseData = await APIManager.Instance.CreateSubscription(plan.id);
                if (purchaseData != null)
                {
                    await ProcessSuccessfulPurchase(plan);
                    return true;
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"Web purchase failed: {e.Message}");
            }

            return false;
        }

        private async Task<bool> SimulatePurchase(SubscriptionPlan plan)
        {
            // Simulate purchase delay
            await Task.Delay(2000);

            // For development, always succeed
            return true;
        }

        private async Task ProcessSuccessfulPurchase(SubscriptionPlan plan)
        {
            // Update local subscription data
            await LoadCurrentSubscription();
            await LoadUsageStats();

            Debug.Log($"Successfully purchased {plan.name}");

            // Show success feedback
            ShowPurchaseSuccessUI(plan);
        }

        public async Task<bool> CancelSubscription()
        {
            try
            {
                var success = await APIManager.Instance.CancelSubscription();
                if (success)
                {
                    Debug.Log("Subscription canceled successfully");
                    await LoadCurrentSubscription();
                    return true;
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to cancel subscription: {e.Message}");
                OnSubscriptionError?.Invoke("Failed to cancel subscription");
            }

            return false;
        }

        public void ShowUpgradePrompt(string featureName, string message = null)
        {
            if (upgradePromptPrefab != null && subscriptionUIParent != null)
            {
                var prompt = Instantiate(upgradePromptPrefab, subscriptionUIParent);
                var promptUI = prompt.GetComponent<UpgradePromptUI>();

                if (promptUI != null)
                {
                    promptUI.SetupPrompt(featureName, message ?? $"Upgrade to access {featureName}");
                }
            }

            OnFeatureBlocked?.Invoke(featureName);
        }

        private void ShowPurchaseSuccessUI(SubscriptionPlan plan)
        {
            // Show success notification or animation
            Debug.Log($"Welcome to {plan.name}! Enjoy your new features.");
        }

        public async void CheckSubscriptionStatus()
        {
            await LoadCurrentSubscription();
            await LoadUsageStats();
        }

        public SubscriptionTier GetCurrentTier()
        {
            return currentTier;
        }

        public Subscription GetCurrentSubscription()
        {
            return currentSubscription;
        }

        public List<SubscriptionPlan> GetAvailablePlans()
        {
            return availablePlans;
        }

        public SubscriptionFeatures GetCurrentFeatures()
        {
            return currentFeatures;
        }

        public string GetTierDisplayName()
        {
            return currentTier switch
            {
                SubscriptionTier.Free => "AI Explorer",
                SubscriptionTier.Premium => "AI Investigator",
                SubscriptionTier.Pro => "AI Researcher",
                _ => "Unknown"
            };
        }

        // UI Event Handlers
        public void OnUpgradeButtonClicked()
        {
            ShowSubscriptionOptions();
        }

        private void ShowSubscriptionOptions()
        {
            if (subscriptionPanelPrefab != null && subscriptionUIParent != null)
            {
                var panel = Instantiate(subscriptionPanelPrefab, subscriptionUIParent);
                var panelUI = panel.GetComponent<SubscriptionPanelUI>();

                if (panelUI != null)
                {
                    panelUI.SetupPlans(availablePlans, currentTier);
                }
            }
        }

        private void OnDestroy()
        {
            CancelInvoke();
        }
    }

    // Supporting UI classes
    public class UpgradePromptUI : MonoBehaviour
    {
        [Header("UI References")]
        public TMPro.TextMeshProUGUI titleText;
        public TMPro.TextMeshProUGUI messageText;
        public UnityEngine.UI.Button upgradeButton;
        public UnityEngine.UI.Button closeButton;

        public void SetupPrompt(string featureName, string message)
        {
            if (titleText != null)
                titleText.text = "Upgrade Required";

            if (messageText != null)
                messageText.text = message;

            if (upgradeButton != null)
            {
                upgradeButton.onClick.RemoveAllListeners();
                upgradeButton.onClick.AddListener(() => {
                    FindObjectOfType<SubscriptionManager>()?.ShowSubscriptionOptions();
                    Destroy(gameObject);
                });
            }

            if (closeButton != null)
            {
                closeButton.onClick.RemoveAllListeners();
                closeButton.onClick.AddListener(() => Destroy(gameObject));
            }
        }
    }

    public class SubscriptionPanelUI : MonoBehaviour
    {
        [Header("UI References")]
        public Transform planContainer;
        public GameObject planItemPrefab;
        public UnityEngine.UI.Button closeButton;

        public void SetupPlans(List<SubscriptionPlan> plans, SubscriptionTier currentTier)
        {
            // Clear existing plan items
            foreach (Transform child in planContainer)
            {
                Destroy(child.gameObject);
            }

            // Create plan items
            foreach (var plan in plans)
            {
                if (planItemPrefab != null)
                {
                    var planItem = Instantiate(planItemPrefab, planContainer);
                    var planItemUI = planItem.GetComponent<SubscriptionPlanItemUI>();

                    if (planItemUI != null)
                    {
                        bool isCurrent = plan.tier.ToLower() == currentTier.ToString().ToLower();
                        planItemUI.SetupPlan(plan, isCurrent);
                    }
                }
            }

            if (closeButton != null)
            {
                closeButton.onClick.RemoveAllListeners();
                closeButton.onClick.AddListener(() => Destroy(gameObject));
            }
        }
    }

    public class SubscriptionPlanItemUI : MonoBehaviour
    {
        [Header("UI References")]
        public TMPro.TextMeshProUGUI nameText;
        public TMPro.TextMeshProUGUI priceText;
        public TMPro.TextMeshProUGUI descriptionText;
        public Transform featuresContainer;
        public UnityEngine.UI.Button purchaseButton;
        public GameObject currentBadge;

        private SubscriptionPlan planData;

        public void SetupPlan(SubscriptionPlan plan, bool isCurrent)
        {
            planData = plan;

            if (nameText != null)
                nameText.text = plan.name;

            if (priceText != null)
            {
                if (plan.price == 0)
                    priceText.text = "Free";
                else
                    priceText.text = $"${plan.price:F2}/{plan.billingPeriod}";
            }

            if (descriptionText != null)
                descriptionText.text = plan.description;

            if (currentBadge != null)
                currentBadge.SetActive(isCurrent);

            // Setup features list
            SetupFeatures(plan.features);

            // Setup purchase button
            if (purchaseButton != null)
            {
                purchaseButton.onClick.RemoveAllListeners();

                if (isCurrent)
                {
                    purchaseButton.interactable = false;
                    purchaseButton.GetComponentInChildren<TMPro.TextMeshProUGUI>().text = "Current Plan";
                }
                else
                {
                    purchaseButton.onClick.AddListener(() => OnPurchaseClicked());
                    purchaseButton.GetComponentInChildren<TMPro.TextMeshProUGUI>().text = plan.price == 0 ? "Select" : "Purchase";
                }
            }
        }

        private void SetupFeatures(List<string> features)
        {
            if (featuresContainer == null) return;

            // Clear existing features
            foreach (Transform child in featuresContainer)
            {
                Destroy(child.gameObject);
            }

            // Add feature items
            foreach (var feature in features)
            {
                var featureItem = new GameObject("Feature", typeof(TMPro.TextMeshProUGUI));
                featureItem.transform.SetParent(featuresContainer);

                var text = featureItem.GetComponent<TMPro.TextMeshProUGUI>();
                text.text = "• " + feature;
                text.fontSize = 14;
            }
        }

        private async void OnPurchaseClicked()
        {
            var subscriptionManager = FindObjectOfType<SubscriptionManager>();
            if (subscriptionManager != null && planData != null)
            {
                purchaseButton.interactable = false;
                purchaseButton.GetComponentInChildren<TMPro.TextMeshProUGUI>().text = "Processing...";

                var success = await subscriptionManager.PurchaseSubscription(planData.id);

                if (success)
                {
                    Destroy(transform.parent.parent.gameObject); // Close subscription panel
                }
                else
                {
                    purchaseButton.interactable = true;
                    purchaseButton.GetComponentInChildren<TMPro.TextMeshProUGUI>().text = "Purchase";
                }
            }
        }
    }

    [System.Serializable]
    public class SubscriptionPlansResponse
    {
        public List<SubscriptionPlan> plans;
    }
}
