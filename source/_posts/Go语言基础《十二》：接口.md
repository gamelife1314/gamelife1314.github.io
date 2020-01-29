---
title: Go语言基础《十二》：接口
date: 2018-11-05 00:31:15
categories:
  - Go语言基础
tags:
  - interface
  - 接口
---

{% asset_img cover.jpeg cover %}

<!-- more -->

接口类型是对类型行为的概括与抽象。通过使用接口，我们可以写出更加灵活和通用的函数，**这些函数不用绑定在一个特定类型实现上**。

大多面向对象中的语言中都有接口这个概念，Go 语言接口的独特支持在于它是隐式实现的。换句话说，对于一个具体类型，无需声明他实现了哪些接口，只要提供接口所需的方法即可。这种设计让你无需改变已有类型的实现，就可以为这些类型创建新的接口，对于那些不能修改包的类型，这一点很有用。


### 接口即约定

之前介绍的都是 `具体类型`，具体类型不仅指定了所含数据的精确布局，还暴露了基于这个精确布局的内部操作。Go 语言中还有另外一种类型成为 `接口类型`。接口类型是一种抽象类型，他并没有暴露所含数据的布局或者内部结构，当然也没有那些数据的基本操作，你仅仅能知道的是它能做什么，或者更精确地将，仅仅是它提供了哪些方法。

常用的两个格式化方法 `fmt.Printf` 和 `fmt.Sprintf` ，前者是把结果发送到标准输出，后者是把结果以 string 类型返回。格式化是两个函数中最复杂的部分，如果仅仅因为在输出方式上的细微差别，就需要把两个函数重写一遍，那就是太浪费时间了。幸运的是通过接口机制，可以解决这个问题。其实这两个函数都封装了对 `fmt.Fprintf` 函数的调用，而这个函数对结果实际输出到哪里并不关心：

```go
package fmt

func Fprintf(w io.Writer, a ...interface{}) (n int, err error)

// Printf formats according to a format specifier and writes to standard output.
// It returns the number of bytes written and any write error encountered.
func Printf(format string, a ...interface{}) (n int, err error) {
	return Fprintf(os.Stdout, format, a...)
}

func Sprintf(format string, a ...interface{}) string {
    var buf bytes.Buffer
    Fprintf(&buf, format, ...a)
    return buf.String()
}
```

<!--more-->

`Fprintf` 的前缀 F 指文件，表示格式化输出会写入第一个实参所指代的文件。对于 Printf 第一个实参就是 `os.Stdout`，它属于 `*.os.File` 类型。对于 `Sprintf`，尽管第一个实参不是文件，但它模拟了一个文件：`&buf` 是一个指向内存缓冲区的指针，与文件类似，缓冲区也可以写入多个字节。

其实 `Fprintf` 的第一个参数也不是文件类型，而是 `io.Writer` 接口类型，其声明如下：

```go
type Writer interface {
	Write(p []byte) (n int, err error)
}
```

`io.Writer` 定义了调用者和 `Fprintf` 之间的 **约定**。一方面这个约定要求调用者提供的具体类型包含一个一个与其签名和行为一致的 `Write` 方法。另一方面，这个约定保证了 `Fprintf` 能使用任何满足 `io.Writer` 接口的参数。`Fprintf` 只需能调用它的 Write 方法，无需关心是写入文件还是写入内存。

因为，fmt.Fprintf 仅依赖于 io.Writer 接口所约定的方法，对参数的具体类型没有要求。所以我们可以用任何满足 io.Writer 接口的具体类型作为 fmt.Fprintf 的第一个实参。**这种可以把一种类型替换为满足同一接口的其他类型的特性称为可取代性，这是面向对象语言的典型特征**。


### 接口类型

一个接口定义定义了一套方法，如果一个具体类型要实现该接口，那么必须实现接口类型中定义的所有方法。我们来看看 `io` 包中声明的接口类型：

```go
type Reader interface {
	Read(p []byte) (n int, err error)
}

type Writer interface {
	Write(p []byte) (n int, err error)
}

type Closer interface {
	Close() error
}
```

另外，我们还可以通过组合已有接口得到新的接口，比如下面两个例子：

```go
type ReadWriter interface {
	Reader
	Writer
}

type ReadWriteCloser interface {
	Reader
	Writer
	Closer
}
```

