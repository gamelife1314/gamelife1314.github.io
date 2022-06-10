---
title: 【Golang】谈谈 map 是怎么实现的
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
	noverflow uint16 // 正在使用的溢出桶的数量
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

    // 为 nil 时或者长度为0时，直接返回
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

### 赋值过程

通过获取汇编代码我们可以知道，`map` 赋值过程是通过一系列的 `mapassign` 函数完成，根据 `key` 类型的不同的，在编译的时候会生成不同函数调用：

|`key`类型|函数|
|:--:|:--:|
|`uint64`|[`func mapassign_fast64(t *maptype, h *hmap, key uint64) unsafe.Pointer`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/map_fast64.go#L93)|
|`uin32`|[`func mapassign_fast32(t *maptype, h *hmap, key uint32) unsafe.Pointer`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/map_fast32.go#L93)|
|`string`|[`func mapassign_faststr(t *maptype, h *hmap, s string) unsafe.Pointer`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/map_faststr.go#L203)|
|通用|[`func mapassign(t *maptype, h *hmap, key unsafe.Pointer) unsafe.Pointer`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/map.go#L578)|

我们来看个示例：

{% note 示例代码 %}
```go
package main

import (
	"fmt"
	"unsafe"
)

type Number struct {
	age  uint64
	name string
}

func main() {
	var numbers = make(map[Number]int64, 16)
	numbers[Number{age: 1, name: "hello"}] = 255
	numbers[Number{age: 1, name: "hello"}] = 255
	fmt.Println(numbers)

	count := **(**int)(unsafe.Pointer(&numbers))
	fmt.Println(count)
}
```
{% endnote %}

使用通用的 [`runtime.mapassign`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/map.go#L578) 函数进行赋值：

```golang
// Like mapaccess, but allocates a slot for the key if it is not present in the map.
func mapassign(t *maptype, h *hmap, key unsafe.Pointer) unsafe.Pointer {
	
	// map 为 nil 时，会 panic
	if h == nil {
		panic(plainError("assignment to entry in nil map"))
	}

	if raceenabled {
		callerpc := getcallerpc()
		pc := abi.FuncPCABIInternal(mapassign)
		racewritepc(unsafe.Pointer(h), callerpc, pc)
		raceReadObjectPC(t.key, key, callerpc, pc)
	}
	if msanenabled {
		msanread(key, t.key.size)
	}
	if asanenabled {
		asanread(key, t.key.size)
	}

	// 不支持并发读写
	if h.flags&hashWriting != 0 {
		throw("concurrent map writes")
	}

	// 计算哈希值
	hash := t.hasher(key, uintptr(h.hash0))

	// 因为计算哈希值可能会 panic，这种情况下实际上没有写任何东西，所以要在
	// 计算出哈希之后才能设置标记位
	h.flags ^= hashWriting

	// 如果没有分配任何桶，则创建一个桶
	if h.buckets == nil {
		h.buckets = newobject(t.bucket) // newarray(t.bucket, 1)
	}

again:
	// 计算出桶的编号
	bucket := hash & bucketMask(h.B)

	// 下节详解，map 是渐进式扩容，扩容过程中涉及到数据的迁移，将其平摊到每次对map的赋值或者删除操作
	if h.growing() {
		growWork(t, h, bucket)
	}

	// 计算出桶的地址，强制转换成 bmap 对象
	b := (*bmap)(add(h.buckets, bucket*uintptr(t.bucketsize)))
	// 计算 tophash，右移56位，转换成 uint8 类型，如果小于 minTopHash，则加上它
	top := tophash(hash)

	var inserti *uint8         // 指向第一个空闲的 tophash 的地址
	var insertk unsafe.Pointer // 指向第一个空闲的 key   的地址
	var elem unsafe.Pointer    // 指向第一个空闲的 value 的地址
bucketloop:
	for {
		for i := uintptr(0); i < bucketCnt; i++ {
			// 找到空闲的槽
			if b.tophash[i] != top {
				if isEmpty(b.tophash[i]) && inserti == nil {
					inserti = &b.tophash[i]
					insertk = add(unsafe.Pointer(b), dataOffset+i*uintptr(t.keysize))
					elem = add(unsafe.Pointer(b), dataOffset+bucketCnt*uintptr(t.keysize)+i*uintptr(t.elemsize))
				}
				// 如果这个空闲的槽后面没有任何内容，就直接跳出 bucketloop 循环
				if b.tophash[i] == emptyRest {
					break bucketloop
				}
				continue
			}

			// 赋值的时候发现值已经存在，那就跟心
			k := add(unsafe.Pointer(b), dataOffset+i*uintptr(t.keysize))
			if t.indirectkey() { // 间接key说明，k这里存的是key的指针，而不是key的值，即指向指针的指针
				k = *((*unsafe.Pointer)(k))
			}

			// 判断key是否相等，传入两个key的地址，使用汇编语言实现的 memequal 函数，详细看下面的代码
			// https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/internal/bytealg/equal_arm64.s#L9
			if !t.key.equal(key, k) {
				continue
			}

			// 如果key需要更新，更新以下key
			if t.needkeyupdate() {
				typedmemmove(t.key, k, key)
			}

			// 定位到对应的元素的地址，直接返回结束
			elem = add(unsafe.Pointer(b), dataOffset+bucketCnt*uintptr(t.keysize)+i*uintptr(t.elemsize))
			goto done
		}

		// 如果将 bucket 的 8 个槽都找完了没找到，就接着去 overflow bucket 中去找
		ovf := b.overflow(t)
		if ovf == nil {
			break
		}
		b = ovf
	}

	// map 中原先不存在 key，那就添加一个

	// 如果目前没处在扩容过程中，但是负载系数超过了 6.5 或者有太多的 overflow buckets，那就开始扩容
	if !h.growing() && (overLoadFactor(h.count+1, h.B) || tooManyOverflowBuckets(h.noverflow, h.B)) {
		hashGrow(t, h)
		// 扩容完之后，跳转到开头重新执行
		goto again // Growing the table invalidates everything, so try again
	}

	// 如果在定位到的 map 没找到空闲的槽，也遍历了它的所有 overflow bucket，那就重新申请一个 overflow bucket
	// 将它链在后面，并且更新 inserti，insertk 以及 elem
	if inserti == nil {
		newb := h.newoverflow(t, b)
		inserti = &newb.tophash[0]
		insertk = add(unsafe.Pointer(newb), dataOffset)
		elem = add(insertk, bucketCnt*uintptr(t.keysize))
	}

	// 将 key 和 elem 存储到相应的内存位置
	if t.indirectkey() {
		kmem := newobject(t.key)
		*(*unsafe.Pointer)(insertk) = kmem
		insertk = kmem
	}
	if t.indirectelem() {
		vmem := newobject(t.elem)
		*(*unsafe.Pointer)(elem) = vmem
	}

	// 将 key 移动到指定的内存
	typedmemmove(t.key, insertk, key)
	// 更新 tophash
	*inserti = top
	// 计数加一
	h.count++

done:
	if h.flags&hashWriting == 0 {
		throw("concurrent map writes")
	}
	h.flags &^= hashWriting
	if t.indirectelem() {
		elem = *((*unsafe.Pointer)(elem))
	}
	// 返回存储elem的内存位置
	return elem
}
```

从上面的函数中可以看到下面这些信息：

1. 对值为 `nil` 的 `map` 会引发 `panic`；
2. `map` 不支持并发读写，并发读写会引发 `panic`；
3. `map` 的扩容涉及到数据搬迁，为了避免在数据搬迁过程中引起 `CPU` 陡增，`Go` 将数据搬迁平摊到了每次操作中；
4. `key` 和 `elem` 对应内存位置的定位公式和前一节讲的是相同的；
5. 因为 `map` 的操作可能是更新，也有可能是新插入，所以在遍历 `bucket` 及其 `overflow bucket` 的过程中会将第一个遇到的空闲位置记录下来，分别保存在 `inserti`，`insertk` 以及 `elem` 中。 如果 `key` 已经存在，那么直接跳转到末尾位置将 `elem` 的内存地址返回；
6. 如果不存在就新插入一个，但是如果发现当前 `map` 的负载系数超过 `6.5`并且还没有扩容，那就开始扩容，扩容之后，`key` 要存放的位置就会变化，所以要从查找 `bucket` 的过程重新开始；
7. 如果新插入的时候，发现 `key` 对应的 `bucket` 及其 `overflow bucket` 中都没有空闲位置了，那就重新申请一个 `overflow bucket` 链接在 `bucket` 后面，并且更新 `inserti`，`insertk` 以及 `elem` 为新的溢出桶的第一个槽位；
8. 接下来就是将 `key` 放到对应的内存位置，如果是新插入则更新计数并且返回存放 `elem` 的内存地址；

除了上述这些信息之外，我们还有一些小函数应该将它的原理搞清楚。[`runtime.(*maptype).indirectkey`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/type.go#L363)：

```go
func (mt *maptype) indirectkey() bool { // store ptr to key instead of key itself
	return mt.flags&1 != 0
}
```

间接 `key` 就是 `bucket` 中对应存放 `key` 的位置存的不是 `key` 对应的值本身，而是指向 `key` 的地址，每个 `map` 在编译时都有对应的 `maptype`，由编译器来决定。另外 [`runtime.(*maptype).needkeyupdate`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/type.go#L372) 决定在更新键值对的时候要不要重新覆盖 `key`：

```go
func (mt *maptype) needkeyupdate() bool { // true if we need to update key on an overwrite
	return mt.flags&8 != 0
}
```

[`runtime.(*hmap).newoverflow`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/map.go#L246) 用于创建溢出桶，首先会从预先创建的溢出桶中获取一个，如果没有就使用 `newobject` 新创建一个：

```go
func (h *hmap) newoverflow(t *maptype, b *bmap) *bmap {
	var ovf *bmap
	if h.extra != nil && h.extra.nextOverflow != nil {
		// We have preallocated overflow buckets available.
		// See makeBucketArray for more details.
		ovf = h.extra.nextOverflow
		if ovf.overflow(t) == nil {
			// 从预先创建的溢出桶中获取一个，并且移动指针
			h.extra.nextOverflow = (*bmap)(add(unsafe.Pointer(ovf), uintptr(t.bucketsize)))
		} else {
			// 如果已经到达最后一个溢出桶，那就将 h.extra.nextOverflow 置为 nil，下次需要直接调用
			// newobject 创建
			ovf.setoverflow(t, nil)
			h.extra.nextOverflow = nil
		}
	} else {
		// 创建新的 bucket
		ovf = (*bmap)(newobject(t.bucket))
	}

	// 增加正在使用的溢出桶的数量
	h.incrnoverflow()
	if t.bucket.ptrdata == 0 {
		h.createOverflow()
		*h.extra.overflow = append(*h.extra.overflow, ovf)
	}

	// 将溢出桶和之前的 bucket 链在一起
	b.setoverflow(t, ovf)
	return ovf
}
```

[`runtime.(*hmap).growing`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/map.go#L1103) 用于判断当前 `map` 是否在扩容过程中：

```go
func (h *hmap) growing() bool {
	return h.oldbuckets != nil
}
```

[`runtime.overLoadFactor`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/map.go#L1083) 判断当前的 `map` 是否过载，其实就是当 `map` 中元素的总量超过 `6.5 * (1 << h.B)`，即每个桶平均存放超过 `6.5` 个 `key` 时：

```go
func overLoadFactor(count int, B uint8) bool {
	return count > bucketCnt && uintptr(count) > loadFactorNum*(bucketShift(B)/loadFactorDen)
}
```

[`runtime.tooManyOverflowBuckets`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/map.go#L1090) 用于判断是否有太多溢出桶，当 `h.B < 15` 时溢出桶最多可以有 `2^B` 个，当 `h.B >= 15` 时溢出桶最多是 $2^{15}$ 个：

```golang
// tooManyOverflowBuckets reports whether noverflow buckets is too many for a map with 1<<B buckets.
// Note that most of these overflow buckets must be in sparse use;
// if use was dense, then we'd have already triggered regular map growth.
func tooManyOverflowBuckets(noverflow uint16, B uint8) bool {
	// If the threshold is too low, we do extraneous work.
	// If the threshold is too high, maps that grow and shrink can hold on to lots of unused memory.
	// "too many" means (approximately) as many overflow buckets as regular buckets.
	// See incrnoverflow for more details.
	if B > 15 {
		B = 15
	}
	// The compiler doesn't see here that B < 16; mask B to generate shorter shift code.
	return noverflow >= uint16(1)<<(B&15)
}
```

当 `map` 变得过大，装载太多元素，或者有太多的的溢出桶时就会扩容，调用 [`runtime.hashGrow`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/map.go#L1039) 函数进行：

- 如果已经达到装载系数，那么桶数量就增大一倍；
- 否则进行等量扩容，等量扩容是由于删除操作让 `bucket` 及其溢出桶变得比较稀疏，重新进行规整；

这里只是扩充容量，申请内存，但实际并未进行数据搬迁，数据搬迁是在每次的删除或者赋值过程中进行的。

```go
func hashGrow(t *maptype, h *hmap) {
	
	// B+1 相当于扩容为原来的两倍
	// 等量扩容保持容量不变
	bigger := uint8(1)
	if !overLoadFactor(h.count+1, h.B) {
		bigger = 0
		h.flags |= sameSizeGrow
	}
	oldbuckets := h.buckets
	newbuckets, nextOverflow := makeBucketArray(t, h.B+bigger, nil)

	flags := h.flags &^ (iterator | oldIterator)
	if h.flags&iterator != 0 {
		flags |= oldIterator  // 如果 h.flags 有 iterator 标记，现在让它去迭代 oldIterator
	}

	// 提交 grow 的=动作
	h.B += bigger
	h.flags = flags
	h.oldbuckets = oldbuckets
	h.buckets = newbuckets
	h.nevacuate = 0 // 搬迁进度为0
	h.noverflow = 0 // overflow buckets 数为0

	if h.extra != nil && h.extra.overflow != nil {
		// Promote current overflow buckets to the old generation.
		if h.extra.oldoverflow != nil {
			throw("oldoverflow is not nil")
		}
		h.extra.oldoverflow = h.extra.overflow
		h.extra.overflow = nil
	}
	if nextOverflow != nil {
		if h.extra == nil {
			h.extra = new(mapextra)
		}
		h.extra.nextOverflow = nextOverflow
	}

	// the actual copying of the hash table data is done incrementally
	// by growWork() and evacuate().
}
```

这里还有几个二进制操作，`&^` 叫做按位置 `0` 运算符。例如，对于如下示例，如果 `y` 对应 `bit` 位为 `1`，那么 `z` 对应 `bit` 位为 `0`，否则 `z` 对应 `bit` 位为和 `x` 保持一致：

```go
func main() {
	x := 0b01010011
	y := 0b01010100
	z := x &^ y     // 3
	fmt.Println(z)
}
```

所以下面的操作：

- 将清除 `h.flags` 中的 `hashWriting` 标记；
- 或者将 `h.flags` 中的 `iterator` 和 `oldIterator` 清零；

```golang
h.flags &^= hashWriting

flags := h.flags &^ (iterator | oldIterator)
```

我们在这里可以找到 `map` 的[`4`个标志位](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/map.go#L100)：

```go
// flags
iterator     = 1 // 可能有迭代器在使用 buckets
oldIterator  = 2 // 可能有迭代器在使用 oldbuckets
hashWriting  = 4 // 有一个 goroutine 正在写 map
sameSizeGrow = 8 // 等量扩容，即 h.B 大小不变
```

### 扩容过程

使用哈希表的目的就是能快速找到 `key`，但是随着像 `map` 中添加越来越多的 `key`，发生 `key` 碰撞的概率就会越来越大。当 `bucket` 中的 `8` 个 `cell` 都被塞满，增删改查的效率就会很低，理想的情况是每个 `bucket` 中存储一个 `key`，这样就能达到 `O(1)` 的查找速率，但是这样会消耗大量的内存。

从前面的示例中可以看出，`Go` 中每个 `bucket` 实际上可以装载 `8` 个 `key`，查找 `key` 就包含查找包含 `key` 的 `bucket` 和查找具体的槽位两个过程，这实际上又是使用时间换空间。

但是，如果当所有的 `key` 都落到同一个 `bucket` 中，那么 `map` 相当于退化成链表了，查找的复杂度就成 `O(n)` 了，因为包含的元素太多导致了查找效率降低。

另外一种情况就是，当 `map` 在大量插入又大量删除之后，`bucket` 就变得很稀疏，可能 `bucket` 链上挂了很多溢出桶，但其实这个 `bucket` 链上没存储几个元素，这也会导致查找效率降低。

针对这两种情况，`Go` 有两种扩容的方式，即我们上面看到的：

```go
overLoadFactor(h.count+1, h.B) || tooManyOverflowBuckets(h.noverflow, h.B)
```

- 对于第一个条件，`Go` 语言中使用装载因子来衡量是否需要扩容，计算公式为：`loadFactor := count / (2^B)`，当 `loadFactor >= 6.5` 时，表明很多 `bucket` 都快要装满了，所以扩容是有必要的；

- 对于第二个条件，就是由于大量的删除操作使得 `bucket` 变得很稀疏，查找效率降低，根据溢出桶的数量进行判断，当 `h.B < 15` 时，如果溢出桶的数量大于 `2^B`；或者当 `h.B >= 15`，溢出桶的数量大于等于 `2^15` 就进行扩容，这种场景下的扩容方式叫做等量扩容，就是说 `bucket` 的总数没有增加，相当于一个碎片整理；

触发扩容的时机已经在赋值过程中讲解过了，我们继续分析分摊到每个赋值和删除过程中的数据迁移，这部分代码在 [`runtime.growWork`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/map.go#L1126) 中：

```go
func growWork(t *maptype, h *hmap, bucket uintptr) {
	// 首先搬迁我们将要使用的桶，bucket 为对应 key 在新 map 中的桶编号
	// bucket&h.oldbucketmask() 计算除了该 key 在旧桶中的编号
	evacuate(t, h, bucket&h.oldbucketmask())

	// 再搬迁一个，以加快搬迁进度
	if h.growing() {
		evacuate(t, h, h.nevacuate)
	}
}
```

`growWork` 中的 `bucekt` 是正要删除或者更新的 `key` 在新的 `map` 中对应的桶编号，举个例子：

- 假设旧的 `h.B = 2`，进行增量扩容之后 `h.B = 3`，那么旧 `map` 和新 `map` 的`bucketMsask(桶掩码)`就是 `3(0b11)` 和 `7(0b111)`，它们等于 `2^B - 1`；

- 假设正要操作的 `key` 对应的 `hash` 值后 `3` 个 `bit` 位为 `110`，那么它在旧 `map` 中对应的桶编号为 `110 & 0b11 = 2`，在新桶中的编号为 `110 & 0b111 = 6`；

- `bucket&h.oldbucketmask() = 6 & 3 = 2`，对应于 `key` 在旧桶中的编号；

下面我们来看看搬迁的具体过程，在 [`runtime.evacuate`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/map.go#L1150) 中实现：

```go
// 在下面的例子中，我们假设 h.oldB = 2，h.newB = 3，key 的哈希值后3个bit位为 101
// 那么它在旧map中的桶编号为 0b11 & 0b101 = 1，在新map中的桶编号为 0b111 & 0b101 = 5；
func evacuate(t *maptype, h *hmap, oldbucket uintptr) {
	// 获取旧 bucket 的内存地址
	b := (*bmap)(add(h.oldbuckets, oldbucket*uintptr(t.bucketsize)))
	// 获取旧map的桶数量，如果是等量扩容，桶数量不变，否则就是 (2 ^ (h.newB - 1))，这里假设为 4
	newbit := h.noldbuckets()
	if !evacuated(b) {
		// TODO: reuse overflow buckets instead of using new ones, if there
		// is no iterator using the old buckets.  (If !oldIterator.)

		// xy 包含了两个地址，搬迁的高低目的地址
		var xy [2]evacDst

		// xy[0] 是等量扩容是，bucket 搬迁的目的地址，也就是新老地址对应的桶编号不变
		x := &xy[0]
		x.b = (*bmap)(add(h.buckets, oldbucket*uintptr(t.bucketsize)))
		x.k = add(unsafe.Pointer(x.b), dataOffset)
		x.e = add(x.k, bucketCnt*uintptr(t.keysize))

		if !h.sameSizeGrow() {
			// 如果不是等量扩容，也就是 bucket 数量增大一倍时，旧的bucket为与新 map 中的后半部分
			// 例如，根据上面的假设，这里的 oldbucket 为 1，newbit 为 4，那么相当于将旧 map 中的
			// 1 号桶迁移到了新 map 中的 5 号桶
			y := &xy[1]
			y.b = (*bmap)(add(h.buckets, (oldbucket+newbit)*uintptr(t.bucketsize)))
			y.k = add(unsafe.Pointer(y.b), dataOffset)
			y.e = add(y.k, bucketCnt*uintptr(t.keysize))
		}

		// 依然是熟悉的量层 for 循环，遍历桶及其溢出桶
		for ; b != nil; b = b.overflow(t) {

			// 一开始 k, e 指向当前桶的第一个 key 和 elem 的地址
			k := add(unsafe.Pointer(b), dataOffset)
			e := add(k, bucketCnt*uintptr(t.keysize))

			// 遍历当前 bucket 的 8 个 cell
			for i := 0; i < bucketCnt; i, k, e = i+1, add(k, uintptr(t.keysize)), add(e, uintptr(t.elemsize)) {

				// 如果当前 cell 是空的，那就继续看下一个 cell
				top := b.tophash[i]
				if isEmpty(top) {
					// 设置新标识，标识 bucket 已经搬迁了
					b.tophash[i] = evacuatedEmpty
					continue
				}

				// 一般不可能，因为在赋值的时候，如果 topHash 小于 minTopHash，会加上 minTopHash，除非内存被破坏
				if top < minTopHash {
					throw("bad map state")
				}

				// 对于间接 key，k 实际上存储的是指向实际值的指针，即指向指针的指针，所以对它进行解引用
				k2 := k
				if t.indirectkey() {
					k2 = *((*unsafe.Pointer)(k2))
				}

				var useY uint8

				// 非等量扩容时需要判断是不是得把旧的bucket搬到新map中的后半部分
				if !h.sameSizeGrow() {
					
					// 计算 hash 值，扩容并不影响 key 的哈希值的计算
					hash := t.hasher(k2, uintptr(h.hash0))

					// 如果有 goroutine 正在遍历 map，并且两个相同的 key 哈希值还不相等，这种事只有
					// 浮点数的 NaN 值才搞得出来
					if h.flags&iterator != 0 && !t.reflexivekey() && !t.key.equal(k2, k2) {
						// If key != key (NaNs), then the hash could be (and probably
						// will be) entirely different from the old hash. Moreover,
						// it isn't reproducible. Reproducibility is required in the
						// presence of iterators, as our evacuation decision must
						// match whatever decision the iterator made.
						// Fortunately, we have the freedom to send these keys either
						// way. Also, tophash is meaningless for these kinds of keys.
						// We let the low bit of tophash drive the evacuation decision.
						// We recompute a new random tophash for the next level so
						// these keys will get evenly distributed across all buckets
						// after multiple grows.
						useY = top & 1
						top = tophash(hash)
					} else {

						// 正常情况情下，根据 hash&newbit 的结果来判断用哪个地址
						// 例如，我们开始假设 hash 的后 3 个 bit 位为 101，newbit 为 4
						// 那么 hash&newbit = 0b101 & 0b100 = 1，也就是由 hash 的倒数第 h.newB 位
						// 决定是放在新 map 的前半部分还是后半部分
						if hash&newbit != 0 {
							useY = 1
						}
					}
				}

				if evacuatedX+1 != evacuatedY || evacuatedX^1 != evacuatedY {
					throw("bad evacuatedN")
				}

				// 设置当前 cell 的搬迁状态，搬到了新 map 的前半部分还是后半部分
				b.tophash[i] = evacuatedX + useY // evacuatedX + 1 == evacuatedY
				dst := &xy[useY]                 // evacuation destination

				// 如果新的bucket已经满了，就再挂一个溢出桶
				if dst.i == bucketCnt {
					dst.b = h.newoverflow(t, dst.b)
					dst.i = 0
					dst.k = add(unsafe.Pointer(dst.b), dataOffset)
					dst.e = add(dst.k, bucketCnt*uintptr(t.keysize))
				}
				
				dst.b.tophash[dst.i&(bucketCnt-1)] = top // mask dst.i as an optimization, to avoid a bounds check
				
				// 移动 key，间接key，dst.k 保存的是存放 key 值的内存地址
				if t.indirectkey() {
					*(*unsafe.Pointer)(dst.k) = k2 // copy pointer
				} else {
					// 否则这里将复制 key 值的内容到 dst.k
					typedmemmove(t.key, dst.k, k) // copy elem
				}
				
				// elem 和 key 一样
				if t.indirectelem() {
					*(*unsafe.Pointer)(dst.e) = *(*unsafe.Pointer)(e)
				} else {
					typedmemmove(t.elem, dst.e, e)
				}

				// 更新当前目的 bucket 的计数
				// 通过这里可以看到，通过搬迁，会将老的bucket因删除而导致空闲cell重新整合
				// 提升查找效率
				dst.i++

				// 更新目的 bucket 存储下一个 key/elem 的地址
				dst.k = add(dst.k, uintptr(t.keysize))
				dst.e = add(dst.e, uintptr(t.elemsize))
			}
		}

		// 如果没有 goroutine 正在遍历老的 bucket，就把它的数据区域释放掉，帮助 GC
		if h.flags&oldIterator == 0 && t.bucket.ptrdata != 0 {
			b := add(h.oldbuckets, oldbucket*uintptr(t.bucketsize))
			// 只清除数据区域，也就是从第一个 key 到 bucket 结束的内存区域
			// 保留 tophash，因为它里面的保存了 bucket 的状态
			ptr := add(b, dataOffset)
			n := uintptr(t.bucketsize) - dataOffset
			memclrHasPointers(ptr, n)
		}
	}

	// 如果此次搬迁的 bucket 等于当前搬迁进度
	if oldbucket == h.nevacuate {
		advanceEvacuationMark(h, t, newbit)
	}
}

func advanceEvacuationMark(h *hmap, t *maptype, newbit uintptr) {
	h.nevacuate++
	// 尝试往后寻找 1024 个 bucket，看有没有搬迁结束的
	stop := h.nevacuate + 1024
	if stop > newbit {
		stop = newbit
	}

	// 寻找 bucket 有没有搬迁
	for h.nevacuate != stop && bucketEvacuated(t, h, h.nevacuate) {
		h.nevacuate++
	}

	// 所有 bucket 都已经搬迁完毕
	if h.nevacuate == newbit { // newbit == # of oldbuckets
		// 释放旧的 bucket 数组
		h.oldbuckets = nil
		// 清除老的溢出桶
		if h.extra != nil {
			h.extra.oldoverflow = nil
		}
		// 清除正在扩容的标志
		h.flags &^= sameSizeGrow
	}
}
```

搬迁的目的就是将老的 `bucket` 搬迁到了新 `bucket`。对于等量扩容，由于 `bucket` 数量不变，所以可以按照喜好进行搬迁，就是 `key` 原来在 `0` 号 `bucket`，那么搬迁到新 `bucket` 之后依然是 `0` 号 `bucket`。

对于增量扩容，每次 `bucekt` 的数量会增加为原来的 `2` 倍，所以要重新计算 `key` 的哈希值，才能决定它到底落入哪个桶。例如，`h.oldB = 5`，可以由 `key` 哈希值的低 `5` 位决定它落入哪个桶，现在 `h.newB = 6`，需要哈希值的后 `6` 位才能决定它落入新 `map` 的哪个桶。

![](Go-map-bucket-expand.png)

从扩容的过程中我们看到了一种特殊的数据类型 `math.NaN`，这种类型作 `key` 时，不可能通过正常的 `key` 查找找到它，因为它的哈希值不稳定，每次计算都得到不同的哈希值，没法对它进行定位，只能通过遍历访问它们。所以也可以在 `map` 中插入任意数量的 `math.NaN`。遇到这种类型的 `key`，通过 `tophash` 的最低位决定把它放到 `xPart` 还是 `yPart`（增量扩容），`0` 就放到 `xPart`，否则就是 `yPart`。

我们在前面说过，等量扩容类似于碎片整理，能提高查找效率，用一个图来展示这种效果，假设 `h.B = 2`，由于溢出桶太多，触发了等量扩容。扩容之前可能有如下的状态：

![](Go-map-same-size-grow-before.png)

等量扩容之后，`bucket` 的数量没变，溢出桶的数量会减少，原先分散的 `key` 会被整合到一起，提高查询效率：

![](Go-map-same-size-grow-after.png)

对于增量扩容，可能会涉及到 `key` 映射到新 `map` 中的其他 `bucket`，我们假设 `h.oldB = 2`，那么扩容之后 `h.newB = 3`。假设在扩容之前，我们有下面场景，`key1` 和 `key2` 都在旧 `map` 中的 `1` 号桶：

![](Go-map-large-size-grow-before.png)

在扩容搬迁之后，这些 `key1` 依然会在新 `map` 的 `1` 号桶，`key2` 会被移动动 `5` 号桶：

![](Go-map-large-size-grow-after.png)

### 删除过程

和赋值一样，删除也有一些快速函数：

|`key`类型|函数|
|:--:|:--:|
|`uint64`|[`func mapdelete_fast64(t *maptype, h *hmap, key uint64)`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/map_fast64.go#L273)|
|`uin32`|[`func mapdelete_fast32(t *maptype, h *hmap, key uint32)`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/map_fast32.go#L273)|
|`string`|[`func mapdelete_faststr(t *maptype, h *hmap, ky string)`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/map_faststr.go#L301)|
|通用|[`func mapdelete(t *maptype, h *hmap, key unsafe.Pointer)`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/map.go#L578)|

我们来看看通用的 `mapdelete` 的过程：

```go
func mapdelete(t *maptype, h *hmap, key unsafe.Pointer) {
	if raceenabled && h != nil {
		callerpc := getcallerpc()
		pc := abi.FuncPCABIInternal(mapdelete)
		racewritepc(unsafe.Pointer(h), callerpc, pc)
		raceReadObjectPC(t.key, key, callerpc, pc)
	}
	if msanenabled && h != nil {
		msanread(key, t.key.size)
	}
	if asanenabled && h != nil {
		asanread(key, t.key.size)
	}

	// 如果 map 为 nil 或者长度为0，直接返回
	if h == nil || h.count == 0 {
		if t.hashMightPanic() {
			t.hasher(key, 0) // see issue 23734
		}
		return
	}

	// 不支持并发删除和写
	if h.flags&hashWriting != 0 {
		throw("concurrent map writes")
	}

	hash := t.hasher(key, uintptr(h.hash0))

	// 设置写标记
	h.flags ^= hashWriting

	// 获取 bucket 编号，如果处于扩容过程中，那么就进行扩容
	bucket := hash & bucketMask(h.B)
	if h.growing() {
		growWork(t, h, bucket)
	}
	b := (*bmap)(add(h.buckets, bucket*uintptr(t.bucketsize)))
	bOrig := b
	top := tophash(hash)
search:
	// 遍历所有的溢出桶
	for ; b != nil; b = b.overflow(t) {
		for i := uintptr(0); i < bucketCnt; i++ {
			
			// 如果这个bucket当前槽及其后面都是空的，直接退出
			if b.tophash[i] != top {
				if b.tophash[i] == emptyRest {
					break search
				}
				continue
			}

			// 定位到 key 的位置
			k := add(unsafe.Pointer(b), dataOffset+i*uintptr(t.keysize))
			k2 := k
			if t.indirectkey() {
				k2 = *((*unsafe.Pointer)(k2))
			}
			if !t.key.equal(key, k2) {
				continue
			}

			// 如果 k 存储的是对应 key 的指针，置为 nil 即可
			if t.indirectkey() {
				*(*unsafe.Pointer)(k) = nil
			} else if t.key.ptrdata != 0 { 
				// 否则如果直接存储的是key的值，但是 key 对应类型里面包含了指针
				memclrHasPointers(k, t.key.size)
			}

			// 定位到 elem 的位置
			e := add(unsafe.Pointer(b), dataOffset+bucketCnt*uintptr(t.keysize)+i*uintptr(t.elemsize))
			if t.indirectelem() {
				*(*unsafe.Pointer)(e) = nil
			} else if t.elem.ptrdata != 0 {
				memclrHasPointers(e, t.elem.size)
			} else {
				memclrNoHeapPointers(e, t.elem.size)
			}

			// 清除完之后，将 cell 标记为空
			b.tophash[i] = emptyOne

			// 检测当前cell后面的是否都是空的，如果是那就将当前 cell 的状态置成 emptyRest
			if i == bucketCnt-1 {
				if b.overflow(t) != nil && b.overflow(t).tophash[0] != emptyRest {
					goto notLast
				}
			} else {
				if b.tophash[i+1] != emptyRest {
					goto notLast
				}
			}

			for {
				b.tophash[i] = emptyRest
				if i == 0 {
					if b == bOrig {
						break // beginning of initial bucket, we're done.
					}
					// Find previous bucket, continue at its last entry.
					c := b
					for b = bOrig; b.overflow(t) != c; b = b.overflow(t) {
					}
					i = bucketCnt - 1
				} else {
					i--
				}
				if b.tophash[i] != emptyOne {
					break
				}
			}
		notLast:
			h.count--
			// 重置哈希种子，使得攻击者重复触发哈希冲突的可能性降低
			if h.count == 0 {
				h.hash0 = fastrand()
			}
			break search
		}
	}

	if h.flags&hashWriting == 0 {
		throw("concurrent map writes")
	}
	h.flags &^= hashWriting
}
```

### 遍历过程

直接用脑袋想 `map` 的遍历过程可能很简单，遍历所有的 `bucket` 及其溢出桶中所有 `cell` 即可，但是大多数情况下，`map` 处于扩容过程中，每次赋值和删除操作只能迁移两个 `bucket`，所以，`map` 遍历过程实际上涉及到新老 `bucket` 的遍历，这是问题所在。我们来看个示例：

```go
package main

import (
	"fmt"
)

type Number struct {
	age  uint64
	name string
}

func main() {
	var numbers = make(map[Number]int64, 16)
	numbers[Number{age: 1, name: "hello"}] = 255
	fmt.Println(numbers)

	for k, v := range numbers {
		fmt.Println(k, v)
	}
}
```

通过汇编指令得知，`map` 遍历首先会调用 [`runtime.mapiterinit`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/map.go#L815) 初始化 [`runtime.hiter`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/map.go#L165) 结构体，然后调用 [`runtime.mapiternext`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/map.go#L864) 获取下一个 `kv`。

首先来看下 `hiter` 这个结构体：

```go
type hiter struct {
	key         unsafe.Pointer // key 指针，指向本地迭代返回的 key， nil 表示迭代结束
	elem        unsafe.Pointer // val 指针，指向本地迭代返回的 elem，nil 表示迭代结束
	t           *maptype       // map 类型
	h           *hmap          // 表示当前 map
	buckets     unsafe.Pointer // 初始化时指向的 bucket
	bptr        *bmap          // 当前正在遍历的 bucket
	overflow    *[]*bmap       // keeps overflow buckets of hmap.buckets alive
	oldoverflow *[]*bmap       // keeps overflow buckets of hmap.oldbuckets alive
	startBucket uintptr        // 起始遍历的 bucket 编号
	offset      uint8          // 遍历开始的 cell 编号
	wrapped     bool           // 是否已经从0号桶开始遍历了
	B           uint8          // h.B
	i           uint8          // 指示当前的 cell 序号
	bucket      uintptr        // 当前遍历的 bucket 编号
	checkBucket uintptr        // 因为扩容需要检查的 bucket
}
```

首先看下 [`runtime.mapiterinit`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/map.go#L815) 的过程：

```go
func mapiterinit(t *maptype, h *hmap, it *hiter) {
	if raceenabled && h != nil {
		callerpc := getcallerpc()
		racereadpc(unsafe.Pointer(h), callerpc, abi.FuncPCABIInternal(mapiterinit))
	}

	it.t = t
	if h == nil || h.count == 0 {
		return
	}

	if unsafe.Sizeof(hiter{})/goarch.PtrSize != 12 {
		throw("hash_iter size incorrect") // see cmd/compile/internal/reflectdata/reflect.go
	}
	it.h = h

	// 获取当前 map 的一些状态存储在 it 中
	it.B = h.B
	it.buckets = h.buckets
	if t.bucket.ptrdata == 0 {
		h.createOverflow()
		it.overflow = h.extra.overflow
		it.oldoverflow = h.extra.oldoverflow
	}

	// 生成随机数
	r := uintptr(fastrand())
	if h.B > 31-bucketCntBits {
		r += uintptr(fastrand()) << 31
	}

	// 决定从哪个 bucket 开始遍历
	it.startBucket = r & bucketMask(h.B)
	// 决定从 bucket 的哪个 cell 开始遍历
	it.offset = uint8(r >> h.B & (bucketCnt - 1))

	// 迭代器的状态
	it.bucket = it.startBucket

	// 可以并发迭代
	if old := h.flags; old&(iterator|oldIterator) != iterator|oldIterator {
		atomic.Or8(&h.flags, iterator|oldIterator)
	}

	mapiternext(it)
}
```

从上面的代中可以解释为什么 `map` 的遍历是无序的，每次遍历的起始 `bucket` 和 `cell` 编号都是随机的。我们再来看看 [`runtime.mapiternext`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/map.go#L864) 的实现过程：

```go
func mapiternext(it *hiter) {
	h := it.h
	if raceenabled {
		callerpc := getcallerpc()
		racereadpc(unsafe.Pointer(h), callerpc, abi.FuncPCABIInternal(mapiternext))
	}

	// 不支持并发遍历和写
	if h.flags&hashWriting != 0 {
		throw("concurrent map iteration and map write")
	}
	t := it.t
	bucket := it.bucket
	b := it.bptr
	i := it.i
	checkBucket := it.checkBucket // 遍历正在扩容的 map 会用到，用于判断未搬迁的bucket中key是否会落到新的checkBucket中

next:

	// b 一开始是空的，得从上面选择的起始 bucket 定位到 bmap
	if b == nil {

		// 已将所有bucket都遍历完了
		if bucket == it.startBucket && it.wrapped {
			// 迭代结束
			it.key = nil
			it.elem = nil
			return
		}

		// 如果 map 正在扩容过程中，我们要遍历的 bucket 对应于一个老的 bucket，如果这个老的 bucket 还没有搬迁，那么就从老的
		// bucket 开始遍历；否则说明老的 bucket 已经搬迁结束，那么就从新的 bucket 直接开始遍历；
		if h.growing() && it.B == h.B {
			
			// 获取老的 bucket 编号和内存地址
			oldbucket := bucket & it.h.oldbucketmask()
			b = (*bmap)(add(h.oldbuckets, oldbucket*uintptr(t.bucketsize)))
			
			// 如果老的 bucket 未搬迁
			if !evacuated(b) {
				checkBucket = bucket
			} else {
				// 如果已经搬迁，那么依然从新的 bucket 开始遍历
				b = (*bmap)(add(it.buckets, bucket*uintptr(t.bucketsize)))
				checkBucket = noCheck
			}
		} else {
			b = (*bmap)(add(it.buckets, bucket*uintptr(t.bucketsize)))
			checkBucket = noCheck
		}

		// 获取到要遍历的 bmap 之后，bucket 就可以移动到下一个，如果到末尾了，就从0开始
		bucket++
		if bucket == bucketShift(it.B) {
			bucket = 0
			it.wrapped = true
		}
		// i 表示当前 bucket 已经遍历了几个 cell 了
		i = 0
	}

	for ; i < bucketCnt; i++ {

		// 获取到要遍历的 cell 编号，判断它是否为空，如果为空，就跳过
		offi := (i + it.offset) & (bucketCnt - 1)
		if isEmpty(b.tophash[offi]) || b.tophash[offi] == evacuatedEmpty {
			continue
		}

		// 获取到 key 对应的内存地址，如果间接 key，那么就获取存放真正键内容的地址
		k := add(unsafe.Pointer(b), dataOffset+uintptr(offi)*uintptr(t.keysize))
		if t.indirectkey() {
			k = *((*unsafe.Pointer)(k))
		}

		// 获取到存放值的地址
		e := add(unsafe.Pointer(b), dataOffset+bucketCnt*uintptr(t.keysize)+uintptr(offi)*uintptr(t.elemsize))
		
		if checkBucket != noCheck && !h.sameSizeGrow() {
			// 非等量扩容场景下，假如我们正在遍历的 bucket 对应的老 bucket 还没搬迁结束，
			// 所以我们就选择了从老的 bucket 开始遍历，但是我们在遍历老的 bucket 的时候，我们
			// 只遍历那些会裂变到新 bucket 的那些就可以。假设，老 map 的 0 号 bucket 会裂变到新
			// map 的 0 和 2 bucket，我们在遍历新 map 的 0 号 bucket 时，发现它未搬迁，我们就
			// 从老的 map 中 0 号 bucket 中挑出那些可以搬迁到新 map 的 0 号桶先遍历，然后在遍历
			// 新 map 的 2 号 bucket 时，再从老 map 的 0 号 bucket 中挑出那些要搬迁到新 map 的
			// 2 号桶的就可以。
			if t.reflexivekey() || t.key.equal(k, k) {
				hash := t.hasher(k, uintptr(h.hash0))
				if hash&bucketMask(it.B) != checkBucket {
					continue
				}
			} else {
				// 对于 math.NaN 这种每次都有不同哈希值的键值，处理方法类似，但是只根据 topHash 的
				// 最低位决定落到 X 还是 Y 部分。
				if checkBucket>>(it.B-1) != uintptr(b.tophash[offi]&1) {
					continue
				}
			}
		}
		if (b.tophash[offi] != evacuatedX && b.tophash[offi] != evacuatedY) ||
			!(t.reflexivekey() || t.key.equal(k, k)) {
			// 对于 NaN 这种类型 key，不能被删除，更新，和查找，可以返回它
			it.key = k
			if t.indirectelem() {
				e = *((*unsafe.Pointer)(e))
			}
			it.elem = e
		} else {
			// 重新获取 k 和 v，因为在迭代器开始后，可能由于更新，删除或者重新插入
			// 它可能被更新为相等但是不同的值，例如 （+0.0 和 -0.0）
			rk, re := mapaccessK(t, h, k)
			if rk == nil {
				continue // 可能在我们获取到 k 地址到这里，它已经被删除了
			}
			// 设置我们获取到的值
			it.key = rk
			it.elem = re
		}
		// 下一个要遍历的 bucket 
		it.bucket = bucket
		if it.bptr != b { // avoid unnecessary write barrier; see issue 14921
			it.bptr = b 			// 设置下一次要遍历的 bmap 对象
		}
		it.i = i + 1  				// 当前 bucket 遍历的 cell 数加一
		it.checkBucket = checkBucket
		return
	}
	b = b.overflow(t)
	i = 0
	goto next
}
```

我们来看一个示例，假设 `h.oldB = 1`，扩容之后 `h.newB = 2`，原先 `oldBuckets` 中 `0` 号桶需要搬迁到 `buckets` 中的 `0` 号和 `2` 号桶，但是还没有搬迁；原先 `oldBuckets` 中 `1` 号桶需要搬迁到 `buckets` 中的 `1` 号和 `3` 号桶，目前已经搬迁结束，重新哈希之后，`key1` 落到了 `buckets` 中的 `1` 号桶，`key2`，`key3` 和 `key4` 落到了 `buckets` 中的 `3` 号桶。如下图所示：

![](Go-map-iterate-process.png)

假设经过初始化之后，`it.startBucket = 3`，`it.offset = 2`，也就是会从上面 `buckets` 的 `3` 号桶的第 `3` 个 `cell` 开始遍历，遍历完 `3` 号桶及其溢出桶的 `8` 个 `cell` 之后，依次得到了 `key3`，`key2` 和 `key4` 这三个键。

然后从 `bucekts` 的 `0` 号桶开始，发现 `0` 号桶还没有搬迁，那么就从 `oldbuckets` 中的 `0` 号找到那些将要搬迁到 `buckets` 中 `0` 号桶的键，即 `key5`。

`0` 号桶遍历结束之后，接着遍历 `buckets` 的 `1` 号桶，找到了 `key1`；

在遍历 `buckets` 的 `2` 号桶时，发现它应该从 `oldbuckets` 的 `0` 号桶迁移过来，目前 `oldbuckets` 的 `0` 号桶还没有迁移结束，那就从`oldbuckets` 的 `0` 号桶中找到要搬迁到 `buckets` 中 `2` 号桶的 `key6`；

至此遍历结束，依次得到了 `key3`，`key2`，`key4`，`key5`，`key1`，`key6`。

### 为何遍历`map`是无序的 ?

这个获取是为了避免误解吧，因为 `map` 扩容之后，同一个 `bucket` 中的 `key` 要么保留在当前 `bucket` 中，要么转移到其他 `bucket`。如果按顺序遍历 `bucket`，按顺序遍历 `cell` ，在扩容之后这个顺序就无法避免了，所以干脆就让它保持这种无序，因此在遍历的时候引入随机数，每次都随机选择某个桶的某个 `cell` 开始。

### 浮点数是否可以作为键?

从语法上看，`Go` 语言中除了 `slice`，`map`，`function` 这几种不支持比较的类型之外都可以作为`map` 的键，具体包括：布尔值，数字，字符串，指针，通道，接口类型，结构体，以及只包含这些类型的数组。这些类型的共同特征是支持 `==` 和 `!=` 运算符，当 `k1 == k2` 时，它们可以被认为是同一个 `key`，如果是结构体，只有哈希后的值相等即字面值相等，才被认为是相同的 `key`。

来看一个浮点数做 `key` 的示例：

```go
package main

import (
	"fmt"
	"math"
)

func main() {
	var numbers = make(map[float64]int)
	numbers[1.4] = 1
	numbers[2.4] = 1
	numbers[math.NaN()] = 1
	numbers[math.NaN()] = 1

	fmt.Printf("numbers length: %d\n", len(numbers))

	fmt.Printf("key: %v, value: %v\n", math.NaN(), numbers[math.NaN()])
	fmt.Printf("key: %v, value: %v\n", 2.400000000001, numbers[2.400000000001])
	fmt.Printf("key: %v, value: %v\n", 2.40000000000000000000000000001, numbers[2.40000000000000000000000000001])

	fmt.Println(math.NaN() == math.NaN())
}
```

代码编译运行输出：

	numbers length: 4
	key: NaN, value: 0
	key: 2.400000000001, value: 0
	key: 2.4, value: 1
	false

说明浮点数可以作为 `key`，但是由于浮点数精度的问题会出现一些意想不到的问题。例如，`NaN` 是一个合法的浮点数，但是 `NaN != NaN`，虽然 `NaN` 返回的是一个固定值：

```go
const uvnan    = 0x7FF8000000000001
func NaN() float64 { return Float64frombits(uvnan) }
```

但是在计算浮点数哈希值的时候做了一些额外的处理，`NaN` 的哈希值计算引入了额外的随机数，导致每次使用[`runtime.f64hash`](https://github.com/golang/go/blob/8ed0e51b5e5cc50985444f39dc56c55e4fa3bcf9/src/runtime/alg.go#L74)计算 `NaN` 的哈希值都会得到不同的结果，所以可以往浮点数做键的 `map` 中插入任意数量的 `NaN`：

```go
func f64hash(p unsafe.Pointer, h uintptr) uintptr {
	f := *(*float64)(p)
	switch {
	case f == 0:
		return c1 * (c0 ^ h) // +0, -0
	case f != f:
		return c1 * (c0 ^ h ^ uintptr(fastrand())) // any kind of NaN
	default:
		return memhash(p, h, 8)
	}
}
```

而对于 `2.40000000000000000000000000001`，浮点数在作为键的时候，会使用 `math.Float64bits` 将其转换为 `uint64` 再插入：

```go
package main

import (
	"fmt"
	"math"
)

func main() {
	fmt.Println(math.Float64bits(2.4))
	fmt.Println(math.Float64bits(2.400000000001))
	fmt.Println(math.Float64bits(2.40000000000000000000000000001))
}
```

这将输出：

	4612586738352862003
	4612586738352864255
	4612586738352862003

所以说浮点数是有精度限制的，具体看 [`IEEE 754`](https://en.wikipedia.org/wiki/IEEE_754)，在做比较以及作为键值的时候要慎用。

### `map` 是否是协程安全的？

显然不是，在读、写、删除以及遍历的时候都会检测是否存在 `goroutine` 在写 `map`，如果有直接 `panic`。

如果要使用协程安全的 `map`，建议使用 `sync.Map`。

### `map` 遍历时可以删除吗？

`map` 不是一个线程安全的结构，如果同时有多个 `goroutine` 读写、遍历或者删除 `key` 可能会引发 `panic`，但是在同一个 `goroutine` 中是可以这样做的，因为每次删除 `key` 之后，会将写 `map` 的标记位清除掉，而且每次只在迭代 `mapiternext` 的开始检测是否存在其他 `goroutine` 写 `map`。

{% note success %}
```go
package main

func main() {
	numbers := make(map[int]int, 64)
	for k, _ := range numbers {
		delete(numbers, k)
	}
}
```
{% endnote %}

但是如果遍历时删除了尚未访问的 `key`，那么就不能再遍历到了。

### `map` 元素是否可以取地址？

当然不能，因为扩容之后存储 `key` 的地址就会发生变化，我们获取 `map` 元素地址的代码也是不能编译的。

{% note danger %}
```go
package main

func main() {
	m := make(map[int]int)
	fmt.Println(&m[0])
}
```
{% endnote %}

### `map` 使用注意事项

1. 相同的功能如果可以使用 `slice` 就不要用 `map`，因为 `map` 的 `key` 查找涉及到哈希值计算，`bucket` 和 `key` 的寻址等，而 `slice` 只是指针的移动。使用一个简单的例子来标间二者的性能差距：

	```go
	package main

	import "testing"

	type Person struct {
		Name   string
		Age    uint32
		Salary uint32
	}

	const num = 1000000

	func generateSlicePersons(n int) []Person {
		persons := make([]Person, n)
		for i := 0; i < n; i++ {
			persons[i] = Person{
				Name:   "test",
				Age:    uint32(i),
				Salary: uint32(i),
			}
		}
		return persons
	}

	func generateMapPersons(n int) map[int]Person {
		persons := make(map[int]Person, n)
		for i := 0; i < n; i++ {
			persons[i] = Person{
				Name:   "test",
				Age:    uint32(i),
				Salary: uint32(i),
			}
		}
		return persons
	}

	func BenchmarkAccessSlicePersons(b *testing.B) {
		persons := generateSlicePersons(num)
		b.ResetTimer()
		for i := 0; i < num; i++ {
			_ = persons[i]
		}
	}

	func BenchmarkAccessMapPersons(b *testing.B) {
		persons := generateMapPersons(num)
		b.ResetTimer()
		for i := 0; i < num; i++ {
			_ = persons[i]
		}
	}
	```

	测试数据如下：

		BenchmarkAccessSlicePersons
		BenchmarkAccessSlicePersons-10    	1000000000	         0.0003243 ns/op
		BenchmarkAccessMapPersons
		BenchmarkAccessMapPersons-10      	1000000000	         0.04320 ns/op