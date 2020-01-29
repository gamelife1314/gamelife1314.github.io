---
title: Go 扩展包：context
date: 2018-11-12 20:51:53
categories:
- Go 扩展包
tags:
- Go
---

之前使用过 `sync.WaitGroup` 来实现一对多的 goroutine 协作流程同步，`sync.WaitGroup` 只要保证计数周期的完整性就是可以复用的，`sync.WaitGroup` 使用的黄金规则可以总计为：**统一 `Add`，并发 `Done`，然后 `Wait`**。但是今天我们使用另一个工具来实现同步：`context.Context`。

{% asset_img cover.jpeg cover %}

<!--more-->

我们先看一个使用 `sync.WaitGroup` 实现的例子：

```go
package main

import (
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

func addNum(nump *int32, id int, deferFunc func()) {
	defer deferFunc()
	for i := 0; ; i++ {
		currentNum := atomic.LoadInt32(nump)
		newNum := currentNum + 1
		time.Sleep(time.Nanosecond * 200)
		if atomic.CompareAndSwapInt32(nump, currentNum, newNum) {
			fmt.Printf("%d The number: %d [%d-%d]\n", currentNum, newNum, id, i)
			break
		}
	}
}

func coordinateWithSyncGroup() {
	var (
		total  = 12
		num    int32
		stride = 3
	)
	fmt.Printf("The number: %d [with sync.WaitGroup]\n", num)
	var wg sync.WaitGroup
	for i := 1; i <= total; i += stride {
		wg.Add(stride)
		for j := 0; j < stride; j++ {
			go addNum(&num, i+j, wg.Done)
		}
		wg.Wait()
	}
	fmt.Printf("End.\n")
}

func main() {
	coordinateWithSyncGroup()
}
```

函数输出如下：

    0 The number: 1 [3-0]
    1 The number: 2 [1-0]
    2 The number: 3 [2-1]
    3 The number: 4 [6-0]
    4 The number: 5 [5-0]
    5 The number: 6 [4-0]
    6 The number: 7 [9-0]
    7 The number: 8 [7-0]
    8 The number: 9 [8-0]
    9 The number: 10 [12-0]
    10 The number: 11 [11-0]
    11 The number: 12 [10-2]
    End.


接下来我们换用 `context.Context` 来实现：

```go
package main

import (
	"context"
	"fmt"
	"sync/atomic"
	"time"
)

func addNum(nump *int32, id int, deferFunc func()) {
	defer func() {
		deferFunc()
	}()
	for i := 0; ; i++ {
		currentNum := atomic.LoadInt32(nump)
		newNum := currentNum + 1
		time.Sleep(time.Nanosecond * 200)
		if atomic.CompareAndSwapInt32(nump, currentNum, newNum) {
			fmt.Printf("%d The number: %d [%d-%d]\n", currentNum, newNum, id, i)
			break
		}
	}
}

func coordinateWithContext() {
	var (
		total = 12
		num   int32
	)
	fmt.Printf("The number: %d [with context.Context]\n", num)
	cxt, cancelFunc := context.WithCancel(context.Background())
	for i := 1; i <= total; i++ {
		go addNum(&num, i, func() {
			if atomic.LoadInt32(&num) == int32(total) {
				cancelFunc()
			}
		})
	}
	<-cxt.Done()
	fmt.Printf("End.\n")
}

func main() {
	coordinateWithContext()
}

```