### 实现接口

如果一个类型实现了一个接口要求的所有方法，那么这个类型实现了这个接口。Go 程序员通想说一个具体类型 “是一个（`is-a`）”特定的接口类型，这其实代表着该具体类型实现了该接口。比如，`*bytes.Buffer` 是一个 `io.Writer`，`*os.File` 是一个 `io.ReaderWriter`。接口的赋值规则很简单，仅当一个表达式实现了一个接口时，这个表达式才可以赋给该接口：

```go
var w io.Writer
w = os.Stdout           // ok
w = new(bytes.Buffer)  // ok
w = time.Second       // compile error

var rwc io.ReadWriterCloser
rwc = os.Stdout // ok
rwc = new(bytes.Buffer) // error *bytes.Buffer 缺少close 方法
```

当右侧表达式是一个接口时，该规则也有效：

```go
w = rwc // ok, io.ReadWriterCloser 有 Writer 方法
rwc = w // 编译错误，io.Writer 缺少 Close 方法
```

一个拥有更多方法的接口，比如 `io.ReadWriter` 和 `io.Writer` 相比，给了我们它所指向数据的更多信息，当然也给实现这个接口增加了更高的门槛。**那么对于空接口类型 `interface{}` 它完全不包含任何方法，通过这个接口能得到对应具体类型的什么信息呢？确实什么信息也得不到，看起来这个接口没什么用，但实际上成为 `空接口类型` 的 `interface{}` 是不可缺少的。正因为这个空接口类型对其实现类型没有任何要求，所以我们可以把任何值赋值给空接口类型。**

```go
var any interface{}
any = true
any = 12.34
any = "hello"
any = map[string]int{}
any = new(bytes.Buffer)
```

非空的接口类型，比如：`io.Writer` 通常由一个指针类型实现，特别是接口类型的一个或多个方法暗示会修改接收者的情形，一个指向结构的指针才是最常见的方法接收者。

### 接口值

从概念上来讲，一个接口类型的值（简称接口值）其实有两个部分：一个具体类型和该类型的一个值，二者称为接口的：`动态类型`和`动态值`。对于像Go这样的静态类型语言，类型仅仅是一个编译是的概念，所以类型不是一个值。在我们的概念模型中，用类型描述符来提供每个类型的具体信息，比如它的名字和方法。对于一个接口值，类型部分就用对应的类型描述符来表达。

如下四个语句中，变量 w 有三个不同的值（最后和最初是同一个值）：

```go
var w io.Writer
w = os.Stdout
w = new(bytes.Buffer)
w = nil
```

接下里让我们详细地查看一下在每个语句之后 w 的值和相关的动态行为。第一个语句声明了 `w`：

```go
var w io.Writer
```

在 Go 语言中，变量初始化的时候总有一个特定的值，接口也不例外。接口的零值就是 **它的动态类型和值都设置为 `nil`**。一个接口值是否是 `nil` 取决于它的动态类型，所以现在指的是一个 `nil` 接口值。可以用 `w == nil` 或者 `w != nil` 来检测接口值是否为 `nil`。**调用一个 `nil` 接口的任何方法都会导致崩溃**。

第二个语句把一个 `*os.File` 类型的值赋给了 `w`:

```go
w = os.Stdout
```

这次赋值把一个具体类型隐式转换为一个接口类型，它与显示的转换 `io.Writer(os.Stdout)` 等价，接口值的动态类型会设置为指针类型 `*os.File` 的类型描述符，它的动态值会设置为 `os.Stdout` 的副本，即一个指向代表进程标准输出的 `os.File` 类型的指针。

一般来讲，在编译的时候，我们无法知道一个接口值的动态类型是什么，所以通过接口来做调用必然需要使用动态分发。编译器必须生成一段代码来从类型描述符拿到名为 Write 的方法地址，再简介调用该方法地址。调用的接收者就是接口值的动态值，即：os.Stdout，所以下面这两种调用时等价的：

```go
w.Write([]byte("hello"))
os.Stdout.Write([]byte("hello"))
```

第三个语句把一个 `*bytes.Buffer` 类型的指针值赋给了接口值：

```go
w = new(bytes.Buffer)
```

