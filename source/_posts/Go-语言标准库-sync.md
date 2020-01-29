---
title: Go 扩展包：sync
date: 2018-11-11 15:24:04
categories:
  - Go 标准库
tags:
  - Go
---

相比于Go宣扬的以独特的 “用通讯的方式共享数据”，通过共享数据的方式来传递信息和协调线程运行的做法其实更加主流，毕竟现代的大多数现代编程语言，都是用后一种并发编程的解决方案。一旦数据被多个线程共享，那么就很可能会产生争用和冲突的情况了，这种情况也被成为竟态条件，这往往会破坏数据的一致性。共享数据的一致性代表着：**多个线程对共享数据的操作总能达到他们各自预期的效果**。

{% asset_img cover.png cover %}

<!-- more -->

### 竞态

在串行程序中，即一个程序传只有一个goroutine，程序中各个步骤的执行顺序有程序逻辑来决定。比如，在一系列语句中，第一个语句在第二个语句之前执行，以此类推。当一个程序有两个或者多个goroutine 时，每个 goroutine 内部的各个步骤也是顺序执行的，但我们无法知道一个 goroutine 中的事件 x 和另一个 goroutine 中的事件 y 的先后顺序。如果我们无法自信地说一个事件肯定先于另一个事件，那么这两个事件就是并发的。

如果一个在串行程序中正确工作的函数，也能在并发时仍然正确地工作，那我们就说这个函数是 **并发安全**的，这里的并发是值，再没有额外同步机制的情况下，多个 goroutine 同时调用这个函数。

让一个程序并发安全并不需要每一个具体类型都是并发安全的，实际上，并发安全的类型是特例而不是普遍存在的，所以仅在文档指出类型是并发安全的情况下，才课题并发地访问一个变量。对于绝大多数变量，要么回避并发访问，要么限制变量只在一个 goroutine 之内，要么维护一个更高层的互斥不变量。但是，导出的包级别的函数通常可以认为是并发安全的，因为包级别的变量无法限制在一个goroutine之内，所以那些修改这些变量的函数就必须采用互斥机制。

函数并发调用时不工作的原因有很多，包括死锁，活锁以及资源耗尽等诸多情形，我们接下来讨论一种非常重要的情形，即 **竞态**。竞态指在多个 goroutine 按某些交错顺序执行时程序无法给出正确的结果。竞态对于程序是致命的，因为他们可能会潜伏在程序中，出现频率也很低，也有可能仅在高负载环境或者使用特定的编译器、平台和架构是才出现。

数据竞态发生于连个goroutine并发读写同一个变量并且其中一个是写入时，有以下三种方式来避免数据竞态：

1. 不要修改变量；
2. 避免从多个goroutine访问同一个变量，通过通信的方式来共享来村；
3. 通过互斥机制，允许多个goroutine访问同一个变量，但同一时间只有一个 goroutine 可以访问。


### 互斥锁：`sync.Mutex`

互斥锁的应用非常广泛，所以 `sync` 包单独有个 `Mutex` 类型支持这种模式，`Lock` 方法用于获取令牌，`Unlock` 范方法用于释放令牌。

```go
import "sync"

var (
	mu      sync.Mutex
	balance int
)

func Deposit(amount int) {
	mu.Lock()
	defer mu.Unlock()
	balance += amount
}

func Balance() int {
	mu.Lock()
	defer mu.Unlock()
	return balance
}
```

如上面的操作中，一个 goroutine 在每次访问银行的变量之前，它都必须先调用互斥量的 `Lock` 的方法来获取一个互斥锁。如果其他互斥锁已经取走了互斥锁，那么操作会一直阻塞到其他 goroutine 调用 `Unlock` 之后（此时互斥锁可以再用）。互斥量保护共享变量，按照惯例，被保护的互斥量声明应该紧接在互斥量的声明之后。

在 `Lock` 和 `Unlock` 之间代码，可以自由地读取和修改共享变量，这一部分成为临街区域。由于，在锁的持有人调用 `Unlock` 之前，其他 goroutine 不能获取锁，所以很重要的一点，在 goroutine 使用完成之后，应当立即释放锁，包括函数的所有分支，特别是错误分支中。所以，我们最好使用 `defer` 语句保证锁能被最终释放。

