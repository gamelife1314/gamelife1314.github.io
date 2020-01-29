---
title: Go语言基础《十一》：结构体及其方法
date: 2018-11-04 10:44:11
categories:
  - Go语言基础
tags:
  - struct
---

{% asset_img cover.jpeg cover %}

<!-- more -->

### 结构体

`结构体`是 **将零个或者多个任意类型的命名变量组合在一起的聚合类型**，每个变量叫做结构体的 **成员**。例如：

```go
type Employee struct {
	ID        int
	Name      string
	Address   string
	Dob       time.Time
	Position  string
	Salary    float64
	ManagerId int
}
```

成员访问需要通过成员访问操作符：**`.`**：

```go
func main() {
	var superMan = Employee{
		ID:        10001,
		Name:      "superMan",
		Address:   "中国上海",
		Dob:       time.Now(),
		Position:  "搬砖",
		salary:    10,
		ManagerId: 100001,
	}
	fmt.Println(superMan.Name) // superMan
}
```

<!--more-->

前面说过，结构体是将多个 **变量** 聚合在一起，那么既然是变量，我们就可以获取成员的地址，然后通过地址访问：

```go
position := &superMan.Position
fmt.Println(*position) // 搬砖
```

结构体成员变量通常一行写一个，变量的名称写在类型的前面，但是类型相同的连续成员变量可以写在一行上，就像上面的 Name 和 Address：

```go
type Employee struct {
	ID            int
	Name, Address string
	Dob           time.Time
	Position      string
	salary        float64
	ManagerId     int
}
```

如果一个结构体的成员变量的名称是首字母大写的，那么这个变量时可导出的，这个是Go最主要的访问控制机制。一个结构体可以同时包含可导出和不可导出的变量。如上面 `Employee` 结构体中除了 `Employee` 之外都是可导出的。

命名结构体类型 S 不可以定义一个拥有相同结构体类型的 S 的成员变量，也就是一个聚合类型不可以包含他自己，但是 S 中可以定义一个 S 的指针类型，即 *S ，这样我们就可以创建一些递归数据结构，比如链表和树。

```go
type tree struct {
    value       int
    left, right *tree
}
```

#### 结构体字面量

结构体类型的值可以通过结构体字面量设置，即通过设置结构体成员变量来设置。有两种形式设置结构体成员变量：

1. 按照正确的顺序，为每个变量设定一个值；

    ```go
    type Point struct {X, Y int}
    p := Point{1, 2}
    ```

2. 通过指定部分或者全部成员变量的名称和值来初始化结构体变量，上面演示的就是第二种，也是比较常用的；

出于效率的考虑，大型的结构体通常都使用结构体指针的形式直接传递给函数或者从函数中返回，例如：

```go
func AddSalary(employee *Employee) {
	employee.Salary += 10
}

func NewEmployee() *Employee {
	return &Employee{}
}
```

#### 结构体比较

如果结构体里面的所有成员变量都可以比较，那么这个结构体就是可比较的，两个结构体比较可以使用 `==` 或者 `!=`。其中 `==` 操作符按照顺序比较两个结构体变量的成员变量，所以下面的两个输出语句是等价的：

```go
type Point struct { X, Y int}

q := Point{1, 2}
p := Point{2, 1}
fmt.Println(p.X == q.X && p.Y == q.Y)
fmt.Println(p == q)
```

和其他可比较的类型一样，可比较的结构体都可以作为map的键类型。

```go
func main() {
	var superMan = Employee{
		ID:        10001,
		Name:      "superMan",
		Address:   "中国上海",
		Dob:       time.Now(),
		Position:  "搬砖",
		Salary:    10,
		ManagerId: 100001,
	}
	hits := map[Employee]int{}
	hits[superMan] = 1
	fmt.Println(hits[superMan]) // 1
}
```

#### 结构体嵌套和匿名成员

本节将讨论Go中不同寻常的结构体嵌套机制，这个机制可以让我们将一个命名结构体当做另一个结构体类型的匿名结构体成员使用；并提供了一种简便的语法，使用简单的表达式 `x.f` 就可以代表连续的成员 `x.d.e.f`。

想象一下 2D 绘图程序中会提供的关于形状的库，比如举行，椭圆，星形和车轮型。这里定义了其中两个可能存在的类型：

```go
type Circle struct {
	X, Y, Radius int
}

type Wheel struct {
	X, Y, Radius, Spokes int
}
```

但是我们发现这两个类型有很多重复的地方，我们可以将其剥离出来，否则在创建更多类型的时候，我们又要重复写很多代码，所以选择重构：

```go
type Point struct {
	X, Y int
}

type Circle struct {
	Point Point
	Radius int
}

type Wheel struct {
	Circle Circle
	Spokes int
}
```

