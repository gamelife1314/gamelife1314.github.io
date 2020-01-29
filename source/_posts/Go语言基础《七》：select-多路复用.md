---
title: Go语言基础《七》：select 多路复用
date: 2018-11-01 23:37:45
categories:
  - Go语言基础
tags:
  - select
---

{% asset_img cover.jpeg cover %}

<!--more-->

以一个常举的例子开始，对于火箭发射，我们既可以在倒计时结束的时候成功发射，也可以在倒计时期间取消，那么对于程序设计者来说，就需要监听这两种情况。假设倒计时和取消这两种事件都是通过通道来传递的时候，就需要有一个操作能同时监听这两个通道，哪一个有消息就处理哪一个，这种操作称之为：**多路复用**（强行解释，后面理解加深了回补）。

```go
import (
	"fmt"
	"os"
	"time"
)

func main() {
	abort := make(chan struct{})
	go func() {
		os.Stdin.Read(make([]byte, 1))
		abort <- struct{}{}
	}()
	fmt.Println("commencing countdown. Press return  abort")
	select {
	case <-time.After(10 * time.Second):
	case <-abort:
		fmt.Println("Launch Aborted!")
		return
	}
	fmt.Println("Lunch Stating!")
}
```

解释下这个程序，`select` 会一直等待，直到有一次通信来告知有一些情况可以发生。然后对它进行这次通信，并执行此情况对应的语句。而其他的通信将不会发生。上述示例中，`time.After` 函数会立即会返回一个只能往外发送数据的单向相同，并在指定时间间隔后往这个通道发送一个值。在这个期间，如果你在控制台输入任意字符，都会取消这个发送流程。


`select` 语句只能与通道连用，它一般由若干个分支组成。每次执行这种语句的时候，一般只有一个分支中的代码会被执行。

`select` 的语句分为两种，一种叫做候选分支，另一种叫做默认分支，候选分支总是以关键字 `case` 开头，后跟一个 `case` 表达式和一个冒号。默认分支以关键字 `default` 开头。**由于select语句是专门为通道而设计的，所以每个 `case` 表达式中只能包含操作通道的表达式，比如接收表达式**。当然，如果我们需要把接收表达式的结果赋给变量的时候，可以把这里写成赋值语句或者多变量声明语句。

```go
import (
	"fmt"
	"math/rand"
)

func main() {
	// 准备好几个通道。
	intChannels := [3]chan int{
		make(chan int, 1),
		make(chan int, 1),
		make(chan int, 1),
	}
	// 随机选择一个通道，并向它发送元素值。
	index := rand.Intn(3)
	fmt.Printf("The index: %d\n", index)
	intChannels[index] <- index
	// 哪一个通道中有可取的元素值，哪个对应的分支就会被执行。
	select {
	case <-intChannels[0]:
		fmt.Println("The first candidate case is selected.")
	case <-intChannels[1]:
		fmt.Println("The second candidate case is selected.")
	case elem := <-intChannels[2]:
		fmt.Printf("The third candidate case is selected, the element is %d.\n", elem)
	default:
		fmt.Println("No candidate case is selected!")
	}
}
```

此程序可能输出：

    The index: 2
    The third candidate case is selected, the element is 2.

在使用 `select` 语句的时候，我们首先需要注意下面几个事情：

1. **如果想上述示例那样加入了默认分支**，那么无论涉及通道操作的表达式是否有阻塞，`select` 语句都不会被阻塞。如果几个表达式都阻塞了，或者说没有满足求值的条件，那么默认分支就会被选中；
2. 如果没有加入默认分支，那么一旦所有的 `case` 表达式都没有满足条件，那么 `select` 语句会一直阻塞在那里。
3. 在通道那节我们提到过，如果通道关闭了，我们还是能从通道接收到值的，只不过是通道元素类型的零值，所以我们就需要通道接收表达式的第二个值来判断通道是否已经关闭。一旦发现通道关闭，我们应该及时屏蔽掉相应分支或者采取措施。
4. `select` 语句只能对其中的每一个case表达式求值一次，所以如果我们想连续或者定时操作其中的通道的话，就往往需要在 `for` 语句中嵌入 `select` 语句的方式实现。但是这时要注意，简单滴在`select` 字句中使用 `break` 语句，只能结束当前 `select` 语句的执行，而不会对外层的 `for` 语句产生作用。


