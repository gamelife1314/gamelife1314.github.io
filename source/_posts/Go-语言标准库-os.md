---
title: Go 扩展包：os
date: 2018-11-21 21:23:39
categories:
  - Go 标准库
tags:
  - Go
---

{% asset_img cover.jpeg cover %}

<!-- more -->

### 文件操作

`os.Create` 函数用于根据指定的文件路径创建一个文件，默认模式是 `0666`，如果文件存在就会将它清空，如果创建成功，该方法返回 `*os.File` 类型的变量用于 I/O 操作，如果有错误发生，那么将会是 `*PathError`。

```go
func createFile() {
	var (
		file *os.File
		err  error
	)
	if file, err = os.Create("test.log"); err != nil {
		fmt.Println(err)
		return
	}
	defer file.Close()

	file.Write([]byte("hello world"))
}
```

`os.NewFile` 不要被名字欺骗了，不是用来创建新文件的，而是根据给定的文件描述符返回新的 `*os.File`，如果给定的不是一个有效的文件描述符，则返回 nil。

```go
func newFile()  {
	var (
		file *os.File
	)
	file = os.NewFile(uintptr(syscall.Stderr), "/dev/stdout")
	if file != nil {
		defer file.Close()
		file.WriteString("hello 中国")
	}
}
```

`os.OpenFile` 则根据给定的文件名，以指定的模式打开文件，更加通用：

```go
func main() {
	var (
		file *os.File
		err  error
	)
	if file, err = os.OpenFile("test.log", os.O_TRUNC|os.O_CREATE|os.O_RDWR, os.ModePerm); err != nil {
		fmt.Println(err)
		return
	}
	defer file.Close()
	file.WriteString("hello China")
}
```