Go 允许我们定义不带名称的结构体成员，只需要指定其类型即可；这种结构体成员称作 **匿名成员**，着个结构体成员的类型必须是一个命名类型或者指向命名类型的指针。

```go
type Circle struct {
	Point
	Radius int
}

type Wheel struct {
	Circle
	Spokes int
}
```

有了这种结构体嵌套的功能，我们可以直接访问需要的变量而不是指定一大串中间变量：

```go
var w Wheel
w.X = 8      // 等价于 w.Circle.Point.X
w.Y = 9      // 等价于 w.Circle.Point.Y
w.Radius = 4 // 等价于 w.Circle.Radius
w.Spokes = 100
fmt.Println(w.X, w.Y, w.Radius)
```

上面注释里面的方式也是正确的，但是使用匿名成员的说法或许不合适，上面结构体成员 `Circle` 和 `Point` 是有名字的，就是对应类型的名字，只是这些名字在点号访问变量的时候是可选的。当我们访问最终需要的变量的时候可以省略中间所有的匿名成员。

遗憾的是，结构体字面量并没有什么快捷方式来初始化结构体，所以下面的语句是无法通过编译的：

```go
w = Wheel{8, 8, 5, 20}
w = Wheel{X: 8, Y: 8, Radius: 5, Spokes: 20}
```

结构体字面量必须遵循形状类型的定义，所以我们使用下面的两种方式来初始化，这两种方式是等价的：

```go
w1 := Wheel{Circle{Point{1, 2}, 5}, 20}
w2 := Wheel{
    Circle: Circle{
        Point: Point{
            X: 1,
            Y: 2,
        },
        Radius: 3,
    },
    Spokes: 23,
}
fmt.Printf("%#v\n", w1) // main.Wheel{Circle:main.Circle{Point:main.Point{X:1, Y:2}, Radius:5}, Spokes:20}
fmt.Printf("%#v\n", w2) // main.Wheel{Circle:main.Circle{Point:main.Point{X:1, Y:2}, Radius:5}, Spokes:20}
```

因为 “匿名成员” 拥有隐式的名字，所以你不能在一个结构体里面定义两个相同类型的匿名成员，否则会起冲突。由于匿名成员中的名字是由他们的类型决定的，因此他们的可导出性也是由他们的类型决定的。上面的例子中，`Point` 和 `Circle` 这两个匿名成员是可导出的。既是这两个结构体是不可导出的（point 和 circle)，我们仍然可以使用快捷方式：

    w.X = 8 // 等价于 w.circle.point.X

但是注释中的那种显示指定中间匿名成员的方式在声明 `circle` 接 `point` 的包外是不允许的，因为他们是不可导出的。

#### 屏蔽匿名成员的值

正如前面提到，我们可以在一个结构体类型中嵌入另一个结构体作为自己的一个变量，而且，还可以像访问自己的成员一样，访问内嵌结构体的成员：

```go
var w Wheel
w.X = 8      // 等价于 w.Circle.Point.X
w.Y = 9      // 等价于 w.Circle.Point.Y
```

这里由于 `Wheel` 类型中没有 `X` 这个成员变量，它就会去寻找 `w.Circle.Point.X`，但是一旦 `Wheel` 类型中有一个叫做 `X` 的成员变量，`w.X` 访问的其实 `Wheel` 中的，这时候我们说 `w.X` **屏蔽** 了 ` w.Circle.Point.X`。

### 方法

尽管没有统一的面向对象编程的定义，对我们来说，对象就是简单的一个值或者变量，并且拥有其方法，而方法是某种特定类型的函数。面向对象编程就是使用方法来描述每个数据结构的属性和操作。

#### 方法声明

方法的声明和普通的函数类似，只是在函数名字前面多了一个参数，这个参数把这个方法绑定到这个参数对应的类型上。

```go
type Point struct {
	X, Y float64
}

func Distance(p, q *Point) float64 {
	return math.Hypot(q.Y-p.Y, q.Y-p.Y)
}

func (p *Point) Distance(q *Point) float64 {
	return math.Hypot(q.Y-p.Y, q.Y-p.Y)
}

```

附加的参数 p 称为方法的接收者，Go 语言中，接收者不使用特殊名称（self 或者 this），而是自己选择接收者的名字，最常用的方法就是去类型名称的首字母，就像 Point 中的 p。上面中的两个 `Distance` 并没有冲突，第一个声明一个包级别的函数，第二个声明一个类型 Point 的方法，因此它的名字是 `Point.Distance`，表达式 `p.Distance` 称作选择子（selector）。因为每一个类型有自己的命名空间，所以我们能够在其他不同类型中使用名字 `Distance` 作为方法名。

```go
type Path []Point

func (path Path) Distance() float64 {
	sum := 0.0
	for i := range path {
		if i > 0 {
			sum += path[i-1].Distance(&path[i])
		}
	}
	return sum
}
```

