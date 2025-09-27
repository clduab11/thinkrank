using System;
using System.Collections.Generic;
using UnityEngine;
using System.Threading.Tasks;

namespace ThinkRank.Game
{
    /// <summary>
    /// Procedural maze generation system for Mind Maze
    /// Creates ethically-coherent maze structures that reflect moral complexity
    /// </summary>
    public class MazeGenerator : MonoBehaviour
    {
        [Header("Generation Parameters")]
        [SerializeField] private EthicalComplexityScaler complexityScaler;
        [SerializeField] private ArchitecturalStyleDatabase styleDatabase;
        [SerializeField] private EthicalScenarioMatcher scenarioMatcher;
        
        [Header("Maze Configuration")]
        [SerializeField] private Vector2Int baseMazeSize = new Vector2Int(10, 10);
        [SerializeField] private float cellSize = 2.0f;
        [SerializeField] private float wallHeight = 3.0f;
        [SerializeField] private int maxDecisionPoints = 5;
        
        [Header("Prefab References")]
        [SerializeField] private GameObject wallPrefab;
        [SerializeField] private GameObject floorPrefab;
        [SerializeField] private GameObject decisionPointPrefab;
        [SerializeField] private GameObject transformableWallPrefab;
        
        private Transform mazeContainer;
        private List<MazeCell> mazeGrid;
        private List<DecisionPoint> decisionPoints;
        
        public void Initialize()
        {
            // Create container for maze geometry
            GameObject container = new GameObject("MazeContainer");
            mazeContainer = container.transform;
            
            // Initialize systems
            if (complexityScaler == null)
                complexityScaler = gameObject.AddComponent<EthicalComplexityScaler>();
                
            if (styleDatabase == null)
                styleDatabase = gameObject.AddComponent<ArchitecturalStyleDatabase>();
                
            if (scenarioMatcher == null)
                scenarioMatcher = gameObject.AddComponent<EthicalScenarioMatcher>();
                
            Debug.Log("[MazeGenerator] Initialized successfully");
        }
        
        public async Task<MazeData> CreateMaze(int floorDepth, PlayerMoralProfile profile)
        {
            Debug.Log($"[MazeGenerator] Creating maze for floor {floorDepth}");
            
            try
            {
                // Calculate maze parameters based on floor depth and player profile
                var parameters = CalculateMazeParameters(floorDepth, profile);
                
                // Generate base maze structure
                var baseStructure = await GenerateBaseGeometry(parameters);
                
                // Place ethical decision points
                var decisionPointPlacement = await PlaceDecisionPoints(baseStructure, parameters);
                
                // Generate transformation rules for player choices
                var transformationSystem = CreateTransformationRules(decisionPointPlacement);
                
                // Apply architectural style based on ethical framework
                await ApplyArchitecturalStyle(baseStructure, parameters.preferredFramework);
                
                var mazeData = new MazeData
                {
                    geometry = baseStructure,
                    decisionPoints = decisionPointPlacement,
                    transformations = transformationSystem,
                    parameters = parameters
                };
                
                Debug.Log($"[MazeGenerator] Maze creation completed with {decisionPointPlacement.Count} decision points");
                return mazeData;
            }
            catch (Exception ex)
            {
                Debug.LogError($"[MazeGenerator] Failed to create maze: {ex.Message}");
                throw;
            }
        }
        
        private MazeGenerationParameters CalculateMazeParameters(int floorDepth, PlayerMoralProfile profile)
        {
            var parameters = new MazeGenerationParameters
            {
                floorDepth = floorDepth,
                mazeSize = CalculateMazeSize(floorDepth),
                complexity = complexityScaler.CalculateComplexity(floorDepth, profile),
                preferredFramework = DeterminePreferredFramework(profile),
                decisionPointCount = CalculateDecisionPointCount(floorDepth, profile),
                transformationIntensity = CalculateTransformationIntensity(profile)
            };
            
            return parameters;
        }
        
        private Vector2Int CalculateMazeSize(int floorDepth)
        {
            // Increase maze size with floor depth, but keep it manageable for mobile
            int sizeIncrease = Mathf.Min(floorDepth * 2, 10);
            return new Vector2Int(
                baseMazeSize.x + sizeIncrease,
                baseMazeSize.y + sizeIncrease
            );
        }
        
        private EthicalFramework DeterminePreferredFramework(PlayerMoralProfile profile)
        {
            // Determine which framework to emphasize based on player's current learning needs
            if (profile.masteredFrameworks.Count == 0)
                return EthicalFramework.Utilitarian; // Start with utilitarian
                
            // Rotate through frameworks to ensure balanced learning
            var unmasteredFrameworks = System.Enum.GetValues(typeof(EthicalFramework))
                .Cast<EthicalFramework>()
                .Where(f => !profile.masteredFrameworks.Contains(f))
                .ToList();
                
            return unmasteredFrameworks.Count > 0 ? unmasteredFrameworks[0] : EthicalFramework.Utilitarian;
        }
        
