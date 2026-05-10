export type SpacingMode = 'default' | 'click-multi';

export type SpacingStartOptions = {
  /** 启动时的模式；可随时用 `setMode` / `toggleMode` 切换 */
  mode?: SpacingMode;
};

export type Spacing = {
  start: (options?: SpacingStartOptions) => void;
  stop: () => void;
  setMode: (mode: SpacingMode) => void;
  getMode: () => SpacingMode;
  toggleMode: () => SpacingMode;
};

export type LineBorder = 'none' | 'x' | 'y';
export type Direction = 'top' | 'right' | 'bottom' | 'left';
export type PlaceholderType = 'selected' | 'target' | 'pinned' | 'preview';
