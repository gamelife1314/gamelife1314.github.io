---
title: Go语言基础《十四》：控制结构
date: 2018-11-08 20:45:17
categories:
  - Go语言基础
tags:
  - 控制结构
---

请猜一下下面这段代码的输出：

```go
package main

import (
	"fmt"
)

func main() {
	numbers2 := [...]int{1, 2, 3, 4, 5, 6}
	maxIndex2 := len(numbers2) - 1
	for i, e := range numbers2 {
		if i == maxIndex2 {
			numbers2[0] += e
		} else {
			numbers2[i+1] += e
		}
	}
	fmt.Println(numbers2)
}
```

<!--more-->

### for ... range

我们来揭晓答案，`[7 3 5 7 9 11]`，在探索原因之前，我们来说明 `for ... range` 两个关键要注意的地方：

1. `range` 表达式只会在 `for` 语句开始的时候求值一次，无论之后有多少次迭代；
2. `range` 表达式的求值结果会被复制，也就是说，被迭代的对象是 `range` 表达式的副本而非原值；

看着这两点，没猜对答案的人应该已经知道答案了吧，那么我们把里面的 `numbers2` 改成切片，结果又是什么样子呢？

```go
package main

import (
	"fmt"
)

func main() {
	numbers2 := []int{1, 2, 3, 4, 5, 6}
	maxIndex2 := len(numbers2) - 1
	for i, e := range numbers2 {
		if i == maxIndex2 {
			numbers2[0] += e
		} else {
			numbers2[i+1] += e
		}
	}
	fmt.Println(numbers2)
}
```

答案是：`[22 3 6 10 15 21]`，你又猜对没？因为这次 `numbers2` 是切片，迭代开始求值的时候虽背复制，但是它复制的只是一个指针，和 `numbers2` 一样，指向的仍然是同一个底层数组，所以每次修改，都是在修改原来的底层数组。

### switch ... case

同样，我们先来看一段代码：

```go
package main

import (
	"fmt"
)

func main() {
	value1 := [...]int8{0, 1, 2, 3, 4, 5, 6}
	switch 1 + 3 {
	case value1[0], value1[1]:
		fmt.Println("0 or 1")
	case value1[2], value1[3]:
		fmt.Println("2 or 3")
	case value1[4], value1[5], value1[6]:
		fmt.Println("4 or 5 or 6")
	}
}
```

这段代码实际执行的时候无法通过编译，这是为什么呢？因为 `switch` 表达式的执行规则是这样的，只有它和 `case` 表达式中任意一个子表达式结果值相等，该 `case` 表达式下面的 `case` 子句就会就会被选中执行，正因为这里存在判断相等的操作，所以 **`switch` 语句对 `switch` 表达式的结果类型以及各个 `case` 表达式中子表达式的结果类型都是由要求的，因为在 Go语言中，只有类型相同的值之间才能进行判等操作**。如果 `switch` 表达式的结果是无类型的常量，那么这个结果就会被自动转换为此种常量的默认类型，比如 `1 + 3` 的结果类型是 `int`，又比如浮点数是 `float64`，而由于 `case` 子句中表达式的结果类型是 `int8`，类型不同，无法比较，所以无法编译通过。


再看一段代码：

```go
package main

import (
	"fmt"
)

func main() {
	value2 := [...]int8{0, 1, 2, 3, 4, 5, 6}
	switch value2[4] {
	case 0, 1:
		fmt.Println("0 or 1")
	case 2, 3:
		fmt.Println("2 or 3")
	case 4, 5, 6:
		fmt.Println("4 or 5 or 6")
	}
}
```

这一段代码是可以编译通过，因为 `switch ... case` 语句中还有一条规则：**如果 `case` 子句的表达式是常量结果，那么他会自动转换为 `switch` 表达式的结果类型。当然了，如果没转换成功，那么也是无法通过编译的**。

我们继续看一段代码：

```go
package main

import (
	"fmt"
)

func main() {
	value3 := [...]int8{0, 1, 2, 3, 4, 5, 6}
	switch value3[4] {
	case 0, 1, 2:
		fmt.Println("0 or 1 or 2")
	case 2, 3, 4:
		fmt.Println("2 or 3 or 4")
	case 4, 5, 6:
		fmt.Println("4 or 5 or 6")
	}

}

```

这段代码也是无法通过编译的，原因是这样的：**`switch` 语句在对 `case` 子句的选择上是具有唯一性的**。正因为如此，**`switch` 语句不允许 `case` 表达式中的子表达式结果值存在相等的情况，不论这些结果值相等的子表达式是否存在与相同的 `case` 表达式中，不过只针对结果值为常量的表达式**。正如下面这段代码是可以通过编译的：

```go
package main

import (
	"fmt"
)

func main() {
	value5 := [...]int8{0, 1, 2, 3, 4, 5, 6}
	switch value5[4] {
	case value5[0], value5[1], value5[2]:
		fmt.Println("0 or 1 or 2")
	case value5[2], value5[3], value5[4]:
		fmt.Println("2 or 3 or 4")
	case value5[4], value5[5], value5[6]:
		fmt.Println("4 or 5 or 6")
	}
}
```
