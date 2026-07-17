import Quaternion from "./quaternion.js";

class Transform {
  constructor(x = 0, y = 0, z = 0) {
    this.position = [x, y, z];
    this.rotation = Quaternion.identity();
  }

  transformPoint(point) {
    const rotated = this.rotation.rotateVector(point);
    return [
      rotated[0] + this.position[0],
      rotated[1] + this.position[1],
      rotated[2] + this.position[2]
    ];
  }

  inverseTransformPoint(point) {
    const offset = [
      point[0] - this.position[0],
      point[1] - this.position[1],
      point[2] - this.position[2]
    ];
    return this.rotation.conjugate().rotateVector(offset);
  }
}

class BoardSquare {
  constructor(x, y, size = 1) {
    this.boardX = x;
    this.boardY = y;
    this.transform = new Transform((7 - x) * size, 0, y * size);
    const half = size / 2;
    this.localPoints = [
      [-half, 0, -half], [half, 0, -half], [half, 0, half], [-half, 0, half]
    ];
  }

  getWorldPoints() {
    return this.localPoints.map(point => this.transform.transformPoint(point));
  }
}

const BOX_FACES = [
  [0, 3, 2, 1], [0, 1, 5, 4], [1, 2, 6, 5],
  [2, 3, 7, 6], [3, 0, 4, 7], [4, 5, 6, 7]
];

const PRISM = {
  points: [
    [-0.22, 0, -0.22], [0.22, 0, -0.22], [0.22, 0, 0.22], [-0.22, 0, 0.22],
    [-0.13, 0.52, -0.13], [0.13, 0.52, -0.13], [0.13, 0.52, 0.13], [-0.13, 0.52, 0.13]
  ],
  edges: [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]],
  faces: BOX_FACES
};

const PIECE_GEOMETRIES = {
  0: PRISM,
  1: {
    points: [
      [-0.22, 0, -0.22], [0.22, 0, -0.22], [0.22, 0, 0.22], [-0.22, 0, 0.22],
      [-0.12, 0.36, -0.12], [0.12, 0.36, -0.12], [0.12, 0.36, 0.12], [-0.12, 0.36, 0.12], [0, 0.7, 0]
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [1, 5], [2, 6], [3, 7], [4, 5], [5, 6], [6, 7], [7, 4], [4, 8], [5, 8], [6, 8], [7, 8]],
    faces: [[0, 3, 2, 1], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [4, 5, 8], [5, 6, 8], [6, 7, 8], [7, 4, 8]]
  },
  2: {
    points: [
      [-0.22, 0, -0.22], [0.22, 0, -0.22], [0.22, 0, 0.22], [-0.22, 0, 0.22],
      [-0.16, 0.32, -0.3], [0.16, 0.32, -0.3], [0.23, 0.58, 0.02], [-0.23, 0.48, 0.08], [0, 0.72, 0.18]
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [1, 5], [4, 6], [5, 6], [0, 7], [3, 7], [6, 8], [7, 8]],
    faces: [[0, 3, 2, 1], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [0, 7, 4], [4, 5, 6, 7], [4, 7, 8], [7, 6, 8], [6, 5, 8]]
  },
  3: {
    points: [
      [-0.25, 0, -0.25], [0.25, 0, -0.25], [0.25, 0, 0.25], [-0.25, 0, 0.25],
      [-0.2, 0.66, -0.2], [0.2, 0.66, -0.2], [0.2, 0.66, 0.2], [-0.2, 0.66, 0.2]
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]],
    faces: BOX_FACES
  },
  4: {
    points: [
      [-0.24, 0, -0.24], [0.24, 0, -0.24], [0.24, 0, 0.24], [-0.24, 0, 0.24],
      [-0.2, 0.48, -0.2], [0.2, 0.48, -0.2], [0.2, 0.48, 0.2], [-0.2, 0.48, 0.2], [0, 0.82, -0.1], [0, 0.82, 0.1]
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [1, 5], [2, 6], [3, 7], [4, 5], [5, 6], [6, 7], [7, 4], [4, 8], [5, 8], [6, 9], [7, 9], [8, 9]],
    faces: [[0, 3, 2, 1], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [4, 5, 8], [5, 6, 9, 8], [6, 7, 9], [7, 4, 8, 9], [8, 9, 6, 5]]
  },
  5: {
    points: [
      [-0.24, 0, -0.24], [0.24, 0, -0.24], [0.24, 0, 0.24], [-0.24, 0, 0.24],
      [-0.16, 0.5, -0.16], [0.16, 0.5, -0.16], [0.16, 0.5, 0.16], [-0.16, 0.5, 0.16],
      [0, 0.82, 0], [-0.1, 0.93, 0], [0.1, 0.93, 0], [0, 0.82, -0.1], [0, 0.82, 0.1]
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [1, 5], [2, 6], [3, 7], [4, 5], [5, 6], [6, 7], [7, 4], [4, 8], [5, 8], [6, 8], [7, 8], [8, 9], [8, 10], [8, 11], [8, 12]],
    faces: [[0, 3, 2, 1], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [4, 5, 8], [5, 6, 8], [6, 7, 8], [7, 4, 8], [8, 9, 10], [8, 12, 11]]
  }
};

