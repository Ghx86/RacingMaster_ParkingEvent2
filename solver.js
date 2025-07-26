// Global state
let targetGrid = [];
let pieces = [];
let selectedPieceIndex = -1;
let currentPieceGrid = [];
const gridWidth = 9;
const gridHeight = 7;
const pieceEditorSize = 8;
let solution = null;
let solutionCount = 0;
let currentPieceColor = 0;

// Special cell positions (0-indexed) - [x,y] format where x=column, y=row
const specialCells = [[0,0], [8,0], [6,1], [3,2], [5,2], [2,5]];

// Colors for pieces
const pieceColors = [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', 
    '#1abc9c', '#e67e22', '#34495e', '#e91e63', '#00bcd4',
    '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7'
];

// Initialize the application
function init() {
    initTargetGrid();
    initPieceEditor();
    updatePieceList();
}

// Initialize target grid (9x7, all filled, with special cells)
function initTargetGrid() {
    targetGrid = Array(gridHeight).fill().map(() => Array(gridWidth).fill(true));
    renderTargetGrid();
}

function renderTargetGrid() {
    const gridElement = document.getElementById('targetGrid');
    gridElement.innerHTML = '';

    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            
            // Check if this is a special cell
            const isSpecial = specialCells.some(([sx, sy]) => sx === x && sy === y);
            if (isSpecial) {
                cell.classList.add('special');
            }
            
            gridElement.appendChild(cell);
        }
    }
}

// Piece editor functions
function initPieceEditor() {
    currentPieceGrid = Array(pieceEditorSize).fill().map(() => Array(pieceEditorSize).fill(false));
    renderPieceEditor();
}

function renderPieceEditor() {
    const gridElement = document.getElementById('pieceGrid');
    gridElement.innerHTML = '';

    const color = pieceColors[currentPieceColor % pieceColors.length];
    
    for (let y = 0; y < pieceEditorSize; y++) {
        for (let x = 0; x < pieceEditorSize; x++) {
            const cell = document.createElement('div');
            cell.className = 'piece-cell';
            if (currentPieceGrid[y][x]) {
                cell.classList.add('active');
                cell.style.setProperty('--piece-color', color);
            }
            cell.onclick = () => togglePieceCell(x, y);
            gridElement.appendChild(cell);
        }
    }
}

function togglePieceCell(x, y) {
    currentPieceGrid[y][x] = !currentPieceGrid[y][x];
    renderPieceEditor();
}

function clearPieceEditor() {
    currentPieceGrid = Array(pieceEditorSize).fill().map(() => Array(pieceEditorSize).fill(false));
    renderPieceEditor();
}

function addCurrentPiece() {
    const pieceData = extractPieceFromGrid(currentPieceGrid);
    if (pieceData.length === 0) {
        showStatus('Please design a piece first!', 'error');
        return;
    }

    const color = pieceColors[currentPieceColor % pieceColors.length];
    
    // Check if this shape already exists
    const existingPieceIndex = pieces.findIndex(p => 
        JSON.stringify(normalizePiece(p.shape)) === JSON.stringify(normalizePiece(pieceData))
    );

    if (existingPieceIndex >= 0) {
        showStatus('This piece shape already exists!', 'error');
        return;
    }

    pieces.push({
        shape: pieceData,
        color: color,
        id: Date.now(),
        count: 1,
        label: 'A',
        bTarget: null // For B label constraint
    });
    
    currentPieceColor++;
    updatePieceList();
    clearPieceEditor();
    clearSolution();
}

function extractPieceFromGrid(grid) {
    const cells = [];
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            if (grid[y][x]) {
                cells.push([x, y]);
            }
        }
    }
    
    if (cells.length === 0) return [];
    
    // Normalize to start from (0,0)
    const minX = Math.min(...cells.map(c => c[0]));
    const minY = Math.min(...cells.map(c => c[1]));
    
    return cells.map(([x, y]) => [x - minX, y - minY]);
}

function normalizePiece(shape) {
    if (shape.length === 0) return shape;
    
    const minX = Math.min(...shape.map(c => c[0]));
    const minY = Math.min(...shape.map(c => c[1]));
    
    return shape.map(([x, y]) => [x - minX, y - minY]);
}

