---
title: Go语言基础《八》：函数
date: 2018-11-03 01:18:59
categories:
  - Go语言基础
tags:
  - 函数
---

在 Go 语言中，函数可是一等公民，函数也是一种数据类型。这意味着函数不但可以用于封装、分隔功能、解耦逻辑，还可以像普通的值一样，在函数间传递、赋予变量、做类型判断和转换等。更深层次的含义就是：**函数值可以成为能够被随意传播的独立逻辑组件**。

{% asset_img cover.jpg cover %}

<!--more-->


### 函数声明

每个函数都有一个名字，一个形参列表，一个可选的返回列表以及函数体：

```
func name(param-list) (return-list) {
    body
}
```

形参的列表指定了一组变量的参数名和参数类型，这些局部变量都由调用者提供的实参传递而来。返回列表则制定了返回值的类型。**当函数返回一个未命名的返回值或者没有返回值的时候，返回列表的圆括号可以省略**。如果一个函数没有返回值，那么设计这个函数的目的就是调用之后的附加效果。

```go
func hypot(x, y float64) float64 {
    return math.Sqrt(x*x + y*y)
}

fmt.Println(hypot(3, 4))
```

x, y是函数形参，3，4是函数调用的实参，并且返回一个类型为 `float64` 的值。**返回值也可以像形参一样命名，这个时候，每一个命名的返回值会声明为一个局部变量，并且根据变量类型初始化为响应的零值**。当函数存在返回值的时候，函数必须明确以`return`语句结束，除非确定函数不会走完整个执行流程。

上面的函数中使用到一种简写，如果几个参数或者返回值的类型相同，那么类型只需要写一次，所以下面的两个生命完全是相同的：

```
func(i, j, k int, s, t string) {}
func(i int, j int, k int, s string, t string) {}
```

函数的类型称作**函数签名**，函数签名就是函数形参列表和结果列表的统称，当两个函数拥有相同的形参列表以及返回列表时，认为这两个函数的签名相同。而形参和返回值的名称不会影响函数的类型。

需要谨记的是：**Go语言中没有默认参数这个概念，也不能指定实参名**，所以每一次调用函数都需要提供实参来对应函数每一个形参。形参列表和命名返回值都属于函数最外层作用域的局部变量。

实参是按值传递的，所以函数接受到的是每个实参的副本，修改形参不会影响调用者提供的实参。然而，如果提供的实参包含引用类型，比如指针，slice，map，函数或者通道，那么当函数使用形参变量时有可能简介修改实参。

总之，要说明的是，**函数是一等公民** 是函数式编程的重要特征。Go 在语言层面支持了函数式编程。

### 高阶函数

什么是高阶函数，简单地说，高阶函数需要满足下面的两个条件，只要满足其中一个，我们就可以说这个函数是一个高阶函数：

1. 接受其他的函数作为参数传入；
2. 把其他的函数作为结果返回；

我们接下来编写 `calculate` 函数来实现两个整数间的加减乘除运算，但是两个操作数和具体的函数都由调用方给出：

```go
type operate func(int, int) int

func calculate(x, y int, op operate) (int, error) {
	if op == nil {
		return 0, fmt.Errorf("invalid operate")
	}
	return op(x, y), nil
}

func main() {
	plus := func(m, n int) int {
		return m + n
	}
	minus := func(m, n int) int {
		return m - n
	}
	times := func(m, n int) int {
		return m * n
	}
	divide := func(m, n int) int {
		return m / n
	}
	fmt.Println(calculate(10, 5, plus))   // 15 <nil>
	fmt.Println(calculate(10, 5, minus))  // 5  <nil>
	fmt.Println(calculate(10, 5, times))  // 50 <nil>
	fmt.Println(calculate(10, 5, divide)) // 2  <nil>
	fmt.Println(calculate(10, 5, nil))    // 0 invalid operate
}
```


### 递归函数

