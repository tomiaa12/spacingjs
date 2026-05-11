import Rect from './rect';
import { LineBorder, Direction } from './type';

function createLine(
  width: number,
  height: number,
  top: number,
  left: number,
  text: string,
  border: LineBorder = 'none'
): void {
  let marker: HTMLSpanElement = document.createElement('span');
  marker.style.backgroundColor = 'red';
  marker.style.position = 'fixed';
  marker.classList.add(`spacing-js-marker`);
  marker.style.width = `${width}px`;
  marker.style.height = `${height}px`;

  if (border === 'x') {
    marker.style.borderLeft = '1px solid rgba(255, 255, 255, .8)';
    marker.style.borderRight = '1px solid rgba(255, 255, 255, .8)';
  }

  if (border === 'y') {
    marker.style.borderTop = '1px solid rgba(255, 255, 255, .8)';
    marker.style.borderBottom = '1px solid rgba(255, 255, 255, .8)';
  }

  marker.style.pointerEvents = 'none';
  marker.style.top = `${top}px`;
  marker.style.left = `${left}px`;
  marker.style.zIndex = '9998';
  marker.style.boxSizing = 'content-box';

  let value: HTMLSpanElement = document.createElement('span');
  value.classList.add(`spacing-js-value`);
  value.style.backgroundColor = 'red';
  value.style.color = 'white';
  value.style.fontSize = '10px';
  value.style.display = 'inline-block';
  value.style.fontFamily = 'Helvetica, sans-serif';
  value.style.fontWeight = 'bold';
  value.style.borderRadius = '20px';
  value.style.position = 'fixed';
  value.style.width = '42px';
  value.style.lineHeight = '15px';
  value.style.height = '16px';
  value.style.textAlign = 'center';
  value.style.zIndex = '10000';
  value.style.pointerEvents = 'none';
  value.innerText = text;
  value.style.boxSizing = 'content-box';

  if (border === 'x') {
    // Prevent the badge moved outside the screen
    let topOffset = top + height / 2 - 7;

    if (topOffset > document.documentElement.clientHeight - 20) {
      topOffset = document.documentElement.clientHeight - 20;
    }

    if (topOffset < 0) {
      topOffset = 6;
    }

    value.style.top = `${topOffset}px`;
    value.style.left = `${left + 6}px`;
  } else if (border === 'y') {
    // Prevent the badge moved outside the screen
    let leftOffset = left + width / 2 - 20;

    if (leftOffset > document.documentElement.clientWidth - 48) {
      leftOffset = document.documentElement.clientWidth - 48;
    }

    if (leftOffset < 0) {
      leftOffset = 6;
    }

    value.style.top = `${top + 6}px`;
    value.style.left = `${leftOffset}px`;
  }

  document.body.appendChild(marker);
  document.body.appendChild(value);
}

export function placeMark(
  rect1: Rect,
  rect2: Rect,
  direction: Direction,
  value: string,
  edgeToEdge: boolean = false
): void {
  if (direction === 'top') {
    let width: number = 1;
    let height: number = Math.abs(rect1.top - rect2.top);
    let left: number = Math.floor(
      (Math.min(rect1.right, rect2.right) + Math.max(rect1.left, rect2.left)) /
        2
    );
    let top: number = Math.min(rect1.top, rect2.top);

    if (edgeToEdge) {
      if (rect1.top < rect2.top) {
        return;
      }
      // If not colliding
      if (rect1.right < rect2.left || rect1.left > rect2.right) {
        return;
      }
      height = Math.abs(rect2.bottom - rect1.top);
      top = Math.min(rect2.bottom, rect1.top);
    }

    createLine(width, height, top, left, value, 'x');
  } else if (direction === 'left') {
    let width: number = Math.abs(rect1.left - rect2.left);
    let height: number = 1;
    let top: number = Math.floor(
      (Math.min(rect1.bottom, rect2.bottom) + Math.max(rect1.top, rect2.top)) /
        2
    );
    let left: number = Math.min(rect1.left, rect2.left);

    if (edgeToEdge) {
      if (rect1.left < rect2.left) {
        return;
      }
      // If not overlapping
      if (rect1.bottom < rect2.top || rect1.top > rect2.bottom) {
        return;
      }
      width = Math.abs(rect1.left - rect2.right);
      left = Math.min(rect2.right, rect1.left);
    }

    createLine(width, height, top, left, value, 'y');
  } else if (direction === 'right') {
    let width: number = Math.abs(rect1.right - rect2.right);
    let height: number = 1;
    let top: number = Math.floor(
      (Math.min(rect1.bottom, rect2.bottom) + Math.max(rect1.top, rect2.top)) /
        2
    );
    let left: number = Math.min(rect1.right, rect2.right);

    if (edgeToEdge) {
      if (rect1.left > rect2.right) {
        return;
      }
      // If not overlapping
      if (rect1.bottom < rect2.top || rect1.top > rect2.bottom) {
        return;
      }
      width = Math.abs(rect1.right - rect2.left);
    }

    createLine(width, height, top, left, value, 'y');
  } else if (direction === 'bottom') {
    let width: number = 1;
    let height: number = Math.abs(rect1.bottom - rect2.bottom);
    let top: number = Math.min(rect1.bottom, rect2.bottom);
    let left: number = Math.floor(
      (Math.min(rect1.right, rect2.right) + Math.max(rect1.left, rect2.left)) /
        2
    );

    if (edgeToEdge) {
      if (rect2.bottom < rect1.top) {
        return;
      }
      // If not overlapping
      if (rect1.right < rect2.left || rect1.left > rect2.right) {
        return;
      }
      height = Math.abs(rect1.bottom - rect2.top);
    }

    createLine(width, height, top, left, value, 'x');
  }
}

