---
title: Linux 可执行和可链接文件格式--ELF
date: 2022-02-16 22:59:17
tags:
    - ELF
---

`ELF(Executable and Linking Format)` 是linux系统下可执行文件，目标文件，共享链接库和内核转储文件的格式。维基百科中是这样描述的：

{% cq %}在计算机科学中，ELF文件是一种用于可执行文件、目标文件、共享库和核心转储（core dump）的标准文件格式。其中核心转储是指： 操作系统在进程收到某些信号而终止时，将此时进程地址空间的内容以及有关进程状态的其他信息写出的一个磁盘文件。这种信息往往用于调试。{% endcq %}

- `可重定位文件（relocatable file）` 它保存了一些可以和其他目标文件链接并生成可执行文件或者共享库的二进制代码和数据；
- `可执行文件（excutable file）` 它保存了适合直接加载到内存中执行的二进制程序；
- `共享库文件（shared object file` 一种特殊的可重定位目标文件，可以在加载或者运行时被动态的加载进内存并链接。
- `核心转储文件（core dump）` 是操作系统在进程收到某些信号而终止运行时，将此时进程地址空间的内容以及有关进程状态的其他信息写入一个磁盘文件。这种信息往往用于调试。

`ELF`文件主要由四部分组成：

- `ELF Header`：主要包括文件的类型，架构，程序入口地址，`Program Header` 和 `Section Header` 的大小，数量，偏移量等；

- `Programe Header`：列举所有有效的 `segments` 的属性，描述如何创建进程运行时内存镜像，当内核看到这些 `segments` 时，使用 `mmap` 将他们映射到虚拟地址空间，为程序的运行准备；

- `Section`：在`ELF`文件中，数据和代码分开存放的，这样可以按照其功能属性分成一些区域，比如程序、数据、符号表等。这些分离存放的区域在ELF文件中反映成`section`；

- `Section Header`：定义ELF文件中所有的 `section`，用于链接和重定位。对于可执行文件，有四个主要部分：`.text`、`.data`、`.rodata` 和 `.bss`；


<!-- more -->

### ELF Header

在C语言中，`ELF Header` 定义为如下的结构体：

```c
#define EI_NIDENT 16

typedef struct {
        unsigned char   e_ident[EI_NIDENT];
        Elf32_Half      e_type;
        Elf32_Half      e_machine;
        Elf32_Word      e_version;
        Elf32_Addr      e_entry;
        Elf32_Off       e_phoff;
        Elf32_Off       e_shoff;
        Elf32_Word      e_flags;
        Elf32_Half      e_ehsize;
        Elf32_Half      e_phentsize;
        Elf32_Half      e_phnum;
        Elf32_Half      e_shentsize;
        Elf32_Half      e_shnum;
        Elf32_Half      e_shstrndx;
} Elf32_Ehdr;

typedef struct {
        unsigned char   e_ident[EI_NIDENT];
        Elf64_Half      e_type;
        Elf64_Half      e_machine;
        Elf64_Word      e_version;
        Elf64_Addr      e_entry;
        Elf64_Off       e_phoff;
        Elf64_Off       e_shoff;
        Elf64_Word      e_flags;
        Elf64_Half      e_ehsize;
        Elf64_Half      e_phentsize;
        Elf64_Half      e_phnum;
        Elf64_Half      e_shentsize;
        Elf64_Half      e_shnum;
        Elf64_Half      e_shstrndx;
} Elf64_Ehdr;
```

其中:

    ElfN_Addr       Unsigned program address, uintN_t
    ElfN_Off        Unsigned file offset, uintN_t


上述结构体中各个字段的含义如下所示：

- ` e_ident`：包含一个magic number、ABI信息，该文件使用的平台、大小端规则
- `e_type`： 文件类型, 表示该文件属于可执行文件、可重定位文件、core dump文件或者共享库
- `e_machine`：机器类型
- `e_version`：通常都是1
- `e_entry`： 表示程序执行的入口地址
- `e_phoff`： 表示Program Header的入口偏移量（以字节为单位）
- `e_shoff`：表示Section Header的入口偏移量（以字节为单位）
- `e_flags`： 保存了这个ELF文件相关的特定处理器的flag
- `e_ehsize`： 表示ELF Header大小（以字节为单位）
- `e_phentsize`： 表示Program Header大小（以字节为单位）
- `e_phnum`： 表示Program Header的数量 （十进制数字）
- `e_shentsize`：表示Section Header大小（以字节为单位）
- `e_shnum`： 表示Section Header的数量 （十进制数字）
- `e_shstrndx`： 表示字符串表的索引，字符串表用来保存ELF文件中的字符串，比如段名、变量名。 然后通过字符串在表中的偏移访问字符串。


### Section

在`ELF`文件中，数据和代码分开存放的，这样可以按照其功能属性分成一些区域，比如程序、数据、符号表等。这些分离存放的区域在ELF文件中反映成`section`。ELF文件中典型的`section`如下：

