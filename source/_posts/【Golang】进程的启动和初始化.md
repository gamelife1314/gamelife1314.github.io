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
- `P`: `Processor`，即一种人为抽象的、用于执行 `Go` 代码被要求的局部资源。只有当 `M` 与一个 `P` 关联后才能执行 `Go` 代码。`M` 发生阻塞或在进行系统调用时间过长时，是没有与之关联的 `P`。

在这种GPM模型中，数量相对固定的是 `P`，大多数情况下都是和 `CPU` 数量相等，多了也没有意义。而 `M` 和 `G` 的数量是动态的，在调度初始化中，只设置了 `M` 的上限是 `10000`；对于`G`而言浮动范围就相对较大，少则数百，多则可能达到百万级别。

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

在`Go`中`M`只有两个状态：自旋还是非自旋。M的初始化是在 `mcommoninit` 函数中进行，不管是系统刚运行起来时，主线 `m0` 的初始化还是新建 `M` 的初始化都会调用这个函数：

```go
// src/runtime/proc.go
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

`P` 只是处理器的一种抽象，而并非真正的处理器，它是可以通过 `runtime` 提供的方法动态调整的，用来实现 work stealing，每个 `P` 都持有一个`G`的本地队列。如果没有`P`的存在，所有的`G`只能放在全局的队列中，当`M`执行完一个`G`，必须锁住全局队列然后取下一个`G`拿来运行，这会严重降低运行效率。当有了 `P` 之后，每个`P`都有一个存储 `G` 的本地队列，当和 `P` 关联的 `M` 运行完一个 `G` 之后，它会按照：当前P的本地队列、全局、网络、偷取的方式获取一个可运行的 `G`。

```go
type p struct {
	id          int32
	status      uint32 // one of pidle/prunning/...
	link        puintptr
	schedtick   uint32     // incremented on every scheduler call
	syscalltick uint32     // incremented on every system call
	sysmontick  sysmontick // last tick observed by sysmon
	m           muintptr   // back-link to associated m (nil if idle)
	mcache      *mcache
	pcache      pageCache
	raceprocctx uintptr

	deferpool    [5][]*_defer // pool of available defer structs of different sizes (see panic.go)
	deferpoolbuf [5][32]*_defer

	// Cache of goroutine ids, amortizes accesses to runtime·sched.goidgen.
	goidcache    uint64
	goidcacheend uint64

	// 无锁访问可运行G队列
	runqhead uint32
	runqtail uint32
	runq     [256]guintptr
	// runnext, if non-nil, is a runnable G that was ready'd by
	// the current G and should be run next instead of what's in
	// runq if there's time remaining in the running G's time
	// slice. It will inherit the time left in the current time
	// slice. If a set of goroutines is locked in a
	// communicate-and-wait pattern, this schedules that set as a
	// unit and eliminates the (potentially large) scheduling
	// latency that otherwise arises from adding the ready'd
	// goroutines to the end of the run queue.
	//
	// Note that while other P's may atomically CAS this to zero,
	// only the owner P can CAS it to a valid G.
	runnext guintptr

	// 可用的G，状态都是 _Gdead，可以用来复用
	gFree struct {
		gList
		n int32
	}

	sudogcache []*sudog
	sudogbuf   [128]*sudog

	// Cache of mspan objects from the heap.
	mspancache struct {
		// We need an explicit length here because this field is used
		// in allocation codepaths where write barriers are not allowed,
		// and eliminating the write barrier/keeping it eliminated from
		// slice updates is tricky, moreso than just managing the length
		// ourselves.
		len int
		buf [128]*mspan
	}

	tracebuf traceBufPtr

	// traceSweep indicates the sweep events should be traced.
	// This is used to defer the sweep start event until a span
	// has actually been swept.
	traceSweep bool
	// traceSwept and traceReclaimed track the number of bytes
	// swept and reclaimed by sweeping in the current sweep loop.
	traceSwept, traceReclaimed uintptr

	palloc persistentAlloc // per-P to avoid mutex

	_ uint32 // Alignment for atomic fields below

	// The when field of the first entry on the timer heap.
	// This is updated using atomic functions.
	// This is 0 if the timer heap is empty.
	timer0When uint64

	// The earliest known nextwhen field of a timer with
	// timerModifiedEarlier status. Because the timer may have been
	// modified again, there need not be any timer with this value.
	// This is updated using atomic functions.
	// This is 0 if there are no timerModifiedEarlier timers.
	timerModifiedEarliest uint64

	// Per-P GC state
	gcAssistTime         int64 // Nanoseconds in assistAlloc
	gcFractionalMarkTime int64 // Nanoseconds in fractional mark worker (atomic)

	// gcMarkWorkerMode is the mode for the next mark worker to run in.
	// That is, this is used to communicate with the worker goroutine
	// selected for immediate execution by
	// gcController.findRunnableGCWorker. When scheduling other goroutines,
	// this field must be set to gcMarkWorkerNotWorker.
	gcMarkWorkerMode gcMarkWorkerMode
	// gcMarkWorkerStartTime is the nanotime() at which the most recent
	// mark worker started.
	gcMarkWorkerStartTime int64

	// gcw is this P's GC work buffer cache. The work buffer is
	// filled by write barriers, drained by mutator assists, and
	// disposed on certain GC state transitions.
	gcw gcWork

	// wbBuf is this P's GC write barrier buffer.
	//
	// TODO: Consider caching this in the running G.
	wbBuf wbBuf

	runSafePointFn uint32 // if 1, run sched.safePointFn at next safe point

	// statsSeq is a counter indicating whether this P is currently
	// writing any stats. Its value is even when not, odd when it is.
	statsSeq uint32

	// Lock for timers. We normally access the timers while running
	// on this P, but the scheduler can also do it from a different P.
	timersLock mutex

	// Actions to take at some time. This is used to implement the
	// standard library's time package.
	// Must hold timersLock to access.
	timers []*timer

	// Number of timers in P's heap.
	// Modified using atomic instructions.
	numTimers uint32

	// Number of timerDeleted timers in P's heap.
	// Modified using atomic instructions.
	deletedTimers uint32

	// Race context used while executing timer functions.
	timerRaceCtx uintptr

	// preempt is set to indicate that this P should be enter the
	// scheduler ASAP (regardless of what G is running on it).
	preempt bool

	// Padding is no longer needed. False sharing is now not a worry because p is large enough
	// that its size class is an integer multiple of the cache line size (for any of our architectures).
}
```

目前情况下，`P` 一共有四种状态，`_Pidle`，`_Prunning`，`_Psyscall`，`_Pgcstop` 和 `_Pdead`：

- `_Pidle`：表示没有使用 `P` 来运行用户代码或调度程序。通常，它位于空闲 `P` 列表中并且可供调度程序使用，但它可能只是在其他状态之间转换，空闲状态下它的 `runq` 队列是空的。

- `_Prunning`：表示 `P`正在被 `M` 持有运行用户代码或者调度器。只有当 `M` 持有 `P` 时，它的状态才被允许修改到 `_Prunning`。如果没有活干，那么`P`将切换到 `_Pidle` 状态；当进行系统调用的时候会切换到 `_Psyscall`；`GC` 期间会切换到 `_Pgcstop`；`M` 也可以将 `P` 的所有权直接交给另一个 `M`（例如，调度到锁定的 `G`）；

- `_Psyscall`：说明 `P` 没有在运行用户代码，它与系统调用中的 `M` 有亲和关系，但不属于它，并且可能被另一个 `M` 窃取。这与 `_Pidle` 类似，但使用轻量级转换并保持 `M` 亲缘关系;

- `_Pgcstop`：这意味着P由于STW而暂停并且被触发STW的M拥有；STW 的 `M` 会继续使用 `P`；从 `_Prunning` 转换到 `_Pgcstop` 会导致M释放它的P并且停止；`P` 会保留它的运行队列，starttheworld 将在具有非空运行队列的P上重启调度程序；

- `_Pdead`：这个状态说明P将不再被使用；如果 `GOMAXPROCS` 增加，这个P还将被重新使用；一个死的 P 大部分资源都会被剥夺。

如果用一张图来说明 `P` 的状态转换，那么就如下所示：

![](p-status.png)

通常情况下（在程序运行时不调整`P`的个数），`P`只会在四种状态下进行切换。 当程序刚开始运行进行初始化时，所有的 `P` 都处于 `_Pgcstop` 状态， 随着`P`的初始化（在`runtime.procresize`），会被置于 `_Pidle`。

当`M`需要运行时，会`runtime.acquirep`，并通过`runtime.releasep`来释放。 当`G`执行时需要进入系统调用时，`P`会被设置为`_Psyscall`， 如果这个时候被系统监控抢夺（`runtime.retake`），则`P`会被重新修改为`_Pidle`。 如果在程序运行中发生`GC`，则`P`会被设置为`_Pgcstop`， 并在`runtime.startTheWorld` 时重新调整为`_Pidle`或者`_Prunning`。

`P`的初始化是在 `runtime.procresize` 函数中进行的，位于 `proc.go` 文件中：

```go
func procresize(nprocs int32) *p {
  assertLockHeld(&sched.lock)
  assertWorldStopped()

  // 获取先前的 P 个数
  old := gomaxprocs
  if old < 0 || nprocs <= 0 {
    throw("procresize: invalid arg")
  }
  if trace.enabled {
    traceGomaxprocs(nprocs)
  }

  // 更新统计信息，记录此次修改 gomaxprocs 的时间
  now := nanotime()
  if sched.procresizetime != 0 {
    sched.totaltime += int64(old) * (now - sched.procresizetime)
  }
  sched.procresizetime = now

  maskWords := (nprocs + 31) / 32

   // 必要时增加 allp
   // 这个时候本质上是在检查用户代码是否有调用过 runtime.MAXGOPROCS 调整 p 的数量
   // 此处多一步检查是为了避免内部的锁，如果 nprocs 明显小于 allp 的可见数量（因为 len）
   // 则不需要进行加锁
  if nprocs > int32(len(allp)) {
    // 此处与 retake 同步，它可以同时运行，因为它不会在 P 上运行。
    lock(&allpLock)
    if nprocs <= int32(cap(allp)) {
        // 如果 nprocs 被调小了，扔掉多余的 p
      allp = allp[:nprocs]
    } else {
      // 否则（调大了）创建更多的 p
      nallp := make([]*p, nprocs)
      // 将原有的 p 复制到新创建的 new all p 中，不浪费旧的 p
      copy(nallp, allp[:cap(allp)])
      allp = nallp
    }

    if maskWords <= int32(cap(idlepMask)) {
      idlepMask = idlepMask[:maskWords]
      timerpMask = timerpMask[:maskWords]
    } else {
      nidlepMask := make([]uint32, maskWords)
      // No need to copy beyond len, old Ps are irrelevant.
      copy(nidlepMask, idlepMask)
      idlepMask = nidlepMask

      ntimerpMask := make([]uint32, maskWords)
      copy(ntimerpMask, timerpMask)
      timerpMask = ntimerpMask
    }
    unlock(&allpLock)
  }

  // 初始化新的 P
  for i := old; i < nprocs; i++ {
    pp := allp[i]
    // 如果 p 是新创建的(新创建的 p 在数组中为 nil)，则申请新的 P 对象
    if pp == nil {
      pp = new(p)
    }
    pp.init(i)
    atomicstorep(unsafe.Pointer(&allp[i]), unsafe.Pointer(pp))
  }

  _g_ := getg()
  // 如果当前正在使用的 P 应该被释放，则更换为 allp[0]
  // 否则是初始化阶段，没有 P 绑定当前 P allp[0]
  if _g_.m.p != 0 && _g_.m.p.ptr().id < nprocs {
    // 继续使用当前 P
    _g_.m.p.ptr().status = _Prunning
    _g_.m.p.ptr().mcache.prepareForSweep()
  } else {
    // 释放当前 P，因为已失效
    if _g_.m.p != 0 {
      if trace.enabled {
        // Pretend that we were descheduled
        // and then scheduled again to keep
        // the trace sane.
        traceGoSched()
        traceProcStop(_g_.m.p.ptr())
      }
      _g_.m.p.ptr().m = 0
    }

    // 更换到 allp[0]
    _g_.m.p = 0
    p := allp[0]
    p.m = 0
    p.status = _Pidle
    // 直接将 allp[0] 绑定到当前的 M
    acquirep(p)
    if trace.enabled {
      traceGoStart()
    }
  }

  // mcache0 是在进程启动期间的mallocinit中初始化的，用于引导程序启动；
  // 到这里它就必要继续存在了，因为 gpm 已经关联，申请内存可以从每个P的mcache中进行了
  mcache0 = nil

  // 使用不到的P就释放资源把
  for i := nprocs; i < old; i++ {
    p := allp[i]
    p.destroy()
    // 不能释放 p 本身，因为他可能在 m 进入系统调用时被引用
  }

  // Trim allp.
  if int32(len(allp)) != nprocs {
    lock(&allpLock)
    allp = allp[:nprocs]
    idlepMask = idlepMask[:maskWords]
    timerpMask = timerpMask[:maskWords]
    unlock(&allpLock)
  }

  // 将没有本地任务的 P 放到空闲链表中
  var runnablePs *p
  for i := nprocs - 1; i >= 0; i-- {
    p := allp[i]
    // 确保不是当前正在使用的 P
    if _g_.m.p.ptr() == p {
      continue
    }
    // 放入 idle 链表
    p.status = _Pidle
    if runqempty(p) {
      pidleput(p)
    } else {
      // 如果有本地任务，则为其绑定一个 M
      p.m.set(mget())
      // 第一个循环为 nil，后续则为上一个 p
	  // 此处即为构建可运行的 p 链表
      p.link.set(runnablePs)
      runnablePs = p
    }
  }
  stealOrder.reset(uint32(nprocs))
  var int32p *int32 = &gomaxprocs // make compiler check that gomaxprocs is an int32
  atomic.Store((*uint32)(unsafe.Pointer(int32p)), uint32(nprocs))
  return runnablePs
}

