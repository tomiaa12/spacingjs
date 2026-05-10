import { PlaceholderType } from './type';

export function createPlaceholderElement(
  type: PlaceholderType,
  dom: HTMLElement,
  color: string
): void {
  let { width, height, top, left } = dom.getBoundingClientRect();
  let computedStyle = window.getComputedStyle(dom);
  let fontSize = computedStyle.fontSize;

  let placeholder: HTMLDivElement = document.createElement('div');
  placeholder.classList.add(`spacing-js-${type}-placeholder`);
  placeholder.classList.add('spacing-js-placeholder'); // Add general class for easier targeting

  // Enhanced visual styling
  placeholder.style.border = `2px solid ${color}`;
  placeholder.style.position = 'fixed';
  placeholder.style.background = `${color}08`; // Semi-transparent background
  placeholder.style.borderRadius = '3px';
  placeholder.style.padding = '0';
  placeholder.style.margin = '0';
  placeholder.style.width = `${width - 2}px`;
  placeholder.style.height = `${height - 2}px`;
  placeholder.style.top = `${top - 1}px`;
  placeholder.style.left = `${left - 1}px`;
  placeholder.style.pointerEvents = 'none';
  placeholder.style.zIndex = '9999';
  placeholder.style.boxSizing = 'content-box';

  document.body.appendChild(placeholder);

  let dimension: HTMLSpanElement = document.createElement('span');
  dimension.style.background = color;
  dimension.style.position = 'fixed';
  dimension.style.display = 'inline-block';
  dimension.style.color = '#fff';
  dimension.style.padding = '3px 6px';
  dimension.style.fontSize = '11px';
  dimension.style.fontFamily = 'system-ui, -apple-system, sans-serif';
  dimension.style.fontWeight = '500';
  dimension.style.lineHeight = '1.2';
  dimension.style.whiteSpace = 'nowrap';
  dimension.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';

  let arrow = '';
  let topOffset = top;

  if (top < 25) {
    if (top < 0) {
      topOffset = 0;
      arrow = '↑ '; // Top-Left corner is offscreen
    }
    dimension.style.borderRadius = '3px 0 3px 0';
  } else {
    dimension.style.transform = 'translateY(calc(-100% + 2px))';
    dimension.style.borderRadius = '3px 3px 0 0';
  }

  dimension.style.top = `${topOffset - 1}px`;
  dimension.style.left = `${left - 1}px`;
  dimension.style.zIndex = '10001';
  dimension.style.pointerEvents = 'none';

  // Enhanced dimension text with more information
  const elementTag = dom.tagName.toLowerCase();

  // Safely handle className - it might be a string or SVGAnimatedString
  let elementClass = '';
  try {
    if (
      dom.className &&
      typeof dom.className === 'string' &&
      dom.className.trim()
    ) {
      elementClass = `.${dom.className.split(' ')[0]}`;
    } else if (dom.className && typeof dom.className === 'object') {
      // Handle SVG elements where className is an SVGAnimatedString
      const classNameObj = dom.className as any;
      if (classNameObj.baseVal && typeof classNameObj.baseVal === 'string') {
        elementClass = `.${classNameObj.baseVal.split(' ')[0]}`;
      }
    }
  } catch (error) {
    // Fallback: just use the tag name if className handling fails
    elementClass = '';
  }

  const elementInfo = `${elementTag}${elementClass}`;

  dimension.innerText = `${arrow}${Math.round(width)}×${Math.round(
    height
  )}px ${elementInfo}${fontSize ? ` (${fontSize})` : ''}`;
  placeholder.appendChild(dimension);
}

export function clearPlaceholderElement(type: PlaceholderType): void {
  if (type === 'pinned') {
    document
      .querySelectorAll('.spacing-js-pinned-placeholder')
      .forEach((node) => node.remove());
    return;
  }
  document.querySelector(`.spacing-js-${type}-placeholder`)?.remove();
}
