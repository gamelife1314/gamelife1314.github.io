---
title: Go语言基础《六》：通道
date: 2018-10-31 23:01:59
categories:
  - Go语言基础
tags:
  - 通道
---

如果说 `goroutine` 是 `go` 程序的并发体，那么`通道` 就是他们之间的桥梁。通道是可以让一个 `goroutine` 发送特定值到另一个 `goroutine` 的通信机制。通道类型本身就是并发安全的，这也是Go语言自带的、唯一一个可以满足并发安全性的类型。一个通道相当于一个先进先出(FIFO)的队列，也就是说，通道中的各个元素是严格按照发送的顺序排列的，别被发送至通道的元素一定会先被接收。元素值得发送和接收都需要用到操作符：`<-`。

每一个通道是一个具体类型的导管，叫做通道的元素类型。一个有 `int` 类型元素的通道写为 `chan int`。使用内置的 `make` 函数来创建一个通道：

```go
ch := make(chan int)
```

像`map`一样，通道是一个使用 `make` 创建的数据结构的引用。当复制或者做为参数传递时，复制的是引用，这样调用者和被调用者都引用同一份数据结构。和其他引用类型一样，通道的零值是 `nil`。同种类型的通道可以使用 `==` 比较，当二者都是同一通道数据的引用时，比较值为 `true`，通道也可以和`nil` 进行比较。

通道有两个主要操作，`发送（send）`和 `接收（receive）`，两者统称为通信。`send` 语句从一个goroutine传输一个值到另一个在执行接收表达式的goroutine。两个操作都使用 `<-` 操作符书写。发送语句中，通道和值分别在 `<-` 的左右两边。在接收表达式中，`<-`放在通道操作数的前面。在接收表达式中，其结果未被使用也是合法的。  

```go
ch <- x   // 发送语句
x = <- ch // 赋值语句中的接收表达式
<- ch     // 接收语句，丢弃结果
```

<!--more-->

除以上两个操作之外，通道还支持第三个操作：`关闭(close)`。它设置一个标志位来指示当前值已经发送完毕，这个通道后面没有值了，关闭后的发送操作将导致宕机。 在一个已经关闭的通道上进行接收操作，将获取所有已经发送的值，直到通道为空；通道为空的时候再执行接收操作，操作将会立即完成，同时获取到一个通道元素类型对应的零值。  

调用内置的 `close` 方法关闭通道：`close(ch)`;

使用简单的 `make` 调用创建的通道叫做 `无缓冲(unbuffered)` 通道，但 `make` 还可以接收第二个可选参数，一个表示通道容量的整数。如果容量是0，make创建一个无缓冲通道。  

```go
ch = make(chan int)     // 无缓冲通道
ch = make(chan int, 0)  // 无缓冲通道
ch = make(chan int, 3)  // 容量为3的缓冲通道
```

### 无缓冲通道

无缓冲通道上的发送操作将会阻塞，直到另一个`goroutine`在对应的通道上执行接收操作，这是指传送完成，两个`goroutine`都可以继续执行。相反，如果接收操作先执行，接收方`goroutine`将会阻塞，直到另一个`goroutine`在相同的通道上发送一个值。使用无缓冲的通道进行的通信将会导致发送和接收同步化。因此无缓冲通道也称作是`同步通道`。当一个值在无缓冲通道上进行传递时，接收值后发送方`goroutine`才被再次唤醒。

在讨论并发的时候，当我们说x早于y发生时，不仅仅是说x发生的时间早于y，而是说保证它是这样，并且是可预期的，比如更新变量，我们可以依赖这个机制。

当x既不比y早也不比y晚的时候，我们x和y并发。这不意味着想和y一定同时发生，只说明我们不能假设他们的顺序。在两个`goroutine`并发地访问同一个变量的时候，有必要对这样的事件进行排序，避免程序的执行发生问题。

有时候为了让程序等待后台的goroutine在完成之后再退出，可以使用一个通道来同步两个goroutine：

```go
func main() {
    if conn, err := net.Dial("tcp", "localhost:8000"); err == nil {
        done = make(chan struct{})
        go func(){
            io.Copy(os.Stdout, conn)  // 忽略错误
            fmt.Println("done")
            done <- struct{}{}
        }()
        mustCopy(conn, os.Stdin)
        conn.close()
        <-done  // 等待后台goroutine完成
    }

}
```

