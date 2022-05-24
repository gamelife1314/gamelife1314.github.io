---
title: 【Golang】map 是怎么实现的（未完）
date: 2022-05-22 16:53:18
tags:
  - map
categories:
  - golang
mathjax: true
---


`map` 的目的是设计一种数据结构来维护一个集合的数据，并且能够对集合进行增删改查，实现 `map` 主要有两种数据结构：`HashTable` 和 搜索树。

`HashTable` 会用一个 `hash` 函数将将 `key` 分配到不同的 `bucket` 中，因此，开销主要在 `hash` 函数计算 `key` 哈希值上，大多时候，`HashTable` 的性能还是很高的。不过 `HashTable` 一般会存在碰撞，或者说冲突的问题，就是不同的 `key` 被映射到了同一个 `bucket`，对于这个问题，一般由两种应对方法，链表法和开放寻址法：

- 链表法是将一个 `bucket` 实现成一个链表，落在同一个 `bucket` 中的 `key` 都会插入这个链表；
- 开放寻址法是在发生冲突时，根据一定的规律，在 `bucket` 后面选择一个空位用来放置新的 `key`；

搜索树一般会采用自平衡搜索树实现，包括：`AVL` 树，红黑树或者 `B-Tree`，搜索实现中的查找效率是 `O(logN)`，而 `HashTable` 平均查找效率是 `O(1)`，`hash` 函数如果设计良好，不会出现 `hash` 碰撞的情况。两者不同的，搜索树可以实现按照 `key` 的顺序遍历，而 `HashTable` 的顺序是随机的。