动态类型现在就是 `*bytes.Buffer`，动态值现在则是一个指向新分配缓冲区的指针。

最后，第四个语句把 nil 赋给了接口值，这个语句把动态类型和动态值都设置为 `nil`，把 w 恢复到了它刚声明时的状态。


**接口值是可以用 `==` 和 `!=` 进行比较的**。如果两个接口值都是 `nil` 或者二者动态类型完全一致且二者动态值相等，那么两个接口值是相等的。因为接口是可以作比较的，所以他们可以作为 map 的键。

注意：**含有空指针的非空接口**

空的接口值（其中不包含任何信息，动态值和动态类型都为nil）与仅仅动态之为nil的接口值是不一样的。

考虑如下程序，当 `debug` 设置为 `true` 时，主函数收集函数`f`的输出到一个缓冲区：

```go
const debug = true

func main() {
    var buf *bytes.Buffer
    if debug {
        buf = new(bytes.Buffer)
    }
    f(buf)
    if debug {
        // ... 使用buf...
    }
}

func f(out io.Writer) {
    if out != nil {
        out.Write([]byte("done!\n"))
    }
}
```

但当`debug`设置为`false`的时候，程序在`out.Write([]byte("done!\n"))`崩溃，我们来分析一下：

开始的`var buf *bytes.Buffer`将`buf`的动态类型设置为`*bytes.Buffer`，但是动态值为`nil`;

在进行`if out != nil` 判断的时候，这个表达式返回`true`，因为只有在动态值和动态类型都为`nil`的情况下才返回`false`，这个时候去调用`out.Write`, 像之前说的，调用任何`nil`的方法都会导致崩溃。

怎么改呢？答案就是把`var buf *bytes.Buffer`改为`var buf io.Writer`;


### 类型断言

类型断言是一个作用在接口值上的操作，写出来类似于：`x.(T)`，其中x是一个类型，而`T`是一个具体类型（称为断言类型），类型断言会检查操作数的动态类型是否满足指定的断言类型；

这儿有两个可能，首先如果断言类型 `T` 是一个具体类型，那么类型断言会检查`X`的动态类型是否**就是T**，如果检查成功，类型断言的结果就是`x`的动态值，型当然就是T了；**换句话说，类型断言就是同来从它的操作数中把具体类型的值提取出来的操作。如果检查失败，操作崩溃。**比如：

```go
var w io.Writer
w = os.Stdout
f := w.(*os.File)       // 成功： f == os.Stdout
c := w.(*bytes.Buffer)  // 崩溃，接口持有的是*os.File而不是*bytes.Buffer
```

其次，如果断言类型`T`是一个`接口类型`，那么类型检查`X`的动态类型是都**满足T**。如果检查成功，动态值并没有提取出来，结果仍然是一个接口值，接口值的类型和值部分也没有变更，只是结果的类型为接口类型。**换句话说，类型断言是一个接口值表达式，从一个接口类型变为拥有另一套方法的接口类型，但保留了接口值中的动态类型和动态值部分**。

如下类型断言代码中，`w`和`rw`都持有`os.Stdout`，于是所有对应的动态类型都是`*os.File`，但是`w`作为`io.Writer`类型，仅仅暴露了文件的`Write`方法，而rw好暴露它的`Read`方法。

```go
var w io.Writer
w = os.Stdout
rw := w.(io.ReadWriter) // 成功

w = new(ByteCounter)
rw := w.(io.ReadWriter)  // 崩溃
```

无论哪种类型作为类型断言，如果操作数是一个空的接口值，类型断言都会失败。很少需要从一个接口类型向一个要求更宽松的类型做类型断言，该宽松类型的接口方法比原类型的少，而且是其子集。

```go
w = rw  // io.ReadWRiter 可以赋给 io.Writer
w = rw.(io.Writer) // 仅当 rw == nil 时失败
```

我们经常无法确定一个接口值的动态类型，这时就需要检测它是否是某一个特定类型。如果类型断言出现在需要两个结果的表达式中，那么断言不会再失败时崩溃，而且会多返回一个布尔类型来指示断言是否成功。

```go
var w io.Writer = os.Stdout
f, ok := w.(*os.File)  // 成功：ok == true, f == os.Stdout
b, ok := w.(*bytes.Buffer) // 失败：ok == false, b == nil 
```