// Piece list management
function updatePieceList() {
    const listElement = document.getElementById('pieceList');
    listElement.innerHTML = '';

    pieces.forEach((piece, index) => {
        const item = createPieceItem(piece, index);
        listElement.appendChild(item);
    });
}

function createPieceItem(piece, index) {
    const container = document.createElement('div');
    container.className = 'piece-item';
    if (index === selectedPieceIndex) {
        container.classList.add('selected');
    }
    
    // Piece header
    const header = document.createElement('div');
    header.className = 'piece-header';
    header.innerHTML = `<strong>Piece ${index + 1}</strong>`;
    container.appendChild(header);

    // Piece preview
    const preview = createPiecePreview(piece);
    container.appendChild(preview);

    // Piece controls
    const controls = document.createElement('div');
    controls.className = 'piece-controls';

    // Count control
    const countControl = document.createElement('div');
    countControl.className = 'piece-count-control';
    countControl.innerHTML = `
        <label>Count:</label>
        <input type="number" class="piece-count-input" value="${piece.count}" min="1" max="10" 
               onchange="updatePieceCount(${index}, this.value)">
    `;
    controls.appendChild(countControl);

    // Label selector
    const labelSelector = document.createElement('div');
    labelSelector.className = 'label-selector';
    labelSelector.innerHTML = `
        <button class="label-btn ${piece.label === 'A' ? 'active' : ''}" 
                onclick="setPieceLabel(${index}, 'A')">A</button>
        <button class="label-btn ${piece.label === 'B' ? 'active' : ''}" 
                onclick="setPieceLabel(${index}, 'B')">B</button>
        <button class="label-btn ${piece.label === 'C' ? 'active' : ''}" 
                onclick="setPieceLabel(${index}, 'C')">C</button>
    `;
    controls.appendChild(labelSelector);

    container.appendChild(controls);

    // B label specific controls
    if (piece.label === 'B') {
        const bSelector = document.createElement('div');
        bSelector.className = 'b-label-selector';
        bSelector.innerHTML = `
            <label>Must touch piece type:</label>
            <select onchange="setPieceBTarget(${index}, this.value)">
                <option value="">Select target piece...</option>
                ${pieces.map((p, i) => 
                    i !== index ? `<option value="${i}" ${piece.bTarget == i ? 'selected' : ''}>Piece ${i + 1}</option>` : ''
                ).join('')}
            </select>
        `;
        container.appendChild(bSelector);
    }

    container.onclick = (e) => {
        if (e.target.type !== 'number' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'SELECT') {
            selectedPieceIndex = selectedPieceIndex === index ? -1 : index;
            updatePieceList();
        }
    };

    return container;
}

function createPiecePreview(piece) {
    const container = document.createElement('div');
    container.className = 'piece-preview';

    const maxX = Math.max(...piece.shape.map(c => c[0])) + 1;
    const maxY = Math.max(...piece.shape.map(c => c[1])) + 1;

    container.style.gridTemplateColumns = `repeat(${maxX}, 15px)`;

    for (let y = 0; y < maxY; y++) {
        for (let x = 0; x < maxX; x++) {
            const cell = document.createElement('div');
            cell.className = 'piece-preview-cell';
            
            if (piece.shape.some(([px, py]) => px === x && py === y)) {
                cell.classList.add('active');
                cell.style.setProperty('--piece-color', piece.color);
            }
            
            container.appendChild(cell);
        }
    }

    return container;
}

function updatePieceCount(index, count) {
    pieces[index].count = parseInt(count);
    clearSolution();
}

function setPieceLabel(index, label) {
    pieces[index].label = label;
    if (label !== 'B') {
        pieces[index].bTarget = null;
    }
    updatePieceList();
    clearSolution();
}

function setPieceBTarget(index, targetIndex) {
    pieces[index].bTarget = targetIndex === '' ? null : parseInt(targetIndex);
    clearSolution();
}

function removeSelectedPiece() {
    if (selectedPieceIndex >= 0) {
        pieces.splice(selectedPieceIndex, 1);
        selectedPieceIndex = -1;
        updatePieceList();
        clearSolution();
    }
}

