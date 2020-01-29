---
title: Go语言基础《五》：map
date: 2018-10-31 20:45:54
categories:
  - Go语言基础
tags:
  - map
---

散列表是设计精妙，用途广发的数据结构之一，它是一个拥有键值对元素的无需集合。在这个集合中，键的值是惟一的，键对应的值可以通过键来获取，更新或者移除。无论这个散列表多大，这些操作基本上都是在常量时间内就可以完成。

Go语言中，map 是散列表的应用，map 的类型是 `map[K]V`，其中 `K` 和 `V` 是字典键和值对应的数据类型。map 中所有键都拥有相同的数据类型，同时所有值都拥有相同的数据类型，但是键的类型和值的类型不一定相同。**键的类型`K`，必须是可以通过 `==` 操作符来进行比较的数据类型，`K` 的类型是受限的，`V` 的类型是任意的**，

深究一下，比如我们要在哈希表中查找与某个键值对应的那个元素值，那么我们需要先把键值作为参数传给这个哈希表。哈希表会先用哈希函数（hash function）把键值转换为哈希值。哈希值通常是一个无符号的整数。一个哈希表会持有一定数量的桶（bucket），也可称之为哈希桶，这些哈希桶会均匀地储存其所属哈希表收纳的那些键 - 元素对。因此，哈希表会先用这个键的哈希值的低几位去定位到一个哈希桶，然后再去这个哈希桶中，查找这个键。由于键 - 元素对总是被捆绑在一起存储的，所以一旦找到了键，就一定能找到对应的元素值。随后，哈希表就会把相应的元素值作为结果返回。只要这个键 - 元素对存在于哈希表中就一定会被查找到，因为哈希表增、改、删键 - 元素对时侯的映射过程，与前文所述如出一辙。

所以，`K` 的类型不能是函数类型，字典类型，切片类型，因为这些类型不支持 `==` 和 `!=` 操作符，换句话说，键值必须要支持判等操作，因为前面的三种类型不支持这两个操作，所以不能用作键。

{% asset_img cover.jpeg cover %}

<!--more-->

### 创建 map

可以使用内置函数 `make` 来创建一个 `map`，也可以使用 `map` 的对象字面量来新建一个带初始化键值对元素的字典：

```go
func main() {
	var ages = make(map[string]int)
	ages["michael"] = 25
	fmt.Printf("michael 的年龄是：%d\n", ages["michael"])   // michael 的年龄是：25

	var scores = map[string]float64{
		"michael": 88.88,
	}
	fmt.Printf("michael 的成绩是：%g\n", scores["michael"]) // michael 的成绩是：88.88
}

```

也可以新建一个空的map：`map[string]int{}`


### 从 map 中删除元素

可以使用内置的函数 `delete` 从字典中根据键删除一个元素，即使键不再字典中，删除操作也是安全的。**map 使用给定的键来查找元素，如果对应的元素不存在，就会返回值类型的零值**。但是map元素不是一个变量，不可以获取它的地址。

```go
func main() {
	var ages = make(map[string]int)
	ages["michael"] = 25

	// key: gamelife 并不存在，所以获取到的值是：0
	fmt.Printf("gamelife 的年龄是：%d\n", ages["gamelife"]) // gamelife 的年龄是：0

	var scores = map[string]float64{
		"michael":  88.88,
		"gamelife": 99.99,
	}
	fmt.Printf("michael 的成绩是：%g\n", scores["michael"]) // michael 的成绩是：88.88
	fmt.Println(scores)                                // map[michael:88.88 gamelife:99.99]
	delete(scores, "gamelife")
	fmt.Println(scores) // map[michael:88.88]
}

```

### 遍历map

可以使用 `for` 循环来遍历map中所有键和对应的值，就像之前遍历slice一样。map 中元素的迭代顺序是不固定的，不同的实现方法会使用不同三列算法，得到不同的元素顺序。

