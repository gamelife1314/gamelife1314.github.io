---
title: 【Rust】Crate 和 Module
date: 2022-04-22 21:29:26
tags:
  - Crate
  - Module
  - 《Rust 程序设计》
categories:
  - rust
---


### Crates

`Rust` 程序是由 `crate` 组成的。 每个 `crate` 都是一个完整的的单元：单个库或可执行文件的所有源代码，以及任何相关的测试、示例、工具、配置和其他东西。 可以使用 `cargo build --verbose` 查看项目中使用了哪些 `crates`。

通常项目的依赖都是配置在 `Cargo.toml` 文件中，例如：

```toml
[dependencies]
num = "0.4"
image = "0.13"
crossbeam = "0.8"
```

可以通过 `cargo build` 或者 `cargo install` 下载依赖代码。一旦有了源代码，`Cargo` 就会编译所有的 `crate`。 它为项目依赖图中的每个 `crate` 运行一次 `rustc`，即 `Rust` 编译器。 编译库时，`Cargo` 使用 `--crate-type lib` 选项。 这告诉 `rustc` 不要寻找 `main()` 函数，而是生成一个 `.rlib` 文件，其中包含可用于创建二进制文件和其他 `.rlib` 文件的编译代码。例如：

```
rustc --crate-name num --edition=2018 /Users/fudenglong/.cargo/registry/src/mirrors.ustc.edu.cn-61ef6e0cd06fb9b8/num-0.4.0/src/lib.rs --error-format=json --json=diagnostic-rendered-ansi,artifacts,future-incompat --crate-type lib --emit=dep-info,metadata,link -C embed-bitcode=no -C split-debuginfo=unpacked -C debuginfo=2 --cfg 'feature="default"' --cfg 'feature="num-bigint"' --cfg 'feature="std"' -C metadata=b84820de50dc7f78 -C extra-filename=-b84820de50dc7f78 --out-dir /Users/fudenglong/WORKDIR/rust/mandelbrot/target/debug/deps -L dependency=/Users/fudenglong/WORKDIR/rust/mandelbrot/target/debug/deps --extern num_bigint=/Users/fudenglong/WORKDIR/rust/mandelbrot/target/debug/deps/libnum_bigint-bd772250e89d4bb9.rmeta --extern num_complex=/Users/fudenglong/WORKDIR/rust/mandelbrot/target/debug/deps/libnum_complex-d3fd80f953e1ac52.rmeta --extern num_integer=/Users/fudenglong/WORKDIR/rust/mandelbrot/target/debug/deps/libnum_integer-7ff0466209086397.rmeta --extern num_iter=/Users/fudenglong/WORKDIR/rust/mandelbrot/target/debug/deps/libnum_iter-2b149e71dbad2afc.rmeta --extern num_rational=/Users/fudenglong/WORKDIR/rust/mandelbrot/target/debug/deps/libnum_rational-1686ad6eb82c18d4.rmeta --extern num_traits=/Users/fudenglong/WORKDIR/rust/mandelbrot/target/debug/deps/libnum_traits-deaceb32c41a04f1.rmeta --cap-lints allow
```

对于每个 `rustc` 命令，`Cargo` 都会传递 `--extern` 选项，给出 `crate` 将使用的每个库的文件名。 这样，当 `rustc` 看到像 `use num::bigint::BigInt;` 这样的代码行时，它可以确定 `num` 是另一个 `crate` 的名称，并且通过 `Cargo`，可以在磁盘上找到已编译的 `crate`。 `Rust` 编译器需要访问这些 `.rlib` 文件，因为它们包含库的编译代码， `Rust` 会将该代码静态链接到最终的可执行文件中。 `.rlib` 还包含类型信息，因此 `Rust` 可以检查我们在代码中使用的库功能是否确实存在，以及我们是否正确使用它们， 它还包含 `crate` 的公共内联函数、泛型和宏的副本等。

如果编译程序时，`Cargo` 使用 `--crate-type bin`，结果将会生成目标平台的二进制可执行文件。

<!-- more -->

### Edition

`Rust` 具有极强的兼容性保证。 在 `Rust 1.0` 上编译的任何代码都必须在 `Rust 1.50` 上编译。 但有时社区会遇到令人信服的扩展语言的提议，这会导致旧代码不再编译。 例如，经过多次讨论，`Rust` 确定了一种支持异步编程的语法，将标识符 `async` 和 `await` 重新用作关键字。 但是这种语言更改会破坏任何使用 `async` 或 `await` 作为变量名称的现有代码。

