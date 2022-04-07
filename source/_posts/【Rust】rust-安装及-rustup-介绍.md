---
title: 【Rust】rust 安装及 rustup 介绍
date: 2022-04-07 14:46:32
tags:
  - rust
---

学习 `rust` 的第一步当然是安装，在 `rust` 中，工具链的安装，升级版本切换都是由 `rustup` 来完成的。`rust` 的工具链分布在三个不同的 `channel` ：`stable`，`beta` 和 `nightly`，每个 `channel` 中有一些工具，例如：

- `cargo`：`rust` 包管理器
- `cargo-clippy`
- `cargo-fmt`
- `cargo-miri`
- `clippy-driver`
- `rls`：rust language service
- `rust-gdb`
- `rust-lldb`
- `rustc`：rust compiler
- `rustdoc`：rust documentation
- `rustfmt`：rust code formatter

可以将 `rustup` 看做 `rust` 的版本管理器，方便我们在不同的 `channel` 之间进行切换。 在国内 `rust` 的相关网站是没有被GFW屏蔽的，但是访问速度还是很慢。好在国内有很多镜像源，例如，我这里使用的是中国科学技术大学的镜像，配置的话只需要添加两个环境变量：

- `export RUSTUP_DIST_SERVER=https://mirrors.ustc.edu.cn/rust-static`
- `export RUSTUP_UPDATE_ROOT=https://mirrors.ustc.edu.cn/rust-static/rustup`

`rustup` 的安装我们依然使用官方的方式：

> curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

执行结束之后，应该能看到下面这样的信息，而且会默认安装 `nightly`（每日构建）版本：

{% asset_img install-success.png %}

我们可以顺手配置以下 `cargo` 的镜像地址，参考自 [中科大 Rust Crates 镜像使用帮助](https://lug.ustc.edu.cn/wiki/mirrors/help/rust-crates/)

```yaml ~/.cargo/config
[source.crates-io]
registry = "https://github.com/rust-lang/crates.io-index"
replace-with = 'ustc'

[source.ustc]
registry = "git://mirrors.ustc.edu.cn/crates.io-index"
```

<!-- more -->