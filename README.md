# @tomiaa/spacingjs

[![npm](https://img.shields.io/npm/v/@tomiaa/spacingjs.svg)](https://www.npmjs.com/package/@tomiaa/spacingjs)
[![License](https://img.shields.io/github/license/tomiaa12/spacingjs)](LICENSE)

在 [Steven Lei](https://github.com/stevenlei) 的 [spacingjs](https://github.com/stevenlei/spacingjs) 之上的 Fork。保留原有 **按住 Alt + 悬停** 的测距方式，并增加 **多点固定、模式切换、悬停预览与智能连线**，适合需要连续标注多个区块间距的场景。

- **仓库**：<https://github.com/tomiaa12/spacingjs>
- **上游**：<https://github.com/stevenlei/spacingjs>

---

## 相对上游新增的功能

| 能力                        | 说明                                                                                                                                                                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **双模式并存**              | `default`：与原 spacingjs 一致，按住 Alt，红框锚点 + 蓝框目标，实时测距。`click-multi`：无需 Alt，通过点击固定多个元素。                                                                                                          |
| **运行时切换**              | `Spacing.setMode('default' \| 'click-multi')`、`Spacing.toggleMode()`、`Spacing.getMode()`。                                                                                                                                      |
| **多点固定（click-multi）** | 左键点击元素加入/移出固定列表；悬停未固定元素时显示 **蓝色预览框**；与已固定元素之间的间距 **悬停时临时显示**，点击后才参与「固定」后的成对测距。                                                                                 |
| **Esc 清空**                | 在 `click-multi` 下按 Esc 清空所有已固定项。                                                                                                                                                                                      |
| **智能成对测距（multi）**   | 不再对任意两两元素全部连线：若存在 DOM 嵌套，只标注 **最近的已固定祖先 ↔ 子节点**；无嵌套关系时，与 **矩形距离最近且互不包含** 的已固定元素连线。悬停预览同样优先 **最近的已固定 DOM 祖先**，否则连 **矩形上最近** 的已固定元素。 |
| **滚动/resize**             | 固定与预览布局变化时自动刷新测距线（`requestAnimationFrame` 合并）。                                                                                                                                                              |

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

### 多点固定模式

```javascript
Spacing.start({ mode: 'click-multi' });
```

- 悬停：蓝色预览框；若已有固定项，会临时显示与相关固定项的间距（规则见上表「智能成对测距」）。
- 左键点击：固定/取消该元素；固定项之间按智能规则显示间距。
- **Esc**：清空固定列表。

### 模式切换（需在 `start()` 之后）

```javascript
Spacing.setMode('click-multi');
Spacing.setMode('default');
Spacing.toggleMode();
Spacing.getMode(); // 'default' | 'click-multi'
```

切换模式时会清理另一模式留下的测距状态（例如切回 `default` 会清空多点固定）。

### 停止

```javascript
Spacing.stop();
```

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