这里当用户关闭标准输入流时，`mustCopy`返回，主goroutine调用`conn.Close()`关闭两端网络连接。关闭写半边的连接会导致服务器看到`EOF`。关闭读半边的连接会导致后台`goroutine`调用`io.Copy`返回"read from closed connection"错误，这也是忽略错误的原因；在它返回前，后台`goroutine`记录一条信息，然后发送一个值到`done`通道，主`goroutine`在退出前一直等待，直到它接收到这个值。最终效果是程序总是在退出前记录“done”消息。

通过通道发送消息有两个重要的方面要考虑，每一条消息有一个值，但有时候通信本身以及通信发生的时间也很重要。当我们强调这方面的时候，把消息叫做`事件(event)`。 当事件没有携带额外的信息时，它单纯的目的是进行同步。我们通过使用一个`struct{}`元素类型的通道来强调他，尽管通常使用`bool`或者`int`类型的通道来做相同的事情，因为 `done <- -1` 比 `done <- struct{}{}` 代码长度要短。

### 管道

通道可以用来连接 `goroutine`，这样一个的输出是另一个的输入，这个叫做 `管道(pipeline)`，下面的程序由三个`goroutine`组成，他们被两个通道连接起来：

```sequence
counter->squarer: 自然数（0,1,2,3...）
squarer->printer: 求平方（0,1,4,9...）
```

第一个 `goroutine` 是 `counter`，用于产生一个 `0,1,2,3,4...` 的序列，然后通过一个管道发送给第二个 `goroutine（squarer）`，计算数值的平方，然后将结果通过另一个通道发送给第三个`goroutine`，接收值并输出他们。

```go
func main() {

	naturals := make(chan int)
	squares := make(chan int)

	// counter
	go func(){
		for x := 0; ; x ++ {
			naturals <- x
		}
	}()

	// squarer 
	go func(){
		for {
			x := <- naturals
			squares <- x * x
		}
	}()

	// printer
	for {
		fmt.Println(<-squares)
	}
}
```

这个程序会一直输出无限的平方序列，如果发送方直到没有更多的数据要发送，告诉接收者所在`goroutine`可以停止等待是很有用的，可以通过调用内置的`close`函数关闭通道：`close(squares)`。

**在通道关闭后，任何后续的发送操作都会导致应用奔溃。当关闭的通道被读完，所有后续的接收操作顺畅进行，只是接收到的是零值。**

没有一个直接的方法判断一个通道是否已经关闭，但是这里有接收操作的一个变种，它产生两个结果：接收到的元素以及一个布尔值，它为`true` 的时候代表接收成功，`false` 的时候表示当前的接收操作在一个关闭的通道上，使用这个特性，可以修改`squarer`的循环，当`naturals`通道读完以后，关闭`squares`通道。

```go
// squarer
go func(){
	for {
		x, ok := <- naturals
		if !ok {
			break
		} 
		squares <- x * x
	}
	close(squares)
}()
```

虽然上面的语法比较笨拙，但是模式又比较通用，所以go语言提供了一个`range`在通道上进行迭代。

```go
go func(){
	for x := range naturals {
		squares <- x*x
	}
	close(squares)
}()
```

**结束时，关闭每一个通道是不必须的。 只有在通知接收方 `goroutine` 所有的数据都发送完毕的时候才需要关闭。通道也是可以通过垃圾回收器根据它是否可以访问来决定是否回收它，而不是根据它是否关闭。**


### 单向通道类型

当一个通道用作函数的形参时，他几乎总是被有意地限制不能发送或者接收；将这种意图文档化可以避免误用，Go语言类型系统也提供了单向通道类型，  
仅仅导出发送或者接收操作。**类型`chan<- int`表示一个只能发送的通道，允许发送但不允许接收，`<-chan int`表示一个只能接收的通道，允许接收但不允许发送**。例如：

```go 
// 只能向out发送，只能从in接收
func squarer(out chan<- int, in <-chan int) {
	for v := range in {
		out <- v*v
	}
	close(out)
}
```

### 缓冲通道

缓冲通道有一个元素队列，队列的最大长度在创建的时候通过make的容量参数来设置：`ch := make(chan string, 3)`

缓冲通道上的发送操作在队列的末尾插入一个元素，接收操作在队列的头部移除一个元素。如果通道满了，发送操作会阻塞在`goroutine`直到另个`goroutine`对它进行接收操作留出可用空间。反过来，如果通道是空的，执行接收操作的`goroutine`会阻塞，直到另一个`goroutine`在通道上发送数据。

