---
title: Go 反射系统
date: 2020-05-22 23:26:31
tags:
---

反射让我们能在运行期间弹指对象的类型信息和内存结构，这从一定程度上弥补了静态语言在动态行为上的不足。同时，反射也是实现元编程的重要手段。

{% asset_img cover.jpg cover %}

<!--more-->

和 C 数据结构一样，Go 对象头部并没有类型指针，通过其自身是无法在运行期间获知任何类型相关信息的。反射操作需要的全部信息都源自接口变量，接口变量除了存储自身类型外，还会保存实际对象的类型数据，所以在开始反射之前，先一探接口的实质。

### 接口类型

#### 基本规则

接口有时候也被称作协议（ptotocol），代表一种调用契约，是多个方法的集合。接口解除了类型依赖，有助于减少用户可视方法，屏蔽内部结构和实现细节。接口最常用的常见用途是用来约定对外的访问方式。

Go 的接口类型实现很简洁，只要目标类型实方法集包含了接口声明的全部方法，就相当于实现了该接口，无需做显示的声明。这种方式导致我们在使用 Go 的接口时，经常是先实现类型，再去抽象出接口。这么设计是相当有好处的，因为在一开始设计出合理的接口是非常不容易的，又或者是在使用第三方库的时候，将所需的功能抽象出接口，即可屏蔽太多不需要关注的内容，也可用于日后功能替换。

Go 的接口从内部实现来看，接口自身也是一种结构体类型，只是编译器会对它做出很多限制：

- 不能有字段
- 不能定义自己的方法
- 只能声明方法，不能实现
- 可以嵌入其他的接口类型

Go 的结构体定义是在 `runtime/runtime2.go` 文件中：

```go
type iface struct {
	tab  *itab
	data unsafe.Pointer
}
```

如果一个接口没有任何方法声明，那么它就是一个空接口（`interface{}`），它的用途类似面向对象里面的 `Object` 类型，可以被赋值任何类型的对象。有一点是比较重要的，接口的默认值是：**`nil`**，只有在实现接口类型支持的情况下才可以做相等运算。

```go
func Test_interface_equal_operation(t *testing.T) {
	var t1, t2 interface{}
	println(t1 == t2)
	t1, t2 = 100, 100
	println(t1 == t1)
	t1, t2 = map[string]int{}, map[string]int{}
	println(t1 == t2)
}
```
运行这个测试案例是会 `panic` 的，因为 `map` 类型是不支持比较的：

![接口比较](interface_compare.png)

因为不支持重载，所以在包含其他接口类型时候，同名的方法是不被允许的，也不能导入自身。Go 中也是支持匿名接口类型的，可直接用于变量定义或者作为结构体字段类型。

```go
type data struct{}

func (d data) string() string {
	return ""
}

type node struct {
	data interface {
		string() string
	}
}

func Test_anonymous_interface(t *testing.T) {
	var i interface {
		string() string
	} = data{}
	n := node{
		data: i,
	}
	println(n.data.string())
}
```

#### 执行机制

接口是使用一个名为 itab 的结构体存储运行期间所需的相关类型信息：

```go
type iface struct {
	tab  *itab
	data unsafe.Pointer
}
type itab struct {
	inter *interfacetype
	_type *_type
	hash  uint32 // copy of _type.hash. Used for type switches.
	_     [4]byte
	fun   [1]uintptr // variable sized. fun[0]==0 means _type does not implement inter.
}
type eface struct {
	_type *_type
	data  unsafe.Pointer
}
```

利用调试器，可以查看这些结构存储的具体内容，下面是我们的示例代码：

```go
package main

import "fmt"

type Reader interface {
	Read(string)
}

type People struct {
	name string
}

func (p People) Read(s string) {
	fmt.Println(p.name, "I'm reading", s)
}

func main() {
	p := &People{name: "michael"}
	p1 := People{name: "jiujiu"}
	var r Reader = p
	var r1 Reader = p1
	fmt.Printf("p: %p, p1: %p\n", p, &p1)
	r.Read("hello world")
	r1.Read("hello world")
}
```