// P 的初始化
func (pp *p) init(id int32) {
  // p 的 id 就是它在 allp 中的索引
  pp.id = id
  // 新创建的 p 处于 _Pgcstop 状态
  pp.status = _Pgcstop
  pp.sudogcache = pp.sudogbuf[:0]
  for i := range pp.deferpool {
    pp.deferpool[i] = pp.deferpoolbuf[i][:0]
  }
  pp.wbBuf.reset()
  // 为 P 分配 cache 对象
  if pp.mcache == nil {
    if id == 0 {
      if mcache0 == nil {
        throw("missing mcache?")
      }
      // Use the bootstrap mcache0. Only one P will get
      // mcache0: the one with ID 0.
      pp.mcache = mcache0
    } else {
      pp.mcache = allocmcache()
    }
  }
  if raceenabled && pp.raceprocctx == 0 {
    if id == 0 {
      pp.raceprocctx = raceprocctx0
      raceprocctx0 = 0 // bootstrap
    } else {
      pp.raceprocctx = raceproccreate()
    }
  }
  lockInit(&pp.timersLock, lockRankTimers)

  // This P may get timers when it starts running. Set the mask here
  // since the P may not go through pidleget (notably P 0 on startup).
  timerpMask.set(id)
  // Similarly, we may not go through pidleget before this P starts
  // running if it is P 0 on startup.
  idlepMask.clear(id)
}

// 删除所有和P关联的资源并且讲的状态切换到 _Pdead
func (pp *p) destroy() {
  assertLockHeld(&sched.lock)
  assertWorldStopped()

  // runq队列中的G移动到全局队列
  for pp.runqhead != pp.runqtail {
    // 从本地队列中 pop
    pp.runqtail--
    gp := pp.runq[pp.runqtail%uint32(len(pp.runq))].ptr()
    // push 到全局队列中
    globrunqputhead(gp)
  }
  // runnext 移动到全局队列
  if pp.runnext != 0 {
    globrunqputhead(pp.runnext.ptr())
    pp.runnext = 0
  }
  if len(pp.timers) > 0 {
    plocal := getg().m.p.ptr()
    // The world is stopped, but we acquire timersLock to
    // protect against sysmon calling timeSleepUntil.
    // This is the only case where we hold the timersLock of
    // more than one P, so there are no deadlock concerns.
    lock(&plocal.timersLock)
    lock(&pp.timersLock)
    moveTimers(plocal, pp.timers)
    pp.timers = nil
    pp.numTimers = 0
    pp.deletedTimers = 0
    atomic.Store64(&pp.timer0When, 0)
    unlock(&pp.timersLock)
    unlock(&plocal.timersLock)
  }
  // Flush p's write barrier buffer.
  if gcphase != _GCoff {
    wbBufFlush1(pp)
    pp.gcw.dispose()
  }
  for i := range pp.sudogbuf {
    pp.sudogbuf[i] = nil
  }
  pp.sudogcache = pp.sudogbuf[:0]
  for i := range pp.deferpool {
    for j := range pp.deferpoolbuf[i] {
      pp.deferpoolbuf[i][j] = nil
    }
    pp.deferpool[i] = pp.deferpoolbuf[i][:0]
  }
  systemstack(func() {
    for i := 0; i < pp.mspancache.len; i++ {
      // Safe to call since the world is stopped.
      mheap_.spanalloc.free(unsafe.Pointer(pp.mspancache.buf[i]))
    }
    pp.mspancache.len = 0
    lock(&mheap_.lock)
    pp.pcache.flush(&mheap_.pages)
    unlock(&mheap_.lock)
  })
  freemcache(pp.mcache)
  pp.mcache = nil
  // 将当前 P 的空闲的 G 复链转移到全局
  gfpurge(pp)
  traceProcFree(pp)
  if raceenabled {
    if pp.timerRaceCtx != 0 {
      // The race detector code uses a callback to fetch
      // the proc context, so arrange for that callback
      // to see the right thing.
      // This hack only works because we are the only
      // thread running.
      mp := getg().m
      phold := mp.p.ptr()
      mp.p.set(pp)

      racectxend(pp.timerRaceCtx)
      pp.timerRaceCtx = 0

      mp.p.set(phold)
    }
    raceprocdestroy(pp.raceprocctx)
    pp.raceprocctx = 0
  }
  pp.gcAssistTime = 0
  pp.status = _Pdead
}
```

procresize 这个函数相对较长，我们来总结一下它主要干了什么事情：

- 调用时已经 `STW`，记录调整 `P` 的时间；
- 按需调整 `allp` 的大小；
- 按需初始化 `allp` 中的 P；
- 如果当前的 `P` 还可以继续使用（没有被移除），则将 `P` 设置为 `_Prunning`；
- 否则将第一个 `P` 抢过来给当前 `G` 的 `M` 进行绑定；
- 从 `allp` 移除不需要的 `P`，将释放的 `P` 队列中的任务扔进全局队列；
- 最后挨个检查 `P`，将没有任务的 `P` 放入 `idle` 队列；
- 除去当前 `P` 之外，将有任务的 `P` 彼此串联成链表，将没有任务的 `P` 放回到 `idle` 链表中；

###### GOMAXPROCS

一般情况下没有人会动态调整P的数量，都是跟CPU的数量保持相同的；为了达到某些测试目的或者其他情况下，可能会对P的数量进行调整，运行时系统向用户层提供了 `runtime.GOMAXPROCS` 来处理：

```go
// src/runtime/debug.go

// GOMAXPROCS sets the maximum number of CPUs that can be executing
// simultaneously and returns the previous setting. It defaults to
// the value of runtime.NumCPU. If n < 1, it does not change the current setting.
// This call will go away when the scheduler improves.
func GOMAXPROCS(n int) int {
	if GOARCH == "wasm" && n > 1 {
		n = 1 // WebAssembly has no threads yet, so only one CPU is possible.
	}

	lock(&sched.lock)
	ret := int(gomaxprocs)
	unlock(&sched.lock)
	if n <= 0 || n == ret {
		return ret
	}

	stopTheWorldGC("GOMAXPROCS")

	// newprocs will be processed by startTheWorld
	newprocs = int32(n)

	startTheWorldGC()
	return ret
}
```

这个函数会STW，并且更新全局变量 `newprocs`，在 `startTheWorldGC()` 中会调用 `startTheWorldWithSema` 函数，对P的数量重新调整：

```go
func startTheWorldWithSema(emitTraceEvent bool) int64 {
  assertWorldStopped()
  ...
  procs := gomaxprocs
  if newprocs != 0 {
    procs = newprocs
    newprocs = 0
  }
  p1 := procresize(procs)
  ...
  worldStarted()
  ...
  return startTime
}
```

##### G

```go
// src/runtime/runtime2.go

// Stack 描述Goroutine的执行栈，栈的边界范围是 [lo, hi)
type stack struct {
	lo uintptr
	hi uintptr
}

