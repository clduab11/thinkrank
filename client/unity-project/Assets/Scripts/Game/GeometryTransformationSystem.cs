using System;
using System.Collections.Generic;
using UnityEngine;
using System.Threading.Tasks;
using System.Collections;

namespace ThinkRank.Game
{
    /// <summary>
    /// Handles dynamic geometry transformation of maze structures in response to ethical choices
    /// Creates visual manifestations of ethical decisions through architectural changes
    /// </summary>
    public class GeometryTransformationSystem : MonoBehaviour
    {
        [Header("Transformation Settings")]
        [SerializeField] private AnimationCurve transformationEasing = AnimationCurve.EaseInOut(0, 0, 1, 1);
        [SerializeField] private MaterialTransitionLibrary materialLibrary;
        [SerializeField] private AudioTransformationSystem audioSystem;
        [SerializeField] private ParticleEffectManager particleManager;
        
        [Header("Performance Settings")]
        [SerializeField] private float maxTransformationDuration = 3.0f;
        [SerializeField] private int maxConcurrentTransformations = 5;
        [SerializeField] private bool enableOptimizedTransformations = true;
        
        private MazeData currentMazeData;
        private List<ActiveTransformation> activeTransformations;
        private Queue<PendingTransformation> transformationQueue;
        private bool isInitialized = false;
        
        // Events
        public static event Action<MazeTransformation> OnTransformationStarted;
        public static event Action<MazeTransformation> OnTransformationCompleted;
        public static event Action<TransformationError> OnTransformationError;
        
        public void Initialize()
        {
            activeTransformations = new List<ActiveTransformation>();
            transformationQueue = new Queue<PendingTransformation>();
            
            // Initialize sub-systems
            if (materialLibrary == null)
                materialLibrary = gameObject.AddComponent<MaterialTransitionLibrary>();
                
            if (audioSystem == null)
                audioSystem = gameObject.AddComponent<AudioTransformationSystem>();
                
            if (particleManager == null)
                particleManager = gameObject.AddComponent<ParticleEffectManager>();
                
            isInitialized = true;
            Debug.Log("[GeometryTransformationSystem] Initialized successfully");
        }
        
        public void InitializeMaze(MazeData mazeData)
        {
            currentMazeData = mazeData;
            
            // Pre-prepare transformable elements for efficiency
            if (enableOptimizedTransformations)
            {
                PrepareTransformableElements();
            }
        }
        
        private void PrepareTransformableElements()
        {
            if (currentMazeData?.geometry?.transformableElements == null)
                return;
                
            foreach (var element in currentMazeData.geometry.transformableElements)
            {
                // Add transformation component if not present
                if (element.GetComponent<TransformableElement>() == null)
                {
                    var transformComponent = element.AddComponent<TransformableElement>();
                    transformComponent.Initialize();
                }
                
                // Pre-cache materials and prepare for transformation
                var renderer = element.GetComponent<Renderer>();
                if (renderer != null && materialLibrary != null)
                {
                    materialLibrary.PrepareMaterials(renderer);
                }
            }
        }
        
        public async Task<MazeTransformation> CalculateTransformation(EthicalChoice choice, MazeData mazeData)
        {
            if (!isInitialized)
            {
                Debug.LogError("[GeometryTransformationSystem] System not initialized");
                return null;
            }
            
            try
            {
                var transformation = new MazeTransformation
                {
                    id = System.Guid.NewGuid().ToString(),
                    triggeringChoice = choice,
                    framework = DetermineEthicalFramework(choice),
                    transformationElements = new List<GeometryTransformationElement>()
                };
                
                // Calculate specific transformations based on ethical choice
                await CalculateFrameworkSpecificTransformations(transformation, choice, mazeData);
                
                // Calculate visual and audio effects
                CalculateEffects(transformation);
                
                Debug.Log($"[GeometryTransformationSystem] Calculated transformation with {transformation.transformationElements.Count} elements");
                return transformation;
            }
            catch (Exception ex)
            {
                Debug.LogError($"[GeometryTransformationSystem] Failed to calculate transformation: {ex.Message}");
                return null;
            }
        }
        