function clearAllPieces() {
    pieces = [];
    selectedPieceIndex = -1;
    currentPieceColor = 0;
    updatePieceList();
    clearSolution();
}

// Transformation functions
function rotatePiece(shape) {
    return shape.map(([x, y]) => [-y, x]);
}

function reflectPiece(shape) {
    return shape.map(([x, y]) => [-x, y]);
}

function generatePieceVariants(shape) {
    const variants = new Set();
    const allowRotations = document.getElementById('allowRotations').checked;
    const allowReflections = document.getElementById('allowReflections').checked;

    let currentShape = shape;
    
    // Add original and rotations
    for (let i = 0; i < (allowRotations ? 4 : 1); i++) {
        const normalized = normalizePiece(currentShape);
        variants.add(JSON.stringify(normalized));
        
        if (allowReflections) {
            const reflected = normalizePiece(reflectPiece(normalized));
            variants.add(JSON.stringify(reflected));
        }
        
        if (allowRotations) {
            currentShape = rotatePiece(currentShape);
        }
    }

    return Array.from(variants).map(v => JSON.parse(v));
}

// Constraint checking functions
function isPieceAdjacent(grid, pieceId1, pieceId2) {
    const positions1 = [];
    const positions2 = [];
    
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            if (grid[y][x] === pieceId1) positions1.push([x, y]);
            if (grid[y][x] === pieceId2) positions2.push([x, y]);
        }
    }
    
    for (const [x1, y1] of positions1) {
        for (const [x2, y2] of positions2) {
            const dx = Math.abs(x1 - x2);
            const dy = Math.abs(y1 - y2);
            if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
                return true;
            }
        }
    }
    
    return false;
}

function pieceContainsSpecialCell(placement, startX, startY) {
    for (const [dx, dy] of placement) {
        const x = startX + dx;
        const y = startY + dy;
        if (specialCells.some(([sx, sy]) => sx === x && sy === y)) {
            return true;
        }
    }
    return false;
}

function canPlacePiece(grid, piece, startX, startY) {
    for (const [dx, dy] of piece) {
        const x = startX + dx;
        const y = startY + dy;
        
        if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) {
            return false;
        }
        
        if (!targetGrid[y][x] || grid[y][x] !== null) {
            return false;
        }
    }
    return true;
}

function placePiece(grid, piece, startX, startY, pieceId) {
    const newGrid = grid.map(row => [...row]);
    for (const [dx, dy] of piece) {
        const x = startX + dx;
        const y = startY + dy;
        newGrid[y][x] = pieceId;
    }
    return newGrid;
}