### 类型分支

接口有两种不同的风格。第一种风格下，典型的比如：`io.Reader,io.Writer,fmt.Stringer`，接口上的各种方法突出了满足这个接口的具体类型之间的相似性，但隐藏了各个具体类型的布局和各自特有的功能。这种风格强调了方法，而不是具体类型。

第二种风格则是充分利用了接口值能容纳各种具体类型的能力，他把接口作为这些类型的联合来使用。类型断言用来在运行时五分这些类型并分别处理。在这种风格中， 强调的是满足这个接口的具体类型，而不是这个接口的方法（何况经常没有）,也不注重信息隐藏。我们把这种风格的接口使用方式称为可识别联合。

一个`swtich`语句可以把包含一长串值相等比较的`if-else`语句简化掉。一个相似的类型分支语句则可以用来简化一长串的类型断言 `if-else` 语句。类型分支的简单形式与普通分支语句类似，两个的差别是操作数改为：`x.(type)`，**`type` 在这里是一个关键字，而不是具体类型，每个分支是一个或者多个类型**。类型分支的分支判定基于接口值的动态类型，其中`nil`分支需要 `x == nil`，而 `default` 分支在其他分支没有满足时才运行。

例如：
```go
switch x.(type) {
    case nil: // ...
    case int, uint: // ...
    case bool: //
    case string: //
    default: //
}
```

大多数时候我们需要将接口值提取到指定动态类型下的一个变量，我们可以这样做：
```go
switch x := x.(type) {/* ..... */}
```

这里把新的变量也命名为x，但是并不与外部语句块中的变量x冲突，新的变量x存在于switch新创建的词法块中。


### 使用案例

#### 使用`flag.Value`来解析参数

使用go开发应用程序的过程中，因为由于经常需要解析命令行参数，需求这么大，以至于官方专门开发`flag`包来处理这个事情；

```go
package main

import (
	"flag"
	"fmt"
	"time"
)

var period = flag.Duration("period", 1*time.Second, "sleep period")

func main() {
	flag.Parse()
	fmt.Printf("Sleeping for %v\n", *period)
	time.Sleep(*period)
	fmt.Println("end.")
}
```

我们可以这样使用：`go run flag.go --sleep 2s30ms`，合法的时间单位参考：`time.ParseDuration()` 方法注释；

为了能够支持扩展，使用自定义类型，`flag`包提供了一个`Value`接口，实现其即可；

```go
package flag

type Value interface {
    String() string  // 用于格式化标识对应的值
    Set(string) error // 解析传入的字符串参数并更新标识值
}
```

实现自定义温度参数：

```go
package main

import (
	"flag"
	"fmt"
)

type Celsius float64

type Fahrenheit float64

type celsiusFlag struct {
	Celsius
}

func CToF(c Celsius) Fahrenheit { return Fahrenheit(c*9/5 + 32) }

func FToC(f Fahrenheit) Celsius { return Celsius((f - 32) * 5 / 9) }

func (f *celsiusFlag) Set(s string) error {
	var unit string
	var value float64
	fmt.Sscanf(s, "%f%s", &value, &unit)
	switch unit {
	case "C", "°C":
		f.Celsius = Celsius(value)
		return nil
	case "F", "°F":
		f.Celsius = FToC(Fahrenheit(value))
		return nil
	}
	return fmt.Errorf("invalid temperature %q", s)
}

func (f *celsiusFlag) String() string {
	return fmt.Sprintf("%v°C", f.Celsius)
}

var temp celsiusFlag

func init() {
	flag.Var(&temp, "temp", "--temp 18°C")
}

func main() {
	flag.Parse()
	fmt.Println(temp.Celsius)
}
```

#### 使用sort.Interface来排序

与字符串格式化类似，排序也是一个在很多程序中广泛使用的操作。为了避免重写实现排序算法，go语言的`sort`包提供了针对任意序列根据人已排序函数原地排序的功能； 使用`sort.Interface`接口来指定通用排序算法和每个具体序列类型之间的协议（contract）。这个接口的实现确定了序列的具体布局（经常是一个slice）,以及元素期望的排序方式，

一个原地排序算法需要知道三个信息：`序列长度`，`比较两个元素的含义`以及`如何交换两个元素`，所以`sort.Interface`接口就有三个方法;

