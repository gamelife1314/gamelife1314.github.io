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

- **g0**，每个 `m` 都有一个 `g0`，因为每个线程有一个系统堆栈，g0的主要作用是提供一个栈供 `runtime` 代码执行，调度器就运行在 `g0` 上；

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

理解调度器首先要理解三个主要概念：

- `G`: `Goroutine`，即我们在 `Go` 程序中使用 `go` 关键字创建的执行体；
- `M`: `Machine`，或 worker thread，即传统意义上进程的线程；
- `P`: `Processor`，即一种人为抽象的、用于执行 `Go` 代码被要求局部资源。只有当 `M` 与一个 `P` 关联后才能执行 `Go` 代码。除非 `M` 发生阻塞或在进行系统调用时间过长时，没有与之关联的 `P`。也可以将 `P` 理解为令牌，`M` 只有拿到这个令牌才能去执行 `G`。

在这种GPM模型中，数量相对固定的是 `P`，大多数情况下都是和CPU数量相等，多了也没有意义。而 `M` 和 `G` 的数量是动态的，在调度初始化中，只设置了 `M` 的上限是 `1000`；对于G而言浮动范围就相对较大，少则数百，多则可能达到百万级别。

```go
// src/runtime/proc.go
func schedinit() {
    ...
    sched.maxmcount = 10000
    ...
}
```

##### M

`M` 是 `OS` 线程的实体，它的结构体字段有60多个，定义在 `runtime2.go` 文件中，但是它有一些比较重要的字段：

```go
// src/runtime/runtime2.go 
type m struct {
    g0          *g          // 执行调度器指令的Goroutine，每个M都有一个g0
    gsignal     *g          // 处理信号的G
    tls         [6]uintptr	// 线程本地存储，在ARM64处理器上貌似没有用到
    curg        *g			// 当前运行的用户 Goroutine
    p           puintptr	// 执行 go 代码时持有的 p (如果没有执行则为 nil)
    spinning    bool		// m 当前没有运行 work 且正处于寻找 work 的活跃状态
    cgoCallers  *cgoCallers	// cgo 调用崩溃的 cgo 回溯
    alllink     *m			// 在 allm 上
    .....
}
```

在Go中M只有两个状态：自旋还是非自旋。M的初始化是在 `mcommoninit` 函数中进行，不管是系统刚运行起来时，主线m0的初始化还是新建M的初始化都会调用这个函数：

```go
func mcommoninit(mp *m, id int64) {
  _g_ := getg()

  // g0 stack won't make sense for user (and is not necessary unwindable).
  if _g_ != _g_.m.g0 {
    callers(1, mp.createstack[:])
  }

  lock(&sched.lock)

  // 设置ID
  if id >= 0 {
    mp.id = id
  } else {
    mp.id = mReserveID()
  }

  mp.fastrand[0] = uint32(int64Hash(uint64(mp.id), fastrandseed))
  mp.fastrand[1] = uint32(int64Hash(uint64(cputicks()), ^fastrandseed))
  if mp.fastrand[0]|mp.fastrand[1] == 0 {
    mp.fastrand[1] = 1
  }

    // func mpreinit(mp *m) {
    //     mp.gsignal = malg(32 * 1024) // OS X wants >= 8K
    //     mp.gsignal.m = mp
    //     if GOOS == "darwin" && GOARCH == "arm64" {
    //         // mlock the signal stack to work around a kernel bug where it may
    //         // SIGILL when the signal stack is not faulted in while a signal
    //         // arrives. See issue 42774.
    //         mlock(unsafe.Pointer(mp.gsignal.stack.hi-physPageSize), physPageSize)
    //     }
    // }
    // 创建信号处理的Goroutine
  mpreinit(mp)
  if mp.gsignal != nil {
    mp.gsignal.stackguard1 = mp.gsignal.stack.lo + _StackGuard
  }

  // 添加到 allm 中，从而当它刚保存到寄存器或本地线程存储时候 GC 不会释放 g.m
  mp.alllink = allm

  // NumCgoCall() iterates over allm w/o schedlock,
  // so we need to publish it safely.
  atomicstorep(unsafe.Pointer(&allm), unsafe.Pointer(mp))
  unlock(&sched.lock)

  // Allocate memory to hold a cgo traceback if the cgo call crashes.
  if iscgo || GOOS == "solaris" || GOOS == "illumos" || GOOS == "windows" {
    mp.cgoCallers = new(cgoCallers)
  }
}
```

##### P

`P` 只是处理器的一种抽象，而并非真正的处理器，它是可以通过 runtime 提供的方法动态调整的，他可以用来实现 work stealing，每个 P 都持有一个G的本地队列。如果没有P的存在，所有的G只能放在全局的队列中，当M执行完一个G，必须锁住全局队列然后取下一个G拿来运行，这会严重降低运行效率。当有了 `P` 之后，每个P都有一个存储 `G` 的本地队列，当和 `P` 关联的 `M` 运行完一个 `G` 之后，它会按照：当前P的本地队列、全局、网络、偷取的方式获取一个可运行的 `G`。




### 参考链接

1. [GDB 命令帮助文档](https://visualgdb.com/gdbreference/commands/)
2. [https://www.codepng.app/](https://www.codepng.app/)
3. [欧神·并发调度](https://golang.design/under-the-hood/zh-cn/part2runtime/ch06sched/)