function formatGapText(pixels: number): string {
  if (pixels === 0) return '0px';
  if (pixels < 1) return '<1px';
  return `${pixels}px`;
}

/**
 * 通用「不重叠」距离绘制：处理任意两个不相交矩形之间的水平/垂直间距。
 * - 有水平投影重叠 → 仅绘制纵向距离 dy（位于投影中线 x）
 * - 有垂直投影重叠 → 仅绘制横向距离 dx（位于投影中线 y）
 * - 完全无投影重叠 → 同时绘制 dx 与 dy，相交于「rect1 距 rect2 最近的角点」
 *   修复了 placeMark(edgeToEdge=true) 在无投影重叠时直接 return 导致的「左右没相邻就没距离」bug。
 */
export function placeGapMarks(rect1: Rect, rect2: Rect): void {
  const horizontalOverlap =
    Math.min(rect1.right, rect2.right) > Math.max(rect1.left, rect2.left);
  const verticalOverlap =
    Math.min(rect1.bottom, rect2.bottom) > Math.max(rect1.top, rect2.top);

  let dx = 0;
  if (rect1.left >= rect2.right) dx = Math.round(rect1.left - rect2.right);
  else if (rect2.left >= rect1.right) dx = Math.round(rect2.left - rect1.right);

  let dy = 0;
  if (rect1.top >= rect2.bottom) dy = Math.round(rect1.top - rect2.bottom);
  else if (rect2.top >= rect1.bottom) dy = Math.round(rect2.top - rect1.bottom);

  if (dx > 0) {
    const lineLeft = rect1.left >= rect2.right ? rect2.right : rect1.right;
    const lineY = verticalOverlap
      ? Math.floor(
          (Math.max(rect1.top, rect2.top) +
            Math.min(rect1.bottom, rect2.bottom)) /
            2
        )
      : rect1.top >= rect2.bottom
      ? rect1.top
      : rect1.bottom;
    createLine(dx, 1, lineY, lineLeft, formatGapText(dx), 'y');
  }

  if (dy > 0) {
    const lineTop = rect1.top >= rect2.bottom ? rect2.bottom : rect1.bottom;
    const lineX = horizontalOverlap
      ? Math.floor(
          (Math.max(rect1.left, rect2.left) +
            Math.min(rect1.right, rect2.right)) /
            2
        )
      : rect1.left >= rect2.right
      ? rect1.left
      : rect1.right;
    createLine(1, dy, lineTop, lineX, formatGapText(dy), 'x');
  }
}

export function removeMarks(): void {
  document
    .querySelectorAll<HTMLSpanElement>('.spacing-js-marker')
    .forEach(function (element) {
      element.remove();
    });
  document
    .querySelectorAll<HTMLSpanElement>('.spacing-js-value')
    .forEach(function (element) {
      element.remove();
    });
}
