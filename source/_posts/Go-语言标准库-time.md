---
title: Go 语言标准库 time
date: 2017-12-31 19:09:50
categories:
- Go 标准库
tags:
- Go
---

{% asset_img 1.png Go 语言标准库 time %}

<!--more-->

go 内部用`time.Time`类型表示时间，`time.Time`提供了一系列的方法用于时间  
的相关处理；


- 构造时间对象：`time.Date`

```go
loc, _ := time.LoadLocation("Asia/Shanghai")      //创建时区
t := time.Date(2017, 12, 31, 23, 59, 59, 0, loc)  // 传入参数 
fmt.Println(t.Format("2006/01/02 15:04:05"))      // 格式化时间：2017/12/31 23:59:59
```

- 返回当前时间：`time.Now()`

```go
fmt.Println(time.Now().Format("2006/01/02 15:04:05")) //2017/12/31 19:30:41
```

- 从字符串解析时间：`time.Parse`，`time.ParseInLocation`

```go
loc, _ := time.LoadLocation("Asia/Shanghai")
t1, _ := time.Parse("2006/01/02 15:04:05", "2017/12/31 19:12:12")
fmt.Println(t1.Unix())  // 1514747532
t2, _ := time.ParseInLocation("2006/01/02 15:04:05", "2017/12/31 19:12:12", loc)
fmt.Println(t2.In(loc).Unix(), t2.Format("2006/01/02 15:04:05"))                   // 1514718732 2017/12/31 19:12:12
```

- 从戳间戳创建时间：`time.Unix`

```go
fmt.Println(time.Unix(1514720672, 0).Format("2006/01/02 15:04:05"))
```

- 获取时间戳：`time.Time.Unix`

```go
fmt.Println(time.Now().Unix())          // 获取当前时间戳，秒
fmt.Println(time.Now().UnixNano())      // 获取当前时间戳，纳秒
```

- 判断两个时间是否相等：`time.Time.Equal`

```go
t1, _ := time.Parse("2006/01/02 15:04:05", "2017/12/31 19:12:12")
fmt.Println(t1.Equal(t1), t1.Equal(time.Now()))                     // false true
```

- 当前时间一段时间之后：`time.Time.Add`

```go
// 可用的单位有：
// 1. time.Nanosecond  一纳秒
// 2. time.Microsecond 一微妙
// 3. time.Millisecond 一毫秒
// 4. time.Second      一秒
// 5. time.Minute      一分钟
// 6. time.Hour        一小时
fmt.Println(time.Now().Add(2 * time.Hour).Format("2006/01/02 15:04:05")) // 2017/12/31 21:58:16
```

- 获取两个时间之间的差值：`time.Time.Sub -> time.Duration`

要注意的是，time.Time.Sub返回的并不是秒也不是纳秒之类的具体单位，而是`time.Duration`类型；

```go
t1, _ := time.Parse("2006/01/02 15:04:05", "2017/12/31 19:12:12")
fmt.Println(t1.Sub(time.Now()).Seconds())

// time.Duration 类型还具有以下方法：
// 1. Hours
// 2. Minutes
// 3. Seconds
// 4. Nanoseconds
```

- 时间格式化：`time.Time.Format`

go 虽说内置了10个常用的格式，但是用于机读还可以，可读性并不是很好

```
const (
    ANSIC       = "Mon Jan _2 15:04:05 2006"
    UnixDate    = "Mon Jan _2 15:04:05 MST 2006"
    RubyDate    = "Mon Jan 02 15:04:05 -0700 2006"
    RFC822      = "02 Jan 06 15:04 MST"
    RFC822Z     = "02 Jan 06 15:04 -0700" // RFC822 with numeric zone
    RFC850      = "Monday, 02-Jan-06 15:04:05 MST"
    RFC1123     = "Mon, 02 Jan 2006 15:04:05 MST"
    RFC1123Z    = "Mon, 02 Jan 2006 15:04:05 -0700" // RFC1123 with numeric zone
    RFC3339     = "2006-01-02T15:04:05Z07:00"
    RFC3339Nano = "2006-01-02T15:04:05.999999999Z07:00"
    Kitchen     = "3:04PM"
    // Handy time stamps.
    Stamp      = "Jan _2 15:04:05"
    StampMilli = "Jan _2 15:04:05.000"
    StampMicro = "Jan _2 15:04:05.000000"
    StampNano  = "Jan _2 15:04:05.000000000"
)
```

常用的格式还是：`2006/01/02 15:04:05`，这个日期是go指定的时间原点，习惯就好。

```go
t := time.Date(2017, 12, 31, 23, 59, 59, 0, loc)  
fmt.Println(t.Format("2006/01/02 15:04:05"))      // 格式化时间：2017/12/31 23:59:59
```