type g struct {
	// Stack parameters.
	// stack describes the actual stack memory: [stack.lo, stack.hi).
	// stackguard0 is the stack pointer compared in the Go stack growth prologue.
	// It is stack.lo+StackGuard normally, but can be StackPreempt to trigger a preemption.
	// stackguard1 is the stack pointer compared in the C stack growth prologue.
	// It is stack.lo+StackGuard on g0 and gsignal stacks.
	// It is ~0 on other goroutine stacks, to trigger a call to morestackc (and crash).
	stack       stack   // offset known to runtime/cgo
	stackguard0 uintptr // offset known to liblink
	stackguard1 uintptr // offset known to liblink

	_panic    *_panic // innermost panic - offset known to liblink
	_defer    *_defer // innermost defer
	m         *m      // current m; offset known to arm liblink
	sched     gobuf
	syscallsp uintptr // if status==Gsyscall, syscallsp = sched.sp to use during gc
	syscallpc uintptr // if status==Gsyscall, syscallpc = sched.pc to use during gc
	stktopsp  uintptr // expected sp at top of stack, to check in traceback
	// param is a generic pointer parameter field used to pass
	// values in particular contexts where other storage for the
	// parameter would be difficult to find. It is currently used
	// in three ways:
	// 1. When a channel operation wakes up a blocked goroutine, it sets param to
	//    point to the sudog of the completed blocking operation.
	// 2. By gcAssistAlloc1 to signal back to its caller that the goroutine completed
	//    the GC cycle. It is unsafe to do so in any other way, because the goroutine's
	//    stack may have moved in the meantime.
	// 3. By debugCallWrap to pass parameters to a new goroutine because allocating a
	//    closure in the runtime is forbidden.
	param        unsafe.Pointer
	atomicstatus uint32
	stackLock    uint32 // sigprof/scang lock; TODO: fold in to atomicstatus
	goid         int64
	schedlink    guintptr
	waitsince    int64      // approx time when the g become blocked
	waitreason   waitReason // if status==Gwaiting

	preempt       bool // preemption signal, duplicates stackguard0 = stackpreempt
	preemptStop   bool // transition to _Gpreempted on preemption; otherwise, just deschedule
	preemptShrink bool // shrink stack at synchronous safe point

	// asyncSafePoint is set if g is stopped at an asynchronous
	// safe point. This means there are frames on the stack
	// without precise pointer information.
	asyncSafePoint bool

	paniconfault bool // panic (instead of crash) on unexpected fault address
	gcscandone   bool // g has scanned stack; protected by _Gscan bit in status
	throwsplit   bool // must not split stack
	// activeStackChans indicates that there are unlocked channels
	// pointing into this goroutine's stack. If true, stack
	// copying needs to acquire channel locks to protect these
	// areas of the stack.
	activeStackChans bool
	// parkingOnChan indicates that the goroutine is about to
	// park on a chansend or chanrecv. Used to signal an unsafe point
	// for stack shrinking. It's a boolean value, but is updated atomically.
	parkingOnChan uint8

	raceignore     int8     // ignore race detection events
	sysblocktraced bool     // StartTrace has emitted EvGoInSyscall about this goroutine
	tracking       bool     // whether we're tracking this G for sched latency statistics
	trackingSeq    uint8    // used to decide whether to track this G
	runnableStamp  int64    // timestamp of when the G last became runnable, only used when tracking
	runnableTime   int64    // the amount of time spent runnable, cleared when running, only used when tracking
	sysexitticks   int64    // cputicks when syscall has returned (for tracing)
	traceseq       uint64   // trace event sequencer
	tracelastp     puintptr // last P emitted an event for this goroutine
	lockedm        muintptr
	sig            uint32
	writebuf       []byte
	sigcode0       uintptr
	sigcode1       uintptr
	sigpc          uintptr
	gopc           uintptr         // pc of go statement that created this goroutine
	ancestors      *[]ancestorInfo // ancestor information goroutine(s) that created this goroutine (only used if debug.tracebackancestors)
	startpc        uintptr         // pc of goroutine function
	racectx        uintptr
	waiting        *sudog         // sudog structures this g is waiting on (that have a valid elem ptr); in lock order
	cgoCtxt        []uintptr      // cgo traceback context
	labels         unsafe.Pointer // profiler labels
	timer          *timer         // cached timer for time.Sleep
	selectDone     uint32         // are we participating in a select and did someone win the race?

	// Per-G GC state

	// gcAssistBytes is this G's GC assist credit in terms of
	// bytes allocated. If this is positive, then the G has credit
	// to allocate gcAssistBytes bytes without assisting. If this
	// is negative, then the G must correct this by performing
	// scan work. We track this in bytes to make it fast to update
	// and check for debt in the malloc hot path. The assist ratio
	// determines how this corresponds to scan work debt.
	gcAssistBytes int64
}
```

`G` 其实就是用户函数体，里面保存了要执行的函数参数，函数体的入口。相比于 `P`，`G` 的状态相对较多，主要有以下这些：

```go
// src/runtime/runtime2.go
// defined constants
const (
	// G status
	//
	// Beyond indicating the general state of a G, the G status
	// acts like a lock on the goroutine's stack (and hence its
	// ability to execute user code).
	//
	// If you add to this list, add to the list
	// of "okay during garbage collection" status
	// in mgcmark.go too.
	//
	// TODO(austin): The _Gscan bit could be much lighter-weight.
	// For example, we could choose not to run _Gscanrunnable
	// goroutines found in the run queue, rather than CAS-looping
	// until they become _Grunnable. And transitions like
	// _Gscanwaiting -> _Gscanrunnable are actually okay because
	// they don't affect stack ownership.

	// _Gidle 表示这个 Goroutine 刚刚被分配，还没有被初始化。
	_Gidle = iota // 0

	// _Grunnable 意味着这个 Goroutine 在一个可运行队列中，还没有
    // 执行用户代码，也没有堆栈；
	_Grunnable // 1

	// _Grunning 意味着这个 Goroutine 正在执行用户代码，拥有运行代码
    // 必要的堆栈。它不再可运行队列中，当前正在和 m 以及 p 关联。也就是
    // 说 g.m 以及 g.m.p 都是有效的；
	_Grunning // 2

	// _Gsyscall 表示这个 Goroutine 正在执行一个系统调用，没有执行用户代码。拥有堆栈
    // 并且分配了M，所以它不在运行队列中；
	_Gsyscall // 3

    // _Gwaiting 表示这个 goroutine 在运行时被阻塞。它没有执行用户代码。
    // 它不在运行队列中，但应记录在某处，例如，因为channel的等待队列，所以
    // 它可以在必要时被唤醒就绪。除了通道操作可以在适当的在通道锁下读取或者
    // 写入部分堆栈，其他情况下访问堆栈是不安全的；
	_Gwaiting // 4

	// _Gmoribund_unused 目前没用的一个状态；
	_Gmoribund_unused // 5

    // _Gdead 意味着这个 Goroutine 当前没被使用，他可能刚刚退出在一个空闲列表
    // 中，或者刚刚初始化。它可能有也可能没有分配堆栈。G 及其堆栈由退出 G 或从空
    // 闲列表中获得 G 的 M 所有。
	_Gdead // 6

	// _Genqueue_unused 目前没用；
	_Genqueue_unused // 7

    // _Gcopystack 意味着这个 Goroutine 的栈正在被移动，它没有执行用户代码
    // 也没有在可运行队列中。该堆栈由将其放入 _Gcopystack 的Goroutine所有。
	_Gcopystack // 8

    // _Gpreempted 意味着这个Goroutine被强制抢占，它很像 _Gwaiting，但
    // 目前没有什么负责将它就绪。
	_Gpreempted // 9

	// _Gscan combined with one of the above states other than
	// _Grunning indicates that GC is scanning the stack. The
	// goroutine is not executing user code and the stack is owned
	// by the goroutine that set the _Gscan bit.
	//
	// _Gscanrunning is different: it is used to briefly block
	// state transitions while GC signals the G to scan its own
	// stack. This is otherwise like _Grunning.
	//
	// atomicstatus&~Gscan gives the state the goroutine will
	// return to when the scan completes.
	_Gscan          = 0x1000
	_Gscanrunnable  = _Gscan + _Grunnable  // 0x1001
	_Gscanrunning   = _Gscan + _Grunning   // 0x1002
	_Gscansyscall   = _Gscan + _Gsyscall   // 0x1003
	_Gscanwaiting   = _Gscan + _Gwaiting   // 0x1004
	_Gscanpreempted = _Gscan + _Gpreempted // 0x1009
)
```

`G` 的初始化是在 `runtime.newproc` 函数中完成的：

```go
// src/runtime/proc.go 
//go:nosplit
func newproc(siz int32, fn *funcval) {
  // 从 fn 的地址增加一个指针的长度，从而获取第一参数地址
  argp := add(unsafe.Pointer(&fn), sys.PtrSize)
  gp := getg()
  pc := getcallerpc() // 获取调用方 PC/IP 寄存器值

  // 用 g0 系统栈创建 Goroutine 对象
  // 传递的参数包括 fn 函数入口地址, argp 参数起始地址, siz 参数长度, gp（g0），调用方 pc（goroutine）
  systemstack(func() {
    newg := newproc1(fn, argp, siz, gp, pc)

    _p_ := getg().m.p.ptr()

    // 将这里新创建的 g 放入 p 的本地队列或直接放入全局队列
	// true 表示放入执行队列的下一个，false 表示放入队尾
    runqput(_p_, newg, true)

    // 如果有空闲的 P、且 spinning 的 M 数量为 0，且主 Goroutine 已经开始运行，则进行唤醒 p
	// 初始化阶段 mainStarted 为 false，所以 p 不会被唤醒
    if mainStarted {
      wakep()
    }
  })
}

type funcval struct {
	fn uintptr
	// 变长大小，fn 的数据在应在 fn 之后
}

// getcallerpc 返回它调用方的调用方程序计数器 PC program conter
//go:noescape
func getcallerpc() uintptr
```

详细的参数获取过程需要编译器的配合，也是实现 Goroutine 的关键，下面是 X86 上面一个简单的事例：

```go
package main

func hello(msg string) {
	println(msg)
}

func main() {
	go hello("hello world")
}
```

    LEAQ go.string.*+1874(SB), AX // 将 "hello world" 的地址给 AX
    MOVQ AX, 0x10(SP)             // 将 AX 的值放到 0x10
    MOVL $0x10, 0(SP)             // 将最后一个参数的位置存到栈顶 0x00
    LEAQ go.func.*+67(SB), AX     // 将 go 语句调用的函数入口地址给 AX
    MOVQ AX, 0x8(SP)              // 将 AX 存入 0x08
    CALL runtime.newproc(SB)      // 调用 newproc

这个时候栈的布局如下图所示：

                栈布局
        |                 |       高地址
        |                 |
        +-----------------+ 
        | &"hello world"  |
    0x10  +-----------------+ <--- fn + sys.PtrSize
        |      hello      |
    0x08  +-----------------+ <--- fn
        |       size      |
    0x00  +-----------------+ SP
        |    newproc PC   |  
        +-----------------+ callerpc: 要运行的 Goroutine 的 PC
        |                 |
        |                 |       低地址

从而当 `newproc` 开始运行时，先获得 `size` 作为第一个参数，再获得 `fn` 作为第二个参数， 然后通过 `add` 计算出 `fn` 参数开始的位置。现在我们知道 `newproc` 会获取需要执行的 `Goroutine` 要执行的函数体的地址、 参数起始地址、参数长度、以及 `Goroutine` 的调用地址。 然后在 `g0` 系统栈上通过 `newproc1` 创建并初始化新的 `Goroutine` ，下面我们来看 `newproc1`。

```go
// 创建一个运行 fn 的新 g，具有 narg 字节大小的参数，从 argp 开始。
// callerps 是 go 语句的起始地址。新创建的 g 会被放入 g 的队列中等待运行。
//
// This must run on the system stack because it's the continuation of
// newproc, which cannot split the stack.
//
//go:systemstack
func newproc1(fn *funcval, argp unsafe.Pointer, narg int32, callergp *g, callerpc uintptr) *g {
  if goexperiment.RegabiDefer && narg != 0 {
    // TODO: When we commit to GOEXPERIMENT=regabidefer,
    // rewrite the comments for newproc and newproc1.
    // newproc will no longer have a funny stack layout or
    // need to be nosplit.
    throw("go with non-empty frame")
  }

  _g_ := getg()  // 因为是在系统栈运行所以此时的 g 为 g0

  if fn == nil {
    _g_.m.throwing = -1 // do not dump full stacks
    throw("go of nil func value")
  }
  acquirem() // disable preemption because it can be holding p in a local var
  siz := narg
  siz = (siz + 7) &^ 7

  // We could allocate a larger initial stack if necessary.
  // Not worth it: this is almost always an error.
  // 4*PtrSize: extra space added below
  // PtrSize: caller's LR (arm) or return address (x86, in gostartcall).
  if siz >= _StackMin-4*sys.PtrSize-sys.PtrSize {
    throw("newproc: function arguments too large for new goroutine")
  }

  // 获得 p
  _p_ := _g_.m.p.ptr()
  // 根据 p 获得一个新的 g
  newg := gfget(_p_)
  // 初始化阶段，gfget 是不可能找到 g 的
  // 也可能运行中本来就已经耗尽了
  if newg == nil {
    newg = malg(_StackMin)  // 创建一个拥有 _StackMin 大小的栈的 g，_StackMin 是 2048
    // 将新创建的 g 从 _Gidle 更新为 _Gdead 状态
    casgstatus(newg, _Gidle, _Gdead)
    allgadd(newg) // 将 Gdead 状态的 g 添加到 allg，这样 GC 不会扫描未初始化的栈
  }
  if newg.stack.hi == 0 {
    throw("newproc1: newg missing stack")
  }

  if readgstatus(newg) != _Gdead {
    throw("newproc1: new g is not Gdead")
  }

  // 计算运行空间大小，对齐
  totalSize := 4*sys.PtrSize + uintptr(siz) + sys.MinFrameSize // extra space in case of reads slightly beyond frame
  totalSize += -totalSize & (sys.StackAlign - 1)               // align to StackAlign
  // 确定 sp 和参数入栈位置
  sp := newg.stack.hi - totalSize
  spArg := sp
  if usesLR {
    // caller's LR
    *(*uintptr)(unsafe.Pointer(sp)) = 0
    prepGoExitFrame(sp)
    spArg += sys.MinFrameSize
  }

  // 处理参数，当有参数时，将参数拷贝到 Goroutine 的执行栈中
  if narg > 0 {
    // 从 argp 参数开始的位置，复制 narg 个字节到 spArg（参数拷贝）
    memmove(unsafe.Pointer(spArg), argp, uintptr(narg))
    // 栈到栈的拷贝。
    // 如果启用了 write barrier 并且 源栈为灰色（目标始终为黑色），
    // 则执行 barrier 拷贝。
    // 因为目标栈上可能有垃圾，我们在 memmove 之后执行此操作。
    if writeBarrier.needed && !_g_.m.curg.gcscandone {
      f := findfunc(fn.fn)
      stkmap := (*stackmap)(funcdata(f, _FUNCDATA_ArgsPointerMaps))
      if stkmap.nbit > 0 {
        // 我们正位于序言部分，因此栈 map 索引总是 0
        bv := stackmapdata(stkmap, 0)
        bulkBarrierBitmap(spArg, spArg, uintptr(bv.n)*sys.PtrSize, 0, bv.bytedata)
      }
    }
  }

  // 清理、创建并初始化的 g 的运行现场
  memclrNoHeapPointers(unsafe.Pointer(&newg.sched), unsafe.Sizeof(newg.sched))
  newg.sched.sp = sp
  newg.stktopsp = sp
  newg.sched.pc = abi.FuncPCABI0(goexit) + sys.PCQuantum // +PCQuantum so that previous instruction is in same function
  newg.sched.g = guintptr(unsafe.Pointer(newg))
  gostartcallfn(&newg.sched, fn)
  // 初始化 g 的基本状态
  newg.gopc = callerpc
  newg.ancestors = saveAncestors(callergp)
  newg.startpc = fn.fn // 入口 pc
  if _g_.m.curg != nil {
    newg.labels = _g_.m.curg.labels
  }
  if isSystemGoroutine(newg, false) {
    atomic.Xadd(&sched.ngsys, +1)
  }
  // Track initial transition?
  newg.trackingSeq = uint8(fastrand())
  if newg.trackingSeq%gTrackingPeriod == 0 {
    newg.tracking = true
  }
  // 现在将 g 更换为 _Grunnable 状态
  casgstatus(newg, _Gdead, _Grunnable)

  // 分配 goid
  if _p_.goidcache == _p_.goidcacheend {
    // Sched.goidgen 为最后一个分配的 id，相当于一个全局计数器
    // 这一批必须为 [sched.goidgen+1, sched.goidgen+GoidCacheBatch].
    // 启动时 sched.goidgen=0, 因此主 Goroutine 的 goid 为 1
    _p_.goidcache = atomic.Xadd64(&sched.goidgen, _GoidCacheBatch)
    _p_.goidcache -= _GoidCacheBatch - 1
    _p_.goidcacheend = _p_.goidcache + _GoidCacheBatch
  }
  newg.goid = int64(_p_.goidcache)
  _p_.goidcache++
  if raceenabled {
    newg.racectx = racegostart(callerpc)
  }
  if trace.enabled {
    traceGoCreate(newg, newg.startpc)
  }
  releasem(_g_.m)

  return newg
}
```

为了证明创建新的goroutine是在系统栈运行，可以debug程序，在 `newproc1` 函数中断点，查看此时的goroutine是哪个：

    (dlv) c
    > runtime.newproc1() /usr/local/go/src/runtime/proc.go:4286 (hits total:1) (PC: 0x4de9c)
    Warning: debugging optimized function
    4281:			throw("go with non-empty frame")
    4282:		}
    4283:
    4284:		_g_ := getg()
    4285:
    =>4286:		if fn == nil {
    4287:			_g_.m.throwing = -1 // do not dump full stacks
    4288:			throw("go of nil func value")
    4289:		}
    4290:		acquirem() // disable preemption because it can be holding p in a local var
    4291:		siz := narg
    (dlv) p _g_.m.g0.goid
    0
    (dlv) p _g_.goid
    0  // 当前g关联的m的g0ID和当前g的id相同，说明是在g0栈上运行
    (dlv)

由于执行 newproc1 是在 systemstack() 函数中，我们来看这个函数的描述：

```go
// systemstack runs fn on a system stack.
// If systemstack is called from the per-OS-thread (g0) stack, or
// if systemstack is called from the signal handling (gsignal) stack,
// systemstack calls fn directly and returns.
// Otherwise, systemstack is being called from the limited stack
// of an ordinary goroutine. In this case, systemstack switches
// to the per-OS-thread stack, calls fn, and switches back.
// It is common to use a func literal as the argument, in order
// to share inputs and outputs with the code around the call
// to system stack:
//
//	... set up y ...
//	systemstack(func() {
//		x = bigcall(y)
//	})
//	... use x ...
//
//go:noescape
func systemstack(fn func())
```

创建 G 的过程也是相对比较复杂的，我们来总结一下这个过程：

1. 首先尝试从 `P` 本地 `gfree` 链表或全局 `gfree` 队列获取已经执行过的 `g`
2. 初始化过程中程序无论是本地队列还是全局队列都不可能获取到 `g`，因此创建一个新的 `g`，并为其分配运行线程（执行栈），这时 `g` 处于 `_Gidle` 状态
3. 创建完成后，`g` 被更改为 `_Gdead` 状态，并根据要执行函数的入口地址和参数，初始化执行栈的 `SP` 和参数的入栈位置，并将需要的参数拷贝一份存入执行栈中
4. 根据 `SP`、参数，在 `g.sched` 中保存 `SP` 和 `PC` 指针来初始化 `g` 的运行现场
5. 将调用方、要执行的函数的入口 `PC` 进行保存，并将 `g` 的状态更改为 `_Grunnable`
6. 给 `Goroutine` 分配 `id`，并将其放入 `P` 本地队列的队头或全局队列（初始化阶段队列肯定不是满的，因此不可能放入全局队列）
7. 检查空闲的 `P`，将其唤醒，准备执行 `G`，但我们目前处于初始化阶段，主 Goroutine 尚未开始执行，因此这里不会唤醒 P。

##### sched

`runtime2.go` 文件中结束位置定义了很多全局变量，其中有一个 `sched`，它包含了很多全局资源，访问这些全局资源一般需要锁：

```go
// src/runtime/runtime2.go