        private int CalculateDecisionPointCount(int floorDepth, PlayerMoralProfile profile)
        {
            // More decision points for advanced players and higher floors
            int baseCount = 3;
            int depthBonus = floorDepth / 2;
            int skillBonus = profile.masteredFrameworks.Count;
            
            return Mathf.Clamp(baseCount + depthBonus + skillBonus, 3, maxDecisionPoints);
        }
        
        private float CalculateTransformationIntensity(PlayerMoralProfile profile)
        {
            // Higher intensity transformations for more experienced players
            return Mathf.Clamp(0.5f + (profile.ethicalConsistency * 0.5f), 0.5f, 1.0f);
        }
        
        private async Task<MazeGeometry> GenerateBaseGeometry(MazeGenerationParameters parameters)
        {
            // Clear previous maze
            if (mazeContainer != null)
            {
                foreach (Transform child in mazeContainer)
                {
                    if (Application.isPlaying)
                        Destroy(child.gameObject);
                    else
                        DestroyImmediate(child.gameObject);
                }
            }
            
            // Generate maze grid using recursive backtracking algorithm
            mazeGrid = GenerateMazeGrid(parameters.mazeSize);
            
            // Create physical maze geometry
            var geometry = await CreateMazeGeometry(mazeGrid, parameters);
            
            return geometry;
        }
        
        private List<MazeCell> GenerateMazeGrid(Vector2Int size)
        {
            var grid = new List<MazeCell>();
            
            // Initialize grid with all walls
            for (int x = 0; x < size.x; x++)
            {
                for (int y = 0; y < size.y; y++)
                {
                    grid.Add(new MazeCell
                    {
                        position = new Vector2Int(x, y),
                        walls = new bool[] { true, true, true, true }, // Top, Right, Bottom, Left
                        visited = false,
                        isDecisionPoint = false
                    });
                }
            }
            
            // Generate maze paths using recursive backtracking
            GenerateMazePaths(grid, size, new Vector2Int(0, 0));
            
            return grid;
        }
        
        private void GenerateMazePaths(List<MazeCell> grid, Vector2Int size, Vector2Int startPos)
        {
            var stack = new Stack<Vector2Int>();
            var current = startPos;
            GetCell(grid, size, current).visited = true;
            
            while (true)
            {
                var neighbors = GetUnvisitedNeighbors(grid, size, current);
                
                if (neighbors.Count > 0)
                {
                    // Choose random neighbor
                    var next = neighbors[UnityEngine.Random.Range(0, neighbors.Count)];
                    stack.Push(current);
                    
                    // Remove wall between current and next
                    RemoveWall(grid, size, current, next);
                    current = next;
                    GetCell(grid, size, current).visited = true;
                }
                else if (stack.Count > 0)
                {
                    current = stack.Pop();
                }
                else
                {
                    break;
                }
            }
        }
        
        private MazeCell GetCell(List<MazeCell> grid, Vector2Int size, Vector2Int pos)
        {
            if (pos.x < 0 || pos.x >= size.x || pos.y < 0 || pos.y >= size.y)
                return null;
                
            return grid[pos.x * size.y + pos.y];
        }
        
        private List<Vector2Int> GetUnvisitedNeighbors(List<MazeCell> grid, Vector2Int size, Vector2Int pos)
        {
            var neighbors = new List<Vector2Int>();
            var directions = new Vector2Int[]
            {
                new Vector2Int(0, 1),  // Top
                new Vector2Int(1, 0),  // Right
                new Vector2Int(0, -1), // Bottom
                new Vector2Int(-1, 0)  // Left
            };
            
            foreach (var dir in directions)
            {
                var neighbor = pos + dir;
                var cell = GetCell(grid, size, neighbor);
                if (cell != null && !cell.visited)
                {
                    neighbors.Add(neighbor);
                }
            }
            
            return neighbors;
        }
        
        private void RemoveWall(List<MazeCell> grid, Vector2Int size, Vector2Int current, Vector2Int next)
        {
            var currentCell = GetCell(grid, size, current);
            var nextCell = GetCell(grid, size, next);
            
            var diff = next - current;
            
            if (diff == Vector2Int.up) // Moving up
            {
                currentCell.walls[0] = false; // Remove top wall of current
                nextCell.walls[2] = false;    // Remove bottom wall of next
            }
            else if (diff == Vector2Int.right) // Moving right
            {
                currentCell.walls[1] = false; // Remove right wall of current
                nextCell.walls[3] = false;    // Remove left wall of next
            }
            else if (diff == Vector2Int.down) // Moving down
            {
                currentCell.walls[2] = false; // Remove bottom wall of current
                nextCell.walls[0] = false;    // Remove top wall of next
            }
            else if (diff == Vector2Int.left) // Moving left
            {
                currentCell.walls[3] = false; // Remove left wall of current
                nextCell.walls[1] = false;    // Remove right wall of next
            }
        }
        
