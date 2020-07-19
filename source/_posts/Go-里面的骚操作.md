---
title: Go 奇淫技巧
date: 2020-02-04 10:17:11
categories:
  - Go语言进阶 
---


每个语言里面都有一些隐含的技巧，这些技巧在某些情况下可以极大提高生产力，利用语言的特性，提升代码效率。

{% asset_img cover.jpg cover %}

<!-- more -->

### 切片相关

切片是 Golang 中一个非常重要的数据类型，便利的切片操作，自动扩展的特性使用起来非常方便，有点类似于 Python 的列表。

#### 切片中追加元素

在切片中添加元素分为在后面添加，中间添加，在前面添加，有一些操作可以用于提升性能，尤其是在中间添加元素时。

{% tabs 切片中追加元素, 2 %}
<!-- tab 前面 -->
```golang
func Test_appendInHead(t *testing.T)  {
	var a = []int{1, 2, 3}
	a = append([]int{0}, a...)
	fmt.Println(a)
}
```
<!-- endtab -->

<!-- tab 中间 -->
```golang
func Test_appendInMiddle(t *testing.T)  {
	// 中间追加元素
	var a  = []int{1, 3, 4}
	a = append(a[:1], append([]int{2}, a[1:]...)...)
	fmt.Println(a)

	// 中间追加切片
	a = []int{1, 4, 5}
	a = append(a[:1], append([]int{2, 3}, a[1:]...)...)
	fmt.Println(a)

	// 中间追加元素优化，前面两种追加方法都会产生临时切片
	var b = []int{1, 3, 4}
	b = append(b, 0)  // 扩展一个空间
	copy(b[2:], b[1:])
	b[1] = 2
	fmt.Println(b)
}
```
<!-- endtab -->

<!-- tab 后面 -->
在后面追加元素就比较简单了，日常操作，不解释
<!-- endtab -->
{% endtabs %}



#### 删除切片中元素

{% tabs 切片中追加元素, 2 %}

<!-- tab 头部删除 -->

头部删除有两种思路，一种是将指针向后移动，另一种是将后面的数据往前面移动。

```golang
func Test_deleteInHead(t *testing.T)  {
    // 移动指针
	a := []int{1, 2, 3, 4}
	a = a[1:]

    // 后面的数据前移
	b := []int{1, 2, 3, 4}
	b = append(b[:0], b[1:]...)
	fmt.Println(a, b)
}
```
<!-- endtab -->

<!-- tab 中间删除 -->
```golang
func Test_deleteInMiddle(t *testing.T)  {
	a := []int{1, 2, 3, 4}
	a = append(a[:1], a[2:]...)
	fmt.Println(a)

	b := []int{1, 2, 3, 4}
	b = b[:1+copy(b[1:], b[2:])]
	fmt.Println(b)
}
```
<!-- endtab -->

<!-- tab 尾部删除 -->

尾部删除元素最快，通过切片操作符直接完成大牛股

```golang
func Test_deleteInTail(t *testing.T)  {
	a := []int{1, 2, 3, 4}
	a = a[:len(a)-1]

	b:= []int{1, 2, 3, 4}
	b = b[:len(b)-2]
	fmt.Println(a, b)
}func Test_deleteInTail(t *testing.T)  {
	a := []int{1, 2, 3, 4}
	a = a[:len(a)-1]

	b:= []int{1, 2, 3, 4}
	b = b[:len(b)-2]
	fmt.Println(a, b)
}
```

<!-- endtab -->

{% endtabs %}


#### 切片类型强制转换

为了安全，两个切片类型 []T 和 []Y 的底层切片类型不同时，Go 语言是无法强制转换他们的类型的，不过安全是有一定代价的，有时候这种转换是有一定价值的，例如下面告诉排序 `[]float64`。

这里有一个知识点就是切片底层是是用 `reflect.SliceHeader` 表示的，也就是说所有的切片类型在运行时其实都被表示为这个。

```go
// SliceHeader is the runtime representation of a slice.
// It cannot be used safely or portably and its representation may
// change in a later release.
// Moreover, the Data field is not sufficient to guarantee the data
// it references will not be garbage collected, so programs must keep
// a separate, correctly typed pointer to the underlying data.
type SliceHeader struct {
	Data uintptr
	Len  int
	Cap  int
}
```

看个快速排序 `[]float64` 的例子：

```golang
func Test_fastSortFloat64(t *testing.T)  {
	var a = []float64{4, 2, 5, 7, 2, 1, 88, 1}
	var b []int
	aHeader := (*reflect.SliceHeader)(unsafe.Pointer(&a))
	bHeader := (*reflect.SliceHeader)(unsafe.Pointer(&b))
	*bHeader = *aHeader
	sort.Ints(b)
	fmt.Println(a)
}
```


### defer 语句妙用

defer 语句我认为是 Go 语言的亮点之一，很容易实现资源释放以及做一些清理操作，在其他语言中，我们不得不通过 `try...catch` 或者 Python 中的 `with` 语句，等类似的方式实现。不过我们也可以通过 `defer` 语句的特性做一些其他的事情。


#### 修改返回值

