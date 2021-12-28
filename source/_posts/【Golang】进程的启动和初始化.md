---
title: 【Golang】进程初始化和调度系统
date: 2021-12-19 20:36:34
categories:
    - golang
---

本篇文章记录Go进程的启动和初始化过程，从程序入口开始调试，探索Go的各个组件初始化，以最简单的 `hello world` 为示例。

{% asset_img image.png %}

<!-- more -->

### 程序入口

以 linux 操作系统为例，程序编译之后生成可执行文件，可执行文件的格式在linux上是 `ELF`，Windows 上是`PE`，linux 通过 `readelf` 工具查看程序的入口地址，操作系统执行可执行文件的时候，首先解析 `ELF Header`，然后从 `entry point` 开始执行代码，通过 [delve](https://github.com/go-delve/delve) 执行程序，在入口处打断点：

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
  Entry point address:               0x701d0            // 程序入口地址
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
root@b89af2baca14:/WORKDIR/gostudy/hello# dlv exec ./main
Type 'help' for list of commands.
(dlv) b *0x701d0
Breakpoint 1 set at 0x701d0 for _rt0_arm64_linux() /usr/local/go/src/runtime/rt0_linux_arm64.s:8
(dlv)
```

关于 ELF 可执行文件的描述可以参考下面的[pdf文件](https://github.com/corkami/pics/blob/28cb0226093ed57b348723bc473cea0162dad366/binary/elf101/elf101.pdf)。当然还可以通过 [`GDB`](https://visualgdb.com/gdbreference/commands/info_files) 获得程序的入口地址：

```
(gdb) info files
Symbols from "/WORKDIR/gostudy/hello/main".
Local exec file:
	`/WORKDIR/gostudy/hello/main', file type elf64-littleaarch64.
	Entry point: 0x701d0                            // 程序入口地址
	0x0000000000011000 - 0x0000000000094220 is .text
	0x00000000000a0000 - 0x00000000000d51a3 is .rodata
	0x00000000000d5340 - 0x00000000000d5824 is .typelink
	0x00000000000d5840 - 0x00000000000d5898 is .itablink
	0x00000000000d5898 - 0x00000000000d5898 is .gosymtab
	0x00000000000d58a0 - 0x000000000012a160 is .gopclntab
	0x0000000000130000 - 0x0000000000130020 is .go.buildinfo
	0x0000000000130020 - 0x0000000000140580 is .noptrdata
	0x0000000000140580 - 0x0000000000147d50 is .data
	0x0000000000147d60 - 0x0000000000176b48 is .bss
	0x0000000000176b60 - 0x000000000017bde0 is .noptrbss
	0x0000000000010f9c - 0x0000000000011000 is .note.go.buildid
(gdb)
```

### 启动流程

实验环境信息如下：

- Darwin fudenglongdeMacBook-Pro.local 21.2.0 Darwin Kernel Version 21.2.0: Sun Nov 28 20:28:41 PST 2021; root:xnu-8019.61.5~1/RELEASE_ARM64_T6000 arm64

- go version go1.17.5 linux/arm64

通过单步调试，将程序从启动到执行 `main.main` 函数的全部流程全部总结如下：

![](go进程启动流程.png)

#### g0 和 m0

在进程启动的开始就完成了 `g0` 和 `m0` 的初始化，这两个是运行时的全局变量，定义在 `proc.go` 中：

```go
// proc.go
var (
  m0           m
  g0           g
  ...
)
```

- **m0**，`m0` 表示进程启动的第一个线程，也叫主线程。它和其他的 `m` 没有什么区别，进程启动通过汇编直接赋值；

- **g0**，每个 `m` 都有一个 `g0`，因为每个线程有一个系统堆栈，g0的主要作用是提供一个栈供 `runtime` 代码执行；

其中全局 `g0` 的初始化如下所示： 

```asm
// asm_am664.s
// create istack out of the given (operating system) stack.
// _cgo_init may update stackguard.
MOVQ   $runtime·g0(SB), DI      //g0的地址放入DI寄存器
LEAQ   (-64*1024+104)(SP), BX   //BX = SP - 64*1024 + 104
MOVQ   BX, g_stackguard0(DI)    //g0.stackguard0 = SP - 64*1024 + 104
MOVQ   BX, g_stackguard1(DI)     //g0.stackguard1 = SP - 64*1024 + 104
MOVQ   BX, (g_stack+stack_lo)(DI)  //g0.stack.lo = SP - 64*1024 + 104
MOVQ   SP, (g_stack+stack_hi)(DI)  //g0.stack.hi = SP
```

设置好 `g0` 相关的信息之后，在 `x86` 系统上还会设置线程的 `Fs_base` 寄存器，但是在 `arm64` 上，仅仅完成了 `m0` 和 `g0` 的相互绑定：

```asm
// set the per-goroutine and per-mach "registers"
MOVD	$runtime·m0(SB), R0

// save m->g0 = g0
MOVD	g, m_g0(R0)
// save m0 to g0->m
MOVD	R0, g_m(g)
```

### 并发调度

相比其他语言复杂的并发系统设计，Go语言中在面向用户时，仅提供一个 `go` 关键字即可实现异步任务和并发调度，但是因其简单，所以在一般系统中，百万级别的 `g` 也是常有的，为了保证这些 `goroutine` 的公平调度，不饿死也不撑死，所以得有一套公平的调度系统，在经历了初期几代的发展之后，现在逐渐形成了当前的 `GPM` 模型。

#### GPM



### 参考链接

1. [GDB 命令帮助文档](https://visualgdb.com/gdbreference/commands/)
2. [https://www.codepng.app/](https://www.codepng.app/)
3. [欧神·并发调度](https://golang.design/under-the-hood/zh-cn/part2runtime/ch06sched/)