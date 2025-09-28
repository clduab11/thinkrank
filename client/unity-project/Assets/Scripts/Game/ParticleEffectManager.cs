using UnityEngine;

namespace ThinkRank.Game
{
    /// <summary>
    /// Manages particle effects for ethical framework transformations
    /// </summary>
    public class ParticleEffectManager : MonoBehaviour
    {
        [Header("Framework Particle Systems")]
        [SerializeField] private ParticleSystem crystallineEffect;
        [SerializeField] private ParticleSystem structuralEffect;
        [SerializeField] private ParticleSystem harmoniousEffect;
        [SerializeField] private ParticleSystem connectionEffect;
        
        public void PlayEffect(ParticleEffectData effect)
        {
            var particles = GetParticleSystemForEffect(effect.effectType);
            if (particles != null)
            {
                // Position the effect
                particles.transform.position = effect.position;
                
                // Configure intensity
                var main = particles.main;
                main.startLifetime = effect.duration;
                
                var emission = particles.emission;
                emission.rateOverTime = effect.intensity * 10f;
                
                // Play the effect
                particles.Play();
            }
        }
        
        private ParticleSystem GetParticleSystemForEffect(ParticleEffectType effectType)
        {
            switch (effectType)
            {
                case ParticleEffectType.CrystallineFormation:
                    return crystallineEffect;
                case ParticleEffectType.StructuralReinforcement:
                    return structuralEffect;
                case ParticleEffectType.HarmoniousGlow:
                    return harmoniousEffect;
                case ParticleEffectType.WarmConnection:
                    return connectionEffect;
                default:
                    return crystallineEffect;
            }
        }
    }
}