Path 是一个命名的 slice 类型，而非 Point 这样的结构退类型，但是我们依旧可以给他定义方法。Go 和 许多其他的面向对象语言不同，它可以将方法绑定到任何类型上。可以很方便地为简单的类型（如数字、字符串、slice、map、甚至函数）定义附加行为。同一个包下的任何类型都可以声明方法，只要他的类型既不是指针类型，也不是接口类型。

#### 指针接收者的方法

由于主调函数会复制每一个是参变量，如果函数需要更新一个变量，或者如果一个实参太大而我们希望避免复制整个实参，因此我们必须使用指针来传递变量的地址。这样同样适用于更新接收者：我们将它绑定到指针类型，比如：`*Point`。

```go
func (p *Point) ScaleBy(factor float64) {
	p.X *= factor
	p.Y *= factor
}
```

这个的方法的名字是：`(*Point).ScaleBy`；这里的圆括号是必须的，没有圆括号，表达式会被解析为：`*(Point.ScaleBy)`。习惯上遵循如果 Point 的任何一个方法使用指针接收者，那么所有的 Point 方法对应该使用指针接收者，即使这些方法不一定需要。命名类型 （`Point`）与指向他们的指针 （`*Point`）是唯一可以出现在接收者声明处的类型。**为防止混淆，不允许本身是指针类型进行方法声明**。

```go
type P *int
func (P) f() { /*...*/ } //编译错误
```

通过 `*Point` 能够调用 `(*Point).ScaleBy` 方法，比如：

```go
r := &Point{1, 2}
r.ScaleBy(2)
```

或者 

```go
p := Point{1, 2}
pptr := &p
pptr.ScaleBy(2)
```

或者

```go
p := Point{1, 2}
(&p).ScaleBy(2)
```

虽然最后两个用法看上去比较别扭，但也是合法的。如果接受者 `p` 是 `Point` 类型的变量，但方法要求一个 `*Point` 接收者，我们可以使用简写：

```go
p.ScaleBy(2)
```

实际上编译器会对变量进行 `&p` 的隐式转换。但是只有变量才允许这么做，包括结构体字段，像 `p.X` 和数组或者 slice 的元素，比如 `perim[0]`。不能够对一个不能取地址的 Point 接收者调用 *Point 方法，因为无法获取临时变量的地址。

```go
Point{1, 2}.ScaleBy(2)
```

感觉有点混乱，在合法的方法调用表达式中，只有符合下面三种形式的语句才能够成立：

1. 实参接收者和形参接收者是同一个类型；
2. 实参接收者是类型为 **`T`** 的变量，而接收者是 **`T`** 类型，编译器会隐式获取变量地址；
3. 实参接收者类型是 **`*T`**，而接收者是 **`T`** 类型，编译器会隐式解引用接收者；

**`nil` 是一个合法的接收者**

就像一些函数允许 nil 指针作为实参，方法的接收者也一样，尤其适当 nil 是类型中有意义的零值 （如 `map` 和 `slice`）时，更是如此。在下面这个简单的整型链表中，nil 代表空链表：

```go
package main

import "fmt"

type IntList struct {
	Value int
	Tail  *IntList
}

func (list *IntList) Sum() int {
	if list == nil {
		return 0
	}
	return list.Value + list.Tail.Sum()
}

func main() {
	var list IntList
	fmt.Println(list.Sum()) // 0
}
```

#### 方法变量与方法表达式

通常我们在相同的表达式里使用和调用方法，就像在 `p.Distance()` 中，但是把两个操作分开也是可以的。选择子 `p.Distance` 可以赋予一个变量，它是一个函数，把方法 (`Point.Distance`) 绑定到一个接收者上。函数只需要提供实参而不需要提供接收者就能够调用。

```go
package main

import (
	"fmt"
	"math"
)

type Point struct {
	X, Y float64
}

func (p Point) Distance(q Point) float64 {
	return math.Hypot(q.Y-p.Y, q.Y-p.Y)
}

func PointFromOrigin(f func(point Point) float64) float64 {
	return f(Point{})
}

func main() {
	p := Point{1, 2}
	q := Point{3, 4}
	distanceFromP := p.Distance
	fmt.Println(distanceFromP(q)) // 2.8284271247461903
	fmt.Printf("%T\n", distanceFromP) // func(main.Point) float64
	fmt.Println(PointFromOrigin(distanceFromP)) // 2.8284271247461903
}
```

与方法变量相关的是`方法表达式`，和调用一个普通的函数不同，在调用方法的时候必须提供接收者，并且按照选择子的方法调用。而方法表达式写成 `T.f` 或者 `(*T).f`，其中 T 是类型，是一种函数变量，把原来方法的接收者替换成原函数的第一个形参，因此它可以像平常的函数一样调用。

