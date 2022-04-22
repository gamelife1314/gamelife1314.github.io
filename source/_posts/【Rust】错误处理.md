---
title: 【Rust】错误处理
date: 2022-04-21 17:17:46
tags:
  - 错误处理
  - 《Rust 程序设计》
categories:
  - rust
---

Rust 的错误处理方法非常不同寻常，本节介绍了 Rust 中两种不同类型的错误处理：`panic` 和 `result`。

### Panic

当程序遇到一些很严重的bug，就会奔溃，例如：数组越界，除0，在 `Result` 上调用 `.expect()` 遇到错误以及断言失败等。

还有宏 `panic!()`，用于在代码发现它出错是，想要直接退出。 `panic!()` 接受可选的 `println!()` 样式参数，用于构建错误消息。

这些都是程序员的错，但我们都会犯错，当这些不应该发生的错误发生时，`Rust` 可以终止进程。

来看一个除的示例：

{% note danger %}

```rust
fn main() {
    pirate_share(100, 0);
}

fn pirate_share(total: u64, crew_size: usize) -> u64 {
    let half = total / 2;
    half / crew_size as u64
}
```

运行这段代码，程序会奔溃的并且打印出调用栈，还提示我们可以设置 `RUST_BACKTRACE=full` 获得更多的信息：

    /Users/fudenglong/.cargo/bin/cargo run --color=always --package mandelbrot --bin mandelbrot
        Finished dev [unoptimized + debuginfo] target(s) in 0.00s
        Running `target/debug/mandelbrot`
    thread 'main' panicked at 'attempt to divide by zero', src/main.rs:7:5
    stack backtrace:
    0: rust_begin_unwind
                at /rustc/4ca19e09d302a4cbde14f9cb1bc109179dc824cd/library/std/src/panicking.rs:584:5
    1: core::panicking::panic_fmt
                at /rustc/4ca19e09d302a4cbde14f9cb1bc109179dc824cd/library/core/src/panicking.rs:142:14
    2: core::panicking::panic
                at /rustc/4ca19e09d302a4cbde14f9cb1bc109179dc824cd/library/core/src/panicking.rs:48:5
    3: mandelbrot::pirate_share
                at ./src/main.rs:7:5
    4: mandelbrot::main
                at ./src/main.rs:2:5
    5: core::ops::function::FnOnce::call_once
                at /rustc/4ca19e09d302a4cbde14f9cb1bc109179dc824cd/library/core/src/ops/function.rs:248:5
    note: Some details are omitted, run with `RUST_BACKTRACE=full` for a verbose backtrace.

    Process finished with exit code 101

{% endnote %}

线程之间的 `panic` 是相互独立的，也可以调用 `std::panic::catch_unwind()` 捕获异常，并且让程序执行。默认发生 `panic` 时会展开堆栈。此外有两种情况 Rust 不会尝试展开堆栈。 

- 如果 `.drop()` 方法触发了第二次恐慌，而 `Rust` 在第一次之后仍在尝试清理，这被认为是致命的。 `Rust` 停止展开并中止整个过程。 

- `Rust` 的恐慌行为是可定制的。 如果使用 `-C panic=abort` 编译，程序中的第一个 `panic` 会立即中止进程。（使用这个选项，`Rust` 不需要知道如何展开堆栈，因此这可以减少编译代码的大小。）

<!-- more -->

### Result

`Rust` 中没有异常，而是再回出现错误的函数中会返回一个 `Result` 类型，它预示着函数会预期执行成功，也可能因异常执失败。当我们调用函数 `get_weather` 的时候，要么成功返回 `Ok(weather)`，`weather` 是 `WeatherReport` 的一个实例。或者出现错误时返回 `t Err(error_value)`，其中 `error_value` 是 `io:Error` 类型。

```rust
fn get_weather(location: LatLng) -> Result<WeatherReport, io::Error>
```

每当我们调用这个函数时，`Rust` 要求我们编写错误处理程序。 如果不对 `Result` 做一些处理，我们就无法获取 `WeatherReport`，如果未使用 `Result` 值，编译器就会警告。

### 捕获错误

处理 `Result` 类型最直接的方式是使用 `match` 表达式，这类似于其他语言中 `try/catch`：

```rust
match get_weather(hometown) {
    Ok(report) => {
        display_weather(hometown, &report);
    }
    Err(err) => {
        println!("error querying the weather: {}", err);
        schedule_weather_retry();
    }
}
```