type schedt struct {
	// 原子访问，确保在32位系统上对齐
	goidgen   uint64 // 全局goid生成器，newproc1 函数中有使用到
	lastpoll  uint64 // time of last network poll, 0 if currently polling
	pollUntil uint64 // time to which current poll is sleeping

	lock mutex

    // 当增加 nmidle，nmidlelocked，nmsys 或者 nmfreed时，确保调用 checkdead()
    // 这个函数在 src/runtime/proc.go 中，检查运行的M，如果数量是0，则 deadlock
	midle        muintptr // 等待工作的空闲m列表
	nmidle       int32    // 空闲M的数量
	nmidlelocked int32    // number of locked m's waiting for work
	mnext        int64    // 已经创建的M的数量用于记录M的ID
	maxmcount    int32    // 最大允许的m的数量，10000
	nmsys        int32    // 系统线程数量不用于死锁检查
	nmfreed      int64    // 累计已经释放的M的数量

	ngsys uint32 // 系统goroutine的数量，原子更新

	pidle      puintptr // 空闲p列表
	npidle     uint32
	nmspinning uint32 // See "Worker thread parking/unparking" comment in proc.go.

	// 全局的可运行G队列
	runq     gQueue
	runqsize int32

	// disable controls selective disabling of the scheduler.
	//
	// Use schedEnableUser to control this.
	//
	// disable is protected by sched.lock.
	disable struct {
		// user disables scheduling of user goroutines.
		user     bool
		runnable gQueue // pending runnable Gs
		n        int32  // length of runnable
	}

	// 全局_Gdead状态的G
	gFree struct {
		lock    mutex
		stack   gList // Gs with stacks
		noStack gList // Gs without stacks
		n       int32
	}

	// sudog 结构体的全局缓存
	sudoglock  mutex
	sudogcache *sudog

	// Central pool of available defer structs of different sizes.
	deferlock mutex
	deferpool [5]*_defer

	// freem is the list of m's waiting to be freed when their
	// m.exited is set. Linked through m.freelink.
	freem *m

	gcwaiting  uint32 // gc is waiting to run
	stopwait   int32
	stopnote   note
	sysmonwait uint32
	sysmonnote note

	// While true, sysmon not ready for mFixup calls.
	// Accessed atomically.
	sysmonStarting uint32

	// safepointFn should be called on each P at the next GC
	// safepoint if p.runSafePointFn is set.
	safePointFn   func(*p)
	safePointWait int32
	safePointNote note

	profilehz int32 // cpu profiling rate

	procresizetime int64 // nanotime() of last change to gomaxprocs
	totaltime      int64 // ∫gomaxprocs dt up to procresizetime

	// sysmonlock protects sysmon's actions on the runtime.
	//
	// Acquire and hold this mutex to block sysmon from interacting
	// with the rest of the runtime.
	sysmonlock mutex

	_ uint32 // ensure timeToRun has 8-byte alignment

	// timeToRun is a distribution of scheduling latencies, defined
	// as the sum of time a G spends in the _Grunnable state before
	// it transitions to _Grunning.
	//
	// timeToRun is protected by sched.lock.
	timeToRun timeHistogram
}

var (
	allm       *m
	gomaxprocs int32
	ncpu       int32
	forcegc    forcegcstate
	sched      schedt
    ....
)
```

我们再来看看 `schedinit` 函数，了解下 `GPM` 的初始化流程：

```go
// src/runtime/proc.go

func schedinit() {
    ....
    _g_ := getg()

    mcommoninit(_g_.m, -1)  // M初始化
    ...

    lock(&sched.lock)
    sched.lastpoll = uint64(nanotime())
    procs := ncpu
    if n, ok := atoi32(gogetenv("GOMAXPROCS")); ok && n > 0 {
        procs = n
    }
    // P 初始化
    if procresize(procs) != nil {
        throw("unknown runnable goroutine during bootstrap")
    }
    unlock(&sched.lock)
}
```

    TEXT runtime·rt0_go(SB),NOSPLIT,$0
        ...
        MOVW	8(RSP), R0	// copy argc
        MOVW	R0, -8(RSP)
        MOVD	16(RSP), R0		// copy argv
        MOVD	R0, 0(RSP)
        BL	runtime·args(SB)
        BL	runtime·osinit(SB)
        BL	runtime·schedinit(SB)

        // create a new goroutine to start program
        MOVD	$runtime·mainPC(SB), R0		// entry
        MOVD	RSP, R7
        MOVD.W	$0, -8(R7)
        MOVD.W	R0, -8(R7)
        MOVD.W	$0, -8(R7)
        MOVD.W	$0, -8(R7)
        MOVD	R7, RSP
        BL	runtime·newproc(SB)   //G 的初始化
        ADD	$32, RSP
    
    DATA	runtime·mainPC+0(SB)/8,$runtime·main(SB)
    GLOBL	runtime·mainPC(SB),RODATA,$8

M/P/G 彼此的初始化顺序遵循：`mcommoninit`、`procresize`、`newproc`，他们分别负责初始化 `M` 资源池（`allm`）、`P` 资源池（`allp`）、`G` 的运行现场（`g.sched`）以及调度队列（`p.runq`）。

#### 调度循环

当所有准备工作都就绪之后，也就是调度器初始化，主Goroutine也创建好之后，就是启动调度器调度我们的主Goroutine开始运行了，在我们的Go程序引导启动的最后一步有如下的过程，其中 `mstart` 就是启动调度的入口：

```
// src/runtime/asm_arm64.s

TEXT runtime·rt0_go(SB),NOSPLIT|TOPFRAME,$0
    ....

    // create a new goroutine to start program
	MOVQ	$runtime·mainPC(SB), AX		// entry
	PUSHQ	AX
	PUSHQ	$0			// arg size
	CALL	runtime·newproc(SB)
	POPQ	AX
	POPQ	AX

    // start this M
	CALL	runtime·mstart(SB)

	CALL	runtime·abort(SB)	// mstart should never return
	RET

	// Prevent dead-code elimination of debugCallV2, which is
	// intended to be called by debuggers.
	MOVQ	$runtime·debugCallV2<ABIInternal>(SB), AX
	RET

TEXT runtime·mstart(SB),NOSPLIT|TOPFRAME,$0
	CALL	runtime·mstart0(SB)
	RET // not reached

// mainPC is a function value for runtime.main, to be passed to newproc.
// The reference to runtime.main is made via ABIInternal, since the
// actual function (not the ABI0 wrapper) is needed by newproc.
DATA	runtime·mainPC+0(SB)/8,$runtime·main<ABIInternal>(SB)
GLOBL	runtime·mainPC(SB),RODATA,$8
```

`mstart` 是新创建的M的入口，由汇编完成。

```go
// mstart is the entry-point for new Ms.
// It is written in assembly, uses ABI0, is marked TOPFRAME, and calls mstart0.
func mstart()
```

从汇编代码中可以看到，`mstart` 仅仅调用了 `mstart0`，而且它不会返回。

```go
// src/runtime/proc.go
// mstart0 is the Go entry-point for new Ms.
// This must not split the stack because we may not even have stack
// bounds set up yet.
//
// May run during STW (because it doesn't have a P yet), so write
// barriers are not allowed.
//
//go:nosplit
//go:nowritebarrierrec
func mstart0() {
  _g_ := getg()

  // 确定执行栈的边界，通过检查G执行栈的边界确定是否为系统栈
  osStack := _g_.stack.lo == 0
  if osStack {
    // Initialize stack bounds from system stack.
    // Cgo may have left stack size in stack.hi.
    // minit may update the stack bounds.
    //
    // Note: these bounds may not be very accurate.
    // We set hi to &size, but there are things above
    // it. The 1024 is supposed to compensate this,
    // but is somewhat arbitrary.
    size := _g_.stack.hi
    if size == 0 {
      size = 8192 * sys.StackGuardMultiplier
    }
    _g_.stack.hi = uintptr(noescape(unsafe.Pointer(&size)))
    _g_.stack.lo = _g_.stack.hi - size + 1024
  }
  // Initialize stack guard so that we can start calling regular
  // Go code.
  _g_.stackguard0 = _g_.stack.lo + _StackGuard
  // This is the g0, so we can also call go:systemstack
  // functions, which check stackguard1.
  _g_.stackguard1 = _g_.stackguard0
  mstart1()

  // Exit this thread.
  if mStackIsSystemAllocated() {
    // Windows, Solaris, illumos, Darwin, AIX and Plan 9 always system-allocate
    // the stack, but put it in _g_.stack before mstart,
    // so the logic above hasn't set osStack yet.
    osStack = true
  }
  mexit(osStack)
}
```

继续看 `mstart1` 函数：

```go
// The go:noinline is to guarantee the getcallerpc/getcallersp below are safe,
// so that we can set up g0.sched to return to the call of mstart1 above.
//go:noinline
func mstart1() {
  _g_ := getg()

  // 确定当前的G是g0
  if _g_ != _g_.m.g0 {
    throw("bad runtime·mstart")
  }

  // Set up m.g0.sched as a label returning to just
  // after the mstart1 call in mstart0 above, for use by goexit0 and mcall.
  // We're never coming back to mstart1 after we call schedule,
  // so other calls can reuse the current frame.
  // And goexit0 does a gogo that needs to return from mstart1
  // and let mstart0 exit the thread.
  // 将 m.g0.sched 设置为在上面 mstart0 中的 mstart1 调用之后返回的标签，
  // 供 goexit0 和 mcall 使用。在调用 schedule 之后，我们永远不会回到 mstart1，
  // 因此其他调用可以重用当前帧。而goexit0做了一个gogo，需要从mstart1返回，让mstart0退出线程。
  _g_.sched.g = guintptr(unsafe.Pointer(_g_))
  _g_.sched.pc = getcallerpc()
  _g_.sched.sp = getcallersp()

  asminit()
  minit()

  // Install signal handlers; after minit so that minit can
  // prepare the thread to be able to handle the signals.
  // 如果是 m0，设置信号处理器，
  if _g_.m == &m0 {
    mstartm0()
  }

  // 执行启动函数
  if fn := _g_.m.mstartfn; fn != nil {
    fn()
  }

  // 如果当前 m 并非 m0，则要求绑定 p
  if _g_.m != &m0 {
    acquirep(_g_.m.nextp.ptr())
    _g_.m.nextp = 0
  }

  schedule()
}
```

##### M 和 P 的绑定

`M` 与 `P` 的绑定过程只是简单的将 `P` 链表中的 `P` ，保存到 `M` 中的 `P` 指针上。 绑定前，`P` 的状态一定是 `_Pidle`，绑定后 `P` 的状态一定为 `_Prunning`，具体实现是在 `acquirep` 中处理：

```go
// src/runtime/proc.go

