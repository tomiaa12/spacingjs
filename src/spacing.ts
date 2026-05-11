import Rect from './rect';
import {
  clearPlaceholderElement,
  createPlaceholderElement,
} from './placeholder';
import { placeMark, placeGapMarks, removeMarks } from './marker';

import { Spacing as SpacingType, SpacingMode, SpacingStartOptions } from './type';

let active: boolean = false;
let hoveringElement: HTMLElement | null = null;
let selectedElement: HTMLElement | null;
let targetElement: HTMLElement | null;
let delayedDismiss: boolean = false;
let delayedRef: ReturnType<typeof setTimeout> | null = null;
let isAltKeyDown: boolean = false;

let currentMode: SpacingMode = 'default';
let pinnedElements: HTMLElement[] = [];
let pinnedRefreshRaf: number | null = null;
let multiRedrawRaf: number | null = null;

function isMultiMode(mode: SpacingMode = currentMode): boolean {
  return mode === 'click-multi' || mode === 'size-only';
}

let started: boolean = false;
let enabled: boolean = true;

const PIN_COLORS = [
  '#e53935',
  '#1e88e5',
  '#43a047',
  '#fb8c00',
  '#8e24aa',
  '#00acc1',
];

const PREVIEW_COLOR = '#1e88e5';

function isDomAncestor(ancestor: HTMLElement, el: HTMLElement): boolean {
  let p: HTMLElement | null = el.parentElement;
  while (p) {
    if (p === ancestor) return true;
    p = p.parentElement;
  }
  return false;
}

/** 从 el 的父节点向上找，第一个落在 pinned 里的节点（不含 el 自身） */
function closestPinnedAncestor(
  el: HTMLElement,
  pinned: HTMLElement[]
): HTMLElement | null {
  let p: HTMLElement | null = el.parentElement;
  while (p) {
    if (pinned.includes(p)) return p;
    p = p.parentElement;
  }
  return null;
}

function minRectGap(a: DOMRect, b: DOMRect): number {
  const ox = Math.max(0, Math.max(a.left, b.left) - Math.min(a.right, b.right));
  const oy = Math.max(0, Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom));
  return Math.hypot(ox, oy);
}

function pushUniquePair(
  out: Array<[HTMLElement, HTMLElement]>,
  a: HTMLElement,
  b: HTMLElement
): void {
  for (const [x, y] of out) {
    if ((x === a && y === b) || (x === b && y === a)) return;
  }
  out.push([a, b]);
}

/**
 * multi 模式：嵌套则只连「最近的已固定祖先 ↔ 子」；否则与「最近的、DOM 互不包含」的已固定元素相连。
 */