// Exhaustive search solver
function solveExhaustive() {
    const solutions = [];
    const maxSolutions = 100; // Limit for performance
    
    // Generate all piece instances with their constraints
    const pieceInstances = [];
    let instanceId = 0;
    
    pieces.forEach((piece, pieceIndex) => {
        const variants = generatePieceVariants(piece.shape);
        
        for (let i = 0; i < piece.count; i++) {
            pieceInstances.push({
                id: instanceId++,
                pieceIndex: pieceIndex,
                instanceNumber: i,
                variants: variants,
                label: piece.label,
                bTarget: piece.bTarget,
                color: piece.color
            });
        }
    });

    function validateSolution(grid, assignments) {
        // Track which special cells are used by C-labeled pieces
        const specialCellsUsed = new Map(); // specialCellKey -> pieceIndex
        
        for (const assignment of assignments) {
            const instance = pieceInstances[assignment.instanceIndex];
            
            // Check B constraint: must be adjacent to target piece type
            if (instance.label === 'B' && instance.bTarget !== null) {
                let foundAdjacent = false;
                
                for (const otherAssignment of assignments) {
                    const otherInstance = pieceInstances[otherAssignment.instanceIndex];
                    if (otherInstance.pieceIndex === instance.bTarget) {
                        if (isPieceAdjacent(grid, assignment.instanceIndex, otherAssignment.instanceIndex)) {
                            foundAdjacent = true;
                            break;
                        }
                    }
                }
                
                if (!foundAdjacent) {
                    return false;
                }
            }
            
            // Check C constraint: must contain special cell, no sharing within same piece type
            if (instance.label === 'C') {
                let foundSpecialCell = false;
                
                for (const [dx, dy] of assignment.variant) {
                    const x = assignment.x + dx;
                    const y = assignment.y + dy;
                    const specialKey = `${x},${y}`;
                    
                    if (specialCells.some(([sx, sy]) => sx === x && sy === y)) {
                        // Check if this special cell is already used by same piece type
                        if (specialCellsUsed.has(specialKey) && 
                            specialCellsUsed.get(specialKey) === instance.pieceIndex) {
                            return false; // Same piece type using same special cell
                        }
                        
                        specialCellsUsed.set(specialKey, instance.pieceIndex);
                        foundSpecialCell = true;
                    }
                }
                
                if (!foundSpecialCell) {
                    return false;
                }
            }
        }
        
        return true;
    }

    function exhaustiveSearch(grid, assignments, instanceIndex) {
        if (instanceIndex >= pieceInstances.length) {
            if (validateSolution(grid, assignments)) {
                solutions.push({
                    grid: grid.map(row => [...row]),
                    assignments: [...assignments]
                });
                return solutions.length < maxSolutions;
            }
            return true;
        }
        
        if (solutions.length >= maxSolutions) {
            return false;
        }

        const instance = pieceInstances[instanceIndex];
        
        for (const variant of instance.variants) {
            for (let y = 0; y < gridHeight; y++) {
                for (let x = 0; x < gridWidth; x++) {
                    if (canPlacePiece(grid, variant, x, y)) {
                        const newGrid = placePiece(grid, variant, x, y, instanceIndex);
                        const newAssignments = [...assignments, {
                            instanceIndex: instanceIndex,
                            variant: variant,
                            x: x,
                            y: y
                        }];
                        
                        if (!exhaustiveSearch(newGrid, newAssignments, instanceIndex + 1)) {
                            return false;
                        }
                    }
                }
            }
        }
        
        return true;
    }

    const grid = Array(gridHeight).fill().map(() => Array(gridWidth).fill(null));
    exhaustiveSearch(grid, [], 0);
    
    return solutions;
}

