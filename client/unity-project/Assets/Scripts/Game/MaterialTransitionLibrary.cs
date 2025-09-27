using UnityEngine;

namespace ThinkRank.Game
{
    /// <summary>
    /// Library of materials and transition effects for ethical framework visualization
    /// </summary>
    public class MaterialTransitionLibrary : MonoBehaviour
    {
        [Header("Framework Materials")]
        [SerializeField] private Material[] utilitarianMaterials;
        [SerializeField] private Material[] deontologicalMaterials;
        [SerializeField] private Material[] virtueEthicsMaterials;
        [SerializeField] private Material[] careEthicsMaterials;
        
        public Material GetFrameworkMaterial(EthicalFramework framework)
        {
            Material[] materials = GetMaterialsForFramework(framework);
            if (materials != null && materials.Length > 0)
            {
                return materials[0]; // Return primary material
            }
            return null;
        }
        
        public void PrepareMaterials(Renderer renderer)
        {
            // Pre-cache materials for performance
            if (renderer != null && renderer.material != null)
            {
                // Store original material reference
                // This is a placeholder for material preparation logic
            }
        }
        
        private Material[] GetMaterialsForFramework(EthicalFramework framework)
        {
            switch (framework)
            {
                case EthicalFramework.Utilitarian:
                    return utilitarianMaterials;
                case EthicalFramework.Deontological:
                    return deontologicalMaterials;
                case EthicalFramework.VirtueEthics:
                    return virtueEthicsMaterials;
                case EthicalFramework.CareEthics:
                    return careEthicsMaterials;
                default:
                    return utilitarianMaterials;
            }
        }
    }
}