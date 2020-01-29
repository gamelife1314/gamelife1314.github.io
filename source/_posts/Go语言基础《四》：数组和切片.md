---
title: Go语言基础《四》：数组和切片
date: 2018-10-29 22:57:26
categories:
  - Go语言基础
tags:
  - 切片
  - 数组
---

### 数组

数组是 **具有固定长度且拥有零个或者多个相同数据类型元素的序列**，由于数组长度固定，所以在Go里面很少直接使用的。然而 `slice` 的长度可以增长和缩短，在很多场合下使用的更多。

数组中的元素是通过索引来访问的，索引从0到数组长度减1。Go内置函数 `len` 可以返回数组中元素个数。一般情况下，一个新数组中的元素初始值为元素类型的零值，对于数字来说就是0，当然也可以用 **数组字面量** 来初始化一个数组。

```go
func main() {
	var a [3]int
	var b = [3]int{1, 2, 3} // 数组字面量
	fmt.Println(a) // [0 0 0]
	fmt.Println(b) // [1 2 3]
}
```
在数组字面量中，如果省略号`...`出现在数组长度的位置，那么数组的长度由其初始化元素的个数决定。所以上面的数组 `b` 可以简写为：

```go
func main() {
	var a [3]int
	var b = [...]int{1, 2, 3}
	fmt.Println(a) // [0 0 0]
	fmt.Println(b) // [1 2 3]
}
```

要注意的是：**数组的长度是数组类型的一部分，所以 `[3]int` 和 `[4]int` 是两种不同的数组类型**。数组的长度必须是常量表达式，也就是说必须在程序编译的时候就能确定。

<!--more-->

也可以在初始化数组的时候指定某个索引位置上的值，没有指定的位置就是元素类型的默认值：

```go
func main() {
	r := [...]int{5: -1}
	fmt.Println(r) // [0 0 0 0 0 -1]
}
```

如果一个数组的元素类型是可比较的，那么这个数组也是可比较的，这样我们就可以直接使用 `==` 来比较两个数组，比较的结果是两边元素的值是否完全相等，但是参与比较的两个数组必须是同等类型：长度一致且元素类型一致。

```go
func main() {
	a := [...]int{1, 2}
	b := [2]int{2, 3}
	c := [2]int{1, 2}
	fmt.Println(a == b, b == c, a == c) // false false true
}
```


Go 语言中，数组作为函数参数传入的时候，会传递一个副本，所以在函数中对这个数组做的所有修改都不会影响原数组。

```go
func updateArray(a [2]int) {
	a[0] = 999
	fmt.Println(a)  // [999 2]
}

func main() {
	a := [...]int{1, 2}
	updateArray(a)
	fmt.Println(a) // [1 2]
}
```

### Slice

`slice` 表示一个拥有相同类型元素的可变长度的序列，一般表示为：`[]T`，其中元素类型为 `T`，看上去就像没有长度的数组类型。数组和`slice`是紧密关联的，`slice` 是一种轻量级的数据结构，可以用来访问数组的部分或者全部的元素，而这个数组可以称之为`slice`的 **底层数组**。`slice` 有三个属性：指针，长度，容量。**指针**指向数组的第一个可以从slice中访问的元素，这个元素并不是数组的第一个元素。**长度**是指 `slice` 中元素的个数，它不能超过 `slice` 的容量。**容量** 的大小通常是从 `slice` 的其实元素到底层数组中最后一个元素间元素的个数。Go 的内置函数 `len` 和 `cap` 可以返回 `slice` 长度和容量。一个底层数组可以对应多个 `slice`，这些 `slice` 可以引用数组的任何位置，彼此之间的元素还可重叠。 

slice 操作符 `slice[i:j]` (其中 `0 <= i <= j <= cap(s)`) 创建了一个新的slice，这个新的slice引用了序列`s`中索引从 `i` 到 `j-1` 的元素，用区间来说，左闭右开 `[i, j)`，这里的`s`既可以是数组，指向数组的指针或者slice。总的元素个数是： `j - i`

```go
func main() {
	a := []int{1, 2, 3}     // 初始化slice
	b := [...]int{1, 2, 3}  // 初始化数组
	fmt.Printf("%T %[1]v %T %[2]v\n", a, b) // []int [1 2 3] [3]int [1 2 3]

	c := a[0:2]
	d := b[0:2]
	fmt.Printf("%T %[1]v %T %[2]v\n", c, d) // []int [1 2] []int [1 2]
}
```

请注意：如果 slice 引用超过了对象的容量，即 `cap(s)`，那么会导致程序宕机。但是如果 `slice` 的引用超出了被引用对象的长度，即 `len(s)` 那么最终的slice会比原slice长。

