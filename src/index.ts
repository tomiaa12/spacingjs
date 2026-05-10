import Spacing from './spacing';

// 两种交互同时可用，用 API 切换模式：
// - default：按住 Alt，红框锚点 + 蓝框悬停目标，实时测距
// - click-multi：悬停蓝框预览，左键点击固定；已固定元素成对测距；悬停未固定元素时临时显示与已固定元素的间距；Esc 清空固定
// Spacing.setMode('click-multi') / Spacing.setMode('default') / Spacing.toggleMode()
Spacing.start({ mode: 'default' });

export default Spacing