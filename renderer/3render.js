/**
 * Controls:
 * - WASD: Move camera
 * - Arrow Keys: Rotate camera
 * - Space/Shift: Move camera up/down
 * - Click: Select piece or move
 */

import Quaternion from "./quaternion.js";

// Piece type constants
const PIECE_TYPES = {
  PAWN: 0,
  BISHOP: 1,
  KNIGHT: 2,
  ROOK: 3,
  QUEEN: 4,
  KING: 5
};


class Transform {
  /**
   * Create a transform with initial position
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} z - Z position
   */
  constructor(x = 0, y = 0, z = 0) {
    this.position = [x, y, z];
    this.rotation = Quaternion.identity();
  }

  /**
   * Translate the transform by the given delta
   */
  translate(dx, dy, dz) {
    this.position[0] += dx;
    this.position[1] += dy;
    this.position[2] += dz;
  }

  /**
   * Rotate around the given axis by the given angle (in radians)
   */
  rotate(axis, angle) {
    const q = Quaternion.fromAxisAngle(axis[0], axis[1], axis[2], angle);
    this.rotation = q.multiply(this.rotation).normalize();
  }

  /**
   * Transform a point from local to world space
   */
  transformPoint(p) {
    let rotated = this.rotation.rotateVector(p);
    return [
      rotated[0] + this.position[0],
      rotated[1] + this.position[1],
      rotated[2] + this.position[2]
    ];
  }

  /**
   * Transform a point from world to local space (used for camera)
   */
  inverseTransformPoint(p) {
    let v = [
      p[0] - this.position[0],
      p[1] - this.position[1],
      p[2] - this.position[2]
    ];
    return this.rotation.conjugate().rotateVector(v);
  }
}

// 3D Board Square
class BoardSquare {
  constructor(x, y, size = 1) {
    this.boardX = x;
    this.boardY = y;
    this.size = size;
    this.transform = new Transform(x * size, 0, y * size);
    
    // Create quad vertices for the square
    const s = size / 2;
    this.localPoints = [
      [-s, 0, -s],
      [s, 0, -s],
      [s, 0, s],
      [-s, 0, s]
    ];
  }

  getWorldPoints() {
    return this.localPoints.map(p => this.transform.transformPoint(p));
  }

  // Get the center point in world space
  getCenter() {
    return this.transform.transformPoint([0, 0, 0]);
  }
}

// 3D Piece base class
class Piece3D {
  constructor(x, y, type, color, size = 1) {
    this.boardX = x;
    this.boardY = y;
    this.type = type;
    this.color = color;
    this.size = size;
    this.transform = new Transform(x * size, size * 0.3, y * size);
  }

  getWorldPoints() {
    // Override in subclasses
    return [];
  }

  getEdges() {
    // Override in subclasses
    return [];
  }

  draw(ctx, camera, focal, cx, cy, nearPlane) {
    // Override in subclasses
  }
}

// Pawn piece
class Pawn3D extends Piece3D {
  constructor(x, y, type, color, size = 1) {
    super(x, y, type, color, size);
    const s = size * 0.2;
    const h = size * 0.5;
    
    // Base and top
    this.localPoints = [
      [-s, 0, -s], [s, 0, -s], [s, 0, s], [-s, 0, s],  // base
      [-s * 0.5, h, -s * 0.5], [s * 0.5, h, -s * 0.5], 
      [s * 0.5, h, s * 0.5], [-s * 0.5, h, s * 0.5]     // top
    ];
    
    this.edges = [
      [0,1],[1,2],[2,3],[3,0],  // base
      [4,5],[5,6],[6,7],[7,4],  // top
      [0,4],[1,5],[2,6],[3,7]   // sides
    ];
  }

  getWorldPoints() {
    return this.localPoints.map(p => this.transform.transformPoint(p));
  }

  getEdges() {
    return this.edges;
  }
}

// Rook piece
class Rook3D extends Piece3D {
  constructor(x, y, type, color, size = 1) {
    super(x, y, type, color, size);
    const s = size * 0.25;
    const h = size * 0.6;
    
    this.localPoints = [
      [-s, 0, -s], [s, 0, -s], [s, 0, s], [-s, 0, s],  // base
      [-s, h, -s], [s, h, -s], [s, h, s], [-s, h, s]   // top
    ];
    
    this.edges = [
      [0,1],[1,2],[2,3],[3,0],
      [4,5],[5,6],[6,7],[7,4],
      [0,4],[1,5],[2,6],[3,7]
    ];
  }