        private EthicalFramework DetermineEthicalFramework(EthicalChoice choice)
        {
            // Analyze choice to determine which framework was applied
            if (choice.selectedOptionId.ToLower().Contains("utilitarian") || choice.selectedOptionId.ToLower().Contains("benefit"))
                return EthicalFramework.Utilitarian;
            else if (choice.selectedOptionId.ToLower().Contains("deontological") || choice.selectedOptionId.ToLower().Contains("principle"))
                return EthicalFramework.Deontological;
            else if (choice.selectedOptionId.ToLower().Contains("virtue"))
                return EthicalFramework.VirtueEthics;
            else
                return EthicalFramework.CareEthics;
        }
        
        private async Task CalculateFrameworkSpecificTransformations(MazeTransformation transformation, EthicalChoice choice, MazeData mazeData)
        {
            switch (transformation.framework)
            {
                case EthicalFramework.Utilitarian:
                    await CalculateUtilitarianTransformations(transformation, choice, mazeData);
                    break;
                    
                case EthicalFramework.Deontological:
                    await CalculateDeontologicalTransformations(transformation, choice, mazeData);
                    break;
                    
                case EthicalFramework.VirtueEthics:
                    await CalculateVirtueEthicsTransformations(transformation, choice, mazeData);
                    break;
                    
                case EthicalFramework.CareEthics:
                    await CalculateCareEthicsTransformations(transformation, choice, mazeData);
                    break;
            }
        }
        
        private async Task CalculateUtilitarianTransformations(MazeTransformation transformation, EthicalChoice choice, MazeData mazeData)
        {
            // Utilitarian ethics: Create efficient paths, remove barriers that prevent greatest good
            var decisionPoint = GetDecisionPointForChoice(choice, mazeData);
            if (decisionPoint == null) return;
            
            // Create efficient pathway
            var pathTransformation = new GeometryTransformationElement
            {
                targetObject = FindNearestTransformableWall(decisionPoint.position),
                transformationType = TransformationType.RemoveWall,
                startTransform = GetCurrentTransform(FindNearestTransformableWall(decisionPoint.position)),
                endTransform = CalculateUtilitarianEndTransform(decisionPoint.position),
                duration = 2.0f,
                easing = transformationEasing
            };
            
            transformation.transformationElements.Add(pathTransformation);
            
            // Add utilitarian visual elements (crystalline, efficient structures)
            await AddUtilitarianVisualElements(transformation, decisionPoint);
        }
        
        private async Task CalculateDeontologicalTransformations(MazeTransformation transformation, EthicalChoice choice, MazeData mazeData)
        {
            // Deontological ethics: Reinforce structure, create formal barriers and rules
            var decisionPoint = GetDecisionPointForChoice(choice, mazeData);
            if (decisionPoint == null) return;
            
            // Create structured barrier or reinforcement
            var structureTransformation = new GeometryTransformationElement
            {
                targetObject = FindNearestTransformableWall(decisionPoint.position),
                transformationType = TransformationType.CreateBarrier,
                startTransform = GetCurrentTransform(FindNearestTransformableWall(decisionPoint.position)),
                endTransform = CalculateDeontologicalEndTransform(decisionPoint.position),
                duration = 2.5f,
                easing = AnimationCurve.Linear(0, 0, 1, 1) // More rigid, formal transformation
            };
            
            transformation.transformationElements.Add(structureTransformation);
            
            // Add deontological visual elements (formal, classical architecture)
            await AddDeontologicalVisualElements(transformation, decisionPoint);
        }
        