// Associate p and the current m.
//
// This function is allowed to have write barriers even if the caller
// isn't because it immediately acquires _p_.
//
//go:yeswritebarrierrec
func acquirep(_p_ *p) {
  // Do the part that isn't allowed to have write barriers.
  wirep(_p_)

  // Have p; write barriers now allowed.

  // Perform deferred mcache flush before this P can allocate
  // from a potentially stale mcache.
  _p_.mcache.prepareForSweep()

  if trace.enabled {
    traceProcStart()
  }
}

// wirep is the first step of acquirep, which actually associates the
// current M to _p_. This is broken out so we can disallow write
// barriers for this part, since we don't yet have a P.
//
//go:nowritebarrierrec
//go:nosplit
func wirep(_p_ *p) {
  _g_ := getg()

  // 检查m是否已经绑定p
  if _g_.m.p != 0 {
    throw("wirep: already in go")
  }

  // 检查p是否已经绑定M或者P的状态不是_Pidle
  if _p_.m != 0 || _p_.status != _Pidle {
    id := int64(0)
    if _p_.m != 0 {
      id = _p_.m.ptr().id
    }
    print("wirep: p->m=", _p_.m, "(", id, ") p->status=", _p_.status, "\n")
    throw("wirep: invalid p state")
  }

  // 绑定关系，并且更新P的状态
  _g_.m.p.set(_p_)
  _p_.m.set(_g_.m)
  _p_.status = _Prunning
}
```

##### M 的暂止和复始

`M` 是系统线程的抽象，它只有两种状态：`park` 和 `unpark`。无论出于什么原因，当 `M` 需要被暂止时，会调用 `stopm` 将 `M` 进行暂止，并阻塞到它被复始时，这一过程就是工作线程的暂止和复始。它的流程也非常简单，将 `M` 放回至空闲列表中，而后使用 `note` 注册一个暂止通知， 阻塞到它重新被复始。

```go
// Stops execution of the current m until new work is available.
// Returns with acquired P.
func stopm() {
  _g_ := getg()

  if _g_.m.locks != 0 {
    throw("stopm holding locks")
  }
  if _g_.m.p != 0 {
    throw("stopm holding p")
  }
  if _g_.m.spinning {
    throw("stopm spinning")
  }

  lock(&sched.lock)
  
  // 将 m 放回到 空闲列表中，因为我们马上就要暂止了
  mput(_g_.m)
  unlock(&sched.lock)
  mPark()

  // 此时已经被复始，说明有任务要执行
  // 立即 acquire P
  acquirep(_g_.m.nextp.ptr())
  _g_.m.nextp = 0
}

// mPark causes a thread to park itself - temporarily waking for
// fixups but otherwise waiting to be fully woken. This is the
// only way that m's should park themselves.
//go:nosplit
func mPark() {
  g := getg()
  for {
    // 暂止当前的 M，在此阻塞，直到被唤醒
    notesleep(&g.m.park)

    // Note, because of signal handling by this parked m,
    // a preemptive mDoFixup() may actually occur via
    // mDoFixupAndOSYield(). (See golang.org/issue/44193)
    noteclear(&g.m.park)
    if !mDoFixup() {
      return
    }
  }
}

```

##### 核心调度

核心调度是在 `shedule` 函数中进行的，目的就是找到一个可运行的G去运行。

```go
// One round of scheduler: find a runnable goroutine and execute it.
// Never returns.
func schedule() {
  _g_ := getg()

  if _g_.m.locks != 0 {
    throw("schedule: holding locks")
  }

  // m.lockedg 会在 LockOSThread 下变为非零
  if _g_.m.lockedg != 0 {
    stoplockedm()
    execute(_g_.m.lockedg.ptr(), false) // Never returns.
  }

  // 我们不应该将正在执行cgo调用的g给调度走，因为cgo调用是在m的g0栈上
  if _g_.m.incgo {
    throw("schedule: in cgo")
  }

top:
  pp := _g_.m.p.ptr()
  pp.preempt = false

  // 如果需要 GC，不再进行调度
  if sched.gcwaiting != 0 {
    gcstopm()
    goto top
  }

  if pp.runSafePointFn != 0 {
    runSafePointFn()
  }

  // Sanity check: if we are spinning, the run queue should be empty.
  // Check this before calling checkTimers, as that might call
  // goready to put a ready goroutine on the local run queue.
  if _g_.m.spinning && (pp.runnext != 0 || pp.runqhead != pp.runqtail) {
    throw("schedule: spinning with local work")
  }

  checkTimers(pp, 0)

  var gp *g
  var inheritTime bool

  // Normal goroutines will check for need to wakeP in ready,
  // but GCworkers and tracereaders will not, so the check must
  // be done here instead.
  tryWakeP := false
  if trace.enabled || trace.shutdown {
    gp = traceReader()
    if gp != nil {
      casgstatus(gp, _Gwaiting, _Grunnable)
      traceGoUnpark(gp, 0)
      tryWakeP = true
    }
  }

  // 如果正在GC，那就去找GC的g
  if gp == nil && gcBlackenEnabled != 0 {
    gp = gcController.findRunnableGCWorker(_g_.m.p.ptr())
    if gp != nil {
      tryWakeP = true
    }
  }

  if gp == nil {
    // Check the global runnable queue once in a while to ensure fairness.
    // Otherwise two goroutines can completely occupy the local runqueue
    // by constantly respawning each other.
    // 每调度P上的G61次，就去全局队列找一找
    if _g_.m.p.ptr().schedtick%61 == 0 && sched.runqsize > 0 {
      lock(&sched.lock)
      gp = globrunqget(_g_.m.p.ptr(), 1)
      unlock(&sched.lock)
    }
  }

  // 从当前P的 runnext 或者 runq 中查找
  if gp == nil {
    gp, inheritTime = runqget(_g_.m.p.ptr())
    // We can see gp != nil here even if the M is spinning,
    // if checkTimers added a local goroutine via goready.
  }

  // 从其他P中偷取
  if gp == nil {
    // findrunnable 挺长的，主要实现是从其他P偷取，查看 netpool 或者全局队列
    // 如果都找不到那么会调用 stopm 函数进行休眠，指导找到一个可运行的G
    gp, inheritTime = findrunnable() // blocks until work is available
  }

  // 找到G了

  // This thread is going to run a goroutine and is not spinning anymore,
  // so if it was marked as spinning we need to reset it now and potentially
  // start a new spinning M.
  // 这个线程将去运行一个G，所以它不能再自旋了，所以如果它是自旋状态我们需要重置。
  // 并且在这中间可能创建新的M。
  if _g_.m.spinning {
    resetspinning()
  }

  if sched.disable.user && !schedEnabled(gp) {
    // Scheduling of this goroutine is disabled. Put it on
    // the list of pending runnable goroutines for when we
    // re-enable user scheduling and look again.
    lock(&sched.lock)
    if schedEnabled(gp) {
      // Something re-enabled scheduling while we
      // were acquiring the lock.
      unlock(&sched.lock)
    } else {
      sched.disable.runnable.pushBack(gp)
      sched.disable.n++
      unlock(&sched.lock)
      goto top
    }
  }

  // If about to schedule a not-normal goroutine (a GCworker or tracereader),
  // wake a P if there is one.
  if tryWakeP {
    wakep()
  }
  if gp.lockedm != 0 {
    // 如果 g 需要 lock 到 m 上，则会将当前的 p， 给这个要 lock 的 g
	// 然后阻塞等待一个新的 p
    startlockedm(gp)
    goto top
  }

  // 开始执行
  execute(gp, inheritTime)
}
```

我们接着看 `execute` 函数：

```go
// Schedules gp to run on the current M.
// If inheritTime is true, gp inherits the remaining time in the
// current time slice. Otherwise, it starts a new time slice.
// Never returns.
//
// Write barriers are allowed because this is called immediately after
// acquiring a P in several places.
//
//go:yeswritebarrierrec
func execute(gp *g, inheritTime bool) {
  _g_ := getg()

  // 将 g 正式切换为 _Grunning 状态
  _g_.m.curg = gp
  gp.m = _g_.m
  casgstatus(gp, _Grunnable, _Grunning)
  gp.waitsince = 0
  gp.preempt = false
  gp.stackguard0 = gp.stack.lo + _StackGuard

  // 如果 inheritTime 为 true，则 gp 继承剩余的时间片。否则从一个新的时间片开始
  if !inheritTime {
    _g_.m.p.ptr().schedtick++
  }

  // profiling 相关
  hz := sched.profilehz
  if _g_.m.profilehz != hz {
    setThreadCPUProfiler(hz)
  }

  if trace.enabled {
    // GoSysExit has to happen when we have a P, but before GoStart.
    // So we emit it here.
    if gp.syscallsp != 0 && gp.sysblocktraced {
      traceGoSysExit(gp.sysexitticks)
    }
    traceGoStart()
  }

  // 设置了一些必要的东西之后开始执行了
  gogo(&gp.sched)
}
```

当开始执行 `execute` 后，`g` 会被切换到 `_Grunning` 状态。 设置自身的抢占信号，将 `m` 和 `g` 进行绑定。 最终调用 `gogo` 开始执行，`gogo` 使用汇编实现：

```asm
// func gogo(buf *gobuf)
// restore state from Gobuf; longjmp
TEXT runtime·gogo(SB), NOSPLIT, $0-8
	MOVQ	buf+0(FP), BX		/// 运行现场
	MOVQ	gobuf_g(BX), DX
	MOVQ	0(DX), CX		// 确认 g != nil
	JMP	gogo<>(SB)

TEXT gogo<>(SB), NOSPLIT, $0
	get_tls(CX)
	MOVQ	DX, g(CX)
	MOVQ	DX, R14		// set the g register
	MOVQ	gobuf_sp(BX), SP	// 恢复 SP
	MOVQ	gobuf_ret(BX), AX
	MOVQ	gobuf_ctxt(BX), DX
	MOVQ	gobuf_bp(BX), BP
	MOVQ	$0, gobuf_sp(BX)	// 清理，辅助 GC
	MOVQ	$0, gobuf_ret(BX)
	MOVQ	$0, gobuf_ctxt(BX)
	MOVQ	$0, gobuf_bp(BX)
	MOVQ	gobuf_pc(BX), BX  // 获取 g 要执行的函数的入口地址
	JMP	BX
```

使用 `JMP BX` 指令执行G（里面的过程着实有点复杂），在执行结束之后会调用 `runtime.goexit` 函数进行运行现场的清理：

```
// The top-most function running on a goroutine
// returns to goexit+PCQuantum.
TEXT runtime·goexit(SB),NOSPLIT|NOFRAME|TOPFRAME,$0-0
	MOVD	R0, R0	// NOP
	BL	runtime·goexit1(SB)	// does not return
```

```go
// mcall switches from the g to the g0 stack and invokes fn(g),
// where g is the goroutine that made the call.
// mcall saves g's current PC/SP in g->sched so that it can be restored later.
// It is up to fn to arrange for that later execution, typically by recording
// g in a data structure, causing something to call ready(g) later.
// mcall returns to the original goroutine g later, when g has been rescheduled.
// fn must not return at all; typically it ends by calling schedule, to let the m
// run other goroutines.
//
// mcall can only be called from g stacks (not g0, not gsignal).
//
// This must NOT be go:noescape: if fn is a stack-allocated closure,
// fn puts g on a run queue, and g executes before fn returns, the
// closure will be invalidated while it is still executing.
func mcall(fn func(*g))

// Finishes execution of the current goroutine.
func goexit1() {
  if raceenabled {
    racegoend()
  }
  if trace.enabled {
    traceGoEnd()
  }
  // 切换到 m->g0 栈, 并调用 fn(g).
  // 通过 mcall 完成 goexit0 的调用
  mcall(goexit0)
}