使用如下的命令编译（工作机：MacOS，Mac上调试有问题，编译好之后扔到linux调试）：

> GOOS=linux go build -gcflags="-N -l" -o main_linux  main.go

然后复制到我的 Ubuntu 容器中调试：

> docker cp ./main_linux 913ecec6c8c3:/workdir/

![gdb调试](gdb-interface.png)

从结果中我们可以看出，当把值赋值给接口变量时，是会发生值复制的，指针类型变量复制的是地址，非指针类型变量会复制出一个新的对象然后填充到 `iface` 中的 `data` 字段。而且，我们甚至无法修改接口存储的非指针类型复制品，因为它是 unaddressable 的，所以想要修改接口存储的值就必须给它赋值一个指针。

![接口赋值](unaddressable-iface.png)

还有一个需要注意的是，只有 iface 中 `tab` 和 `data` 都为 nil 时，接口才等于 nil。

```go
package main

import "fmt"

func main() {
	var t interface{} = nil
	var t1 interface{} = (*int)(nil)
	fmt.Println(t == nil, t1 == nil)
}
```

编译并且使用 GDB 调试结果如下：

![空接口](empty-interface.png)

而且发现空接口在运行时的表示是 `eface` 结构体。

### 反射

前面讲了结构体类型，现在开始学习反射，Go语言为了我们提供了两个入口函数：`reflect.ValueOf` 和 `reflect.TypeOf`，这两个反射入口函数，会将任何传入的对象转换为接口类型。在面对类型时，需要区分 `Type` 和 `Kind`，前者表示真实类型，后者表示底层基础类型，因为 Go 语言是可以以底层类型为基础，定义新的类型，例如：

```go
type ID int

func Test_type_and_kind(t *testing.T) {
	var id ID = 99
	typ := reflect.TypeOf(id)
	t.Log(typ.Name(), typ.Kind())
}

// ID int
```



#### Type

`reflect.Type()` 会获取到传入的 `interface{}` 中的类型部分。


##### 类型构造

我们可以通过实际对象获取类型，也可以直接构造一些基础符合类型。例如：

```go
package main

import (
	"fmt"
	"reflect"
)

func main() {
	// 构造 channel 类型
	chType := reflect.ChanOf(reflect.BothDir, reflect.TypeOf(0))
	chRecvType := reflect.ChanOf(reflect.SendDir, reflect.TypeOf(0))
	chSendType := reflect.ChanOf(reflect.SendDir, reflect.TypeOf(0))
	fmt.Println(chType, chRecvType, chSendType)
	// 构造 map 类型
	mType := reflect.MapOf(reflect.TypeOf(""), reflect.TypeOf(0))
	fmt.Println(mType)
	// 构造 slice 类型
	sliceType := reflect.SliceOf(mType)
	fmt.Println(sliceType)
	// 构造函数类型
	in := []reflect.Type{sliceType}
	out := []reflect.Type{reflect.TypeOf("")}
	funcType := reflect.FuncOf(in, out, true)
	fmt.Println(funcType)
	// 构造结构体类型
	structType := reflect.StructOf([]reflect.StructField{
		{Name: "Name", Type: reflect.TypeOf("")},
	})
	fmt.Println(structType)
	// 构造数组类型
	arrayType := reflect.ArrayOf(10, reflect.TypeOf(""))
	fmt.Println(arrayType)
}
```
	# 输出如下：
	chan int chan<- int chan<- int
	map[string]int
	[]map[string]int
	func(...map[string]int) string
	struct { Name string }
	[10]string

##### 基类型

传入对象分为基类型和指针类型，因为它们并不是同一类型，指针类型通过 `.Elem()` 获取基类型：

```go
func Test_base_type(t *testing.T) {
	x := 100
	tx, tp := reflect.TypeOf(x), reflect.TypeOf(&x)
	fmt.Println(tx, tp, tx == tp)
	fmt.Println(tx.Kind(), tp.Kind())
	fmt.Println(tx == tp.Elem())

	m := make(map[string]int, 0)
	fmt.Println(reflect.TypeOf(m).Elem())
	s := make([]int32, 0, 0)
	fmt.Println(reflect.TypeOf(s).Elem())
	// int *int false
	// int ptr
	// true
	// int
	// int32
}
```