```go
package sort

type Interface interface{
    Len() int
    Less(i, j int) bool  // i, j是序列元素的下标
    Swap(i, j int)
}
```

要对序列排序，需要先确定一个实现了如上三个方法的类型，接着把`sort.Sort`函数应用到这类方法的实例上。考虑一个最简单的例子：`字符串slice`。  
定义的新类型StringSlice以及它的三个方法Len,Less,Swap如下：

```go
type StringSlice []string
func (p StringSlice) Len() int {return len(p)}
func (p StringSlice) Less(i, j int) bool {return p[i] < p[j]}
func (p StringSlice) Swap(i, j int) { p[i], p[j] = p[j], p[i]}
```

要对一个新的字符串slice排序，只需简单滴把一个`slice`转换为`StringSlice`类型即可，如下所示：`sort.Sort(StringSlice(names))`

类型转换生成了一个新的`slice`，与原始的`names`有同样的长度，容量以及底层数组，不同的就是额外增加了三个用于排序的方法。

考虑如下比较复杂的一个自定义类型：

```go
type Track struct {
    Title string
    Artist string
    Album string
    Year int
    Length time.Duration
}

var tracks = []*Track{
    {"Go", "Delilah", "From the roots up", 2012, length("3m38s")},
    {"Go", "Moby", "From the roots up", 2012, length("3m38s")},
    {"Go", "Alicia Keys", "From the roots up", 2012, length("3m38s")},
    {"Go", "Martin solveing", "From the roots up", 2012, length("3m38s")},
}

func length(s string) time.Duration {
    d, err := time.ParseDuration(s)
    if err != nil {
        panic(s)
    }
    return d
}
```

如果要按照Artist字段对播放列表tracks排序，需要先定义一个新的slice类型，以及必须的Len，Less和Swap方法。

```go
type byArtist []*Track
func (x byArtist) Len() int {return len(x)}
func (x byArtist) Less(i, j int) int {return x[i].Artist < x[j].Artist}
func (x byArtist) Swap(i, j int) { x[i], x[j] = x[j], x[i]}
```

要调用通用的排序历程，必须先把tracks转换为定义排序规则类型的新类型byArtist:

```go
sort.Sort(byArtist(tracks))
```

如果要对这些音乐按照反向排序，无需定义一个新的byReverseArtist类型和对应的反向Less方法，因为sort包已经提供了Reverse函数，它可以把任意的排序反向；

```go
sort.Reverse(yArtist(tracks)) // 假设已经调用了sort.Sort(byArtist(tracks))
```

如果要按照其他列来进行排序，就需要定义一个新的类型，比如byYear:

```go

type byYear []*Track

func (x byYear) Len() int {return len(x)}
func (x byYear) Less(i, j int) bool {return x[i].Year < x[j].Year}
func (x byYear) Swap(i, j int) {x[i], x[j] = x[j], x[i]}
```

如果对于每一类slice和每一种排序函数，都需要实现一个新的`sort.Interface`，那岂不是累死了；但是如我们上面看到，`Len`和`SWap`方法对所有的类型都是一样的。下面的例子中，具体类型`customSort`组合了一个`slice`和一个函数，让我们只写一个比较函数就可以定义一个系的新的排序。顺便说一下，实现`sort.Interface`的具体类型并不一定都是`slice`，比如`customSort`就是一个结构类型：

```go
type customSort struct {
    t []*Track
    less func(x, y *Track) bool
}

func (x customSort) Len() int {return len(x.t)}
func (x customSort) Less(i, j  int) bool {return x.less(x.t[i], x.t[j])}
func (x customSort) Swap(i, j) {x.t[i], x.t[j] = x.t[j], x.t[i]}

```

让我们定义一个多层的函数，先按照标题（Title）排序，接着是年份Year, 最后是时长Length。如下sort调用就是一个使用匿名排序函数来这样排序的例子：

```go
sort.Sort(customSort(tracks, func (x, y *Track) bool {
    if x.Title != y.Title {
        return x.Title < y.Title
    }

    if x.Year != y.Year {
        return x.Year < y.Year
    }

    if x.Length != y.Length {
        return x.Length < y.Length
    }

    return false

}))
```