在这个函数体中，我先后调用了 `context.Background` 函数和 `context.WithCancel` 函数，并得到了一个可撤销的 `context.Context` 类型的值（由变量 `cxt` 代表），以及一个 `context.CancelFunc` 类型的撤销函数（由变量 `cancelFunc` 代表）。在后面那条唯一的 `for` 语句中，我在每次迭代中都通过一条 `go` 语句，异步地调用 `addNum`  函数，调用的总次数只依据了 `total` 变量的值。请注意给予 `addNum` 函数的最后一个参数值。它是一个匿名函数，其中只包含了一条 `if` 语句。这条 `if` 语句会“原子地”加载 `num` 变量的值，并判断它是否等于 `total` 变量的值。如果两个值相等，那么就调用 `cancelFunc` 函数。其含义是，如果所有的 `addNum` 函数都执行完毕，那么就立即通知分发子任务的 `goroutine`。这里分发子任务的 `goroutine`，即为执行 `coordinateWithContext` 函数的 `goroutine`。它在执行完 `for` 语句后，会立即调用 `ctx` 变量的 `Done` 函数，并试图针对该函数返回的通道，进行接收操作。由于一旦 `cancelFunc· 函数被调用，针对该通道的接收操作就会马上结束，所以，这样做就可以实现“等待所有的 `addNum` 函数都执行完毕”的功能。

`Context` 类型可以提供一类代表上下文的值，此类值是并发安全的，也就是说它可以被传播个多个 `goroutine`。由于 `Context` 类型实际上是一个接口类型，而 `context` 包中实现该接口的所有私有类型，都是基于某个类型的指针，所以如此传播并不会影响此类值的功能和安全。`Context` 的值是可以繁衍的，这意味着我们可以通过一个 `Context` 值产生出任意个子值。这些子值可以携带其父值的属性和数据，也可以响应我们通过其父值传达的信号。正因为如此，所有的 `Context` 值共同构成了一颗代表了上下文全貌的树形结构。这棵树的树根（或者称上下文根节点）是一个已经在 `context` 包中预定义好的值，它是全局唯一的。通过调用 `context.Background` 函数，我们就可以获取到它。

除此之外，`context` 包中还包含了四个用于繁衍 `Context` 值的函数，即：`WithCancel`，`WithDeadline`， `WithTimeout` 和 `WithValue`。这些函数的第一个参数的类型都是 `context.Context`，而名称都为 `parent`。顾名思义，这个位置上的参数对应的都是它们将会产生的 `Context` 值的父值。`WithCancel` 函数用于产生一个可撤销的 `parent` 的子值。`WithDeadline` 和 `WithTimeout` 函数则都可以被用来产生一个会定时撤销的 `parent` 的子值。至于 `WithValue` 函数，我们可以通过调用它，产生一个会携带额外数据的 `parent` 的子值。

1. “可撤销的” 在 context 包中代表着什么？“撤销” 一个 Context 值有代表什么？

这需要从 `Context` 类型的声明说起，这个接口中有两个方法与 “撤销” 息息相关。`Done` 方法会返回一个元素类型为 `struct{}` 的接受通道。不过，这个接收通道的用途并不是传递元素值，而是让调用方去“感知”当前 Context 的撤销信号。一旦当前的 Context 被撤销，这里的接收操作会立即关闭。我们都知道，对于一个未包含任何元素的通道来说，它的关闭会使针对它的接收操作立即结束。

我们通过调用 `context.WithCancel` 产生一个可撤销的 `Context` 值的同时，还会获得一个用于出发撤销信号的函数。通过调用这个撤销函数，我们可以出发针对针对这个 `Context` 值的撤销信号。一旦触发。撤销信号就会立即传达给这个 `Context` 值，并且由它的 `Done` 方法的结果值（一个通道）表达出来。撤销函数只负责出发撤销信号，而对应的可撤销的Context值也只负责传达信号，它们不会管后边具体的“撤销”操作。我们的代码在接收到撤销信号之后，可以进行任意的操作。

2. 撤销信号是如何在上下文树中传播的？

`context` 包中的 `WithCancel`，`WithDeadline`，`WithTimeout` 都是用来基于给定的 `Context` 值产生可撤销的子值的。

`WithCancel` 函数在被调用后会产生两个结果值。第一个结果值就是那个可撤销的 `Context` 值，而第二个结果值则是用于触发撤销信号的函数。在撤销函数被调用之后，对应的 `Context` 值会先关闭它内部的接收通道，也就是它的 `Done` 方法会返回的那个通道。**然后，它会向它的所有子值（或者说子节点）传达撤销信号。这些子值会如法炮制，把撤销信号继续传播下去。最后，这个 `Contxt` 值会断开它与其父值之间的关联**。

我们通过调用 `context` 包的 `WithDeadline` 函数或者 `WithTimeout` 函数生成的 `Context` 值也是可撤销的。它们不但可以被手动撤销，还会依据在生成时被给定的过期时间，自动地进行定时撤销。这里定时撤销的功能是借助它们内部的计时器来实现的。当过期时间到达时，这两种 `Context` 值的行为与 `Context` 值被手动撤销时的行为是几乎一致的，只不过前者会在最后停止并释放掉其内部的计时器。

3. 怎样通过 `Context` 值携带数据？怎么样从中获取数据？

`WithValue` 函数在产生新的 `Context` 值）的时候需要三个参数，即：父值、键和值。与“字典对于键的约束”类似，这里**键的类型必须是可判等的**。原因很简单，当我们从中获取数据的时候，它需要根据给定的键来查找对应的值。不过，这种 `Context` 值并不是用字典来存储键和值的，后两者只是被简单地存储在前者的相应字段中而已。`Context` 类型的 `Value` 方法就是被用来获取数据的。在我们调用含数据的 `Context` 值的 `Value`方法时，它会先判断给定的键，是否与当前值中存储的键相等，如果相等就把该值中存储的值直接返回，否则就到其父值中继续查找。如果其父值中仍然未存储相等的键，那么该方法就会沿着上下文根节点的方向一路查找下去。注意，除了含数据的 `Context` 值以外，其他几种 `Context` 值都是无法携带数据的。因此，`Context` 值的 `Value` 方法在沿路查找的时候，会直接跨过那几种值。如果我们调用的 `Value` 方法的所属值本身就是不含数据的，那么实际调用的就将会是其父辈或祖辈的 `Value` 方法。这是由于这几种 `Context` 值的实际类型，都属于结构体类型，并且它们都是通过“将其父值嵌入到自身”，来表达父子关系的。