- `.text`: 已编译程序的二进制代码
- `.rodata`: 只读数据段，比如常量
- `.data`: 已初始化的全局变量和静态变量
- `.bss`: 未初始化的全局变量和静态变量，所有被初始化成0的全局变量和静态变量
- `.sysmtab`: 符号表，它存放了程序中定义和引用的函数和全局变量的信息
- `.debug`: 调试符号表，它需要以'-g'选项编译才能得到，里面保存了程序中定义的局部变量和类型定义，程序中定义和引用的全局变量，以及原始的C文件
- `.line`: 原始的C文件行号和.text节中机器指令之间的映射
- `.strtab`: 字符串表，内容包括 `.symtab` 和 `.debug` 节中的符号表

其他特殊的 `section`：

1）对于可重定位的文件，由于在编译时，并不能确定它引用的外部函数和变量的地址信息，因此，编译器在生成目标文件时，增加了两个·section·：
  - `.rel.text` 保存了程序中引用的外部函数的重定位信息，这些信息用于在链接时重定位其对应的符号。
  - `.rel.data` 保存了被模块引用或定义的所有全局变量的重定位信息，这些信息用于在链接时重定位其对应的全局变量。

2）对于可执行文件，由于它已经全部完成了重定位工作，可以直接加载到内存中执行，所以它不存在`.rel.text`和`.rel.data`这两个`section`。但是，它增加了一个`section`：

  `.init`： 这个`section`里面保存了程序运行前的初始化代码

上述描述的各个文件中包含的这些section是必须存在的，当然除了这些section，每种文件还有一些其他的section用来存放编译器或者链接器所需要的辅助信息。

### Section Header Table

上述各个section的大小和位置等具体信息的存放是由Section Header Table来描述的。Section Header Table是一个结构体数组，对应的结构体定义如下：

```c
typedef struct {
    uint32_t   sh_name;
    uint32_t   sh_type;
    uint64_t   sh_flags;
    Elf64_Addr sh_addr;
    Elf64_Off  sh_offset;
    uint64_t   sh_size;
    uint32_t   sh_link;
    uint32_t   sh_info;
    uint64_t   sh_addralign;
    uint64_t   sh_entsize;
} Elf64_Shdr;
```

其中各成员的意义如下：

- `sh_name`：表示该section的名字相对于.shstrtab section的地址偏移量。
- `sh_type`：表示该section中存放的内容类型，比如符号表，可重定位段等。
- `sh_flags`： 表示该section的一些属性，比如是否可写，可执行等。
- `sh_addr`：表示该section在程序运行时的内存地址
- `sh_offset`： 表示该section相对于ELF文件起始地址的偏移量
- `sh_size`： 表示该section的大小
- `sh_link`：配合sh_info保存section的额外信息
- `sh_info`：保存该section相关的一些额外信息
- `sh_addralign`：表示该section需要的地址对齐信息
- `sh_entsize`：有些section里保存的是一些固定长度的条目，比如符号表。对于这些section来讲，sh_entsize里保存的就是条目的长度。


### Program Header Table

`section`基本是按照目标文件内容的功能来划分的一些区域，而根据其内容在内存中是否可读写等属性，又可以将不同的`section`划分成不同的`segment`。其中每个`segment`可以由一个或多个`section`组成。

在可执行文件中，`ELF header`下面紧接着就是`Program Header Table`。它描述了各个 `segment` 在 `ELF` 文件中的位置以及在程序执行过程中系统需要准备的其他信息。它也是用一个结构体数组来表示的。具体代码如下：

```c
typedef uint64_t  Elf64_Addr;
typedef uint64_t  Elf64_Off;
typedef uint32_t  Elf64_Word;
typedef uint64_t  Elf64_Xword;

typedef struct {
    Elf64_Word      p_type;         // 4
    Elf64_Word      p_flags;        // 4
    Elf64_Off       p_offset;       // 8
    Elf64_Addr      p_vaddr;        // 8
    Elf64_Addr      p_paddr;        // 8
    Elf64_Xword     p_filesz;       // 8
    Elf64_Xword     p_memsz;        // 8
    Elf64_Xword     p_align;        // 8
} Elf64_Phdr;
```

各个字段的具体含义如下：

- `p_type`：描述了当前segment是何种类型的或者如何解释当前segment，比如是动态链接相关的或者可加载类型的等
- `p_flags`：保存了该segment的flag
- `p_offset`：表示从ELF文件到该segment第一个字节的偏移量
- `p_vaddr`：表示该segment的第一个字节在内存中的虚拟地址
- `p_paddr`：对于使用物理地址的系统来讲，这个成员表示该segment的物理地址
- `p_filesz`：表示该segment的大小，以字节表示
- `p_memsz`：表示该segment在内存中的大小，以字节表示
- `p_align`：表示该segment在文件中或者内存中需要以多少字节对齐



### 参考文章

1. [The 101 of ELF files on Linux: Understanding and Analysis
](https://linux-audit.com/elf-binaries-on-linux-understanding-and-analysis/#elf-sections)
2. [ELF Header](https://refspecs.linuxfoundation.org/elf/gabi4+/ch4.eheader.html)
3. [Section Header](https://docs.oracle.com/cd/E19455-01/806-3773/elf-2/index.html)
4. [LINUX_ELF_EM_H](https://elixir.bootlin.com/linux/latest/source/include/uapi/linux/elf-em.h#L31)
5. [Program Header](https://refspecs.linuxbase.org/elf/gabi4+/ch5.pheader.html)
6. [ELF man page](https://man7.org/linux/man-pages/man5/elf.5.html)