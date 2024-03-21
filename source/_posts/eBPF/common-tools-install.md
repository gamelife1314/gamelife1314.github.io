---
title: 常用的eBPF工具安装及简单介绍
date: 2024-03-14 14:42:22
tags:
    - BCC
categories:
    - eBPF
---

`eBPF`，全称“扩展的伯克利数据包过滤器 (Extended Berkeley Packet Filter)”，它是一种数据包过滤技术，是从 `BPF (Berkeley Packet Filter)` 技术扩展而来的。`BPF` 提供了一种在内核事件和用户程序事件发生时安全注入代码的机制，这就让非内核开发人员也可以对内核进行控制。随着内核的发展，`BPF` 逐步从最初的数据包过滤扩展到了网络、内核、安全、跟踪等，而且它的功能特性还在快速发展中，这种扩展后的 `BPF` 被简称为 `eBPF`（相应的，早期的 `BPF` 被称为经典 BPF，简称 `cBPF`）。实际上，现代内核所运行的都是 `eBPF`，如果没有特殊说明，内核和开源社区中提到的 `BPF` 等同于 `eBPF`。

在 `eBPF` 之前，内核模块是注入内核的最主要机制。由于缺乏对内核模块的安全控制，内核的基本功能很容易被一个有缺陷的内核模块破坏。而 `eBPF` 则借助即时编译器（`JIT`），在内核中运行了一个虚拟机，保证只有被验证安全的 `eBPF` 指令才会被内核执行。同时，因为 eBPF 指令依然运行在内核中，无需向用户态复制数据，这就大大提高了事件处理的效率。

由于这些突出的特性，`eBPF` 现如今已经在故障诊断、网络优化、安全控制、性能监控等领域获得大量应用。比如，`Facebook` 开源的高性能网络负载均衡器 `Katran`、`Isovalent` 开源的容器网络方案 `Cilium` ，以及著名的内核跟踪排错工具 `BCC` 和 `bpftrace `等，都是基于 e`BPF` 技术实现的。

本文主要简单介绍一些常用的 `eBPF` 相关工具的安装。

<!-- more -->

### BCC

[BCC](https://github.com/iovisor/bcc) 是一个用于创建高效内核跟踪和操作程序的工具包，其中包括一些有用的工具和示例。使用 `BCC` 除了要求内核在 `4.1` 版本之上，还需要内核编译的时候打开一些开关，具体可以查看[这里](https://github.com/iovisor/bcc/blob/master/INSTALL.md#kernel-configuration)。除了直接从各个Linux发行版本的应用中心下载之外，这里着重记录源码安装的方式，以 `Ubuntu 22.04` 为例，不同的版本具体要求可能有所不同，但是大体流程相同，其他的版本请看[这里](https://github.com/iovisor/bcc/blob/master/INSTALL.md#source)：

```
# 首先删除使用apt安装的软件残留信息
sudo apt purge bpfcc-tools libbpfcc python3-bpfcc
wget https://github.com/iovisor/bcc/releases/download/v0.29.0/bcc-src-with-submodule.tar.gz
tar xf bcc-src-with-submodule.tar.gz
cd ~/bcc
sudo apt install -y python-is-python3 zip bison build-essential cmake flex git libedit-dev python3-distutilslibllvm14
sudo apt install -y  llvm-14-dev libclang-14-dev python3 zlib1g-dev libelf-dev libfl-dev python3-setuptools liblzma-dev 
sudo apt install -y libdebuginfod-dev arping netperf iperf
mkdir build
cd build/
cmake -DCMAKE_INSTALL_PREFIX=/usr -DPYTHON_CMD=python3 ..   
make 
make install
```

安装好的 `BCC` 工具位于 `/usr/share/bcc/tools/` 路径之下。使用 `BCC` 开发 `hello world` 小程序：

{% tabs BCC hello world %}

<!-- tab hello.py-->
```py
#!/usr/bin/env python3
# 1) import bcc library
from bcc import BPF

# 2) load BPF program
b = BPF(src_file="hello.c")
# 3) attach kprobe
b.attach_kprobe(event="do_sys_openat2", fn_name="hello_world")
# 4) read and print /sys/kernel/debug/tracing/trace_pipe
b.trace_print()
```

来看看每一处的具体含义：

1. 处导入了 `BCC`  库的 `BPF` 模块，以便接下来调用；
2. 调用 `BPF()` 加载第一步开发的 `BPF` 源代码；
3. 将 `BPF` 程序挂载到内核探针（简称 `kprobe`），其中 `do_sys_openat2()` 是系统调用 `openat()` 在内核中的实现；
4. 读取内核调试文件 `/sys/kernel/debug/tracing/trace_pipe` 的内容，并打印到标准输出中；

运行该程序：

> `sudo python3 hello.py`

输出如下信息：

> `b'      k3s-server-2795005 [000] d...1 265039.419072: bpf_trace_printk: Hello, World!'`

每个字段的含义如下所示：

- `k3s-server-2795005` 表示进程的名字和 `PID`；
- `[006]` 表示 `CPU` 编号；
- `d...1` 表示一系列的选项；
- `265039.419072` 表示时间戳；
- `bpf_trace_printk` 表示函数名；
- 最后的 `Hello, World!` 是调用 `bpf_trace_printk()` 传入的字符串；

<!-- endtab -->


<!-- tab hello.c-->
```c
int hello_world(void *ctx)
{
    bpf_trace_printk("Hello, World!");
    return 0;
}
```
<!-- endtab -->


{% endtabs %}

### bpftool

[bpftool](https://github.com/libbpf/bpftool?tab=readme-ov-file)是`linux`内核自带的用于对`eBPF`程序和`eBPF map`进行检查与操作的工具软件。安装使用如下的源码编译方式：

```
$ git clone --recurse-submodules https://github.com/libbpf/bpftool.git
$ cd bpftool/src
$ make
$ make install
```

如果没有错误，安装之后的二进制文件位于 `/usr/local/sbin/bpftool`。安装文档：

```
$ cd bpftool/docs
$ apt -y install python3-docutils
$ man install
$ man bpftool
```

### bpftrace

[bpftrace](https://github.com/bpftrace/bpftrace) 使用 `LLVM` 作为后端，将脚本编译为 `BPF` 字节码，并使用 `BCC` 与 `Linux BPF` 系统以及现有的 `Linux` 跟踪功能（内核动态跟踪（`kprobes`）、用户级动态跟踪（`uprobes`）和跟踪点）进行交互。`bpftrace` 语言的灵感来自 `awk` 和 `C`，以及 `DTrace` 和 `SystemTap` 等前代跟踪器。

在满足系统层面的要求之后，`ubuntu` 安装 `bpftrace` 使用如下的命令：

> `sudo apt-get install -y bpftrace`


### 参考连接

1. [How to Build Linux Kernel From Scratch {Step-By-Step Guide}](https://phoenixnap.com/kb/build-linux-kernel)
2. [使用 libbpf-bootstrap 构建 BPF 程序](https://forsworns.github.io/zh/blogs/20210627/)
3. [如何在 Ubuntu 上配置 eBPF 开发环境](https://yaoyao.io/posts/how-to-setup-ebpf-env-on-ubuntu#rust)