        private async Task CalculateVirtueEthicsTransformations(MazeTransformation transformation, EthicalChoice choice, MazeData mazeData)
        {
            // Virtue ethics: Create beautiful, harmonious changes that reflect good character
            var decisionPoint = GetDecisionPointForChoice(choice, mazeData);
            if (decisionPoint == null) return;
            
            // Create aesthetic enhancement
            var beautyTransformation = new GeometryTransformationElement
            {
                targetObject = decisionPoint.gameObject,
                transformationType = TransformationType.EnhanceAesthetics,
                startTransform = GetCurrentTransform(decisionPoint.gameObject),
                endTransform = CalculateVirtueEthicsEndTransform(decisionPoint),
                duration = 3.0f,
                easing = transformationEasing
            };
            
            transformation.transformationElements.Add(beautyTransformation);
            
            // Add virtue ethics visual elements (organic, beautiful forms)
            await AddVirtueEthicsVisualElements(transformation, decisionPoint);
        }
        
        private async Task CalculateCareEthicsTransformations(MazeTransformation transformation, EthicalChoice choice, MazeData mazeData)
        {
            // Care ethics: Create connections, bridge-building, nurturing elements
            var decisionPoint = GetDecisionPointForChoice(choice, mazeData);
            if (decisionPoint == null) return;
            
            // Create connecting elements
            var connectionTransformation = new GeometryTransformationElement
            {
                targetObject = FindNearestTransformableWall(decisionPoint.position),
                transformationType = TransformationType.CreatePath,
                startTransform = GetCurrentTransform(FindNearestTransformableWall(decisionPoint.position)),
                endTransform = CalculateCareEthicsEndTransform(decisionPoint.position),
                duration = 2.0f,
                easing = AnimationCurve.EaseInOut(0, 0, 1, 1)
            };
            
            transformation.transformationElements.Add(connectionTransformation);
            
            // Add care ethics visual elements (warm, connecting, nurturing)
            await AddCareEthicsVisualElements(transformation, decisionPoint);
        }
        
        private DecisionPoint GetDecisionPointForChoice(EthicalChoice choice, MazeData mazeData)
        {
            if (choice.scenarioIndex >= 0 && choice.scenarioIndex < mazeData.decisionPoints.Count)
            {
                return mazeData.decisionPoints[choice.scenarioIndex];
            }
            return null;
        }
        
        private GameObject FindNearestTransformableWall(Vector3 position)
        {
            if (currentMazeData?.geometry?.transformableElements == null)
                return null;
                
            GameObject nearest = null;
            float nearestDistance = float.MaxValue;
            
            foreach (var element in currentMazeData.geometry.transformableElements)
            {
                if (element == null) continue;
                
                float distance = Vector3.Distance(position, element.transform.position);
                if (distance < nearestDistance)
                {
                    nearestDistance = distance;
                    nearest = element;
                }
            }
            
            return nearest;
        }
        
        private TransformData GetCurrentTransform(GameObject obj)
        {
            if (obj == null) return new TransformData();
            
            return new TransformData
            {
                position = obj.transform.position,
                rotation = obj.transform.rotation,
                scale = obj.transform.localScale
            };
        }
        
        private TransformData CalculateUtilitarianEndTransform(Vector3 decisionPointPosition)
        {
            // Utilitarian: Efficient, minimal, clean transformation
            return new TransformData
            {
                position = decisionPointPosition + (Vector3.down * 2), // Sink walls to create paths
                rotation = Quaternion.identity,
                scale = new Vector3(1, 0.1f, 1) // Flatten to create efficient passage
            };
        }
        
        private TransformData CalculateDeontologicalEndTransform(Vector3 decisionPointPosition)
        {
            // Deontological: Structured, formal, rule-based transformation
            return new TransformData
            {
                position = decisionPointPosition + (Vector3.up * 0.5f), // Raise to create formal barrier
                rotation = Quaternion.identity,
                scale = new Vector3(1.2f, 1.5f, 1.2f) // Stronger, more formal structure
            };
        }
        