还有一点，Go 语言的互斥量是不可重入的，也就是说，无法对一个已经上锁的互斥量再上锁，这样会导致死锁：

```go
func Withdraw(amount int) bool {
	mu.Lock()
	defer mu.Unlock()
	Deposit(-amount)
	if Balance() < 0 {
		Deposit(amount)
		return false
	}
	return true
}
```

这个函数会一直卡主，是因为在 Withdraw 中对 mu 上锁之后，Deposit 有去获取锁导致，一般来书偶可以这样更改，将 Deposit 拆分成两部分：一个不可导出的函数 deposit，它假定已经获取锁，并完成实际的业务逻辑；以及一个导出的函数 Deposit，它用来获取并调用 deposit：

```go
import "sync"

var (
	mu      sync.Mutex
	balance int
)

func Deposit(amount int) {
	mu.Lock()
	defer mu.Unlock()
	deposit(amount)
}

func Balance() int {
	mu.Lock()
	defer mu.Unlock()
	return balance
}

func deposit(amount int) {
	balance += amount
}

func Withdraw(amount int) bool {
	mu.Lock()
	defer mu.Unlock()
	deposit(amount)
	if balance < 0 {
		deposit(amount)
		return false
	}
	return true
}
```

总结下来，使用互斥锁需要注意以下几点：

1. 不要重复锁定互斥锁；
2. 不要忘记解锁互斥锁，必要时使用 defer 语句；
3. 不要对尚未锁定或者已解锁的互斥锁解锁；
4. 不要在多个函数之间传递互斥锁；


### 读写互斥锁：`sync.RWMutex`

在某些情况下，我们需要获取这样一种锁，它允许只读操作可以并发地执行，但写操作需要获得完全独享的访问权限，这种锁称为**多读单写锁**，Go语言中的 sync.Mutex 可以提供这种功能：

```go
var mu sync.RWMutex
var balance int

func Balance() int {
    mu.RLock()
    defer mu.RUnlock()
    return balance
}
```

`Rlock` 仅仅可以用在临界区域对共享变量无写操作的情形。仅在绝大多数 goroutine 都在获取读锁并且竞争比较激烈是，RWMutex 才有优势。使用 `RWMutex` 需要注意以下几点：

1. 在写锁已经锁定的情况下，再去试图锁定写锁，会阻塞当前的 goroutine；
2. 在写锁已经被锁定的情况下，在去试图锁定读锁，会阻塞当前的 goroutine；
3. 在读锁已被锁定的情况下试图锁定写锁，同样会阻塞当前的 goroutine。
4. 在读锁已被锁定的情况下再试图锁定读锁，并不会阻塞当前的 goroutine。

一句话来书就是：多个写操作不能同时进行，读操作和写操作也不能同时记性，但是多个读操作能同时进行。

### 条件变量：`sync.Cond`

我们常常会把条件变量这个同步工具拿来与互斥锁一起讨论，实际上，条件变量是基于互斥锁的，它必须有互斥锁的支撑才能发挥作用。条件变量并不是被用来保护临界区和共享资源的，它是用于协调想要访问共享资源的那些线程的。当共享资源的状态发生变化时，它可以被用来通知被互斥锁阻塞的线程，条件变量和互斥锁需要配合使用，条件变量的初始化离不开互斥锁，并且它的方法有的也是基于互斥锁的。

接下来我们来实现一个程序，做这样的事情，有个信箱，一个送信人，一个收信人，当信箱中没有信时，可以将信送入信箱，当信箱中有信时，可以从其中拿出信，否则就等着。

```go
package main

import (
	"fmt"
	"sync"
	"time"
)

var (
	mailbox     uint8
	lock        sync.RWMutex
	sendMail    = sync.NewCond(&lock)
	receiveMail = sync.NewCond(lock.RLocker())
)

func Send() {
	lock.Lock()
	for mailbox == 1 {
		sendMail.Wait()
	}
	mailbox = 1
	fmt.Println("send")
	lock.Unlock()
	receiveMail.Signal()
}

func Receive() {
	lock.RLock()
	for mailbox == 0 {
		receiveMail.Wait()
	}
	mailbox = 0
	fmt.Println("receive")
	lock.RUnlock()
	sendMail.Signal()
}

func main() {
	go Send()
	go Receive()
	time.Sleep(1 * time.Second)
}
```