函数可以递归调用，这意味函数可以直接或者间接地调用自己。递归是一种实用的技术，可以用来处理许多带有递归特性的数据结构。例如，我们常见求斐波那契数列：

```go
package main

import "fmt"

var caches = map[int]int{
	1: 1,
	2: 1,
}

func fib(n int) int {
	if _, ok := caches[n]; !ok {
		caches[n] = fib(n-1) + fib(n-2)
	}
	return caches[n]
}

func main() {
	fmt.Println(fib(10)) // 55
}
```

### 多返回值函数

 Go 语言中，一个函数能够返回不止一个结果，例如：

 ```go
 func swap(a, b int) (int, int) {
	return b, a
}

func main() {
	var a, b = 1, 2
	fmt.Println(swap(a, b)) // 2 1
}
```

习惯上，最后一个布尔返回值表示成功与否，一个 `error` 通常不需要额外说明。如果声明返回列表的时候制定了参数名，那么在函数中我们可以简单地以 `return` 结束函数，Go 会自动将每个命名返回结果按顺序返回：

```go

func swap(a, b int) (m int, n int) {
	m, n = b, a
	return
}

func main() {
	var a, b = 1, 2
	fmt.Println(swap(a, b)) // 2 1
}
```

### 函数变量

正如开篇提到的，函数是 Go 语言中的一等公民，函数变量也有类型，他们可以赋给变量，传递或者从函数中返回。函数类型由函数的形参列表和返回列表组成，函数名称并不影响函数类型。

```go
func square(n int) int {
	return n * n
}

func negative(n int) int {
	return -n
}

func product(m, n int) int {
	return m * n
}

func main() {
	f := square
	f = negative
    fmt.Println(f(9)) // -9
    
    f = product  // 编译错误，不能把类型 func(int, int) int 赋给 func(int) int
}
```

**函数类型的零值是 nil，调用一个空值的函数将导致宕机，函数变量可以和 nil 作比较，但他们本身不可以作比较，所以不能作为 map 的键**

### 匿名函数

命名函数只能在包级别的作用域进行声明，但我们能够使用函数字面量在任何表达式内指定函数变量。函数字面量就像函数声明，但在 func 关键字后面没有函数的名称，它是一个表达式，它的值为：**匿名函数**。函数字面量可以让我在需要的时候才去定义，例如：

```go
func main() {
	square := func(n int) int {
		return n * n
	}
	fmt.Println(square(9)) // 81
}
```

更重要的是，这种方式定义的函数能够获取到整个词法环境，因此里面的函数可以使用外层函数中的变量，如：

```go
package main

import "fmt"

func square() func() int {
	var x int
	return func() int {
		x++
		return x * x
	}
}

func main() {
	f := square()
	fmt.Println(f()) // 1
	fmt.Println(f()) // 4
	fmt.Println(f()) // 9
}

```

这里的 `square` 函数返回一个匿名函数，里层的匿名函数能够获取和更新外层 `square` 函数的局部变量。这些隐藏的变量引用就是我们把函数归为引用类型而且函数变量无法进行比较的原因。上面的例子中，当 `main` 函数中返回 `square` 函数后变量 `x` 依旧存在。这种机制在某些情况下可能会造成一些陷阱，假设一个程序创建一系列目录之后又必须删除它：

```go
var rmdirs []func()

for _, d := range tempDirs() {
    dir := d
    os.MkdirAll(dir, 0755)
    rmdirs = append(rmdirs, func(){
        os.RemoveAll(dir)
    })
}

// some operations

for _, rmdir := range rmdirs {
    rmdir()
}
```

你可能会很奇怪，这里为什么每次循环开始的时候，都要声明一个新的局部变量，而不是下面这样：

```go
var rmdirs []func()

for _, dir := range tempDirs() {
    os.MkdirAll(dir, 0755)
    rmdirs = append(rmdirs, func(){
        os.RemoveAll(dir) // 不正确
    })
}
```