```go
package main

import (
	"fmt"
	"math"
)

type Point struct {
	X, Y float64
}

func (p Point) Distance(q Point) float64 {
	return math.Hypot(q.Y-p.Y, q.Y-p.Y)
}

func main() {
	p := Point{1, 2}
	q := Point{3, 4}

	distance := Point.Distance
	fmt.Println(distance(p, q)) // 2.8284271247461903
	fmt.Printf("%T", distance)  // func(main.Point, main.Point) float64
}
```

#### 封装

如果变量或者方法是不能通过对象访问到的，这称作封装的变量或者方法。Go语言中只有一种访问方式控制命名的可见性：定义的时候，首字母大写的标识符是可以导出的，而首字母没有大写的则不可导出。同样的机制也同样作用域结构体内的字段和类型中的方法。结论就是：**要封装一个对象，必须使用结构体**。

```go
type IntSet struct {
    words []uint64
}
```

这个定义和 `type IntSet []uint64` 看起来意义一样，但在访问控制上区别大着呢。结构体那种方式只能在本包内修改 `words` 这个slice，但是后面这种定义任何地方都可以。

另一个结论就是 **Go 语言中封装的单元是包而不是类型**。无论是在函数内的代码还是方法内的代码，结构体类型的子弹对于同一个包中的所有代码都是可见的。封装提供了三个优点：

1. 因为使用房不能直接修改对象的变量，所以不需要更多的语句来检查变量的值；
2. 隐藏实现袭击可以防止使用方依赖的属性发生改变，使得设计者可以更加灵活地改变 API 的实现而不破坏兼容性；
3. 防止使用者肆意改变对象内变量。


### Go 语言中使用嵌入字段实现了继承吗

这里说明一下，Go语言中没有继承的概念，他所做的是通过嵌入字段的方式实现了类型之间的组合，原理和理念请见：[Why is there no type inheritance?](https://golang.org/doc/faq#inheritance)。

简单来说，面向对象中的继承是通过牺牲一定的代码间接性来获取可扩展性，而且这种可扩展性是通过代码侵入来实现的。类型之间的组合采用的是非声明的方式，我们不需要显示声明某个类型实现了某个接口，或者一个类型继承了另一个类型。

同时，类型组合也是非侵入式的，它不会破坏类型的封装或加重类型之间的耦合。我们要做的只是把类型当做字段嵌入进来，然后坐享其成地使用嵌入字段所拥有的一切。如果嵌入字段有哪里不合心意，我们还可以用“包装”或“屏蔽”的方式去调整和优化。

另外，类型间的组合也是灵活的，我们总是可以通过嵌入字段的方式把一个类型的属性和能力“嫁接”给另一个类型。

这时候，被嵌入类型也就自然而然地实现了嵌入字段所实现的接口。再者，组合要比继承更加简洁和清晰，Go 语言可以轻而易举地通过嵌入多个字段来实现功能强大的类型，却不会有多重继承那样复杂的层次结构和可观的管理成本。

**接口类型之间也可以组合**。在 Go 语言中，接口类型之间的组合甚至更加常见，我们常常以此来扩展接口定义的行为或者标记接口的特征。与此有关的内容我在下一篇文章中再讲。

### 值方法和指针方法都是什么意思，有什么区别？

我们都知道，**方法的接收者类型必须是某个自定义的数据类型，而且不能是接口类型或接口的指针类型**。所谓的值方法，就是接收者类型是非指针的自定义数据类型的方法。那么指针方法就是接收者类型是自定义数据类型的指针类型。那么他们有什么不同呢？

1. 值方法的接收者是该方法所属的那个类型值的一个副本。我们在该方法内对该副本的修改一般都不会体现在原值上，除非这个类型本身是某个引用类型（比如切片或字典）的别名类型。而指针方法的接收者，是该方法所属的那个基本类型值的指针值的一个副本。我们在这样的方法内对该副本指向的值进行修改，却一定会体现在原值上。

2. 一个自定义数据类型的方法集合中仅会包含它的所有 `值方法`，而该类型的指针类型的方法集合却囊括了前者的所有方法，包括所有值方法和所有指针方法。严格来讲，我们在这样的基本类型的值上只能调用到它的值方法。但是，Go 语言会适时地为我们进行自动转义，使得我们在这样的值上也能调用到它的指针方法。

3. 一个类型的方法集合中有哪些方法与它能实现哪些接口类型是息息相关的。**如果一个基本类型和它的指针类型的方法集合是不同的，那么它们具体实现的接口类型的数量就也会有差异，除非这两个数量都是零。比如，一个指针类型实现了某某接口类型，但它的基本类型却不一定能够作为该接口的实现类型。**