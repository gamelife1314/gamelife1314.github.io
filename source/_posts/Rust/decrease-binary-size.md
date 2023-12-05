---
title: 【Rust】二进制体积减小
date: 2023-12-05 17:02:55
tags:
    - 编译优化
categories:
    - rust
---

本篇文章介绍常用的二进制减小方案，某些场景下，对二进制文件的大小有比较严格的要求，尤其是某些便携嵌入式设备上。


### 代码优化

编码阶段，我们可以从以下几点入手：

1. 减少使用泛型，考虑使用动态类型替换；但是动态调用相比静态展开有性能损失，需要做权衡；
2. 合理使用宏；有些宏展开后会生成很多代码，如果不合理使用，例如，某些通用的 `log` 宏，助手宏，会展开生成很多代码导致二进制文件体积增加；
3. 合理使用内联函数；一般我们使用内联函数加快代码执行的速度，但过多的内联函数也会导致二进制体积增加；

例如对于泛型和动态类型，这两种方式实现的代码编译之后二进制大小是有差异的，`print1` 会根据不同类型的参数展开成不同的版本：

```rust

fn print1<T: Display>(param: T) {
    println!("{:}", param);
}

fn print2(param: &dyn Display) {
    println!("{:}", param);
}

```


<!-- more -->

### 编译优化

常用的通过编译优化二进制文件大小的方式有：

1. 使用 `release` 进行编译，相当于设置 [`opt-level=3`](https://doc.rust-lang.org/cargo/reference/profiles.html#opt-level)，这是 `Cargo` 默认的方式；
2. 使用 `-Cprefer-dynamic` 告知 rust 动态依赖标准库；
3. [`codegen-units`](https://doc.rust-lang.org/rustc/codegen-options/index.html#codegen-units) 通常用于被设置为大于`0`的数，用于在编译时将 `crate` 分割成不同的单元而让 `LLVM` 加速编译，但是该值越大意味着越差的代码性能，所以通常将该值设置成 `1` 牺牲编译时间，而获取较好的程序性能以及较小的代码尺寸；
4. 对于生成的文件进行 `strip`，去掉 `debug` 信息；
5. 动态依赖标准库，使用 `RUSTFLAGS="-Cprefer-dynamic"` 编译参数，它会以动态方式依赖标准库，所以会将标准库内容从二进制文件中去除；
6. 设置 [`panic`](https://doc.rust-lang.org/cargo/reference/profiles.html#panic) 策略为 `abort`，出现 `panic` 时只终止进程，不展开堆栈，不能和第5点同时使用；
7. 设置 [`lto`](https://doc.rust-lang.org/cargo/reference/profiles.html#lto) 为 `fat`，不能和第5点同时使用；


我们以 [`rsb`](https://github.com/gamelife1314/rsb) 的代码为例，通过不同的方式来比较输出二进制的大小。

```
objcopy --only-keep-debug  rsb rsb.debug
objcopy --strip-all
objcopy --add-gnu-debuglink=rsb.debug rsb
```

