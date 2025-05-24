using System;
using System.Collections.Generic;
using UnityEngine;
using System.Threading.Tasks;

namespace ThinkRank.Social
{
    [System.Serializable]
    public class UserProfile
    {
        public string id;
        public string username;
        public string displayName;
        public string avatar;
        public string bio;
        public UserStats stats;
        public List<string> achievements;
    }

    [System.Serializable]
    public class UserStats
    {
        public int totalScore;
        public int level;
        public int contributionsCount;
        public int followersCount;
        public int followingCount;
    }

    [System.Serializable]
    public class SocialInteraction
    {
        public string id;
        public string userId;
        public string targetUserId;
        public string interactionType;
        public string targetType;
        public string targetId;
        public string content;
        public string createdAt;
    }

    public class SocialManager : MonoBehaviour
    {
        [Header("Social Settings")]
        public bool enableSocialFeatures = true;
        public int maxFollowersToCache = 100;
        public float interactionCooldown = 1f;

        [Header("UI References")]
        public GameObject socialPanelPrefab;
        public Transform socialUIParent;

        // Events
        public static event Action<UserProfile> OnUserProfileLoaded;
        public static event Action<List<UserProfile>> OnFollowersLoaded;
        public static event Action<List<UserProfile>> OnFollowingLoaded;
        public static event Action<string> OnSocialError;

        private Dictionary<string, UserProfile> cachedProfiles = new Dictionary<string, UserProfile>();
        private UserProfile currentUserProfile;
        private float lastInteractionTime;

        private void Awake()
        {
            if (FindObjectsOfType<SocialManager>().Length > 1)
            {
                Destroy(gameObject);
                return;
            }

            DontDestroyOnLoad(gameObject);
        }

        private void Start()
        {
            InitializeSocialFeatures();
        }

        private void InitializeSocialFeatures()
        {
            if (!enableSocialFeatures)
            {
                Debug.Log("Social features disabled");
                return;
            }

            LoadCurrentUserProfile();
        }