// goexit continuation on g0.
func goexit0(gp *g) {
  _g_ := getg()

  // // 切换当前的 g 为 _Gdead
  casgstatus(gp, _Grunning, _Gdead)
  if isSystemGoroutine(gp, false) {
    atomic.Xadd(&sched.ngsys, -1)
  }

  // 清理
  gp.m = nil
  locked := gp.lockedm != 0
  gp.lockedm = 0
  _g_.m.lockedg = 0
  gp.preemptStop = false
  gp.paniconfault = false
  gp._defer = nil // 应该已经为 true，但以防万一
  gp._panic = nil // Goexit 中 panic 则不为 nil， 指向栈分配的数据
  gp.writebuf = nil
  gp.waitreason = 0
  gp.param = nil
  gp.labels = nil
  gp.timer = nil

  if gcBlackenEnabled != 0 && gp.gcAssistBytes > 0 {
    // 刷新 assist credit 到全局池。
	// 如果应用在快速创建 Goroutine，这可以为 pacing 提供更好的信息。
    assistWorkPerByte := float64frombits(atomic.Load64(&gcController.assistWorkPerByte))
    scanCredit := int64(assistWorkPerByte * float64(gp.gcAssistBytes))
    atomic.Xaddint64(&gcController.bgScanCredit, scanCredit)
    gp.gcAssistBytes = 0
  }

  // 解绑 m 和 g
  dropg()

  if GOARCH == "wasm" { // no threads yet on wasm
    gfput(_g_.m.p.ptr(), gp)
    schedule() // never returns
  }

  if _g_.m.lockedInt != 0 {
    print("invalid m->lockedInt = ", _g_.m.lockedInt, "\n")
    throw("internal lockOSThread error")
  }

  // // 将 g 扔进 gfree 链表中等待复用
  gfput(_g_.m.p.ptr(), gp)
  if locked {
    // The goroutine may have locked this thread because
    // it put it in an unusual kernel state. Kill it
    // rather than returning it to the thread pool.

    // Return to mstart, which will release the P and exit
    // the thread.
    if GOOS != "plan9" { // See golang.org/issue/22227.
      gogo(&_g_.m.g0.sched)
    } else {
      // Clear lockedExt on plan9 since we may end up re-using
      // this thread.
      _g_.m.lockedExt = 0
    }
  }
  
  // 再次进行调度
  schedule()
}
```

##### 偷取 Goroutine

全局 `g` 链式队列中取 max 个 `g`，其中第一个用于执行，max-1 个放入本地队列。 如果放不下，则只在本地队列中放下能放的。过程比较简单：

```go
// 从全局可运行队列中获取可运行G时必须持有 sched.lock
func globrunqget(_p_ *p, max int32) *g {
  assertLockHeld(&sched.lock)

  // 如果全局队列中没有 g 直接返回
  if sched.runqsize == 0 {
    return nil
  }

  // 计算每个P应该从全局队列偷多少
  n := sched.runqsize/gomaxprocs + 1
  if n > sched.runqsize {
    n = sched.runqsize
  }

  // 不能超过取的最大个数
  if max > 0 && n > max {
    n = max
  }


  // 计算能不能在本地队列中放下 n 个
  if n > int32(len(_p_.runq))/2 {
    n = int32(len(_p_.runq)) / 2
  }

  // 修改本地队列的剩余空间
  sched.runqsize -= n

  // 拿到全局队列队头 g
  gp := sched.runq.pop()
  n--

  // 继续取剩下的 n-1 个全局队列放入本地队列
  for ; n > 0; n-- {
    gp1 := sched.runq.pop()
    runqput(_p_, gp1, false)
  }
  return gp
}
```

从本地队列中取，首先看 next 是否有已经安排要运行的 `g` ，如果有，则返回下一个要运行的 `g` 否则，以 `cas` 的方式从本地队列中取一个 `g`。如果是已经安排要运行的 `g`，则继承剩余的可运行时间片进行运行，否则以一个新的时间片来运行。

```go
// 从本地可运行队列中获取 g
// 如果 inheritTime 为 true，则 g 继承剩余的时间片
// 否则开始一个新的时间片。在所有者 P 上执行
func runqget(_p_ *p) (gp *g, inheritTime bool) {
  // If there's a runnext, it's the next G to run.
  for {
    next := _p_.runnext
    if next == 0 {
      break
    }
    // 如果 cas 成功，则 g 继承剩余时间片执行
    if _p_.runnext.cas(next, 0) {
      return next.ptr(), true
    }
  }

  for {
    h := atomic.LoadAcq(&_p_.runqhead) // load-acquire, synchronize with other consumers
    t := _p_.runqtail
    // 本地队列是空，返回 nil
    if t == h {
      return nil, false
    }

    // 从本地队列中以 cas 方式拿一个
    gp := _p_.runq[h%uint32(len(_p_.runq))].ptr()
    if atomic.CasRel(&_p_.runqhead, h, h+1) { // cas-release, commits consume
      return gp, false
    }
  }
}
```

偷取（steal）的实现是一个非常复杂的过程。这个过程来源于我们 需要仔细的思考什么时候对调度器进行加锁、什么时候对 `m` 进行暂止、 什么时候将 `m` 从自旋向非自旋切换等等。

```go
// 寻找一个可运行的 Goroutine 来执行。
// 尝试从其他的 P 偷取、从全局队列中获取、poll 网络
func findrunnable() (gp *g, inheritTime bool) {
  _g_ := getg()

  // 这里的条件与 handoffp 中的条件必须一致：
  // 如果 findrunnable 将返回 G 运行，handoffp 必须启动 M.

top:
  _p_ := _g_.m.p.ptr()

  // 如果在 gc，则暂止当前 m，直到复始后回到 top
  if sched.gcwaiting != 0 {
    gcstopm()
    goto top
  }

  if _p_.runSafePointFn != 0 {
    runSafePointFn()
  }

  now, pollUntil, _ := checkTimers(_p_, 0)

  if fingwait && fingwake {
    if gp := wakefing(); gp != nil {
      ready(gp, 0, true)
    }
  }

  // cgo 调用被终止，继续进入
  if *cgo_yield != nil {
    asmcgocall(*cgo_yield, nil)
  }

  // 取本地队列 local runq，如果已经拿到，立刻返回
  if gp, inheritTime := runqget(_p_); gp != nil {
    return gp, inheritTime
  }

  // 全局队列 global runq，如果已经拿到，立刻返回
  if sched.runqsize != 0 {
    lock(&sched.lock)
    gp := globrunqget(_p_, 0)
    unlock(&sched.lock)
    if gp != nil {
      return gp, false
    }
  }

  // Poll 网络，优先级比从其他 P 中偷要高。
  // 在我们尝试去其他 P 偷之前，这个 netpoll 只是一个优化。
  // 如果没有 waiter 或 netpoll 中的线程已被阻塞，则可以安全地跳过它。
  // 如果有任何类型的逻辑竞争与被阻塞的线程（例如它已经从 netpoll 返回，但尚未设置 lastpoll）
  // 该线程无论如何都将阻塞 netpoll。
  if netpollinited() && atomic.Load(&netpollWaiters) > 0 && atomic.Load64(&sched.lastpoll) != 0 {
    if list := netpoll(0); !list.empty() { // non-blocking
      gp := list.pop()
      injectglist(&list)
      casgstatus(gp, _Gwaiting, _Grunnable)
      if trace.enabled {
        traceGoUnpark(gp, 0)
      }
      return gp, false
    }
  }

  // Spinning Ms: steal work from other Ps.
  //
  // Limit the number of spinning Ms to half the number of busy Ps.
  // This is necessary to prevent excessive CPU consumption when
  // GOMAXPROCS>>1 but the program parallelism is low.
  procs := uint32(gomaxprocs)
  if _g_.m.spinning || 2*atomic.Load(&sched.nmspinning) < procs-atomic.Load(&sched.npidle) {
    
    if !_g_.m.spinning {
      _g_.m.spinning = true
      atomic.Xadd(&sched.nmspinning, 1)
    }

    gp, inheritTime, tnow, w, newWork := stealWork(now)
    now = tnow
    if gp != nil {
      // 偷取成功
      return gp, inheritTime
    }

    if newWork {
      // There may be new timer or GC work; restart to
      // discover.
      goto top
    }

    if w != 0 && (pollUntil == 0 || w < pollUntil) {
      // Earlier timer to wait for.
      pollUntil = w
    }
  }

  // 没有任何 work 可做。
  // 如果我们在 GC mark 阶段，则可以安全的扫描并 blacken 对象
  // 然后便有 work 可做，运行 idle-time 标记而非直接放弃当前的 P。
  if gcBlackenEnabled != 0 && gcMarkWorkAvailable(_p_) {
    node := (*gcBgMarkWorkerNode)(gcBgMarkWorkerPool.pop())
    if node != nil {
      _p_.gcMarkWorkerMode = gcMarkWorkerIdleMode
      gp := node.gp.ptr()
      casgstatus(gp, _Gwaiting, _Grunnable)
      if trace.enabled {
        traceGoUnpark(gp, 0)
      }
      return gp, false
    }
  }

  // 仅限于 wasm
  // 如果一个回调返回后没有其他 Goroutine 是苏醒的
  // 则暂停执行直到回调被触发。
  gp, otherReady := beforeIdle(now, pollUntil)
  if gp != nil {
    casgstatus(gp, _Gwaiting, _Grunnable)
    if trace.enabled {
      traceGoUnpark(gp, 0)
    }
    return gp, false
  }
  if otherReady {
    goto top
  }

  // 放弃当前的 P 之前，对 allp 做一个快照
  // 一旦我们不再阻塞在 safe-point 时候，可以立刻在下面进行修改
  allpSnapshot := allp
  
  // Also snapshot masks. Value changes are OK, but we can't allow
  // len to change out from under us.
  idlepMaskSnapshot := idlepMask
  timerpMaskSnapshot := timerpMask

  // 准备归还 p，对调度器加锁
  lock(&sched.lock)

  // 进入了 gc，回到顶部暂止 m
  if sched.gcwaiting != 0 || _p_.runSafePointFn != 0 {
    unlock(&sched.lock)
    goto top
  }

  // 全局队列中又发现了任务
  if sched.runqsize != 0 {
    gp := globrunqget(_p_, 0)
    unlock(&sched.lock)
    return gp, false
  }

  // 归还当前的 p
  if releasep() != _p_ {
    throw("findrunnable: wrong p")
  }
  // 将 p 放入 idle 链表
  pidleput(_p_)
  unlock(&sched.lock)

  // 这里要非常小心:
  // 线程从自旋到非自旋状态的转换，可能与新 Goroutine 的提交同时发生。
  // 我们必须首先丢弃 nmspinning，然后再次检查所有的 per-P 队列（并在期间伴随 #StoreLoad 内存屏障）
  // 如果反过来，其他线程可以在我们检查了所有的队列、然后提交一个 Goroutine、再丢弃了 nmspinning
  // 进而导致无法复始一个线程来运行那个 Goroutine 了。
  // 如果我们发现下面的新 work，我们需要恢复 m.spinning 作为重置的信号，
  // 以取消暂止新的工作线程（因为可能有多个 starving 的 Goroutine）。
  // 但是，如果在发现新 work 后我们也观察到没有空闲 P，可以暂停当前线程
  // 因为系统已满载，因此不需要自旋线程。
  wasSpinning := _g_.m.spinning
  if _g_.m.spinning {
    _g_.m.spinning = false
    if int32(atomic.Xadd(&sched.nmspinning, -1)) < 0 {
      throw("findrunnable: negative nmspinning")
    }

    // Note the for correctness, only the last M transitioning from
    // spinning to non-spinning must perform these rechecks to
    // ensure no missed work. We are performing it on every M that
    // transitions as a conservative change to monitor effects on
    // latency. See golang.org/issue/43997.

    // 再次检查所有的 runqueue
    _p_ = checkRunqsNoP(allpSnapshot, idlepMaskSnapshot)
    if _p_ != nil {
      acquirep(_p_)
      _g_.m.spinning = true
      atomic.Xadd(&sched.nmspinning, 1)
      goto top
    }

    // 再次检查 idle-priority GC work
    _p_, gp = checkIdleGCNoP()
    if _p_ != nil {
      acquirep(_p_)
      _g_.m.spinning = true
      atomic.Xadd(&sched.nmspinning, 1)

      // Run the idle worker.
      _p_.gcMarkWorkerMode = gcMarkWorkerIdleMode
      casgstatus(gp, _Gwaiting, _Grunnable)
      if trace.enabled {
        traceGoUnpark(gp, 0)
      }
      return gp, false
    }

    // Finally, check for timer creation or expiry concurrently with
    // transitioning from spinning to non-spinning.
    //
    // Note that we cannot use checkTimers here because it calls
    // adjusttimers which may need to allocate memory, and that isn't
    // allowed when we don't have an active P.
    pollUntil = checkTimersNoP(allpSnapshot, timerpMaskSnapshot, pollUntil)
  }

  // Poll network until next timer.
  if netpollinited() && (atomic.Load(&netpollWaiters) > 0 || pollUntil != 0) && atomic.Xchg64(&sched.lastpoll, 0) != 0 {
    atomic.Store64(&sched.pollUntil, uint64(pollUntil))
    if _g_.m.p != 0 {
      throw("findrunnable: netpoll with p")
    }
    if _g_.m.spinning {
      throw("findrunnable: netpoll with spinning")
    }
    delay := int64(-1)
    if pollUntil != 0 {
      if now == 0 {
        now = nanotime()
      }
      delay = pollUntil - now
      if delay < 0 {
        delay = 0
      }
    }
    if faketime != 0 {
      // When using fake time, just poll.
      delay = 0
    }
    list := netpoll(delay) // block until new work is available
    atomic.Store64(&sched.pollUntil, 0)
    atomic.Store64(&sched.lastpoll, uint64(nanotime()))
    if faketime != 0 && list.empty() {
      // Using fake time and nothing is ready; stop M.
      // When all M's stop, checkdead will call timejump.
      stopm()
      goto top
    }
    lock(&sched.lock)
    _p_ = pidleget()
    unlock(&sched.lock)
    if _p_ == nil {
      injectglist(&list)
    } else {
      acquirep(_p_)
      if !list.empty() {
        gp := list.pop()
        injectglist(&list)
        casgstatus(gp, _Gwaiting, _Grunnable)
        if trace.enabled {
          traceGoUnpark(gp, 0)
        }
        return gp, false
      }
      if wasSpinning {
        _g_.m.spinning = true
        atomic.Xadd(&sched.nmspinning, 1)
      }
      goto top
    }
  } else if pollUntil != 0 && netpollinited() {
    pollerPollUntil := int64(atomic.Load64(&sched.pollUntil))
    if pollerPollUntil == 0 || pollerPollUntil > pollUntil {
      netpollBreak()
    }
  }
  stopm()
  goto top
}
```

##### 唤醒M

```go
func resetspinning() {
  _g_ := getg()
  if !_g_.m.spinning {
    throw("resetspinning: not a spinning m")
  }
  _g_.m.spinning = false
  nmspinning := atomic.Xadd(&sched.nmspinning, -1)
  if int32(nmspinning) < 0 {
    throw("findrunnable: negative nmspinning")
  }
  // M wakeup policy is deliberately somewhat conservative, so check if we
  // need to wakeup another P here. See "Worker thread parking/unparking"
  // comment at the top of the file for details.
  wakep()
}