  getWorldPoints() {
    return this.localPoints.map(p => this.transform.transformPoint(p));
  }

  getEdges() {
    return this.edges;
  }
}

// Bishop piece
class Bishop3D extends Piece3D {
  constructor(x, y, type, color, size = 1) {
    super(x, y, type, color, size);
    const s = size * 0.22;
    const h = size * 0.55;
    
    this.localPoints = [
      [-s, 0, -s], [s, 0, -s], [s, 0, s], [-s, 0, s],
      [-s * 0.6, h * 0.5, -s * 0.6], [s * 0.6, h * 0.5, -s * 0.6],
      [s * 0.6, h * 0.5, s * 0.6], [-s * 0.6, h * 0.5, s * 0.6],
      [0, h, 0]
    ];
    
    this.edges = [
      [0,1],[1,2],[2,3],[3,0],
      [4,5],[5,6],[6,7],[7,4],
      [0,4],[1,5],[2,6],[3,7],
      [4,8],[5,8],[6,8],[7,8]
    ];
  }

  getWorldPoints() {
    return this.localPoints.map(p => this.transform.transformPoint(p));
  }

  getEdges() {
    return this.edges;
  }
}

// Knight piece
class Knight3D extends Piece3D {
  constructor(x, y, type, color, size = 1) {
    super(x, y, type, color, size);
    const s = size * 0.2;
    const h = size * 0.5;
    
    this.localPoints = [
      [-s, 0, -s], [s, 0, -s], [s, 0, s], [-s, 0, s],
      [-s * 0.4, h * 0.3, -s * 0.8], [s * 0.4, h * 0.3, -s * 0.8],
      [s * 0.7, h * 0.5, 0], [-s * 0.7, h * 0.5, 0],
      [0, h, s * 0.3]
    ];
    
    this.edges = [
      [0,1],[1,2],[2,3],[3,0],
      [0,4],[1,5],[4,6],[5,6],
      [6,8],[7,8],[7,4],[3,7]
    ];
  }

  getWorldPoints() {
    return this.localPoints.map(p => this.transform.transformPoint(p));
  }

  getEdges() {
    return this.edges;
  }
}

// Queen piece
class Queen3D extends Piece3D {
  constructor(x, y, type, color, size = 1) {
    super(x, y, type, color, size);
    const s = size * 0.23;
    const h = size * 0.65;
    
    this.localPoints = [
      [-s, 0, -s], [s, 0, -s], [s, 0, s], [-s, 0, s],
      [-s, h * 0.5, -s], [s, h * 0.5, -s], 
      [s, h * 0.5, s], [-s, h * 0.5, s],
      [0, h, -s * 0.5], [0, h, s * 0.5]
    ];
    
    this.edges = [
      [0,1],[1,2],[2,3],[3,0],
      [4,5],[5,6],[6,7],[7,4],
      [0,4],[1,5],[2,6],[3,7],
      [4,8],[5,8],[6,9],[7,9],[8,9]
    ];
  }

  getWorldPoints() {
    return this.localPoints.map(p => this.transform.transformPoint(p));
  }

  getEdges() {
    return this.edges;
  }
}

// King piece
class King3D extends Piece3D {
  constructor(x, y, type, color, size = 1) {
    super(x, y, type, color, size);
    const s = size * 0.22;
    const h = size * 0.7;
    
    this.localPoints = [
      [-s, 0, -s], [s, 0, -s], [s, 0, s], [-s, 0, s],
      [-s * 0.7, h * 0.4, -s * 0.7], [s * 0.7, h * 0.4, -s * 0.7],
      [s * 0.7, h * 0.4, s * 0.7], [-s * 0.7, h * 0.4, s * 0.7],
      [0, h * 0.85, 0],
      [-s * 0.3, h, -s * 0.3], [s * 0.3, h, -s * 0.3],
      [s * 0.3, h, s * 0.3], [-s * 0.3, h, s * 0.3]
    ];
    
    this.edges = [
      [0,1],[1,2],[2,3],[3,0],
      [4,5],[5,6],[6,7],[7,4],
      [0,4],[1,5],[2,6],[3,7],
      [4,8],[5,8],[6,8],[7,8],
      [8,9],[8,10],[8,11],[8,12]
    ];
  }

