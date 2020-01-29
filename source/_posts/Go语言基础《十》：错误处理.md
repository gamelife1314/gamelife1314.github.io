---
title: Go语言基础《十》：错误处理
date: 2018-11-04 00:22:26
categories:
  - Go语言基础
tags:
  - 错误处理
---

如果当函数调用发生错误时返回一个附加的结果作为错误值，习惯上将错误值作为最后一个结果返回。如果错误只有一种情况，结果通常设置为布尔类型，就像下面这个查询缓存的例子里面，往往都会成功，只有不存在对应的键值的时候返回错误：

```go
value, ok := cache.lookup(key)
if !ok {
    // ...cache[key] 不存在
}
```

更多的时候，尤其对于 I/O 操作，错误的原因可能多种多样，而调用者则需要一些详细的信息，在这种情况下，错误的结果是类型往往是 `error` 。

{% asset_img cover.jpeg cover %}

<!--more-->

与许多其他语言不同，**Go 语言通过使用普通的值而非异常类报告错误**。尽管 Go 语言有异常机制，但是 Go 语言的异常只针对程序 bug 导致的预料外错误，而不能作为常规的处理方法出现在程序中。常见的错误处理策略有下面几种：

**将错误传递下去**

```go
resp, err := http.Get(url)
if err != nil {
    return nil, err
}
```

**对于不固定或者不可预测的错误，短暂间隔后的重试是比较合理的**

```go
func waitForServer(url string) error {
    const timeout = 1 * time.Minute
    deadline := time.Now().Add(timeout)
    for tries := 0; time.Now().Before(deadline); tries++ {
        _, err := http.Head(url)
        if err == nil {
            return err
        }
        log.Printf("server not responding(%s), retrying...", err)
        time.Sleep(time.Second << uint(tries))
    }
    return fmt.Errorf("server %s failed to respond after %s", url, timeout)
}
```

**如果依旧不能顺利进行下去，调用者要能够输出错误后然后优雅地停止程序**

```go
if err := waitForServer(url); url != nil {
    log.Fatalf("Site is down：%v\n", err)
}
```

对于具体错误的判断，Go 语言中都有哪些惯用做法？或者说怎么判断一个错误值具体代表哪一类错误？

1. 对于类型在已知范围内的一系列错误值，一般使用类型断言表达式或者类型switch语句判断；
2. 对于已有相应变量且类型相同的一系列值，一般直接使用判断操作符来判断；
3. 对于没有变量类型且类型未知的一系列错误值，只能使用其错误信息等字符串表示形式来判断；

其中类型在已知范围内的错误值是最容易分辨的，拿 os 包中的几个代表错误的类型 `os.LinkError`，`os.PathError` 以及 `os.SyscallError` 来说，他们的指针类型都是 `error` 接口的实现类型，同时也都包含了一个名叫 `Err`，类型为 `error` 接口类型的代表潜在错误的字段。如果我们得到一个error类型的值，并且知道该类型值的实际类型肯定是他们其中一个，那么就可以用 `switch` 语句去做判断，例如：

```go
func underlyingError(err error) error {
	switch err := err.(type) {
	case *os.PathError:
		return err.Err
	case *os.LinkError:
		return err.Err
	case *os.SyscallError:
		return err.Err
	case *exec.Error:
		return err.Err
	}
	return err
}
```

还拿 os 包来说事，其中不少的错误值都是通过调用 `errros.New` 函数来初始化的，比如：`os.ErrClosed`，`os.ErrNotExist`，`os.ErrExist`，`os.ErrPermission` 以及 `os.ErrInvalid` 等等。注意这几个与前面的错误类型不同，这几个都是已经定义好的，确切的错误值。os 包中的代码会把他们当做潜在错误值，封装进前面那些错误类型的之中。

```go
var (
	ErrInvalid    = errors.New("invalid argument") // methods on File will return this error when the receiver is nil
	ErrPermission = errors.New("permission denied")
	ErrExist      = errors.New("file already exists")
	ErrNotExist   = errors.New("file does not exist")
	ErrClosed     = errors.New("file already closed")
	ErrNoDeadline = poll.ErrNoDeadline
)
```

如果在操作文件的时候得到这样一个错误值，并且知道该值的潜在错误值肯定是上述其中之一，那么就可以用普通的 `switch` 语句去做判断了，当然if也是可以的哇：

```go
printError := func(i int, err error) {
	if err == nil {
		fmt.Println("nil error")
		return
	}
	err = underlyingError(err)
	switch err {
	case os.ErrClosed:
		fmt.Printf("error(closed)[%d]: %s\n", i, err)
	case os.ErrInvalid:
		fmt.Printf("error(invalid)[%d]: %s\n", i, err)
	case os.ErrPermission:
		fmt.Printf("error(permission)[%d]: %s\n", i, err)
	}
}
```

在实际的项目开发中，我们通常 **创建立体的错误类型体系和创建扁平的错误值列表**。

先说 `立体错误类型体系`，在 Go 语言中接口实现是非侵入式的，所以我们可以做的很灵活。例如，在标准库的net代码包中，有一个名为 Error 的接口类型，它算是内建接口类型 error 的一个扩展接口，因为 `error` 是 `net.Error` 的嵌入接口，除此之外，`net.Error` 还有两个自己声明的方法：`Timeout` 和 `Temporary`：

```go
type Error interface {
	error
	Timeout() bool   // Is the error a timeout?
	Temporary() bool // Is the error temporary?
}
```

`net` 包中有很多错误类型实现了 `net.Error` 接口，比如：

1. `*net.OpError`
2. `*net.AddrError`
3. `net.UnknownNetworkError`

到这里，你可以把 `立体错误类型体系` 想象成一棵树，内建 `error` 就是这棵树的根，而 `net.Error` 就是一个在根上延伸的第一级非叶子节点。

相比于 `立体错误类型体系`，`扁平化错误类型体系` 就相对简单多了，当我们只是想预先创建一些代表已知错误值的时候，用这种扁平化的方式就很恰当了。