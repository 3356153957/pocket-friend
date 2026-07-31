# Pocket Friend 全流程视觉精修实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在不改变 Pocket Friend 业务流程和数据接口的前提下，统一精修欢迎、问卷、画像、挂坠、到场、MAP、PALS、SET 的像素掌机视觉、状态反馈、可访问性和响应式表现。

**架构：** 先扩展现有 `PixelUi.tsx` 和 `styles.css`，建立统一的视觉变量、页面标题、状态面板和组件状态，再让各页面只组合这些展示组件并继续使用原有业务状态与回调。复杂业务模块不重构；视觉契约由 React Testing Library 组件测试和现有源码契约测试保护，最后运行全量测试、类型检查和 Sites 构建。

**技术栈：** React 19、TypeScript 5.8、Vite 8、Tailwind CSS 4、Vitest、Testing Library、Node.js 测试运行器

**设计规格：** `docs/superpowers/specs/2026-07-31-pocket-friend-visual-refinement-design.md`

---

## 文件结构与职责

### 创建

- `apps/mobile/test/PixelUi.test.tsx`：验证通用按钮、页面标题和状态面板的语义与状态。
- `apps/mobile/test/PendantSetup.test.tsx`：验证挂坠选择、震动反馈和继续条件。
- `apps/mobile/test/AppShell.test.tsx`：验证主导航当前状态与三个固定入口。
- `apps/mobile/public/og.png`：用于站点链接分享的专属横版社交预览图。

### 修改

- `apps/mobile/src/styles.css`：集中维护视觉变量、三级表面、边框阴影、动效、表单、状态、响应式和减少动态效果规则。
- `apps/mobile/src/components/PixelUi.tsx`：提供按钮加载状态、页面标题和状态面板等通用展示组件。
- `apps/mobile/src/components/Welcome.tsx`：重组欢迎、资料录入和保存状态层级。
- `apps/mobile/src/components/Quiz.tsx`：重组问卷进度、选择状态和画像结果层级。
- `apps/mobile/src/components/PendantSetup.tsx`：统一设备示意、震动状态和偏好控件。
- `apps/mobile/src/components/Arrival.tsx`：统一照片等待、生成、进入、成功和异常状态。
- `apps/mobile/src/components/AppShell.tsx`：精修掌机框架、内容安全区和底部功能键导航。
- `apps/mobile/src/components/MatchingMap.tsx`：突出地图主体并整理定位、选择和附近状态。
- `apps/mobile/src/components/HomeWorld.tsx`：整理个人档案、场景和好友信息层级。
- `apps/mobile/src/components/Settings.tsx`：按个人资料、体验偏好、设备与隐私重组设置。
- `apps/mobile/index.html`：增加与生产站点一致的 Open Graph 和 X 分享元数据。
- `apps/mobile/test/Welcome.test.tsx`：补充欢迎页语义、保存状态和字段层级测试。
- `apps/mobile/test/Quiz.test.tsx`：补充进度、选择语义和画像结果测试。
- `apps/mobile/test/frontendContract.test.ts`：保护全流程统一组件、视觉变量、响应式和减少动态效果契约。

## 实施约束

- 每个任务开始前运行 `git status --short --branch`，不得覆盖 `.qoder/` 或其他既有未跟踪内容。
- 每个任务严格执行红—绿 TDD：先写测试并看到目标失败，再写最少实现。
- 只修改展示层和文案层级；现有问卷计算、地图、匹配、照片、账号、设备和后端调用接口不变。
- 每完成一个任务立即提交；同步远端前按项目协作规则执行 fetch/rebase，禁止强制推送。

### 任务 1：建立统一视觉变量和基础展示组件

**文件：**
- 创建：`apps/mobile/test/PixelUi.test.tsx`
- 修改：`apps/mobile/src/components/PixelUi.tsx:1-82`
- 修改：`apps/mobile/src/styles.css:1-463`

- [ ] **步骤 1：编写失败的基础组件测试**

在 `apps/mobile/test/PixelUi.test.tsx` 创建以下测试：

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import {
  PageHeader,
  PixelButton,
  StatusPanel,
} from "../src/components/PixelUi.tsx";

afterEach(cleanup);