  getWorldPoints() {
    return this.localPoints.map(p => this.transform.transformPoint(p));
  }

  getEdges() {
    return this.edges;
  }
}

// Camera class
class Camera {
  constructor(x = 4, y = 6, z = 4) {
    this.transform = new Transform(x, y, z);
    this.speed = 0.05;
    this.rotSpeed = 0.02;
    this.keys = {};

    document.addEventListener("keydown", e => {
      this.keys[e.code] = true;
    });

    document.addEventListener("keyup", e => {
      this.keys[e.code] = false;
    });
  }

  update() {
    const forward = this.transform.rotation.rotateVector([0, 0, 1]);
    let right = this.transform.rotation.rotateVector([1, 0, 0]);
    
    // Flatten forward and right vectors to the XZ plane for ground-relative movement
    // This prevents vertical tilting from affecting horizontal movement
    const forwardFlat = [forward[0], 0, forward[2]];
    const forwardFlatNorm = this.normalize(forwardFlat);
    
    const rightFlat = [right[0], 0, right[2]];
    const rightFlatNorm = this.normalize(rightFlat);

    if (this.keys["KeyW"]) {
      this.transform.position[0] += forwardFlatNorm[0] * this.speed;
      this.transform.position[2] += forwardFlatNorm[2] * this.speed;
    }

    if (this.keys["KeyS"]) {
      this.transform.position[0] -= forwardFlatNorm[0] * this.speed;
      this.transform.position[2] -= forwardFlatNorm[2] * this.speed;
    }

    if (this.keys["KeyA"]) {
      this.transform.position[0] -= rightFlatNorm[0] * this.speed;
      this.transform.position[2] -= rightFlatNorm[2] * this.speed;
    }

    if (this.keys["KeyD"]) {
      this.transform.position[0] += rightFlatNorm[0] * this.speed;
      this.transform.position[2] += rightFlatNorm[2] * this.speed;
    }

    if (this.keys["Space"]) {
      this.transform.position[1] += this.speed;
    }

    if (this.keys["ShiftLeft"]) {
      this.transform.position[1] -= this.speed;
    }

    if (this.keys["ArrowRight"]) {
      this.transform.rotate([0, 1, 0], this.rotSpeed);
    }

    if (this.keys["ArrowLeft"]) {
      this.transform.rotate([0, 1, 0], -this.rotSpeed);
    }

    if (this.keys["ArrowDown"]) {
      this.transform.rotate(right, this.rotSpeed);
    }

    if (this.keys["ArrowUp"]) {
      this.transform.rotate(right, -this.rotSpeed);
    }
  }

  normalize(v) {
    const len = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / len, v[1] / len, v[2] / len];
  }
}

// Main 3D Renderer class
/**
 * Renderer3D - Main renderer class for 3D chess board and pieces
 * 
 * This class handles all rendering of the 3D chess game, including:
 * - Board squares with checkerboard pattern
 * - 3D piece models
 * - Camera control and view management
 * - Mouse interaction and piece selection via ray casting
 * 
 * The renderer maintains compatibility with the 2D Renderer interface by
 * implementing the same draw(board, selection) method.
 */
