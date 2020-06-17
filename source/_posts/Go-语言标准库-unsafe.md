---
title: Go 扩展包：unsafe
date: 2018-11-13 21:09:27
categories:
  - Go 标准库
tags:
  - Go
---

看别人怎么说，然后自己试着做，最后再表达出来，这样才会理解。根据字面意思，unsafe 包提供的 unsafe.Pointer 不是类型安全的指针，我们可以通过它直接操作内存，绕过 Go 语言的很多限制，获取较高的执行效率，但是换来的是更高的风险。

<!--more-->

### unsafe.Pointer 类型

源代码中的 `unsafe.Pointer` 实现是这样的：

```go
type ArbitraryType int
// Pointer 代表任意类型的指针。 它支持四种特殊的操作（其他类型不支持）:
//	- 任意类型的指针可以被转换成 Pointer 类型；
//	- Pointer 类型可以转换成任意类型指针值；
//	- uintptr 类型的值可以转换成 Pointer类型；
//	- Pointer 类型可以转成 uintptr 类型；
// 所以说 Pointer 可以越过系统的类型检查去读写任何内存，使用的时候应该要极其小心。
//
// 使用 Pointer 的代码在今天或者未来将变得无效，
//
// Running "go vet" can help find uses of Pointer that do not conform to these patterns,
// but silence from "go vet" is not a guarantee that the code is valid.
//
// (1) 将 *T1 类型的值转换成 *T2 类型，这将重新解释 T1 类型的数据到 T2 类型
//
//  例如下面将 float64 类型的数据转换成 uint64 类型
//
//	func Float64bits(f float64) uint64 {
//		return *(*uint64)(unsafe.Pointer(&f))
//	}
//
// (2) 将 Pointer 类型转换成 uintptr，不转回 Pointer
//
// 将一个 Pointer 类型的值转换为 uintptr，将会生成指针所代表的内存地址，将会是一个整数，
// 通常用来打印。
//
// 通常情况下，将 uintptr 转换为 Pointer 是无效的，也没有什么意义，如果不是代表一个内存地址。
//
// uintptr 是一个整数，没有引用。将 Pointer 转换为 uintptr 将会去掉其自身的指针语义。
// 
// 即使uintptr拥有某个对象的地址，垃圾收集器也不会在对象移动时更新uintptr的值，也不会阻止对象被回收。
//
// (3) 将 Pointer 类型转换成 uintptr，进行数学运算，然后转回 Pointer
//
// 如果p指向已分配的对象，则可以通过转换为 uintptr、添加偏移量和转换回指针来通过该对象进行高级处理。
//
//	p = unsafe.Pointer(uintptr(p) + offset)
//
// 通常用来访问结构体字段或者数组元素：
//
//	// 等同于 f := unsafe.Pointer(&s.f)
//	f := unsafe.Pointer(uintptr(unsafe.Pointer(&s)) + unsafe.Offsetof(s.f))
//
//	// 等同于 e := unsafe.Pointer(&x[i])
//	e := unsafe.Pointer(uintptr(unsafe.Pointer(&x[0])) + i*unsafe.Sizeof(x[0]))
//
// 通过这种方式对指针进行加减运算是有效的，但是不管怎么样，最终它必须指向原始已分配内存的对象。
//
//	// INVALID: 指针运算结束的位置超出了分配的空间
//	var s thing
//	end = unsafe.Pointer(uintptr(unsafe.Pointer(&s)) + unsafe.Sizeof(s))
//
//	// INVALID: 指针运算结束的位置超出了分配的空间
//	b := make([]byte, n)
//	end = unsafe.Pointer(uintptr(unsafe.Pointer(&b[0])) + uintptr(n))
//
// 如果要将一个 uintptr 运算然后转回 Pointer，必须在同一个表达式中：
//
//	// INVALID: uintptr 在转回Pointer之前，不能被存储在变量中
//	u := uintptr(p)
//	p = unsafe.Pointer(u + offset)
//
// Pointer 必须要指向已经分配内存的对象，所以它不能是 nil
//
//	// INVALID: 空指针转换
//	u := unsafe.Pointer(nil)
//	p := unsafe.Pointer(uintptr(u) + offset)
//
// (4) 当调用 syscall.Syscall 时将 Pointer 转换为 uintptr.
//
// syscall 包中的系统调用直接将 uintptr 传递给操作系统，在某些调用的实现中，可能会将他们重新
// 解释为 Pointer。也就是系统调用显示地将某些 uintptr 转回 Pointer
//
// 如果一个 Pointer 在用作函数参数时，必须转换为 uintptr，那么这个转换必须出现调用表达式中：
//
//	syscall.Syscall(SYS_READ, uintptr(fd), uintptr(unsafe.Pointer(p)), uintptr(n))
//
// The compiler handles a Pointer converted to a uintptr in the argument list of
// a call to a function implemented in assembly by arranging that the referenced
// allocated object, if any, is retained and not moved until the call completes,
// even though from the types alone it would appear that the object is no longer
// needed during the call.
//
// For the compiler to recognize this pattern,
// the conversion must appear in the argument list:
//
//	// INVALID: uintptr cannot be stored in variable
//	// before implicit conversion back to Pointer during system call.
//	u := uintptr(unsafe.Pointer(p))
//	syscall.Syscall(SYS_READ, uintptr(fd), u, uintptr(n))
//
// (5) 将 reflect.Value.Pointer 或者 reflect.Value.UnsafeAddr 的结果从 uintptr 转换为 Pointer 
//
// Package reflect's Value methods named Pointer and UnsafeAddr return type uintptr
// instead of unsafe.Pointer to keep callers from changing the result to an arbitrary
// type without first importing "unsafe". However, this means that the result is
// fragile and must be converted to Pointer immediately after making the call,
// in the same expression:
//
//	p := (*int)(unsafe.Pointer(reflect.ValueOf(new(int)).Pointer()))
//
// As in the cases above, it is invalid to store the result before the conversion:
//
//	// INVALID: uintptr cannot be stored in variable
//	// before conversion back to Pointer.
//	u := reflect.ValueOf(new(int)).Pointer()
//	p := (*int)(unsafe.Pointer(u))
//
// (6) 将 reflect.SliceHeader 或者 reflect.StringHeader 的 Data 字段转换为 Pointer 或者从 Pointer 转换为 uintptr.
//
// As in the previous case, the reflect data structures SliceHeader and StringHeader
// declare the field Data as a uintptr to keep callers from changing the result to
// an arbitrary type without first importing "unsafe". However, this means that
// SliceHeader and StringHeader are only valid when interpreting the content
// of an actual slice or string value.
//
//	var s string
//	hdr := (*reflect.StringHeader)(unsafe.Pointer(&s)) // case 1
//	hdr.Data = uintptr(unsafe.Pointer(p))              // case 6 (this case)
//	hdr.Len = n
//
// In this usage hdr.Data is really an alternate way to refer to the underlying
// pointer in the string header, not a uintptr variable itself.
//
// In general, reflect.SliceHeader and reflect.StringHeader should be used
// only as *reflect.SliceHeader and *reflect.StringHeader pointing at actual
// slices or strings, never as plain structs.
// A program should not declare or allocate variables of these struct types.
//
//	// INVALID: a directly-declared header will not hold Data as a reference.
//	var hdr reflect.StringHeader
//	hdr.Data = uintptr(unsafe.Pointer(p))
//	hdr.Len = n
//	s := *(*string)(unsafe.Pointer(&hdr)) // p possibly already lost
//
type Pointer *ArbitraryType
```
源代码的注释中提供了丰富的注释，大部分已经翻译成中文，大家可以阅读一下。从命名来看， **Arbitrary** 是任意的意思，也就是说 **Pointer** 可以指向任意类型，实际上它类似于 C 语言里的 **void\***。

