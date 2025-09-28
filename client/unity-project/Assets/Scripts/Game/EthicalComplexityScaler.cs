using UnityEngine;

namespace ThinkRank.Game
{
    /// <summary>
    /// Calculates ethical complexity scaling for Mind Maze generation
    /// Adapts maze difficulty based on player profile and floor depth
    /// </summary>
    public class EthicalComplexityScaler : MonoBehaviour
    {
        [Header("Complexity Parameters")]
        [SerializeField] private float baseComplexity = 0.5f;
        [SerializeField] private float floorComplexityMultiplier = 0.1f;
        [SerializeField] private float profileComplexityWeight = 0.3f;
        [SerializeField] private AnimationCurve complexityCurve = AnimationCurve.EaseInOut(0, 0, 1, 1);
        
        public float CalculateComplexity(int floorDepth, PlayerMoralProfile profile)
        {
            // Base complexity increases with floor depth
            float floorComplexity = baseComplexity + (floorDepth * floorComplexityMultiplier);
            
            // Adjust based on player profile
            float profileAdjustment = CalculateProfileComplexity(profile);
            float adjustedComplexity = floorComplexity + (profileAdjustment * profileComplexityWeight);
            
            // Apply complexity curve and clamp
            float finalComplexity = complexityCurve.Evaluate(adjustedComplexity);
            return Mathf.Clamp01(finalComplexity);
        }
        
        private float CalculateProfileComplexity(PlayerMoralProfile profile)
        {
            if (profile == null) return 0f;
            
            // Higher complexity for more experienced players
            float consistencyBonus = profile.ethicalConsistency * 0.2f;
            float confidenceBonus = profile.averageConfidence * 0.15f;
            float masteryBonus = profile.masteredFrameworks.Count * 0.1f;
            
            return consistencyBonus + confidenceBonus + masteryBonus;
        }
    }
}