有的语言中用两种不同的数据结构实现了 `map`，就像 `Rust` 中的 [`std::collections::BTreeMap`](https://doc.rust-lang.org/std/collections/struct.BTreeMap.html) 和 [`std::collections::HashMap`](https://doc.rust-lang.org/std/collections/struct.HashMap.html)。

`Go` 语言中采用了 `HashTable` 的方式来实现 `map`，本文基于 `go1.18 darwin/arm64`。

<!-- more -->

### 底层结构

底层的数据结构在 [`src/runtime/map.go`](https://github.com/golang/go/blob/4aa1efed4853ea067d665a952eee77c52faac774/src/runtime/map.go#L116) 中，其中 `hmap` 是 `hashmap` 的缩写：

```rust
type hmap struct {
	count     int    // 元素个数，len(map) 会直接使用这个值
	flags     uint8  // 有四种取值：iterator，oldIterator，hashWriting 以及 sameSizeGrow，表明 hmap 当前的状态
	B         uint8  // buckets 数量的对数
	noverflow uint16 // approximate number of overflow buckets; see incrnoverflow for details
	hash0     uint32 // 使用 fastrand() 计算出的 hash 种子，计算 key 的哈希值时会传入 hash 函数

	buckets    unsafe.Pointer // 指向 buckets 数组的指针，buckets 的数量是 2^B，如果 count == 0 值为 nil
	oldbuckets unsafe.Pointer // 前一个 buckets 数组的一半大小，只有在增长时才是非零的
	nevacuate  uintptr        // 表示扩容进度，小于 nevacuate 的 buckets 完成扩容

	extra *mapextra // 可选字段
}
```

`buckets` 是一个指向 [`bmap`](https://github.com/golang/go/blob/4aa1efed4853ea067d665a952eee77c52faac774/src/runtime/map.go#L150) 数组的指针，`bmap` 的结构体如下所示：

```golang
type bmap struct {
	// tophash generally contains the top byte of the hash value
	// for each key in this bucket. If tophash[0] < minTopHash,
	// tophash[0] is a bucket evacuation state instead.
	tophash [bucketCnt]uint8
	// Followed by bucketCnt keys and then bucketCnt elems.
	// NOTE: packing all the keys together and then all the elems together makes the
	// code a bit more complicated than alternating key/elem/key/elem/... but it allows
	// us to eliminate padding which would be needed for, e.g., map[int64]int8.
	// Followed by an overflow pointer.
}
```

但是在编译时，编译器会重建这个结构体，[`bmap`](https://github.com/golang/go/blob/4aa1efed4853ea067d665a952eee77c52faac774/src/cmd/compile/internal/reflectdata/reflect.go#L91)会被重建成：

```golang
type bmap struct {
    topbits  [8]uint8
    keys     [8]keytype
    elems    [8]valuetype
    pad      uintptr
    overflow uintptr
}
```

`bmap` 就是常说的桶，桶里面最多会装 `8` 个 `KV` 对，这些 `key` 之所以会落入同一个桶，是因为它们经哈希计算之后，得到的哈希值的后 `B` 个 `bit` 位是相同的（后面再讨论 `bucket` 的定位过程），这用来决定将 `key` 放在哪一个桶中。而在桶内，又会根据哈希值的前 `8` 位来决定 `key` 放在哪个具体位置上，`hmap` 整体如下图所示：

![](Go-hmap-struct.png)

当 `map` 的 `key` 和 `elem` 都不包含指针，并且 `size` 都小于 `128` 字节的情况下，会把 `bmap` 标记为不包含指针，这样可以避免 `GC` 扫描整个 `hmap`，以提升效率。但是 `bmap` 因为有一个 `overflow` 字段，是指针类型的，破坏了 `bmap` 不包含指针的设计。这个时候会把 `overflow` 移动到 `extra` 字段中去，启用 `overflow` 和 `oldoverflow` 字段。

```go
type mapextra struct {
    // 如果 key 和 elem 都不包含指针并且是内联的，那么我们就把 bucket 类型标记为不包含指针。
    // 这样就可以避免扫描 map，然而，bmap.overflow 是一个指针。为了保持 overflow bucket 存活，我们在 hmap.extra。
    // overflow 和 hmap.extra.oldoverflow 中存储所有 overflow bucket 的指针。
    // overflow 和 oldoverflow 只在 key 和 elem 不包含指针时使用。overflow 包含 hmap.buckets 的 overflow buckets。
    // oldoverflow 包含 hmap.oldbuckets 的 overflow bucket。
    overflow    *[]*bmap
    oldoverflow *[]*bmap

    // 包含空闲的 overflow bucket，这是预分配的 bucket
    nextOverflow *bmap
}
```

`bmap` 是真正存放 `kv` 的地方，它的内存模型如下图所示：

![](Go-bmap-struct.png)

可以看到的 `key` 和 `elem` 不是存放在一起的，这样做的好处是在某些情况下可以省略调 `pad` 字段节省空间。例如，对于 `map[int64]int8` 这样的 `map`，如果按照 `key/elem/key/elem` 这样的形式组织，那么在每个 `key/elem` 之后都需要 `padding` `7` 个字节（为了防止[伪共享](https://en.wikipedia.org/wiki/False_sharing)），而使用 `key/elem/key/elem` 只需要在最后添加 `padding`。

每个 `bucket` 设计成最多只能存放 `8` 个 `kv` 对，如果超过，那就需要构建一个 `bucket`，并且通过 `overflow` 指针连接起来，这就是所谓的链表法。

### 创建过程

创建 `map` 有以下几种方式：

```go
func main() {
	// 1. 使用 make 创建但是不指定容量
	var numbers = make(map[string]int)
	numbers["hello"] = 1

	// 2. 使用 make 创建指定容量
	var numbers1 = make(map[string]int, 16)
	numbers1["hello"] = 1
	var numbers2 = make(map[string]int, 1024)
	numbers2["hello"] = 1

	// 3. 使用字面量创建
	var numbers3 = map[string]int{"hello": 1}
	_ = numbers3

	// 4. 创建 nil map
	var numbers4 map[string]int
	_ = numbers4 // 为 nil ，不能插入值，否则会panic
}
```

通过查看汇编代码，我们可以看到创建 `map` 实际调用的函数是 [`runtime.makemap`](https://github.com/golang/go/blob/4aa1efed4853ea067d665a952eee77c52faac774/src/runtime/map.go#L304)。

```go
// makemap implements Go map creation for make(map[k]v, hint).
// If the compiler has determined that the map or the first bucket
// can be created on the stack, h and/or bucket may be non-nil.
// If h != nil, the map can be created directly in h.
// If h.buckets != nil, bucket pointed to can be used as the first bucket.
func makemap(t *maptype, hint int, h *hmap) *hmap {

	// 计算 map 占用的内存是否溢出或者超出能分配的最大值
	mem, overflow := math.MulUintptr(uintptr(hint), t.bucket.size)
	if overflow || mem > maxAlloc {
		hint = 0
	}

	// 初始化 map 以及随机数种子
	if h == nil {
		h = new(hmap)
	}
	h.hash0 = fastrand()

	// 根据传入的 hint 计算出最少需要的桶的数量
	B := uint8(0)
	for overLoadFactor(hint, B) {
		B++
	}
	h.B = B

	// 如果 h.B == 0，在赋值的时候初始化
	// 否则调用 makeBucketArray 创建用于保存桶的数组
	if h.B != 0 {
		var nextOverflow *bmap
		h.buckets, nextOverflow = makeBucketArray(t, h.B, nil)
		if nextOverflow != nil {
			h.extra = new(mapextra)
			h.extra.nextOverflow = nextOverflow
		}
	}

	return h
}
```

而在 [`runtime.makeBucketArray`](https://github.com/golang/go/blob/4aa1efed4853ea067d665a952eee77c52faac774/src/runtime/map.go#L345) 中：

- 当桶的数量小于 $2^4$ 时，由于数据较少，创建溢出桶的可能性较低，会省略部分创建过程，以减少开销；
- 当桶的数量大于 $2^4$ 时，会额外创建一些溢出桶；

### 哈希函数