### unsafe.Sizeof(x ArbitraryType) uintptr

`Sizeof` 返回类型 x 所占据的字节数，但不包含 x 所指向的内容的大小。例如，对于一个指针，函数返回的大小为 8 字节（64位机上），一个 slice 的大小则为 slice header 的大小。

### unsafe.Offsetof(x ArbitraryType) uintptr

`Offsetof` 返回结构体成员在内存中的位置离结构体起始处的字节数，所传参数必须是结构体的成员。

### unsafe.Alignof(x ArbitraryType) uintptr

`Alignof` 返回 m，m 是指当类型进行内存对齐时，它分配到的内存地址能整除 m。同 `reflect.TypeOf(x).Align()` 返回值相同。

### 总结

unsafe 包提供了 2 点重要的能力：

- 任何类型的指针和 unsafe.Pointer 可以相互转换。
- uintptr 类型和 unsafe.Pointer 可以相互转换。

pointer 不能直接进行数学运算，但可以把它转换成 uintptr，对 uintptr 类型进行数学运算，再转换成 pointer 类型。

uintptr 并没有指针的语义，意思就是 uintptr 所指向的对象会被 gc 无情地回收。而 unsafe.Pointer 有指针语义，可以保护它所指向的对象在“有用”的时候不会被垃圾回收。

### 案例

#### string 和 []byte 的零拷贝转换

```go
func Example_bytes_to_string() {
	var b = []byte{'h', 'e', 'l', 'l', 'o'}
	fmt.Println(*(*string)(unsafe.Pointer(&b)))
	// output:
	// hello
}

func Example_string_to_bytes() {
	var s = "hello"
	fmt.Println(*(*[]byte)(unsafe.Pointer(&s)))
	// output:
	// [104 101 108 108 111]
}
```

#### 修改结构体字段值

```go
type programmer struct {
	name     string
	age      int
	language string
}

func Example_update_fields() {
	p := programmer{name: "michael", age: 26, language: "go"}
	fmt.Println(p)
	languagePtr := (*string)(unsafe.Pointer(uintptr(unsafe.Pointer(&p)) + unsafe.Sizeof(0) + unsafe.Sizeof("")))
	*languagePtr = "golang"
	fmt.Println(p)
	// output:
	//{michael 26 go}
	//{michael 26 golang}
}
```

通过这种方式，即使是结构体的未导出字段我们也可以修改，但是更加灵活的方式是使用 `relfect` 包提供的方法，根据字段名称找到对应字段的地址，负责字段挪个位置就不能修改了。
 
### 参考文章

1. [深度揭秘Go语言之 unsafe](https://mp.weixin.qq.com/s/OO-kwB4Fp_FnCaNXwGJoEw)