只有在获取指针的基类型之后，我们才能遍历它的字段：

```go
type user struct {
	name string
	age  int
}

type manager struct {
	user
	title string
}

func Test_iter_struct(t *testing.T) {
	var m manager
	mt := reflect.TypeOf(&m)
	if mt.Kind() == reflect.Ptr {
		mt = mt.Elem()
	}
	for i := 0; i < mt.NumField(); i++ {
		f := mt.Field(i)
		fmt.Println(f.Name, f.Type, f.Offset)
		if f.Anonymous {
			for j := 0; j < f.Type.NumField(); j++ {
				af := f.Type.Field(j)
				fmt.Println(" ", af.Name, af.Type)
			}
		}
	}
	//user main.user 0
	//name string
	//age int
	//title string 24
}

```

##### 结构体字段访问

可以通过名字 `FieldByName(string)` 或者索引 `FieldByIndex([]int{})` 直接访问字段。

```go
type user struct {
	name string `tag:"user"`
	age  int
}

type animal struct {
	name string `tag:"animal"`
	user
}

func Test_visit_field(t *testing.T) {
	var a animal
	var at = reflect.TypeOf(a)
	animalName, _ := at.FieldByName("name")
	fmt.Println(animalName.Name, animalName.Tag.Get("tag"))
	user, _ := at.FieldByName("user")
	userName, _ := user.Type.FieldByName("name")
	fmt.Println(userName.Name, userName.Tag.Get("tag"))
	age := at.FieldByIndex([]int{1, 1})
	fmt.Println(age.Name, age.Offset)
	//name animal
	//name user
	//age 16
}
```

##### 类型方法

可以通过 `.Method(int)` 方法， `NumMethod()` 以及 `MethodByName` 获取到类型的方法。

```go
type method struct{}

func (m method) BaseMethod() {}

func (m *method) PtrMethod() {}

func Test_output_type_method(t *testing.T) {
	var m method
	mt := reflect.TypeOf(m)
	for i := 0; i < mt.NumMethod(); i++ {
		fmt.Println("mt", mt.Method(i))
	}
	mPtrt := reflect.TypeOf(&m)
	for j := 0; j < mPtrt.Elem().NumMethod(); j++ {
		fmt.Println("mPtrt", mPtrt.Method(j))
	}
	fmt.Println(mt.MethodByName("BaseMethod"))
	//mt {BaseMethod  func(main.method) <func(main.method) Value> 0}
	//mPtrt {BaseMethod  func(*main.method) <func(*main.method) Value> 0}
	//{BaseMethod  func(main.method) <func(main.method) Value> 0} true
}

```

##### 获取未导出字段

反射能探知当前包或者外包的未导出结构成员，因为对于 `reflect` 包来说，其他包都是外包：

```go
func Example_print_unexported_fields() {
	var s http.Server
	t := reflect.TypeOf(s)
	for i := 0; i < t.NumField(); i++ {
		fmt.Println(t.Field(i).Name, t.Field(i).Offset)
	}
	// output:
	//Addr 0
	//Handler 16
	//TLSConfig 32
	//ReadTimeout 40
	//ReadHeaderTimeout 48
	//WriteTimeout 56
	//IdleTimeout 64
	//MaxHeaderBytes 72
	//TLSNextProto 80
	//ConnState 88
	//ErrorLog 96
	//BaseContext 104
	//ConnContext 112
	//disableKeepAlives 120
	//inShutdown 124
	//nextProtoOnce 128
	//nextProtoErr 144
	//mu 160
	//listeners 168
	//activeConn 176
	//doneChan 184
	//onShutdown 192
}
```

##### 结构体tag提取

可以通过结构体字段的 `Tag` 字段提供的方法获取该字段的标签。

```go
type fieldTag struct {
	Name string `json:"name" length:"12" Null:"false"`
}

func Example_get_field_tag() {
	var f fieldTag
	t := reflect.TypeOf(f)
	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)
		tag := field.Tag
		fmt.Printf("%s, legnth: %s, Null: %s\n", field.Name, tag.Get("length"), tag.Get("Null"))
	}
	// output:
	// Name, legnth: 12, Null: false
}

```