当函数的返回值有名称时，可以在 `defer` 语句中进行修改， 看下面的例子：

```go
func Test_alterReturnValue(t *testing.T)  {
	var add = func(a, b int) (sum int) {
		defer func() {
			sum = 5
		}()
		return a + b
	}
	fmt.Println(add(1, 6))
}
```

本来 `add(1, 6)` 是7，但是我们在 `defer` 中将结果改为 `5`，达到了修改返回值的目的。


### Go 初始化顺序

Go 程序的初始化和执行总是从 `main.main()` 函数开始的，但是如果 main 包里面导入了其他的包，则会按照顺序将他们包含到 main 包里。如果某个包被多次导入，那么在执行的时候只会导入一次。当一个包被导入时，如果还导入了其他的包，则先将其他的包包含进来，然后创建和初始化这个包的常量，再调用包里的 init() 函数。如果一个包里有多个 init() 函数，实现可能是以文件的顺序调用，同一个文件内的多个 init() 是以出现顺序依次调用的。如下图所示：

![导入顺序](init-sort.png)


### channel 

channel 也是 Go 语言的一个特色数据类型，唯一并发安全的数据类型，用于在多个 goroutine 之间传递数据。channel 是用 `make` 初始化，可以使用 `close` 方法进行关闭，当通道关闭的时候，所有的接收方都会收到通知，我们可以利用这一特性，让主 goroutine 等待子 goroutine 退出，并且完成清理工作。


```go
package main

import (
	"fmt"
	"sync"
	"time"
)

func worker(wg *sync.WaitGroup, cancel <-chan struct{})  {
	defer wg.Done()
	for {
		quit := false
		select {
		default:
			fmt.Println("hello")
		case <-cancel:
			quit= true
		}
		if quit {
			break
		}
	}
	// clear 操作
}

func main() {
	var wg sync.WaitGroup
	var cancel = make(chan struct{})
	for i := 0; i < 10; i ++ {
		wg.Add(1)
		go worker(&wg, cancel)
	}
	time.Sleep(1 * time.Second)
	close(cancel)
	wg.Wait()
}

```

### context

Go 1.7 的时候，标准库里面增加了一个 context 包，用来简化处理单个请求的多个 goroutine 之间与请求域的数据、超时和退出等操作。下面的例子中，当并发体超时或者主动停止工作者 Goroutine 时，每个工作者都可以安全退出。

```go
package main

import (
	"context"
	"fmt"
	"sync"
	"time"
)

func worker(ctx context.Context, wg *sync.WaitGroup) error  {
	defer wg.Done()
	for {
		select {
		default:
			fmt.Println("hello")
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	// clear
}

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 10 * time.Second)
	var wg sync.WaitGroup
	for i := 0; i < 10; i ++ {
		wg.Add(1)
		go worker(ctx, &wg)
	}
	time.Sleep(time.Second)
	cancel()
	wg.Wait()
}

```

### go:linkname 

关于 `go:linkname` 指令的官方解释大家可以在 [https://golang.org/cmd/compile/](https://golang.org/cmd/compile/) 找到，它的格式为：

> //go:linkname localname [importpath.name]

意思是本地源文件中的 `localname` 使用 `importpath.name` 作为其符号名称，相当于 `localname` 软连接到了 `importpath.name`，利用这个特性，我们可以访问：

1. 未导出的方法
2. 公开类型私有方法
3. 私有类型私有方法
4. 私有全局变量

{% tabs golinkname %}

<!-- tab 代码组织 -->
![golinkname](golinkname.png)
<!-- endtab -->

<!-- tab code.go -->

```go
package a

func add(a, b int) int  {
	return a + b
}

type Pub struct {
	i int64
}

func (p *Pub) iv(b int64) int64 {
	return p.i + b
}

type pri struct {
	i int64
}

func (p *pri) iv(b int64) int64 {
	return p.i + b
}

var gv = map[string]string{"hello": "world"}
```

<!-- endtab -->

<!-- tab main.go -->

```go
package main

import (
	"fmt"
	"go-study/get_gid/a"
	_ "unsafe"
)

// 调用包级私有方法
//go:linkname add go-study/get_gid/a.add
func add(a, b int) int

// 访问公开类型私有方法
//go:linkname iv go-study/get_gid/a.(*Pub).iv
func iv(a *a.Pub, b int64) int64

// 访问私有类型私有方法，需要在引用出重新定义私有类型
type pri struct {
	i int64
}

//go:linkname (*pri).iv go-study/get_gid/a.(*pri).iv
func (p *pri) iv(b int64) int64

// 访问私有全局变量
//go:linkname gv go-study/get_gid/a.gv
var gv map[string]string

func main() {
	fmt.Println(add(1, 2))
	pubv := &a.Pub{}
	fmt.Println(iv(pubv, 2))
	priv := &pri{i:3}
	fmt.Println(priv.iv(2))
	fmt.Println(gv)
}
```
<!-- endtab -->

<!-- tab get_gid.s -->
**`get_gid.s`** 是一个空的文件，用来绕过编译检查，名称可以是任意值，只要后缀为 `.s` 就可以。
<!-- endtab -->

{% endtabs %}