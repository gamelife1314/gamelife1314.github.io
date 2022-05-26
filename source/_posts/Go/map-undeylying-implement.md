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

`Go` 语言中采用了 `HashTable` 的方式来实现 `map`，并且使用链表法解决哈希冲突，本文基于 `go1.18 darwin/arm64`。

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
    // 这样就可以避免扫描 map，然而，bmap.overflow 是一个指针。为了保持 overflow bucket 存活，我们在 hmap.extra.overflow
    // 和 hmap.extra.oldoverflow 中存储所有 overflow bucket 的指针。
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

```go
// 假设 b = 8，map 的类型为 map[string]int
func makeBucketArray(t *maptype, b uint8, dirtyalloc unsafe.Pointer) (buckets unsafe.Pointer, nextOverflow *bmap) {
	base := bucketShift(b) // 那么 base = 256
	nbuckets := base       // nbuckets 此时为 256
	if b >= 4 {
		// 计算溢出桶的数量
		nbuckets += bucketShift(b - 4)  // nbuckets += (1 << (b - 4)) 值为 272
		sz := t.bucket.size * nbuckets  // t.bucket.size 为 208，sz = 56576
		up := roundupsize(sz)           // roundupsize 根据 sz 计算需要 56576 字节的内存时，mallocgc 需要申请 57344 字节
		if up != sz {
			nbuckets = up / t.bucket.size  // 根据需要申请的内存数量重新计算 nbuckets，将内存最大化利用，这里为：275
		}
	}

	if dirtyalloc == nil {
		buckets = newarray(t.bucket, int(nbuckets))
	} else {
		// dirtyalloc was previously generated by
		// the above newarray(t.bucket, int(nbuckets))
		// but may not be empty.
		buckets = dirtyalloc
		size := t.bucket.size * nbuckets
		if t.bucket.ptrdata != 0 {
			memclrHasPointers(buckets, size)
		} else {
			memclrNoHeapPointers(buckets, size)
		}
	}

	if base != nbuckets {
		// We preallocated some overflow buckets.
		// To keep the overhead of tracking these overflow buckets to a minimum,
		// we use the convention that if a preallocated overflow bucket's overflow
		// pointer is nil, then there are more available by bumping the pointer.
		// We need a safe non-nil pointer for the last overflow bucket; just use buckets.
		// 计算出第一个溢出桶的位置和最后一个溢出桶的位置
		nextOverflow = (*bmap)(add(buckets, base*uintptr(t.bucketsize)))
		last := (*bmap)(add(buckets, (nbuckets-1)*uintptr(t.bucketsize)))
		last.setoverflow(t, (*bmap)(buckets))
	}
	return buckets, nextOverflow
}
```

这个时候看到的正常桶和溢出桶应该如下图所示，它们是连接在一起的：

![](Go-bmap-overflow.png)

### 哈希函数

