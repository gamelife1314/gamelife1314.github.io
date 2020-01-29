---
title: Go 扩展包：unsafe
date: 2018-11-13 21:09:27
categories:
  - Go 标准库
tags:
  - Go
---
 
包 `unsafe` 是很神奇的，虽然它像普通的包那样并且像普通的包那样导入，但是事实上是由编译器实现的。它提供了对语言内置特性的访问功能，而这些特性一般是不可见的，因为他们暴露了 Go 详细的内存布局。把这些单独的函数放在一个包中，就使得它们的本来就不频繁的使用场合变得更加引入注目。包 unsafe 广泛使用在和操作系统交互的低级包（比如 runtime，os，syscall 和 net）中，但是普通程序从来不调用它。

<!--more-->

### `unsafe.Sizeof`

函数 `unsafe.Sezeof` 报告传递给它的参数在内存中占用的字节长度，这个参数可以是任何类型的表达式，不会计算表达式。Sizeof 调用返回一个 uintptr 类型的常量表达式，这个计算结果可以作为数组类型的维度或者用于计算其他的常量。

```go
import (
	"fmt"
	"unsafe"
)

func main() {
	r := unsafe.Sizeof(12)
	fmt.Printf("%T %[1]d", r)
}
```

> uintptr 8

### `unsafe.Pointer`

很多指针类型都写作 `*T`，意思是 “一个指向 T 类型变量的指针”。`unsafe.Pointer` 类型是一种特殊类型的指针，它可以存储 **任何变量** 的地址。当然，我们不能通过一个 `unsafe.Pointer` 变量来使用 `*p`，因为我们不知道这个表达式的具体类型。和普通的指针一样，`unsafe.Pointer` 类型的指针是可以比较的并且可以和 nil 比较，nil 是指针类型的零值。

一个普通的指针 `*T` 可以转换为 `unsafe.Pointer` 类型的指针，一个 `unsafe.Pointer` 类型的指针也可以转回普通的指针，而且可以不必和原来的类型相同，例如，我们将 `*float64` 类型的指针转换为 `*unint64` 类型的指针：

```go
package main

import (
	"fmt"
	"unsafe"
)

func main() {
	var num float64 = 2.4
	var uintNum uint64 = *(*uint64)(unsafe.Pointer(&num))
	fmt.Printf("%T %[1]d", uintNum)
}
```

> uint64 4612586738352862003

通过这种类型转换，可以让我们将任意值写入到内存中，因此这破坏了 Go 为我们构建的类型系统。

`unsafe.Pointer` 类型可以转换为 uintptr 类型，uintptr 类型保存了指针所指向地址的数值，这就可以让我们对地址进行数值计算。 uintptr 类型是一个足够大的无符号整数，可以用来表示任何地址，这种转换当然也可以反过来，但是这种转换也会破坏类型系统，因为并不是所有的数值都是合法的内存地址。

很多 unsafe.Pointer 类型的值都是从普通的指针到原始内存地址以及再从原始内存地址到普通指针转换的中间值。下面，我们演示一个例子，我们先获取变量 x 的地址，然后再加上成员 b 的地址偏移量，并将结果转换为 *int16 指针类型，接着通过这个指针更新 x.b 的值，注意这里 b 是一个不可导出的字段：

```go
package main

import (
	"fmt"
	"unsafe"
)

func main() {
	var x struct {
		a bool
		b int16
		c []int
	}
	pb := (*int16)(unsafe.Pointer(uintptr(unsafe.Pointer(&x)) + unsafe.Offsetof(x.b)))
	*pb = 24
	fmt.Printf("%T %d", pb, *pb)
}
```

> *int16 24