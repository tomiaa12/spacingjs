# @tomiaa/spacingjs

[![npm](https://img.shields.io/npm/v/@tomiaa/spacingjs.svg)](https://www.npmjs.com/package/@tomiaa/spacingjs)
[![License](https://img.shields.io/github/license/tomiaa12/spacingjs)](LICENSE)

在 [Steven Lei](https://github.com/stevenlei) 的 [spacingjs](https://github.com/stevenlei/spacingjs) 之上的 Fork。保留原有 **按住 Alt + 悬停** 的测距方式，并增加 **多点固定、纯尺寸标注、模式切换、悬停预览、智能连线** 等能力，适合需要连续标注多个区块间距与尺寸的场景。

- **仓库**：<https://github.com/tomiaa12/spacingjs>
- **上游**：<https://github.com/stevenlei/spacingjs>

---

## 相对上游新增的功能

| 能力                                | 说明                                                                                                                                                                                                                              |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **三种模式并存**                    | `default`：与原 spacingjs 一致，按住 Alt，红框锚点 + 蓝框目标，实时测距。`click-multi`：无需 Alt，点击固定多个元素并显示成对间距。`size-only`：交互同 `click-multi`，但 **只标元素自身的宽×高与标签，不画任何元素之间的距离**。   |
| **运行时切换**                      | `Spacing.setMode('default' \| 'click-multi' \| 'size-only')`、`Spacing.toggleMode()`（按 `default → click-multi → size-only` 循环）、`Spacing.getMode()`。                                                                        |
| **开启 / 关闭 / 清除**              | `Spacing.enable()` 开启响应（未 `start` 时会自动按当前 mode 启动）；`Spacing.disable()` 暂停响应并清空所有标注（事件依旧监听）；`Spacing.clear()` 仅清空当前标注，不影响开启状态；`Spacing.isEnabled()` 查询当前是否开启。           |
| **多点固定（click-multi / size-only）** | 左键点击元素加入/移出固定列表；悬停未固定元素时显示 **蓝色预览框**；`click-multi` 下与已固定元素之间的间距 **悬停时临时显示**，点击后才参与「固定」后的成对测距。                                                              |
| **Esc 清空**                        | 在 `click-multi` / `size-only` 下按 Esc 清空所有已固定项。                                                                                                                                                                        |
| **智能成对测距（multi）**           | 不再对任意两两元素全部连线：若存在 DOM 嵌套，只标注 **最近的已固定祖先 ↔ 子节点**；无嵌套关系时，与 **矩形距离最近且互不包含** 的已固定元素连线。悬停预览同样优先 **最近的已固定 DOM 祖先**，否则连 **矩形上最近** 的已固定元素。 |
| **任意位置关系的距离绘制**          | 修复上游在「左右/上下完全没有投影重叠」时不绘制 gap 的问题。两个分离矩形的水平间距 `dx` 与垂直间距 `dy` 都会画出，相交于 **rect1 距 rect2 最近的角点**。                                                                          |
| **相邻元素不再画无意义距离**        | 边缘紧贴（如 `a.bottom === b.top`）的两元素不再被判为相交，从而不会再画出「数值恰为元素自身宽高」的 inside top/bottom 距离。                                                                                                      |
| **父子配对智能屏蔽方向**            | 父子两个元素配对时，若某个 inside 方向上夹着另一个已固定的兄弟元素（且与子元素在另一轴有投影重叠），该方向的距离会被自动跳过，避免标线穿过其他兄弟元素的视觉误导。                                                                |
| **DevTools 设备模式兼容**           | 同时监听 `mousemove` 与 `pointermove`（以及 `mouseout` / `pointerout`），Chrome DevTools「Toggle device toolbar / 手机模拟」下也能正常悬停预览；rAF 去抖确保桌面环境下不会重复重绘。                                              |
| **滚动/resize 自动刷新**            | 固定与预览布局变化时自动刷新测距线（`requestAnimationFrame` 合并）。                                                                                                                                                              |

构建产物仍为 UMD 全局名 **`Spacing`**，与上游一致。

---

## 安装

```bash
npm install @tomiaa/spacingjs
# 或
pnpm add @tomiaa/spacingjs
```

### CDN

```html
<script
  src="https://unpkg.com/@tomiaa/spacingjs/dist/spacing.min.js"
  defer
></script>
```

---

## 使用

### 默认（Alt 悬停，与原项目一致）

```javascript
import Spacing from '@tomiaa/spacingjs';

Spacing.start({ mode: 'default' });
// 或使用 start() 不传参，默认即为 default
```

1. 鼠标移到第一个元素上
2. 按住 **Alt**（Mac：**Option**）
3. 再移到第二个元素上查看间距

### 多点固定模式（click-multi）

```javascript
Spacing.start({ mode: 'click-multi' });
```

- 悬停：蓝色预览框；若已有固定项，会临时显示与相关固定项的间距（规则见上表「智能成对测距」）。
- 左键点击：固定/取消该元素；固定项之间按智能规则显示间距。
- **Esc**：清空固定列表。

### 纯尺寸标注模式（size-only）

```javascript
Spacing.start({ mode: 'size-only' });
```

- 交互与 `click-multi` 一致（悬停预览、左键固定/取消、Esc 清空）。
- **不绘制任何元素之间的距离 marker**，只显示每个被固定/被悬停元素自身的彩色边框、`宽×高` 与标签。
- 适合「我只想批量看一组元素的尺寸」的场景。

### 模式切换（需在 `start()` 之后）

```javascript
Spacing.setMode('click-multi');
Spacing.setMode('default');
Spacing.setMode('size-only');
Spacing.toggleMode(); // default → click-multi → size-only → default ...
Spacing.getMode(); // 'default' | 'click-multi' | 'size-only'
```

- 在 `click-multi` 与 `size-only` 之间切换时 **保留已固定的元素**，仅清掉距离/预览后重绘，方便从「看间距」无缝切到「只看尺寸」。
- 切回 `default` 会清空多点固定。

### 开启 / 关闭 / 清除标注

适合做成扩展或调试面板上的「开启 / 关闭 / 清除」三个按钮。和 `start()` / `stop()` 的区别：`start/stop` 会真正挂载或卸载事件监听；`enable/disable` 只切换「是否响应」的开关，事件监听始终在；`clear` 仅清空当前已经画出来的标注，不影响开启状态。

```javascript
Spacing.enable();      // 开启标注（未 start 过会按 currentMode 自动 start）
Spacing.disable();     // 暂停标注：清空所有已绘制的内容，并停止响应交互
Spacing.clear();       // 清空当前所有标注（pinned / preview / selected / target / marks）
Spacing.isEnabled();   // boolean
```

典型搭配：

```javascript
// 进入页面时只挂监听，不立刻响应
Spacing.start({ mode: 'click-multi' });
Spacing.disable();

// 用户点击「开启」按钮
toggleBtn.onclick = () => {
  Spacing.isEnabled() ? Spacing.disable() : Spacing.enable();
};

// 用户点击「清除」按钮
clearBtn.onclick = () => Spacing.clear();
```

### 停止

```javascript
Spacing.stop();
```

`stop()` 会移除所有事件监听并把状态彻底重置，需要重新 `start()` 才能继续使用。如果只是临时暂停，请用 `disable()`。

---

## 从本仓库发布到 npm（维护者）

1. 在 npm 创建访问令牌，并在本仓库 **Settings → Secrets and variables → Actions** 中配置 **`NPM_TOKEN`**。
2. 更新 `package.json` 中的 `version`。
3. 在 GitHub 上 **创建 Release**，或打开 Actions 手动运行 **Publish to NPM**。
4. Workflow 会执行 `npm ci`、`npm run build`，然后在仓库根目录执行 `npm publish --access public`（作用域包需公开访问时加 `--access public`，已在 workflow 中写出）。

---

## 本地构建

```bash
npm ci
npm run build
```

开发产物：`dist/spacing.js`；生产：`dist/spacing.min.js`（`package.json` 的 `main` 指向 min 版本）。

---

## License

MIT（与上游 [spacingjs](https://github.com/stevenlei/spacingjs) 一致）。
