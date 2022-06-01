---
title: Programming Rust
date: 2022-05-05 09:54:08
---

### `Programming Rust`

这本书是 `O'Reilly` 出版社的，对本书进行了学习和记录，内容大体上没有遗漏，只是对一些描述做了精简，[出版社书籍链接](https://www.oreilly.com/library/view/programming-rust-2nd/9781492052586/)。文档源码 [gamelife1314/gamelife1314.github.io](https://github.com/gamelife1314/gamelife1314.github.io)。

![](assets/programing-rust-cover.png)

表述有误的地方请评论或者提 `pr` 指正。

1. [《第3章-Fundamental Types》](/2022/04/10/【Rust】基础类型/)
2. [《第4章-Ownership and Moves》](/2022/04/12/【Rust】所有权/)
3. [《第5章-References》](/2022/04/17/【Rust】引用/)
4. [《第6章-Expressions》](/2022/04/20/【Rust】表达式/)
5. [《第7章-Error Handling》](/2022/04/21/【Rust】错误处理/)
6. [《第8章-Crates and Modules》](/2022/04/22/【Rust】Crate-和-Module/)
7. [《第9章-Structs》](/2022/04/24/【Rust】结构体/)
8. [《第10章-Enums and Patterns》](/2022/04/25/【Rust】枚举和模式匹配/)
9. [《第11章-Traits and Generics》](/2022/04/26/【Rust】Trait和泛型/)
10. [《第12章-Operator Overloading》](/2022/04/28/Rust/Rust-operator-overloading/)
11. [《第13章-Utility Traits》](/2022/04/29/【Rust】常用-Trait/)
12. [《第14章-Closures》](/2022/04/30/【Rust】闭包/)
13. [《第15章-Iterators》](/2022/04/30/【Rust】迭代器/)
14. [《第16章-Collections》](/2022/05/01/【Rust】集合类型/)
15. [《第17章-Strings and Text》](/2022/05/01/【Rust】字符串和文本/)
16. [《第18章-Input and Output》](/2022/05/02/【Rust】输入输出/)
17. [《第19章-Concurrency》](/2022/05/03/【Rust】并发/)
18. [《第20章-Asynchronous Programming》](/2022/05/03/【Rust】异步编程/)
19. [《第21章-Macros》](/2022/05/04/【Rust】宏/)
20. [《第22章-Unsafe Code》](/2022/05/05/【Rust】Unsafe-代码/)
21. [《第23章-Foreign Functions》](/2022/05/06/Rust/Rust-ffi/)

#### 其他文章

- [Rust 生命周期](/2021/09/14/【Rust】生命周期/)
- [Rust 学习笔记](/2021/09/05/【Rust】实战突破/)
- [Rustup 介绍](/2022/04/07/【Rust】Rustup%20介绍/)
- [Rust 交叉编译](/2022/04/08/【Rust】交叉编译/)
- [Rust 二进制文件体积减小](https://github.com/johnthagen/min-sized-rust)
- [Rust 格式化](/2022/05/01/【Rust】字符串和文本/#格式化)
- [Rust 正则表达式](/2022/05/01/【Rust】字符串和文本/#正则表达式)
- [文件和目录](/2022/05/02/【Rust】输入输出/#文件和目录)
- [`anyhow & thiserror`](/2022/05/11/Rust/anyhow-and-thiserror/)
- [`Rust` 在线题目测试](https://dtolnay.github.io/rust-quiz/18)
- [`gdb` 速查手册](https://darkdust.net/files/GDB%20Cheat%20Sheet.pdf)
- [`lldb` 使用帮助](https://lldb.llvm.org/use/map.html)
- [用 `GitHub Actions` 进行持续集成](https://course.rs/test/ci.html)
- [`Rust Docker Tutorial`](https://tutorialedge.net/rust/rust-docker-tutorial/)
- [`Rust`日报】关于 `pprof-rs` 内部工作原理的一些笔记](https://mp.weixin.qq.com/s/SIgvfBKOIzTtG8x2metdKA)

### `WEB`

- [`reqwest`](https://crates.io/crates/reqwest)：高级 `HTTP` 客户端；
- [`actix-web`](https://crates.io/crates/actix-web)：`Web` 框架；
- [`surf`](https://crates.io/crates/surf)：跨平台 `HTTP` 客户端，简单易用；
- [`rocket`](https://rocket.rs/)：`web` 框架；
- [`axum`](https://github.com/tokio-rs/axum)：使用 `Tokio`、`Tower` 和 `Hyper` 构建的符合人体工程学的模块化 `Web` 框架；
- [`diesel`](https://diesel.rs/)：`Rust` 的 `ORM` 框架；
- [`SeaORM`](https://www.sea-ql.org/SeaORM/)：`Rust` 的 `ORM` 框架；
- [`sqlx`](https://github.com/launchbadge/sqlx)：异步的纯 `Rust` 实现的 `Sql` 工具箱；
- [`yew`](https://yew.rs/zh-CN/)：`Yew` 是一个设计先进的 `Rust` 框架，目的是使用 `WebAssembly` 来创建多线程的前端 `web` 应用。
- [`seed`](https://github.com/seed-rs/seed)：创建 `Web` 前端应用的 `Rust` 框架；
- [`MoonZoon`](https://github.com/MoonZoon/MoonZoon)：`Rust` 全栈框架；
- [`comrak`](https://docs.rs/comrak/latest/comrak/)：`markdown` 解析；

### `FFI`

- [`pyo3`](https://github.com/PyO3/pyo3)
- [`neon`](https://github.com/neon-bindings/neon)

### 编译

- [`min-sized-rust`](https://github.com/johnthagen/min-sized-rust)：减小 `Rust` 二进制文件体积；

### 协议

- [`hyper`](https://github.com/hyperium/hyper)：快速的 `HTTP` 实现；
- [`tonic`](https://github.com/hyperium/tonic)：原生的 `grpc` 客户段和服务端，支持 `async/await`；
- [`prost`](https://github.com/tokio-rs/prost)：`Rust` 的 `protocol buffer` 实现；
- [`tungstenite`](https://docs.rs/tungstenite/latest/tungstenite/)：`websocket` 协议实现；

### 测试

- [`headless_chrome`](https://docs.rs/headless_chrome/latest/headless_chrome/)：一个高级的控制无头浏览器或者 `Chromium` 的框架；
- [`thirtyfour`](https://docs.rs/thirtyfour/latest/thirtyfour/)：类似 `Selenium` 的自动化测试框架；
- [`fantoccini`](https://docs.rs/fantoccini/latest/fantoccini/)：通过 `WebDriver` 以编程方式与网页交互的高级 API；

### `GUI`

- [`iced`](https://github.com/iced-rs/iced)
- [`sixtyfps`](https://github.com/sixtyfpsui/sixtyfps)
- [`druid`](https://linebender.org/druid/)
- [`tauri`](https://tauri.studio/)
- [`areweguiyet`](http://www.areweguiyet.com/#ecosystem)
- [`rust-skia`](https://github.com/rust-skia/rust-skia)
- [`tiny-skia`](https://github.com/RazrFalcon/tiny-skia)

### 命令行

- [`dialoguer`](https://docs.rs/dialoguer/latest/dialoguer/)：可以用于构建交互式命令行；
- [`indicatif`](https://docs.rs/indicatif/latest/indicatif/)：用于提供友好的进度条；
- [`clap`](https://github.com/clap-rs/clap)
- [`tui`](https://github.com/fdehau/tui-rs)：`Rust` 终端 `UI`；

### 云原生

- [`kube-rs`](https://github.com/kube-rs/kube-rs)
- [`krator`](https://github.com/krator-rs/krator)
- [`krustlet`](https://github.com/krustlet/krustlet)

### 嵌入式

- [`wg`](https://github.com/rust-embedded/wg/)：嵌入式设备工作组的协调存储库；
- [`awesome-embedded-rust`](https://github.com/rust-embedded/awesome-embedded-rust)
- [`akri`](https://github.com/project-akri/akri)：一个管理嵌入式设备的云原生项目；

### 区块链

- [`solana`](https://github.com/solana-labs/solana)
- [`password-hashes`](https://github.com/RustCrypto/password-hashes)

### 数据库

- [`bonsaidb`](https://bonsaidb.io/)：`Rust` 写的本地数据库；

### 数据类型

- [`fnv`](https://crates.io/crates/fnv)：基于 `Fowler–Noll–Vo` 算法实现的 `HashMap`；
- [`dashmap`](https://crates.io/crates/dashmap)：`Rust` 中超快的并发 `map`；

### 静态网站

- [`getzola`](https://www.getzola.org/)：静态网站生成器；
- [`mdBook`](https://github.com/rust-lang/mdBook)：类似 `gitbook` 的 `Rust` 实现；

### `wasmtime`

- [`wasmtime`](https://github.com/bytecodealliance/wasmtime)：单独的 `wasm` 运行时；
- [`rustwasm`](https://github.com/rustwasm)：`rustwasm` 生态系统；
- [`wasm-pack`](https://github.com/rustwasm/wasm-pack)：`wasm` 工作流工具；
- [`wasm-bindgen`](https://github.com/rustwasm/wasm-bindgen)：提供`Wasm` 模块和 `JavaScript` 之间级交互的高级 `API`。
- [`bytecodealliance`](https://bytecodealliance.org/)
- [`wasmer`](https://github.com/wasmerio/wasmer)：`Wasmer` 提供基于 `WebAssembly` 的超轻量级容器，其可以在任何地方运行：从桌面到云、以及 `IoT` 设备，并且也能嵌入到 任何编程语言中；
- [`trunk`](https://github.com/thedodd/trunk)：构建、打包以及发布 `wasm` 应用；
- [`spin`](https://github.com/fermyon/spin)：`Spin` 用于使用 `WebAssembly` 构建和运行快速、安全和可组合的云微服务；
- [`WasmEdge`](https://github.com/WasmEdge/WasmEdge)：WasmEdge 是一个轻量级、高性能和可扩展的 WebAssembly 运行时，适用于云原生、边缘和去中心化应用程序。它为无服务器应用程序、嵌入式功能、微服务、智能合约和物联网设备提供支持。

### 机器学习

- [`tensorflow`](https://github.com/tensorflow/rust)
- [`PyTorch`](https://github.com/LaurentMazare/tch-rs)
- [`scikit-learn`](https://github.com/rust-ml/linfa)

### 日志监控

- [`rust-prometheus`](https://github.com/tikv/rust-prometheus)
- [`opentelemetry-rust`](https://github.com/open-telemetry/opentelemetry-rust)
- [`tracing`](https://crates.io/crates/tracing)：日志处理；

### 并发异步

- [`actix`](https://github.com/actix/actix)：`Rust` 的 `actor` 框架；
- [`bastion`](https://github.com/bastion-rs/bastion)：高可用分布式容错运行时；
- [`smol`](https://github.com/smol-rs/smol)：一个小而快的异步运行时；
- [`crossbeam`](https://crates.io/crates/crossbeam)：提供很多用于并发编程的工具，例如线程阻塞；
- [`waker_fn`](https://crates.io/crates/waker-fn)：转换闭包为 `waker`；
- [`rayon`](https://crates.io/crates/rayon)：计算密集型任务的任务分解；
- [`futures-lite`](https://crates.io/crates/futures-lite)：完全兼容 [futures](https://docs.rs/futures)，提供了 `pin!`；
- [`tokio`](https://docs.rs/tokio/latest/tokio/)：`Tokio` 是一个事件驱动的非阻塞 `I/O` 平台，用于使用 `Rust` 编程语言编写异步应用程序。
- [`async_trait`](https://docs.rs/async-trait/latest/async_trait/)：提供了一个宏，可以在 `trait` 中包含异步的方法；

### 其他 `crate`

- [`thiserror`](https://crates.io/crates/thiserror)：自动派生标准库中的 `std::error::Error`；
- [`anyhow`](https://crates.io/crates/anyhow)：提供了 `anyhow::Result<T>` 用于任何可能失败返回错误的函数；
- [`lazy_static`](https://crates.io/crates/lazy_static)：可以用于初始化全局可变静态变量；
- [`unicode-width`](https://crates.io/crates/unicode-width)：获取 `Unicode` 字符宽度；
- [`enum_primitive`](https://crates.io/crates/enum_primitive)：提供宏能自动从数字转换成枚举；
- [`serde_json`](https://crates.io/crates/serde_json)：`json` 序列化；
- [`argonautica`](https://crates.io/crates/argonautica)：使用 [`Argon2 hashing algorithm`](https://en.wikipedia.org/wiki/Argon2) 进行密码 `hash`；
- [`parking_lot`](https://crates.io/crates/parking_lot)：提供了比标准库更快的 `Mutex` 等；
- [`itertools`](https://docs.rs/itertools/0.10.1/itertools/index.html)：扩展了内置的 `Iterator`，提供了更多的迭代适配器方法；
- [`bytes`](https://github.com/tokio-rs/bytes)：处理二进制内容的库；
- [`colored`](https://crates.io/crates/colored)：在终端中添加颜色的最简单方法；
- [`tabled`](https://github.com/zhiburt/tabled)：以表格的形式输出结构体和枚举；
- [`chrono`](https://github.com/chronotope/chrono)：`Rust` 的日期和时间处理库；
- [`nom`](https://github.com/Geal/nom#example)：解析器组合库；
- [`rusoto_core`](https://docs.rs/rusoto_core/latest/rusoto_core/)：`Rust` 实现的 `AWS` `SDK`；
- [`polars`](https://github.com/pola-rs/polars)：用于 `Rust` 和 `Python` 快速的 `DataFrame` 库；
- [`pprof-rs`](https://github.com/tikv/pprof-rs)：借助 `backtrace-rs` 实现的 `Rust` `CPU` 分析器；

### 学习资料

- [`Rust` 程序设计语言](https://kaisery.github.io/trpl-zh-cn/)
- [`Rust` 语言圣经](https://course.rs/about-book.html)
- [`Rust` 秘典](https://doc.rust-lang.org/nomicon/index.html)
- [`Rust` 秘典（中文）](https://nomicon.purewhite.io/)
- [`Rust` 版本指南](https://doc.rust-lang.org/edition-guide/index.html)
- [通过例子学 `Rust`](https://rustwiki.org/zh-CN/rust-by-example/)
- [《`Rust Macros`小书》](https://danielkeep.github.io/tlborm/book/)
- [`Cargo` 手册](https://doc.rust-lang.org/cargo/index.html)
- [`Rustdoc` 手册](https://doc.rust-lang.org/rustdoc/index.html)
- [`Rustc` 手册](https://doc.rust-lang.org/rustc/index.html)
- [命令行手册](https://rust-cli.github.io/book/index.html)
- [嵌入式手册](https://doc.rust-lang.org/embedded-book)
- [`WEBASSEMBLY` 手册](https://rustwasm.github.io/docs/book/)
- [`Rust` 参数手册](https://doc.rust-lang.org/reference/index.html)