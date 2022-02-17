---
title: Linux 可执行和可链接文件格式--ELF
date: 2022-02-16 22:59:17
tags:
    - ELF
---

`ELF(Executable and Linking Format)` 是linux系统下可执行文件，目标文件，共享链接库和内核转储文件的格式。该文件主要由三部分组成：

- `ELF Header`：主要包括文件的类型，架构，程序入口地址，`Program Header` 和 `Section Header` 的大小，数量，偏移量等；

- `Programe Header`：列举所有有效的 `segments` 的属性，描述如何创建进程运行时内存镜像，当内核看到这些 `segments` 时，使用 `mmap` 将他们映射到虚拟地址空间，为程序的运行准备。

- `Section Header`：定义ELF文件中所有的 `section`，用于链接和重定位。对于可执行文件，有四个主要部分：`.text`、`.data`、`.rodata` 和 `.bss`。


<!-- more -->

我们将下面的 `hello world` Go 程序编译成二进制文件进行分析，分析ELF经常用到的两个工具是：`readelf` 和 `objdump`。

```go
package main

import "fmt"

func main() {
	fmt.Println("hello world")
}
```

### ELF Header

通常使用 `readelf -h` 命令查看 `ELF` 文件的头信息：

```
root@b89af2baca14:/WORKDIR/gostudy/hello# readelf -h main
ELF Header:
  Magic:   7f 45 4c 46 02 01 01 00 00 00 00 00 00 00 00 00
  Class:                             ELF64
  Data:                              2's complement, little endian
  Version:                           1 (current)
  OS/ABI:                            UNIX - System V
  ABI Version:                       0
  Type:                              EXEC (Executable file)
  Machine:                           AArch64
  Version:                           0x1
  Entry point address:               0x701d0
  Start of program headers:          64 (bytes into file)
  Start of section headers:          456 (bytes into file)
  Flags:                             0x0
  Size of this header:               64 (bytes)
  Size of program headers:           56 (bytes)
  Number of program headers:         7
  Size of section headers:           64 (bytes)
  Number of section headers:         23
  Section header string table index: 3
root@b89af2baca14:/WORKDIR/gostudy/hello#
```

- `Magic`：

### 参考文章

1. [The 101 of ELF files on Linux: Understanding and Analysis
](https://linux-audit.com/elf-binaries-on-linux-understanding-and-analysis/#elf-sections)