上述中的 `Wait` 方法做了以下四件事情：

1. 把调用它的 goroutine（也就是当前的 goroutine）加入到当前条件变量的通知队列中。
2. 解锁当前的条件变量基于的那个互斥锁。
3. 让当前的 goroutine 处于等待状态，等到通知到来时再决定是否唤醒它。此时，这个 goroutine 就会阻塞在调用这个 Wait 方法的那行代码上。
4. 如果通知到来并且决定唤醒这个 goroutine，那么就在唤醒它之后重新锁定当前条件变量基于的互斥锁。自此之后，当前的 goroutine 就会继续执行后面的代码了。

源码中是这样写的：

```go
func (c *Cond) Wait() {
	c.checker.check()
	t := runtime_notifyListAdd(&c.notify)
	c.L.Unlock()
	runtime_notifyListWait(&c.notify, t)
	c.L.Lock()
}
```

至于为什么要在 `for` 语句中多次检测，而不是使用 `if` 语句。这主要是为了保险起见。如果一个 goroutine 因收到通知而被唤醒，但却发现共享资源的状态，依然不符合它的要求，那么就应该再次调用条件变量的 `Wait` 方法，并继续等待下次通知的到来。这种情况是很有可能发生的，具体如下面所示。

1. 有多个 goroutine 在等待共享资源的同一种状态。比如，它们都在等 mailbox 变量的值不为 0 的时候再把它的值变为 0，这就相当于有多个人在等着我向信箱里放置情报。虽然等待的 goroutine 有多个，但每次成功的 goroutine 却只可能有一个。别忘了，条件变量的 Wait 方法会在当前的 goroutine 醒来后先重新锁定那个互斥锁。在成功的 goroutine 最终解锁互斥锁之后，其他的 goroutine 会先后进入临界区，但它们会发现共享资源的状态依然不是它们想要的。这个时候，for 循环就很有必要了。

2. 共享资源可能有的状态不是两个，而是更多。比如，mailbox 变量的可能值不只有 0, 1，还有 2, 3, 4。这种情况下，由于状态在每次改变后的结果只可能有一个，所以，在设计合理的前提下，单一的结果一定不可能满足所有 goroutine 的条件。那些未被满足的 goroutine 显然还需要继续等待和检查。

3. 有一种可能，共享资源的状态只有两个，并且每种状态都只有一个 goroutine 在关注，就像我们在主问题当中实现的那个例子那样。不过，即使是这样，使用 for 语句仍然是有必要的。原因是，在一些多 CPU 核心的计算机系统中，即使没有收到条件变量的通知，调用其 Wait 方法的 goroutine 也是有可能被唤醒的。这是由计算机硬件层面决定的，即使是操作系统（比如 Linux）本身提供的条件变量也会如此。

### 原子操作：`sync.atomic`

互斥锁虽然可以保证临界区中代码的串行执行，但却不能保证这些代码执行的原子性。因为，对于一个 Go 程序来说，Go 语言运行时系统中的调度器，会恰当地安排其中所有的 goroutine 的运行。不过，在同一时刻，只可能有少数的 goroutine 真正地处于运行状态，并且这个数量是固定的。所以，为了公平起见，调度器总是会频繁地换上或换下这些 goroutine。换上的意思是，让一个 goroutine 由非运行状态转为运行状态，并促使其中的代码在某个 CPU 核心上执行。换下的意思正好相反，即：使一个 goroutine 中的代码中断执行，并让它由运行状态转为非运行状态。这个中断的时机有很多，任何两条语句执行的间隙，甚至在某条语句执行的过程中都是可以的，即使这些语句在临界区之内也是如此。