##### 其他方法

- `.Implemnts(Type) bool` 用于判断某个实行是否实现一个接口；

- `.ConvertibleTo(u Type) bool` 用于判断该类型的值能否转换为 u 类型；

- `.AssignableTo(u Type) bool` 用于表示该类型的值是否可以赋值给 u 类型；

- `.Comparable()` 检查该类型的值是否可以比较；

```go
type X int

func (X) String() string {
	return ""
}

func Example_type_other_methods() {
	var x X
	xt := reflect.TypeOf(x)
	st := reflect.TypeOf((*fmt.Stringer)(nil)).Elem()
	emptyInterface := reflect.TypeOf((*interface{})(nil)).Elem()
	fmt.Println("x implements fmt.Stringer", xt.Implements(st))
	fmt.Println("x implements interface{}", xt.Implements(emptyInterface))

	fmt.Println("x can convert to int", xt.ConvertibleTo(reflect.TypeOf(0)))
	fmt.Println("x can convert to string", xt.ConvertibleTo(reflect.TypeOf("")))
	fmt.Println("x can convert to map[string]string", xt.ConvertibleTo(reflect.TypeOf(reflect.MapOf(reflect.TypeOf(""), reflect.TypeOf("")))))

	fmt.Println("x can assign to fmt.Stringer", xt.AssignableTo(st))
	fmt.Println("x can assign to int", xt.AssignableTo(reflect.TypeOf(0)))

	fmt.Println("x is Comparable", xt.Comparable())
	// output:
	//x implements fmt.Stringer true
	//x implements interface{} true
	//x can convert to int true
	//x can convert to string true
	//x can convert to map[string]string false
	//x can assign to fmt.Stringer true
	//x can assign to int false
	//x is Comparable true
}
```

#### Value

和 Type 获取类型信息不同，Value 专注于对象示例的数据读写。在前文提到过，`reflect.Type()` 和 `reflect.Value()` 传入对的都是接口变量，而接口变量会复制对象，并且是 unaddressable 的，所以要想修改目标对象，就必须使用指针。

```go
func Example_value_and_ptr() {
	a := 100
	va, vp := reflect.ValueOf(a), reflect.ValueOf(&a).Elem()
	fmt.Println(va.CanAddr(), va.CanSet())
	fmt.Println(vp.CanAddr(), vp.CanSet())
	// output:
	//false false
	//true true
}
```

##### 修改结构体字段值

不能直接对非导出字段进行设置操作，无论是当前包还是外包，但是可以通过 `unsafeAddr()` 获取字段地址然后再修改：

```go
type User struct {
	Name string
	code string
}

func Example_canset_unexported_fields() {
	user := new(User)
	userValue := reflect.ValueOf(user).Elem()
	name := userValue.FieldByName("Name")
	code := userValue.FieldByName("code")
	fmt.Printf("Name can addr = %t, can set %t\n", name.CanAddr(), name.CanSet())
	fmt.Printf("code can addr = %t, can set %t\n", code.CanAddr(), code.CanSet())
	if name.CanSet() {
		name.SetString("michael")
	}
	if code.CanAddr() {
		*(*string)(unsafe.Pointer(code.UnsafeAddr())) = "code"
	}
	fmt.Println(user)
	// output:
	//Name can addr = true, can set true
	//code can addr = true, can set false
	//&{michael code}
}
```

##### `Pointer() 和 UnsafeAddr()`

`reflect.Value.Pointer()` 返回的是该字段存储的指针，目标必须是指针类型；而 `reflect.Value.UnsafeAddr()` 返回任何可以 CanAddr 的 Value 的地址，返回的是该字段自身地址（结构体地址+偏移量）。例如：

```go
type Dog struct {
	Age  *int
	Name string
}

func Example_pointer_and_unsafePointer() {
	year := 11
	var dog = Dog{Age: &year}
	dogValue := reflect.ValueOf(&dog).Elem()

	age := dogValue.FieldByName("Age")
	name := dogValue.FieldByName("Name")

	fmt.Println(age.Pointer(), uintptr(unsafe.Pointer(&year)))
	fmt.Println(name.UnsafeAddr(), uintptr(unsafe.Pointer(&dog))+unsafe.Offsetof(dog.Name))
	// output:
	//824634393936 824634393936
	//824634442536 824634442536
}
```