function computePinnedSpacingPairs(
  pinned: HTMLElement[]
): Array<[HTMLElement, HTMLElement]> {
  if (pinned.length < 2) return [];

  const pairs: Array<[HTMLElement, HTMLElement]> = [];

  for (const e of pinned) {
    const par = closestPinnedAncestor(e, pinned);
    if (par) pushUniquePair(pairs, par, e);
  }

  const rectCache = new Map<HTMLElement, DOMRect>();
  const rectOf = (el: HTMLElement) => {
    let r = rectCache.get(el);
    if (!r) {
      r = el.getBoundingClientRect();
      rectCache.set(el, r);
    }
    return r;
  };

  for (const e of pinned) {
    if (closestPinnedAncestor(e, pinned)) continue;

    let best: HTMLElement | null = null;
    let bestD = Infinity;
    for (const f of pinned) {
      if (f === e) continue;
      if (isDomAncestor(e, f) || isDomAncestor(f, e)) continue;
      const d = minRectGap(rectOf(e), rectOf(f));
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    if (best) pushUniquePair(pairs, e, best);
  }

  return pairs;
}

/** 悬停预览：优先连最近的已固定 DOM 祖先，否则连矩形距离最近的已固定元素 */
function hoverSpacingTargets(
  hover: HTMLElement,
  pinned: HTMLElement[]
): HTMLElement[] {
  if (pinned.length === 0) return [];

  let p: HTMLElement | null = hover.parentElement;
  while (p) {
    if (pinned.includes(p)) return [p];
    p = p.parentElement;
  }

  let best: HTMLElement | null = null;
  let bestD = Infinity;
  const hr = hover.getBoundingClientRect();
  for (const f of pinned) {
    const d = minRectGap(hr, f.getBoundingClientRect());
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best ? [best] : [];
}

const Spacing: SpacingType = {
  start(options?: SpacingStartOptions) {
    if (!document.body) {
      console.warn(`Unable to initialise, document.body does not exist.`);
      return;
    }

    if (started) {
      if (options?.mode != null) applyModeSwitch(options.mode);
      return;
    }

    started = true;
    currentMode = options?.mode ?? 'default';

    window.addEventListener('keydown', unifiedKeyDown);
    window.addEventListener('keyup', unifiedKeyUp);
    window.addEventListener('mousemove', unifiedMouseMove);
    // 也监听 pointermove：Chrome DevTools 设备模式（手机模拟）下
    // 鼠标移动可能只触发 pointermove 而不再触发 mousemove。
    // PointerEvent 是 MouseEvent 的子类，签名兼容；scheduleMultiRedraw
    // 已用 rAF 去抖，重复触发是无害的。
    window.addEventListener('pointermove', unifiedMouseMove);
    window.addEventListener('mouseout', unifiedMouseOut);
    window.addEventListener('pointerout', unifiedMouseOut);
    window.addEventListener('click', multiClickHandler, true);
    document.addEventListener('scroll', pinnedScrollOrResizeHandler, true);
    window.addEventListener('resize', pinnedScrollOrResizeHandler);
  },

  stop() {
    if (!started) return;

    window.removeEventListener('keydown', unifiedKeyDown);
    window.removeEventListener('keyup', unifiedKeyUp);
    window.removeEventListener('mousemove', unifiedMouseMove);
    window.removeEventListener('pointermove', unifiedMouseMove);
    window.removeEventListener('mouseout', unifiedMouseOut);
    window.removeEventListener('pointerout', unifiedMouseOut);
    window.removeEventListener('click', multiClickHandler, true);
    document.removeEventListener('scroll', pinnedScrollOrResizeHandler, true);
    window.removeEventListener('resize', pinnedScrollOrResizeHandler);

    if (pinnedRefreshRaf != null) {
      cancelAnimationFrame(pinnedRefreshRaf);
      pinnedRefreshRaf = null;
    }
    if (multiRedrawRaf != null) {
      cancelAnimationFrame(multiRedrawRaf);
      multiRedrawRaf = null;
    }

    cleanUpPinned();
    cleanUp();

    active = false;
    hoveringElement = null;
    selectedElement = null;
    targetElement = null;
    delayedDismiss = false;
    isAltKeyDown = false;
    currentMode = 'default';
    started = false;
    enabled = true; // 重置启停状态，避免 disable→stop→start 后仍处于禁用

    if (delayedRef) {
      clearTimeout(delayedRef);
      delayedRef = null;
    }
  },

  enable() {
    if (!started) {
      // 未启动：按当前 mode 自动 start，并保证为启用态
      enabled = true;
      this.start({ mode: currentMode });
      return;
    }
    enabled = true;
  },

  disable() {
    enabled = false;
    if (!started) return;

    cleanUpPinned();
    cleanUp();
    hoveringElement = null;
    isAltKeyDown = false;

    if (multiRedrawRaf != null) {
      cancelAnimationFrame(multiRedrawRaf);
      multiRedrawRaf = null;
    }
    if (pinnedRefreshRaf != null) {
      cancelAnimationFrame(pinnedRefreshRaf);
      pinnedRefreshRaf = null;
    }
    if (delayedRef) {
      clearTimeout(delayedRef);
      delayedRef = null;
    }
    preventPageScroll(false);
  },

  clear() {
    cleanUpPinned();
    cleanUp();
    hoveringElement = null;

    if (multiRedrawRaf != null) {
      cancelAnimationFrame(multiRedrawRaf);
      multiRedrawRaf = null;
    }
    if (pinnedRefreshRaf != null) {
      cancelAnimationFrame(pinnedRefreshRaf);
      pinnedRefreshRaf = null;
    }
  },

  isEnabled(): boolean {
    return started && enabled;
  },

  setMode(mode: SpacingMode) {
    if (!started) {
      currentMode = mode;
      return;
    }
    applyModeSwitch(mode);
  },

  getMode(): SpacingMode {
    return currentMode;
  },

  toggleMode(): SpacingMode {
    const order: SpacingMode[] = ['default', 'click-multi', 'size-only'];
    const next = order[(order.indexOf(currentMode) + 1) % order.length];
    if (!started) {
      currentMode = next;
      return currentMode;
    }
    applyModeSwitch(next);
    return currentMode;
  },
};

function applyModeSwitch(next: SpacingMode) {
  if (next === currentMode) return;

  const prev = currentMode;

  if (next === 'default') {
    cleanUpPinned();
    clearPlaceholderElement('preview');
    hoveringElement = null;
    currentMode = next;
    return;
  }

  if (prev === 'default') {
    cleanUp();
    clearPlaceholderElement('preview');
    hoveringElement = null;
  } else {
    // 在 click-multi 与 size-only 之间切换：保留 pinned 元素，仅清掉距离/预览以便重绘
    clearPlaceholderElement('preview');
    removeMarks();
  }

  currentMode = next;
  redrawMultiUi();
}

function isSpacingChrome(el: HTMLElement | null): boolean {
  if (!el) return true;
  return (
    el.classList.contains('spacing-js-marker') ||
    el.classList.contains('spacing-js-value') ||
    el.classList.contains('spacing-js-placeholder') ||
    !!el.closest('.spacing-js-placeholder')
  );
}

function elementFromEvent(e: MouseEvent): HTMLElement | null {
  if (e.composedPath && e.composedPath().length) {
    return e.composedPath()[0] as HTMLElement;
  }
  return e.target as HTMLElement | null;
}

function multiClickHandler(e: MouseEvent) {
  if (!enabled) return;
  if (!isMultiMode()) return;
  if (e.button !== 0) return;

  const el = elementFromEvent(e);
  if (!el || isSpacingChrome(el)) return;
  if (el === document.documentElement || el === document.body) return;

  const idx = pinnedElements.indexOf(el);
  if (idx >= 0) {
    pinnedElements.splice(idx, 1);
  } else {
    pinnedElements.push(el);
  }

  e.preventDefault();
  e.stopPropagation();
  redrawMultiUi();
}

function unifiedKeyDown(e: KeyboardEvent) {
  if (!enabled) return;

  if (isMultiMode() && e.key === 'Escape') {
    pinnedElements = [];
    clearPlaceholderElement('preview');
    redrawMultiUi();
    return;
  }

  if (currentMode !== 'default') return;

  if (delayedDismiss) {
    cleanUp();
    if (delayedRef) {
      clearTimeout(delayedRef);
      delayedRef = null;
    }
  }

  if (e.key === 'Alt') {
    e.preventDefault();
    isAltKeyDown = true;

    if (!active && hoveringElement) {
      active = true;
      setSelectedElement();
      preventPageScroll(true);
    }
  }

  if (e.shiftKey) delayedDismiss = true;
}

function unifiedKeyUp(e: KeyboardEvent) {
  if (!enabled) return;
  if (currentMode !== 'default') return;

  if (e.key === 'Alt') {
    isAltKeyDown = false;
    if (active) {
      delayedRef = setTimeout(
        () => {
          cleanUp();
        },
        delayedDismiss ? 3000 : 0
      );
    }
  }
}

function unifiedMouseMove(e: MouseEvent) {
  if (!enabled) return;

  const el = elementFromEvent(e);

  if (!el || isSpacingChrome(el)) {
    if (isMultiMode()) {
      hoveringElement = null;
      scheduleMultiRedraw();
    }
    return;
  }

  hoveringElement = el;

  if (currentMode === 'default' && active) {
    defaultCursorMovedCore();
  }
  if (isMultiMode()) {
    scheduleMultiRedraw();
  }
}

function unifiedMouseOut(e: MouseEvent) {
  if (!enabled) return;

  const to = e.relatedTarget as HTMLElement;

  if (currentMode === 'default') {
    if (!isAltKeyDown && (!to || to.nodeName === 'HTML')) {
      hoveringElement = null;
      cleanUp();
    }
  }

  if (isMultiMode()) {
    if (!to || to.nodeName === 'HTML') {
      hoveringElement = null;
      scheduleMultiRedraw();
    }
  }
}

function scheduleMultiRedraw() {
  if (!isMultiMode()) return;
  if (multiRedrawRaf != null) return;
  multiRedrawRaf = requestAnimationFrame(() => {
    multiRedrawRaf = null;
    redrawMultiUi();
  });
}

function pinnedScrollOrResizeHandler() {
  if (!enabled) return;
  if (!isMultiMode()) return;
  if (pinnedElements.length === 0 && !hoveringElement) return;

  if (pinnedRefreshRaf != null) cancelAnimationFrame(pinnedRefreshRaf);
  pinnedRefreshRaf = requestAnimationFrame(() => {
    pinnedRefreshRaf = null;
    redrawMultiUi();
  });
}

function cleanUpPinned() {
  pinnedElements = [];
  clearPlaceholderElement('pinned');
  clearPlaceholderElement('preview');
  removeMarks();
}

function redrawMultiUi() {
  if (!isMultiMode()) return;

  clearPlaceholderElement('pinned');
  clearPlaceholderElement('preview');
  removeMarks();

  pinnedElements.forEach((el, i) => {
    const color = PIN_COLORS[i % PIN_COLORS.length];
    createPlaceholderElement('pinned', el, color);
  });

  // size-only 模式只标尺寸，不画任何元素之间的距离
  const showDistances = currentMode === 'click-multi';

  if (showDistances) {
    for (const [a, b] of computePinnedSpacingPairs(pinnedElements)) {
      const pc = asParentChild(a, b);
      const blocked = pc
        ? computeBlockedInsideDirections(pc[0], pc[1], pinnedElements)
        : undefined;
      placeMarksBetweenElements(a, b, blocked);
    }
  }

  const hover = hoveringElement;
  if (
    hover &&
    hover !== document.documentElement &&
    hover !== document.body &&
    !isSpacingChrome(hover)
  ) {
    const hoverPinned = pinnedElements.indexOf(hover) >= 0;
    if (!hoverPinned) {
      createPlaceholderElement('preview', hover, PREVIEW_COLOR);
      if (showDistances) {
        const ctx = pinnedElements.concat(hover);
        for (const t of hoverSpacingTargets(hover, pinnedElements)) {
          const pc = asParentChild(hover, t);
          const blocked = pc
            ? computeBlockedInsideDirections(pc[0], pc[1], ctx)
            : undefined;
          placeMarksBetweenElements(hover, t, blocked);
        }
      }
    }
  }
}

function formatDistance(pixels: number): string {
  if (pixels === 0) return '0px';
  if (pixels < 1) return '<1px';
  return `${pixels}px`;
}

type InsideMask = {
  top?: boolean;
  bottom?: boolean;
  left?: boolean;
  right?: boolean;
};

/**
 * 父子配对时，若某个 inside 方向上夹着另一个 pinned 兄弟元素（且与 child 在
 * 另一轴有投影重叠），则该方向的距离会「穿过」那个兄弟，视觉无意义。
 * 这里把这种被遮挡的方向标出来，由调用方在绘制时跳过。
 */
function computeBlockedInsideDirections(
  parent: HTMLElement,
  child: HTMLElement,
  context: HTMLElement[]
): InsideMask {
  const blocked: InsideMask = {};
  if (context.length === 0) return blocked;

  const parentRect = parent.getBoundingClientRect();
  const childRect = child.getBoundingClientRect();

  for (const sibling of context) {
    if (sibling === parent || sibling === child) continue;
    if (!isDomAncestor(parent, sibling)) continue; // 必须是 parent 的后代
    if (isDomAncestor(child, sibling)) continue; // 不能是 child 的后代
    if (isDomAncestor(sibling, child)) continue; // 不能是 child 的祖先

    const sRect = sibling.getBoundingClientRect();

    const horizontallyOverlapsChild =
      Math.min(sRect.right, childRect.right) >
      Math.max(sRect.left, childRect.left);
    const verticallyOverlapsChild =
      Math.min(sRect.bottom, childRect.bottom) >
      Math.max(sRect.top, childRect.top);

    if (
      horizontallyOverlapsChild &&
      sRect.top >= parentRect.top &&
      sRect.bottom <= childRect.top
    ) {
      blocked.top = true;
    }
    if (
      horizontallyOverlapsChild &&
      sRect.top >= childRect.bottom &&
      sRect.bottom <= parentRect.bottom
    ) {
      blocked.bottom = true;
    }
    if (
      verticallyOverlapsChild &&
      sRect.left >= parentRect.left &&
      sRect.right <= childRect.left
    ) {
      blocked.left = true;
    }
    if (
      verticallyOverlapsChild &&
      sRect.left >= childRect.right &&
      sRect.right <= parentRect.right
    ) {
      blocked.right = true;
    }
  }

  return blocked;
}

function placeMarksBetweenElements(
  a: HTMLElement,
  b: HTMLElement,
  blockedInside?: InsideMask
): void {
  const selectedElementRect = a.getBoundingClientRect();
  const targetElementRect = b.getBoundingClientRect();

  const selected: Rect = new Rect(selectedElementRect);
  const target: Rect = new Rect(targetElementRect);

  // 包含/相交：保留四向 inside 距离绘制（被 blockedInside 标记的方向跳过）
  if (
    selected.containing(target) ||
    selected.inside(target) ||
    selected.colliding(target)
  ) {
    const top = Math.round(
      Math.abs(selectedElementRect.top - targetElementRect.top)
    );
    const bottom = Math.round(
      Math.abs(selectedElementRect.bottom - targetElementRect.bottom)
    );
    const left = Math.round(
      Math.abs(selectedElementRect.left - targetElementRect.left)
    );
    const right = Math.round(
      Math.abs(selectedElementRect.right - targetElementRect.right)
    );

    if (top > 0 && !blockedInside?.top)
      placeMark(selected, target, 'top', formatDistance(top), false);
    if (bottom > 0 && !blockedInside?.bottom)
      placeMark(selected, target, 'bottom', formatDistance(bottom), false);
    if (left > 0 && !blockedInside?.left)
      placeMark(selected, target, 'left', formatDistance(left), false);
    if (right > 0 && !blockedInside?.right)
      placeMark(selected, target, 'right', formatDistance(right), false);
    return;
  }

  // 不重叠：交给 placeGapMarks 统一处理（支持「左右没相邻」等无投影重叠场景）
  placeGapMarks(selected, target);
}

/** 给定任意两个元素，若是父子关系，返回 [parent, child]，否则返回 null */
function asParentChild(
  a: HTMLElement,
  b: HTMLElement
): [HTMLElement, HTMLElement] | null {
  if (isDomAncestor(a, b)) return [a, b];
  if (isDomAncestor(b, a)) return [b, a];
  return null;
}

function cleanUp(): void {
  active = false;
  clearPlaceholderElement('selected');
  clearPlaceholderElement('target');

  delayedDismiss = false;

  selectedElement = null;
  targetElement = null;
  removeMarks();

  preventPageScroll(false);
}

function defaultCursorMovedCore() {
  setTargetElement().then(() => {
    if (selectedElement != null && targetElement != null) {
      removeMarks();
      placeMarksBetweenElements(selectedElement, targetElement);
    }
  });
}

function setSelectedElement(): void {
  if (hoveringElement && hoveringElement !== selectedElement) {
    selectedElement = hoveringElement;
    clearPlaceholderElement('selected');

    createPlaceholderElement('selected', selectedElement, `red`);
  }
}

function setTargetElement(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (
      active &&
      hoveringElement &&
      hoveringElement !== selectedElement &&
      hoveringElement !== targetElement
    ) {
      targetElement = hoveringElement;

      clearPlaceholderElement('target');

      createPlaceholderElement('target', targetElement, 'blue');
      resolve();
    }
  });
}

function preventPageScroll(active: boolean): void {
  if (active) {
    window.addEventListener('DOMMouseScroll', scrollingPreventDefault, false);
    window.addEventListener('wheel', scrollingPreventDefault, {
      passive: false,
    });
    window.addEventListener('mousewheel', scrollingPreventDefault, {
      passive: false,
    });
  } else {
    window.removeEventListener('DOMMouseScroll', scrollingPreventDefault);
    window.removeEventListener('wheel', scrollingPreventDefault);
    window.removeEventListener('mousewheel', scrollingPreventDefault);
  }
}

function scrollingPreventDefault(e: Event): void {
  e.preventDefault();
}

export default Spacing;