        private async Task<MazeGeometry> CreateMazeGeometry(List<MazeCell> grid, MazeGenerationParameters parameters)
        {
            var geometry = new MazeGeometry
            {
                walls = new List<GameObject>(),
                floors = new List<GameObject>(),
                transformableElements = new List<GameObject>()
            };
            
            // Create floor
            for (int x = 0; x < parameters.mazeSize.x; x++)
            {
                for (int y = 0; y < parameters.mazeSize.y; y++)
                {
                    Vector3 floorPos = new Vector3(x * cellSize, 0, y * cellSize);
                    GameObject floor = Instantiate(floorPrefab, floorPos, Quaternion.identity, mazeContainer);
                    geometry.floors.Add(floor);
                }
            }
            
            // Create walls
            foreach (var cell in grid)
            {
                Vector3 cellWorldPos = new Vector3(cell.position.x * cellSize, 0, cell.position.y * cellSize);
                
                // Check each wall direction
                for (int i = 0; i < 4; i++)
                {
                    if (cell.walls[i])
                    {
                        Vector3 wallPos = CalculateWallPosition(cellWorldPos, i);
                        Quaternion wallRot = CalculateWallRotation(i);
                        
                        GameObject wallPrefabToUse = ShouldUseTransformableWall(cell, i) ? 
                            transformableWallPrefab : wallPrefab;
                            
                        GameObject wall = Instantiate(wallPrefabToUse, wallPos, wallRot, mazeContainer);
                        
                        if (wallPrefabToUse == transformableWallPrefab)
                        {
                            geometry.transformableElements.Add(wall);
                        }
                        else
                        {
                            geometry.walls.Add(wall);
                        }
                    }
                }
            }
            
            return geometry;
        }
        
        private Vector3 CalculateWallPosition(Vector3 cellPos, int wallDirection)
        {
            Vector3 offset = Vector3.zero;
            
            switch (wallDirection)
            {
                case 0: // Top
                    offset = new Vector3(0, wallHeight / 2, cellSize / 2);
                    break;
                case 1: // Right
                    offset = new Vector3(cellSize / 2, wallHeight / 2, 0);
                    break;
                case 2: // Bottom
                    offset = new Vector3(0, wallHeight / 2, -cellSize / 2);
                    break;
                case 3: // Left
                    offset = new Vector3(-cellSize / 2, wallHeight / 2, 0);
                    break;
            }
            
            return cellPos + offset;
        }
        
        private Quaternion CalculateWallRotation(int wallDirection)
        {
            switch (wallDirection)
            {
                case 0: case 2: // Top or Bottom
                    return Quaternion.Euler(0, 0, 0);
                case 1: case 3: // Right or Left
                    return Quaternion.Euler(0, 90, 0);
                default:
                    return Quaternion.identity;
            }
        }
        
        private bool ShouldUseTransformableWall(MazeCell cell, int wallDirection)
        {
            // Some walls should be transformable for ethical choice consequences
            return UnityEngine.Random.value < 0.3f; // 30% of walls are transformable
        }
        
        private async Task<List<DecisionPoint>> PlaceDecisionPoints(MazeGeometry geometry, MazeGenerationParameters parameters)
        {
            var points = new List<DecisionPoint>();
            
            // Find suitable locations for decision points (dead ends, intersections, etc.)
            var candidatePositions = FindDecisionPointCandidates(mazeGrid, parameters.mazeSize);
            
            // Select the best positions
            for (int i = 0; i < Mathf.Min(parameters.decisionPointCount, candidatePositions.Count); i++)
            {
                var position = candidatePositions[i];
                var worldPos = new Vector3(position.x * cellSize, 1f, position.y * cellSize);
                
                GameObject decisionPointObj = Instantiate(decisionPointPrefab, worldPos, Quaternion.identity, mazeContainer);
                
                var decisionPoint = new DecisionPoint
                {
                    id = $"decision_point_{i}",
                    position = worldPos,
                    gameObject = decisionPointObj,
                    requiredFramework = (EthicalFramework)(i % 4), // Rotate through frameworks
                    isCompleted = false
                };
                
                points.Add(decisionPoint);
                
                // Mark corresponding maze cell
                var cell = GetCell(mazeGrid, parameters.mazeSize, position);
                if (cell != null)
                {
                    cell.isDecisionPoint = true;
                }
            }
            
            return points;
        }
        