// Backtracking solver with constraint checking
function solveBacktracking() {
    let solutionFound = null;
    
    // Generate all piece instances
    const pieceInstances = [];
    let instanceId = 0;
    
    pieces.forEach((piece, pieceIndex) => {
        const variants = generatePieceVariants(piece.shape);
        
        for (let i = 0; i < piece.count; i++) {
            pieceInstances.push({
                id: instanceId++,
                pieceIndex: pieceIndex,
                instanceNumber: i,
                variants: variants,
                label: piece.label,
                bTarget: piece.bTarget,
                color: piece.color
            });
        }
    });

    function isValidPlacement(grid, assignments, newAssignment) {
        const instance = pieceInstances[newAssignment.instanceIndex];
        
        // Early constraint checking for C labels
        if (instance.label === 'C') {
            if (!pieceContainsSpecialCell(newAssignment.variant, newAssignment.x, newAssignment.y)) {
                return false;
            }
        }
        
        return true;
    }

    function validateCurrentState(grid, assignments) {
        // Quick validation during search
        const specialCellsUsed = new Map();
        
        for (const assignment of assignments) {
            const instance = pieceInstances[assignment.instanceIndex];
            
            if (instance.label === 'C') {
                for (const [dx, dy] of assignment.variant) {
                    const x = assignment.x + dx;
                    const y = assignment.y + dy;
                    const specialKey = `${x},${y}`;
                    
                    if (specialCells.some(([sx, sy]) => sx === x && sy === y)) {
                        if (specialCellsUsed.has(specialKey) && 
                            specialCellsUsed.get(specialKey) === instance.pieceIndex) {
                            return false;
                        }
                        specialCellsUsed.set(specialKey, instance.pieceIndex);
                    }
                }
            }
        }
        
        return true;
    }

    function backtrack(grid, assignments, instanceIndex) {
        if (instanceIndex >= pieceInstances.length) {
            // Final validation
            if (validateFinalSolution(grid, assignments)) {
                solutionFound = {
                    grid: grid.map(row => [...row]),
                    assignments: [...assignments]
                };
                return true;
            }
            return false;
        }

        const instance = pieceInstances[instanceIndex];
        
        for (const variant of instance.variants) {
            for (let y = 0; y < gridHeight; y++) {
                for (let x = 0; x < gridWidth; x++) {
                    if (canPlacePiece(grid, variant, x, y)) {
                        const newAssignment = {
                            instanceIndex: instanceIndex,
                            variant: variant,
                            x: x,
                            y: y
                        };
                        
                        if (isValidPlacement(grid, assignments, newAssignment)) {
                            const newGrid = placePiece(grid, variant, x, y, instanceIndex);
                            const newAssignments = [...assignments, newAssignment];
                            
                            if (validateCurrentState(newGrid, newAssignments)) {
                                if (backtrack(newGrid, newAssignments, instanceIndex + 1)) {
                                    return true;
                                }
                            }
                        }
                    }
                }
            }
        }
        
        return false;
    }

    function validateFinalSolution(grid, assignments) {
        const specialCellsUsed = new Map();
        
        for (const assignment of assignments) {
            const instance = pieceInstances[assignment.instanceIndex];
            
            // Check B constraint
            if (instance.label === 'B' && instance.bTarget !== null) {
                let foundAdjacent = false;
                
                for (const otherAssignment of assignments) {
                    const otherInstance = pieceInstances[otherAssignment.instanceIndex];
                    if (otherInstance.pieceIndex === instance.bTarget) {
                        if (isPieceAdjacent(grid, assignment.instanceIndex, otherAssignment.instanceIndex)) {
                            foundAdjacent = true;
                            break;
                        }
                    }
                }
                
                if (!foundAdjacent) {
                    return false;
                }
            }
            
            // Check C constraint
            if (instance.label === 'C') {
                let foundSpecialCell = false;
                
                for (const [dx, dy] of assignment.variant) {
                    const x = assignment.x + dx;
                    const y = assignment.y + dy;
                    const specialKey = `${x},${y}`;
                    
                    if (specialCells.some(([sx, sy]) => sx === x && sy === y)) {
                        if (specialCellsUsed.has(specialKey) && 
                            specialCellsUsed.get(specialKey) === instance.pieceIndex) {
                            return false;
                        }
                        
                        specialCellsUsed.set(specialKey, instance.pieceIndex);
                        foundSpecialCell = true;
                    }
                }
                
                if (!foundSpecialCell) {
                    return false;
                }
            }
        }
        
        return true;
    }

    const grid = Array(gridHeight).fill().map(() => Array(gridWidth).fill(null));
    backtrack(grid, [], 0);
    
    return solutionFound ? [solutionFound] : [];
}

// Constraint satisfaction solver
function solveConstraintSatisfaction() {
    // This would use more advanced CSP techniques
    // For now, fall back to backtracking
    return solveBacktracking();
}

// Main solve function
async function solvePuzzle() {
    if (pieces.length === 0) {
        showStatus('Please add some pieces first!', 'error');
        return;
    }

    // Validate B label constraints
    for (const piece of pieces) {
        if (piece.label === 'B' && piece.bTarget === null) {
            showStatus('B-labeled pieces must have a target piece selected!', 'error');
            return;
        }
    }

    const solveButton = document.getElementById('solveText');
    const originalText = solveButton.textContent;
    solveButton.innerHTML = '<span class="loading-spinner"></span> Solving...';
    
    showStatus('Solving puzzle with constraints...', 'solving');
    
    // Small delay to allow UI update
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
        const algorithm = document.getElementById('algorithmSelect').value;
        let results;

        const startTime = performance.now();
        
        switch (algorithm) {
            case 'exhaustive':
                results = solveExhaustive();
                break;
            case 'backtracking':
                results = solveBacktracking();
                break;
            case 'constraint':
                results = solveConstraintSatisfaction();
                break;
            default:
                results = solveExhaustive();
        }

        const endTime = performance.now();
        const solveTime = ((endTime - startTime) / 1000).toFixed(2);

        solutionCount = results.length;
        document.getElementById('solutionCount').textContent = solutionCount;
        
        if (solutionCount > 0) {
            solution = results[0]; // Display first solution
            displaySolution(results[0]);
            showStatus(`Found ${solutionCount} solution${solutionCount > 1 ? 's' : ''} in ${solveTime}s`, 'success');
            
            document.getElementById('solutionDetails').innerHTML = `
                <div>Search time: ${solveTime} seconds</div>
                <div>Algorithm: ${algorithm}</div>
                ${solutionCount > 1 ? '<div>Showing first solution</div>' : ''}
            `;
        } else {
            showStatus(`No solution exists. Search completed in ${solveTime}s`, 'error');
            document.getElementById('solutionDetails').innerHTML = `
                <div>Search time: ${solveTime} seconds</div>
                <div>Algorithm: ${algorithm}</div>
            `;
        }
    } catch (error) {
        console.error('Solving error:', error);
        showStatus('An error occurred while solving.', 'error');
    } finally {
        solveButton.textContent = originalText;
    }
}