        public async Task LoadCurrentUserProfile()
        {
            try
            {
                var profileData = await APIManager.Instance.GetUserProfile(APIManager.Instance.GetCurrentUserId());

                if (profileData != null)
                {
                    currentUserProfile = JsonUtility.FromJson<UserProfile>(profileData);
                    cachedProfiles[currentUserProfile.id] = currentUserProfile;
                    OnUserProfileLoaded?.Invoke(currentUserProfile);

                    Debug.Log($"Loaded profile for {currentUserProfile.username}");
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to load user profile: {e.Message}");
                OnSocialError?.Invoke("Failed to load profile");
            }
        }

        public async Task<UserProfile> GetUserProfile(string userId)
        {
            // Check cache first
            if (cachedProfiles.ContainsKey(userId))
            {
                return cachedProfiles[userId];
            }

            try
            {
                var profileData = await APIManager.Instance.GetUserProfile(userId);
                if (profileData != null)
                {
                    var profile = JsonUtility.FromJson<UserProfile>(profileData);
                    cachedProfiles[userId] = profile;
                    return profile;
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to fetch user profile for {userId}: {e.Message}");
                OnSocialError?.Invoke("Failed to load user profile");
            }

            return null;
        }

        public async Task<List<UserProfile>> SearchUsers(string query)
        {
            try
            {
                var searchData = await APIManager.Instance.SearchUsers(query);
                if (searchData != null)
                {
                    var searchResult = JsonUtility.FromJson<UserSearchResponse>(searchData);

                    // Cache the results
                    foreach (var user in searchResult.users)
                    {
                        cachedProfiles[user.id] = user;
                    }

                    return searchResult.users;
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to search users: {e.Message}");
                OnSocialError?.Invoke("Search failed");
            }

            return new List<UserProfile>();
        }

        public async Task<bool> FollowUser(string userId)
        {
            if (!CanPerformInteraction())
                return false;

            try
            {
                var success = await APIManager.Instance.FollowUser(userId);
                if (success)
                {
                    lastInteractionTime = Time.time;

                    // Update cached profile if available
                    if (cachedProfiles.ContainsKey(userId))
                    {
                        // This would typically be updated from server response
                        Debug.Log($"Successfully followed user {userId}");
                    }

                    // Update current user's following count
                    if (currentUserProfile != null)
                    {
                        currentUserProfile.stats.followingCount++;
                    }
                }

                return success;
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to follow user {userId}: {e.Message}");
                OnSocialError?.Invoke("Failed to follow user");
                return false;
            }
        }

        public async Task<bool> UnfollowUser(string userId)
        {
            if (!CanPerformInteraction())
                return false;

            try
            {
                var success = await APIManager.Instance.UnfollowUser(userId);
                if (success)
                {
                    lastInteractionTime = Time.time;

                    // Update current user's following count
                    if (currentUserProfile != null)
                    {
                        currentUserProfile.stats.followingCount = Mathf.Max(0, currentUserProfile.stats.followingCount - 1);
                    }
                }

                return success;
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to unfollow user {userId}: {e.Message}");
                OnSocialError?.Invoke("Failed to unfollow user");
                return false;
            }
        }

        public async Task LoadFollowers(string userId)
        {
            try
            {
                var followersData = await APIManager.Instance.GetFollowers(userId);
                if (followersData != null)
                {
                    var followersResponse = JsonUtility.FromJson<UserListResponse>(followersData);

                    // Cache followers
                    foreach (var follower in followersResponse.users)
                    {
                        cachedProfiles[follower.id] = follower;
                    }

                    OnFollowersLoaded?.Invoke(followersResponse.users);
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to load followers: {e.Message}");
                OnSocialError?.Invoke("Failed to load followers");
            }
        }

        public async Task LoadFollowing(string userId)
        {
            try
            {
                var followingData = await APIManager.Instance.GetFollowing(userId);
                if (followingData != null)
                {
                    var followingResponse = JsonUtility.FromJson<UserListResponse>(followingData);

                    // Cache following
                    foreach (var following in followingResponse.users)
                    {
                        cachedProfiles[following.id] = following;
                    }

                    OnFollowingLoaded?.Invoke(followingResponse.users);
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to load following: {e.Message}");
                OnSocialError?.Invoke("Failed to load following");
            }
        }

        public async Task<bool> LikeContent(string targetType, string targetId)
        {
            if (!CanPerformInteraction())
                return false;

            try
            {
                var success = await APIManager.Instance.LikeContent(targetType, targetId);
                if (success)
                {
                    lastInteractionTime = Time.time;
                    Debug.Log($"Liked {targetType} {targetId}");
                }

                return success;
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to like content: {e.Message}");
                OnSocialError?.Invoke("Failed to like content");
                return false;
            }
        }

        public async Task<bool> UnlikeContent(string targetType, string targetId)
        {
            if (!CanPerformInteraction())
                return false;

            try
            {
                var success = await APIManager.Instance.UnlikeContent(targetType, targetId);
                if (success)
                {
                    lastInteractionTime = Time.time;
                    Debug.Log($"Unliked {targetType} {targetId}");
                }

                return success;
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to unlike content: {e.Message}");
                OnSocialError?.Invoke("Failed to unlike content");
                return false;
            }
        }

        public async Task<bool> AddComment(string targetType, string targetId, string content)
        {
            if (!CanPerformInteraction())
                return false;

            try
            {
                var success = await APIManager.Instance.AddComment(targetType, targetId, content);
                if (success)
                {
                    lastInteractionTime = Time.time;
                    Debug.Log($"Added comment to {targetType} {targetId}");
                }

                return success;
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to add comment: {e.Message}");
                OnSocialError?.Invoke("Failed to add comment");
                return false;
            }
        }

        private bool CanPerformInteraction()
        {
            return Time.time - lastInteractionTime >= interactionCooldown;
        }

        public UserProfile GetCurrentUserProfile()
        {
            return currentUserProfile;
        }

        public void ClearCache()
        {
            cachedProfiles.Clear();
        }

        private void OnDestroy()
        {
            ClearCache();
        }
    }

    [System.Serializable]
    public class UserSearchResponse
    {
        public List<UserProfile> users;
    }

    [System.Serializable]
    public class UserListResponse
    {
        public List<UserProfile> users;
    }
}