        private TransformData CalculateVirtueEthicsEndTransform(DecisionPoint decisionPoint)
        {
            // Virtue ethics: Beautiful, harmonious transformation
            return new TransformData
            {
                position = decisionPoint.position + (Vector3.up * 0.3f),
                rotation = Quaternion.Euler(0, 45, 0), // Elegant rotation
                scale = new Vector3(1.3f, 1.1f, 1.3f) // Graceful expansion
            };
        }
        
        private TransformData CalculateCareEthicsEndTransform(Vector3 decisionPointPosition)
        {
            // Care ethics: Connecting, bridge-building transformation
            return new TransformData
            {
                position = decisionPointPosition,
                rotation = Quaternion.identity,
                scale = new Vector3(0.8f, 1.2f, 0.8f) // Gentle, connecting form
            };
        }
        
        private void CalculateEffects(MazeTransformation transformation)
        {
            transformation.particleEffects = CalculateParticleEffects(transformation);
            transformation.audioEffects = CalculateAudioEffects(transformation);
            transformation.materialChanges = CalculateMaterialChanges(transformation);
        }
        
        private List<ParticleEffectData> CalculateParticleEffects(MazeTransformation transformation)
        {
            var effects = new List<ParticleEffectData>();
            
            foreach (var element in transformation.transformationElements)
            {
                var effect = new ParticleEffectData
                {
                    effectType = GetParticleEffectForFramework(transformation.framework),
                    position = element.startTransform.position,
                    duration = element.duration,
                    intensity = CalculateEffectIntensity(transformation.framework)
                };
                
                effects.Add(effect);
            }
            
            return effects;
        }
        
        private ParticleEffectType GetParticleEffectForFramework(EthicalFramework framework)
        {
            switch (framework)
            {
                case EthicalFramework.Utilitarian:
                    return ParticleEffectType.CrystallineFormation;
                case EthicalFramework.Deontological:
                    return ParticleEffectType.StructuralReinforcement;
                case EthicalFramework.VirtueEthics:
                    return ParticleEffectType.HarmoniousGlow;
                case EthicalFramework.CareEthics:
                    return ParticleEffectType.WarmConnection;
                default:
                    return ParticleEffectType.CrystallineFormation;
            }
        }
        
        private float CalculateEffectIntensity(EthicalFramework framework)
        {
            // Different frameworks have different visual intensities
            switch (framework)
            {
                case EthicalFramework.Utilitarian:
                    return 0.8f; // Clean, efficient
                case EthicalFramework.Deontological:
                    return 1.0f; // Strong, formal
                case EthicalFramework.VirtueEthics:
                    return 1.2f; // Beautiful, prominent
                case EthicalFramework.CareEthics:
                    return 0.9f; // Warm, gentle
                default:
                    return 1.0f;
            }
        }
        
        private List<AudioEffectData> CalculateAudioEffects(MazeTransformation transformation)
        {
            var effects = new List<AudioEffectData>();
            
            // Add framework-specific audio
            effects.Add(new AudioEffectData
            {
                soundType = GetAudioEffectForFramework(transformation.framework),
                volume = 0.7f,
                pitch = 1.0f,
                duration = 2.0f
            });
            
            return effects;
        }
        
        private AudioEffectType GetAudioEffectForFramework(EthicalFramework framework)
        {
            switch (framework)
            {
                case EthicalFramework.Utilitarian:
                    return AudioEffectType.CrystalChime;
                case EthicalFramework.Deontological:
                    return AudioEffectType.StoneFormation;
                case EthicalFramework.VirtueEthics:
                    return AudioEffectType.HarmoniousTone;
                case EthicalFramework.CareEthics:
                    return AudioEffectType.WarmResonance;
                default:
                    return AudioEffectType.CrystalChime;
            }
        }
        
