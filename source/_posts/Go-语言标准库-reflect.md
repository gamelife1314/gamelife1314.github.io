---
title: Go 扩展包：reflect
date: 2018-01-04 20:29:23
categories:
  - Go 标准库
tags:
  - reflect
---

本篇主要内容来自go圣经，《Go程序设计语言》；

为什么使用反射，有时需要写一个函数能够有能力处理各种输入类型，而这些类型可能无法共享同一个接口，也可能布局未知，也有可能这个类型在我们设计函数的时候并不存在；一个最熟悉的例子是`fmt.Printf`中的格式化逻辑，他可以输出任意类型的任意值，甚至是用户自定义的类型；我们常用的做法是什么呢，使用一个switch分支来判断参数的动态类型是否是基本类型，然后对每种不同的类型做不同的判断。

但是当我们无法透视一个未知类型的布局时，我们的需求就无法继续，这个时候就该`reflect`了；

<!--more-->


### `reflect.Type`

反射功能由`reflect`包提供，他定义了两个重要类型：`reflect.Type` 和 `reflect.Value`。 `Type` 表示go语言的一个类型，**它是一个有很多方法的接口**，这些方法用来识别类型以及透视类型的组成部分，比如一个结构的各个字段或者一个函数的各个参数。`reflect.Type` 只有一个实现，即类型描述符，接口值的动态类型也是类型描述符；


