---
title: 【Rust】使用Cross进行跨平台编译
date: 2023-02-26 22:16:13
tags:
    - 跨平台编译
    - Cross
categories:
    - rust
---

`Rust` 的编译速度和跨平台编译相比 `Go` 语言就要难用很多，但这也是语言特点，当你从中受益时，必然要付出一些代价，本文主要介绍如何实现跨平台编译，使用 [`cross`](https://github.com/cross-rs/cross) 这个工具。

我的工作台是 `Mac M2`，想编译出 `Linux` 和 `Windows` 的可执行文件，使用的代码很简单，就是 `Hello World` 示例程序，这个不是重点。

使用 `cross` 首先当然是安装，按照官方的描述，可以使用下面的命令：

```shell
cargo install cross --git https://github.com/cross-rs/cross
```

然后是安装 `docker` 或者 `podman`，本文以 `docker` 为例，讲述使用过程中遇到的问题及其解决方案。`cross` 的使用很简单，例如，如果我要编译 `target` 为 `aarch64-unknown-linux-gnu`，执行：

```
cross build  --target aarch64-unknown-linux-gnu
```

<!-- more -->

### `ghcr.io` 镜像加速

`cross` 的工作原理是创建一个容器来构建我们的目标平台软件，但是它的镜像不是在 `Dockerhub`，所以说传统的镜像加速方法不能对它起作用，另外还有下面这些镜像仓库都不可以：

- `gcr.io、k8s.gcr.io`：谷歌镜像仓库；
- `quay.io` ：`Red Hat` 镜像仓库；
- `ghcr.io` ：`GitHub` 镜像仓库；

例如，我要编译 `target` 为 `aarch64-unknown-linux-gnu` 以及 `x86_64-pc-windows-gnu`，就需要下载这两个镜像：

1. `ghcr.io/cross-rs/x86_64-pc-windows-gnu:edge`；
2. `ghcr.io/cross-rs/aarch64-unknown-linux-gnu:main`

所有可用的 `target` 可以在[这里](https://github.com/cross-rs/cross/blob/main/docker/Dockerfile.x86_64-pc-windows-gnu)找到。

加速这些镜像的方法就是我们把他下载下来然后传到 `Doclerhub`，然后我们通过国内的公共镜像加速服务器就可以快速下载。当然自己搞这些太麻烦了，已经有大神做好了自动化，只需要在这里创建个 `issue`，就可自动帮我们完成，例如，这是我创建的两个：[`https://github.com/togettoyou/hub-mirror/issues`](https://github.com/togettoyou/hub-mirror/issues/created_by/gamelife1314)，执行完成之后，会在 `Dockerhub` 创建一个新的 `Repo`，例如：

![](hub-mirror.png)

然后在 `Cargo.toml` 配置为我们新创建的镜像，例如：

```toml
...

[package.metadata.cross.target.aarch64-unknown-linux-gnu]
xargo = false
image = "togettoyou/ghcr.io.cross-rs.aarch64-unknown-linux-gnu:main"
```

### `sh: 1: cargo: not found`

当我将镜像好不容易拉到本地之后，以为可以顺利的编出我想要的软件时，没想到又遇到了错误：

{% note danger %}
```
~/WORKDIR/rust/examples100 ⌚ 21:23:17
$ cross build  --target aarch64-unknown-linux-gnu
[cross] warning: using newer rustc `1.69.0-nightly (34e6673a0 2023-02-25)` for the target. Current active rustc on the host is `rustc 1.69.0-nightly (585f3eef2 2023-02-11)`.
 > Update with `rustup update`
sh: 1: cargo: not found
```
{% endnote %}

在一番查找之后，在 [`Github`](https://github.com/cross-rs/cross/issues/260#issuecomment-1132237489) 中找到了解决方案：
![](cargo-not-found.png)

其实这个问题应该与我将 `docker` 装在虚拟中有关，但是这个解决方案可以从本质上解决问题，镜像中没有安装 `rust` 工具链。所以我又构建了新的镜像：

```Dockerfie Dockerfile
FROM togettoyou/ghcr.io.cross-rs.aarch64-unknown-linux-gnu:main
RUN apt-get update && apt-get install -y wget
RUN mkdir -m777 /opt/rust /opt/cargo
ENV RUSTUP_HOME=/opt/rust CARGO_HOME=/opt/cargo PATH=/opt/cargo/bin:$PATH
ENV RUSTUP_DIST_SERVER="https://rsproxy.cn"
ENV RUSTUP_UPDATE_ROOT="https://rsproxy.cn/rustup"
RUN wget --https-only --secure-protocol=TLSv1_2 -O- https://sh.rustup.rs | sh /dev/stdin -y
RUN rustup target add aarch64-unknown-linux-gnu
RUN printf '#!/bin/sh\nexport CARGO_HOME=/opt/cargo\nexec /bin/sh "$@"\n' >/usr/local/bin/sh
RUN chmod +x /usr/local/bin/sh
```

构建命令为：

```
docker build -t gamelife1314/aarch64-unknown-linux-gnu .
```

![](docker-build-linux.png)

然后又重新更新 `Cargo.toml` 为我新建的镜像：

```toml Cargo.toml
...

[package.metadata.cross.target.aarch64-unknown-linux-gnu]
xargo = false
image = "gamelife1314/aarch64-unknown-linux-gnu"
```

再去执行编译命令，终于成功了：

![](cross-linux-build.png)

### `x86_64-pc-windows-gnu`

以同样的方式，我又编译出了 `windows` 上的可执行文件，下面是本地自建镜像的 `Dockerfile` 内容：

```Dockerfile Dockerfile.x86_64-pc-windows-gnu
FROM togettoyou/ghcr.io.cross-rs.x86_64-pc-windows-gnu:edge
RUN apt-get update && apt-get install -y wget
RUN mkdir -m777 /opt/rust /opt/cargo
ENV RUSTUP_HOME=/opt/rust CARGO_HOME=/opt/cargo PATH=/opt/cargo/bin:$PATH
ENV RUSTUP_DIST_SERVER="https://rsproxy.cn"
ENV RUSTUP_UPDATE_ROOT="https://rsproxy.cn/rustup"
RUN wget --https-only --secure-protocol=TLSv1_2 -O- https://sh.rustup.rs | sh /dev/stdin -y
RUN rustup target add x86_64-pc-windows-gnu
RUN printf '#!/bin/sh\nexport CARGO_HOME=/opt/cargo\nexec /bin/sh "$@"\n' >/usr/local/bin/sh
RUN chmod +x /usr/local/bin/sh
```

如果自定义了 `Dockerfile`文件名，需要使用 `-f` 指定，构建镜像的命令为：

```
docker build -t gamelife1314/x86_64-pc-windows-gnu -f Dockerfile.x86_64-pc-windows-gnu .
```

`Cargo.toml` 配置使用自定义镜像：

```toml Cargo.toml
...

[package.metadata.cross.target.x86_64-pc-windows-gnu]
xargo = false
image = "gamelife1314/x86_64-pc-windows-gnu"
```

然后使用 `cross` 进行编译：

![](cross-win-build.png)

### 自建镜像

本文中涉及的 `target` 为 `aarch64-unknown-linux-gnu` 和 `x86_64-pc-windows-gnu` 的自建镜像已经上传到 `Dockerhub`，可以直接使用。

![](custom-build-image.png)
