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

在Go中M只有两个状态：自旋还是非自旋。M的初始化是在 `mcommoninit` 函数中进行，不管是系统刚运行起来时，主线 `m0` 的初始化还是新建 `M` 的初始化都会调用这个函数：

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

```go
type p struct {
	id          int32
	status      uint32 // one of _Prunning/_Psyscall/_Pgcstop/_Pdead
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

	// Queue of runnable goroutines. Accessed without lock.
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

    ...
}
```

目前情况下，`P` 一共有四种状态，`_Pidle`，`_Prunning`，`_Psyscall`，`_Pgcstop` 和 `_Pdead`：

- `_Pidle`：表示没有使用 P 来运行用户代码或调度程序。通常，它位于空闲 P 列表中并且可供调度程序使用，但它可能只是在其他状态之间转换，空闲状态下它的 runq 队列是空的。

- `_Prunning`：表示 `P`正在被`M`持有运行用户代码或者调度器。只有当`M`持有`P`时，它的状态才被允许修改到 `_Prunning`。如果没有活干，那么`P`将切换到`_Pidle`状态；当进行系统调用的时候会切换到 `_Psyscall`；`GC` 期间会切换到 `_Pgcstop`；`M` 也可以将 `P` 的所有权直接交给另一个 `M`（例如，调度到锁定的 `G`）；

- `_Psyscall`：说明`P`没有在运行用户代码，它与系统调用中的 `M` 有亲和关系，但不属于它，并且可能被另一个 `M` 窃取。这与 `_Pidle` 类似，但使用轻量级转换并保持 `M` 亲缘关系;

- `_Pgcstop`：这意味着P由于STW而暂停并且被触发STW的M拥有；STW 的`M`会继续使用`P`；从 `_Prunning`转换到`_Pgcstop`会导致M释放它的P并且停止；`P` 会保留它的运行队列，starttheworld 将在具有非空运行队列的P上重启调度程序；

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

### 参考链接

1. [GDB 命令帮助文档](https://visualgdb.com/gdbreference/commands/)
2. [https://www.codepng.app/](https://www.codepng.app/)
3. [欧神·并发调度](https://golang.design/under-the-hood/zh-cn/part2runtime/ch06sched/)