export default class Renderer3D {
  /**
   * Create a new 3D renderer
   * @param {HTMLCanvasElement} canvas - Canvas element for rendering
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    
    canvas.height = window.innerHeight - 20;
    canvas.width = window.innerWidth - 20;

    // 3D projection parameters
    this.focal = 400;        // Focal length in pixels (affects perspective)
    this.nearPlane = 0.1;    // Near clipping plane
    this.boardSize = 8;      // Chess board is always 8x8
    this.squareSize = 1;     // Unit size of each square

    // 3D scene objects
    this.camera = new Camera(4, 6, 4);
    this.boardSquares = [];
    this.pieces = [];

    this.initializeBoard();

    // Event listeners
    window.addEventListener("resize", () => this.resizeCanvas());
    window.addEventListener("mousemove", (e) => this.onMouseMove(e));
    window.addEventListener("click", (e) => this.onMouseClick(e));

    // Start animation loop
    this.startAnimationLoop();
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth - 20;
    this.canvas.height = window.innerHeight - 20;
  }

  initializeBoard() {
    // Create board squares
    for (let y = 0; y < this.boardSize; y++) {
      for (let x = 0; x < this.boardSize; x++) {
        this.boardSquares.push(new BoardSquare(x, y, this.squareSize));
      }
    }
  }

  createPiece3D(x, y, type, color) {
    const pieceClasses = {
      0: Pawn3D,
      1: Bishop3D,
      2: Knight3D,
      3: Rook3D,
      4: Queen3D,
      5: King3D
    };

    const PieceClass = pieceClasses[type];
    if (PieceClass) {
      return new PieceClass(x, y, type, color, this.squareSize);
    }
    return null;
  }

  /**
   * Main draw function - called each frame with current board state
   * Implements the same interface as the 2D Renderer for compatibility
   * @param {Board} board - Current game board state
   * @param {Object} selection - Current selection {selected, x, y}
   */
  draw(board, selection) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Clear and rebuild pieces from board state
    this.pieces = [];
    for (const piece of board.getPieces()) {
      const piece3D = this.createPiece3D(piece.x, piece.y, piece.type, piece.color);
      if (piece3D) {
        this.pieces.push(piece3D);
      }
    }

    // Update camera
    this.camera.update();

    // Draw board squares
    this.drawBoardSquares(selection);

