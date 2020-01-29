---
title: Go 扩展包：container
date: 2018-10-30 22:58:54
categories:
  - Go 标准库
tags:
  - container
---

### List(`container/list`)：双向链表

`container/list` 这个包公开了两个程序实体：`List` 和 `Element`，前者实现了一个双向链表，而后者则代表了双向链表的一个元素；

我们先看一下 `Element` 的声明：

```go
// Element is an element of a linked list.
type Element struct {
	// Next and previous pointers in the doubly-linked list of elements.
	// To simplify the implementation, internally a list l is implemented
	// as a ring, such that &l.root is both the next element of the last
	// list element (l.Back()) and the previous element of the first list
	// element (l.Front()).
	next, prev *Element

	// The list to which this element belongs.
	list *List

	// The value stored with this element.
	Value interface{}
}
```

`next` 和 `prev` 是两个 `*Element` 类型的指针，分别指向当前元素的前一个值和后一个值，`list` 是 `*List` 类型的，代表了当前元素属于哪个链表，`Value` 则代表了当前元素中存储的值，它是一个 `interface{}` 类型，可以存储任何类型的数据。

<!--more-->

再来看一下 `List` 的声明：

```go
// List represents a doubly linked list.
// The zero value for List is an empty list ready to use.
type List struct {
	root Element // sentinel list element, only &root, root.prev, and root.next are used
	len  int     // current list length excluding (this) sentinel element
}
```

包含一个 `Element` 类型的 `root`，以及表示长度的 `len`，`List` 可以做到 "开箱即用"，即声明之后即可使用，无需做其他操作，源自于它的延迟初始化，"延后初始化" 可以降低在程序启动时瞬间对CPU和内存的访问激增情况，而仅在需要的时候初始化，而这里 `List` 的初始化实际上是需要调用 `Init` 方法的，但是它是在 `PushFront`, `PushBack`, `PushBackList`, `PushFrontList` 中调用的，详情和可以源代码，这里初始化操作具体内容就是让 `root` 元素的 `prev, next` 都指向自己。

```go
import (
	"container/list"
	"fmt"
)

func main() {
	var l list.List
	first := l.PushFront(1)
	second := l.InsertAfter(2, first)
	fmt.Println(first.Value.(int))         // 1
	fmt.Println(second.Value.(int))        // 2
	fmt.Println(l.Front().Value.(int))     // 1
	fmt.Println(l.Back().Value.(int))      // 2
	fmt.Println(l.Len())                   // 2
	fmt.Println(first.Next().Value.(int))  // 2
	fmt.Println(second.Prev().Value.(int)) // 1

	// 遍历整个循环链接
	for e := l.Front(); e != nil; e = e.Next() {
		fmt.Println(e.Value.(int))
	}
}

```

### Ring(`container/ring`)：环

### Heap(`container/heap`)：堆

使用堆创建优先级队列

```go
package main

import (
	"container/heap"
	"fmt"
)

type Element struct {
	value    interface{}
	priority int
	index    int
}

type PriorityQueue []*Element

func (pq PriorityQueue) Len() int { return len(pq) }

func (pq PriorityQueue) Less(i, j int) bool { return pq[i].priority < pq[j].priority }

func (pq PriorityQueue) Swap(i, j int) {
	pq[i], pq[j] = pq[j], pq[i]
	pq[i].index = i
	pq[j].index = j
}

func (pq *PriorityQueue) Push(x interface{}) {
	n := len(*pq)
	ele := x.(*Element)
	ele.index = n
	*pq = append(*pq, ele)
}

func (pq *PriorityQueue) Pop() interface{} {
	old := *pq
	n := len(old)
	last := old[n-1]
	last.index = -1
	*pq = old[0 : n-1]
	return last
}

func main() {
	nums := [...]int{4, 1, 2, 2, 6, 8}
	pq := make(PriorityQueue, len(nums))
	for index, num := range nums {
		pq[index] = &Element{
			index:    index,
			value:    num,
			priority: num,
		}
	}
	heap.Init(&pq)
	fmt.Println(heap.Pop(&pq).(*Element).value.(int))
	fmt.Println(heap.Pop(&pq).(*Element).value.(int))
	fmt.Println(heap.Pop(&pq).(*Element).value.(int))
	fmt.Println(heap.Pop(&pq).(*Element).value.(int))
	fmt.Println(heap.Pop(&pq).(*Element).value.(int))
}
```