`hmap` 是否高效很大一部分取决于哈希函数的选择，即要快，也要冲突少。在程序启动的时候，`Go` 会检测 `CPU` 是否支持 `AES`，如果支持则会使用 `AES` 哈希，通过硬件加速提高效率，这部分实现是在 [`runtime.alginit`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/alg.go#L311) 中：

```go
func alginit() {
	// Install AES hash algorithms if the instructions needed are present.
	if (GOARCH == "386" || GOARCH == "amd64") &&
		cpu.X86.HasAES && // AESENC
		cpu.X86.HasSSSE3 && // PSHUFB
		cpu.X86.HasSSE41 { // PINSR{D,Q}
		initAlgAES()
		return
	}
	if GOARCH == "arm64" && cpu.ARM64.HasAES {
		initAlgAES()
		return
	}
	getRandomData((*[len(hashkey) * goarch.PtrSize]byte)(unsafe.Pointer(&hashkey))[:])
	hashkey[0] |= 1 // make sure these numbers are odd
	hashkey[1] |= 1
	hashkey[2] |= 1
	hashkey[3] |= 1
}

func initAlgAES() {
	useAeshash = true
	// Initialize with random data so hash collisions will be hard to engineer.
	getRandomData(aeskeysched[:])
}
```

而它是在调度初始化过程中被调用的，在 [`runtime.schedinit`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/proc.go#L693) 中，判断 `CPU` 是否支持 `AES`，然后设置标志位并且生产必须的随机数。每个 `map` 类型都由下面的结构体表示：

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
```

其中的 `hasher` 就是用于计算哈希值的函数，对于 `map[string]int`，它对应的函数就是 [`runtime.strhash`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/alg.go#L50)

```go
func strhash(p unsafe.Pointer, h uintptr) uintptr
```

它是使用汇编语言实现的，[内容如下](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/asm_arm64.s#L616)：

```asm
// func strhash(p unsafe.Pointer, h uintptr) uintptr
TEXT runtime·strhash<ABIInternal>(SB),NOSPLIT|NOFRAME,$0-24
	MOVB	runtime·useAeshash(SB), R10
	CBZ	R10, noaes
#ifdef GOEXPERIMENT_regabiargs
	LDP	(R0), (R0, R2)	// string data / length
#else
	MOVD	p+0(FP), R10	// string pointer
	LDP	(R10), (R0, R2)	// string data / length
	MOVD	h+8(FP), R1
	MOVD	$ret+16(FP), R8	// return adddress
#endif
	B	aeshashbody<>(SB)
noaes:
	B	runtime·strhashFallback<ABIInternal>(SB)
```

如果支持 `AES` 就会调用硬件计算哈希，如 [`aeshashbody`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/asm_arm64.s#L639) 中实现所示，如果不支持，就调用 [`runtime.strhashFallback`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/alg.go#L52)，在内存中计算哈希值：

```go
func strhashFallback(a unsafe.Pointer, h uintptr) uintptr {
	x := (*stringStruct)(a)
	return memhashFallback(x.str, h, uintptr(x.len))
}
```

### 查找过程

对于 `map` 访问，`Go` 中有两种方式，一种是返回一个值，另一种是除了返回值之外还会返回一个 `bool` 值表示这个值是否存在，因为访问 `map` 时，如果不存在就会返回零值：
```go
package main

import "fmt"

func main() {
	var numbers2 = make(map[string]int, 16)
	numbers2["hello"] = 1
	fmt.Println(numbers2["hello"])

	value, ok := numbers2["hello"]
	fmt.Println(value, ok)
}
```

`Go` 中为这两种方式提供了两种不同的函数，例如我们这里的 [`runtime.mapaccess1_faststr`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/map_faststr.go#L13) 和 [`runtime.mapaccess2_faststr`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/map_faststr.go#L108)，我们来看下 `mapaccess2_faststr` 的实现：

```go
func mapaccess2_faststr(t *maptype, h *hmap, ky string) (unsafe.Pointer, bool) {
	if raceenabled && h != nil {
		callerpc := getcallerpc()
		racereadpc(unsafe.Pointer(h), callerpc, abi.FuncPCABIInternal(mapaccess2_faststr))
	}
	if h == nil || h.count == 0 {
		return unsafe.Pointer(&zeroVal[0]), false
	}
	// 不支持并发读写
	if h.flags&hashWriting != 0 {
		throw("concurrent map read and map write")
	}
	key := stringStructOf(&ky)
	if h.B == 0 {
		// B = 0 的时候，2^0 = 1，也就是只有 1 个 bucket 了
		b := (*bmap)(h.buckets)
		if key.len < 32 {
			// 如果 key 比较短，直接比较就 OK 了，每次迭代的时候，kptr += 2*goarch.PtrSize
			// 这里是因为 string 在字符串表示为 reflect.StringHeader，它占据2个机器字
			for i, kptr := uintptr(0), b.keys(); i < bucketCnt; i, kptr = i+1, add(kptr, 2*goarch.PtrSize) {
				k := (*stringStruct)(kptr)

				// 如果当前 key 长度不相等，并且当前cell是空的，且后面的cell都为空，就直接退出了
				// 如果当前 key 长度不相等，并且当前cell是空的，但是后面的cell还可能有，就接着找
				if k.len != key.len || isEmpty(b.tophash[i]) {
					if b.tophash[i] == emptyRest {
						break
					}
					continue
				}
				
				// 如果长度相等，并且内容相等，就返回值的地址
				// dataOffset 就是 bmap 的大小，unsafe.Pointer(b) + dataOffset+bucketCnt*2*goarch.PtrSize 就是跳过了
				// 所有 8 个 key，然后再加上 i*uintptr(t.elemsize)，就找到了对应值的地址
				if k.str == key.str || memequal(k.str, key.str, uintptr(key.len)) {
					return add(unsafe.Pointer(b), dataOffset+bucketCnt*2*goarch.PtrSize+i*uintptr(t.elemsize)), true
				}
			}
			return unsafe.Pointer(&zeroVal[0]), false
		}
		// 对于较长的 key，尽可能少做比较，key 和 elem 位置的计算没有区别
		keymaybe := uintptr(bucketCnt)
		for i, kptr := uintptr(0), b.keys(); i < bucketCnt; i, kptr = i+1, add(kptr, 2*goarch.PtrSize) {
			k := (*stringStruct)(kptr)
			if k.len != key.len || isEmpty(b.tophash[i]) {
				if b.tophash[i] == emptyRest {
					break
				}
				continue
			}
			if k.str == key.str {
				return add(unsafe.Pointer(b), dataOffset+bucketCnt*2*goarch.PtrSize+i*uintptr(t.elemsize)), true
			}
			// check first 4 bytes
			if *((*[4]byte)(key.str)) != *((*[4]byte)(k.str)) {
				continue
			}
			// check last 4 bytes
			if *((*[4]byte)(add(key.str, uintptr(key.len)-4))) != *((*[4]byte)(add(k.str, uintptr(key.len)-4))) {
				continue
			}
			if keymaybe != bucketCnt {
				// Two keys are potential matches. Use hash to distinguish them.
				goto dohash
			}
			keymaybe = i
		}
		if keymaybe != bucketCnt {
			k := (*stringStruct)(add(unsafe.Pointer(b), dataOffset+keymaybe*2*goarch.PtrSize))
			if memequal(k.str, key.str, uintptr(key.len)) {
				return add(unsafe.Pointer(b), dataOffset+bucketCnt*2*goarch.PtrSize+keymaybe*uintptr(t.elemsize)), true
			}
		}
		return unsafe.Pointer(&zeroVal[0]), false
	}
dohash:
	// 根据对应类型的 hash 函数计算哈希值
	hash := t.hasher(noescape(unsafe.Pointer(&ky)), uintptr(h.hash0))
	// m = (1 << h.B) - 1，如果 h.B = 2，那么 m = 3
	m := bucketMask(h.B)
	// 找到对应的 bucket，add(h.buckets, (hash&m)*uintptr(t.bucketsize)) 
	// hash & m，确定桶的编号，然后 h.buckets + (hash&m)*uintptr(t.bucketsize) 得到
	// 桶的地址
	b := (*bmap)(add(h.buckets, (hash&m)*uintptr(t.bucketsize)))
	// oldbuckets 不为空，说明发生了扩容，当前 map 是从旧的 map 扩展而来，一些数据可能还存在旧的 bucket 中
	if c := h.oldbuckets; c != nil {
		// 如果同大小扩容
		if !h.sameSizeGrow() {
			// 新 bucket 的数量是老的两倍，所以 m >> 1
			m >>= 1
		}
		// 计算这个key在老的bucket中的位置
		oldb := (*bmap)(add(c, (hash&m)*uintptr(t.bucketsize)))
		// 如果这个 bucket 还没有迁移到新的 bucket 中，那么就从老的bucket中找
		if !evacuated(oldb) {
			b = oldb
		}
	}
	// 计算出高8位hash值，其实就是 uint8(hash >> 56)
	// 由于 bucket 的状态也是放在它的 tophash 数组中的，用到的状态值是 0-5
	// 所以根据 key 计算出的 tophash 如果小于 minTopHash，要加上 minTopHash，要加上
	top := tophash(hash)
	for ; b != nil; b = b.overflow(t) {
		for i, kptr := uintptr(0), b.keys(); i < bucketCnt; i, kptr = i+1, add(kptr, 2*goarch.PtrSize) {
			k := (*stringStruct)(kptr)
			if k.len != key.len || b.tophash[i] != top {
				continue
			}
			if k.str == key.str || memequal(k.str, key.str, uintptr(key.len)) {
				return add(unsafe.Pointer(b), dataOffset+bucketCnt*2*goarch.PtrSize+i*uintptr(t.elemsize)), true
			}
		}
	}
	return unsafe.Pointer(&zeroVal[0]), false
}

// tophash calculates the tophash value for hash.
func tophash(hash uintptr) uint8 {
	top := uint8(hash >> (goarch.PtrSize*8 - 8))
	if top < minTopHash {
		top += minTopHash
	}
	return top
}
```

代码整体上比较简单，一共分了两种情况，只有 `1` 个桶时直接比较便利当前桶，通过比 较`key` 是否相等寻找，否则计算 `key` 的哈希值，找到对应的桶，然后遍历，这个通过计算`key`的哈希值再定位 `key` 的过程可以用如下的图所示：

![](Go-map-key-locate.png)

里面有几个重要的过程，我们再分析下，首先是 `key` 和 `value` 的定位公式：

```go
// 对于 string 类型做key，每个key占两个机器字，一个是8字节
keyPtr := b.keys() + 2*i+goarch.PtrSize

// 就是从 跳过所有的 key，然后根据值的大小，定位到它的内存位置
valuePtr := b.keys()+bucketCnt*2*goarch.PtrSize+i*uintptr(t.elemsize)

// b.keys 实际上获取的就是第一个 key 开始的内存地址
func (b *bmap) keys() unsafe.Pointer {
	return add(unsafe.Pointer(b), dataOffset)
}

// dataOffset 就是 bmap 这个结构体的大小，是 keys 开始的偏移量
const dataOffset = unsafe.Offsetof(struct {
	b bmap
	v int64
}{}.v)
```

既然是拉链法实现，那么就肯定得遍历 `bucket` 链，外层循环就是遍历所有链上的 `bucket`，内层循环就是遍历每个 `bucket` 的 `8` 个 `key`，调用 `b.overflow(t)` 可以获取到下一个 `bucket`。根据 `bmap` 运行时实际的内存表示，它的最后一个字节存储的下一个 `bucket` 的地址：

```go
func (b *bmap) overflow(t *maptype) *bmap {
	return *(**bmap)(add(unsafe.Pointer(b), uintptr(t.bucketsize)-goarch.PtrSize))
}
```

访问过程中，`map` 可能正在扩容，那么就首先得去查看旧的 `bucekt` 是否已经搬迁，如果没有，那就得从旧的 `bucket` 中查找，使用 `evacuated` 判断是否搬迁，如果第一个 `tophash` 的值大于 `emptyOne` 小于 `minTopHash`，说明已经搬到新 `map` 中了：

```golang
func evacuated(b *bmap) bool {
	h := b.tophash[0]
	return h > emptyOne && h < minTopHash
}
```

一个 `bucket` 的状态也是存储在它的 `tophash` 中的，当它取值以下的值时，表示特殊的意义：

```golang
// Possible tophash values. We reserve a few possibilities for special marks.
// Each bucket (including its overflow buckets, if any) will have either all or none of its
// entries in the evacuated* states (except during the evacuate() method, which only happens
// during map writes and thus no one else can observe the map during that time).
emptyRest      = 0 // 空的 Cell，也是 bucket 的初始状态，并且此 bucket 的后续 cell 以及 overflow bucket 都是空的
emptyOne       = 1 // 当前 Cell 是空的
evacuatedX     = 2 // k/v 已经搬迁到新 bucket 的前半部分
evacuatedY     = 3 // k/v 已经搬迁到新 bucket 的后半部分
evacuatedEmpty = 4 // 空的 cell，bucket 已经搬迁了
minTopHash     = 5 // tophash 的最小正常值
```

所以说，只要 `b.tophash[0]` 是 `evacuatedX`，`evacuatedY` 或者 `evacuatedEmpty`，都说明此 `bucket` 已经搬迁了。