class Piece3D {
  constructor(x, y, type, color, size = 1) {
    this.color = color;
    this.transform = new Transform((7 - x) * size, size * 0.03, y * size);
    const geometry = PIECE_GEOMETRIES[type] ?? PRISM;
    this.localPoints = geometry.points.map(point => point.map(value => value * size));
    this.edges = geometry.edges;
    this.faces = geometry.faces;
  }

  getWorldPoints() {
    return this.localPoints.map(point => this.transform.transformPoint(point));
  }
}

const CAMERA_KEYS = new Set([
  "KeyW", "KeyA", "KeyS", "KeyD", "KeyI", "KeyJ", "KeyK", "KeyL", "Space", "ShiftLeft"
]);

class Camera {
  constructor(canvas, x = 3.5, y = 7.5, z = -5.5) {
    this.canvas = canvas;
    this.transform = new Transform(x, y, z);
    this.moveSpeed = 4;
    this.rotationSpeed = 1.5;
    this.keys = new Set();
    this.yaw = 0;
    this.pitch = 0;
    this.lookAt([3.5, 0, 3.5]);
    this.onKeyDown = event => this.handleKeyDown(event);
    this.onKeyUp = event => this.handleKeyUp(event);
    this.onBlur = () => this.keys.clear();
    document.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
  }

  handleKeyDown(event) {
    if (document.activeElement !== this.canvas || !CAMERA_KEYS.has(event.code)) return;
    this.keys.add(event.code);
    event.preventDefault();
  }

  handleKeyUp(event) {
    if (CAMERA_KEYS.has(event.code)) this.keys.delete(event.code);
  }

  lookAt(target) {
    const dx = target[0] - this.transform.position[0];
    const dy = target[1] - this.transform.position[1];
    const dz = target[2] - this.transform.position[2];
    const distance = Math.hypot(dx, dy, dz) || 1;
    this.yaw = Math.atan2(dx, dz);
    this.pitch = Math.asin(-dy / distance);
    this.updateOrientation();
  }

  setPlayerColor(color) {
    this.keys.clear();
    this.transform.position = [3.5, 7.5, color === 0 ? 12.5 : -5.5];
    this.lookAt([3.5, 0, 3.5]);
  }

  updateOrientation() {
    const yaw = Quaternion.fromAxisAngle(0, 1, 0, this.yaw);
    const right = yaw.rotateVector([1, 0, 0]);
    const pitch = Quaternion.fromAxisAngle(right[0], right[1], right[2], this.pitch);
    this.transform.rotation = pitch.multiply(yaw).normalize();
  }

  update(deltaSeconds) {
    const delta = Math.min(deltaSeconds, 0.05);
    if (this.keys.has("KeyJ")) this.yaw -= this.rotationSpeed * delta;
    if (this.keys.has("KeyL")) this.yaw += this.rotationSpeed * delta;
    if (this.keys.has("KeyI")) this.pitch -= this.rotationSpeed * delta;
    if (this.keys.has("KeyK")) this.pitch += this.rotationSpeed * delta;
    this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch));
    this.updateOrientation();

    const forward = this.normalize(this.transform.rotation.rotateVector([0, 0, 1]));
    const right = this.normalize(this.transform.rotation.rotateVector([1, 0, 0]));
    const speed = this.moveSpeed * delta;
    if (this.keys.has("KeyW")) this.translateFlat(forward, speed);
    if (this.keys.has("KeyS")) this.translateFlat(forward, -speed);
    if (this.keys.has("KeyA")) this.translateFlat(right, -speed);
    if (this.keys.has("KeyD")) this.translateFlat(right, speed);
    if (this.keys.has("Space")) this.transform.position[1] += speed;
    if (this.keys.has("ShiftLeft")) this.transform.position[1] -= speed;
  }

  translateFlat(vector, distance) {
    const flat = this.normalize([vector[0], 0, vector[2]]);
    this.transform.position[0] += flat[0] * distance;
    this.transform.position[2] += flat[2] * distance;
  }

  normalize(vector) {
    const length = Math.hypot(vector[0], vector[1], vector[2]);
    return length ? vector.map(value => value / length) : [0, 0, 0];
  }

  destroy() {
    document.removeEventListener("keydown", this.onKeyDown);
    document.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.keys.clear();
  }
}