Type 接口如下，摘自[https://studygolang.com/pkgdoc](https://studygolang.com/pkgdoc)

```go
type Type interface {
    // Kind返回该接口的具体分类
    Kind() Kind
    // Name返回该类型在自身包内的类型名，如果是未命名类型会返回""
    Name() string
    // PkgPath返回类型的包路径，即明确指定包的import路径，如"encoding/base64"
    // 如果类型为内建类型(string, error)或未命名类型(*T, struct{}, []int)，会返回""
    PkgPath() string
    // 返回类型的字符串表示。该字符串可能会使用短包名（如用base64代替"encoding/base64"）
    // 也不保证每个类型的字符串表示不同。如果要比较两个类型是否相等，请直接用Type类型比较。
    String() string
    // 返回要保存一个该类型的值需要多少字节；类似unsafe.Sizeof
    Size() uintptr
    // 返回当从内存中申请一个该类型值时，会对齐的字节数
    Align() int
    // 返回当该类型作为结构体的字段时，会对齐的字节数
    FieldAlign() int
    // 如果该类型实现了u代表的接口，会返回真
    Implements(u Type) bool
    // 如果该类型的值可以直接赋值给u代表的类型，返回真
    AssignableTo(u Type) bool
    // 如该类型的值可以转换为u代表的类型，返回真
    ConvertibleTo(u Type) bool
    // 返回该类型的字位数。如果该类型的Kind不是Int、Uint、Float或Complex，会panic
    Bits() int
    // 返回array类型的长度，如非数组类型将panic
    Len() int
    // 返回该类型的元素类型，如果该类型的Kind不是Array、Chan、Map、Ptr或Slice，会panic
    Elem() Type
    // 返回map类型的键的类型。如非映射类型将panic
    Key() Type
    // 返回一个channel类型的方向，如非通道类型将会panic
    ChanDir() ChanDir
    // 返回struct类型的字段数（匿名字段算作一个字段），如非结构体类型将panic
    NumField() int
    // 返回struct类型的第i个字段的类型，如非结构体或者i不在[0, NumField())内将会panic
    Field(i int) StructField
    // 返回索引序列指定的嵌套字段的类型，
    // 等价于用索引中每个值链式调用本方法，如非结构体将会panic
    FieldByIndex(index []int) StructField
    // 返回该类型名为name的字段（会查找匿名字段及其子字段），
    // 布尔值说明是否找到，如非结构体将panic
    FieldByName(name string) (StructField, bool)
    // 返回该类型第一个字段名满足函数match的字段，布尔值说明是否找到，如非结构体将会panic
    FieldByNameFunc(match func(string) bool) (StructField, bool)
    // 如果函数类型的最后一个输入参数是"..."形式的参数，IsVariadic返回真
    // 如果这样，t.In(t.NumIn() - 1)返回参数的隐式的实际类型（声明类型的切片）
    // 如非函数类型将panic
    IsVariadic() bool
    // 返回func类型的参数个数，如果不是函数，将会panic
    NumIn() int
    // 返回func类型的第i个参数的类型，如非函数或者i不在[0, NumIn())内将会panic
    In(i int) Type
    // 返回func类型的返回值个数，如果不是函数，将会panic
    NumOut() int
    // 返回func类型的第i个返回值的类型，如非函数或者i不在[0, NumOut())内将会panic
    Out(i int) Type
    // 返回该类型的方法集中方法的数目
    // 匿名字段的方法会被计算；主体类型的方法会屏蔽匿名字段的同名方法；
    // 匿名字段导致的歧义方法会滤除
    NumMethod() int
    // 返回该类型方法集中的第i个方法，i不在[0, NumMethod())范围内时，将导致panic
    // 对非接口类型T或*T，返回值的Type字段和Func字段描述方法的未绑定函数状态
    // 对接口类型，返回值的Type字段描述方法的签名，Func字段为nil
    Method(int) Method
    // 根据方法名返回该类型方法集中的方法，使用一个布尔值说明是否发现该方法
    // 对非接口类型T或*T，返回值的Type字段和Func字段描述方法的未绑定函数状态
    // 对接口类型，返回值的Type字段描述方法的签名，Func字段为nil
    MethodByName(string) (Method, bool)
    // 内含隐藏或非导出方法
}
```

`reflect.TypeOf` 函数接受任何的 `interface{}` 参数，并且把接口中的动态类型以 `reflect.Type` 的形式返回；

```go
t := reflect.TypeOf(3)  // 一个reflect.Type值
fmt.PrintLn(t.String()) // "int"
fmt.PrintLn(t)          // "int"
```

把一个具体指赋值给一个接口类型的时候会发生一个隐式类型的转换，转换会生成一个**包含两部分内容的接口值**：动态类型部分是操作数的类型（上例：int），动态值部分是操作数的值（上例：3）; 因为`reflect.TypeOf`返回一个接口值对应的动态类型，所以他返回的**总是具体类型(而不是接口类型)**。比如下例中输出的是`*.os.File`，而不是`io.Writer`。

```go
var w io.Writer = os.Stdout
fmt.PrintLn(w)   // *os.File
```

注意：`reflect.Type` 满足 `fmt.Stringer`。因为输出一个接口的动态类型在调试和日志常用，因此 `fmt.Printf` 提供了一个简写方式`%T`，内部实现就是使用了`reflect.TypeOf`。

### `reflect.Value`

说完了`reflect.Type`，说说reflect包的另一个重要类型：`Value`。`reflect.Value` 可以包含一个任意类型的值。`relect.ValueOf` 函数接受任意的 `interface{}` 并将接口的动态值以 `reflect.Value` 的形式返回。与 `reflect.TypeOf` 相似，它返回的也是具体指，不过 `reflect.Value` 也可以包含一个接口值.

```go
v := reflect.ValueOf(3)  // 一个reflect.Value
fmt.PrintLn(v)           // "3"
fmt.Printf("%v", v)      // "3"
fmt.PrintLn(v.String())  // 注意：<int Value> 
```
另一个与`relfect.Type`类似的是，`reflect.Value` 也满足了`fmt.Stringer`，但是除非 Value 包含的是一个字符串，否则 String 方法仅仅暴露了类型。通常情况下，可以使用fmt包的 `%v` 功能，他会对`reflect.Value`值进行处理；

调用 `Value` 的 `Type` 方法会把它的类型以 `reflect.Type` 的形式返回:

```go
t := v.Type()            // 一个reflect.Type值
fmt.PrintLn(t.String())  // "int"
```

`reflect.Valueof` 的逆操作是 `reflect.Value.Interface` 方法。他返回一个 `interface{}` 接口值，与 `relfect.Value` 包含同一个具体值；

```go
v := reflect.ValueOf(3)   // a reflect.Value
x := v.Interface()       // an interface{}
i := x.(int)             // an int
fmt.PrintLn("%d\n", i)   // "3"
```

重点来了，`reflect.Value` 和 `interface{}` 都可以包含任意一个值，他们的区别是空接口(`interface{}`)隐藏了值得布局信息，内置操作和相关方法，除非我们知道它的动态类型，并用一个类型断言渗透进去，否则我们能对这个动态值所做的事情甚少。然而与它对应的`reflect.Value` 可以用来分析所包含的值，而不用知道它的类型。

我们可以尝试写一个通用的格式化函数，暂且称之为：`FormatAny`吧，不适用类型分支，我们用`reflect.Value.Kind`方法来区分不同的类型。尽管有无限种分类，但是类型的分类（`Kind`）只有少数的几种：基础类型 `Bool`，`String`以及各种数字类型；聚合类型 `Array` 和 `Struct`；引用类型 `Chan`，`Func`，`Ptr`，`Slice`和 `Map` ，还有接口类型：`interface{}`，以及最后一个`Invalid`类型；`reflect.Value`的零值就属于`Invalid`类型。  

```go
package main

import (
	"fmt"
	"reflect"
	"strconv"
	"time"
)

func formatAny(v reflect.Value) string {
	switch v.Kind() {
	case reflect.Invalid:
		return "invalid"
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return strconv.FormatInt(v.Int(), 10)
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return strconv.FormatUint(v.Uint(), 10)
	case reflect.Bool:
		return strconv.FormatBool(v.Bool())
	case reflect.String:
		return strconv.Quote(v.String())
	case reflect.Chan, reflect.Func, reflect.Slice, reflect.Map:
		return v.Type().String() + " 0x" + strconv.FormatUint(uint64(v.Pointer()), 16)
	default:
		return v.Type().String() + "value"

	}
}

func main() {
	var x = 1
	var d time.Duration = 1 * time.Nanosecond
	fmt.Println(formatAny(reflect.ValueOf(x)))                  // "1"
	fmt.Println(formatAny(reflect.ValueOf(d)))                  // "1"
	fmt.Println(formatAny(reflect.ValueOf([]int64{int64(x)})))  // []int64 0xc42001c088
	fmt.Println(formatAny(reflect.ValueOf([]time.Duration{d}))) // []time.Duration 0xc42001c0a0
}
```

### 实现一个递归的值显示器：Display

显示器的使用要使用到上面的`formatAny`方法；

```go
func display(path string, v reflect.Value) {
	switch v.Kind() {
	case reflect.Invalid:
		fmt.Printf("%s = invalid\n", path)
	case reflect.Slice, reflect.Array:
		for i := 0; i < v.Len(); i++ {
			display(fmt.Sprintf("%s[%d]", path, i), v.Index(i))
		}
	case reflect.Struct:
		for i := 0; i < v.NumField(); i++ {
			fieldPath := fmt.Sprintf("%s.%s", path, v.Type().Field(i).Name)
			display(fieldPath, v.Field(i))
		}
	case reflect.Map:
		for _, key := range v.MapKeys() {
			display(fmt.Sprintf("%s[%s]", path, formatAny(key)), v.MapIndex(key))
		}
	case reflect.Ptr:
		if v.IsNil() {
			fmt.Printf("%s = nil\n", path)
		} else {
			display(fmt.Sprintf("(*%s)", path), v.Elem())
		}
	case reflect.Interface:
		if v.IsNil() {
			fmt.Printf("%s = nil\n", path)
		} else {
			fmt.Printf("%s.type = %s\n", path, v.Elem().Type())
		}
	default:
		fmt.Printf("%s = %s\n", path, formatAny(v))
	}
}

```

逐个解释一下子：

slice和数组：两者逻辑基本是一致的，`Index(i)`返回第一个元素，元素类型是`reflect.Value`；

结构体：`NumField()`方法可以报告结构体中的字段数，`Field(i)`方法返回第i个字段，类型是`reflect.Value`，要获得第i个字段的名称，必须通过`v.Type().Field(i).Name`

map: `MapKeys()`方法返回一个元素类型为`reflect.Value`的slice，每个元素都是一个map的键。与平常遍历map类似，顺序是不固定的。`MapIndex(key)`返回key对应的值。

指针：`Elem()`方法返回指针指向的变量，同样是以`reflect.Value`类型返回。这个方法在指针是nil值得时候也可以正确处理，但返回的结果为`Invalid`类型。  
`IsNil()`方法用于判断指针是否为空；

接口：`IsNil()`也可用来判断借口是否为空，如果非空，通过`v.Elem()`方法获取动态值。

**这里我们就看到，虽然`reflect.Value`定义了很多方法，但是对于每个具体的类型，只有少量的方可以安全调用**

定义一个复杂的类型测试一下：

```go
type Music struct {
	Title, Subtitle string
	Year            int
	Color           bool
	Actor           map[string]string
	Oscars          []string
	Sequel          *string
}

strangelove := Music{
    Title: "学习的动力",
    Year:  2018,
    Color: false,
    Actor: map[string]string{
        "Dr. stangelove": "Peter sellers",
        "Grp catp linel": "hello world",
    },
    Oscars: []string{
        "Best Actor(Nomain)",
        "Best music king",
    },
}
   
display("strangelove", reflect.ValueOf(strangelove))

//strangelove.Title = "学习的动力"
//strangelove.Subtitle = ""
//strangelove.Year = 2018
//strangelove.Color = false
//strangelove.Actor["Dr. stangelove"] = "Peter sellers"
//strangelove.Actor["Grp catp linel"] = "hello world"
//strangelove.Oscars[0] = "Best Actor(Nomain)"
//strangelove.Oscars[1] = "Best music king"
//strangelove.Sequel = nil
```

**注意：非导出字段在反射下也是可见的。**


### 使用reflect.Value来设置值

前面都是用reflect解析变量值，但是我们本节的重点则是如何改变值；

go语言的表达式，比如x, x.f[1], *p这样的表达式都是表示一个变量，而 x+1 , f(2) 这样的表达式则不表示变量。**一个变量是一个可寻址的存储区域，其中包含了一个值，并且它的值可以通过这个地址来更新**。

对 `relfect.Value` 也有一个类似的区分，某些是可寻址的，而其他的并非如此。比如下面的变量声明：

```go
x := 2
a := reflect.ValueOf(2)
b := relfect.ValueOf(x)
c := relfect.ValueOf(&x)
d := c.Elem()
```

`a` 里面的值是不可寻址的，它包含的仅仅只整数2的一个副本。b同样是如此。c里面的值也是不可寻址的，它包含的是一个指针&x的副本。事实上，通过`reflect.ValueOf()`返回的值都是不可寻址的。**可以通过`reflect.ValueOf(&x).Elem()`任意变量x可寻址的`Value`值**。也可以通过`CanAddr()`方法获得这个变量是否可寻址，这个方法返回一个bool值表示可寻址或者不可寻址。

从一个可寻址的`reflect.Value`获取变量需要三步走：

1. 调用 `Addr()`,返回一个`Value`，其中包含一个指向变量的指针;

2. 在上面返回的`Value`上调用`Interface()`返回一个包含这个指针的`interface{}`值；

3. 最后，如果我们知道变量的类型，我们可以使用类型断言把他转换为一个普通指针，之后就可以更新这个变量了；

```go
x := 2
d := reflect.ValueOf(&x).Elem()
px := d.Addr().Interface().(*int)
*px = 3
```

还可以通过在可寻址的 `reflect.Value` 直接调用 `reflect.Value.Set` 来更新值，`d.Set(reflect.ValueOf(4))`

平常由编译器来检查的那些可赋值条件，在这种情况下则是在运行时有`Set`方法检查。上面的变量和值都是`int`类型，但如果变量时`int64`类型，就会崩溃；  
因此确保值对于变量类型可复制是一件非常正确的事。

还有一些基本类型特化的Set变种：`SetInt`,`SetUint`,`SetString`,`SetFloat` 等；

```go
d.SetInt(3)
```

这些方法还具有一定的容错性。只要变量类型是某种带符号的整数，比如SetInt，设置可以是地城类型为带符号整数的命令类型都可以成功。如果值太大就会被截断；**但是需要注意的是：在指向`interface{}`变量的`reflect.Value`上调用SetInt会奔溃，但是Set就没问题**