import Quaternion from "./quaternion.js";

const canvas = document.getElementById("canvas");
if (!canvas) throw new Error("Canvas element with id 'canvas' not found.");

// rendering parameters
const focal = 300;      // focal length in pixels (controls perspective strength)
const nearPlane = 0.1;  // points with z <= nearPlane (in camera space) are culled
var cx = canvas.width / 2;
var cy = canvas.height / 2;
const pointSize = 5;

function resizeCanvas() {
  canvas.width = window.innerWidth-20;
  canvas.height = window.innerHeight-20;

  // update projection center
  cx = canvas.width / 2;
  cy = canvas.height / 2;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

const ctx = canvas.getContext("2d");


class Transform {
  constructor(x=0,y=0,z=0) {
    this.position = [x,y,z];
    this.rotation = Quaternion.identity();
  }

  translate(dx, dy, dz) {
    this.position[0] += dx;
    this.position[1] += dy;
    this.position[2] += dz;
  }

  rotate(axis, angle) {
    const q = Quaternion.fromAxisAngle(axis[0], axis[1], axis[2], angle);
    this.rotation = q.multiply(this.rotation).normalize();
  }

  // local → world
  transformPoint(p) {
    let rotated = this.rotation.rotateVector(p);
    return [
      rotated[0] + this.position[0],
      rotated[1] + this.position[1],
      rotated[2] + this.position[2]
    ];
  }

  // world → local (used for camera)
  inverseTransformPoint(p) {
    let v = [
      p[0] - this.position[0],
      p[1] - this.position[1],
      p[2] - this.position[2]
    ];
    return this.rotation.conjugate().rotateVector(v);
  }
}
class RectangularPrism {
  constructor(x, y, z, width, height, depth) {

    this.width = width;
    this.height = height;
    this.depth = depth;

    this.transform = new Transform(x,y,z);
    // 8 vertices centered at origin (local space)
    const w = width / 2;
    const h = height / 2;
    const d = depth / 2;

    this.localPoints = [
      [-w,-h,-d],
      [ w,-h,-d],
      [ w, h,-d],
      [-w, h,-d],
      [-w,-h, d],
      [ w,-h, d],
      [ w, h, d],
      [-w, h, d]
    ];

    // 12 edges
    this.lines = [
      [0,1],[1,2],[2,3],[3,0], // back face
      [4,5],[5,6],[6,7],[7,4], // front face
      [0,4],[1,5],[2,6],[3,7]  // connections
    ];
  }

  // return world-space points
  getWorldPoints() {
    return this.localPoints.map(p => this.transform.transformPoint(p));
  }
}

const prisms = [
        new RectangularPrism(0, 0, 5, 2, 2, 2), 
        new RectangularPrism(2, 2, 2, 1, 1, 1),
        new RectangularPrism(0,-5,0,20,1,20)
]
function normalize(v) {
  const len = Math.hypot(v[0], v[1], v[2]);
  return [v[0]/len, v[1]/len, v[2]/len];
}
class Camera {
  constructor(x=0,y=0,z=0) {
    this.transform = new Transform(x, y, z);
    this.speed = 0.1;
    this.rotSpeed = 0.03;

    this.keys = {}; // tracks held keys

    document.addEventListener("keydown", e => {
      this.keys[e.code] = true;
    });

    document.addEventListener("keyup", e => {
      this.keys[e.code] = false;
    });
  }

  update() {

    const forward = this.transform.rotation.rotateVector([0,0,1]);
    var right  = this.transform.rotation.rotateVector([1,0,0]);
    right = normalize(right);
    if (this.keys["KeyW"]) {
      this.transform.position[0] += forward[0] * this.speed;
      this.transform.position[1] += forward[1] * this.speed;
      this.transform.position[2] += forward[2] * this.speed;
    }

    if (this.keys["KeyS"]) {
      this.transform.position[0] -= forward[0] * this.speed;
      this.transform.position[1] -= forward[1] * this.speed;
      this.transform.position[2] -= forward[2] * this.speed;
    }

    if (this.keys["KeyA"]) {
      this.transform.position[0] -= right[0] * this.speed;
      this.transform.position[1] -= right[1] * this.speed;
      this.transform.position[2] -= right[2] * this.speed;
    }

    if (this.keys["KeyD"]) {
      this.transform.position[0] += right[0] * this.speed;
      this.transform.position[1] += right[1] * this.speed;
      this.transform.position[2] += right[2] * this.speed;
    }

    if (this.keys["Space"]) {
      this.transform.position[1] += this.speed;
    }

    if (this.keys["ShiftLeft"]) {
      this.transform.position[1] -= this.speed;
    }

    // yaw
    if (this.keys["ArrowRight"]) {
      this.transform.rotate([0,1,0], this.rotSpeed);
    }

    if (this.keys["ArrowLeft"]) {
      this.transform.rotate([0,1,0], -this.rotSpeed);
    }

    // pitch relative to camera right
    if (this.keys["ArrowDown"]) {
      this.transform.rotate(right, this.rotSpeed);
    }

    if (this.keys["ArrowUp"]) {
      this.transform.rotate(right, -this.rotSpeed);
    }

  }
}
  
const camera = new Camera(1, 1, 1);

// produce rotation matrices from camera angles

function clipLineToNearPlane(p1, p2, near) {
  // p = [x,y,z] in camera space

  const z1 = p1[2];
  const z2 = p2[2];

  // both behind → discard
  if (z1 <= near && z2 <= near) return null;

  // both in front → keep
  if (z1 > near && z2 > near) return [p1, p2];

  // line crosses plane → interpolate
  const t = (near - z1) / (z2 - z1);

  const intersect = [
    p1[0] + t * (p2[0] - p1[0]),
    p1[1] + t * (p2[1] - p1[1]),
    near
  ];

  if (z1 < near) {
    return [intersect, p2];
  } else {
    return [p1, intersect];
  }
}

function projectCameraSpace(p) {
  const scale = focal / p[2];
  return {
    x: p[0]*scale + cx,
    y: -p[1]*scale + cy
  };
}

function update() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // project all points
  ctx.beginPath();
  for(var i = 0; i<prisms.length; i++){
    const worldPoints = prisms[i].getWorldPoints();

    const camPoints = worldPoints.map(p =>
      camera.transform.inverseTransformPoint(p)
    );

    for (let [a,b] of prisms[i].lines) {

      let p1 = camPoints[a];
      let p2 = camPoints[b];

      const clipped = clipLineToNearPlane(p1, p2, nearPlane);
      if (!clipped) continue;

      [p1, p2] = clipped;

      const proj1 = projectCameraSpace(p1);
      const proj2 = projectCameraSpace(p2);
      ctx.moveTo(proj1.x, proj1.y);
      ctx.lineTo(proj2.x, proj2.y);
    }
  }
  ctx.stroke();
}

// animation loop
function loop() {
  camera.update();
  update();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);