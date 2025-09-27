using UnityEngine;

namespace ThinkRank.Game
{
    /// <summary>
    /// Audio system for ethical framework transformations
    /// </summary>
    public class AudioTransformationSystem : MonoBehaviour
    {
        [Header("Framework Audio Clips")]
        [SerializeField] private AudioClip crystalChime;
        [SerializeField] private AudioClip stoneFormation;
        [SerializeField] private AudioClip harmoniousTone;
        [SerializeField] private AudioClip warmResonance;
        
        private AudioSource audioSource;
        
        private void Awake()
        {
            audioSource = GetComponent<AudioSource>();
            if (audioSource == null)
            {
                audioSource = gameObject.AddComponent<AudioSource>();
            }
        }
        
        public void PlayEffect(AudioEffectData effect)
        {
            var clip = GetClipForEffect(effect.soundType);
            if (clip != null && audioSource != null)
            {
                audioSource.clip = clip;
                audioSource.volume = effect.volume;
                audioSource.pitch = effect.pitch;
                audioSource.Play();
            }
        }
        
        private AudioClip GetClipForEffect(AudioEffectType effectType)
        {
            switch (effectType)
            {
                case AudioEffectType.CrystalChime:
                    return crystalChime;
                case AudioEffectType.StoneFormation:
                    return stoneFormation;
                case AudioEffectType.HarmoniousTone:
                    return harmoniousTone;
                case AudioEffectType.WarmResonance:
                    return warmResonance;
                default:
                    return crystalChime;
            }
        }
    }
}