        private List<MaterialChangeData> CalculateMaterialChanges(MazeTransformation transformation)
        {
            var changes = new List<MaterialChangeData>();
            
            foreach (var element in transformation.transformationElements)
            {
                if (element.targetObject != null)
                {
                    changes.Add(new MaterialChangeData
                    {
                        targetObject = element.targetObject,
                        newMaterial = GetMaterialForFramework(transformation.framework),
                        transitionDuration = element.duration
                    });
                }
            }
            
            return changes;
        }
        
        private Material GetMaterialForFramework(EthicalFramework framework)
        {
            if (materialLibrary != null)
            {
                return materialLibrary.GetFrameworkMaterial(framework);
            }
            return null;
        }
        
        public async Task ApplyTransformation(MazeTransformation transformation)
        {
            if (!isInitialized || transformation == null)
            {
                Debug.LogError("[GeometryTransformationSystem] Cannot apply transformation - system not ready");
                return;
            }
            
            // Check if we can apply immediately or queue
            if (activeTransformations.Count >= maxConcurrentTransformations)
            {
                transformationQueue.Enqueue(new PendingTransformation { transformation = transformation });
                return;
            }
            
            try
            {
                OnTransformationStarted?.Invoke(transformation);
                
                var activeTransform = new ActiveTransformation
                {
                    transformation = transformation,
                    startTime = Time.time,
                    coroutine = StartCoroutine(ExecuteTransformation(transformation))
                };
                
                activeTransformations.Add(activeTransform);
                
                Debug.Log($"[GeometryTransformationSystem] Started transformation {transformation.id}");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[GeometryTransformationSystem] Failed to apply transformation: {ex.Message}");
                OnTransformationError?.Invoke(new TransformationError
                {
                    transformationId = transformation.id,
                    errorMessage = ex.Message
                });
            }
        }
        
        private IEnumerator ExecuteTransformation(MazeTransformation transformation)
        {
            // Start particle effects
            if (particleManager != null && transformation.particleEffects != null)
            {
                foreach (var effect in transformation.particleEffects)
                {
                    particleManager.PlayEffect(effect);
                }
            }
            
            // Start audio effects
            if (audioSystem != null && transformation.audioEffects != null)
            {
                foreach (var effect in transformation.audioEffects)
                {
                    audioSystem.PlayEffect(effect);
                }
            }
            
            // Execute geometry transformations
            var transformTasks = new List<Coroutine>();
            
            foreach (var element in transformation.transformationElements)
            {
                if (element.targetObject != null)
                {
                    var task = StartCoroutine(ExecuteElementTransformation(element));
                    transformTasks.Add(task);
                }
            }
            
            // Wait for all element transformations to complete
            foreach (var task in transformTasks)
            {
                yield return task;
            }
            
            // Apply material changes
            if (transformation.materialChanges != null)
            {
                foreach (var change in transformation.materialChanges)
                {
                    ApplyMaterialChange(change);
                }
            }
            
            // Transformation completed
            OnTransformationCompleted?.Invoke(transformation);
            
            // Remove from active transformations
            activeTransformations.RemoveAll(at => at.transformation.id == transformation.id);
            
            // Process queued transformations
            ProcessTransformationQueue();
        }
        
        private IEnumerator ExecuteElementTransformation(GeometryTransformationElement element)
        {
            if (element.targetObject == null) yield break;
            
            float elapsed = 0f;
            var startTransform = element.startTransform;
            var endTransform = element.endTransform;
            
            while (elapsed < element.duration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / element.duration;
                
                // Apply easing curve
                float easedT = element.easing.Evaluate(t);
                
                // Interpolate transform
                Vector3 newPosition = Vector3.Lerp(startTransform.position, endTransform.position, easedT);
                Quaternion newRotation = Quaternion.Lerp(startTransform.rotation, endTransform.rotation, easedT);
                Vector3 newScale = Vector3.Lerp(startTransform.scale, endTransform.scale, easedT);
                
                // Apply transform
                element.targetObject.transform.position = newPosition;
                element.targetObject.transform.rotation = newRotation;
                element.targetObject.transform.localScale = newScale;
                
                yield return null;
            }
            
            // Ensure final transform is exact
            element.targetObject.transform.position = endTransform.position;
            element.targetObject.transform.rotation = endTransform.rotation;
            element.targetObject.transform.localScale = endTransform.scale;
        }
        
