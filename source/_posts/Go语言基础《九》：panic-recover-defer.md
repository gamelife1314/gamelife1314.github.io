---
title: 'Go语言基础《九》：panic， recover， defer'
date: 2018-11-03 19:49:13
categories:
  - Go语言基础
tags:
  - panic
  - recover
  - defer
---

{% asset_img cover.jpeg cover %}

<!--more-->

### defer：延迟函数

语法上，一个 `defer` 语句就是一个普通的函数或方法调用，在调用之前加上关键词 `defer`。函数和参数表达式会在语句执行时求值，但是无论是正常情况下，执行 `return` 语句或函数执行完毕，还是不正常的情况下，比如发生宕机，实际的调用推迟到包含 `defer` 语句的函数执行结束后才执行。`defer` 语句没有限制使用次数，执行的时候以调用 `defer` 语句顺序的倒序执行。`defer` 语句常用语成对的操作，比如打开和关闭，连接和断开，枷锁和解锁，即使再复杂的控制流，资源在任何情况下都能正确释放。正确使用 `defer` 是在成功获得资源之后。

```go
import (
	"fmt"
	"os"
)

func main() {
	file, err := os.Open("main.go")
	if err != nil {
		fmt.Println(err)
	}
	defer file.Close()
	var content = make([]byte, 12)
	_, err = file.Read(content)
	fmt.Println(string(content))
}
```

延迟执行函数在 `return` 语句结束之后执行，并且可以更新函数的结果变量，因为匿名函数可以得到其外层函数作用域内的变量（包括命名的结果），所以延迟执行的函数可以观察到函数的返回结果。

```go
func divide(m, n float64) (result float64) {
	defer func() {
		if err := recover(); err != nil {
			result = math.NaN()
		}
	}()
	return m / n
}

func main() {
	fmt.Println(divide(5, 0))  // +Inf
}
```

上面的函数中，在当除数为0的时候，程序本该会发生 `panic`，但是我们通过 `defer` 语句捕获错误，并将结果设置为 `NaN`，因为延迟函数不到函数的最后一刻是不会执行的，所以我们可以函数体所有代码执行结束之后拿到结果值进行判断并处理。

如果同一个函数中有多个 `defer` 语句，defer 函数调用的顺序与他们分别所属的 `defer` 语句的出现顺序完全相反。究其原因是这样的，在 `defer` 语句每次执行的时候，Go语言会把它携带的defer 函数以及其参数值存储到另一个栈中，这个栈是与`defer`语句所在的函数是一一对应的，在需要执行某个函数的 `defer` 函数调用的时候，Go语言会拿到这个队列，然后从该队列中一一取出函数及其参数，并逐个执行调用。

```go
package main

import "fmt"

func main() {
	for i := 0; i < 5; i++ {
		defer func(i int) {
			fmt.Print(i)
		}(i)
	}
}
```

这段代码的输出是：

    43210

### panic：宕机

Go 语言的类型系统会捕获许多编译时错误，但有些其他的错误（比如数组越界访问或者解引用空指针）都需要在运行时检查。当Go语言的运行时系统检测到这些错误，它就会发生宕机。宕机发生时，正常的程序执行会终止，`goroutine` 中的所有延迟函数会执行，然后程序退出并留下一条日志消息。

并不是所有的宕机都是在运行时发生的，可以直接调用内置的宕机函数，内置的宕机函数可以接受任何值作为参数。如果碰到 “不可能发生” 的情况，宕机是最好的处理方式，比如语句执行到逻辑上不可能到达的地方：

```go
package main

import "fmt"

type Weekday int

const (
	Sunday Weekday = iota
	Monday
	Tuesday
	Wednesday
	Thursday
	Friday
	Saturday
)

func weekInfo(weekday Weekday) {
	switch weekday {
	case Sunday:
		fmt.Println("周日")
	case Monday:
		fmt.Println("周一")
	case Tuesday:
		fmt.Println("周二")
	case Wednesday:
		fmt.Println("周三")
	case Thursday:
		fmt.Println("周四")
	case Friday:
		fmt.Println("周五")
	case Saturday:
		fmt.Println("周六")
	default:
		panic("没有这个星期")
	}
}

func main() {
	weekInfo(8)
}

```

改程序运行时输出如下：
    
    panic: 没有这个星期

    goroutine 1 [running]:
    main.weekInfo(0x8)
        /Users/fudenglong/workdir/go/src/github.com/gamelife1314/go_study/main.go:34 +0x299
    main.main()
        /Users/fudenglong/workdir/go/src/github.com/gamelife1314/go_study/main.go:39 +0x2a

程序发生 `panic` 时大致过程是这样的：某个函数中的某行代码如果有意无意引发了一个panic，这是初始的panic详情建立起来，并且改程序的控制权会立即从此行代码转移至调用其所属函数的那行代码上，也就是调用栈中的上一级。这也意味着，此行代码所处函数的执行会立即终止。紧接着，控制权并不会再次有片刻停留，它又会立即转移至再上一级的调用代码处。控制权如此一级一级地沿着调用栈的反方向传播至顶端，也就是我们编写的最外层函数那里。这里的最外层函数指的是 go 函数，对于主 goroutine 来说就是 main 函数，但是控制权也不会在此停留，而是会被 Go 语言运行时系统回收。随后程序奔溃运行，承载这次运行的进程也会随之死亡。这个控制权传播的期间，panic 详情会逐渐积累和完善，并会在程序终止之前被打印出来。

### recover: 恢复

内置的 `recover` 函数如果在延迟函数内部调用，如果这个包含 `defer` 语句的函数发生宕机，`recover` 函数会终止当前的宕机状态并且返回宕机的值。但是这个函数不会从宕机的地方继续执行而是正常返回。关于恢复的例子前面已经展示过了，在除数为0的时候，程序本该发生错误，宕机然后退出，但是被我们捕获，给了一个 `NaN` 值。
