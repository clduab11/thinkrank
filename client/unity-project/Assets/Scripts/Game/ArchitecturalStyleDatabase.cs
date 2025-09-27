using System.Threading.Tasks;
using UnityEngine;

namespace ThinkRank.Game
{
    /// <summary>
    /// Database of architectural styles for different ethical frameworks
    /// Applies visual themes that reflect moral philosophy concepts
    /// </summary>
    public class ArchitecturalStyleDatabase : MonoBehaviour
    {
        [Header("Framework Materials")]
        [SerializeField] private Material utilitarianMaterial;
        [SerializeField] private Material deontologicalMaterial;
        [SerializeField] private Material virtueEthicsMaterial;
        [SerializeField] private Material careEthicsMaterial;
        
        [Header("Framework Colors")]
        [SerializeField] private Color utilitarianColor = new Color(0.7f, 0.9f, 1.0f, 1.0f); // Cool, efficient blue
        [SerializeField] private Color deontologicalColor = new Color(0.9f, 0.9f, 0.7f, 1.0f); // Formal, structured beige
        [SerializeField] private Color virtueEthicsColor = new Color(1.0f, 0.8f, 0.6f, 1.0f); // Warm, harmonious gold
        [SerializeField] private Color careEthicsColor = new Color(0.8f, 1.0f, 0.8f, 1.0f); // Nurturing, caring green
        
        public async Task ApplyFrameworkStyle(MazeGeometry geometry, EthicalFramework framework)
        {
            if (geometry == null) return;
            
            var targetMaterial = GetMaterialForFramework(framework);
            var targetColor = GetColorForFramework(framework);
            
            // Apply to walls
            if (geometry.walls != null)
            {
                foreach (var wall in geometry.walls)
                {
                    ApplyStyleToObject(wall, targetMaterial, targetColor);
                }
            }
            
            // Apply to transformable elements
            if (geometry.transformableElements != null)
            {
                foreach (var element in geometry.transformableElements)
                {
                    ApplyStyleToObject(element, targetMaterial, targetColor);
                }
            }
            
            await Task.Delay(1); // Simulate async operation
        }
        
        public Material GetMaterialForFramework(EthicalFramework framework)
        {
            switch (framework)
            {
                case EthicalFramework.Utilitarian:
                    return utilitarianMaterial;
                case EthicalFramework.Deontological:
                    return deontologicalMaterial;
                case EthicalFramework.VirtueEthics:
                    return virtueEthicsMaterial;
                case EthicalFramework.CareEthics:
                    return careEthicsMaterial;
                default:
                    return utilitarianMaterial;
            }
        }
        
        public Color GetColorForFramework(EthicalFramework framework)
        {
            switch (framework)
            {
                case EthicalFramework.Utilitarian:
                    return utilitarianColor;
                case EthicalFramework.Deontological:
                    return deontologicalColor;
                case EthicalFramework.VirtueEthics:
                    return virtueEthicsColor;
                case EthicalFramework.CareEthics:
                    return careEthicsColor;
                default:
                    return utilitarianColor;
            }
        }
        
        private void ApplyStyleToObject(GameObject obj, Material material, Color color)
        {
            if (obj == null) return;
            
            var renderer = obj.GetComponent<Renderer>();
            if (renderer != null)
            {
                if (material != null)
                {
                    renderer.material = material;
                }
                
                // Apply color tint
                if (renderer.material != null)
                {
                    renderer.material.color = color;
                }
            }
        }
    }
}