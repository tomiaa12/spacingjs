export type SpacingMode = 'default' | 'click-multi' | 'size-only';

export type SpacingStartOptions = {
  /** 启动时的模式；可随时用 `setMode` / `toggleMode` 切换 */
  mode?: SpacingMode;
};

export type Spacing = {
  start: (options?: SpacingStartOptions) => void;
  stop: () => void;
  /**
   * 开启标注响应。
   * - 若尚未 `start`，会按当前 `mode` 自动 `start`。
   * - 若已 `disable`，恢复对鼠标/键盘的响应（事件监听早已挂载，无需重新 start）。
   */
  enable: () => void;
  /**
   * 暂停标注响应：清空所有已绘制的标注，事件依旧监听但不再响应交互；
   * 后续 `enable()` 即可恢复，不需要重新 `start()`。
   */
  disable: () => void;
  /**
   * 清空当前所有标注（pinned / preview / selected / target / marks），
   * 不影响开启状态，可以继续标注。
   */
  clear: () => void;
  /** 是否处于开启状态（既已 `start` 又未 `disable`） */
  isEnabled: () => boolean;
  setMode: (mode: SpacingMode) => void;
  getMode: () => SpacingMode;
  toggleMode: () => SpacingMode;
};

export type LineBorder = 'none' | 'x' | 'y';
export type Direction = 'top' | 'right' | 'bottom' | 'left';
export type PlaceholderType = 'selected' | 'target' | 'pinned' | 'preview';