这里错误的原因是循环变量的作用域的规则限制。上面的程序中， `dir` 在 `for` 循环引进的一个快作用内进行声明，在 `for` 循环中创建的所有函数都共享这个相同的变量 ———— 一个可访问的存储位置，而不是固定的值。`dir` 的值在不断的迭代中被不断的更新，因此当掉用清理函数时， `dir` 变量已经背一次的 `for` 循环更新多次。因此 `dir` 变量实际取值的是最后一次迭代时的值并且所有的 `os.RemoveAll` 调用都最终删除同一个目录。

我们通常引入一个新的变量来解决这个问题，就像 `dir` 变量是一个和外部变量同名的变量，只不过是一个副本，这看起来有些奇怪，但是确是一个关键性的声明：

```go
for _, dir := range tempDirs() {
    dir := dir
    // ....
}
```

### 变长函数

这里的变长的意思是函数的形参可以不固定个数，在调用的时候可以传入任意个参数。用过那么多的 `fmt.Printf` 应该有印象了吧。**在参数列表`最后一个`类型前面使用省略号 `...` 表示声明一个变长函数**：

```go
func sum(nums ...int) (total int) {
	for _, num := range nums {
		total += num
	}
	return total
}

func main() {
	fmt.Println(sum(1, 2, 3, 4, 5)) // 15
}
```

### 如何实现闭包

什么是闭包？本质上就是 **在一个内部函数中存在对 “外来标识符” 的应用**。所谓的外“外来标识符”，既不代表当前函数的任何参数或结果，也不是函数内部声明的，它是直接从外边拿过来。对于这种“外来标识符”，这里有个专门的术语，叫做 `自由变量`，可见它代表的肯定是个变量。实际上，它如果是个常量，那也就形不成闭包了，因为常量是不可变的程序实体，而闭包体现的却是程序由 “不确定” 变为 “确定” 的过程。我们说 **闭包** 正是因为引用了自由变量，而呈现了一种 “不确定” 的状态，也叫 “开放” 状态。也就是说，它的内部逻辑并不是完整的，有一部分逻辑需要这个自由变量参与，而后者到底代表了什么在闭包函数定义的时候确实未知的，即使对于 Go 这种静态类型的编程语言，我们在定义闭包的时候也仅仅是直到自由变量的类型。

这里引用百度百科的解释：闭包就是能够读取其他函数内部变量的函数，本质上，闭包是将函数内部和函数外部联系起来的桥梁。闭包中包含自由变量（未绑定到特定对象）变量，这些变量不是在这个代码块内或者全局上下文定义的，而是在定义代码块的环境中定义（局部变量）。**闭包** 一词来源于以下两者的结合：要执行的代码块（由于自由自由变量包含在代码块中，这些自由变量以及他们的引用对象并没有释放）和为自由变量提供绑定的计算环境。

```go
func genCalculator(op operate) calculateFunc {
	return func(x int, y int) (int, error) {
		if op == nil {
			return 0, errors.New("invalid operation")
		}
		return op(x, y), nil
	}
}

```

这里 `genCalculator` 只做了一件事，那就是定义一个匿名的、calculateFunc 类型的函数并把它作为结果返回。而这个匿名函数就是一个闭包函数，它里面使用的 op 变量既不代表它的任何参数或结果也不是它内部声明的，而是定义它的 `genCalculator` 函数的参数，所以是个自由变量。这个自由变量究竟代表了什么，这一点并不是在定义这个闭包函数的时候确定的，而是在调用 `genCalculator` 函数的时候确定的。只有给定了该函数的参数 op，我们才能知道它返回给我们的闭包函数可以用于什么运算。当执行到 `if op == nil` 这句时，Go 语言编译器试图寻找 op 所代表的东西，它发现 op 代表的是 `genCalculator` 的参数，然后，它会把两者结合起来，这时可以说，`op` 被捕获了，当程序运行到这里的时候，这个闭包函数的状态就由不确定变得确定，或者说到了闭合状态，至此也就形成了闭包。