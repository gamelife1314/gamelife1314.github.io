---
title: 【Golang】Mutex 的实现原理
date: 2021-12-15 23:22:12
tags:
    - sync.Mutex
categories:
    - golang
---

在Go语言中，实现并发编程相当简单，因此存在大量场景需要同步操作限制对临界区的修改，避免出现不可期望的情况。因此，Go 语言在 `sync` 中提供了大量的基本同步原语，例如，最常见的互斥锁 `sync.Mutex`，它的名字应该来源于：`Mutual Exclusion` 的前缀组合，它对外只暴露了两个方法：`Lock` 和 `Unlock`，本篇文章将详细了解加解锁背后的逻辑。

```go
// A Mutex is a mutual exclusion lock.
// The zero value for a Mutex is an unlocked mutex.
//
// A Mutex must not be copied after first use.
type Mutex struct {
	state int32
	sema  uint32
}

// A Locker represents an object that can be locked and unlocked.
type Locker interface {
	Lock()
	Unlock()
}

// 一些状态
const (
	mutexLocked = 1 << iota // 1：表示锁定状态
	mutexWoken              // 2: 表示当前锁被从正常模式唤醒
	mutexStarving           // 4: 表示当前锁进入互斥状态
	mutexWaiterShift = iota // 3：左移3位存储正在等待获取锁的goroutine的个数
    starvationThresholdNs = 1e6 // 正在获取锁的goroutine等待1ms之后，会让当前锁进入饥饿模式
)
```

<!-- more -->

### 加锁

正如上面所显示的源码，`Mutex` 的结构体足够简单，只有两个成员无需额外的初始化，其中 `state` 表示当前锁的状态，而 `sema` 是用于排队唤醒的信号量。state 的各个bit位的用途表示如下：

![](mutex-state.png)

- `mutexLocked` — 表示互斥锁的锁定状态；
- `mutexWoken` —  表示从正常模式被唤醒；
- `mutexStarving` — 当前的互斥锁进入饥饿状态；
- `waitersCount` —  当前互斥锁上等待的 Goroutine 个数

默认情况下呢，互斥锁的所有位都是0，表示未锁定状态，为了保证公平性，设计上锁是有两种状态的：正常状态和饥饿状态。

在`正常模式下`，所有等待锁的 goroutine 按照FIFO顺序等待。唤醒的goroutine不会直接拥有锁，而是会和新请求锁的goroutine竞争锁，因为新请求锁的goroutine 正在CPU上执行，把锁交给他可以最大化利用CPU的时间片，也因此刚刚唤醒的goroutine，也就是之前排队的goroutine有很大可能在锁竞争中失败。在这种情况下，这个被唤醒的goroutine会加入到等待队列的前面。 如果一个等待的goroutine超过1ms没有获取锁，那么它将会把锁转变为饥饿模式。

`饥饿模式`下，锁的所有权将从unlock的gorutine直接交给交给等待队列中的第一个。新来的goroutine将不会尝试去获得锁，即使锁看起来是unlock状态, 也不会去尝试自旋操作，而是放在等待队列的尾部。

如果一个等待的goroutine获取了锁，并且它是队列中的最后一个或者它的等待时间小于1ms，锁将由饥饿状态切换回正常状态。正常状态能最大化利用CPU，饥饿状态能有效防止尾部延迟，接下来我们分下代码的实现。


#### 快速路径

快速路径下，直接通过CAS获取锁，如果当前锁的状态位全是0，也就是刚初始化的状态，那么直接上锁。

```go
func (m *Mutex) Lock() {
	if atomic.CompareAndSwapInt32(&m.state, 0, mutexLocked) {
		return
	}
    ...
}
```

#### 慢速路径

如果没有通过快速路径直接获取到锁，那么就进入慢速路径，我们在理解这些代码的时候，要想象成很多goroutine都在执行这段代码，这样才能便于我们理解其中的意义所在。慢速路径中首先定义了一些状态：

