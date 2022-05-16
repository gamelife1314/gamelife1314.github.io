---
title: 【Rust】anyhow & thiserror
date: 2022-05-11 13:41:16
tags:
  - anyhow
  - thiserror
categories:
  - rust
---

`Rust` 中使用 [`std::result::Result`](https://doc.rust-lang.org/stable/std/result/enum.Result.html) 表示可能出错的操作，成功的时候是 `Ok(T)`，而出错的时候则是 `Err(E)`：

```rust
pub enum Result<T, E> {
    Ok(T),
    Err(E),
}
```

通常情况下，`E` 是实现 [`std::error::Error`](https://doc.rust-lang.org/stable/std/error/trait.Error.html) 的错误类型：

```rust
pub trait Error: Debug + Display {
    fn source(&self) -> Option<&(dyn Error + 'static)> { ... }
    fn backtrace(&self) -> Option<&Backtrace> { ... }
    fn description(&self) -> &str { ... }
    fn cause(&self) -> Option<&dyn Error> { ... }
}
```

我们通常也需要在自己的代码中自定义错误，并且为之手动实现 `std::error::Error`，这个工作很麻烦，所以就有了 `thiserror`，自动帮我们生成实现的 `std::error::Error` 的代码。

而借助于 `anyhow::Error`，和与之对应的 `Result<T, anyhow::Error>`，等价于 `anyhow::Result<T>`，我们可以使用 `?` 在可能失败的函数中传播任何实现了 `std::error::Error` 的错误。

<!-- more -->

### `thiserror`

可以使用命令 `cargo add thiserror` 将它添加到自己的项目中，或者在 `Cargo.toml` 中添加如下的配置：

```toml
[dependencies]
thiserror = "1.0"
```

`thiserror` 可以用于枚举或者结构体，例如，我们来看一个基本的例子：

```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum DataStoreError {
    #[error("data store disconnected")]
    Disconnect(#[from] std::io::Error),
    #[error("the data for key `{0}` is not available")]
    Redaction(String),
    #[error("invalid header (expected {expected:?}, found {found:?})")]
    InvalidHeader { expected: String, found: String },
    #[error("unknown data store error")]
    Unknown,
}
```

#### `#[error]`

如果使用 `#[error(...)]` 为结构体或者枚举生成自定义错误消息，这将为它们实现 `Display`：

```rust
use thiserror::Error;

#[derive(Error, Debug)]
#[error("something failed, msg is: {msg}")]
pub struct MyError {
    msg: &'static str,
}
```

我们可以在错误中插入字段的简写，一共有四种形式：

1. `#[error("{var}")]   <=> write!("{}", self.var)`
2. `#[error("{0}")]     <=> write!("{}", self.0)`
3. `#[error("{var:?}")] <=> write!("{:?}", self.var)`
4. `#[error("{0:?}")]   <=> write!("{:?}", self.0)`

例如：

```rust
use thiserror::Error;

pub fn first_char(s: &String) -> char {
    if s.len() == 0 {
        '-'
    } else {
        s.chars().next().unwrap_or('-')
    }
}

#[derive(Debug)]
pub struct Limits {
    lo: i16,
    hi: i16,
}

#[derive(Error, Debug)]
pub enum Error {
    #[error("invalid rdo_lookahead_frames {0} (expected < {})", i32::MAX)]
    InvalidLookahead(u32),
    #[error("first letter must be lowercase but was {:?}", first_char(.0))]
    WrongCase(String),
    #[error("invalid index {idx}, expected at least {} and at most {}", .limits.lo, .limits.hi)]
    OutOfBounds { idx: usize, limits: Limits },
}
```

#### `#[from]`

可以使用 `#[from]` 注解为错误类型实现 `From`，可以从其他错误生成：

```rust
#![allow(unused)]
#![feature(backtrace)]

use std::backtrace;
use std::error::Error as _;
use std::io;
use thiserror::Error;

#[derive(Error, Debug)]
#[error("some io error happened, {:?}", .source)]
pub struct MyError {
    #[from]
    source: io::Error,
    backtrace: backtrace::Backtrace,
}

fn main() {
    let err = MyError::from(io::Error::from(io::ErrorKind::TimedOut));
    println!("{:?}", err.source());
}
```

#### `#[source]`

可以使用 `#[source]` 属性，或者将字段命名为 `source`，可为自定义错误实现 `source` 方法，返回底层的错误类型：

```rust
use std::error::Error;
use std::io;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum MyError {
    #[error("some io error happened, {:?}", .source)]
    IO { source: io::Error },
}

fn main() {
    let err = MyError::IO {
        source: io::Error::from(io::ErrorKind::TimedOut),
    };
    println!("{:?}", err.source());
}
```

或者使用 `#[source]` 属性标记非 `source` 的字段，例如：这里是 `err` 字段：

```rust
use std::error::Error;
use std::io;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum MyError {
    #[error("some io error happened, {:?}", .err)]
    IO {
        #[source]
        err: io::Error,
    },
}

fn main() {
    let err = MyError::IO {
        err: io::Error::from(io::ErrorKind::TimedOut),
    };
    println!("{:?}", err.source());
}
```

`#[from]` 和 `#[source]` 二选一即可，`#[from]` 也会为类型生成 `.source()` 方法，例如：

```rust
#![allow(unused)]
#![feature(backtrace)]

use std::backtrace;
use std::error::Error as _;
use std::io;
use thiserror::Error;

#[derive(Error, Debug)]
#[error("some io error happened, {:?}", .source)]
pub struct MyError {
    #[from]
    source: io::Error,
    backtrace: backtrace::Backtrace,
}

fn main() {
    let err = MyError::from(io::Error::from(io::ErrorKind::TimedOut));
    println!("{:?}", err.source());
}
```

#### `#[backtrace]`

只要在我们的错误结构体里面放个类型为 `std::backtrace::Backtrace` 的字段，就会自动实现 `backtrace()` 方法，可以看 [`#[from]`](#from)。

另外，如果使用 `#[backtrace]` 标记 `source`（`source`字段，或者 `#[source]`，或者 `#[from]`），那么 `backtrace()` 方法会转发到 `source` 的 `backtrace`。

文档里面的例子（没理解，以后再来改）：

```rust
#[derive(Error, Debug)]
pub enum MyError {
    Io {
        #[backtrace]
        source: io::Error,
    },
}
```

#### `#[error(transparent)]`

可以通过 `#[error(transparent)]` 让 `source` 和 `Display` 直接使用底层的错误，这对于那些想处理任何的枚举来说是很有用的：

{% tabs error(transparent) %}

<!-- tab 示例一 -->
```rust
#![allow(unused)]

use anyhow::anyhow;
use std::error::Error as _;
use std::io;
use thiserror::Error;

#[derive(Error, Debug)]
#[error(transparent)]
pub struct MyError {
    #[from]
    source: anyhow::Error,
}

fn main() {
    let err = MyError::from(anyhow!("Missing attribute: {}", "field1"));
    println!("{:?}", err);
}
```
<!-- endtab -->

<!-- tab 示例二 -->
```rust
#![allow(unused)]

use anyhow::anyhow;
use std::error::{self, Error as _};
use std::io;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum MyError {
    #[error("file not found")]
    FileNotFound,
    #[error(transparent)]
    Other(#[from] anyhow::Error), // source and Display delegate to anyhow::Error
}

fn main() {
    let err = MyError::from(anyhow!("Missing attribute: {}", "field1"));
    println!("{:?}", err);
}

```
<!-- endtab -->

{% endtabs %}

### `anyhow`

[`anyhow::Error`](https://docs.rs/anyhow/1.0.57/anyhow/struct.Error.html) 是这个 `crate` 中最重要的结构体，它是动态错误类型的包装器，能从所有实现了 [`std::error::Error + Send + Sync + 'static`](https://docs.rs/anyhow/1.0.57/anyhow/struct.Error.html#impl-From%3CE%3E) 的错误转换而来，也能转换成 [`Box<dyn std::error::Error + Send + Sync + 'static>`](https://docs.rs/anyhow/1.0.57/anyhow/struct.Error.html#impl-From%3CError%3E)，它有以下特点：

1. `anyhow::Error` 要求包裹的错误必须是 `Send + Sync + 'static`；
2. `anyhow::Error` 保证 `backtrace` 是可用的，就是底层的错误类型没有提供；
3. `anyhow::Error` 在内存中只占一个机器字而不是两个；

如果我们要将 `anyhow::Error` 以文本形式展出来，可以有下面几种形式：

1. 可以使用 `{}` 或者 `.to_string()`，但是仅仅打印最外层错误或者上下文，而不是内层的错误；
2. 可以使用 `{:#}` 打印外层和底层错误；
3. 可以使用 `{:?}` 在调试模式打印错误以及调用栈；
4. 可以使用 `{:#?}` 以结构体样式打印错误，例如：

    ```
    Error {
        context: "Failed to read instrs from ./path/to/instrs.json",
        source: Os {
            code: 2,
            kind: NotFound,
            message: "No such file or directory",
        },
    }
    ```

另外，既然 `anyhow::Error` 包装了底层的错误，那就得提供找到内层错误的方法，这里是 `downcast_ref`：

```rust
#![allow(unused)]

use anyhow::{anyhow, bail};
use std::io;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum DataStoreError {
    #[error("the data for key `{0}` is not available")]
    Redaction(String),
}

fn foo() -> anyhow::Result<()> {
    // 使用 ？运算符能将任何实现了 std::error::Error + Send + Sync + 'static 的错误转换为 anyhow::Error
    std::fs::read_to_string("config.json")?;
    Ok(())
}

fn main() {
    match foo() {
        Ok(()) => (),
        Err(ref root_cause) => {
            let err = root_cause.downcast_ref::<DataStoreError>();
            match err {
                Some(DataStoreError::Redaction(_)) => (),
                None => (),
            }
            println!("{:#?}", root_cause);
        }
    }
}
```

#### `anyhow!`

使用 [`anyhow!`](https://docs.rs/anyhow/1.0.57/anyhow/macro.anyhow.html) 这个宏可以生成 [`anyhow::Error`](https://docs.rs/anyhow/1.0.57/anyhow/struct.Error.html)类型的值，它可以接受字符串，格式化字符串作为参数，或者实现 `std::error:Error` 的错误作为参数。

```rust
use anyhow::{anyhow, Result};

fn lookup(key: &str) -> Result<V> {
    if key.len() != 16 {
        return Err(anyhow!("key length must be 16 characters, got {:?}", key));
    }

    // ...
}
```

或者从实现了 `std::error::Error` 的错误转换而来：

```rust
use anyhow::anyhow;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum DataStoreError {
    #[error("the data for key `{0}` is not available")]
    Redaction(String),
}

fn bar() -> std::result::Result<(), DataStoreError> {
    Err(DataStoreError::Redaction("".to_owned()))
}

fn foo1() -> anyhow::Result<()> {
    let a = bar()?;
    Ok(())
}

fn foo2() -> anyhow::Result<()> {
    Err(anyhow::Error::from(DataStoreError::Redaction(
        "".to_string(),
    )))
}

fn foo3() -> anyhow::Result<()> {
    Err(anyhow!(DataStoreError::Redaction("".to_owned())))
}

fn main() {}
```

又或者：

```rust
use anyhow::anyhow;

fn foo() -> anyhow::Result<()> {
    Err(anyhow!("missing {} field", "f1"))
}
```

#### `bail!`

[`anyhow::bail`](https://docs.rs/anyhow/1.0.57/anyhow/macro.bail.html) 宏用于提前错误返回，它等价于 `return Err(anyhow!($args...))`，包含这个宏的函数的返回值必须是 `Result<_,anyhow::Error>`：

```rust
use anyhow::{anyhow, bail};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum DataStoreError {
    #[error("the data for key `{0}` is not available")]
    Redaction(String),
}

fn foo(i: i16) -> anyhow::Result<()> {
    if i < 0 {
        bail!(DataStoreError::Redaction("something wrong".to_string()));
    }
    Ok(())
}
```

#### `anyhow::Context`

[`anyhow::Context`](https://docs.rs/anyhow/1.0.57/anyhow/trait.Context.html) 为 `anyhow::Result` 类型提供了 `context` 方法，能在错误发生时提供更多的上下文信息：

```rust
use anyhow::{anyhow, Context, Result};
use std::fs;
use std::path::PathBuf;

pub struct ImportantThing {
    path: PathBuf,
}

impl ImportantThing {
    pub fn detach(&mut self) -> Result<()> {
        Err(anyhow!("detach faield"))
    }
}

pub fn do_it(mut it: ImportantThing) -> Result<Vec<u8>> {
    it.detach()
        .context("Failed to detach the important thing")?;

    let path = &it.path;
    let content =
        fs::read(path).with_context(|| format!("Failed to read instrs from {}", path.display()))?;

    Ok(content)
}

fn main() {
    let mut it = ImportantThing {
        path: PathBuf::new(),
    };
    match do_it(it) {
        Ok(_) => (),
        Err(ref err) => {
            for cause in err.chain() {
                println!("{}", cause);
            }
        }
    }
}
```

这段代码将输出：

    Failed to detach the important thing
    detach faield


对于下面的代码也是输出：

```rust
pub fn do_it(it: &mut ImportantThing) -> Result<Vec<u8>> {
    let path = &it.path;
    let content =
        fs::read(path).with_context(|| format!("Failed to read instrs from {}", path.display()))?;

    Ok(content)
}

fn main() {
    let mut it = ImportantThing {
        path: PathBuf::new(),
    };
    match do_it(&mut it) {
        Ok(_) => (),
        Err(ref err) => {
            for cause in err.chain() {
                println!("{}", cause);
            }
        }
    }
}
```

将输出：

    Failed to read instrs from 
    No such file or directory (os error 2)