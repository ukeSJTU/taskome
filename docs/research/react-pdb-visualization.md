# React 前端中的 PDB/mmCIF 可视化选型

研究日期：2026-08-14

## 结论

对 Taskome 这种会展示设计产物、并预计需要链/残基选择、按属性着色及后续密度图或轨迹能力的 React 应用，首选 **Mol\***（`molstar`）。它是 TypeScript 技术栈，核心项目内含 React 插件 UI；官方项目明确将其定位为可嵌入、可扩展的结构数据可视化技术栈，并已用于 PDBe 与 RCSB PDB 等生产级数据库。[Mol* README](https://github.com/molstar/molstar#mol) [集成列表](https://molstar.org/viewer-docs/integrations/)

React 不需要专用 wrapper 才能使用这四个库：均可在 Client Component 的 `useEffect` 中通过容器 `ref` 初始化，并在 cleanup 时销毁 viewer。区别在于 Mol* 本身就有 React UI 模块；NGL、3Dmol.js 的一手资料只提供原生 JavaScript API/嵌入方式。因此，对于产品 UI，建议把 viewer 生命周期封装为一个薄的 client-only React 组件，应用自己的 React 面板、状态和权限逻辑；不要把第三方 React wrapper 当作核心依赖。

若当前需求严格是“展示单个 PDB，点击原子/残基后同步 UI”，且希望最小接入成本，**3Dmol.js** 很合适。若任务重点是 MD 轨迹和常见密度体数据，**NGL** 的格式覆盖和交互 API 最直接。**PDBe Molstar** 是 Mol* 的 PDBe 定制层，提供 JS plugin/Web Component、属性定制和程序化交互 helper；只有确实需要其 PDBe 预设或 Web Component 交付方式时再选它，常规自有文件工作流优先直接接 Mol*。[Mol* README](https://github.com/molstar/molstar#protein-data-bank-integrations)

## 对比

| 技术                              | React 接入                                                                                                                                       | PDB/mmCIF 与表示                                                                                                                   | 选择、事件与 React 同步                                                                                         | 轨迹 / 体数据                                                                                                                                                                     | 许可与维护信号                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Mol\*** (`molstar`)             | 核心含 `mol-plugin-ui` React UI 模块；也可只嵌入 plugin/canvas，适合用 `ref` + `useEffect` 包装。不是一个以 props 为中心的官方 React component。 | Viewer URL API 明列 `mmcif`、`pdb` 等格式；可做结构、体、shape 表示，支持按层级（atom/residue/chain/entity/model/structure）选取。 | 交互选择支持集合并、差、交；以插件 state/behavior API 订阅并映射到 React 状态。选择层级和高亮是内建概念。       | 项目 README 列出 coordinates、experimental/map 与 volume representation 模块；官方文档有 volume/segmentation 专章。轨迹亦是其科学可视化定位的一部分，但实施前应按所需格式做 PoC。 | **MIT**；PDBe 与 RCSB PDB 联合发起，公开仓库在研究日仍有提交（2026-08-13）。 |
| **NGL Viewer** (`ngl`)            | 官方是可嵌入的原生 JS `Stage` API（npm 包 `ngl`），在 React effect 中创建/释放 Stage；没有官方 React 包装。                                      | 明列 mmCIF、PDB、PQR、GRO、SDF、MOL2、MMTF；WebGL 多种 representation。                                                            | 有 selection language；`stage.signals.clicked/hovered` 返回 `PickingProxy`，很适合转为 React callback/状态。    | 最完整明确：DCD/PSF、NCTRAJ/PRMTOP、TRR/XTC/TOP 轨迹；MRC/MAP/CCP4、DX、CUBE、BRIX/DSN6、XPLOR/CNS 密度。                                                                         | **MIT**；研究日 GitHub 主分支最近推送为 2025-04-14，仍未归档。               |
| **3Dmol.js** (`3dmol`)            | 官方支持 `npm install 3dmol` 与动态 ES module import；模块仍会写入 `$3Dmol` 全局，须 client-only 初始化。                                        | 文档与 API 列出 PDB、CIF/mmCIF（含 BCIF）、SDF、MOL2、XYZ、CUBE 等；cartoon、stick、sphere、surface 等样式。                       | `AtomSelectionSpec` 支持属性选择与样式；官方特性含 clickable interaction，可把 atom click callback 接到 React。 | 有 `VolumeData`、`GLVolumetricRender` 和 isosurface；没有像 NGL 一样在主文档明确列出的 MD trajectory 格式覆盖。                                                                   | 官方文档称为宽松 **BSD** 许可；研究日主分支最近推送为 2026-05-22，未归档。   |
| **PDBe Molstar** (`pdbe-molstar`) | 官方 README 明确为 **JS plugin 和 Web Component**，React 可把 custom element 放进 JSX 或用 plugin API；不是原生 React component。                | 基于 Mol*；主要优势是 PDBe 的默认展示、属性/attribute 定制、ligand superposition helper。                                          | 提供“programmatic interactions” helper，便于网页其他部分驱动 3D viewer。                                        | 继承 Mol* 的能力；若不接 PDBe 数据与预设，额外层次通常没有必要。                                                                                                                  | **Apache-2.0**；研究日主分支最近推送为 2026-07-22，未归档。                  |

表中“最近推送”仅是维护活跃度信号，不是长期兼容性承诺；均应锁定精确 npm 版本并在升级前跑视觉与交互回归。

## 建议的实现边界

1. 新建 `PdbViewer` Client Component：它仅负责创建、更新、销毁 Mol* plugin；文件 URL、显示模式、选择与错误由明确的 props/callback 传入传出。
2. PDB/mmCIF 文件继续经 Web BFF 的受鉴权 URL 提供给浏览器。若 viewer 直接请求对象存储，须确保 URL 是短期 presigned URL，并考虑 CORS；不要把 gateway 凭据放入浏览器。
3. 第一个垂直切片只做：加载 `.cif` / `.pdb`、cartoon + ligand、链/残基点击回调、加载/解析失败提示与 resize cleanup。表面、轨迹、volume 在有真实任务输入后再按库的格式能力单独加入。
4. 在真实设计结果上做一个小型 PoC：至少覆盖大复合物、含配体结构、用户上传文件、点击选择到任务结果侧栏，以及低配 GPU/移动端的降级体验。Mol* 的插件 API 功能强但层次较深，PoC 应验证本项目所需的“从 3D 选到业务 residue identifier”的精确映射。

## 一手资料

- Mol*: [官方仓库 README / 模块与 React UI](https://github.com/molstar/molstar#project-structure-overview)、[viewer 格式 URL 参数](https://molstar.org/viewer-docs/query-parameters/)、[选择交互](https://molstar.org/viewer-docs/making-selections/)、[LICENSE（MIT）](https://github.com/molstar/molstar/blob/master/LICENSE)。
- NGL: [官方 API 概览与 npm 嵌入](https://nglviewer.org/ngl/api/index.html)、[官方 manual：格式、轨迹、volume、picking](https://nglviewer.org/ngl/api/manual/)、[LICENSE（MIT）](https://github.com/arose/ngl/blob/master/LICENSE)。
- 3Dmol.js: [官方 API / npm、ES module 与 BSD 说明](https://3dmol.org/doc/)、[官方源码与 LICENSE](https://github.com/3dmol/3Dmol.js)。
- PDBe Molstar: [官方 README](https://github.com/PDBeurope/pdbe-molstar#pdbe-molstar)、[LICENSE（Apache-2.0）](https://github.com/PDBeurope/pdbe-molstar/blob/master/LICENSE)。