// 尝试将一个或多个 P 唤醒来执行 G
// 当 G 可能运行时（newproc, ready）时调用该函数
func wakep() {
  if atomic.Load(&sched.npidle) == 0 {
    return
  }
  // be conservative about spinning threads
  if atomic.Load(&sched.nmspinning) != 0 || !atomic.Cas(&sched.nmspinning, 0, 1) {
    return
  }
  startm(nil, true)
}

// Schedules some M to run the p (creates an M if necessary).
// If p==nil, tries to get an idle P, if no idle P's does nothing.
// May run with m.p==nil, so write barriers are not allowed.
// If spinning is set, the caller has incremented nmspinning and startm will
// either decrement nmspinning or set m.spinning in the newly started M.
//
// Callers passing a non-nil P must call from a non-preemptible context. See
// comment on acquirem below.
//
// Must not have write barriers because this may be called without a P.
//go:nowritebarrierrec
func startm(_p_ *p, spinning bool) {
  // Disable preemption.
  //
  // Every owned P must have an owner that will eventually stop it in the
  // event of a GC stop request. startm takes transient ownership of a P
  // (either from argument or pidleget below) and transfers ownership to
  // a started M, which will be responsible for performing the stop.
  //
  // Preemption must be disabled during this transient ownership,
  // otherwise the P this is running on may enter GC stop while still
  // holding the transient P, leaving that P in limbo and deadlocking the
  // STW.
  //
  // Callers passing a non-nil P must already be in non-preemptible
  // context, otherwise such preemption could occur on function entry to
  // startm. Callers passing a nil P may be preemptible, so we must
  // disable preemption before acquiring a P from pidleget below.
  mp := acquirem()
  lock(&sched.lock)
  if _p_ == nil {
    _p_ = pidleget()
    if _p_ == nil {
      unlock(&sched.lock)
      if spinning {
        // The caller incremented nmspinning, but there are no idle Ps,
        // so it's okay to just undo the increment and give up.
        if int32(atomic.Xadd(&sched.nmspinning, -1)) < 0 {
          throw("startm: negative nmspinning")
        }
      }
      releasem(mp)
      return
    }
  }
  nmp := mget()
  if nmp == nil {
    // No M is available, we must drop sched.lock and call newm.
    // However, we already own a P to assign to the M.
    //
    // Once sched.lock is released, another G (e.g., in a syscall),
    // could find no idle P while checkdead finds a runnable G but
    // no running M's because this new M hasn't started yet, thus
    // throwing in an apparent deadlock.
    //
    // Avoid this situation by pre-allocating the ID for the new M,
    // thus marking it as 'running' before we drop sched.lock. This
    // new M will eventually run the scheduler to execute any
    // queued G's.
    id := mReserveID()
    unlock(&sched.lock)

    var fn func()
    if spinning {
      // The caller incremented nmspinning, so set m.spinning in the new M.
      fn = mspinning
    }
    newm(fn, _p_, id)
    // Ownership transfer of _p_ committed by start in newm.
    // Preemption is now safe.
    releasem(mp)
    return
  }
  unlock(&sched.lock)
  if nmp.spinning {
    throw("startm: m is spinning")
  }
  if nmp.nextp != 0 {
    throw("startm: m has p")
  }
  if spinning && !runqempty(_p_) {
    throw("startm: p has runnable gs")
  }
  // The caller incremented nmspinning, so set m.spinning in the new M.
  nmp.spinning = spinning
  nmp.nextp.set(_p_)
  notewakeup(&nmp.park)
  // Ownership transfer of _p_ committed by wakeup. Preemption is now
  // safe.
  releasem(mp)
}

// 尝试从 midel 列表中获取一个 M
// 调度器必须锁住
// 可能在 STW 期间运行，故不允许 write barrier
//go:nowritebarrierrec
func mget() *m {
  assertLockHeld(&sched.lock)

  mp := sched.midle.ptr()
  if mp != nil {
    sched.midle = mp.schedlink
    sched.nmidle--
  }
  return mp
}
```

##### 新建M 

`M` 是通过 `newm` 来创生的，一般情况下，能够非常简单的创建， 某些特殊情况（线程状态被污染），`M` 的创建需要一个叫做模板线程的功能加以配合：

```go
// 创建一个新的 m. 它会启动并调用 fn 或调度器
// fn 必须是静态、非堆上分配的闭包
// 它可能在 m.p==nil 时运行，因此不允许 write barrier
// 
// id is optional pre-allocated m ID. Omit by passing -1.
//go:nowritebarrierrec
func newm(fn func(), _p_ *p, id int64) {
  // 分配一个 m
  mp := allocm(_p_, fn, id)
  mp.doesPark = (_p_ != nil)
  // 设置 p 用于后续绑定
  mp.nextp.set(_p_)
  // 设置 signal mask
  mp.sigmask = initSigmask
  if gp := getg(); gp != nil && gp.m != nil && (gp.m.lockedExt != 0 || gp.m.incgo) && GOOS != "plan9" {
    // We're on a locked M or a thread that may have been
    // started by C. The kernel state of this thread may
    // be strange (the user may have locked it for that
    // purpose). We don't want to clone that into another
    // thread. Instead, ask a known-good thread to create
    // the thread for us.
    //
    // This is disabled on Plan 9. See golang.org/issue/22227.
    //
    // TODO: This may be unnecessary on Windows, which
    // doesn't model thread creation off fork.
    lock(&newmHandoff.lock)
    if newmHandoff.haveTemplateThread == 0 {
      throw("on a locked thread with no template thread")
    }
    mp.schedlink = newmHandoff.newm
    newmHandoff.newm.set(mp)
    if newmHandoff.waiting {
      newmHandoff.waiting = false
      // 唤醒 m, 自旋到非自旋
      notewakeup(&newmHandoff.wake)
    }
    unlock(&newmHandoff.lock)
    return
  }
  newm1(mp)
}

// Allocate a new m unassociated with any thread.
// Can use p for allocation context if needed.
// fn is recorded as the new m's m.mstartfn.
// id is optional pre-allocated m ID. Omit by passing -1.
//
// This function is allowed to have write barriers even if the caller
// isn't because it borrows _p_.
//
//go:yeswritebarrierrec
func allocm(_p_ *p, fn func(), id int64) *m {
  _g_ := getg()
  acquirem() // disable GC because it can be called from sysmon
  if _g_.m.p == 0 {
    acquirep(_p_) // temporarily borrow p for mallocs in this function
  }

  // Release the free M list. We need to do this somewhere and
  // this may free up a stack we can use.
  if sched.freem != nil {
    lock(&sched.lock)
    var newList *m
    for freem := sched.freem; freem != nil; {
      if freem.freeWait != 0 {
        next := freem.freelink
        freem.freelink = newList
        newList = freem
        freem = next
        continue
      }
      // stackfree must be on the system stack, but allocm is
      // reachable off the system stack transitively from
      // startm.
      systemstack(func() {
        stackfree(freem.g0.stack)
      })
      freem = freem.freelink
    }
    sched.freem = newList
    unlock(&sched.lock)
  }

  mp := new(m)
  mp.mstartfn = fn
  mcommoninit(mp, id)

  // In case of cgo or Solaris or illumos or Darwin, pthread_create will make us a stack.
  // Windows and Plan 9 will layout sched stack on OS stack.
  if iscgo || mStackIsSystemAllocated() {
    mp.g0 = malg(-1)
  } else {
    mp.g0 = malg(8192 * sys.StackGuardMultiplier)
  }
  mp.g0.m = mp

  if _p_ == _g_.m.p.ptr() {
    releasep()
  }
  releasem(_g_.m)

  return mp
}

func newm1(mp *m) {
  if iscgo {
    var ts cgothreadstart
    if _cgo_thread_start == nil {
      throw("_cgo_thread_start missing")
    }
    ts.g.set(mp.g0)
    ts.tls = (*uint64)(unsafe.Pointer(&mp.tls[0]))
    ts.fn = unsafe.Pointer(funcPC(mstart))
    if msanenabled {
      msanwrite(unsafe.Pointer(&ts), unsafe.Sizeof(ts))
    }
    execLock.rlock() // Prevent process clone.
    asmcgocall(_cgo_thread_start, unsafe.Pointer(&ts))
    execLock.runlock()
    return
  }
  execLock.rlock() // Prevent process clone.
  newosproc(mp)
  execLock.runlock()
}
```

当 `m` 被创建时，会转去运行 `mstart`：

- 如果当前程序为 `cgo` 程序，则会通过 `asmcgocall` 来创建线程并调用 `mstart`
- 否则会调用 `newosproc` 来创建线程，从而调用 `mstart`。

既然是 `newosproc` ，我们此刻仍在 Go 的空间中，那么实现就是操作系统特定的了，以下是linux上的：

```go
// May run with m.p==nil, so write barriers are not allowed.
//go:nowritebarrier
func newosproc(mp *m) {
	stk := unsafe.Pointer(mp.g0.stack.hi)
	/*
	 * note: strace gets confused if we use CLONE_PTRACE here.
	 */
	if false {
		print("newosproc stk=", stk, " m=", mp, " g=", mp.g0, " clone=", funcPC(clone), " id=", mp.id, " ostk=", &mp, "\n")
	}

	// Disable signals during clone, so that the new thread starts
	// with signals disabled. It will enable them in minit.
	var oset sigset
	sigprocmask(_SIG_SETMASK, &sigset_all, &oset)
	ret := clone(cloneFlags, stk, unsafe.Pointer(mp), unsafe.Pointer(mp.g0), unsafe.Pointer(funcPC(mstart)))
	sigprocmask(_SIG_SETMASK, &oset, nil)

	if ret < 0 {
		print("runtime: failed to create new OS thread (have ", mcount(), " already; errno=", -ret, ")\n")
		if ret == -_EAGAIN {
			println("runtime: may need to increase max user processes (ulimit -u)")
		}
		throw("newosproc")
	}
}
```

##### M/G 解绑

实际上就是指将当前 `g` 的 `m` 置空、将当前 `m` 的 `g` 置空，从而完成解绑，通过 `dropg` 完成：

```go
// dropg 移除 m 与当前 Goroutine m->curg（简称 gp ）之间的关联。
// 通常，调用方将 gp 的状态设置为非 _Grunning 后立即调用 dropg 完成工作。
// 调用方也有责任在 gp 将使用 ready 时重新启动时进行相关安排。
// 在调用 dropg 并安排 gp ready 好后，调用者可以做其他工作，但最终应该
// 调用 schedule 来重新启动此 m 上的 Goroutine 的调度。
func dropg() {
  _g_ := getg()

  setMNoWB(&_g_.m.curg.m, nil)
  setGNoWB(&_g_.m.curg, nil)
}

