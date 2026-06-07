# Intermact

Intermact 是一个基于 React Three Fiber 的交互式 3D Manim 复刻，我们的目标是首先复刻 manim 的基础功能，然后在此基础上进行扩展，实现更多的功能。

## 当前核心痛点：

1. **渲染速度**：Manim 离线渲染，一次完整的渲染耗时可达数十分钟，调试迭代极慢。
2. **可交互性差**：manim 以及大部分支持库仅支持视频生成，无法实现参数拖拽、实时模拟、观众互动等功能，
3. **实验与渲染耦合**：举例：神经网络训练逻辑直接嵌入 Manim 场景中，导致每次渲染都要重跑实验。
4. **输出格式受限**：最终产物是视频文件，无法嵌入 Web、无法做自适应布局、无法附加超链接/讲义。

## 可能的联动：

- `@react-three/drei`：文字、HTML overlay、Billboard、环境光等 50+ 工具组件
- `react-spring` / `framer-motion-3d`：声明式动画
- `leva`：实时参数 GUI
- `jotai`：轻量状态管理
- `D3.js` / `Echarts` / `Plotly`：通过 HTML overlay 嵌入图表

## 需求

### 程序化对象与动画原语

#### 基本对象

IMObject2D 作为基础接口，派生 Circle、Eclipse、Rectangle、Arc、Polygon、BezierCurve 等，还需要特殊的 SVG_Obj、Text_Obj、LaTeX_Obj 等

思考：我们最好引入React所倡导的函数式、声明式接口，而不用类继承的方式实现

#### Create 动画接口

所有组件都必须有 Create 动画接口
- 对于程序化组件、SVG 等，其展现形式应当是：按照点的顺序画出曲线,而后如果有填充，填充之（填充的方式可以选择：画线实时填充、画线后淡入填充、扫描线填充等）
- 对于 Text 和 LaTeX，需要想办法实现类似的 writing 效果

#### Morph 类动画支持

需要任意 IMObject2D 到 IMObject2D 的 Morph 动画支持，需要考虑节点数不同的情况 —— 比如先做插值？

#### 标准 Tween 动画支持

类似 Unity 的 DoTween 库，可以对任何内部、外部属性进行可调节动画曲线的 Tween 动画

注：所有的对象和对应的动画，在调用时都仅仅返回对应的句柄而非真正去显示、播放，这个将在稍后讨论

#### 3D 支持

参考上面，我们还需要一套针对 3D 场景的支持

### UI - Scene 分离，Scene - Camera 分离设计

不同于 Manim，我们将彻底解耦 Scene、Canvas、Camera。

#### Scene

对于 Scene 我们目前可以有 Scene2D、Scene3D 两类，并且可以天然通过属性来决定该 Scene 的坐标系定义（直角坐标、极坐标、坐标系定义域（scene真实尺寸））
Scene 通过 `GetAxes(props) -> RegisteredObject` 注册坐标轴；`props` 仅描述轴自身（定义域、刻度、标签等），淡入/淡出与其它对象一样由 `RegisteredObject` 的 `FadeIn`/`FadeOut`/`Create` 等动画接口表达

##### Object 在 Scene 中的注册和定位

- `RegisterObject: Scene, Object, Transform -> RegisteredObject` (注：在这一视角下，Object应当仅包含定义，而上文中探讨的各类Object动画支持等，应当在 RegisteredObject 上进行作用)

- 额外地，对于 2D Object 在 2D Scene 中的注册，我们构建一系列类似 Unity3D 中 RectTransform 的快速访问方法，操作 bounding box，以便让 bounding box 可以根据相对 UV 坐标快速对齐位置和尺寸

- 额外地，应当有类似 manim 的相对定位方法，制定一个 RegisteredObject 相对于另一个 RegisteredObject 的位置

- 类比 Unity ，我们应该有注册 empty object 和 transform hierarchy 的能力

- `Play: Scene, Animation[] -> AsyncPromise(Scene)`，其中 `Animation` 为 RegisteredObject 的各类动画接口（比如 Create, Fade, Tween 等) 的返回类型

- 因为我们的 Scene 自身包含定义域元语，所以可以有：
    - `Transform_AbsToRel: Scene, TransformXY -> TransformUV`, `Transform_RelToAbs: Scene, TransformUV -> TransformXY`
    - `Transform_AbsToRel: Scene, TransformXYZ -> TransformUVW`, `Transform_RelToAbs: Scene, TransformUVW -> TransformXYZ`
    - 注：TransformXY 和 TransformUV 是不是本身就应该是两个不同类型（毕竟定义域不同），那么相应地，RegisterObject 本身也应该有 Transform Variation

- 在 Tween 之外，还应该提供快速动画访问工具：FadeIn/FadeOut、Move、Rotate（对于3D应有四元数支持）、Scale 等，参考 Unity3D 的对应接口
  - 注：在 Create、FadeIn 等方法被 Play 之前，对应对象不应显示

- `Free: Scene, RegisteredObject -> Scene` 从场景中回收对象

#### Camera

Camera 将作为特殊的 Object 被注册到 Scene 中，并包含关于其位姿的参数和动画方法

#### RenderedScene

类型 `RenderedScene = Tuple(Scene, Camera)`

- `Render: Scene, Camera -> RenderedScene`，其中 RenderedScene 可被视为特殊的 2D Object 被 Register 到其他 Scene 中

#### Canvas

其实是个特殊的 2D Scene，隐含一个覆盖全 UV 的 Camera，作为顶层渲染输出到 web