```go
func main() {
	a := []int{1, 2, 3, 4, 5, 6, 7}
	b := a[2:5]
	c := b[:5]
	fmt.Printf("len(b)=%d, leb(c)=%d\n", len(b), len(c)) // len(b)=3, leb(c)=5
	fmt.Printf("b=%v, c=%v", b, c)                       // b=[3 4 5], c=[3 4 5 6 7]
}
```

另外要注意的是，求字符串子串，和对字节slice(`[]byte`) 做slice操作这两者的相似性，他们都写作：`x[m:n]`，并且都返回原始字节的一个子序列，同时他们引用底层的方式也是相同的，所以两个操作都消耗常量时间。区别在于：如果x是字符串，那么`x[m:n]`返回的也是字符串，如果x是字节slice，那么返回的也是字节slice。

```go
func main() {
	name := "我是付登龙"
	nameByteSlice := []byte(name)
	fmt.Println(name[:3])          // 我
	fmt.Println(nameByteSlice[:3]) // [230 136 145]
}
```

因为slice包含了指向底层数组的指针，所以将一个slice传递给函数的时候，可以在函数内部修改底层数组的元素。

```go
func modifyDeepArray(nums []int) {
	nums[0] = 999
}

func main() {
	nums := [...]int{1, 3, 3, 4, 5, 6}
	numsRef := nums[:3]
	fmt.Println(nums) // [1 3 3 4 5 6]
	modifyDeepArray(numsRef)
	fmt.Println(nums) // [999 3 3 4 5 6]
}
```

另外要注意初始化slice和初始化数组的区别，slice 字面量看上去和数组字面量很像，都是用逗号分隔并且用花括号括起来的元素序列，但是slice没有指定长度。另外和数组不同的是，slice无法作比较，因此不能用 `==` 来比较两个slice是否拥有相同的元素。标准库里面提供了两个高度优化的函数 `bytes.Equal` 来比较两个字节slice `[]byte`。但是对于其他类型，必须自己实现。

```go
func compareIntSlice(a, b []int) bool {
	if len(a) != len(b) {
		return false
	}

	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}

	return true
}

func main() {
	origin := []byte("hello world")
	s1 := origin[:6]
	s2 := origin[:5]
	fmt.Println(bytes.Equal(s1, s2)) // false

	values := []int{1, 2, 3, 4, 5, 6}
	num := []int{1, 2}
	fmt.Println(compareIntSlice(values[:2], num[:2])) // true
}
```

唯一可以和slice作比较的是：`nil`，值为 `nil` 的 slice 没有对应的底层数组，长度和容量都为0，但是也有非nil的slice长度为0，例如：`[]int{}`。所以要想检查一个slice是否为空，那么使用 `len(s) == 0`，除了可以和 `nil` 作比较之外，值为 `nil` 的slice和长度为0的slice表现一样。

```go
func main() {
	var s []int
	// len(s)=0, cap(s)=0, (s==nil)=true
	fmt.Printf("len(s)=%d, cap(s)=%d, (s==nil)=%v\n", len(s), cap(s), s == nil)
	var a = []int{}
	// len(a)=0, cap(a)=0, (a==nil)=false
	fmt.Printf("len(a)=%d, cap(a)=%d, (a==nil)=%v\n", len(a), cap(a), a == nil)
}
```

### append 函数

既然说slice比数组好用，是因为数组的长度是固定的，而slice的长度是可变的，那么如何给slice追加元素？答案是：**append 函数**

```go
func main() {
	var runes []rune
	s := "hello，世界，你好"
	for _, c := range s {
		runes = append(runes, c)
	}
	fmt.Printf("%q", runes) // ['h' 'e' 'l' 'l' 'o' '，' '世' '界' '，' '你' '好']
}
```

在这个例子中，开始的时候 `runes` 的长度为0，到后面长度一直增加，那么这个长度增加的规律是什么呢？一旦一个切片无法容纳更多的元素，`append` 就会给这个切片扩容。但并不会改变原来的切片而是生成一个更大的切片，然后将所有元素和新元素拷贝到新的切片中。一般情况下，你可以认为新切片的容量将会是原切片容量的2倍。但是当原切片的长度大于等于1024时，`append` 将会以原切片的1.25倍作为新容量的基准。另外，如果一次要追加的元素过多，以至于比原容量的2倍还要多，那么新容量就会以新长度为基准。

切片的底层数组什么时候被替换？这个问题其实是个坑，确切的说，一个切片的底层数组永远不会被替换，因为，在扩容的时候，除了生成了新的底层数组，但也同时生成了新的切片，而没有对原切片和原数组做任何改动。


### copy 函数

`append` 函数用于向slice追加元素，而 **copy** 函数用于复制slice。

```go
func main() {
	var values = make([]int, 2)
	var num = []int{1, 2, 3}
	copy(values, num[:2]) // [1 2]
	fmt.Println(values)
}
```