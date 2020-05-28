---
title: Go 反射系统
date: 2020-05-22 23:26:31
tags:
---

反射让我们能在运行期间弹指对象的类型信息和内存结构，这从一定程度上弥补了静态语言在动态行为上的不足。同时，反射也是实现元编程的重要手段。

{% asset_img cover.jpg cover %}

<!--more-->

和 C 数据结构一样，Go 对象头部并没有类型指针，通过其自身是无法在运行期间获知任何类型相关信息的。反射操作需要的全部信息都源自接口变量，接口变量除了存储自身类型外，还会保存实际对象的类型数据，所以在开始反射之前，先一探接口的实质。

### 接口类型

#### 基本规则

接口有时候也被称作协议（ptotocol），代表一种调用契约，是多个方法的集合。接口解除了类型依赖，有助于减少用户可视方法，屏蔽内部结构和实现细节。接口最常用的常见用途是用来约定对外的访问方式。

Go 的接口类型实现很简洁，只要目标类型实方法集包含了接口声明的全部方法，就相当于实现了该接口，无需做显示的声明。这种方式导致我们在使用 Go 的接口时，经常是先实现类型，再去抽象出接口。这么设计是相当有好处的，因为在一开始设计出合理的接口是非常不容易的，又或者是在使用第三方库的时候，将所需的功能抽象出接口，即可屏蔽太多不需要关注的内容，也可用于日后功能替换。

Go 的接口从内部实现来看，接口自身也是一种结构体类型，只是编译器会对它做出很多限制：

- 不能有字段
- 不能定义自己的方法
- 只能声明方法，不能实现
- 可以嵌入其他的接口类型

Go 的结构体定义是在 `runtime/runtime2.go` 文件中：

```go
type iface struct {
	tab  *itab
	data unsafe.Pointer
}
```

如果一个接口没有任何方法声明，那么它就是一个空接口（`interface{}`），它的用途类似面向对象里面的 `Object` 类型，可以被赋值任何类型的对象。有一点是比较重要的，接口的默认值是：**`nil`**，只有在实现接口类型支持的情况下才可以做相等运算。

```go
func Test_interface_equal_operation(t *testing.T) {
	var t1, t2 interface{}
	println(t1 == t2)
	t1, t2 = 100, 100
	println(t1 == t1)
	t1, t2 = map[string]int{}, map[string]int{}
	println(t1 == t2)
}
```
运行这个测试案例是会 `panic` 的，因为 `map` 类型是不支持比较的：

![接口比较](interface_compare.png)

因为不支持重载，所以在包含其他接口类型时候，同名的方法是不被允许的，也不能导入自身。Go 中也是支持匿名接口类型的，可直接用于变量定义或者作为结构体字段类型。

```go
type data struct{}

func (d data) string() string {
	return ""
}

type node struct {
	data interface {
		string() string
	}
}

func Test_anonymous_interface(t *testing.T) {
	var i interface {
		string() string
	} = data{}
	n := node{
		data: i,
	}
	println(n.data.string())
}
```

#### 执行机制

接口是使用一个名为 itab 的结构体存储运行期间所需的相关类型信息：

```go
type iface struct {
	tab  *itab
	data unsafe.Pointer
}
type itab struct {
	inter *interfacetype
	_type *_type
	hash  uint32 // copy of _type.hash. Used for type switches.
	_     [4]byte
	fun   [1]uintptr // variable sized. fun[0]==0 means _type does not implement inter.
}
type eface struct {
	_type *_type
	data  unsafe.Pointer
}
```

利用调试器，可以查看这些结构存储的具体内容，下面是我们的示例代码：

```go
package main

import "fmt"

type Reader interface {
	Read(string)
}

type People struct {
	name string
}

func (p People) Read(s string) {
	fmt.Println(p.name, "I'm reading", s)
}

func main() {
	p := &People{name: "michael"}
	p1 := People{name: "jiujiu"}
	var r Reader = p
	var r1 Reader = p1
	fmt.Printf("p: %p, p1: %p\n", p, &p1)
	r.Read("hello world")
	r1.Read("hello world")
}
```

使用如下的命令编译（工作机：MacOS，Mac上调试有问题，编译好之后扔到linux调试）：

> GOOS=linux go build -gcflags="-N -l" -o main_linux  main.go

然后复制到我的 Ubuntu 容器中调试：

> docker cp ./main_linux 913ecec6c8c3:/workdir/

![gdb调试](gdb-interface.png)

从结果中我们可以看出，当把值赋值给接口变量时，是会发生值复制的，指针类型变量复制的是地址，非指针类型变量会复制出一个新的对象然后填充到 `iface` 中的 `data` 字段。而且，我们甚至无法修改接口存储的非指针类型复制品，因为它是 unaddressable 的，所以想要修改接口存储的值就必须给它赋值一个指针。

![接口赋值](unaddressable-iface.png)

还有一个需要注意的是，只有 iface 中 `tab` 和 `data` 都为 nil 时，接口才等于 nil。

```go
package main

import "fmt"

func main() {
	var t interface{} = nil
	var t1 interface{} = (*int)(nil)
	fmt.Println(t == nil, t1 == nil)
}
```

编译并且使用 GDB 调试结果如下：

![空接口](empty-interface.png)

而且发现空接口在运行时的表示是 `eface` 结构体。