##### `.Interface()`

可以通过 `.Interface()` 方法进行类型推断和转换：

```go
type User struct {
	Name string
	code string
}

func Example_value_interface() {
	var user = User{Name: "unsafe", code: "code"}
	userValue := reflect.ValueOf(&user)
	if userValue.CanInterface() {
		userPtr, ok := userValue.Interface().(*User)
		if ok {
			userPtr.Name = "michael"
			fmt.Println(user)
		}
	}
	//output:
	// {michael code}
}
```

注意这里使用 `Interface()` 方法时没有调用 `.Elem()` 方法。

##### `.IsNil()`

接口类型有两种 nil 状态，很难判断，一致是个潜在麻烦，解决方案有两种，一种是通过 `.IsNil()` 判断，一种是通过 unsafe 转换后直接判断 `iface.data` 是否是零值：

```go
func Example_interface_is_nil() {
	var (
		empty  interface{} = nil
		empty1 interface{} = (*int)(nil)
	)
	// 方法一：
	fmt.Println(empty == nil, empty1 == nil, reflect.ValueOf(empty1).IsNil())

	// 方法二：
	iface := (*[2]uintptr)(unsafe.Pointer(&empty))
	iface1 := (*[2]uintptr)(unsafe.Pointer(&empty1))
	fmt.Println(iface[1] == 0, iface1[1] == 0)

	// output:
	// true false true
	// true true
}
```

##### `.IsValid() 和 .IsZero()`

`.IsValid()` 报告当前 value 是不是一个有效的 `reflect.Value` 类型的值，如果不是，除了 `String()` 之外，其他的方法调用都会 panic。

`.IsZero()` 用于表示当前 value 是不是该类型的零值；

```go
type User struct {
	Name string
	code string
}

func Example_value_is_valid_and_is_zero() {
	var (
		zero    int
		nonZero = 1
		user    User
	)
	fmt.Println("zero IsZero = ", reflect.ValueOf(zero).IsZero())
	fmt.Println("nonZero IsZero = ", reflect.ValueOf(nonZero).IsZero())
	fmt.Println("user.code field IsValid = ", reflect.ValueOf(user).FieldByName("code").IsValid())
	fmt.Println("user.xxx field IsValid = ", reflect.ValueOf(user).FieldByName("xxx").IsValid())
	// output:
	//zero IsZero =  true
	//nonZero IsZero =  false
	//user.code field IsValid =  true
	//user.xxx field IsValid =  false
}
```

#### `reflect.Append`

`reflect.Append(s Value, x ...Value) Value` 用于将 `values` 追加到 slice 中：

```go
func Example_reflect_append() {
	var s = make([]int, 0, 0)
	sv := reflect.ValueOf(s)
	sv = reflect.Append(sv, reflect.ValueOf(2), reflect.ValueOf(1))
	fmt.Println(sv.Interface().([]int))

	var s1 = []int{3, 4, 5}
	s1v := reflect.ValueOf(&s1).Elem()
	s1v = reflect.AppendSlice(s1v, sv)
	fmt.Println(s1v.Interface().([]int))
	// output:
	// [2 1]
	// [3 4 5 2 1]
}
```

#### 动态方法调用

`.Call()` 和 `.CallSlice()` 用于动态的方法调用：

```go
func Example_dynamic_call_method() {
	var y Y
	value := reflect.ValueOf(y)
	format := value.MethodByName("Format")

	fmt.Println(format.Call([]reflect.Value{
		reflect.ValueOf("%s = %d"),
		reflect.ValueOf("x"),
		reflect.ValueOf(10),
	}))

	fmt.Println(format.CallSlice([]reflect.Value{
		reflect.ValueOf("%s = %d"),
		reflect.ValueOf([]interface{}{"y", 100}),
	}))
	// output:
	//[x = 10]
	//[y = 100]
}

```