为了在不破坏现有代码的情况下发展，`Rust` 使用 `Edition`。 `Rust 2015` 版与 `Rust 1.0` 兼容。 `2018` 将 `async` 和 `await` 更改为关键字，简化了模块系统，并引入了与 `2015` 不兼容的各种其他语言更改。打开 `Cargo.toml` 我们会看到如下的 `Edition` 声明，默认是 `2015`：

```toml
[package]
name = "mandelbrot"
version = "0.1.0"
edition = "2021"
```

`Rust` 的编译器承诺始终接受该语言的所有现存版本，并且程序可以自由地混合使用不同版本编写的 `crate`，例如，`2015` 的 `crate` 依赖于 `2018` 的 `crate` 甚至可以，换句话说，一个 `crate` 的版本只影响其源代码的解释方式，代码编译完成之后，就没有所谓的 `Edition` 区分了，在学要使用语言的新功能时，我们只需要修改 `Edition`即可。

版本不会每年都发布，只有在 `Rust` 项目决定需要时才会发布。 例如，没有 `2020` 年版。 将版本设置为 `2020` 会导致错误。 `Rust` [版本指南](https://doc.rust-lang.org/stable/edition-guide/)涵盖了每个版本中引入的更改，并提供了版本系统的良好背景。 对于新代码，建议总是使用最新的版本。 `cargo new` 默认在最新版本上创建新项目。如果有一个用旧版 `Rust` 编写的 `crate`，`cargo fix` 命令会帮助你自动将代码升级到新版本。

### Profile

配置文件提供了一种更改编译器设置的方法，影响优化和调试符号等内容。`Cargo` 有 `4` 个内置配置文件：`dev`、`release`、`test` 和 `bench`。如果未在命令行上指定配置文件，则会根据正在运行的命令自动选择配置文件。除了内置配置文件外，还可以指定自定义的用户定义配置文件。

可以使用 `[profile]` 在 `Cargo.toml` 中更改配置文件设置，在每个命名配置文件中，可以使用如下键/值对更改各个设置：

```
[profile.dev]
opt-level = 1               # Use slightly better optimizations.
overflow-checks = false     # Disable integer overflow checks.
```

`cargo build` 会使用 `[profile.dev]` 的配置，`cargo build --release` 会使用 `[profile.release]` 的配置，`cargo test` 使用 `[profile.test]` 中的配置。

更多详细的内容请看 [Cargo Profiles](https://doc.rust-lang.org/cargo/reference/profiles.html)。

### Module

`crate` 就是第三方模块，用于项目之间的代码共享，而 `Module` 是项目内的代码组织。它们充当 `Rust` 的命名空间、构成 `Rust` 程序或库的函数、类型、常量等的容器。一个模块如下所示：

```rust
mod spores {
  use cells::{Cell, Gene};
  /// A cell made by an adult fern. It disperses on the wind as part of
  /// the fern life cycle. A spore grows into a prothallus -- a whole
  /// separate organism, up to 5mm across -- which produces the zygote
  /// that grows into a new fern. (Plant sex is complicated.)
  pub struct Spore {
    ...
  }
  /// Simulate the production of a spore by meiosis.
  pub fn produce_spore(factory: &mut Sporangium) -> Spore {
    ...
  }
  /// Extract the genes in a particular spore.
  pub(crate) fn genes(spore: &Spore) -> Vec<Gene> {
    ...
  }
  /// Mix genes to prepare for meiosis (part of interphase).
  fn recombine(parent: &mut Cell) {
    ...
  }
  ...
}
```

本例中，模块是 `Spore` 结构和两个函数的集合。 `pub` 关键字使得标记的项公开，因此可以从模块外部访问它。

一个函数被标记为 `pub(crate)`，这意味着它在这个 `crate` 内的任何地方都可用，但不作为外部接口的一部分公开。 它不能被其他 `crate` 使用，也不会出现在这个 `crate` 的文档中。

被标记为 `pub` 的项目通常称为**导出**该项目。任何未标记为 `pub` 的内容都是私有的，只能在定义它的同一模块或任何子模块中使用：

```rust
let s = spores::produce_spore(&mut factory); // ok
spores::recombine(&mut cell); // error: `recombine` is private
```

### 模块嵌套

模块可以嵌套，一个模块可能仅仅是子模块的集合：

```rust
mod plant_structures {
  pub mod roots {
  ...
  }
  pub mod stems {
  ...
  }
  pub mod leaves {
  ...
  }
}
```

如果希望嵌套模块中的项目对其他 `crate` 可见，必须将到达这个项的所有模块都标记为 `pub`。 也可以指定 `pub(super)`，使项目仅对父模块可见，以及 `pub(in <path>)`，使其在特定父模块及其后代中可见。 这对于深度嵌套的模块特别有用：

```rust
mod plant_structures {
  pub mod roots {
    pub mod products {
      pub(in crate::plant_structures::roots) struct Cytokinin {
        ...
      }
    }
    use products::Cytokinin; // ok: in `roots` module
  }
  use roots::products::Cytokinin; // error: `Cytokinin` is private
}

// error: `Cytokinin` is private
use plant_structures::roots::products::Cytokinin;
```

通过这种方式，我们可以编写一个完整的程序，包含大量代码和整个模块层次结构，以我们想要的任何方式组织起来，而所有这些都在一个源文件中。

### 模块和文件系统

如果将模块以单个文件形式组织，这种方式工作很痛苦，大型项目中往往需要拆分，将不同的功能的代码以不同的文件区分，使得代码在逻辑上，物理组织上都能很清晰。

#### 单文件模块

之前我们是在 `spores` 模块中使用括号将模块的内容包裹起来的，现在可以在单个源码文件中使用下面这样的方式声明一个模块:

```rust spores.rs
mod spores;

/// A cell made by an adult fern...
pub struct Spore {
   ...
}

/// Simulate the production of a spore by meiosis.
pub fn produce_spore(factory: &mut Sporangium) -> Spore {
 ...
}

/// Extract the genes in a particular spore.
pub(crate) fn genes(spore: &Spore) -> Vec<Gene> {
 ...
}

/// Mix genes to prepare for meiosis (part of interphase).
fn recombine(parent: &mut Cell) {
 ...
}
```

公开和私有的原则和之前讲的是相同的，`Rust` 从不单独编译模块，即使它们在单独的文件中：当你构建一个 `crate` 时，会重新编译它的所有模块。

#### 模块目录（一）

当 `Rust` 看到一个模块时，例如之前的 `mod spores;` 时，它会检查 `spores.rs` 和 `spores/mod.rs` 是否存在，如果都存在或者都不存在，就会报错。但是当我们的模块中包含子模块时，就不能像 `spores.rs` 那样单独处理了，就像之前的 `plant_structures` 模块。

如果，我们有下面这样的结构：

```
fern_sim/
├── Cargo.toml
└── src/
  ├── main.rs
  ├── spores.rs
  └── plant_structures/
    ├── mod.rs
    ├── leaves.rs
    ├── roots.rs
    └── stems.rs
```

在 `main.rs`，我们声明 `plant_structures` 模块，这会让 `Rust` 加载 `plant_structures/mod.rs`：

```rust main.rs
pub mod plant_structures;
```

然后，我们再声明子模块：

```rust plant_structures/mod.rs
pub mod roots;
pub mod stems;
pub mod leaves;
```

这三个模块的内容存储在名为 `leaves.rs`、`roots.rs` 和 `stems.rs` 的单独文件中，和 `plant_structures/mod.rs` 同级。

#### 模块目录（二）

我们也可以使用文件和目录一起组成模块，如果之前的 `stems` 需要包含 `xylem` 和 `phloem`，我们选择保留 `plant_structures/stems.rs`，然后再添加一个 `stems` 目录：

```
fern_sim/
├── Cargo.toml
└── src/
  ├── main.rs
  ├── spores.rs
  └── plant_structures/
    ├── mod.rs
    ├── leaves.rs
    ├── roots.rs
    ├── stems/
    │ ├── phloem.rs
    │ └── xylem.rs
    └── stems.rs
```

然后，我们可以在 `stems.rs` 中声明两个新模块：

```rust plant_structures/stems.rs
pub mod xylem;
pub mod phloem;
```

所以这里有三种模块组织方式：

- 模块在他们自己的文件中；
- 模块在他们自己的目录中，带有 `mod.rs`；
- 模块在他们自己的文件中，带有包含子模块的补充目录；

### 导入

`::` 操作符被用于访问其他模块的功能。

我们可以直接使用其他模块中的功能而不实现导入，例如：

```rust
std::mem::swap(&mut s1, &mut s2);
```

`std` 指向标准库的顶层模块，`mem` 是其中的一个子模块，`std::mem::swap` 只是其中的一个导出函数。上面的这种使用访问方式有点冗长，另一种方式是将要使用的功能导入当前的模块，使用 `use` 将 `std::mem` 引入到当前模块，并且定义新的别 `mem`：

```rust
use std::mem;
if s1 > s2 {
  mem::swap(&mut s1, &mut s2);
}
```

我们可以写 `use std::mem::swap;` 导入 `swap` 函数本身而不是 `mem` 模块。 但最好的方式是：导入类型、特征和模块（如 std::mem），然后使用相对路径访问其中的函数、常量和其他成员。例如：

```rust
use std::collections::{HashMap, HashSet}; // 同时导入
use std::fs::{self, File}; // 导入 `std::fs` 和 `std::fs::File`.
use std::io::prelude::*;  // import everything
```

我们也可以使用 `as` 对导入的名称进行重命名：

```rust
use std::io::Result as IOResult;
// This return type is just another way to write `std::io::Result<()>`:
fn save_spore(spore: &Spore) -> IOResult<()>
...
```

子模块不会自动导入父模块的内容，假设我们的 `proteins/mod.rs` 中内容是这样子的：

```rust proteins/mod.rs
pub enum AminoAcid { ... }
pub mod synthesis;
```

那么模块 `proteins/synthesis.rs` 中如果不导入 `AminoAcid` 是不能直接使用的：

{% note danger %}
```rust  proteins/synthesis.rs
pub fn synthesize(seq: &[AminoAcid]) // error: can't find type `AminoAcid`
```
{% endnote %}

而是，每个模块都是以一个空的状态开始的，必须手动导入它使用的任何内容：

{% note success %}
```rust  proteins/synthesis.rs
use super::AminoAcid; // explicitly import from parent

pub fn synthesize(seq: &[AminoAcid]) // error: can't find type `AminoAcid`
```
{% endnote %}

默认情况下，是从当前模块开始导入：

```rust proteins/mod.rs
pub mod synthesis;

pub enum AminoAcid { ... }

use synthesis::synthesize;  // 从 synthesis 子模块导入
```

`self` 是当模块的昵称，因此在 `proteins/mod.rs` 中可以这样写：

```rust proteins/mod.rs

// 这样可以直接用 Lys 而不是 `AminoAcid::Lys`
use self::AminoAcid::*;
```

也可以简化为：

```rust proteins/mod.rs
use AminoAcid::*;
```

除了从顶层模块导入，从 `self` 当前模块导入或者从当前的子模块导入之外，还可以通过 `super` 或者 `crate` 关键字进行导入，其中 `super` 表示父模块，而 `crate` 表示当前模块的 `crate`。

使用相对于 `crate` 根目录的导入而不是相对于当前路径的导入，有助于在项目中移动代码。因为如果当前模块的路径发生更改，所有导入都不会中断。例如：

```rust proteins/synthesis.rs
use crate::proteins::AminoAcid; // 显示从 crate 的根导入
pub fn synthesize(seq: &[AminoAcid]) // ok
```

之前看了从父模块导入子模块，但是如果从子模块导入父模块的内容，可以使用 `super::`。

如果你有一个和正在使用的 `crate` 同名的模块，在导入的时候就要注意了，否则会引起错误，例如，如果引用了 `image crate`，自己也有个 `image` 模块：

{% note danger %}
```rust
mod image {
  pub struct Sampler {
    ...
  }
}

// 错误：引入 image crate 还是 image 模块
use image::Pixels;
```
{% endnote %}

解决这个问题的方法是使用绝对导入，导入以 `::` 开始，例如，如果要导入 `image crate`，可以这样写：

```rust
use ::image::Pixels; // the `image` crate's `Pixels`
```

引入内部的 `image module` 可以这样写：

```rust
use self::image::Sampler; // the `image` module's `Sampler`
```

### 预导入

之前说每个模块都以空的状态开始，但其实也不完全是空的，因为 `Rust` 有很多常用的类型，为了简化编程，`Rust` 会帮我们导入，不用我们显示导入。例如：`Vec` 和 `Result`。 

自动导入的内容可以看这里，[std::prelude](https://doc.rust-lang.org/std/prelude/index.html)。


### 别名导出

`use` 只是将我们使用的内容从其他模块或者 `crate`导入并且在本模块起了个没别名，但是它也可以将导入的内容重新导出。例如：

```rust  plant_structures/mod.rs
pub use self::leaves::Leaf;
pub use self::roots::Root;
```

这意味着 `Leaf` 和 `Root` 是 `plant_structures` 模块中的公共内容。它们也仍然是 `self::leaves::Leaf` 和 `self::roots::Root` 的别名。

### 结构体导出

`module` 可以包含用户定义的结构体类型，使用 `struct` 关键字引入，它和它的字段也可以由 `pub` 声明是否导出。 一个简单的结构如下所示：

```rust
pub struct Fern {
  pub roots: RootSet,
  pub stems: StemSet
}
```

结构体的所有字段，甚至私有字段，都可以在声明结构体的模块及其子模块中访问。在模块之外，只能访问导出字段。

### 静态变量和常量

`const` 关键字引入了一个常量。 语法和 `let` 一样，只是它可能被标记为 `pub`，并且类型是必需的。 此外，大写名称对于常量来说是常规的：

```rust
pub const ROOM_TEMPERATURE: f64 = 20.0; // degrees Celsius
```

`static` 关键字引入了一个静态项，和 `const`：

```rust
pub static ROOM_TEMPERATURE: f64 = 68.0; // degrees Fahrenheit
```

常量有点像 `C` 中的 `#define`：值会被编译到使用的地方。静态变量是在程序开始运行之前设置并持续到退出的变量。 在代码中使用常量作为 `magic number` 和字符串，对大量数据或任何需要借用常量值的引用的时候使用静态。

没有 `mut` 类型常量， 静态变量可以标记为 `mut`，`Rust` 无法强制执行其关于对 `mut` 静态变量的独占访问的规则。 因此，它们本质上是非线程安全的，安全代码根本不能使用它们：

{% note danger%}
```rust
static mut PACKETS_SERVED: usize = 0;
println!("{} served", PACKETS_SERVED); // error: use of mutable static
```
{% endnote %}

Rust 不鼓励全局可变状态。

### 开发 library 项目

如果想要将项目编译成一个 `lib` 而不是一个可执行文件，我们只需要三步：

- 将 `src/main.rs` 重命名成 `src/lib.js`；

- 添加 `pub` 关键字给 `src/lib.js` 中的导出内容；

- 移除  `src/main.rs` 中的 `main` 函数。

我们不需要更改 `Cargo.toml` 中的任何内容， 默认情况下，`cargo build` 查看源目录中的文件并确定要构建的内容。 当它看到文件 `src/lib.rs` 时，就知道需要去构建一个 `lib`。

`src/lib.rs` 中的代码构成了库的根模块。 使用我们的其他 `crate` 只能访问此根模块的公共项目。


### `src/bin` 目录

我们可以让一个项目是 `lib`，也可以让它同时编译一个可执行程序，只是需要将 `main` 函数移到目录 `sr/bin` 中，而且可以有多个 `main` 函数，例如我的项目结构如下：

```
~/WORKDIR/rust/mandelbrot 20:15:24
$ tree --help -l 4
▁
/Users/fudenglong/WORKDIR/rust/mandelbrot
├── Cargo.lock
├── Cargo.toml
├── package-lock.json
├── package.json
└── src
   ├── bin
   |  ├── mandelbrot.rs
   |  └── mandelbrot_v2
   |     └── main.rs
   └── lib.rs
~/WORKDIR/rust/mandelbrot 20:15:28
```

各个文件的内容如下：

{% tabs rust项目结构 %}

<!-- tab src/lib.rs -->
```rust
use num::bigint::BigInt;
use num::rational::{BigRational, Ratio};
use num::FromPrimitive;

pub fn approx_sqrt(number: u64, iterations: usize) -> BigRational {
    let start: Ratio<BigInt> = Ratio::from_integer(FromPrimitive::from_u64(number).unwrap());
    let mut approx = start.clone();

    for _ in 0..iterations {
        approx = (&approx + (&start / &approx))
            / Ratio::from_integer(FromPrimitive::from_u64(2).unwrap());
    }
    approx
}
```
<!-- endtab -->

<!-- tab src/bin/mandelbrot.js -->
```rust
use mandelbrot::approx_sqrt;

fn main() {
    println!("{}", approx_sqrt(10, 4)); // prints 4057691201/1283082416
}
```
<!-- endtab -->

<!-- tab src/bin/mandelbrot_v2/mandelbrot.js -->
```rust
use mandelbrot::approx_sqrt;

fn main() {
    println!("{}", approx_sqrt(10, 4)); // prints 4057691201/1283082416
}
```
<!-- endtab -->


<!-- tab Cargo.toml -->

```toml
[package]
name = "mandelbrot"
version = "0.1.0"
edition = "2021"

# See more keys and their definitions at https://doc.rust-lang.org/cargo/reference/manifest.html

[dependencies]
num = "0.4"
```
<!-- endtab -->
{% endtabs %}

我们可以指定运行不同的 `main` 函数：

    ~/WORKDIR/rust/mandelbrot 20:25:13
    $ cargo run --bin mandelbrot
        Finished dev [unoptimized + debuginfo] target(s) in 0.00s
        Running `target/debug/mandelbrot`
    4057691201/1283082416

    ~/WORKDIR/rust/mandelbrot 20:25:15
    $ cargo run --bin mandelbrot_v2
      Compiling mandelbrot v0.1.0 (/Users/fudenglong/WORKDIR/rust/mandelbrot)
        Finished dev [unoptimized + debuginfo] target(s) in 0.15s
        Running `target/debug/mandelbrot_v2`
    4057691201/1283082416

### 属性

`Rust` 程序中的任何项目都可以用属性进行修饰。 属性是`Rust`用于向编译器编写杂项指令和建议的语法。 例如，假设您收到以下警告：

    libgit2.rs: warning: type `git_revspec` should have a camel case name
    such as `GitRevspec`, #[warn(non_camel_case_types)] on by default

但是你选择这个名字是有原因的，你希望屏蔽这个告警，可以通过在类型上添加 `#[allow]` 完成：

```rust
#[allow(non_camel_case_types)]
pub struct git_revspec {
  ...
}
```

条件编译是使用属性编写的另一个功能，即 `#[cfg]`：

```rust
// 只有在编译安卓平台的项目时包含这个模块
#[cfg(target_os = "android")]
mod mobile;
```

`#[cfg]` 常用的属性可以看 [条件编译](https://www.rustwiki.org.cn/zh-CN/reference/conditional-compilation.html)。

给函数添加 `#[inline]` 属性可以建议编译器根据情况决定是否内联函数。

```rust
#[inline]
fn do_osmosis(c1: &mut Cell, c2: &mut Cell) {
 ...
}
```

当一个 `crate` 中定义的函数或方法在另一个 `crate` 中被调用时，`Rust` 不会内联它，除非它是泛型的或显式标记为 `#[inline]`。`Rust` 还支持更坚持的 `#[inline(always)]`，要求在每个调用站点内联扩展函数，并支持 `#[inline(never)]`，要求永远不要内联函数。

一些属性，如`#[cfg]` 和`#[allow]`，可以附加到整个模块并应用于其中的所有内容。 其他的，如`#[test]` 和`#[inline]`，必须附加到单个项目，每个属性都是可以指定参数进行定制，这里看[完整的属性列表](https://www.rustwiki.org.cn/zh-CN/reference/items.html)。

要将属性附加到整个 `crate`，请将其添加到 `main.rs` 或 `lib.rs` 文件的顶部，在任何内容之前，然后写 `#!` 而不是`#`，像这样：


```rust libgit2_sys/lib.rs
#![allow(non_camel_case_types)]

pub struct git_revspec {
 ...
}

pub struct git_error {
 ...
}
```

`#!` 通常只用于文件的开头，用于将属性附加到整个模块或 crate。 某些属性总是使用 #! 语法，因为它们只能应用于整个 crate。 例如，#![feature] 属性用于打开 Rust 语言和库的不稳定特性，这些特性是实验性的，因此可能存在错误，或者将来可能会被更改或删除。

例如，`Rust` 为跟踪宏的扩展提供了实验性支持，比如 `assert!`，但是由于这种支持是实验性的，你只能通过 

- (1) 安装 `nightly` 版本的 `Rust`；
- (2) 来使用`#![feature(trace_macros)]`明确声明您的 `crate` 使用宏跟踪；

```rust
#![feature(trace_macros)]
fn main() {
  // I wonder what actual Rust code this use of assert_eq!
  // gets replaced with!
  trace_macros!(true);
  assert_eq!(10*10*10 + 9*9*9, 12*12*12 + 1*1*1);
  trace_macros!(false);
}
```

