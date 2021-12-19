---
title: 【Golang】进程的启动和初始化
date: 2021-12-19 20:36:34
categories:
    - golang
---

本篇文章记录Go进程的启动和初始化过程，从程序入口开始调试，探索Go的各个组件初始化，以最简单的 `hello world` 为示例。

```go
package main

import "fmt"

func main() {
	fmt.Println("hello world")
}
```

### 查找程序的入口

以 linux 操作系统为例，程序编译之后生成可执行文件，可执行文件的格式在linux上是 `ELF`，Windows 上是`PE`，linux 通过 `readelf` 工具查看程序的入口地址，操作系统执行可执行文件的时候，首先解析 `ELF Header`，然后从 `entry point` 开始执行代码，通过 [delve](https://github.com/go-delve/delve) 执行程序，在入口处打断点：

{% asset_img readelf.png 查找程序入口 %}

<!-- more -->

关于 ELF 可执行文件的描述可以参考下面的[pdf文件](https://github.com/corkami/pics/blob/28cb0226093ed57b348723bc473cea0162dad366/binary/elf101/elf101.pdf)：

{% pdf elf101.pdf %}

本机的环境是 arm64 环境，通过 dlv 在程序入口处设置断点，我们找到程序的入口函数：

![入口函数：_rt0_arm64_linux](arm64-entry-fn.png)

然后进入到 `runtime·rt0_go` 汇编函数，在这个函数里面各种初始化工作：

![](runtime_rt0_go.png)