// setMNoWB 当使用 muintptr 不可行时，在没有 write barrier 下执行 *mp = new
//go:nosplit
//go:nowritebarrier
func setMNoWB(mp **m, new *m) {
	(*muintptr)(unsafe.Pointer(mp)).set(new)
}

// setGNoWB 当使用 guintptr 不可行时，在没有 write barrier 下执行 *gp = new
//go:nosplit
//go:nowritebarrier
func setGNoWB(gp **g, new *g) {
	(*guintptr)(unsafe.Pointer(gp)).set(new)
}
```

整个调度器循环可以以下面的一张图来描述：

![](调度循环.jpg)


#### 系统监控

在创建主goroutine的时候，也在系统栈上启动了 `sysmon`，是时候了解下它的作用了：

```go
func main() {
    ....
    if GOARCH != "wasm" { // no threads on wasm yet, so no sysmon
        // For runtime_syscall_doAllThreadsSyscall, we
        // register sysmon is not ready for the world to be
        // stopped.
        atomic.Store(&sched.sysmonStarting, 1)
        systemstack(func() {
        newm(sysmon, nil, -1)
        })
    }
    ....
}
```

系统监控在独立的 `M` 上运行，不需要 `P`，所以不能出现写屏障：

```go
// Always runs without a P, so write barriers are not allowed.
//
//go:nowritebarrierrec
func sysmon() {
  lock(&sched.lock)
  sched.nmsys++
  checkdead()
  unlock(&sched.lock)

  // For syscall_runtime_doAllThreadsSyscall, sysmon is
  // sufficiently up to participate in fixups.
  atomic.Store(&sched.sysmonStarting, 0)

  lasttrace := int64(0)
  idle := 0 // how many cycles in succession we had not wokeup somebody
  delay := uint32(0)

  for {
    if idle == 0 { // 每次启动先休眠 20us
      delay = 20
    } else if idle > 50 { // 1ms 后就翻倍休眠时间
      delay *= 2
    }
    if delay > 10*1000 { // 最大10ms
      delay = 10 * 1000
    }
    usleep(delay)
    mDoFixup()

    // 如果启用了 schedtrace，sysmon 不应进入深度睡眠，以便它可以在正确的时间打印该信息。
    //
    // 如果有任何活动的 P，它也不应该进入深度睡眠，这样它就可以从系统调用中重新获取 P，
    // 抢占长时间运行的 G，并在所有 P 长时间忙碌时轮询网络。
    //
    // 如果某个P由于退出系统调用或者定时器到期而重新被激活，那么sysmon应该从深度睡眠中唤醒，
    // 以便它可以继续干自己的活。
    now := nanotime()
    if debug.schedtrace <= 0 && (sched.gcwaiting != 0 || atomic.Load(&sched.npidle) == uint32(gomaxprocs)) {
      lock(&sched.lock)
      if atomic.Load(&sched.gcwaiting) != 0 || atomic.Load(&sched.npidle) == uint32(gomaxprocs) {
        syscallWake := false
        next, _ := timeSleepUntil()
        if next > now {
          atomic.Store(&sched.sysmonwait, 1)
          unlock(&sched.lock)
          // Make wake-up period small enough
          // for the sampling to be correct.
          sleep := forcegcperiod / 2
          if next-now < sleep {
            sleep = next - now
          }
          shouldRelax := sleep >= osRelaxMinNS
          if shouldRelax {
            osRelax(true)
          }
          syscallWake = notetsleep(&sched.sysmonnote, sleep)
          mDoFixup()
          if shouldRelax {
            osRelax(false)
          }
          lock(&sched.lock)
          atomic.Store(&sched.sysmonwait, 0)
          noteclear(&sched.sysmonnote)
        }
        if syscallWake {
          idle = 0
          delay = 20
        }
      }
      unlock(&sched.lock)
    }

    lock(&sched.sysmonlock)
    // Update now in case we blocked on sysmonnote or spent a long time
    // blocked on schedlock or sysmonlock above.
    now = nanotime()

    // trigger libc interceptors if needed
    if *cgo_yield != nil {
      asmcgocall(*cgo_yield, nil)
    }

    // 如果超过 10ms 没有 poll，则 poll 一下网络
    lastpoll := int64(atomic.Load64(&sched.lastpoll))
    if netpollinited() && lastpoll != 0 && lastpoll+10*1000*1000 < now {
      atomic.Cas64(&sched.lastpoll, uint64(lastpoll), uint64(now))
      list := netpoll(0) // non-blocking - returns list of goroutines
      if !list.empty() {
        // 需要在插入 g 列表前减少空闲锁住的 m 的数量（假装有一个正在运行）
		// 否则会导致这些情况：
		// injectglist 会绑定所有的 p，但是在它开始 M 运行 P 之前，另一个 M 从 syscall 返回，
		// 完成运行它的 G ，注意这时候没有 work 要做，且没有其他正在运行 M 的死锁报告。
        incidlelocked(-1)
        injectglist(&list)
        incidlelocked(1)
      }
    }
    mDoFixup()
    if GOOS == "netbsd" {
      // netpoll is responsible for waiting for timer
      // expiration, so we typically don't have to worry
      // about starting an M to service timers. (Note that
      // sleep for timeSleepUntil above simply ensures sysmon
      // starts running again when that timer expiration may
      // cause Go code to run again).
      //
      // However, netbsd has a kernel bug that sometimes
      // misses netpollBreak wake-ups, which can lead to
      // unbounded delays servicing timers. If we detect this
      // overrun, then startm to get something to handle the
      // timer.
      //
      // See issue 42515 and
      // https://gnats.netbsd.org/cgi-bin/query-pr-single.pl?number=50094.
      if next, _ := timeSleepUntil(); next < now {
        startm(nil, false)
      }
    }

    if atomic.Load(&scavenge.sysmonWake) != 0 {
      // Kick the scavenger awake if someone requested it.
      wakeScavenger()
    }

    // 抢占在 syscall 中阻塞的 P、运行时间过长的 G
    if retake(now) != 0 {
      idle = 0
    } else {
      idle++
    }

    // 检查是否需要强制触发 GC
    if t := (gcTrigger{kind: gcTriggerTime, now: now}); t.test() && atomic.Load(&forcegc.idle) != 0 {
      lock(&forcegc.lock)
      forcegc.idle = 0
      var list gList
      list.push(forcegc.g)
      injectglist(&list)
      unlock(&forcegc.lock)
    }
    if debug.schedtrace > 0 && lasttrace+int64(debug.schedtrace)*1000000 <= now {
      lasttrace = now
      schedtrace(debug.scheddetail > 0)
    }
    unlock(&sched.sysmonlock)
  }
}
```

系统监控在运行时扮演的角色无需多言， 因为使用的是运行时通知机制，在 Linux 上由 `Futex` 实现，不依赖调度器， 因此它自身通过 `newm` 在一个 `M` 上独立运行， 自身永远保持在一个循环内直到应用结束。休眠有好几种不同的休眠策略：

- 至少休眠 `20us`
- 如果抢占 `P` 和 `G` 失败次数超过50、且没有触发 GC，则说明很闲，翻倍休眠
- 如果休眠翻倍时间超过 `10ms`，保持休眠 `10ms` 不变
- 休眠结束后，先观察目前的系统状态，如果正在进行 GC，那么继续休眠。 这时的休眠会被设置超时。

如果没有超时被唤醒，则说明 `GC` 已经结束，一切都很好，继续做本职工作。 如果超时，则无关 `GC`，必须开始进行本职善后：

- 如果 `cgo` 调用被 `libc` 拦截，继续触发起调用
- 如果已经有 `10ms` 没有 `poll` 网络数据，则 `poll` 一下网络数据
- 抢占在系统调用中阻塞的 `P` 已经运行时间过长的 `G`
- 检查是不是该触发 `GC` 了
- 如果距离上一次堆清理已经超过了两分半，则执行清理工作

#### 线程管理

Go语言编程中，用户基本上不会涉及到线程的管理，都是由调度系统完成的，但仍然有一些与线程管理相关的接口。

##### LockOSThread

该方法在 runtime 包中分别提供了私有和公开方法，私有的方法整个运行时只有在 `runtime.main` 调用 `main.init` 、和 `cgo` 的 `C` 调用 `Go` 时候才会使用， 其中 `main.init` 其实也是为了 `cgo` 里 `Go` 调用某些 `C` 图形库时需要主线程支持才使用的。而用户态的公开方法则不同，还额外增加了一个模板线程的处理。

{% tabs LockOSThread %}

<!-- tab 私有方法 -->

```go
//go:nosplit
func lockOSThread() {
  getg().m.lockedInt++
  dolockOSThread()
}
```
<!-- endtab -->

<!-- tab 公有方法 -->
```go
// LockOSThread wires the calling goroutine to its current operating system thread.
// The calling goroutine will always execute in that thread,
// and no other goroutine will execute in it,
// until the calling goroutine has made as many calls to
// UnlockOSThread as to LockOSThread.
// If the calling goroutine exits without unlocking the thread,
// the thread will be terminated.
//
// All init functions are run on the startup thread. Calling LockOSThread
// from an init function will cause the main function to be invoked on
// that thread.
//
// A goroutine should call LockOSThread before calling OS services or
// non-Go library functions that depend on per-thread state.
func LockOSThread() {
  if atomic.Load(&newmHandoff.haveTemplateThread) == 0 && GOOS != "plan9" {
    // 如果我们需要从锁定的线程启动一个新线程，我们需要模板线程。
    // 当我们处于一个已知良好的状态时，立即启动它。
    startTemplateThread()
  }
  _g_ := getg()
  _g_.m.lockedExt++
  if _g_.m.lockedExt == 0 {
    _g_.m.lockedExt--
    panic("LockOSThread nesting overflow")
  }
  dolockOSThread()
}
```
<!-- endtab -->

<!-- tab dolockOSThread -->

```go
// dolockOSThread 在修改 m.locked 后由 LockOSThread 和 lockOSThread 调用。
// 在此调用期间不允许抢占，否则此函数中的 m 可能与调用者中的 m 不同。
//go:nosplit
func dolockOSThread() {
  if GOARCH == "wasm" {
    return // no threads on wasm yet
  }
  _g_ := getg()
  _g_.m.lockedg.set(_g_)
  _g_.lockedm.set(_g_.m)
}
```
<!-- endtab -->

{% endtabs %}

##### UnlockOSThread

Unlock 的部分非常简单，减少计数，再实际 dounlock：

```go
func unlockOSThread() {
  _g_ := getg()
  if _g_.m.lockedInt == 0 {
    systemstack(badunlockosthread)
  }
  _g_.m.lockedInt--
  dounlockOSThread()
}

// UnlockOSThread undoes an earlier call to LockOSThread.
// If this drops the number of active LockOSThread calls on the
// calling goroutine to zero, it unwires the calling goroutine from
// its fixed operating system thread.
// If there are no active LockOSThread calls, this is a no-op.
//
// Before calling UnlockOSThread, the caller must ensure that the OS
// thread is suitable for running other goroutines. If the caller made
// any permanent changes to the state of the thread that would affect
// other goroutines, it should not call this function and thus leave
// the goroutine locked to the OS thread until the goroutine (and
// hence the thread) exits.
func UnlockOSThread() {
  _g_ := getg()
  if _g_.m.lockedExt == 0 {
    return
  }
  _g_.m.lockedExt--
  dounlockOSThread()
}
```

`dounlockOSThread` 只是简单的将 `lockedg` 和 `lockedm` 两个字段清零：

```go
// dounlockOSThread 在更新 m->locked 后由 UnlockOSThread 和 unlockOSThread 调用。
// 在此调用期间不允许抢占，否则此函数中的 m 可能与调用者中的 m 不同。
//go:nosplit
func dounlockOSThread() {
	if GOARCH == "wasm" {
		return // no threads on wasm yet
	}
	_g_ := getg()
	if _g_.m.lockedInt != 0 || _g_.m.lockedExt != 0 {
		return
	}
	_g_.m.lockedg = 0
	_g_.lockedm = 0
}
```

### 参考链接

1. [GDB 命令帮助文档](https://visualgdb.com/gdbreference/commands/)
2. [https://www.codepng.app/](https://www.codepng.app/)
3. [欧神·并发调度](https://golang.design/under-the-hood/zh-cn/part2runtime/ch06sched/)