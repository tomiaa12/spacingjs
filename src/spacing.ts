import Rect from './rect';
import {
  clearPlaceholderElement,
  createPlaceholderElement,
} from './placeholder';
import { placeMark, removeMarks } from './marker';

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
let clickMultiRedrawRaf: number | null = null;

let started: boolean = false;

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
    window.addEventListener('mouseout', unifiedMouseOut);
    window.addEventListener('click', clickMultiHandler, true);
    document.addEventListener('scroll', pinnedScrollOrResizeHandler, true);
    window.addEventListener('resize', pinnedScrollOrResizeHandler);
  },

  stop() {
    if (!started) return;

    window.removeEventListener('keydown', unifiedKeyDown);
    window.removeEventListener('keyup', unifiedKeyUp);
    window.removeEventListener('mousemove', unifiedMouseMove);
    window.removeEventListener('mouseout', unifiedMouseOut);
    window.removeEventListener('click', clickMultiHandler, true);
    document.removeEventListener('scroll', pinnedScrollOrResizeHandler, true);
    window.removeEventListener('resize', pinnedScrollOrResizeHandler);

    if (pinnedRefreshRaf != null) {
      cancelAnimationFrame(pinnedRefreshRaf);
      pinnedRefreshRaf = null;
    }
    if (clickMultiRedrawRaf != null) {
      cancelAnimationFrame(clickMultiRedrawRaf);
      clickMultiRedrawRaf = null;
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

    if (delayedRef) {
      clearTimeout(delayedRef);
      delayedRef = null;
    }
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
    const next: SpacingMode =
      currentMode === 'default' ? 'click-multi' : 'default';
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

  if (next === 'default') {
    cleanUpPinned();
    clearPlaceholderElement('preview');
    hoveringElement = null;
  } else {
    cleanUp();
    clearPlaceholderElement('preview');
    hoveringElement = null;
  }

  currentMode = next;
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

function clickMultiHandler(e: MouseEvent) {
  if (currentMode !== 'click-multi') return;
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
  redrawClickMultiUi();
}

function unifiedKeyDown(e: KeyboardEvent) {
  if (currentMode === 'click-multi' && e.key === 'Escape') {
    pinnedElements = [];
    clearPlaceholderElement('preview');
    redrawClickMultiUi();
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
  const el = elementFromEvent(e);

  if (!el || isSpacingChrome(el)) {
    if (currentMode === 'click-multi') {
      hoveringElement = null;
      scheduleClickMultiRedraw();
    }
    return;
  }

  hoveringElement = el;

  if (currentMode === 'default' && active) {
    defaultCursorMovedCore();
  }
  if (currentMode === 'click-multi') {
    scheduleClickMultiRedraw();
  }
}

function unifiedMouseOut(e: MouseEvent) {
  const to = e.relatedTarget as HTMLElement;

  if (currentMode === 'default') {
    if (!isAltKeyDown && (!to || to.nodeName === 'HTML')) {
      hoveringElement = null;
      cleanUp();
    }
  }

  if (currentMode === 'click-multi') {
    if (!to || to.nodeName === 'HTML') {
      hoveringElement = null;
      scheduleClickMultiRedraw();
    }
  }
}

function scheduleClickMultiRedraw() {
  if (currentMode !== 'click-multi') return;
  if (clickMultiRedrawRaf != null) return;
  clickMultiRedrawRaf = requestAnimationFrame(() => {
    clickMultiRedrawRaf = null;
    redrawClickMultiUi();
  });
}

function pinnedScrollOrResizeHandler() {
  if (currentMode !== 'click-multi') return;
  if (pinnedElements.length === 0 && !hoveringElement) return;

  if (pinnedRefreshRaf != null) cancelAnimationFrame(pinnedRefreshRaf);
  pinnedRefreshRaf = requestAnimationFrame(() => {
    pinnedRefreshRaf = null;
    redrawClickMultiUi();
  });
}

function cleanUpPinned() {
  pinnedElements = [];
  clearPlaceholderElement('pinned');
  clearPlaceholderElement('preview');
  removeMarks();
}

function redrawClickMultiUi() {
  if (currentMode !== 'click-multi') return;

  clearPlaceholderElement('pinned');
  clearPlaceholderElement('preview');
  removeMarks();

  pinnedElements.forEach((el, i) => {
    const color = PIN_COLORS[i % PIN_COLORS.length];
    createPlaceholderElement('pinned', el, color);
  });

  for (const [a, b] of computePinnedSpacingPairs(pinnedElements)) {
    placeMarksBetweenElements(a, b);
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
      for (const t of hoverSpacingTargets(hover, pinnedElements)) {
        placeMarksBetweenElements(hover, t);
      }
    }
  }
}

function formatDistance(pixels: number): string {
  if (pixels === 0) return '0px';
  if (pixels < 1) return '<1px';
  return `${pixels}px`;
}

function placeMarksBetweenElements(a: HTMLElement, b: HTMLElement): void {
  const selectedElementRect = a.getBoundingClientRect();
  const targetElementRect = b.getBoundingClientRect();

  const selected: Rect = new Rect(selectedElementRect);
  const target: Rect = new Rect(targetElementRect);

  let top: number;
  let bottom: number;
  let left: number;
  let right: number;
  let outside: boolean;

  if (
    selected.containing(target) ||
    selected.inside(target) ||
    selected.colliding(target)
  ) {
    top = Math.round(Math.abs(selectedElementRect.top - targetElementRect.top));
    bottom = Math.round(
      Math.abs(selectedElementRect.bottom - targetElementRect.bottom)
    );
    left = Math.round(
      Math.abs(selectedElementRect.left - targetElementRect.left)
    );
    right = Math.round(
      Math.abs(selectedElementRect.right - targetElementRect.right)
    );
    outside = false;
  } else {
    top = Math.round(
      Math.abs(selectedElementRect.top - targetElementRect.bottom)
    );
    bottom = Math.round(
      Math.abs(selectedElementRect.bottom - targetElementRect.top)
    );
    left = Math.round(
      Math.abs(selectedElementRect.left - targetElementRect.right)
    );
    right = Math.round(
      Math.abs(selectedElementRect.right - targetElementRect.left)
    );
    outside = true;
  }

  if (top > 0) {
    placeMark(selected, target, 'top', formatDistance(top), outside);
  }
  if (bottom > 0) {
    placeMark(selected, target, 'bottom', formatDistance(bottom), outside);
  }
  if (left > 0) {
    placeMark(selected, target, 'left', formatDistance(left), outside);
  }
  if (right > 0) {
    placeMark(selected, target, 'right', formatDistance(right), outside);
  }
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
