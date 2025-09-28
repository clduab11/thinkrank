using UnityEngine;

namespace ThinkRank.Game
{
    /// <summary>
    /// Component for maze elements that can be transformed by ethical choices
    /// Provides optimization and state management for transformation effects
    /// </summary>
    public class TransformableElement : MonoBehaviour
    {
        [Header("Transformation Properties")]
        [SerializeField] private bool canBeRemoved = true;
        [SerializeField] private bool canChangeScale = true;
        [SerializeField] private bool canChangeMaterial = true;
        [SerializeField] private float maxTransformationSpeed = 2.0f;
        
        [Header("Current State")]
        [SerializeField] private TransformationState currentState = TransformationState.Idle;
        [SerializeField] private EthicalFramework lastFrameworkApplied = EthicalFramework.Utilitarian;
        
        private Vector3 originalPosition;
        private Quaternion originalRotation;
        private Vector3 originalScale;
        private Material originalMaterial;
        private Renderer elementRenderer;
        
        // Events
        public System.Action<TransformableElement> OnTransformationStarted;
        public System.Action<TransformableElement> OnTransformationCompleted;
        
        public void Initialize()
        {
            // Store original transform
            originalPosition = transform.position;
            originalRotation = transform.rotation;
            originalScale = transform.localScale;
            
            // Store original material
            elementRenderer = GetComponent<Renderer>();
            if (elementRenderer != null && elementRenderer.material != null)
            {
                originalMaterial = elementRenderer.material;
            }
            
            currentState = TransformationState.Idle;
            
            Debug.Log($"[TransformableElement] Initialized: {gameObject.name}");
        }
        
        public bool CanApplyTransformation(TransformationType transformationType)
        {
            switch (transformationType)
            {
                case TransformationType.RemoveWall:
                case TransformationType.CreatePath:
                    return canBeRemoved;
                    
                case TransformationType.ChangeElevation:
                case TransformationType.CreateBarrier:
                case TransformationType.AddWall:
                    return canChangeScale;
                    
                case TransformationType.EnhanceAesthetics:
                    return canChangeMaterial;
                    
                default:
                    return true;
            }
        }
        
        public void StartTransformation(EthicalFramework framework)
        {
            if (currentState != TransformationState.Idle)
            {
                Debug.LogWarning($"[TransformableElement] Cannot start transformation - element busy: {currentState}");
                return;
            }
            
            currentState = TransformationState.Transforming;
            lastFrameworkApplied = framework;
            
            OnTransformationStarted?.Invoke(this);
            
            Debug.Log($"[TransformableElement] Started transformation with {framework}");
        }
        
        public void CompleteTransformation()
        {
            currentState = TransformationState.Transformed;
            
            OnTransformationCompleted?.Invoke(this);
            
            Debug.Log($"[TransformableElement] Completed transformation");
        }
        
        public void ResetToOriginal()
        {
            if (currentState == TransformationState.Transforming)
            {
                Debug.LogWarning("[TransformableElement] Cannot reset during active transformation");
                return;
            }
            
            // Reset transform
            transform.position = originalPosition;
            transform.rotation = originalRotation;
            transform.localScale = originalScale;
            
            // Reset material
            if (elementRenderer != null && originalMaterial != null)
            {
                elementRenderer.material = originalMaterial;
            }
            
            currentState = TransformationState.Idle;
            
            Debug.Log($"[TransformableElement] Reset to original state");
        }
        
        public float GetTransformationProgress()
        {
            // This could track actual transformation progress
            // For now, return simple state-based progress
            switch (currentState)
            {
                case TransformationState.Idle:
                    return 0f;
                case TransformationState.Transforming:
                    return 0.5f; // Could be more sophisticated
                case TransformationState.Transformed:
                    return 1f;
                default:
                    return 0f;
            }
        }
        
        // Public Properties
        public TransformationState CurrentState => currentState;
        public EthicalFramework LastFrameworkApplied => lastFrameworkApplied;
        public Vector3 OriginalPosition => originalPosition;
        public Vector3 OriginalScale => originalScale;
        public Material OriginalMaterial => originalMaterial;
        
        // Debug visualization
        private void OnDrawGizmosSelected()
        {
            if (currentState == TransformationState.Transforming)
            {
                Gizmos.color = Color.yellow;
                Gizmos.DrawWireCube(transform.position, transform.localScale);
            }
            else if (currentState == TransformationState.Transformed)
            {
                Gizmos.color = Color.green;
                Gizmos.DrawWireCube(transform.position, transform.localScale);
            }
        }
    }
    
    public enum TransformationState
    {
        Idle,
        Transforming,
        Transformed
    }
}