`match` 可以处理，但看起来似乎有点冗长。因此 `Result<T, E>` 提供了很多方法使用，全部方法可以阅读 [https://doc.rust-lang.org/std/result/enum.Result.html](https://doc.rust-lang.org/std/result/enum.Result.html)，下面是一些常用的方法列表：

- `result.is_ok(), result.is_err()`：返回一个 `bool` 表示执行成功还是遇到错误；

- `result.ok()`：以 `Option(T)` 的形式返回成功值，如果结果是成功的则返回 `Some(success_value)`，否则返回 `None`；

- `result.err()`：以 `Option(T)` 的返回错误值；

- `result.unwrap_or(fallback)`：如果有的话返回成功值，否则返回备选值，丢掉错误；

    ```rust
   
    // A fairly safe prediction for Southern California.
    const THE_USUAL: WeatherReport = WeatherReport::Sunny(72);

    // Get a real weather report, if possible.
    // If not, fall back on the usual.
    let report = get_weather(los_angeles).unwrap_or(THE_USUAL);
    display_weather(los_angeles, &report);
    ```

    相比 `.ok()` 来说它是比较好的，因为返回的是 `T` 而不是 `Option<T>`，但是只有在存在备选值得时候才有效。

- `result.unwrap_or_else(fallback_fn)`：和前面的方法是一样的，不同的是，它需要传递一个函数或闭包。这适用于在错误时有自定义逻辑处理的情况：

    ```rust
    let report =
        get_weather(hometown)
        .unwrap_or_else(|_err| vague_prediction(hometown));
    ```

- `result.unwrap()`：如果 `result` 是成功的，则返回成功值，否则将会 `panic`；

- `result.expect(message)`：类似于 `unwrap()`，但是允许一共一个信息在 `panic` 时打印；

- `result.as_ref()`：将 `Result<T, E>` 转换为 `Result<&T, &E>`；

- `result.as_mut()`：将 `Result<T, E>` 转换为 `Result<&mut T, &mut E>`；

最后这两个方法和除 `.is_ok()` 和 `.is_err()` 之外的方法不同，其他的都会消耗 `result` 的值，也就是它们会获取 `result` 的所有权，它们都是接受 `self` 作为参数。但是有时候我们想在不破坏数据的情况下访问数据，例如，我们想调用 `result.ok()`，又想保持 `result` 在我们调用之后任然可用，所以我们可以编写 `result.as_ref().ok()`，他只是借用 `result` 而不获取它的所有权，当然返回的也就是 `Option<&T>` 不再是 `Option<T>`。

### Result 别名

我们可以给 `Result<T, E>` 起个别名，让写起来更加简单，就像 [`std::fs::remove_file`](https://doc.rust-lang.org/std/fs/fn.remove_file.html) 函数：

```rust
pub fn remove_file<P: AsRef<Path>>(path: P) -> Result<()>
```

模块通常定义一个 Result 类型别名，以避免必须重复模块中几乎每个函数都一致使用的错误类型。 例如，标准库的 `std::io` 模块包括这行代码：

```rust
pub type Result<T> = result::Result<T, Error>;
```

这定义了一个公共类型 `std::io::Result<T>`。 它是 `Result<T, E>` 的别名，但将 `std::io::Error` 硬编码为错误类型。 实际上，这意味着如果您编写 `use std::io`;，那么 `Rust` 会将 `io::Result<String>` 理解为 `Result<String, io::Error>` 的简写。

### 错误打印

我们经常处理错误的方式就是将错误信息打印出来，然后程序继续执行。我们之前都是用 `println!()` 这个宏来完成的，例如：

```rust
println!("error querying the weather: {}", err);
```

标注库里面提供了很多错误类型，例如 `std::io::Error`，`std::fmt::Error` 和 `std::str::Utf8Error` 等等，但是它们都实现了 `std::error::Error` 这个 `trait`，这意味着所有的错误都有下面的接口：

- `println!()`：所有错误类型都可以使用它打印。 使用 `{}` 格式说明符打印错误通常只显示简短的错误消息。 或者可以使用 `{:?}` ，以获取错误的调试视图， 这对用户不太友好，但包含额外的技术信息；

    ```
    // result of `println!("error: {}", err);`
    error: failed to lookup address information: No address associated with
    hostname

    // result of `println!("error: {:?}", err);`
    error: Error { repr: Custom(Custom { kind: Other, error: StringError(
    "failed to lookup address information: No address associated with
    hostname") }) }
    ```

- `err.to_string()`：返回一个错误信息作为 `String`；

- `err.source()`：返回底层的 `err`。例如，网络原因导致银行交易失败，然后又导致你的转账被取消，那么 `err.souce()` 可以返回下层的错误。

打印错误值不会同时打印出其来源。 如果想确保打印所有可用信息，使用下面的代码示例：

```rust
use std::error::Error;
use std::io::{Write, stderr};
/// Dump an error message to `stderr`.
///
/// If another error happens while building the error message or
/// writing to `stderr`, it is ignored.
fn print_error(mut err: &dyn Error) {
    let _ = writeln!(stderr(), "error: {}", err);
    while let Some(source) = err.source() {
        let _ = writeln!(stderr(), "caused by: {}", source);
        err = source;
    }
}
```

`writeln!` 宏的工作方式与 `println!` 类似，不同之处在于它将数据写入你选择的流。 在这里，我们将错误消息写入标准错误流 `std::io::stderr`。 我们可以使用 `eprintln!` 宏做同样的事情，但 `eprintln!` 如果发生错误会 `panic`。

### 错误传播

`Rust` 中有个 `?` 操作符，用于向上传播错误。主要的应用场景是，当我们调用函数遇到错误，但又不想立即处理，只是想把这个错误继续往外传播，让最外层的调用者处理，我们就可以使用它：

```rust
let weather = get_weather(hometown)?;
```

`?` 这个操作符的行为取决于 `get_weather` 函数返回成功结果还是错误结果：

- 成功时，它会获取里面成功的值，也就是获取 `WeatherReport`，而不是 `Result<WeatherReport, io::Error>`；

- 出错时，它会立即返回，为了确保有效，`?` 只能用于具有 `Result` 返回类型函数中的 `Result`；

`?` 可以看做是 `match` 的一种简化方式：

```rust
let weather = match get_weather(hometown) {
    Ok(success_value) => success_value,
    Err(err) => return Err(err)
};
```

在 `Rust` 较老的代码中，这个干工作是用 `try!` 宏处理的，直到 `1.13` 引入 `?`。

```rust
let weather = try!(get_weather(hometown)
```

错误在程序中是非常普遍，尤其是在与操作系统接口的代码中， 因此 `?` 运算符可能会出现在函数的每一行：

```rust
use std::fs;
use std::io;
use std::path::Path;
fn move_all(src: &Path, dst: &Path) -> io::Result<()> {
    for entry_result in src.read_dir()? { // opening dir could fail
        let entry = entry_result?; // reading dir could fail
        let dst_file = dst.join(entry.file_name());
        fs::rename(entry.path(), dst_file)?; // renaming could fail
    }
    Ok(()) // phew!
}
```

`?` 也可以用于 `Option` 类型，道理和 `Result` 是相同的。


### 处理不同类型错误

有时候，在一个函数中会遇到多种类型的错误，而函数的返回类型是固定的，如果我们使用 `?` 向上传播错误就会遇到问题，错误类型不匹配，例如：

{% note danger %}

```rust
use std::io::{self, BufRead};

/// Read integers from a text file.
/// The file should have one number on each line.
fn read_numbers(file: &mut dyn BufRead) -> Result<Vec<i64>, io::Error> {
    let mut numbers = vec![];
    for line_result in file.lines() {
        let line = line_result?; // reading lines can fail
        numbers.push(line.parse()?); // parsing integers can fail
    }
    Ok(numbers)
}
```

编译这段代码，会看到如下的错误，总结来说就是 `line.parse()` 返回的错误没法转换成 `io::Error`，因为 `line.parse()` 返回的是 `Result<i64 std::num::ParseIntError>`，`ParseIntError` 没法转换成 `io::Error`：

    error[E0277]: `?` couldn't convert the error to `std::io::Error`
    --> src/main.rs:9:34
    |
    5 | fn read_numbers(file: &mut dyn BufRead) -> Result<Vec<i64>, io::Error> {
    |                                            --------------------------- expected `std::io::Error` because of this
    ...
    9 |         numbers.push(line.parse()?); // parsing integers can fail
    |                                  ^ the trait `From<ParseIntError>` is not implemented for `std::io::Error`
    |
    = note: the question mark operation (`?`) implicitly performs a conversion on the error value using the `From` trait
    = help: the following other types implement trait `From<T>`:
                <std::io::Error as From<ErrorKind>>
                <std::io::Error as From<IntoInnerError<W>>>
                <std::io::Error as From<alloc::ffi::c_str::NulError>>
    = note: required because of the requirements on the impl of `FromResidual<Result<Infallible, ParseIntError>>` for `Result<Vec<i64>, std::io::Error>`

{% endnote %}

这里介绍一种错误的处理方法，`Rust` 标准库中的所有错误都可以转换为 `Box<dyn std::error::Error + Send + Sync + 'static>` 类型，其中：

- `dyn std::error::Error`：表示任意错误；

- `Send + Sync + 'static`：能够在多线程之间安全传递；

出于方便，我们可以下面的类型，并且对 `read_numbers()` 函数进行整改， 

{% note success %}

```rust
use std::io::{self, BufRead};

type GenericError = Box<dyn std::error::Error + Send + Sync + 'static>;
type GenericResult<T> = Result<T, GenericError>;

/// Read integers from a text file.
/// The file should have one number on each line.
fn read_numbers(file: &mut dyn BufRead) -> GenericResult<Vec<i64>> {
    let mut numbers = vec![];
    for line_result in file.lines() {
        let line = line_result?; // reading lines can fail
        numbers.push(line.parse()?); // parsing integers can fail
    }
    Ok(numbers)
}
```

如果想从一个返回 `GenericResult` 的函数，找到一种特定类型的错误处理，但让其他错误传播出去，可以使用泛型方法 `error.downcast_ref::<ErrorType>()`。 如果它恰好是要查找的特定类型的错误，它会借用对错误的引用：

```rust
loop {
    match compile_project() {
        Ok(()) => return Ok(()),
        Err(err) => {
            if let Some(mse) = err.downcast_ref::<MissingSemicolonError>() {
                insert_semicolon_in_source_code(mse.file(), mse.line())?;
                continue; // try again!
            }
            return Err(err);
        }
    }
}
```
{% endnote %}


还有一种处理方式是使用 [`thiserror`](https://docs.rs/thiserror/latest/thiserror/) 帮我自动实现 [`std::error::Error`](https://doc.rust-lang.org/std/error/trait.Error.html)。


### 忽略错误

有时候，我们可能就是想忽略一个错误，因为某个函数执行成功与否关系不大，例如写日志到 `stderr`，但是我们如果不处理，编译器会报告警：

```rust
writeln!(stderr(), "error: {}", err); // warning: unused result
```

不过可以使用 `let _ = ...` 消除这个告警：

```rust
let _ = writeln!(stderr(), "error: {}", err); // ok, ignore result
```

### 处理 main 函数中的错误

使用 `?` 向上传递错误大多时候是比较正确的行为，可是当错误传播到 `main` 函数的时候我们就需要处理。大多时候，我们看到的 `main` 函数签名都是下面这个样子，它的返回值类型是 `()`：

```rust
fn main() {
    ...
}
```

所以我们不能使用 `?` 传播错误：

```rust
fn main() {
    calculate_tides()?; // error: can't pass the buck any further
}
```

最简单的方式是使用 `.expect()`，检查是否调用成功，如果失败就打印错误信息：

```rust
fn main() {
    calculate_tides().expect("error"); // the buck stops here
}
```

不过，我们也可以更改这个 `main` 函数的签名，让它返回 `Result` 类型，使用 `?` 传递错误：

```rust
fn main() -> Result<(), TideCalcError> {
    let tides = calculate_tides()?;
    print_tides(tides);
    Ok(())
}
```

但是这种方式打印的错误信息不是很详细，如果想自定义错误输出，还需要自己处理错误：

```rust
fn main() {
    if let Err(err) = calculate_tides() {
        print_error(&err);
        std::process::exit(1);
    }
}
```

### 错误定义

标注库里面的错误不可能满足所有情况，大多时候我们需要自定义错误：

```rust
#[derive(Debug, Clone)]
pub struct JsonError {
    pub message: String,
    pub line: usize,
    pub column: usize,
}
```

但是如果我们希望和标准的错误类型表现一样，我们还需要做点适配：

```rust
use std::fmt;
// Errors should be printable.
impl fmt::Display for JsonError {
    fn fmt(&self, f: &mut fmt::Formatter) -> Result<(), fmt::Error> {
        write!(f, "{} ({}:{})", self.message, self.line, self.column)
    }
}
// Errors should implement the std::error::Error trait,
// but the default definitions for the Error methods are fine.
impl std::error::Error for JsonError { }
```

不过，每次都实现这些 `trait` 是很头疼的，所以我们可使用 [`thiserror`](https://docs.rs/thiserror/latest/thiserror/)，帮我自动实现：

```rust
use thiserror::Error;
#[derive(Error, Debug)]
#[error("{message:} ({line:}, {column})")]
pub struct JsonError {
    message: String,
    line: usize,
    column: usize,
}
```