```go
import (
	"fmt"
	"time"
)

func main() {
	intChan := make(chan int, 1)
	// 一秒后关闭通道。
	time.AfterFunc(time.Second, func() {
		close(intChan)
	})
	select {
	case _, ok := <-intChan:
		if !ok {
			fmt.Println("The candidate case is closed.")
			break
		}
		fmt.Println("The candidate case is selected.")
	}
}
```

这个程序的输出是：

    The candidate case is closed.


再来聊聊 `select` 语句的分支选择规则：

1. 对于每一个case表达式，都至少会包含一个代表发送操作的发送表达式或者一个代表接收操作的接收表达式，同时也可能会包含其他的表达式。比如，如果 `case` 表达式是包含了接收表达式的短变量声明时，那么赋值符号左边的就可以使一个或者两个表达式，不过此处的表达式的结果必须是可以被赋值的。当这样的case表达式被求值是，它包含的多个表达式总会以从左到右的顺序被求值；

2. `select` 语句包含的候选分支中的 `case` 表达式都会在该语句执行开始时先被求值，并且求值的顺序是依从代码编写的顺序从上到下的。结合上一条规则，在 `select` 语句开始执行时，排在最上边的候选分支中最左边的表达式会最先被求值，然后是它右边的表达式。仅当最上边的候选分支中的所有表达式都被求值完毕后，从上边数第二个候选分支中的表达式才会被求值，顺序同样是从左到右，然后是第三个候选分支、第四个候选分支，以此类推。

3. 对于每一个 `case` 表达式，如果其中的发送表达式或者接收表达式在被求值时，相应的操作正处于阻塞状态，那么对该表达式的求值就是不成功的。在这种情况下，我们可以说，这个 `case` 表达式所在的候选分支是不满足选择条件的。

4. **仅当 `select` 语句中的所有 `case` 表达式都被求值完毕后，它才会开始选择候选分支。这时候，它只会挑选满足选择条件的候选分支执行。如果所有的候选分支都不满足选择条件，那么默认分支就会被执行。如果这时没有默认分支，那么 `select` 语句就会立即进入阻塞状态，直到至少有一个候选分支满足选择条件为止。一旦有一个候选分支满足选择条件，`select` 语句（或者说它所在的 `goroutine`）就会被唤醒，这个候选分支就会被执行。**

5. 如果 `select` 语句发现同时有多个候选分支满足选择条件，那么它就会用一种伪随机的算法在这些分支中选择一个并执行。注意，即使 `select` 语句是在被唤醒时发现的这种情况，也会这样做。

6. 一条 `select` 语句中只能够有一个默认分支。并且，默认分支只在无候选分支可选时才会被执行，这与它的编写位置无关。

7. `select` 语句的每次执行，包括 `case` 表达式求值和分支选择，都是独立的。不过，至于它的执行是否是并发安全的，就要看其中的 `case` 表达式以及分支中，是否包含并发不安全的代码了。


示例代码：

```go
package main

import "fmt"

var channels = [3]chan int{
	nil,
	make(chan int),
	nil,
}

var numbers = []int{1, 2, 3}

func main() {
	select {
	case getChan(0) <- getNumber(0):
		fmt.Println("The first candidate case is selected.")
	case getChan(1) <- getNumber(1):
		fmt.Println("The second candidate case is selected.")
	case getChan(2) <- getNumber(2):
		fmt.Println("The third candidate case is selected")
	default:
		fmt.Println("No candidate case is selected!")
	}
}

func getNumber(i int) int {
	fmt.Printf("numbers[%d]\n", i)
	return numbers[i]
}

func getChan(i int) chan int {
	fmt.Printf("channels[%d]\n", i)
	return channels[i]
}
```

程序输出如下：

    channels[0]
    numbers[0]
    channels[1]
    numbers[1]
    channels[2]
    numbers[2]
    No candidate case is selected!

我们来一次解释下，为什么每个 `case` 分支都没有被选中：

分支一：因为 `channels[0]` 是 `nil`，我们说过，对值为 `nil` 的通道做任何操作都会阻塞；
分支二：因为 `channels[1]` 是 `无缓冲通道` ，我们说过，无缓冲通道会一直阻塞，直到配对的操作就位，这里只有接收操作，所以阻塞；
分支三：同分支一