function displaySolution(solutionData) {
    const gridElement = document.getElementById('targetGrid');
    const cells = gridElement.children;
    
    let cellIndex = 0;
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            const cell = cells[cellIndex];
            const instanceId = solutionData.grid[y][x];
            
            if (instanceId !== null) {
                const assignment = solutionData.assignments.find(a => a.instanceIndex === instanceId);
                if (assignment) {
                    const instance = pieces.find((p, i) => {
                        let count = 0;
                        pieces.forEach((piece, idx) => {
                            if (idx < i) count += piece.count;
                            else if (idx === i) {
                                // Find which instance this is
                                for (let j = 0; j < piece.count; j++) {
                                    if (count === instanceId) return true;
                                    count++;
                                }
                            }
                        });
                        return false;
                    });
                    
                    // Find the actual piece for coloring
                    let pieceForColor = null;
                    let runningCount = 0;
                    for (const piece of pieces) {
                        if (instanceId >= runningCount && instanceId < runningCount + piece.count) {
                            pieceForColor = piece;
                            break;
                        }
                        runningCount += piece.count;
                    }
                    
                    if (pieceForColor) {
                        cell.classList.add('solution');
                        cell.style.backgroundColor = pieceForColor.color;
                        cell.style.opacity = '0.9';
                        
                        // Add instance number
                        const instanceNum = instanceId - runningCount + (runningCount > instanceId ? 0 : runningCount);
                        const pieceIndex = pieces.findIndex(p => p === pieceForColor) + 1;
                        cell.textContent = `${pieceIndex}`;
                        cell.style.color = 'white';
                        cell.style.fontSize = '12px';
                        cell.style.fontWeight = 'bold';
                    }
                }
            }
            cellIndex++;
        }
    }
}

function clearSolution() {
    solution = null;
    solutionCount = 0;
    document.getElementById('solutionCount').textContent = '0';
    document.getElementById('solutionDetails').innerHTML = '';
    
    const gridElement = document.getElementById('targetGrid');
    const cells = gridElement.children;
    
    for (const cell of cells) {
        cell.classList.remove('solution');
        cell.style.backgroundColor = '';
        cell.style.opacity = '';
        cell.textContent = '';
        cell.style.color = '';
        cell.style.fontSize = '';
        cell.style.fontWeight = '';
    }
    
    hideStatus();
}

function showStatus(message, type) {
    const statusElement = document.getElementById('status');
    statusElement.textContent = message;
    statusElement.className = `status ${type}`;
    statusElement.style.display = 'block';
}

function hideStatus() {
    const statusElement = document.getElementById('status');
    statusElement.style.display = 'none';
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('allowRotations').addEventListener('change', clearSolution);
    document.getElementById('allowReflections').addEventListener('change', clearSolution);
    document.getElementById('algorithmSelect').addEventListener('change', clearSolution);
    
    // Initialize the application
    init();
    
    // Show welcome message
    setTimeout(() => {
        showStatus('Advanced Polyomino Solver loaded. Design pieces with constraints!', 'success');
        setTimeout(hideStatus, 3000);
    }, 500);
});