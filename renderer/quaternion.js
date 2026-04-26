// quaternion class
export default class Quaternion {
  constructor(w, x, y, z) {
    this.w = w;
    this.x = x;
    this.y = y;
    this.z = z;
  }

  static identity() {
    return new Quaternion(1, 0, 0, 0);
  }

  static fromAxisAngle(ax, ay, az, angle) {
    const half = angle / 2;
    const s = Math.sin(half);
    return new Quaternion(
      Math.cos(half),
      ax * s,
      ay * s,
      az * s
    );
  }

  multiply(q) {
    return new Quaternion(
      this.w*q.w - this.x*q.x - this.y*q.y - this.z*q.z,
      this.w*q.x + this.x*q.w + this.y*q.z - this.z*q.y,
      this.w*q.y - this.x*q.z + this.y*q.w + this.z*q.x,
      this.w*q.z + this.x*q.y - this.y*q.x + this.z*q.w
    );
  }

  normalize() {
    const mag = Math.hypot(this.w, this.x, this.y, this.z);
    this.w /= mag;
    this.x /= mag;
    this.y /= mag;
    this.z /= mag;
    return this;
  }

  conjugate() {
    return new Quaternion(this.w, -this.x, -this.y, -this.z);
  }

  // rotate vector [x,y,z]
  rotateVector(v) {
    const qVec = new Quaternion(0, v[0], v[1], v[2]);
    const result = this.multiply(qVec).multiply(this.conjugate());
    return [result.x, result.y, result.z];
  }
}