```go
var waitStartTime int64   // 等待时间
starving := false         // 是否处于饥饿模式
awoke := false            // 是否被唤醒
iter := 0                 // 迭代次数
old := m.state
....
```

如果当一个goroutine尝试加锁时，其他goroutine已经加锁且没有释放，而且锁处在正常模式下，那么就检查是否达到自旋的条件，如果可以那么就尝试自旋。对于是否能够自旋，需要满足以下以下条件：

- 需要多核CPU。因为如果是单核场景，自旋的goroutine在等待持有锁的goroutine释放锁，持有锁的goroutine在等待自旋的goroutine让出CPU，这种情况下自旋没有意义。或者说 `GOMAXPROCS=1`，又或者说 `GOMAXPROCS>1`，但是当前只有1个P在运行，也和单核场景类似，意图就是除了当前的P之外还有人在干活，这种情况下自旋才有意义；

- 当前P的本地 runq 为空。因为如果当前的P的runq不为空，与其让当前CPU自旋浪费CPU时间，还不如让CPU去执行runq的goroutine；

- 自旋的次数小于 4次，不能一直自旋；

所以就有了 `runtime_canSpin` 这样的实现：

```go
// src/runtime/proc.go
// Active spinning for sync.Mutex.
//go:linkname sync_runtime_canSpin sync.runtime_canSpin
//go:nosplit
const active_spin = 4

func sync_runtime_canSpin(i int) bool {
	// sync.Mutex is cooperative, so we are conservative with spinning.
	// Spin only few times and only if running on a multicore machine and
	// GOMAXPROCS>1 and there is at least one other running P and local runq is empty.
	// As opposed to runtime mutex we don't do passive spinning here,
	// because there can be work on global runq or on other Ps.
	if i >= active_spin || ncpu <= 1 || gomaxprocs <= int32(sched.npidle+sched.nmspinning)+1 {
		return false
	}
	if p := getg().m.p.ptr(); !runqempty(p) {
		return false
	}
	return true
}
```

在满足自旋条件之后，goroutine 在自旋之前会先争抢 mutex 的唤醒标识位，设置 mutexWoken 标识位的目的是，在正常模式下，告知持有锁的goroutine在unlock 的时候就不要唤醒其他的goroutine了，已经有goroutine在这里等候了，以免唤醒太多等待协程。

```go
// Don't spin in starvation mode, ownership is handed off to waiters
// so we won't be able to acquire the mutex anyway.
if old&(mutexLocked|mutexStarving) == mutexLocked && runtime_canSpin(iter) {
    // Active spinning makes sense.
    // Try to set mutexWoken flag to inform Unlock
    // to not wake other blocked goroutines.
    if !awoke && old&mutexWoken == 0 && old>>mutexWaiterShift != 0 &&
        atomic.CompareAndSwapInt32(&m.state, old, old|mutexWoken) {
        awoke = true
    }
    runtime_doSpin()
    iter++
    old = m.state
    continue
}
```

这里的自旋是通过 `runtime_doSpin()` 来实现，底层是通过 `proc` 执行30次 `PAUSE` 指令来实现。在每次自旋结束之后都会重新检查自旋条件，如果已经自旋4次，或者锁被释放了，或者锁进入饥饿模式了，都会结束自旋。

```go
//go:linkname sync_runtime_doSpin sync.runtime_doSpin
//go:nosplit
const active_spin_cnt = 30
func sync_runtime_doSpin() {
	procyield(active_spin_cnt)
}
```

```asm
// src/runtime/asm_arm64.s

TEXT runtime·procyield(SB),NOSPLIT,$0-0
	MOVWU	cycles+0(FP), R0
again:
	YIELD
	SUBW	$1, R0
	CBNZ	R0, again
	RET
```

