export default class Rect {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;

  constructor(rect: DOMRect) {
    this.top = rect.top;
    this.left = rect.left;
    this.width = rect.width;
    this.height = rect.height;
    this.right = rect.right;
    this.bottom = rect.bottom;
  }

  /**
   * 严格相交：仅当两个矩形有面积重叠时返回 true。
   * 边缘恰好相邻（如 a.bottom === b.top）不算相交，避免把
   * 上下/左右紧贴的元素误判为「inside」从而绘制出无意义的
   * top-to-top / bottom-to-bottom 距离（数值恰为元素自身宽高）。
   */
  colliding(other: Rect) {
    return !(
      this.top >= other.bottom ||
      this.right <= other.left ||
      this.bottom <= other.top ||
      this.left >= other.right
    );
  }

  containing(other: Rect) {
    return (
      this.left <= other.left &&
      other.left < this.width &&
      this.top <= other.top &&
      other.top < this.height
    );
  }

  inside(other: Rect) {
    return (
      other.top <= this.top &&
      this.top <= other.bottom &&
      other.top <= this.bottom &&
      this.bottom <= other.bottom &&
      other.left <= this.left &&
      this.left <= other.right &&
      other.left <= this.right &&
      this.right <= other.right
    );
  }
}