```go
func main() {

	var scores = map[string]float64{
		"michael":  88.88,
		"gamelife": 99.99,
		"小明":       50,
		"小花":       60,
	}
	for name, score := range scores {
		fmt.Printf("scores['%s']=%g\n", name, score)
	}
}
```

#### 按序遍历map

如果要按固定的顺序遍历map，那就必须将key存在一个有序的序列中，然后根据这个序列访问map；

```go
func main() {

	var names = []string{"michael", "gamelife", "小明", "小花"}

	var scores = map[string]float64{
		"michael":  88.88,
		"gamelife": 99.99,
		"小明":       50,
		"小花":       60,
	}
	for name, score := range scores {
		fmt.Printf("scores['%s']=%g\n", name, score)
	}

	fmt.Printf("\n\n")

	for _, name := range names {
		fmt.Printf("scores['%s']=%g\n", name, scores[name])
	}
}

```

上面一组的输出结果依据每次执行，但是下面一组是固定的：

    scores['小花']=60
    scores['michael']=88.88
    scores['gamelife']=99.99
    scores['小明']=50


    scores['michael']=88.88
    scores['gamelife']=99.99
    scores['小明']=50
    scores['小花']=60

### map零值：nil

`map` 的零值是 `nil`，此时的 map 没有引用任何散列表。大多数的 map 操作可以安全地在零值 nil 上执行，包括查找元素，删除元素，获取元素的个数(`len`)，执行 `for range` 循环，因为这个空的map的行为一致，**但是向零值map中设置元素会导致错误, 设置元素💰，必须初始化map**。

```go
func main() {
	var scores map[string]float64
	fmt.Printf("len(scores)=%d\n", len(scores))
	fmt.Printf("scores['%s']=%g\n", "gamelife", scores["gamelife"])
	delete(scores, "gamelife")
	for name, score := range scores {
		fmt.Printf("scores['%s']=%g\n", name, score)
	}
	scores["gamelife"] = 23.44
}
```

程序执行结果如下：

    len(scores)=0
    scores['gamelife']=0
    panic: assignment to entry in nil map

    goroutine 1 [running]:
    main.main()
        /Users/fudenglong/workdir/go/src/github.com/gamelife1314/go_study/main.go:13 +0x318

    Process finished with exit code 2

### 检查键值是否存在

因为通过下表的方式访问 map 中的元素总会有值。如果键在map中将得到相应的值，如果不在，会得到值类型的默认值。这在有些情况下，很不便，你无法根据值判断出这个键是否存在于map中。通过下表方式访问map中的元素会得到两个值，第一个是键对应的值，第二个是个布尔值， 表示该键是否存在与map中。

```go
func main() {
	var scores = map[string]float64{
		"michael": 88.88,
	}

	if score, ok := scores["gamelife"]; !ok {
		fmt.Printf("gamelife 的成绩不存在\n")
	} else {
		fmt.Printf("gamelife 的成绩是：%g\n", score)
	}

	if score, ok := scores["michael"]; !ok {
		fmt.Printf("michael 的成绩不存在")
	} else {
		fmt.Printf("michael 的成绩是：%g", score)
	}
}
```

程序输出：

    gamelife 的成绩不存在
    michael 的成绩是：88.88

### 使用map模拟集合

Go 虽然没有提供集合类型，但是既然 map 的键都是唯一的，就可以用 map 来实现这个功能。

```go
type IntSet struct {
	values map[int]interface{}
	len    int
}

func (s *IntSet) Append(value int) {
	if s.values == nil {
		s.values = make(map[int]interface{})
	}
	if _, ok := s.values[value]; !ok {
		s.values[value] = struct{}{}
		s.len += 1
	}
}

func (s *IntSet) Elements() []int {
	var elements = make([]int, s.len)
	index := 0
	for k := range s.values {
		elements[index] = k
		index++
	}
	return elements
}

func main() {
	var intSet IntSet
	intSet.Append(1)
	intSet.Append(2)
	intSet.Append(1)
	intSet.Append(2)
	fmt.Println(intSet.len)        // 2
	fmt.Println(intSet.Elements()) // [1 2]
}
```