结束自旋或者根本没有自旋的goroutine就尝试通过原子操作修改mutex的状态，老的状态记为`old`，要修改的最终状态记为`new`，如果mutex没处于处于饥饿模式，就尝试设置lock位；如果处于饥饿状态或者加锁状态，那么他就得去排队，通过下面的代码实现：

```go
// Don't try to acquire starving mutex, new arriving goroutines must queue.
if old&mutexStarving == 0 {
    new |= mutexLocked
}
if old&(mutexLocked|mutexStarving) != 0 {
    new += 1 << mutexWaiterShift
}
```

如果当前goroutine等待的时间已经超过1ms，并且锁还没有被释放，那么就将锁切换成饥饿模式。这里要求进入饥饿模式必须是锁没有释放，是因为如果锁被释放了，那么怎么着也得先试试，否则进入饥饿模式就得直接排队：

```go
// The current goroutine switches mutex to starvation mode.
// But if the mutex is currently unlocked, don't do the switch.
// Unlock expects that starving mutex has waiters, which will not
// be true in this case.
if starving && old&mutexLocked != 0 {
    new |= mutexStarving
}
```

在设置好相应的状态为，最终执行原子操作之前，如果当前goroutine持有唤醒标识，还要将唤醒标识位重置，因为接下来：

- 如果原子操作失败，当前goroutine操作期间，有其他goroutine修改了state，当前goroutine就得从头来过；
- 如果原子操作成功，抢到锁或者去排队，当前goroutine都不需要再被唤醒了；

```go
if awoke {
    // The goroutine has been woken from sleep,
    // so we need to reset the flag in either case.
    if new&mutexWoken == 0 {
        throw("sync: inconsistent mutex state")
    }
    new &^= mutexWoken
}
```


完整计算 `new` 的代码如下：

```go
new := old
// Don't try to acquire starving mutex, new arriving goroutines must queue.
if old&mutexStarving == 0 {
    new |= mutexLocked
}
if old&(mutexLocked|mutexStarving) != 0 {
    new += 1 << mutexWaiterShift
}
// The current goroutine switches mutex to starvation mode.
// But if the mutex is currently unlocked, don't do the switch.
// Unlock expects that starving mutex has waiters, which will not
// be true in this case.
if starving && old&mutexLocked != 0 {
    new |= mutexStarving
}
if awoke {
    // The goroutine has been woken from sleep,
    // so we need to reset the flag in either case.
    if new&mutexWoken == 0 {
        throw("sync: inconsistent mutex state")
    }
    new &^= mutexWoken
}
``` 

接下来继续展开原子操作成功的分支，如果是抢到了锁，那么就直接退出了：

```go
if atomic.CompareAndSwapInt32(&m.state, old, new) {
    if old&(mutexLocked|mutexStarving) == 0 {
        break // locked the mutex with CAS
    }
...
```

如果是排队规模设置成功了，还要决定排在队头还是队尾，如果当前goroutine已经排过对了，是被unlock操作唤醒的，那么就要排在队列头部；如果是第一次排队，那么就得排在等待队列的尾部，并且从第一次排队开始，记录当前goroutine的等待时间，接下来就会将自己休眠，进入到等待队列中：

```go
// If we were already waiting before, queue at the front of the queue.
queueLifo := waitStartTime != 0
if waitStartTime == 0 {
    waitStartTime = runtime_nanotime()
}
runtime_SemacquireMutex(&m.sema, queueLifo, 1)
```

等到goroutine被唤醒时，会接着从上次休眠的位置继续执行。首先判断如果锁处于正常模式，会接着从自旋操作开始重新执行。如果唤醒之后发现锁处于饥饿模式，那就说明当前goroutine之前进入排队被放在了队首，此次自己被唤醒是因为要将锁给自己了，那么就只需要将mutex设置位加锁状态，并且将等待队列数目减1即可，再看看是不是切换回正常模式，更新好状态之后就可以退出了：

