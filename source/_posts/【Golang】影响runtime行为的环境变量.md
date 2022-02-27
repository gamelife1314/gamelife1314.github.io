---
title: 【Golang】影响runtime行为的环境变量
date: 2022-02-23 16:17:56
categories:
    - golang
---

在Go语言中，为了控制低级别的 `runtime` 行为，官方提供了一些环境变量，主要有：

- `GOGC`
- `GODEBUG`
- `GOMAXPROCS`
- `GORACE`
- `GOTRACEBACK`

初次之外，还有用于编译期的 `GOROOT`，`GOPATH`，`GOOS` 和 `GOARCH`，以及用于玩转SSA的 `GOSSAFUNC`。

<!-- more -->

在 `src/runtime/extern.go` 文件中详细描述了这些环境变量的背景和意义。在调度器初始化阶段，解析环境变量并且把他们放进全局变量 `envs` 中。

```go
// The bootstrap sequence is:
//
//	call osinit
//	call schedinit
//	make & queue new G
//	call runtime·mstart
//
// The new G calls runtime·main.
func schedinit() {
    ...
    goenvs()
    ...
}
```

### GOGC

`GOGC` 用于控制GC的触发频率，默认值是：`100`，意思是直到上次垃圾回收堆内存上涨 `100%` 时触发GC。如果设置 `GOGC=off`将彻底关闭GC。在运行时可以通过 [`debug.SetGCPercent`](https://pkg.go.dev/runtime/debug#SetGCPercent ) 进行动态调整。

### GODEBUG

`GODEBUG` 用于控制运行时中的调试参数，形式上是 `,` 分割的键值对，例如：

> GODEBUG='gctrace=1,inittrace=1' go run main.go

在调度系统初始化的时候，首先解析环境变量，然后解析调试参数：

```go
// The bootstrap sequence is:
//
//	call osinit
//	call schedinit
//	make & queue new G
//	call runtime·mstart
//
// The new G calls runtime·main.
func schedinit() {
    ...
    goenvs()
    parsedebugvars()
    ...
}
```

调试参数解析结束之后，都保存在全局变量 `dbgvars` 中：

```go
// src/runtime/runtime1.go
var dbgvars = []dbgVar{
	{"allocfreetrace", &debug.allocfreetrace},
	{"clobberfree", &debug.clobberfree},
	{"cgocheck", &debug.cgocheck},
	{"efence", &debug.efence},
	{"gccheckmark", &debug.gccheckmark},
	{"gcpacertrace", &debug.gcpacertrace},
	{"gcshrinkstackoff", &debug.gcshrinkstackoff},
	{"gcstoptheworld", &debug.gcstoptheworld},
	{"gctrace", &debug.gctrace},
	{"invalidptr", &debug.invalidptr},
	{"madvdontneed", &debug.madvdontneed},
	{"sbrk", &debug.sbrk},
	{"scavtrace", &debug.scavtrace},
	{"scheddetail", &debug.scheddetail},
	{"schedtrace", &debug.schedtrace},
	{"tracebackancestors", &debug.tracebackancestors},
	{"asyncpreemptoff", &debug.asyncpreemptoff},
	{"inittrace", &debug.inittrace},
}
```

#### allocfreetrace

`allocfreetrace=1` 会对于每次的内存分配都会进行概要分析，并且在分配内存和释放时打印调用栈。


#### clobberfree

`clobberfree=1` 会使垃圾回收期在释放对象，破坏持有非法内容对象的内存。

#### cgocheck

设置 `cgocheck=0` 会禁用对错误传递Go指针到非Go代码的检查。`cgocheck=1`（默认值）会开启相对简单的检查，这可能导致一些错误被忽略。`cgocheck=2`会采取相对严格的校验规则，会导致程序运行较慢，但是不会遗漏错误。

#### efence

设置 `efence=1` 会让内存分配器在分配内存时将每个对象分配在唯一的内存页上，并且这个地址永远不会被回收。

#### gccheckmark

setting gccheckmark=1 enables verification of the garbage collector's concurrent mark phase by performing a second mark pass while the world is stopped.  If the second pass finds a reachable object that was not found by concurrent mark, the garbage collector will panic.

#### gcpacertrace

设置 `gcpacertrace=1` 会使垃圾回收器打印并发 pacer 的内部状态信息。

#### gcshrinkstackoff

设置 `gcshrinkstackoff=1` 进制 `goroutine` 缩栈，这种模式下，`goroutine` 的栈只能增长。

#### gcstoptheworld

设置 `gcstoptheworld=1` 将禁用并发 `gc`，这样每次垃圾回收都会 `STW`。`gcstoptheworld=2` 处禁用并发收集之外还会禁用后续的并发清扫。

#### gctrace

设置 `gctrace=1` 会在每次 `gc` 时，向标准错误输出一行信息，包括收集的总量，停顿的时长等。输出的格式可能会变，目前的格式如下：

> gc # @#s #%: #+#+# ms clock, #+#/#/#+# ms cpu, #->#-># MB, # MB goal, # P

每个字段的解释如下：

- `gc`：gc 的次数，随着每次垃圾回收自增；
- `@#s`：程序的运行时间，单位是秒；
- `#%`：从程序运行开始到当前GC，花费在GC上的时间占比；
- `#+#+# ms clock`：`gc` 各个阶段占用的时间；，
- `#+#/#/#+# ms cpu`：垃圾回收占用的CPU时间；
- `#->#-># MB`：分别表示 `gc` 开始，结束以及当前的堆内存大小；
- `# MB goal`：当堆内存达到这个值时，触发下次 `gc`；
- `# P`：`P` 的个数；

例如查看下面程序的 `gc` 信息：

```go
package main

import (
	"fmt"
	"time"
)

var data []byte

func main() {
	data = make([]byte, 0, 100)
	fmt.Println(data)
	time.Sleep(3 * time.Minute)
}
```

```
root@b89af2baca14:/WORKDIR/gostudy/hello# GODEBUG='gctrace=1' go run main.go
gc 1 @0.015s 1%: 0.074+2.1+0.041 ms clock, 0.29+0.14/0.13/0+0.16 ms cpu, 4->5->1 MB, 5 MB goal, 4 P
gc 2 @0.024s 1%: 0.012+1.0+0.002 ms clock, 0.050+0.10/0.13/0.24+0.010 ms cpu, 4->4->0 MB, 5 MB goal, 4 P
gc 3 @0.033s 1%: 0.017+1.8+0.004 ms clock, 0.070+0.29/0/0+0.018 ms cpu, 4->4->0 MB, 5 MB goal, 4 P
gc 4 @0.041s 1%: 0.022+0.44+0.001 ms clock, 0.088+0.10/0.25/0.007+0.007 ms cpu, 4->4->0 MB, 5 MB goal, 4 P
gc 5 @0.049s 1%: 0.023+2.1+0.001 ms clock, 0.093+0.037/0.76/0.036+0.006 ms cpu, 4->4->0 MB, 5 MB goal, 4 P
gc 6 @0.055s 1%: 0.017+0.53+0.28 ms clock, 0.068+0.060/0.29/0.37+1.1 ms cpu, 4->4->1 MB, 5 MB goal, 4 P
gc 7 @0.058s 2%: 0.12+0.38+0.001 ms clock, 0.49+0.10/0.24/0.17+0.004 ms cpu, 4->4->1 MB, 5 MB goal, 4 P
gc 8 @0.060s 2%: 0.044+0.52+0.001 ms clock, 0.17+0.096/0.28/0.090+0.004 ms cpu, 4->4->1 MB, 5 MB goal, 4 P
gc 9 @0.065s 2%: 0.074+0.29+0.002 ms clock, 0.29+0.096/0.16/0.23+0.009 ms cpu, 4->4->0 MB, 5 MB goal, 4 P
# command-line-arguments
gc 1 @0.005s 2%: 0.007+0.86+0.010 ms clock, 0.030+0.068/0.42/0.88+0.043 ms cpu, 4->5->4 MB, 5 MB goal, 4 P
# command-line-arguments
gc 1 @0.001s 17%: 0.14+0.68+0.11 ms clock, 0.57+0.044/0.49/0.35+0.45 ms cpu, 4->5->5 MB, 5 MB goal, 4 P
gc 2 @0.003s 11%: 0.002+1.5+0.094 ms clock, 0.011+0.068/0.65/0.75+0.37 ms cpu, 9->9->8 MB, 10 MB goal, 4 P
[]
GC forced
gc 10 @120.397s 0%: 0.028+0.49+0.002 ms clock, 0.11+0/0.29/0.27+0.009 ms cpu, 3->3->0 MB, 4 MB goal, 4 P
root@b89af2baca14:/WORKDIR/gostudy/hello#
```

#### inittrace

设置 `inittrace=1` 会让 `runtime` 打印每个 `package` 初始化工作的信息，包括执行时间和内存申请信息。对于没有用户定义和编译器生成的初始化工作的包，作为插件加载时，不会有任何信息打印。信息格式目前如下：

> init # @#ms, # ms clock, # bytes, # allocs

每个字段的意义如下：

- `init #`：包名；
- `@# ms`：从程序开始启动到init执行时的时间，单位是毫秒；
- `# clock`：包初始化工作耗时；
- `bytes`：申请的堆内存大小；
- `allocs`：内存申请次数；

#### madvdontneed

设置 `madvdontneed=0` 在linux系统，归还内存给操作系统时使用 `MADV_FREE` 而不是 `MADV_DONTNEED`，这很高效，但是同时意味着 `RSS` 数量只会在系统压力较小时下降。

#### memprofilerate

设置 `memprofilerate=X` 会更新 [`runtime.MemProfileRate`](https://pkg.go.dev/runtime#pkg-variables) 的值，设置位0时，禁用内存分析功能。

```go
// MemProfileRate controls the fraction of memory allocations
// that are recorded and reported in the memory profile.
// The profiler aims to sample an average of
// one allocation per MemProfileRate bytes allocated.
//
// To include every allocated block in the profile, set MemProfileRate to 1.
// To turn off profiling entirely, set MemProfileRate to 0.
//
// The tools that process the memory profiles assume that the
// profile rate is constant across the lifetime of the program
// and equal to the current value. Programs that change the
// memory profiling rate should do so just once, as early as
// possible in the execution of the program (for example,
// at the beginning of main).
var MemProfileRate int = defaultMemProfileRate(512 * 1024)
```

#### invalidptr

设置 `invalidptr=1`（默认）会使垃圾回收和栈赋值在遇到无效指针是，让程序奔溃。`nvalidptr=0` 会禁用该检查，这应该仅仅用于临时的代码debug。

#### sbrk

设置 `sbrk=1` 会使用普通的内存申请器，这会直接从操作系统申请内存并且永不释放。

#### scavtrace

设置 `scavtrace=1` 会让运行时系统在每次 `gc` 周期打印还给操作系统的内存总量和预估物理内存利用量。目前的格式如下：

> scav # # KiB work, # KiB total, #% util

- `scav #`：清扫周期；
- `KiB work`：从上次到当前，归还给操作的内存总量；
- `KiB total`：归还给操作系统的内存总量；
- `#% util`：正在使用的所有未清理内存的比例；

如果该行信息以 `(forced)` 结束，那说明调用了 [`debug.FreeOSMemory()`](https://pkg.go.dev/runtime/debug#FreeOSMemory)。

#### scheddetail

设置 `schedtrace=X` 和 `scheddetail=1` 会让调度器每隔 `X ms` 打印调度器，处理器，线程和goroutine的状态。

#### tracebackancestors

setting tracebackancestors=N extends tracebacks with the stacks at which goroutines were created, where N limits the number of ancestor goroutines to report. This also extends the information returned by runtime.Stack. Ancestor's goroutine IDs will refer to the ID of the goroutine at the time of creation; it's possible for this ID to be reused for another goroutine. Setting N to 0 will report no ancestry information.

#### asyncpreemptoff

设置 `asyncpreemptoff=1` 会禁用基于信号的异步goroutine抢占。这会使一些循环不可抢占，这可能会延迟 `gc` 以及 `goroutine` 调度。这对于调试 `gc` 问题很有用，因为他禁用了用于异步 `goroutine` 抢占的保守栈扫描。


### GOMAXPROCS

`GOMAXPROCS` 限制用于同时执行用户代码的线程数量，Go语言中没有限制阻塞在系统调用的线程的数量，这些线程不计入 `GOMAXPROCS` 的限制。[runtime.GOMAXPROCS](https://pkg.go.dev/runtime#GOMAXPROCS) 可以在运行时对此进行修改，一般情况下和系统的逻辑CPU数量相同。

### GORACE

该环境变量用于配置数据竞争检测器，在程序构建时可以使用 `-race` 标记，[https://go.dev/doc/articles/race_detector](https://go.dev/doc/articles/race_detector) 这里有详细描述。

### GOTRACEBACK

`GOTRACEBACK` 变量控制当 `Go` 程序由于未恢复的恐慌或意外的运行时条件而失败时生成的信息。默认情况下，失败打印当前 `goroutine` 的堆栈跟踪，省略运行时系统内部的函数，然后以退出代码 `2` 退出。如果没有当前 goroutine 或者是运行时内部失败，会打印所有 `goroutine` 信息。

- `GOTRACEBACK=none` 省略整个 `goroutine` 栈；
- `GOTRACEBACK=single (默认)` 和上面描述的一样；
- `GOTRACEBACK=all` 相比之前的会增加所有用户创建的 `goroutine` 栈；
- `GOTRACEBACK=system` 在 `all` 的基础之上，会增加运行时函数的栈帧，并且显示内部创建的 `gorotuine`；
- `GOTRACEBACK=crash` 和 `system` 类似， 但以特定于操作系统的方式崩溃而不是退出。例如，在 `Unix` 系统上，崩溃会引发 `SIGABRT` 以触发核心转储；


### 参考内容

1. [wall-clock time and cpu time](https://blog.csdn.net/xingchenxuanfeng/article/details/73549506)