下面的例子演示一个使用缓冲通道的应用。它并发地向三个镜像地址请求，镜像指相同但分布在不同地区的服务器。他将他们的响应通过一个缓冲通道进行发送，  
然后只接收第一个返回的响应，因为他是最早达到的。所以`mirrorQuery`函数甚至在两个比较慢的服务器还没有响应之前返回了一个结果。

```go
func mirrorQuery() {
	responses := make(chan string, 3)
	go func(){}( responses <- request("aisa.gopl.io"))
	go func(){}( responses <- request("euope.gopl.io"))
	go func(){}( responses <- request("america.gopl.io"))
	return <- responses
}

func request(hostname string) string {/* ... */}
```

如果使用一个无缓冲通道，两个比较慢的`goroutine`将被卡主，因为在他们发送响应结果到通道的时候没有`goroutine`来接收，这个情况叫做**goroutine泄漏**，它属于一个程序bug，不像回收变量，泄漏地`goroutine`不会自动回收，所以确保`goroutine`在不再需要的时候可以自动结束。

无缓冲通道和缓冲通道的选择，缓冲容量大小的选择，都会对程序的正确性产生影响。**无缓冲通道提供强同步保障，因为每一次发送都需要和一次对应的接收同步**； 对于缓冲通道，这些操作是解耦的，如果我们知道要发送的值得数量的上限，通常会创建一个容量是使用上限的缓冲通道，在接收第一个值前就完成所有的发送。但是要注意的是，在内存无法提供缓冲容量的情况下，可能导致程序死锁。


### 通道发送操作和接收操作的基本特性

1. 对于同一个通道，发送操作之间，接收操作之间都是互斥的；
2. 发送操作和接收操作中对元素的处理都是不可分割的；
3. 发送操作在完成之前会被阻塞，接收操作也是；


第一点，同一时刻，Go 语言的运行时系统只会执行对同一个通道的任意个发送操作中的其中一个。直到某个元素被完全复制进通道之后，其他针对该通道的发送操作才可能执行。类似地，同一时刻，运行时系统也只会执行对同一个通道任意接收操作中的一个，直到某个元素被完全从通道移除之后，其他针对该通道的接收操作才会执行，

**这里有一个细节，元素从外界进入通道的时会被复制，也就是说，进入通道的并不是接收操作符右边的那个值，而是它的副本。另一方面，元素从通道进入外界时会被移动，这个过程分为两步，首先生成这个元素之的副本，并准备接收方，第二步是删除通道中的这个元素值**


第二点，这里的分隔承接上述的操作，发送操作要么还没复制元素值，要么已经复制完毕，绝不会出现只复制了一部分的情况。又例如，接收操作在准备好元素的副本之后，一定会删除通道中的原值，绝不会出现通道中仍有残留的情况。


第三点，由于发送操作了包括了 `复制元素值` 和 `放置副本到通道内部` 两个步骤，这两个步骤完成之前，发起这个发送操作的那句代码会一直阻塞在那里。也就是说，在它之后的代码不会有执行的机会，直到这句代码解除锁。另外接收操作了也包括了 `复制通道元素值`，`放置副本到接受方` 以及 `删掉原值` 这三个步骤，在所有操作完成之前，发起该操作的代码也会一直阻塞。


### 通道什么情况下会被阻塞

针对 **缓冲通道**，如果通道已满，那么对它的所有发送操作都会被阻塞，直到通道中有元素被取走，这时，通道会通知最早因此而等待的，那个发送操作所在的 `goroutine`，后者会再次执行发送操作。发送操作在这种情况下被阻塞后，他们所在的 `goroutine` 会顺序进入通道内部的发送队列，所以通道的通知顺序总是公平的。相对的，如果通道已空，那么对它的所有接收操作都会阻塞，直到通道中有新的元素值出现。这是，通道会通知最早等待的那个接收操作所在的`goroutine`，使它再次执行接收操作。因通道为空，而等待取值的 `goroutine` 都会按照先后顺序一次进入通道的通知队列。

对于**非缓冲通道**，情况简单一些，无论是发送操作还是接收操作一开始都会阻塞，直到配对的操作也开始执行，才会继续传递。由此可见，非缓冲通道是在用同步的方式传递数据，也就是说只有收发送方对接上了，数据才会传递，并且数据时直接从发送方复制到接收方的，中间不会用非缓冲通道做中转，相比之下，缓冲通道是在用异步的方式传递数据。

