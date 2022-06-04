---
title: 【Golang】Interface 底层实现（未完）
date: 2022-06-03 14:25:18
categories:
  - golang
---

接口是高级语言中的一个规约，是一组方法签名的集合。`Go` 的 `Interface` 是非侵入式的，具体类型实现 `Interface` 不需要在语法上显式的声明，只需要具体类型的方法集合是 `Interface` 方法集合的超集，就表示该类实现了这一 `Interface`。编译器在编译时会进行 `Interface` 校验，`Interface` 和具体类型不同，它不能实现具体逻辑，也不能定义字段。

在 `Go` 语言中，`Interface` 和函数一样，都是第一公民，`Interface` 可以用在任何使用变量的地方。可以作为结构体内的字段，可以作为函数的形参和返回值，可以作为其他 `Interface` 定义的内嵌字段。`Interface` 在大型项目中常常用来解耦，在层与层之间用 `Interface` 进行抽象和解耦，使得抽象出来的代码特别简洁，这也符合 `Go` 语言设计之初的哲学。

先看一个易错的例子：

```go
package main

import "fmt"

func main() {
	var x interface{} = nil
	var y interface{} = (*int)(nil)
	fmt.Println(x == nil)
	fmt.Println(y == nil)
}
```

这将输出：

    true
    false

`Interface` 实际上包含两部分，类型和值。对于 `x` 而言，它的类型和值都是 `nil`，所以 `x == nil` 是 `true`；对于 `y`，它的类型是 `*int`，值是 `nil`，所以 `y == nil` 是 `false`。因此，我们在看 `Interface` 的时候，需要关注类型和值两部分。

<!-- more -->

### 底层实现

`Go` 语言中描述接口底层结构体的是 [`iface`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/runtime2.go#L202) 和 [`eface`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/runtime2.go#L207) 这两个结构体，其中 `iface` 表示非空结构体，`eface` 表示空结构体：

```go
type iface struct {
	tab  *itab
	data unsafe.Pointer
}

type eface struct {
	_type *_type
	data  unsafe.Pointer
}

type interfacetype struct {
	typ     _type
	pkgpath name
	mhdr    []imethod
}
```

代表 `tab` 字段的 [`*itab`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/runtime2.go#L885) 代表接口的类型和赋给这个接口的实体类型；字段 `data` 则指向接口具体的值，一般是一个指向堆内存的指针。

```go
type itab struct {
	inter *interfacetype
	_type *_type
	hash  uint32 // copy of _type.hash. Used for type switches.
	_     [4]byte
	fun   [1]uintptr // variable sized. fun[0]==0 means _type does not implement inter.
}
```

如上所述，`itab` 中有 `5` 个字段：

- `inter`：描述了接口的类型，它包装了 [`_type`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/type.go#L34)；还有一个表示接口定义的方法列表的的 `mhdr` 字段，以及 `pkgpath` 记录定义了接口的包名；

- `_type`：指得是赋给接口的变量的类型；
- `hash`：等同于 `_type` 中的 `hash` 字段，用于类型转换；
- `fun`： 保存一个函数指针，它指向的是具体类型的函数方法。虽然这里只有一个函数指针，但是它可以调用很多方法。在这个指针对应内存地址的后面依次存储了多个方法，利用指针偏移便可以找到它们；

由于 `Go` 语言是强类型语言，编译时对每个变量的类型信息做强校验，所以每个类型的元信息要用一个结构体描述。再者 `Go` 的反射也是基于类型的元信息实现的，[`_type`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/type.go#L34) 就是所有类型最原始的元信息。

```go
type _type struct {
	size       uintptr // 类型占用的内存大小
	ptrdata    uintptr // 包含这个类型中所有指针的内存前缀；
	hash       uint32  // 类型 hash
	tflag      tflag   // 标记位，用于反射
	align      uint8   // 
	fieldAlign uint8   // 当前结构体的字节对齐大小
	kind       uint8   // 基础类型枚举值，一共有26中，定义于 runtime/typekind.go 中
	// 该类型的比较函数，用于比较该类型的两个值是否相等
	equal func(unsafe.Pointer, unsafe.Pointer) bool
	// gcdata stores the GC type data for the garbage collector.
	// If the KindGCProg bit is set in kind, gcdata is a GC program.
	// Otherwise it is a ptrmask bitmap. See mbitmap.go for details.
	gcdata    *byte
	str       nameOff  // 类型名称字符串在二进制文件段中的偏移量
	ptrToThis typeOff  // 类型元信息指针在二进制文件段中的偏移量
}
```

`str` 和 `ptrToThis`，对应的类型是 `nameoff` 和 `typeOff`，这两个字段的值是在链接器段合并和符号重定向的时候赋值的。运行时类型名称和具体类型值由 [`runtime.resolveNameOff`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/type.go#L188) 和 [`runtime.resolveTypeOff`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/type.go#L222) 函数计算出来的。

其他的类型，如数组，`channel` 以及 `map` 在运行时也是基于 `_type` 这个元信息表示，它们除了表示类型表自身，还需要表示它的元素的类型，例如：

```go
type maptype struct {
	typ    _type
	key    *_type
	elem   *_type
	bucket *_type // internal type representing a hash bucket
	// function for hashing keys (ptr to key, seed) -> hash
	hasher     func(unsafe.Pointer, uintptr) uintptr
	keysize    uint8  // size of key slot
	elemsize   uint8  // size of elem slot
	bucketsize uint16 // size of bucket
	flags      uint32
}

type arraytype struct {
	typ   _type
	elem  *_type
	slice *_type
	len   uintptr
}

type chantype struct {
	typ  _type
	elem *_type
	dir  uintptr
}

type slicetype struct {
	typ  _type
	elem *_type
}

type functype struct {
	typ      _type
	inCount  uint16
	outCount uint16
}
```

相比起 `iface`，`eface` 就简单多了，它只需一个 `_type` 字段表示存储的具体值的类型和用于存储实际值的 `data`。


### 参考文章

1. [深入研究 `Go interface` 底层实现](https://halfrost.com/go_interface/)
2. [`Interface types`](https://go.dev/ref/spec#Interface_types)
