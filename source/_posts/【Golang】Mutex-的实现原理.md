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

### 加锁

正如上面所显示的源码，`Mutex` 的结构体足够简单，只有两个成员无需额外的初始化，其中 `state` 表示当前锁的状态，而 `sema` 是用于控制锁状态的信号量。state 的各个位的用途表示如下：

![](mutex-state.png)

### 解锁

<!-- more -->

### 参考文章

1. [Go语言之sync.Mutex 源码分析](https://www.lixueduan.com/post/go/sync-mutex/)
2. [【golang】sync.Mutex互斥锁的实现原理](https://segmentfault.com/a/1190000023874384)
3. [【Golang】Mutex秘籍](https://www.bilibili.com/video/BV15V411n7fM?p=1)