```go
func main() {
	asyncChan := make(chan struct{})
	asyncChan <- struct{}{}
	fmt.Println(len(asyncChan), cap(asyncChan))
	<-asyncChan
	fmt.Println(len(asyncChan), cap(asyncChan))
}
```

这个程序的执行会造成死锁，因为如上文所说，非缓冲通道只有在收发方都准备好的情况下才会执行，而这里，程序一开始就阻塞在发送的位置了：

	fatal error: all goroutines are asleep - deadlock!

	goroutine 1 [chan send]:
	main.main()
	/Users/fudenglong/workdir/go/src/github.com/gamelife1314/go_study/main.go:7 +0x65

这样修改：

```go
func main() {
	asyncChan := make(chan struct{})
	fmt.Println(len(asyncChan), cap(asyncChan))
	go func() {
		asyncChan <- struct{}{}
		fmt.Println(len(asyncChan), cap(asyncChan))
	}()
	<-asyncChan
	fmt.Println(len(asyncChan), cap(asyncChan))
}
```

输出如下，因为当 `asyncChan` 有值的时候立马交给了等待接收的操作，这里直接丢弃，所以两个打印的地方都是0：

	0 0
	0 0


大多数情况下，缓冲通道会作为收发方的中间件，如前文所述，元素值会先从发送方复制进缓冲通道，然后再由缓冲通道复制费接收方。

对于 **值为 `nil` 的通道**，不论它的具体类型是什么，对它的发送操作和接收操作都会永久性处于阻塞状态。由通道是引用类型，所以当通道只声明并没有使用 `make` 进行初始化的时候，该变量的值就是 `nil`，所以，**一定不要忘记初始化通道**！

### 发送操作和接收操作什么时候会引起panic

对于一个已经初始化，但为close的通道来说，收发操作一定不会引起panic，但是通道一旦关闭，再次对它进行发送操作就行引发panic。另外，重复关闭通道也会引发panic。但是，接收操作可以感知到通道关闭，并且安全退出。

更具体地说，放我们把接收表达式的值同时赋值给两个变量时，第二个变量的类型是 bool 类型，它的值为 false 时就说明通道已经关闭了。注意如果通道关闭时，里面还有元素值未取出，那么接收表达式的第一个结果，仍然是通道中的某一个元素值，而第二个解说也一定会是 true。因为，通过接收表达式第二个值来判断通道是否已经关闭是有延迟的。

```go
func main() {
	syncChan := make(chan struct{}, 1)
	syncChan <- struct{}{}
	close(syncChan)
	_, opened := <-syncChan
	fmt.Println(opened) // true
	_, opened = <-syncChan
	fmt.Println(opened) // false
}
```

### 单向通道的应用价值

当说通道的时候，我们一般值双向通道，即：可发可收。所谓单向通道，就是只能发不能收或者只能收不能发，就像一个水管，一头给堵上了。通道是单向还是双向，由它的类型字面量体现。例如：

```go
func main() {
	onlyReceive := make(chan<- int, 1)
	onlySend := make(<-chan int, 1)
	// ...
}
```

不卖关子了，一句话来说就是：**约束其他代码的行为**！实际场景中，这种约束一般会出现在接收类型声明中的某个定义方法上，规定某个方法只能使用接收通道还是发送通道，例如：

```go
type Notifier interface {
	SendInt(ch chan<- int)
}
```

但是在调用`SendInt` 这个方法的时候，我们可以传递一个双向通道而没要使用发送通道：

```go
intChan1 := make(chan int, 3)
SendInt(intChan1)
```

看一个简单的例子，这个例子中，所有实现 `Notifier` 的类型方法中，只能往传入的通道中发送，而不能从中取值：

```go

type Notifier interface {
	SendInt(chan<- int)
}

type EmailNotifier struct {
}

func (e *EmailNotifier) SendInt(ch chan<- int) {
	ch <- 999
}

func main() {
	ch := make(chan int, 1)
	email := EmailNotifier{}
	email.SendInt(ch)
	value := <-ch
	fmt.Println(value) // 999
}
```

### 使用 `for ... range` 遍历通道

`for ... range` 可以用于从一个通道中持续取值，直到该通道关闭然后退出循环。

```go
func main() {
	abort := make(chan struct{}, 3)
	abort <- struct{}{}
	abort <- struct{}{}
	abort <- struct{}{}
	close(abort)
	for item := range abort {
		fmt.Println(item)
	}
}
```

输出：
	{}
	{}
	{}