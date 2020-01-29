---
title: Go 扩展包：strings
date: 2018-11-13 23:39:14
categories:
- Go 标准库
tags:
- Go
---

{% asset_img cover.jpeg cover %}

<!-- more -->

### `strings.Builder`

和 `string` 相比，`strings.Builder` 有很多优势：

1. 已存在的内容不可变，但可以拼接更多的内容
2. 减少了内存分配的次数和内容拷贝的次数
3. 可将内容重置，可重用值

Builder 中有一个用于承载内容的容器，它是一个以 byte 为元素类型的切片。由于这样的字节切片的底层数组就是一个字节数组，所以我们可以说它与 string 值存储内容的方式是一样的。实际上，它们都是通过一个 `unsafe.Pointer` 类型的字段来持有那个指向了底层字节数组的指针值的。正是因为这样的内部构造，`Builder` 值同样拥有高效利用内存的前提条件。虽然，对于字节切片本身来说，它包含的任何元素值都可以被修改，但是 `Builder` 值并不允许这样做，其中的内容只能够被拼接或者完全重置。这就意味着，已存在于 `Builder` 值中的内容是不可变的。因此，我们可以利用 `Builder` 值提供的方法拼接更多的内容，而丝毫不用担心这些方法会影响到已存在的内容。这里所说的方法指的是，`Builder` 值拥有的一系列指针方法，包括：`Write`, `WriteByte`，`WriteRune`, `WriteString`。

```go
package main

import (
	"fmt"
	"strings"
)

func main() {
	var builder strings.Builder

	builder.WriteString("Go 爱好者")
	builder.Write([]byte("hello world"))
	builder.WriteByte('c')
	builder.WriteRune('哎')

	fmt.Println(builder.String())
	fmt.Println(builder.Len())

	builder.Reset()
	fmt.Println(builder.String())
	fmt.Println(builder.Len())
}
```

输出如下：

    Go 爱好者hello worldc哎
    27

    0

`strings.Builder` 类型在使用上是有约束的，再被真正使用后就不能被复制了，我们只要调用了它的拼接方法和扩容方法就意味着真正使用它了，一旦调用他们我们就不能再以任何方式对其所属值进行复制了，否则，只要在任何副本上调用就会引发 panic。不过，对于处于零值状态的 `Builder` 值就不会引发任何问题。

### `strings.Reader`

与 `strings.Builder` 类型恰恰相反，`strings.Reader` 类型是为了高效读取字符串而存在的。后者的高效主要体现在它对字符串的读取机制上，它封装了很多用于在 `string` 值上读取内容的最佳实践。`strings.Reader` 类型的值可以让我们很方便地读取一个字符串中的内容。在读取的过程中，`Reader` 值会保存已读取的字节的计数（以下简称已读计数）。已读计数也代表着下一次读取的起始索引位置。Reader 值正是依靠这样一个计数，以及针对字符串值的切片表达式，从而实现快速读取。此外，这个已读计数也是读取回退和位置设定时的重要依据。虽然它属于 Reader 值的内部结构，但我们还是可以通过该值的 Len 方法和 Size 把它计算出来的。代码如下：

```go
package main

import (
	"fmt"
	"strings"
)

func main() {
	var reader = strings.NewReader("Go 语言极致爱好者")

	if result, size, err := reader.ReadRune(); err != nil {
		fmt.Println(err)
	} else {
		fmt.Printf("%q %d\n", result, size)
		fmt.Printf("readerSize: %d, 未读字节：%d， 已读：%d\n", reader.Size(), reader.Len(), reader.Size()-int64(reader.Len()))
	}
}
```

输出如下：

    'G' 1
    readerSize: 24, 未读字节：23， 已读：1