        private List<Vector2Int> FindDecisionPointCandidates(List<MazeCell> grid, Vector2Int size)
        {
            var candidates = new List<Vector2Int>();
            
            foreach (var cell in grid)
            {
                // Count open directions
                int openDirections = 0;
                for (int i = 0; i < 4; i++)
                {
                    if (!cell.walls[i])
                        openDirections++;
                }
                
                // Good candidates are intersections (3+ openings) or interesting dead ends
                if (openDirections >= 3 || (openDirections == 1 && UnityEngine.Random.value < 0.3f))
                {
                    candidates.Add(cell.position);
                }
            }
            
            // Shuffle to ensure variety
            for (int i = 0; i < candidates.Count; i++)
            {
                var temp = candidates[i];
                int randomIndex = UnityEngine.Random.Range(i, candidates.Count);
                candidates[i] = candidates[randomIndex];
                candidates[randomIndex] = temp;
            }
            
            return candidates;
        }
        
        private MazeTransformationRules CreateTransformationRules(List<DecisionPoint> decisionPoints)
        {
            var rules = new MazeTransformationRules
            {
                decisionPointRules = new Dictionary<string, List<TransformationRule>>()
            };
            
            foreach (var point in decisionPoints)
            {
                var pointRules = new List<TransformationRule>
                {
                    // Utilitarian transformation: Create efficient paths
                    new TransformationRule
                    {
                        framework = EthicalFramework.Utilitarian,
                        transformationType = TransformationType.CreatePath,
                        intensity = 1.0f,
                        targetArea = point.position,
                        radius = cellSize * 2
                    },
                    
                    // Deontological transformation: Reinforce structure
                    new TransformationRule
                    {
                        framework = EthicalFramework.Deontological,
                        transformationType = TransformationType.CreateBarrier,
                        intensity = 0.8f,
                        targetArea = point.position,
                        radius = cellSize * 1.5f
                    },
                    
                    // Virtue ethics transformation: Create beautiful elements
                    new TransformationRule
                    {
                        framework = EthicalFramework.VirtueEthics,
                        transformationType = TransformationType.EnhanceAesthetics,
                        intensity = 1.2f,
                        targetArea = point.position,
                        radius = cellSize * 3
                    }
                };
                
                rules.decisionPointRules[point.id] = pointRules;
            }
            
            return rules;
        }
        
        private async Task ApplyArchitecturalStyle(MazeGeometry geometry, EthicalFramework framework)
        {
            if (styleDatabase != null)
            {
                await styleDatabase.ApplyFrameworkStyle(geometry, framework);
            }
        }
    }
    
    // Supporting data structures
    [System.Serializable]
    public class MazeData
    {
        public MazeGeometry geometry;
        public List<DecisionPoint> decisionPoints;
        public MazeTransformationRules transformations;
        public MazeGenerationParameters parameters;
    }
    
    [System.Serializable]
    public class MazeGeometry
    {
        public List<GameObject> walls;
        public List<GameObject> floors;
        public List<GameObject> transformableElements;
        
        public Vector3 GetDecisionPointPosition(int index)
        {
            // Return position for decision point placement
            if (index < transformableElements.Count)
            {
                return transformableElements[index].transform.position + Vector3.up;
            }
            return Vector3.zero;
        }
    }
    
    [System.Serializable]
    public class MazeCell
    {
        public Vector2Int position;
        public bool[] walls; // Top, Right, Bottom, Left
        public bool visited;
        public bool isDecisionPoint;
    }
    
    [System.Serializable]
    public class DecisionPoint
    {
        public string id;
        public Vector3 position;
        public GameObject gameObject;
        public AlignmentScenario ethicalScenario;
        public EthicalFramework requiredFramework;
        public bool isCompleted;
    }
    
    [System.Serializable]
    public class MazeGenerationParameters
    {
        public int floorDepth;
        public Vector2Int mazeSize;
        public float complexity;
        public EthicalFramework preferredFramework;
        public int decisionPointCount;
        public float transformationIntensity;
    }
    
    [System.Serializable]
    public class MazeTransformationRules
    {
        public Dictionary<string, List<TransformationRule>> decisionPointRules;
    }
    
    [System.Serializable]
    public class TransformationRule
    {
        public EthicalFramework framework;
        public TransformationType transformationType;
        public float intensity;
        public Vector3 targetArea;
        public float radius;
    }
    
    public enum TransformationType
    {
        CreatePath,
        CreateBarrier,
        RemoveWall,
        AddWall,
        EnhanceAesthetics,
        ChangeElevation
    }
}