    // Draw pieces
    this.drawPieces();
  }

  drawBoardSquares(selection) {
    for (let i = 0; i < this.boardSquares.length; i++) {
      const square = this.boardSquares[i];
      const worldPoints = square.getWorldPoints();

      const camPoints = worldPoints.map(p =>
        this.camera.transform.inverseTransformPoint(p)
      );

      // Skip if all points are behind near plane
      const allBehind = camPoints.every(p => p[2] <= this.nearPlane);
      if (allBehind) continue;

      // Check if any points are behind near plane
      const anyBehind = camPoints.some(p => p[2] <= this.nearPlane);
      
      // If any vertices are behind, clip the quad to the near plane
      let pointsToRender = camPoints;
      if (anyBehind) {
        pointsToRender = this.clipQuadToNearPlane(camPoints);
        if (!pointsToRender || pointsToRender.length < 3) continue; // Skip if clipping results in invalid polygon
      }

      // Project points to screen space
      const projPoints = pointsToRender.map(p => this.projectCameraSpace(p));

      // Draw filled polygon
      this.ctx.fillStyle = this.getSquareColor(square.boardX, square.boardY, selection);
      this.ctx.beginPath();
      this.ctx.moveTo(projPoints[0].x, projPoints[0].y);
      for (let j = 1; j < projPoints.length; j++) {
        this.ctx.lineTo(projPoints[j].x, projPoints[j].y);
      }
      this.ctx.closePath();
      this.ctx.fill();

      // Draw border
      this.ctx.strokeStyle = "#333";
      this.ctx.lineWidth = 1;
      this.ctx.stroke();
    }
  }

  /**
   * Clip a quadrilateral to the near clipping plane
   * Uses the Sutherland-Hodgman algorithm for polygon clipping
   * @param {Array} quad - 4 points defining a quadrilateral
   * @returns {Array} Clipped polygon points (may be 3-4 points)
   */
  clipQuadToNearPlane(quad) {
    let polygon = [...quad];

    // Clip against the near plane (z = nearPlane)
    let clipped = [];

    for (let i = 0; i < polygon.length; i++) {
      const current = polygon[i];
      const next = polygon[(i + 1) % polygon.length];

      const currInside = current[2] > this.nearPlane;
      const nextInside = next[2] > this.nearPlane;

      if (currInside) {
        clipped.push(current);

        // If current is inside but next is outside, find intersection
        if (!nextInside) {
          const intersection = this.lineNearPlaneIntersection(current, next);
          if (intersection) {
            clipped.push(intersection);
          }
        }
      } else if (nextInside) {
        // Current is outside, next is inside - find intersection
        const intersection = this.lineNearPlaneIntersection(current, next);
        if (intersection) {
          clipped.push(intersection);
        }
      }
    }

    return clipped.length >= 3 ? clipped : null;
  }

  /**
   * Find intersection of a line segment with the near clipping plane
   * @param {Array} p1 - Start point
   * @param {Array} p2 - End point
   * @returns {Array} Intersection point or null
   */
  lineNearPlaneIntersection(p1, p2) {
    const t = (this.nearPlane - p1[2]) / (p2[2] - p1[2]);
    if (t < 0 || t > 1) return null;

    return [
      p1[0] + t * (p2[0] - p1[0]),
      p1[1] + t * (p2[1] - p1[1]),
      this.nearPlane
    ];
  }

  getSquareColor(x, y, selection) {
    if (selection.selected && x === selection.x && y === selection.y) {
      return "rgb(84, 96, 223)";
    }
    return (x + y) % 2 === 0 ? "#e8d5c4" : "#8b5a3c";
  }

  drawPieces() {
    for (const piece of this.pieces) {
      const worldPoints = piece.getWorldPoints();
      const camPoints = worldPoints.map(p =>
        this.camera.transform.inverseTransformPoint(p)
      );

      const allBehind = camPoints.every(p => p[2] <= this.nearPlane);
      if (allBehind) continue;

      const projPoints = camPoints.map(p => this.projectCameraSpace(p));

      // Draw edges
      this.ctx.strokeStyle = piece.color === 0 ? "#eee" : "#333";
      this.ctx.lineWidth = 2;

      for (const [a, b] of piece.getEdges()) {
        const p1 = camPoints[a];
        const p2 = camPoints[b];

        const clipped = this.clipLineToNearPlane(p1, p2);
        if (!clipped) continue;

        const [cp1, cp2] = clipped;
        const proj1 = this.projectCameraSpace(cp1);
        const proj2 = this.projectCameraSpace(cp2);

        this.ctx.beginPath();
        this.ctx.moveTo(proj1.x, proj1.y);
        this.ctx.lineTo(proj2.x, proj2.y);
        this.ctx.stroke();
      }
    }
  }

  clipLineToNearPlane(p1, p2) {
    const z1 = p1[2];
    const z2 = p2[2];

    if (z1 <= this.nearPlane && z2 <= this.nearPlane) return null;
    if (z1 > this.nearPlane && z2 > this.nearPlane) return [p1, p2];

    const t = (this.nearPlane - z1) / (z2 - z1);
    const intersect = [
      p1[0] + t * (p2[0] - p1[0]),
      p1[1] + t * (p2[1] - p1[1]),
      this.nearPlane
    ];

    if (z1 < this.nearPlane) {
      return [intersect, p2];
    } else {
      return [p1, intersect];
    }
  }

  projectCameraSpace(p) {
    const scale = this.focal / p[2];
    return {
      x: p[0] * scale + this.canvas.width / 2,
      y: -p[1] * scale + this.canvas.height / 2
    };
  }

  onMouseMove(e) {
    // Can be used for highlighting squares
  }

  onMouseClick(e) {
    // Calculate click position in world space using ray casting
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    const clickedSquare = this.raycastBoard(mouseX, mouseY);
    if (clickedSquare !== null) {
      // Dispatch a custom event with the clicked coordinates
      const clickEvent = new CustomEvent("boardClick", {
        detail: { x: clickedSquare.boardX, y: clickedSquare.boardY }
      });
      this.canvas.dispatchEvent(clickEvent);
    }
  }

  raycastBoard(mouseX, mouseY) {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    const closestSquare = { square: null, distance: Infinity };

    for (const square of this.boardSquares) {
      const center = square.getCenter();
      const camCenter = this.camera.transform.inverseTransformPoint(center);

      if (camCenter[2] <= this.nearPlane) continue;

      const projCenter = this.projectCameraSpace(camCenter);

      const dx = mouseX - projCenter.x;
      const dy = mouseY - projCenter.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const threshold = (this.squareSize * this.focal) / (2 * camCenter[2]);

      if (distance < threshold && distance < closestSquare.distance) {
        closestSquare.square = square;
        closestSquare.distance = distance;
      }
    }

    return closestSquare.square;
  }

  startAnimationLoop() {
    const loop = () => {
      // The draw method will be called from main.js game loop
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}