```go
starving = starving || runtime_nanotime()-waitStartTime > starvationThresholdNs
old = m.state
if old&mutexStarving != 0 {
    // If this goroutine was woken and mutex is in starvation mode,
    // ownership was handed off to us but mutex is in somewhat
    // inconsistent state: mutexLocked is not set and we are still
    // accounted as waiter. Fix that.
    if old&(mutexLocked|mutexWoken) != 0 || old>>mutexWaiterShift == 0 {
        throw("sync: inconsistent mutex state")
    }
    delta := int32(mutexLocked - 1<<mutexWaiterShift)
    if !starving || old>>mutexWaiterShift == 1 {
        // Exit starvation mode.
        // Critical to do it here and consider wait time.
        // Starvation mode is so inefficient, that two goroutines
        // can go lock-step infinitely once they switch mutex
        // to starvation mode.
        delta -= mutexStarving
    }
    atomic.AddInt32(&m.state, delta)
    break
}
awoke = true
iter = 0
```

### 解锁

解锁操作相对比较简单，首先将lock位减1，看最终得到状态是不是0，如果是就直接退出了：

```go
func (m *Mutex) Unlock() {
	// Fast path: drop lock bit.
	new := atomic.AddInt32(&m.state, -mutexLocked)
	if new != 0 {
		// Outlined slow path to allow inlining the fast path.
		// To hide unlockSlow during tracing we skip one extra frame when tracing GoUnblock.
		m.unlockSlow(new)
	}
}
```

如果进入到slowpath，说明除了lock位，还有其他位不为0。

- 如果一开始处在正常模式，并且等待队列不为空，或者已经有其他goroutine被换新获得了锁，或者锁进入了饥饿模式，那么不需要唤醒某个goroutine，直接返回即可；否则尝试设置mutex唤醒标志位，获取唤醒一个goroutine的权利，成功之后就会通过 `runtime_Semrelease` 唤醒一个goroutine，唤醒的goroutine又要开始竞争了，如果不成功就循环尝试。

- 如果一开始就处于饥饿模式，那么就直接唤醒等待队列中的首个goroutine，将锁交给它，所以不用再设置唤醒标志位了。

```go
func (m *Mutex) unlockSlow(new int32) {
	if (new+mutexLocked)&mutexLocked == 0 {
		throw("sync: unlock of unlocked mutex")
	}
	if new&mutexStarving == 0 {
        old := new
        for {
            // If there are no waiters or a goroutine has already
            // been woken or grabbed the lock, no need to wake anyone.
            // In starvation mode ownership is directly handed off from unlocking
            // goroutine to the next waiter. We are not part of this chain,
            // since we did not observe mutexStarving when we unlocked the mutex above.
            // So get off the way.
            if old>>mutexWaiterShift == 0 || old&(mutexLocked|mutexWoken|mutexStarving) != 0 {
                return
            }
            // Grab the right to wake someone.
            new = (old - 1<<mutexWaiterShift) | mutexWoken
            if atomic.CompareAndSwapInt32(&m.state, old, new) {
                runtime_Semrelease(&m.sema, false, 1)
                return
            }
            old = m.state
        }
	} else {
		// Starving mode: handoff mutex ownership to the next waiter, and yield
		// our time slice so that the next waiter can start to run immediately.
		// Note: mutexLocked is not set, the waiter will set it after wakeup.
		// But mutex is still considered locked if mutexStarving is set,
		// so new coming goroutines won't acquire it.
		runtime_Semrelease(&m.sema, true, 1)
	}
}
```

### 参考文章

1. [Go语言之sync.Mutex 源码分析](https://www.lixueduan.com/post/go/sync-mutex/)
2. [【golang】sync.Mutex互斥锁的实现原理](https://segmentfault.com/a/1190000023874384)
3. [【Golang】Mutex秘籍](https://www.bilibili.com/video/BV15V411n7fM?p=1)