        private void ApplyMaterialChange(MaterialChangeData change)
        {
            if (change.targetObject != null && change.newMaterial != null)
            {
                var renderer = change.targetObject.GetComponent<Renderer>();
                if (renderer != null)
                {
                    // In a full implementation, this would be a gradual transition
                    renderer.material = change.newMaterial;
                }
            }
        }
        
        private void ProcessTransformationQueue()
        {
            while (transformationQueue.Count > 0 && activeTransformations.Count < maxConcurrentTransformations)
            {
                var pending = transformationQueue.Dequeue();
                _ = ApplyTransformation(pending.transformation);
            }
        }
        
        // Placeholder implementations for utility functions
        private async Task AddUtilitarianVisualElements(MazeTransformation transformation, DecisionPoint decisionPoint)
        {
            // Add crystalline, efficient visual elements
            await Task.Delay(1); // Placeholder
        }
        
        private async Task AddDeontologicalVisualElements(MazeTransformation transformation, DecisionPoint decisionPoint)
        {
            // Add formal, structured visual elements
            await Task.Delay(1); // Placeholder
        }
        
        private async Task AddVirtueEthicsVisualElements(MazeTransformation transformation, DecisionPoint decisionPoint)
        {
            // Add beautiful, harmonious visual elements
            await Task.Delay(1); // Placeholder
        }
        
        private async Task AddCareEthicsVisualElements(MazeTransformation transformation, DecisionPoint decisionPoint)
        {
            // Add warm, connecting visual elements
            await Task.Delay(1); // Placeholder
        }
    }
    
    // Supporting data structures
    [System.Serializable]
    public class MazeTransformation
    {
        public string id;
        public EthicalChoice triggeringChoice;
        public EthicalFramework framework;
        public List<GeometryTransformationElement> transformationElements;
        public List<ParticleEffectData> particleEffects;
        public List<AudioEffectData> audioEffects;
        public List<MaterialChangeData> materialChanges;
    }
    
    [System.Serializable]
    public class GeometryTransformationElement
    {
        public GameObject targetObject;
        public TransformationType transformationType;
        public TransformData startTransform;
        public TransformData endTransform;
        public float duration;
        public AnimationCurve easing;
    }
    
    [System.Serializable]
    public class TransformData
    {
        public Vector3 position;
        public Quaternion rotation;
        public Vector3 scale;
    }
    
    [System.Serializable]
    public class ParticleEffectData
    {
        public ParticleEffectType effectType;
        public Vector3 position;
        public float duration;
        public float intensity;
    }
    
    [System.Serializable]
    public class AudioEffectData
    {
        public AudioEffectType soundType;
        public float volume;
        public float pitch;
        public float duration;
    }
    
    [System.Serializable]
    public class MaterialChangeData
    {
        public GameObject targetObject;
        public Material newMaterial;
        public float transitionDuration;
    }
    
    [System.Serializable]
    public class ActiveTransformation
    {
        public MazeTransformation transformation;
        public float startTime;
        public Coroutine coroutine;
    }
    
    [System.Serializable]
    public class PendingTransformation
    {
        public MazeTransformation transformation;
    }
    
    [System.Serializable]
    public class TransformationError
    {
        public string transformationId;
        public string errorMessage;
    }
    
    public enum ParticleEffectType
    {
        CrystallineFormation,
        StructuralReinforcement,
        HarmoniousGlow,
        WarmConnection
    }
    
    public enum AudioEffectType
    {
        CrystalChime,
        StoneFormation,
        HarmoniousTone,
        WarmResonance
    }
}