在众多的同步工具中，真正能够保证原子性执行的只有[原子操作](https://baike.baidu.com/item/%E5%8E%9F%E5%AD%90%E6%93%8D%E4%BD%9C/1880992?fr=aladdin)，（atomic operation）。原子操作在进行的过程中是不允许中断的。在底层，这会由 CPU 提供芯片级别的支持，所以绝对有效。即使在拥有多 CPU 核心，或者多 CPU 的计算机系统中，原子操作的保证也是不可撼动的。这使得原子操作可以完全地消除竞态条件，并能够绝对地保证并发安全性。并且，它的执行速度要比其他的同步工具快得多，通常会高出好几个数量级。不过，它的缺点也很明显，更具体地说，正是因为原子操作不能被中断，所以它需要足够简单，并且要求快速。如果原子操作迟迟不能完成，而它又不会被中断，那么将会给计算机执行指令的效率带来多么大的影响。因此，操作系统层面只对针对二进制位或整数的原子操作提供了支持。

`sync.atomic` 包中提供了几种原子操作，具体有：加法（add）、比较并交换（compare and swap，简称 CAS）、加载（load）、存储（store）和交换（swap）。这些函数针对的数据类型并不多。但是，对这些类型中的每一个，`sync/atomic` 都会有一套函数予以支持，这些数据类型由：int32、int64、uint32、uint64、uintptr，以及unsafe包中的Pointer。

看一段在goroutine那节我们用来让那个goroutine顺序执行的例子：

```go
package main

import (
	"fmt"
	"sync/atomic"
	"time"
)

func main() {
	var count uint32
	trigger := func(i uint32, fn func()) {
		for {
			if n := atomic.LoadUint32(&count); n == i {
				fn()
				atomic.AddUint32(&count, 1)
				break
			}
			time.Sleep(time.Nanosecond)
		}
	}

	for i := uint32(0); i < 10; i++ {
		go func(i uint32) {
			trigger(i, func() {
				fmt.Println(i)
			})
		}(i)
	}
	trigger(10, func() {})
}
```

比较即交换即 CAS 操作，是有条件的交换，只有在条件满足的情况下才会交换，这里的交换指的是把新值赋给变量，返回旧值。再进行 CAS 操作的时候，函数会先判断被操作变量的当前值，是否与我们与其的旧值相等，如果相等，就把新值赋给变量，并返回 true 表明交换操作顺利进行，否则返回操作，表示忽略交换操作。

```go
package main

import (
	"fmt"
	"sync/atomic"
)

func main() {
	var num int32

	if atomic.CompareAndSwapInt32(&num, 0, 1) {
		fmt.Printf("hello")
	}

	if atomic.CompareAndSwapInt32(&num, 0, 1) {
		fmt.Printf("world")
	}
}

```

这个例子在执行的时候仅仅会打印出 hello，而不会打印 world。

### `sync.WaitGroup`

之前我们用通道的方式同步 goroutine ，让主 goroutine 等待其他 goroutine 执行结束后再退出程序，但是，我们用另外一个同步工具：`sync.WaitGroup`，它比通多更加适合实现这种一对多的 goroutine 协作流程。`sync.WaitGroup` 声明后即可使用，也是并发安全的，同时与前面几个并发工具一样，一旦被真正使用不能被复制了。

`sync.WaitGroup` 类型有三个方法：`Add`，`Done` 和 `Wait`。你可以想象成这个类型中有一个计数器，它的默认值是0，我们可以通过 `Add` 方法来增加或者减少这个计数器的值。一般情况下，我们用 `Add` 方法来记录需要等待的 goroutine 的数量。相对应的，这个类型的 Done 方法。用于对其所属计数器中的值进行减1操作，我们可以在需要等待的 goroutine 中通过 `defer` 语句调用它。而此类型的 `Wait` 方法功能是阻塞当前的 goroutine，直到其所属的计数器归零。如果在调用这个方法的时候，它的计数器就是0，那么它，就不会做任何事情。

```go
package main

import (
	"fmt"
	"sync"
)

func main() {
	var (
		wg sync.WaitGroup
	)

	wg.Add(2)

	go func() {
		defer wg.Done()
		fmt.Println("hello")
	}()

	go func() {
		defer wg.Done()
		fmt.Println("world")
	}()

	wg.Wait()
}
```

`sync.WaitGroup` 中计数器的值不可以小于0，之所以说它的计数器的值不能小于0，是因为这样会引发一个 panic。`sync.WaitGroup` 的值是可以被复用的，但需要保证其计数周期的完整性，这里的计数周期值得是这样一个过程：该计数器的值由0变味了某个正整数，然后由经过一系列变化，由这个正整数又变回了0。

### `sync.Once`

同 `sync.WaitGroup` 一样，`sync.Once` 也属于结构体类型，同样也是声明即可使用的，并且并发安全，由于这个类型中包含了一个 `sync.Mutex` 类型的字段，复制该类型的值也会失效，也就是不能作为函数的参数传入。`sync.Once` 类型的 `Do` 方法只接受一个参数，这个参数的类型必须是：`func()`：即无参数声明无结果声明的函数，这个方法不是对每一个传入的参数函数都执行一次，而是只执行首次被调用时传入的那个函数，并且之后不会再执行任何函数。因此，如果你有多个需要执行一次的函数，那么就应该为他们中的每一个都分配一个 `sync.Once` 类型的值。

`sync.Once` 类型中还有一个名叫 `done` 的 `uint32` 类型字段，它的作用是记录其所属值的Do方法被调用的次数，不过这个字段的值只可能是0或者1，一旦 `Do` 方法的首次调用完成，它的值就会从0变成1。`sync.Do` 方法在功能方面具有两个特点：

1. 第一个特点，由于 `Do` 方法只会在参数函数执行结束之后把 done 字段的值变为 1, ，因此，如果参数函数的执行需要很长时间或者根本就不会结束（比如执行一些守护任务），那么就有可能会导致相关 goroutine 的同时阻塞。

2. 第二个特点，`Do` 方法在参数函数执行结束后，对 done 字段的赋值用的是原子操作，并且，这一操作是被挂在 defer 语句中的。因此，不论参数函数的执行会以怎样的方式结束，done 字段的值都会变为 1。

```go
package main

import (
	"fmt"
	"sync"
)

func main() {
	var (
		once sync.Once
	)

	once.Do(func() {
		fmt.Println("hello")
	})

	once.Do(func() {
		fmt.Println("world")
	})
}

```

这里只会打印出 `hello`，不信你试试。


### `sync.Pool`

`sync.Pool` 类型可以被称为临时对象池，它的值可以被用来存储临时的对象。与 Go 语言的很多同步工具一样，`sync.Pool` 类型也属于结构体类型，它的值在被真正使用之后，就不应该再被复制了。这里的 “临时对象” 的意思是：不需要持久使用的某一类值。这类值对于程序来说可有可无，但如果有的话会明显更好。它们的创建和销毁可以在任何时候发生，并且完全不会影响到程序的功能。同时，它们也应该是无需被区分的，其中的任何一个值都可以代替另一个。如果你的某类值完全满足上述条件，那么你就可以把它们存储到临时对象池中。我们可以把临时对象池当作针对某种数据的缓存来用。

`sync.Pool` 类型只有两个方法：`Put` 和 `Get`，。前者用于在当前的池中存放临时对象，它接受一个 `interface{}` 类型的参数；而后者则被用于从当前的池中获取临时对象，它会返回一个 `interface{}` 类型的值。更具体地说，这个类型的 `Get` 方法可能会从当前的池中删除掉任何一个值，然后把这个值作为结果返回。如果此时当前的池中没有任何值，那么这个方法就会使用当前池的 `New` 字段创建一个新值，并直接将其返回。`sync.Pool` 类型的 `New` 字段代表着创建临时对象的函数。它的类型是没有参数但有唯一结果的函数类型，即：`func() interface{}`。这个函数是 `Get` 方法最后的临时对象获取手段，`Get` 方法如果到了最后，仍然无法获取到一个值，那么就会调用该函数。该函数的结果值并不会被存入当前的临时对象池中，而是直接返回给 `Get` 方法的调用方。这里的 `New` 字段的实际值需要我们在初始化临时对象池的时候就给定。否则，在我们调用它的 `Get` 方法的时候就有可能会得到 `nil`，所以，`sync.Pool` 类型并不是开箱即用的。不过，这个类型也就只有这么一个公开的字段，因此初始化起来也并不麻烦。

标准库代码包 `fmt` 就使用到了 `sync.Pool` 类型。这个包会创建一个用于缓存某类临时对象的 `sync.Pool`，类型值，并将这个值赋给一个名为 `ppFree`，的变量。这类临时对象可以识别、格式化和暂存需要打印的内容。

```go
var ppFree = sync.Pool{
 New: func() interface{} { return new(pp) },
}
```

临时对象池中的值会被及时地清理掉，因为，Go 语言运行时系统中的垃圾回收器，在每次开始执行之前，都会对所有已创建的临时对象池中的值进行全面地清除。

`sync` 包在被初始化的时候，会向 Go 语言运行时系统注册一个函数，这个函数的功能就是清除所有已创建的临时对象池中的值。我们可以把它称为池清理函数。一旦池清理函数被注册到了 Go 语言运行时系统，运行时在每次即将执行垃圾回收时就都会执行清理函数。另外，在 `sync` 包中还有一个包级私有的全局变量。这个变量代表了当前的程序中使用的所有临时对象池的汇总，它是元素类型为 `*sync.Pool` 的切片，我们可以称之为池汇总列表。通常，在一个临时对象池的 `Put` 方法或 `Get` 方法第一次被调用的时候，这个池就会被添加到池汇总列表中。正因为如此，池清理函数总是能访问到所有正在被真正使用的临时对象池。最后，池清理函数会把池汇总列表重置为空的切片。如此一来，这些池中存储的临时对象就全部被清除干净了。如果临时对象池以外的代码再无对它们的引用，那么在稍后的垃圾回收过程中，这些临时对象就会被当作垃圾销毁掉，它们占用的内存空间也会被回收以备他用。

### 并发安全字典：`sync.Map`


Go 语言自带的字典类型并不是并发安全的，在同一段时间内，让不同的 goroutine 中的代码，对同一个字典进行读写操作是不安全的。虽然 `sync.Map` 所有的方法涉及的键和值都是 `interface{}` 接口，但是它仍然同普通字典一样，键的实际类型不能是：函数类型，字典类型和切片类型。为了保证并发安全字典的键值类型的正确性，我们可以有以下几种方案：

**让并发安全字典只存储某个特定类型的键，可以把对这种键类型的操作都放在一个结构体中封装起来**，例如：

```go
type IntStrMap struct {
	m sync.Map
}

func (iMap *IntStrMap) Delete(key int) {
	iMap.m.Delete(key)
}

func (iMap *IntStrMap) Load(key int) (value string, ok bool) {
	v, ok := iMap.m.Load(key)
	if v != nil {
		value = v.(string)
	}
	return
}

func (iMap *IntStrMap) LoadOrStore(key int, value string) (actual string, loaded bool) {
	a, loaded := iMap.m.LoadOrStore(key, value)
	actual = a.(string)
	return
}

func (iMap *IntStrMap) Range(f func(key int, value string) bool) {
	f1 := func(key, value interface{}) bool {
		return f(key.(int), value.(string))
	}
	iMap.m.Range(f1)
}

func (iMap *IntStrMap) Store(key int, value string) {
	iMap.m.Store(key, value)
}
```

上面那种方案不太灵活，因为对于每种类型，我们都需要去实现一个相应的结构体，而且要复制一大堆代码，所以我们应该 **应该创建一个结构体，并且封装所有类型方法，并且与 sync.Map 类型的方法完全一致**。不过在这些方法中，需要做一些检查代码，另外，并发安全字典的键类型和值类型必须在初始化的时候就完全确定，并且这种情况下，必须保证键的类型是可比较的。所以，这个结构体应该这样设计：

```go
type ConcurrentMap struct {
 m         sync.Map
 keyType   reflect.Type
 valueType reflect.Type
}
```

我们来看一下这个类型的 `Load` 方法的实现：

```go
func (cMap *ConcurrentMap) Load(key interface{}) (value interface{}, ok bool) {
 if reflect.TypeOf(key) != cMap.keyType {
  return
 }
 return cMap.m.Load(key)
}
```

再来看下 `Store` 方法的实现：

```go
func (cMap *ConcurrentMap) Store(key, value interface{}) {
 if reflect.TypeOf(key) != cMap.keyType {
  panic(fmt.Errorf("wrong key type: %v", reflect.TypeOf(key)))
 }
 if reflect.TypeOf(value) != cMap.valueType {
  panic(fmt.Errorf("wrong value type: %v", reflect.TypeOf(value)))
 }
 cMap.m.Store(key, value)
}
```