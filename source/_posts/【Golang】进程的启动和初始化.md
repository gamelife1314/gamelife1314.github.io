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


### 参考链接

1. [GDB 命令帮助文档](https://visualgdb.com/gdbreference/commands/)
2. [https://www.codepng.app/](https://www.codepng.app/)
3. [欧神·并发调度](https://golang.design/under-the-hood/zh-cn/part2runtime/ch06sched/)