describe("Pixel UI primitives", () => {
  test("announces a loading button and prevents duplicate actions", () => {
    render(<PixelButton loading loadingLabel="正在保存">保存资料</PixelButton>);

    const button = screen.getByRole("button", { name: "正在保存" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
  });

  test("renders a page heading with supporting context", () => {
    render(
      <PageHeader
        eyebrow="01 / 关于你"
        title={<>遇见画像<span>问卷</span></>}
        description="回答五个问题，生成你的岛民磁场。"
      />,
    );

    screen.getByRole("heading", { name: "遇见画像问卷" });
    screen.getByText("回答五个问题，生成你的岛民磁场。");
  });

  test("uses alert semantics only for warning panels", () => {
    const { rerender } = render(
      <StatusPanel tone="info" title="正在定位">请允许浏览器读取位置。</StatusPanel>,
    );
    expect(screen.queryByRole("status")).not.toBeNull();

    rerender(
      <StatusPanel tone="warning" title="定位失败">可以改用演示位置。</StatusPanel>,
    );
    expect(screen.queryByRole("alert")).not.toBeNull();
  });
});
```

- [ ] **步骤 2：运行测试并确认失败**

运行：

```powershell
npm run test:ui -- -- test/PixelUi.test.tsx
```

预期：FAIL，TypeScript 或模块导出报告 `PageHeader`、`StatusPanel`、`loading` 尚未定义。

- [ ] **步骤 3：扩展 `PixelUi.tsx` 的明确接口**

在 `PixelUi.tsx` 中增加以下接口与实现；保留 `AppLogo`、`PixelCard`、`PixelLabel`、`StepPips` 的现有导出：

```tsx
type StatusTone = "info" | "success" | "warning" | "neutral";

export function PixelButton({
  children,
  onClick,
  variant = "cyan",
  fullWidth = false,
  disabled = false,
  loading = false,
  loadingLabel = "处理中",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "cyan" | "pink" | "lime" | "ghost";
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      onClick={onClick}
      className={`pixel-button ${colorClasses[variant]} ${fullWidth ? "w-full" : ""}`}
    >
      {loading ? loadingLabel : children}
    </button>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="min-w-0">
        <p className="page-eyebrow">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function StatusPanel({
  tone = "neutral",
  title,
  children,
  action,
}: {
  tone?: StatusTone;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section
      className={`status-panel status-panel-${tone}`}
      role={tone === "warning" ? "alert" : "status"}
    >
      <div>
        <h2>{title}</h2>
        <div className="status-panel-copy">{children}</div>
      </div>
      {action && <div className="status-panel-action">{action}</div>}
    </section>
  );
}
```

- [ ] **步骤 4：在 `styles.css` 建立视觉变量和通用样式**

在现有 `:root` 中补充以下变量，并添加对应类；保留现有品牌颜色：

```css
:root {
  --surface-base: var(--background);
  --surface-raised: var(--card);
  --surface-soft: color-mix(in oklab, var(--mint) 70%, var(--card));
  --ink-muted: color-mix(in oklab, var(--ink) 66%, transparent);
  --shadow-major: 4px 4px 0 var(--ink);
  --shadow-minor: 2px 2px 0 var(--ink);
  --motion-fast: 140ms;
  --motion-normal: 220ms;
  --ease-pixel: cubic-bezier(0.2, 0.8, 0.2, 1);
}

.page-stack {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px 16px;
  animation: screen-enter var(--motion-normal) var(--ease-pixel);
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.page-eyebrow {
  margin: 0;
  color: var(--pink);
  font-family: "Press Start 2P", ui-monospace, monospace;
  font-size: 8px;
}

.page-title {
  margin: 12px 0 0;
  color: var(--ink);
  font-family: "Press Start 2P", ui-monospace, monospace;
  font-size: 14px;
  line-height: 1.75;
}

.page-title span {
  color: var(--pink);
}

.page-description,
.status-panel-copy {
  margin: 8px 0 0;
  color: var(--ink-muted);
  font-family: "VT323", ui-monospace, monospace;
  font-size: 16px;
  line-height: 1.35;
}

.status-panel {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  border: 2px solid var(--ink);
  background: var(--surface-raised);
  padding: 12px;
  box-shadow: var(--shadow-minor);
}

.status-panel h2 {
  margin: 0;
  font-family: "Press Start 2P", ui-monospace, monospace;
  font-size: 8px;
  line-height: 1.5;
}

.status-panel-info { border-left: 6px solid var(--cyan); }
.status-panel-success { border-left: 6px solid var(--lime); }
.status-panel-warning { border-left: 6px solid var(--pink); }

@keyframes screen-enter {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
```

- [ ] **步骤 5：运行基础组件测试**

运行：

```powershell
npm run test:ui -- -- test/PixelUi.test.tsx
```

预期：PASS，3 个测试通过。

- [ ] **步骤 6：提交任务 1**

```powershell
git add apps/mobile/src/components/PixelUi.tsx apps/mobile/src/styles.css apps/mobile/test/PixelUi.test.tsx
git commit -m "feat(ui): add visual system primitives"
```

### 任务 2：精修欢迎与资料录入层级

**文件：**
- 修改：`apps/mobile/test/Welcome.test.tsx:1-34`
- 修改：`apps/mobile/src/components/Welcome.tsx:1-129`
- 修改：`apps/mobile/src/styles.css`

- [ ] **步骤 1：补充失败的欢迎页测试**

向 `Welcome.test.tsx` 增加：

```tsx
test("exposes the welcome story and loading state accessibly", async () => {
  let resolveStart: (() => void) | undefined;
  const onStart = vi.fn(() => new Promise<void>((resolve) => {
    resolveStart = resolve;
  }));
  const { container } = render(<Welcome onStart={onStart} />);

  screen.getByText("发现信号");
  screen.getByRole("heading", { name: "建立你的口袋档案" });
  fireEvent.submit(container.querySelector("form")!);

  const saving = screen.getByRole("button", { name: "正在保存" });
  expect((saving as HTMLButtonElement).disabled).toBe(true);
  expect(saving.getAttribute("aria-busy")).toBe("true");

  resolveStart?.();
  await screen.findByRole("button", { name: /开始体验/ });
});
```

- [ ] **步骤 2：运行测试并确认失败**

运行：

```powershell
npm run test:ui -- -- test/Welcome.test.tsx
```

预期：FAIL，找不到“发现信号”和“建立你的口袋档案”，按钮尚未使用通用加载状态。

- [ ] **步骤 3：重组欢迎页结构**

将外层表单改用 `.welcome-screen`，滚动内容改用 `.welcome-scroll page-stack`。在原有资料卡之前依次插入以下两个完整片段：

```tsx
<PageHeader
  eyebrow="发现信号"
  title={<>建立你的<span>口袋档案</span></>}
  description="留下简单资料，随后生成你的遇见画像。"
/>

<div className="welcome-hero" aria-label="口袋朋友像素挂坠">
  <div className="welcome-signal" />
  <div className="welcome-device animate-float">
    <AppLogo size={58} />
  </div>
</div>
```

将原资料卡顶部替换为以下标题块，并把现有五个受控字段原样移动到标题块之后：

```tsx
<div className="section-heading">
  <UserRound size={17} aria-hidden="true" />
  <div>
    <h2>演示账号登录</h2>
    <p>资料会保存到产品服务中。</p>
  </div>
</div>
```

将底部主按钮替换为以下完整调用；现有“使用演示账号”按钮紧随其后且回调不变：

```tsx
<PixelButton
  type="submit"
  disabled={!canStart}
  loading={saving}
  loadingLabel="正在保存"
  variant="pink"
  fullWidth
>
  <Play size={16} fill="currentColor" /> 开始体验
</PixelButton>
```

最终容器关系必须保持“`form.welcome-screen` → `div.welcome-scroll.page-stack` 与 `div.sticky-action-bar`”两层并列；页面标题、挂坠和资料卡放入滚动容器，主按钮和演示账号按钮放入底部操作容器。

所有字段统一使用 `.form-field`、`.form-label` 和 `.form-control`，为密码、昵称等现有输入保留当前 `autoComplete` 和占位文案。

- [ ] **步骤 4：增加欢迎页与表单样式**

在 `styles.css` 增加：

```css
.welcome-screen {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: var(--mint);
}

.welcome-scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
}

.welcome-hero {
  position: relative;
  display: grid;
  min-height: 168px;
  place-items: center;
  overflow: hidden;
}

.welcome-device {
  position: relative;
  display: grid;
  width: 92px;
  height: 92px;
  place-items: center;
  border: 3px solid var(--ink);
  background: var(--pink);
  box-shadow: var(--shadow-major);
}

.form-field { display: block; }
.form-field + .form-field { margin-top: 12px; }
.form-label {
  display: block;
  margin-bottom: 6px;
  font-family: "Press Start 2P", ui-monospace, monospace;
  font-size: 8px;
}
.form-control {
  width: 100%;
  min-height: 44px;
  border: 2px solid var(--ink);
  background: var(--surface-soft);
  padding: 9px 12px;
  color: var(--ink);
  outline: none;
}
.form-control:focus-visible {
  box-shadow: 0 0 0 3px var(--pink);
}
```

- [ ] **步骤 5：运行欢迎页测试**

运行：

```powershell
npm run test:ui -- -- test/Welcome.test.tsx
```

预期：PASS，3 个测试通过。

- [ ] **步骤 6：提交任务 2**

```powershell
git add apps/mobile/src/components/Welcome.tsx apps/mobile/src/styles.css apps/mobile/test/Welcome.test.tsx
git commit -m "feat(ui): refine welcome profile flow"
```

### 任务 3：精修问卷与画像结果

**文件：**
- 修改：`apps/mobile/test/Quiz.test.tsx:1-54`
- 修改：`apps/mobile/src/components/Quiz.tsx:1-220`
- 修改：`apps/mobile/src/styles.css`

- [ ] **步骤 1：补充失败的进度与选择语义测试**

向 `Quiz.test.tsx` 增加：

```tsx
test("announces progress and marks selected answers without color alone", () => {
  const { view } = renderQuiz();

  screen.getByText("已回答 0 / 5");
  const firstQuestion = view.container.querySelector("fieldset")!;
  const firstOption = firstQuestion.querySelector("button")!;
  fireEvent.click(firstOption);

  expect(firstOption.getAttribute("aria-pressed")).toBe("true");
  expect(firstOption.querySelector("[aria-hidden='true']")).toHaveTextContent("[x]");
  screen.getByText("已回答 1 / 5");
});

test("presents the generated profile in a stable reading order", () => {
  const { view } = renderQuiz();
  answerEveryQuestion(view.container);
  fireEvent.click(screen.getByRole("button", { name: /生成遇见画像/ }));

  const result = screen.getByTestId("encounter-profile");
  expect(result.querySelector("h1")).toBeTruthy();
  expect(result.textContent).toContain("初遇方式");
  expect(result.textContent).toContain("捕捉边界");
  expect(result.textContent).toContain("推荐场景");
});
```

- [ ] **步骤 2：运行测试并确认失败**

运行：

```powershell
npm run test:ui -- -- test/Quiz.test.tsx
```

预期：FAIL，未找到精简进度文案、选中符号节点或 `encounter-profile` 测试标识。

- [ ] **步骤 3：使用通用标题和状态结构重组问卷**

问卷顶部使用：

```tsx
<PageHeader
  eyebrow="01 / 关于你"
  title={<>遇见画像<span>问卷</span></>}
  description="回答五个问题，生成你的岛民磁场。"
  actions={<StepPips active={1} total={2} />}
/>
```

每个选项内容使用以下明确状态：

```tsx
<button
  type="button"
  aria-pressed={active}
  onClick={() => selectAnswer(question.id, option.key)}
  className={`pixel-choice ${active ? "is-selected" : ""}`}
>
  <span className="pixel-choice-state" aria-hidden="true">
    {active ? "[x]" : "[ ]"}
  </span>
  <span className="pixel-choice-index">
    {({ A: "一", B: "二", C: "三", D: "四" } as const)[option.key]}
  </span>
  <span className="pixel-choice-copy">{option.label}</span>
</button>
```

进度改为：

```tsx
<StatusPanel tone={complete ? "success" : "info"} title={`已回答 ${answeredCount} / ${quizQuestions.length}`}>
  {complete ? "画像已准备好，可以生成结果。" : "完成全部问题后即可生成遇见画像。"}
</StatusPanel>
```

- [ ] **步骤 4：重组画像结果结构**

画像结果根节点加 `data-testid="encounter-profile"`，并按下列顺序渲染：

```tsx
<section className="page-stack" data-testid="encounter-profile">
  <PageHeader
    eyebrow="01 / 遇见画像"
    title={<>你的岛民<span>磁场</span></>}
    description="这是系统根据你的选择生成的初遇档案。"
    actions={
      <button
        type="button"
        onClick={() => setEditing((current) => !current)}
        className="pixel-icon-button"
        aria-pressed={editing}
        aria-label="调整画像"
      >
        <SlidersHorizontal size={16} />
      </button>
    }
  />
  <PixelCard color="mint" className="profile-result">
    <h1 className="profile-archetype">{profile.archetype}</h1>
    <p className="profile-summary">{profile.displayText}</p>
    <ProfileLine label="初遇方式" value={profile.firstMeetStyle} />
    <ProfileLine label="相遇偏好" value={profile.encounterPreference} />
    <ProfileLine label="捕捉边界" value={profile.privacyMode} />
    <div>
      <PixelLabel>推荐场景</PixelLabel>
      <div className="mt-2 flex flex-wrap gap-2">
        {profile.sceneTags.map((tag) => (
          <button
            type="button"
            key={tag}
            onClick={() => editing && removeTag(tag)}
            className="pixel-tag bg-cyan"
            aria-label={editing ? `移除 ${tag}` : tag}
          >
            #{tag}{editing && profile.sceneTags.length > 3 ? " x" : ""}
          </button>
        ))}
      </div>
    </div>
  </PixelCard>
</section>
```

现有编辑面板和“确认，设置挂坠”按钮按当前顺序直接放在 `PixelCard` 之后、`section` 结束标签之前，回调保持不变。

- [ ] **步骤 5：补充问卷与画像样式**

```css
.pixel-choice {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 10px;
  min-height: 82px;
  background: var(--surface-raised);
}
.pixel-choice.is-selected {
  background: var(--pink);
  transform: translate(1px, 1px);
  box-shadow: 2px 2px 0 var(--ink);
}
.pixel-choice-state,
.pixel-choice-index {
  font-family: "Press Start 2P", ui-monospace, monospace;
  font-size: 8px;
}
.pixel-choice-copy {
  grid-column: 1 / -1;
  color: color-mix(in oklab, var(--ink) 78%, transparent);
  font-size: 16px;
  line-height: 1.35;
}
.profile-result { display: grid; gap: 12px; }
.profile-archetype {
  margin: 0;
  font-family: "Press Start 2P", ui-monospace, monospace;
  font-size: 12px;
  line-height: 1.8;
}
```

- [ ] **步骤 6：运行问卷测试**

运行：

```powershell
npm run test:ui -- -- test/Quiz.test.tsx
```

预期：PASS，4 个测试通过。

- [ ] **步骤 7：提交任务 3**

```powershell
git add apps/mobile/src/components/Quiz.tsx apps/mobile/src/styles.css apps/mobile/test/Quiz.test.tsx
git commit -m "feat(ui): refine quiz and profile result"
```

### 任务 4：统一挂坠设置与到场状态

**文件：**
- 创建：`apps/mobile/test/PendantSetup.test.tsx`
- 修改：`apps/mobile/src/components/PendantSetup.tsx:1-81`
- 修改：`apps/mobile/src/components/Arrival.tsx:1-294`
- 修改：`apps/mobile/test/frontendContract.test.ts`
- 修改：`apps/mobile/src/styles.css`

- [ ] **步骤 1：编写失败的挂坠组件测试**

创建 `PendantSetup.test.tsx`：

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { createInitialPrefs, type Prefs } from "../src/app/appFlow.ts";
import PendantSetup from "../src/components/PendantSetup.tsx";

afterEach(cleanup);

describe("PendantSetup", () => {
  test("marks the selected buzz pattern and keeps the main action explicit", () => {
    let prefs: Prefs = createInitialPrefs();
    const setPrefs = vi.fn((next: Prefs) => {
      prefs = next;
    });
    const { rerender } = render(
      <PendantSetup prefs={prefs} setPrefs={setPrefs} onNext={vi.fn()} onBack={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /轻轻敲门/ }));
    rerender(
      <PendantSetup prefs={prefs} setPrefs={setPrefs} onNext={vi.fn()} onBack={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: /轻轻敲门/ }).getAttribute("aria-pressed")).toBe("true");
    screen.getByRole("button", { name: /进入口袋朋友/ });
    screen.getByRole("status");
  });
});
```

- [ ] **步骤 2：向源码契约测试增加到场状态要求**

在 `frontendContract.test.ts` 增加：

```ts
test("uses the shared status panel for arrival progress and warnings", async () => {
  const arrival = await read("src/components/Arrival.tsx");

  assert.match(arrival, /StatusPanel/);
  assert.match(arrival, /tone=\{warning \? "warning" : "info"\}/);
  assert.match(arrival, /正在获取照片/);
  assert.match(arrival, /正在生成像素形象/);
});
```

- [ ] **步骤 3：运行测试并确认失败**

运行：

```powershell
npm run test:ui -- -- test/PendantSetup.test.tsx
node --experimental-strip-types --test apps/mobile/test/frontendContract.test.ts
```

预期：FAIL，挂坠页面没有统一 `status` 区域，到场页面未使用 `StatusPanel`。

- [ ] **步骤 4：重组挂坠页面**

使用 `PageHeader`、`StatusPanel` 和统一选择样式：

```tsx
<section className="page-stack">
  <PageHeader
    eyebrow="02 / 配对挂坠"
    title={<>给挂坠一点<span>脾气</span></>}
    description="选择震动暗号和感应范围，之后仍可在设置中调整。"
    actions={<StepPips active={2} total={2} />}
  />

  <div className="device-stage">
    <div className={`device-preview ${buzzing ? "animate-buzz" : ""}`}>
      <AppLogo size={98} />
    </div>
    <PixelButton onClick={tryBuzz} variant="pink">
      <Vibrate size={16} /> 测试震动
    </PixelButton>
  </div>

  <StatusPanel tone="info" title={buzzing ? "正在测试震动" : "挂坠已就绪"}>
    {buzzing ? "请感受当前暗号节奏。" : "选择一种震动方式后即可继续。"}
  </StatusPanel>
</section>
```

把现有震动选项、感应半径、安静模式和“进入口袋朋友”按钮按当前顺序直接放在 `StatusPanel` 与 `section` 结束标签之间，字段绑定和回调保持不变。

- [ ] **步骤 5：把到场阶段映射到统一状态面板**

在 `Arrival.tsx` 内增加确定性的状态映射：

```tsx
const arrivalCopy: Record<ArrivalStage, { title: string; body: string }> = {
  fetching: { title: "正在获取照片", body: "等待硬件上传最新照片。" },
  generating: { title: "正在生成像素形象", body: "正在把照片转换为岛民形象。" },
  pixelating: { title: "正在整理像素细节", body: "形象即将准备完成。" },
  entering: { title: "正在进入好友小岛", body: "正在保存居民资料与场景位置。" },
  done: { title: "岛民已就绪", body: "你的像素朋友已经进入场景。" },
};
```

在现有主视觉下方使用：

```tsx
<StatusPanel
  tone={warning ? "warning" : stage === "done" ? "success" : "info"}
  title={arrivalCopy[stage].title}
>
  {warning ?? arrivalCopy[stage].body}
</StatusPanel>
```

保留现有队列、轮询、超时、演示备用、居民保存和完成回调逻辑。

- [ ] **步骤 6：运行挂坠和契约测试**

运行：

```powershell
npm run test:ui -- -- test/PendantSetup.test.tsx
node --experimental-strip-types --test apps/mobile/test/frontendContract.test.ts
```

预期：PASS。

- [ ] **步骤 7：提交任务 4**

```powershell
git add apps/mobile/src/components/PendantSetup.tsx apps/mobile/src/components/Arrival.tsx apps/mobile/src/styles.css apps/mobile/test/PendantSetup.test.tsx apps/mobile/test/frontendContract.test.ts
git commit -m "feat(ui): unify pendant and arrival states"
```

### 任务 5：精修掌机框架与底部导航

**文件：**
- 创建：`apps/mobile/test/AppShell.test.tsx`
- 修改：`apps/mobile/src/components/AppShell.tsx:1-92`
- 修改：`apps/mobile/src/styles.css`

- [ ] **步骤 1：编写失败的底部导航测试**

创建 `AppShell.test.tsx`：

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { BottomTabs } from "../src/components/AppShell.tsx";

afterEach(cleanup);

describe("BottomTabs", () => {
  test("keeps three fixed destinations and announces the current page", () => {
    const setTab = vi.fn();
    render(<BottomTabs tab="map" setTab={setTab} />);

    const map = screen.getByRole("button", { name: /地图/ });
    expect(map.getAttribute("aria-current")).toBe("page");
    expect(screen.getAllByRole("button")).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: /好友/ }));
    expect(setTab).toHaveBeenCalledWith("pals");
  });
});
```

- [ ] **步骤 2：运行测试并确认目标失败**

先将测试增加一个当前状态标识断言：

```tsx
expect(map.querySelector("[aria-hidden='true']")).toHaveTextContent("●");
```

运行：

```powershell
npm run test:ui -- -- test/AppShell.test.tsx
```

预期：FAIL，当前导航尚无颜色之外的“●”状态。

- [ ] **步骤 3：增加非颜色当前状态与安全区**

将导航按钮内容重组为：

```tsx
<button
  type="button"
  key={key}
  onClick={() => setTab(key)}
  aria-current={active ? "page" : undefined}
  className={`pixel-tab ${active ? "is-active" : ""}`}
>
  <span className="pixel-tab-indicator" aria-hidden="true">{active ? "●" : "○"}</span>
  <Icon size={20} strokeWidth={2.5} aria-hidden="true" />
  <span>{label}</span>
</button>
```

主内容增加 `.app-content-safe`，底部导航使用安全区：

```css
.app-content-safe {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding-bottom: calc(92px + env(safe-area-inset-bottom));
}
.pixel-tabs {
  bottom: max(8px, env(safe-area-inset-bottom));
}
.pixel-tab {
  background: var(--mint);
}
.pixel-tab.is-active {
  background: var(--pink);
  transform: translate(1px, 1px);
  box-shadow: inset 0 0 0 2px var(--ink);
}
.pixel-tab-indicator {
  height: 8px;
  font-size: 7px;
  line-height: 1;
}
```

- [ ] **步骤 4：运行底部导航测试**

运行：

```powershell
npm run test:ui -- -- test/AppShell.test.tsx
```

预期：PASS。

- [ ] **步骤 5：提交任务 5**

```powershell
git add apps/mobile/src/components/AppShell.tsx apps/mobile/src/styles.css apps/mobile/test/AppShell.test.tsx
git commit -m "feat(ui): refine phone shell navigation"
```

### 任务 6：突出 MAP 地图主体与状态

**文件：**
- 修改：`apps/mobile/src/components/MatchingMap.tsx:1-96`
- 修改：`apps/mobile/src/styles.css`
- 修改：`apps/mobile/test/frontendContract.test.ts`

- [ ] **步骤 1：增加失败的 MAP 结构契约**

在 `frontendContract.test.ts` 增加：

```ts
test("keeps the map as the primary surface with scoped controls and status", async () => {
  const matchingMap = await read("src/components/MatchingMap.tsx");

  assert.match(matchingMap, /className="map-page/);
  assert.match(matchingMap, /className="map-primary-surface/);
  assert.match(matchingMap, /StatusPanel/);
  assert.match(matchingMap, /地图状态/);
});
```

- [ ] **步骤 2：运行契约测试并确认失败**

运行：

```powershell
node --experimental-strip-types --test apps/mobile/test/frontendContract.test.ts
```

预期：FAIL，缺少新结构类和统一状态面板。

- [ ] **步骤 3：重组 MAP 页面但保留地图控制器**

将 `MatchingMap` 的顶层结构改为：

```tsx
<section className="map-page page-stack">
  <PageHeader
    eyebrow="实时磁场"
    title={<>附近的<span>口袋朋友</span></>}
    description={`附近 ${people.length} 位磁场接近`}
    actions={<span className="location-chip">{locationBadge}</span>}
  />

  <div className="map-primary-surface">
    <AmapNearbyMap
      focusRequest={focusRequest}
      markers={markers}
      sourceLabel={locationBadge}
      onSelectPlayer={selectPlayer}
    />
  </div>

  {!nearby.state && (
    <StatusPanel
      tone="warning"
      title="地图状态"
      action={
        <div className="grid grid-cols-2 gap-2">
          <PixelButton onClick={() => void nearby.retryGps()} disabled={nearby.loading}>
            <LocateFixed size={15} /> 真实定位
          </PixelButton>
          <PixelButton onClick={() => void nearby.useDemoLocation()} disabled={nearby.loading} variant="lime">
            <RotateCcw size={15} /> 演示定位
          </PixelButton>
        </div>
      }
    >
      {nearby.message}
    </StatusPanel>
  )}
</section>
```

把现有选中人物、碰撞、已捕捉和附近列表 JSX 按当前顺序直接放在 `StatusPanel` 之后、`section` 结束标签之前。不得修改 `selectPlayer`、`simulateBuzz`、`buildMapMarkers`、定位重试或演示定位回调。

- [ ] **步骤 4：增加地图主体样式**

```css
.map-page {
  gap: 14px;
  padding: 16px 12px;
}
.map-primary-surface {
  position: relative;
  overflow: hidden;
  border: 3px solid var(--ink);
  background: var(--ink);
  box-shadow: var(--shadow-major);
}
.location-chip {
  display: inline-flex;
  min-height: 32px;
  align-items: center;
  border: 2px solid var(--ink);
  background: var(--lime);
  padding: 5px 8px;
  font-family: "Press Start 2P", ui-monospace, monospace;
  font-size: 7px;
}
```

- [ ] **步骤 5：运行 MAP 相关测试**

运行：

```powershell
node --experimental-strip-types --test apps/mobile/test/frontendContract.test.ts apps/mobile/test/mapModel.test.ts apps/mobile/test/mapInteraction.test.ts apps/mobile/test/locationBadge.test.ts
```

预期：PASS。

- [ ] **步骤 6：提交任务 6**

```powershell
git add apps/mobile/src/components/MatchingMap.tsx apps/mobile/src/styles.css apps/mobile/test/frontendContract.test.ts
git commit -m "feat(ui): elevate map status hierarchy"
```

### 任务 7：整理 PALS 与 SET 信息层级

**文件：**
- 修改：`apps/mobile/src/components/HomeWorld.tsx:1-446`
- 修改：`apps/mobile/src/components/Settings.tsx:1-233`
- 修改：`apps/mobile/src/styles.css`
- 修改：`apps/mobile/test/frontendContract.test.ts`

- [ ] **步骤 1：增加失败的 PALS 与 SET 分组契约**

在 `frontendContract.test.ts` 增加：

```ts
test("groups pals and settings around product-specific sections", async () => {
  const [homeWorld, settings] = await Promise.all([
    read("src/components/HomeWorld.tsx"),
    read("src/components/Settings.tsx"),
  ]);

  assert.match(homeWorld, /PageHeader/);
  assert.match(homeWorld, /我的像素档案/);
  assert.match(homeWorld, /场景与好友/);

  assert.match(settings, /PageHeader/);
  assert.match(settings, /个人资料/);
  assert.match(settings, /体验偏好/);
  assert.match(settings, /设备与隐私/);
});
```

- [ ] **步骤 2：运行契约测试并确认失败**

运行：

```powershell
node --experimental-strip-types --test apps/mobile/test/frontendContract.test.ts
```

预期：FAIL，当前页面尚未使用统一标题和三组设置文案。

- [ ] **步骤 3：重组 PALS 页面标题与分区**

保留 `HomeWorld.tsx` 的场景加载、照片居民同步、缓存、刷新、进入/退出场景和岛屿交互逻辑。只在现有渲染结构中加入：

```tsx
<PageHeader
  eyebrow="PALS / 好友小岛"
  title={<>我的<span>像素档案</span></>}
  description="查看自己的岛民形象，并进入不同场景寻找同频朋友。"
  actions={
    <div className="flex gap-1">
      {activeScene && (
        <button type="button" aria-label="返回小岛总览" onClick={leaveScene} className="pixel-icon-button bg-card">
          <ArrowLeft size={16} />
        </button>
      )}
      <button type="button" aria-label="刷新居民数据" onClick={() => void refreshWorld()} className="pixel-icon-button bg-card">
        <RefreshCw size={15} />
      </button>
      <button type="button" aria-label="横屏查看小岛" onClick={() => setLandscape(true)} className="pixel-icon-button bg-card">
        <Maximize2 size={16} />
      </button>
    </div>
  }
/>

<h2 id="pals-profile-title" className="section-title">我的像素档案</h2>
<h2 id="pals-scenes-title" className="section-title">场景与好友</h2>
```

用 `<section aria-labelledby="pals-profile-title" className="content-section">` 包裹现有居民档案 `PixelCard`，并把第一个标题放在卡片前。用 `<section aria-labelledby="pals-scenes-title" className="content-section">` 包裹地图画布、场景入口和场景居民列表，并把第二个标题放在画布前。

- [ ] **步骤 4：重组 SET 页面分区**

使用统一标题：

```tsx
<PageHeader
  eyebrow="SET / 设置"
  title={<>管理你的<span>口袋档案</span></>}
  description="调整资料、相遇偏好、设备反馈和隐私边界。"
/>
```

将现有内容按以下标题分组，不修改保存和状态逻辑。三个标题必须使用以下精确 JSX：

```tsx
<h2 id="settings-profile" className="section-title">个人资料</h2>
<h2 id="settings-experience" className="section-title">体验偏好</h2>
<h2 id="settings-device" className="section-title">设备与隐私</h2>
```

用 `content-section` 分别包裹以下现有连续内容：

1. `settings-profile`：产品服务状态、账号资料表单和保存按钮。
2. `settings-experience`：震动方式和感应半径。
3. `settings-device`：居民数据、挂坠状态、隐私规则和通知偏好。

`backendWarning` 改用：

```tsx
<StatusPanel tone="warning" title="服务提示">
  {backendWarning}
</StatusPanel>
```

保存按钮改用 `loading={saving}` 和 `loadingLabel="正在保存"`。

- [ ] **步骤 5：增加通用内容分区样式**

```css
.content-section {
  display: grid;
  gap: 12px;
}
.section-title {
  margin: 0;
  color: var(--ink);
  font-family: "Press Start 2P", ui-monospace, monospace;
  font-size: 9px;
  line-height: 1.6;
}
.section-heading {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.section-heading h2,
.section-heading p {
  margin: 0;
}
```

- [ ] **步骤 6：运行 PALS、SET 与照片同步相关测试**

运行：

```powershell
node --experimental-strip-types --test apps/mobile/test/frontendContract.test.ts apps/mobile/test/sceneResidents.test.ts apps/mobile/test/photoResidentSync.test.ts apps/mobile/test/photoUpdateQueue.test.ts
```

预期：PASS。

- [ ] **步骤 7：提交任务 7**

```powershell
git add apps/mobile/src/components/HomeWorld.tsx apps/mobile/src/components/Settings.tsx apps/mobile/src/styles.css apps/mobile/test/frontendContract.test.ts
git commit -m "feat(ui): organize pals and settings content"
```

### 任务 8：生成并接入站点专属社交预览

**文件：**
- 创建：`apps/mobile/public/og.png`
- 修改：`apps/mobile/index.html`
- 修改：`apps/mobile/test/frontendContract.test.ts`

- [ ] **步骤 1：增加失败的分享元数据契约**

在 `frontendContract.test.ts` 增加：

```ts
test("publishes a site-specific social preview", async () => {
  const [html, ogImage] = await Promise.all([
    read("index.html"),
    readFile(new URL("public/og.png", mobileRoot)),
  ]);

  assert.match(html, /property="og:title" content="Pocket Friend"/);
  assert.match(html, /property="og:description" content="遇见同频的人，生成你的像素岛民档案。"/);
  assert.match(html, /property="og:image" content="https:\/\/pocket-friend-map\.h1879202922\.chatgpt\.site\/og\.png"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.equal(ogImage.length > 10_000, true);
});
```

- [ ] **步骤 2：运行契约测试并确认失败**

运行：

```powershell
node --experimental-strip-types --test apps/mobile/test/frontendContract.test.ts
```

预期：FAIL，`public/og.png` 不存在，且 HTML 尚无站点专属分享元数据。

- [ ] **步骤 3：使用 imagegen 生成一次完整社交卡片**

调用 `imagegen`，使用以下完整提示词，只生成一个横版成品：

```text
为 Pocket Friend 网站生成一张 1200×630 横版社交分享卡片。主题是精致的复古像素掌机社交体验：薄荷绿色网格屏幕背景、深蓝黑像素硬边框、粉色主按钮色、青色信息色、酸橙色状态灯。画面中心是一枚粉色像素挂坠，周围有克制的信号波纹和几位匿名像素岛民剪影，远处隐约可见好友小岛与地图网格。必须清晰、准确地包含文字“Pocket Friend”和中文副标题“遇见同频的人”，不得出现其他文字、乱码、品牌标志或写实人物。整体适合 X、Slack、iMessage 链接预览，文字高对比、留出安全边距。
```

检查成图中的两处文字是否准确、完整且没有新增文字。仅当文字错误、缺失或画面不可用时重试一次；否则把成图保存为 `apps/mobile/public/og.png`。

- [ ] **步骤 4：接入 Open Graph 与 X 元数据**

在 `apps/mobile/index.html` 的 `<head>` 中加入：

```html
<meta property="og:type" content="website" />
<meta property="og:title" content="Pocket Friend" />
<meta property="og:description" content="遇见同频的人，生成你的像素岛民档案。" />
<meta property="og:image" content="https://pocket-friend-map.h1879202922.chatgpt.site/og.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Pocket Friend" />
<meta name="twitter:description" content="遇见同频的人，生成你的像素岛民档案。" />
<meta name="twitter:image" content="https://pocket-friend-map.h1879202922.chatgpt.site/og.png" />
```

- [ ] **步骤 5：运行分享元数据契约**

运行：

```powershell
node --experimental-strip-types --test apps/mobile/test/frontendContract.test.ts
```

预期：PASS。

- [ ] **步骤 6：提交任务 8**

```powershell
git add apps/mobile/public/og.png apps/mobile/index.html apps/mobile/test/frontendContract.test.ts
git commit -m "feat(ui): add social preview card"
```

### 任务 9：完成响应式、减少动态效果与全量验证

**文件：**
- 修改：`apps/mobile/src/styles.css`
- 修改：`apps/mobile/test/frontendContract.test.ts`
- 按失败结果修改：任务 1—7 已涉及的文件

- [ ] **步骤 1：增加失败的最终视觉契约**

在 `frontendContract.test.ts` 增加：

```ts
test("defines the complete refined visual contract", async () => {
  const styles = await read("src/styles.css");

  for (const contract of [
    "--surface-raised",
    "--ink-muted",
    "--motion-fast",
    ".page-stack",
    ".page-header",
    ".status-panel",
    ".form-control",
    ".map-primary-surface",
    ".app-content-safe",
    "env(safe-area-inset-bottom)",
  ]) {
    assert.equal(styles.includes(contract), true, `缺少视觉契约：${contract}`);
  }

  assert.match(styles, /@media \(max-width: 480px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /animation: none !important/);
});
```

- [ ] **步骤 2：运行契约测试并确认失败**

运行：

```powershell
node --experimental-strip-types --test apps/mobile/test/frontendContract.test.ts
```

预期：FAIL，直到安全区和减少动态效果的最终规则完整。

- [ ] **步骤 3：完成窄屏和减少动态效果规则**

在 `styles.css` 尾部收敛为：

```css
@media (max-width: 480px) {
  .phone-hardware,
  .phone-screen {
    border-radius: 0;
  }

  .phone-hardware {
    border-width: 0;
    padding: 0;
    box-shadow: none;
  }

  .phone-viewport {
    height: calc(100dvh - 30px);
    min-height: 0;
  }

  .page-stack {
    padding-inline: 14px;
  }

  .amap-shell,
  .amap-canvas {
    height: min(42dvh, 330px);
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    animation: none !important;
    transition-duration: 0.01ms !important;
  }
}
```

同时加入以下 320px 窄屏规则，避免状态操作和导航溢出：

```css
@media (max-width: 340px) {
  .status-panel {
    flex-direction: column;
  }

  .status-panel-action {
    width: 100%;
  }

  .status-panel-action .pixel-button {
    width: 100%;
  }

  .pixel-tabs {
    gap: 4px;
    padding: 6px;
  }
}
```

- [ ] **步骤 4：运行新增与既有移动端测试**

运行：

```powershell
npm run test:ui
```

预期：所有移动端测试 PASS，0 个失败。

- [ ] **步骤 5：运行全仓测试与类型检查**

运行：

```powershell
npm test
npm run typecheck
```

预期：两个命令退出码均为 0。

- [ ] **步骤 6：运行 Sites 生产构建**

运行：

```powershell
npm run build:sites
```

预期：Vite 构建成功，并生成 `dist/server/index.js` 与 `dist/.openai/hosting.json`。

- [ ] **步骤 7：检查工作树与改动范围**

运行：

```powershell
git diff --check
git status --short
```

预期：`git diff --check` 无输出；状态只包含本任务计划内文件和既有 `.qoder/`。

- [ ] **步骤 8：提交最终验证调整**

若步骤 3—7 产生了额外修复：

```powershell
git add apps/mobile/src apps/mobile/test
git commit -m "fix(ui): complete responsive visual polish"
```

若没有额外改动，不创建空提交。

- [ ] **步骤 9：同步并部署**

按项目协作规则先同步远端：

```powershell
git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 fetch origin
git rebase origin/master
git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push origin master
```

随后使用 Sites 托管流程：

1. 复用 `.openai/hosting.json` 中现有 `project_id`。
2. 获取短期源码仓库写入凭据并将当前 `HEAD` 推送到站点源码分支。
3. 使用 Sites 的 `package-site.sh` 打包当前已验证构建。
4. 保存新站点版本。
5. 由于现有站点为公开访问，确认用户的发布授权仍然有效后发布该版本。
6. 轮询部署状态直到 `succeeded`，再打开返回的生产地址。
