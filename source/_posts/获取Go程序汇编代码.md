---
title: Go 汇编程序
date: 2020-05-14 22:55:16
tags:
- Go
---

有时候为了查看 Go 代码在机器上的执行方式，比较好的方式就是查看其汇编形式，获取 Go 程序的汇编代码有多种方式，下面是我们的 Go 源代码：

```go
package main

const Direction = "Left"

func main() {
	var year = 2020
	numbers := make([]int, 0, 10)
	students := make(map[string]int)
	students["michael"] = 25
	println(numbers, students, year)
}
```

<!--more-->

### go tool compile

> go tool compile -S -N -L main.go


### go tool objdump

首先编译程序：`go tool compile -N -l main.go`

然后反汇编：`go tool objdump main.o`

### go build

也可以通过命令：`go build -gcflags="-L -N -S" main.go` 输出汇编代码。

在通过 `go build -gcflags="-L"` 生成二进制程序后，还可通过 `go tool objdump` 输出汇编代码，例如：

> go tool objdump -s "main.main" main

```
TEXT main.main(SB) /Users/fudenglong/workdir/go/src/go-study/get_go_asm/main.go
  main.go:7		0x109ce80		65488b0c2530000000		MOVQ GS:0x30, CX							
  main.go:7		0x109ce89		488d8424c8feffff		LEAQ 0xfffffec8(SP), AX							
  main.go:7		0x109ce91		483b4110			CMPQ 0x10(CX), AX							
  main.go:7		0x109ce95		0f861d040000			JBE 0x109d2b8								
  main.go:7		0x109ce9b		4881ecb8010000			SUBQ $0x1b8, SP								
  main.go:7		0x109cea2		4889ac24b0010000		MOVQ BP, 0x1b0(SP)							
  main.go:7		0x109ceaa		488dac24b0010000		LEAQ 0x1b0(SP), BP							
  main.go:8		0x109ceb2		48c7442440e4070000		MOVQ $0x7e4, 0x40(SP)							
  main.go:9		0x109cebb		488d057edf0000			LEAQ type.*+55904(SB), AX						
  main.go:9		0x109cec2		48890424			MOVQ AX, 0(SP)								
  main.go:9		0x109cec6		48c744240800000000		MOVQ $0x0, 0x8(SP)							
  main.go:9		0x109cecf		48c74424100a000000		MOVQ $0xa, 0x10(SP)							
  main.go:9		0x109ced8		e80362faff			CALL runtime.makeslice(SB)						
  main.go:9		0x109cedd		488b442418			MOVQ 0x18(SP), AX							
  main.go:9		0x109cee2		4889842440010000		MOVQ AX, 0x140(SP)							
  main.go:9		0x109ceea		48c784244801000000000000	MOVQ $0x0, 0x148(SP)							
  main.go:9		0x109cef6		48c78424500100000a000000	MOVQ $0xa, 0x150(SP)							
  main.go:10		0x109cf02		e889f4f6ff			CALL runtime.makemap_small(SB)						
  main.go:10		0x109cf07		488b0424			MOVQ 0(SP), AX								
  main.go:10		0x109cf0b		4889442460			MOVQ AX, 0x60(SP)							
  main.go:11		0x109cf10		488d0da9580100			LEAQ type.*+87008(SB), CX						
  main.go:11		0x109cf17		48890c24			MOVQ CX, 0(SP)								
  main.go:11		0x109cf1b		4889442408			MOVQ AX, 0x8(SP)							
  main.go:11		0x109cf20		488d056e040300			LEAQ go.string.*+1621(SB), AX						
  main.go:11		0x109cf27		4889442410			MOVQ AX, 0x10(SP)							
  main.go:11		0x109cf2c		48c744241807000000		MOVQ $0x7, 0x18(SP)							
  main.go:11		0x109cf35		e80632f7ff			CALL runtime.mapassign_faststr(SB)					
  main.go:11		0x109cf3a		488b442420			MOVQ 0x20(SP), AX							
  main.go:11		0x109cf3f		4889842480000000		MOVQ AX, 0x80(SP)							
  main.go:11		0x109cf47		8400				TESTB AL, 0(AX)								
  main.go:11		0x109cf49		48c70019000000			MOVQ $0x19, 0(AX)							
  main.go:12		0x109cf50		488b442460			MOVQ 0x60(SP), AX							
  main.go:12		0x109cf55		4889842488000000		MOVQ AX, 0x88(SP)							
  main.go:12		0x109cf5d		488b842450010000		MOVQ 0x150(SP), AX							
  main.go:12		0x109cf65		488b8c2448010000		MOVQ 0x148(SP), CX							
  main.go:12		0x109cf6d		488b942440010000		MOVQ 0x140(SP), DX							
  main.go:12		0x109cf75		48891424			MOVQ DX, 0(SP)								
  main.go:12		0x109cf79		48894c2408			MOVQ CX, 0x8(SP)							
  main.go:12		0x109cf7e		4889442410			MOVQ AX, 0x10(SP)							
  main.go:12		0x109cf83		e848bff6ff			CALL runtime.convTslice(SB)						
  main.go:12		0x109cf88		488b442418			MOVQ 0x18(SP), AX							
  main.go:12		0x109cf8d		4889442478			MOVQ AX, 0x78(SP)							
  main.go:12		0x109cf92		488d0de7c40000			LEAQ type.*+49312(SB), CX						
  main.go:12		0x109cf99		48898c2420010000		MOVQ CX, 0x120(SP)							
  main.go:12		0x109cfa1		4889842428010000		MOVQ AX, 0x128(SP)							
  main.go:12		0x109cfa9		488b842488000000		MOVQ 0x88(SP), AX							
  main.go:12		0x109cfb1		488d0d08580100			LEAQ type.*+87008(SB), CX						
  main.go:12		0x109cfb8		48898c2410010000		MOVQ CX, 0x110(SP)							
  main.go:12		0x109cfc0		4889842418010000		MOVQ AX, 0x118(SP)							
  main.go:12		0x109cfc8		488b442440			MOVQ 0x40(SP), AX							
  main.go:12		0x109cfcd		48890424			MOVQ AX, 0(SP)								
  main.go:12		0x109cfd1		e8dabdf6ff			CALL runtime.convT64(SB)						
  main.go:12		0x109cfd6		488b442408			MOVQ 0x8(SP), AX							
  main.go:12		0x109cfdb		4889442470			MOVQ AX, 0x70(SP)							
  main.go:12		0x109cfe0		488d0d59de0000			LEAQ type.*+55904(SB), CX						
  main.go:12		0x109cfe7		48898c2400010000		MOVQ CX, 0x100(SP)							
  main.go:12		0x109cfef		4889842408010000		MOVQ AX, 0x108(SP)							
  main.go:12		0x109cff7		488d05c2e50000			LEAQ type.*+57824(SB), AX						
  main.go:12		0x109cffe		48898424f0000000		MOVQ AX, 0xf0(SP)							
  main.go:12		0x109d006		488d05c3bc0400			LEAQ sync/atomic.CompareAndSwapUintptr.args_stackmap+368(SB), AX	
  main.go:12		0x109d00d		48898424f8000000		MOVQ AX, 0xf8(SP)							
  main.go:12		0x109d015		488b842428010000		MOVQ 0x128(SP), AX							
  main.go:12		0x109d01d		488b8c2420010000		MOVQ 0x120(SP), CX							
  main.go:12		0x109d025		48898c24c0000000		MOVQ CX, 0xc0(SP)							
  main.go:12		0x109d02d		48898424c8000000		MOVQ AX, 0xc8(SP)							
  main.go:12		0x109d035		488b842410010000		MOVQ 0x110(SP), AX							
  main.go:12		0x109d03d		488b8c2418010000		MOVQ 0x118(SP), CX							
  main.go:12		0x109d045		48898424b0000000		MOVQ AX, 0xb0(SP)							
  main.go:12		0x109d04d		48898c24b8000000		MOVQ CX, 0xb8(SP)							
  main.go:12		0x109d055		488b842400010000		MOVQ 0x100(SP), AX							
  main.go:12		0x109d05d		488b8c2408010000		MOVQ 0x108(SP), CX							
  main.go:12		0x109d065		48898424a0000000		MOVQ AX, 0xa0(SP)							
  main.go:12		0x109d06d		48898c24a8000000		MOVQ CX, 0xa8(SP)							
  main.go:12		0x109d075		488b8424f0000000		MOVQ 0xf0(SP), AX							
  main.go:12		0x109d07d		488b8c24f8000000		MOVQ 0xf8(SP), CX							
  main.go:12		0x109d085		4889842490000000		MOVQ AX, 0x90(SP)							
  main.go:12		0x109d08d		48898c2498000000		MOVQ CX, 0x98(SP)							
  main.go:12		0x109d095		0f57c0				XORPS X0, X0								
  main.go:12		0x109d098		0f11842470010000		MOVUPS X0, 0x170(SP)							
  main.go:12		0x109d0a0		0f57c0				XORPS X0, X0								
  main.go:12		0x109d0a3		0f11842480010000		MOVUPS X0, 0x180(SP)							
  main.go:12		0x109d0ab		0f57c0				XORPS X0, X0								
  main.go:12		0x109d0ae		0f11842490010000		MOVUPS X0, 0x190(SP)							
  main.go:12		0x109d0b6		0f57c0				XORPS X0, X0								
  main.go:12		0x109d0b9		0f118424a0010000		MOVUPS X0, 0x1a0(SP)							
  main.go:12		0x109d0c1		488d842470010000		LEAQ 0x170(SP), AX							
  main.go:12		0x109d0c9		4889442468			MOVQ AX, 0x68(SP)							
  main.go:12		0x109d0ce		8400				TESTB AL, 0(AX)								
  main.go:12		0x109d0d0		488b8c24c0000000		MOVQ 0xc0(SP), CX							
  main.go:12		0x109d0d8		488b9424c8000000		MOVQ 0xc8(SP), DX							
  main.go:12		0x109d0e0		48898c2470010000		MOVQ CX, 0x170(SP)							
  main.go:12		0x109d0e8		4889942478010000		MOVQ DX, 0x178(SP)							
  main.go:12		0x109d0f0		8400				TESTB AL, 0(AX)								
  main.go:12		0x109d0f2		488b8424b0000000		MOVQ 0xb0(SP), AX							
  main.go:12		0x109d0fa		488b8c24b8000000		MOVQ 0xb8(SP), CX							
  main.go:12		0x109d102		4889842480010000		MOVQ AX, 0x180(SP)							
  main.go:12		0x109d10a		48898c2488010000		MOVQ CX, 0x188(SP)							
  main.go:12		0x109d112		488b442468			MOVQ 0x68(SP), AX							
  main.go:12		0x109d117		8400				TESTB AL, 0(AX)								
  main.go:12		0x109d119		488b8c24a0000000		MOVQ 0xa0(SP), CX							
  main.go:12		0x109d121		488b9424a8000000		MOVQ 0xa8(SP), DX							
  main.go:12		0x109d129		48894820			MOVQ CX, 0x20(AX)							
  main.go:12		0x109d12d		488d7828			LEAQ 0x28(AX), DI							
  main.go:12		0x109d131		833d488b100000			CMPL $0x0, runtime.writeBarrier(SB)					
  main.go:12		0x109d138		7405				JE 0x109d13f								
  main.go:12		0x109d13a		e96c010000			JMP 0x109d2ab								
  main.go:12		0x109d13f		48895028			MOVQ DX, 0x28(AX)							
  main.go:12		0x109d143		eb00				JMP 0x109d145								
  main.go:12		0x109d145		488b4c2468			MOVQ 0x68(SP), CX							
  main.go:12		0x109d14a		8401				TESTB AL, 0(CX)								
  main.go:12		0x109d14c		488b942490000000		MOVQ 0x90(SP), DX							
  main.go:12		0x109d154		488b842498000000		MOVQ 0x98(SP), AX							
  main.go:12		0x109d15c		48895130			MOVQ DX, 0x30(CX)							
  main.go:12		0x109d160		488d7938			LEAQ 0x38(CX), DI							
  main.go:12		0x109d164		833d158b100000			CMPL $0x0, runtime.writeBarrier(SB)					
  main.go:12		0x109d16b		7405				JE 0x109d172								
  main.go:12		0x109d16d		e92f010000			JMP 0x109d2a1								
  main.go:12		0x109d172		48894138			MOVQ AX, 0x38(CX)							
  main.go:12		0x109d176		eb00				JMP 0x109d178								
  main.go:12		0x109d178		488b442468			MOVQ 0x68(SP), AX							
  main.go:12		0x109d17d		8400				TESTB AL, 0(AX)								
  main.go:12		0x109d17f		eb00				JMP 0x109d181								
  main.go:12		0x109d181		4889842458010000		MOVQ AX, 0x158(SP)							
  main.go:12		0x109d189		48c784246001000004000000	MOVQ $0x4, 0x160(SP)							
  main.go:12		0x109d195		48c784246801000004000000	MOVQ $0x4, 0x168(SP)							
  main.go:12		0x109d1a1		48c744244800000000		MOVQ $0x0, 0x48(SP)							
  main.go:12		0x109d1aa		0f57c0				XORPS X0, X0								
  main.go:12		0x109d1ad		0f118424d0000000		MOVUPS X0, 0xd0(SP)							
  main.go:12		0x109d1b5		48c744245000000000		MOVQ $0x0, 0x50(SP)							
  main.go:12		0x109d1be		0f57c0				XORPS X0, X0								
  main.go:12		0x109d1c1		0f118424e0000000		MOVUPS X0, 0xe0(SP)							
  print.go:274		0x109d1c9		0f57c0				XORPS X0, X0								
  print.go:274		0x109d1cc		0f11842430010000		MOVUPS X0, 0x130(SP)							
  print.go:274		0x109d1d4		488b057dee0d00			MOVQ os.Stdout(SB), AX							
  print.go:274		0x109d1db		488d0d9ed50400			LEAQ go.itab.*os.File,io.Writer(SB), CX					
  print.go:274		0x109d1e2		48890c24			MOVQ CX, 0(SP)								
  print.go:274		0x109d1e6		4889442408			MOVQ AX, 0x8(SP)							
  print.go:274		0x109d1eb		488b842458010000		MOVQ 0x158(SP), AX							
  print.go:274		0x109d1f3		488b8c2460010000		MOVQ 0x160(SP), CX							
  print.go:274		0x109d1fb		488b942468010000		MOVQ 0x168(SP), DX							
  print.go:274		0x109d203		4889442410			MOVQ AX, 0x10(SP)							
  print.go:274		0x109d208		48894c2418			MOVQ CX, 0x18(SP)							
  print.go:274		0x109d20d		4889542420			MOVQ DX, 0x20(SP)							
  print.go:274		0x109d212		e85996ffff			CALL fmt.Fprintln(SB)							
  print.go:274		0x109d217		488b442428			MOVQ 0x28(SP), AX							
  print.go:274		0x109d21c		4889442458			MOVQ AX, 0x58(SP)							
  print.go:274		0x109d221		488b442430			MOVQ 0x30(SP), AX							
  print.go:274		0x109d226		488b4c2438			MOVQ 0x38(SP), CX							
  print.go:274		0x109d22b		4889842430010000		MOVQ AX, 0x130(SP)							
  print.go:274		0x109d233		48898c2438010000		MOVQ CX, 0x138(SP)							
  print.go:274		0x109d23b		488b442458			MOVQ 0x58(SP), AX							
  print.go:274		0x109d240		4889442450			MOVQ AX, 0x50(SP)							
  print.go:274		0x109d245		488b842430010000		MOVQ 0x130(SP), AX							
  print.go:274		0x109d24d		488b8c2438010000		MOVQ 0x138(SP), CX							
  print.go:274		0x109d255		48898424e0000000		MOVQ AX, 0xe0(SP)							
  print.go:274		0x109d25d		48898c24e8000000		MOVQ CX, 0xe8(SP)							
  main.go:12		0x109d265		488b442450			MOVQ 0x50(SP), AX							
  main.go:12		0x109d26a		4889442448			MOVQ AX, 0x48(SP)							
  main.go:12		0x109d26f		488b8424e0000000		MOVQ 0xe0(SP), AX							
  main.go:12		0x109d277		488b8c24e8000000		MOVQ 0xe8(SP), CX							
  main.go:12		0x109d27f		48898424d0000000		MOVQ AX, 0xd0(SP)							
  main.go:12		0x109d287		48898c24d8000000		MOVQ CX, 0xd8(SP)							
  main.go:12		0x109d28f		eb00				JMP 0x109d291								
  main.go:12		0x109d291		488bac24b0010000		MOVQ 0x1b0(SP), BP							
  main.go:12		0x109d299		4881c4b8010000			ADDQ $0x1b8, SP								
  main.go:12		0x109d2a0		c3				RET									
  main.go:12		0x109d2a1		e8fadefbff			CALL runtime.gcWriteBarrier(SB)						
  main.go:12		0x109d2a6		e9cdfeffff			JMP 0x109d178								
  main.go:12		0x109d2ab		4889d0				MOVQ DX, AX								
  main.go:12		0x109d2ae		e8eddefbff			CALL runtime.gcWriteBarrier(SB)						
  main.go:12		0x109d2b3		e98dfeffff			JMP 0x109d145								
  main.go:7		0x109d2b8		e8c3c0fbff			CALL runtime.morestack_noctxt(SB)					
  main.go:7		0x109d2bd		e9befbffff			JMP main.main(SB)							
...							
```