export default class Renderer3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.nearPlane = 0.1;
    this.boardSize = 8;
    this.squareSize = 1;
    this.boardSquares = [];
    this.pieces = [];
    this.piecesKey = "";
    this.lastFrameTime = performance.now();
    this.viewport = { width: 0, height: 0, pixelRatio: 1 };

    this.camera = new Camera(canvas);
    this.initializeBoard();
    this.onResize = () => this.resizeCanvas();
    this.onCanvasClick = event => this.handleCanvasClick(event);
    window.addEventListener("resize", this.onResize);
    canvas.addEventListener("click", this.onCanvasClick);
    this.resizeCanvas();
  }

  resizeCanvas() {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.viewport = { width, height, pixelRatio };
    this.canvas.width = Math.round(width * pixelRatio);
    this.canvas.height = Math.round(height * pixelRatio);
    this.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    this.focal = Math.max(220, Math.min(width, height) * 0.82);
  }

  setPlayerColor(color) {
    this.camera.setPlayerColor(color);
    this.lastFrameTime = performance.now();
  }

  initializeBoard() {
    for (let y = 0; y < this.boardSize; y++) {
      for (let x = 0; x < this.boardSize; x++) {
        this.boardSquares.push(new BoardSquare(x, y, this.squareSize));
      }
    }
  }

  draw(board, selection) {
    const now = performance.now();
    this.camera.update((now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;
    this.ctx.clearRect(0, 0, this.viewport.width, this.viewport.height);
    this.syncPieces(board);
    this.drawBoardSquares(selection);
    this.drawPieces();
  }

  syncPieces(board) {
    const boardPieces = board.getPieces();
    const key = boardPieces.map(piece => `${piece.x},${piece.y},${piece.type},${piece.color}`).join("|");
    if (key === this.piecesKey) return;
    this.piecesKey = key;
    this.pieces = boardPieces.map(piece => new Piece3D(piece.x, piece.y, piece.type, piece.color, this.squareSize));
  }

  drawBoardSquares(selection) {
    const visibleSquares = [];
    for (const square of this.boardSquares) {
      const cameraPoints = square.getWorldPoints().map(point => this.camera.transform.inverseTransformPoint(point));
      const clipped = this.clipPolygonToNearPlane(cameraPoints);
      if (!clipped) continue;
      visibleSquares.push({
        square,
        points: clipped.map(point => this.projectCameraSpace(point)),
        depth: clipped.reduce((total, point) => total + point[2], 0) / clipped.length
      });
    }

    visibleSquares.sort((a, b) => b.depth - a.depth);
    for (const entry of visibleSquares) {
      this.ctx.fillStyle = this.getSquareColor(entry.square.boardX, entry.square.boardY, selection);
      this.ctx.beginPath();
      this.ctx.moveTo(entry.points[0].x, entry.points[0].y);
      for (let index = 1; index < entry.points.length; index++) {
        this.ctx.lineTo(entry.points[index].x, entry.points[index].y);
      }
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.strokeStyle = "rgba(42, 30, 24, 0.7)";
      this.ctx.lineWidth = 1;
      this.ctx.stroke();
    }
  }

  drawPieces() {
    const faces = [];
    for (const piece of this.pieces) {
      const cameraPoints = piece.getWorldPoints().map(point => this.camera.transform.inverseTransformPoint(point));
      for (const indices of piece.faces) {
        const face = indices.map(index => cameraPoints[index]);
        const clipped = this.clipPolygonToNearPlane(face);
        if (!clipped) continue;
        faces.push({
          points: clipped.map(point => this.projectCameraSpace(point)),
          depth: clipped.reduce((total, point) => total + point[2], 0) / clipped.length,
          fillStyle: this.getPieceFaceColor(piece.color, this.faceNormal(face)),
          strokeStyle: piece.color === 0 ? "rgba(80, 54, 36, 0.5)" : "rgba(10, 7, 6, 0.78)"
        });
      }
    }

    faces.sort((a, b) => b.depth - a.depth);
    this.ctx.lineWidth = 1;
    for (const face of faces) {
      this.ctx.beginPath();
      this.ctx.moveTo(face.points[0].x, face.points[0].y);
      for (let index = 1; index < face.points.length; index++) {
        this.ctx.lineTo(face.points[index].x, face.points[index].y);
      }
      this.ctx.closePath();
      this.ctx.fillStyle = face.fillStyle;
      this.ctx.fill();
      this.ctx.strokeStyle = face.strokeStyle;
      this.ctx.stroke();
    }
  }

  faceNormal(points) {
    const [first, second, third] = points;
    const ab = [second[0] - first[0], second[1] - first[1], second[2] - first[2]];
    const ac = [third[0] - first[0], third[1] - first[1], third[2] - first[2]];
    const normal = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0]
    ];
    const length = Math.hypot(normal[0], normal[1], normal[2]);
    return length ? normal.map(value => value / length) : [0, 1, 0];
  }

  getPieceFaceColor(color, normal) {
    const lightDirection = [-0.4, 0.7, -0.6];
    const lightLength = Math.hypot(...lightDirection);
    const light = lightDirection.map(value => value / lightLength);
    const diffuse = Math.abs(normal[0] * light[0] + normal[1] * light[1] + normal[2] * light[2]);
    const illumination = 0.55 + diffuse * 0.45;
    const base = color === 0 ? [255, 235, 205] : [94, 62, 48];
    return `rgb(${base.map(value => Math.round(value * illumination)).join(", ")})`;
  }

  clipPolygonToNearPlane(points) {
    const clipped = [];
    for (let index = 0; index < points.length; index++) {
      const current = points[index];
      const next = points[(index + 1) % points.length];
      const currentInside = current[2] > this.nearPlane;
      const nextInside = next[2] > this.nearPlane;
      if (currentInside) clipped.push(current);
      if (currentInside !== nextInside) {
        const intersection = this.lineNearPlaneIntersection(current, next);
        if (intersection) clipped.push(intersection);
      }
    }
    return clipped.length >= 3 ? clipped : null;
  }

  clipLineToNearPlane(first, second) {
    const firstInside = first[2] > this.nearPlane;
    const secondInside = second[2] > this.nearPlane;
    if (!firstInside && !secondInside) return null;
    if (firstInside && secondInside) return [first, second];
    const intersection = this.lineNearPlaneIntersection(first, second);
    return firstInside ? [first, intersection] : [intersection, second];
  }

  lineNearPlaneIntersection(first, second) {
    const denominator = second[2] - first[2];
    if (!denominator) return null;
    const t = (this.nearPlane - first[2]) / denominator;
    if (t < 0 || t > 1) return null;
    return [
      first[0] + t * (second[0] - first[0]),
      first[1] + t * (second[1] - first[1]),
      this.nearPlane
    ];
  }

  projectCameraSpace(point) {
    const scale = this.focal / point[2];
    return {
      x: point[0] * scale + this.viewport.width / 2,
      y: -point[1] * scale + this.viewport.height / 2
    };
  }

  handleCanvasClick(event) {
    this.canvas.focus({ preventScroll: true });
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = (event.clientX - rect.left) * (this.viewport.width / rect.width);
    const mouseY = (event.clientY - rect.top) * (this.viewport.height / rect.height);
    const square = this.raycastBoard(mouseX, mouseY);
    if (square) {
      this.canvas.dispatchEvent(new CustomEvent("boardClick", { detail: square }));
    }
  }

  raycastBoard(mouseX, mouseY) {
    const cameraDirection = [
      (mouseX - this.viewport.width / 2) / this.focal,
      -(mouseY - this.viewport.height / 2) / this.focal,
      1
    ];
    const direction = this.camera.transform.rotation.rotateVector(cameraDirection);
    if (Math.abs(direction[1]) < 0.000001) return null;
    const origin = this.camera.transform.position;
    const distance = -origin[1] / direction[1];
    if (distance <= 0) return null;

    const worldX = origin[0] + direction[0] * distance;
    const worldZ = origin[2] + direction[2] * distance;
    if (worldX < -0.5 || worldX >= 7.5 || worldZ < -0.5 || worldZ >= 7.5) return null;

    return {
      x: 7 - Math.floor(worldX + 0.5),
      y: Math.floor(worldZ + 0.5)
    };
  }

  getSquareColor(x, y, selection) {
    if (selection.selected && x === selection.x && y === selection.y) return "#6074d9";
    return (x + y) % 2 === 0 ? "#ead8bd" : "#825238";
  }

  destroy() {
    window.removeEventListener("resize", this.onResize);
    this.canvas.removeEventListener("click", this.onCanvasClick);
    this.camera.destroy();
    this.pieces = [];
    this.piecesKey = "";
  }
}
