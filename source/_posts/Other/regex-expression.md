---
title: 【Regex】正则表达式
date: 2022-05-21 15:05:16
tags:
  - regex
---

一直以来，从 `JavaScript`，`PHP`，`Python`到`Golang`，然后还有`linux`系统中，无处不见正则表达式的身影，可是一致困扰在`POSIX`和`PCRE`的概念中，分不清这两个是个啥，今天就来翻翻正则表达式的老底，了解了解正则表达式的前世今生。

`Regular Expression`的`Regular`一般被译为正则、正规、常规。此处的`Regular`即是规则的意思，`Regular Expression`即描述某种规则的表达式之意。  

正则表达式（英语：`Regular Expression`，在代码中常简写为`regex`、`regexp`或`RE`），是计算机科学的一个概念。正则表达式使用单个字符串来描述、匹配一系列匹配某个句法规则的字符串。在很多文本编辑器里，正则表达式通常被用来检索、替换那些匹配某个模式的文本。

许多程序设计语言都支持利用正则表达式进行字符串操作。例如，在`Perl`中就内建了一个功能强大的正则表达式引擎。正则表达式这个概念最初是由`Unix`中的工具软件（例如`sed`和`grep`）普及开的。正则表达式通常缩写成`regex`，单数有`regexp`、`regex`，复数有`regexps`、`regexes`、`regexen`。

<!--more-->

### 历史

正则表示式这一概念最早可以追溯到20世纪40年代的两个神经物理学家`Warren McCulloch`与`Walter Pitts`，他们将神经系统中的神经元描述成小而简单的自动控制元。 

紧接着，在`50`年代，数学家`1950`年代，数学家`Stephen Kleene`利用称之为`正则集合`的数学符号来描述此模型，并且建议使用一个简单的概念来表示，于是`regular expressions`就正式登上历史舞台了。

`1968`年，`Ken Thompson`发表了[Regular Expression Search Algorithm](http://www.fing.edu.uy/inco/cursos/intropln/material/p419-thompson.pdf), 紧接着大神`Thompson`根据这个论文实现了`Unix`上编辑器`ed`的前身[`qed`](http://en.wikipedia.org/wiki/QED_%28text_editor%29)。`ed`所支持的正则表示式并不比`qed`的高级，但是`ed`是第一个在非技术圈广泛传播的工具，`ed`有一个命令可以展示文本中符合给定正则表达式的行，这个命令是`g/Regular Expression/p`，在英文中读作**`Global Regular Expression Print`**，由于这个命令非常实用，所以后来有了`grep`、`egrep`这两个命令。

相比`egrep`，`grep`只支持很少的元符号，`＊`是支持的（但不能用于分组中），但是`+`、`|`与`?`是不支持的；而且，分组时需要加上反斜线转义，像`\( ...\)`这样才行，由于`grep`的缺陷性日渐明显，`AT&T`的`Alfred Aho`实在受不了了，于是`egrep`诞生了，这里的`e`表示`extended`，加强版的意思，支持了`+`、`|`与`?`这三个元符号，并且可以在分组中使用`*`，分组可以直接写成`(...)`，同时用`\1,\2...`来引用分组。

在`grep`、`egrep`发展的同时，`awk`、`lex`、`sed`等程序也开始发展起来，而且每个程序所支持的正则表达式都或多或少的和其他的不一样，这应该算是正则表达式发展的混乱期，因为这些程序在不断的发展过程中，有时新增加的功能因为`bug`原因，在后期的版本中取消了该功能，例如，如果让`grep`支持元符号`+`的话，那么`grep`就不能表示字符`+`了，而且`grep`的老用户会对这很反感。

这种门派自居的时代混乱不堪，总得有人来统一吧。到了`1986`年，这个人终于来了，他就是**`POSIX(Portable Operating System Interface)`标准**，`POSIX`制定了不同操作系统之间都需要遵守的一套规则。当然了，正则表达式也包括其中，终于来个管事的，`POSIX`规范分为基本正则表达式`BRE(Basic Regular Expressions)`和扩展正则表达式`ERE(Extended Regular Express，ERE)`两个流派，所有的`POSIX`程序可以选择支持其中的一种，具体规范详见下表：

![posix-regexp-favor](1.png)

从上图可以看出，有三个空白栏，那么是不是就意味这无法使用该功能了呢？答案是否定的，因为我们现在使用的`linux`发行版，都是集成`GNU`套件的，`GNU`是`Gnu’s Not Unix`的缩写，`GNU`在实现了`POSIX`标准的同时，做了一定的扩展，所以上面空白栏中的功能也能使用。下面一一讲解：

- `BRE`如何使用`+`、`?`呢？需要用`\+`、`\?`；
- `BRE`如何使用`|`呢？需要用`\|`；
- `ERE`如何使用`\1、\2…\9`这样的反引用？和`BRE`一样，就是`\1、\2…\9`；

通过上面总结，可以发现：`GNU`中的`ERE`与`BRE`的功能相同，只是语法不同（`BRE`需要用`\`进行转义，才能表示特殊含义）。例如`a{1,2}`，在`ERE`表示的是`a`或`aa`，在`BRE`中表示的是`a{1,2}`这个字符串。为了能够在Linux下熟练使用文本处理工具，我们必须知道这些命令支持那种正则表达式。现对常见的命令总结如下：

- 使用`BRE`语法的命令有：`grep、ed、sed、vim`
- 使用`ERE`语法的命令有：`egrep、awk、emacs`

当然，这也不是绝对的，比如 `sed` 通过`-r`选项就可以使用`ERE`了，大家到时自己`man`一下就可以了。还值得一提的是`POSIX`还定义了一些`shorthand`，具体如下：

- `[:alnum:]`
- `[:alpha:]`
- `[:cntrl:]`
- `[:digit:]`
- `[:graph:]`
- `[:lower:]`
- `[:print:]`
- `[:punct:]`
- `[:space:]`
- `[:upper:]`
- `[:xdigit:]`

在使用这些`shorthand`时有一个约束：**必须在`[]`中使用**，也就是说如果像匹配`0-9`的数字，需要这么写`[[:alnum:]]`，取反就是`[^[:alnum:]]`。`shorhand` 在`BRE`与`EBE`中的用法相同。

如果你对`sed`、`awk`比较熟悉，你会发现我们平常在变成语言中用的`\d`、`\w`在这些命令中不能用，原因很简单，因为`POSIX`规范根本没有定义这些`shorthand`，这些是由下面将要说的`PCRE`中定义的。


除了`POSIX`标准外，还有一个`Perl`分支，也就是我们现在熟知的`PCRE（Perl兼容正则表达式，Perl Compatible Regular Expressions)`，源自于`Henry Spencer`于`1986`年`1`月`19`日发布的`regex`，随着`Perl`语言的发展`，Perl`语言中的正则表达式功能越来越强悍，为了把`Perl`语言中正则的功能移植到其他语言中，`PCRE`就诞生了。**现在的编程语言中的正则表达式，大部分都属于PCRE这个分支**。

`Perl`语言第一版是由`Larry Wall`发布于`1987`年`12`月，`Perl`在发布之初，就因其强大的功能而一票走红，`Perl`的定位目标就是天天要使用的工具。

`Perl`比较显诸特征之一是与`sed`与`awk`兼容，这造就了`Perl`成为第一个通用性脚本语言。

随着`Perl`的不断发展，其支持的正则表达式的功能也越来越强大。其中影响较大的是于`1994`年`10`月发布的`Perl 5`，其增加了很多特性，比如`non-capturing parentheses`、`lazy quantifiers`、`look-ahead`、元符号`\G`等等。

正好这时也是 `WWW` 兴起的时候，而`Perl`就是为了文本处理而发明的，所以`Perl`基本上成了`web`开发的首选语言。`Perl`语言应用是如此广泛，以至于其他语言开始移植 `Perl`，最终`Perl compatible`（兼容）的`PCRE`诞生了，这其中包括了`Tcl`, `Python`, `Microsoft’s .NET`，`Ruby`，`PHP`，`C/C++`， `Java`等等。

前面说了`shorthand`在`POSIX`与`PCRE`是不同的，`PCRE`中我们常用的有如下这些：

- `\w` 表示`[a-zA-Z]`
- `\W` 表示`[^a-zA-Z]`
- `\s` 表示`[ \t\r\n\f]`
- `\S` 表示`[^ \t\r\n\f]`
- `\d` 表示`[1-9]`
- `\D` 表示`[^1-9]`
- `\<` 表示一个单词的起始
- `\>` 表示一个单词的结尾

### `PCRE`

1. `\`, 将下一个字符标记为一个`特殊字符(File Format Escape)`、或一个`原义字符（Identity Escape，有^$()*+?.[\{|共计12个)`、或一个向`后引用(backreferences)`、或一个`八进制转义符`。例如，`n`匹配字符`n`。`\n`匹配一个换行符。序列`\\`匹配`\`而`\(`则匹配`(`。

2. `^`, 匹配输入字符串的开始位置。如果设置了`RegExp`对象的`Multiline`属性，`^`也匹配`\n`或`\r`之后的位置。

3. `$`, 匹配输入字符串的结束位置。如果设置了`RegExp`对象的`Multiline`属性，`$`也匹配`\n`或`\r`之前的位置。

4. `*`, 匹配前面的子表达式零次或多次。例如，`zo*`能匹配`z`、`zo`以及`zoo`。`*`等价于`{0,}`。

5. `+`, 匹配前面的子表达式一次或多次。例如，`zo+`能匹配`zo`以及`zoo`，但不能匹配`z`。`+`等价于`{1,}`。

6. `?`, 匹配前面的子表达式零次或一次。例如，`do(es)?`可以匹配`do`或`does`中的`do`。`?`等价于`{0,1}`。

7. `{n}`, `n`是一个非负整数。匹配确定的`n`次。例如，`o{2}`不能匹配`Bob`中的`o`，但是能匹配`food`中的两个`o`。

8. `{n,}`, n是一个非负整数。至少匹配n次。例如，`o{2,}`不能匹配`Bob`中的`o`，但能匹配`foooood`中的所有`o`。`o{1,}`等价于`o+`。`o{0,}`则等价于`o*`。

9. `{m,n}`, `m`和`n`均为非负整数，其中`n<=m`。最少匹配`n`次且最多匹配`m`次。例如，`o{1,3}`将匹配`fooooood`中的前三个`o`。`o{0,1}`等价于`o?`。**请注意在逗号和两个数之间不能有空格**。

10. `?`, **非贪心量化（`Non-greedy quantifiers`）**：当该字符紧跟在任何一个其他重复修饰符（`*,+,?，{n}，{n,}，{n,m}`）后面时，匹配模式是非贪婪的。非贪婪模式尽可能少的匹配所搜索的字符串，而默认的贪婪模式则尽可能多的匹配所搜索的字符串。例如，对于字符串`oooo`，`o+?`将匹配单个`o`，而`o+`将匹配所有`o`。

11. `.`, 匹配除`\r` `\n`之外的任何单个字符。要匹配包括`\r` `\n`在内的任何字符，请使用像`(.|\r|\n)`的模式。

12. `(pattern)`, 匹配`pattern`并获取这一匹配的子字符串。该子字符串用于向后引用。所获取的匹配可以从产生的`Matches`集合得到，在`VBScript`中使用`SubMatches`集合，在`JScript`中则使用`$0…$9`属性，要匹配圆括号字符，请使用`\(`或`\)`。

13. `(?:pattern)`, 匹配`pattern`但不获取匹配的子字符串，也就是说这是一个非获取匹配，不存储匹配的子字符串用于向后引用。这在使用或字符`(|)`来组合一个模式的各个部分是很有用。例如`industr(?:y|ies)`就是一个比`industry|industries`更简略的表达式。

14. `(?=pattern)`, 正向肯定预查（`look ahead positive assert`），在任何匹配`pattern`的字符串开始处匹配查找字符串。**这是一个非获取匹配，也就是说，该匹配不需要获取供以后使用**。例如，`Windows(?=95|98|NT|2000)`能匹配`Windows2000`中的`Windows`，但不能匹配`Windows3.1`中的`Windows`。预查不消耗字符，也就是说，在一个匹配发生后，在最后一次匹配之后立即开始下一次匹配的搜索，而不是从包含预查的字符之后开始。

15. `(?!pattern)`, 正向否定预查(`negative assert`)，在任何不匹配`pattern`的字符串开始处匹配查找字符串。这是一个非获取匹配，也就是说，该匹配不需要获取供以后使用。例如`Windows(?!95|98|NT|2000)`能匹配`Windows3.1`中的`Windows`，但不能匹配`Windows2000`中的`Windows`。预查不消耗字符，也就是说，在一个匹配发生后，在最后一次匹配之后立即开始下一次匹配的搜索，而不是从包含预查的字符之后开始。

16. `(?<=pattern)`, 反向(`look behind`)肯定预查，与正向肯定预查类似，只是方向相反。例如，`(?<=95|98|NT|2000)Windows`能匹配`2000Windows`中的`Windows`，但不能匹配`3.1Windows`中的`Windows`。

17. `(?<!pattern)`, 反向否定预查，与正向否定预查类似，只是方向相反。例如`(?<!95|98|NT|2000)Windows`能匹配`3.1Windows`中的`Windows`，但不能匹配`2000Windows`中的`Windows`。

18. `x|y`, 匹配`x`或`y`。例如，`z|food`能匹配`z`或`food`。`(?:z|f)ood`则匹配`zood`或`food`。

19. `[xyz]`, 字符集合（`character class`）。匹配所包含的任意一个字符。例如，`[abc]`可以匹配`plain`中的`a`。特殊字符仅有反斜线`\`保持特殊含义，用于转义字符。其它特殊字符如`*`、`+`、各种括号等均作为普通字符。`^`如果出现在首位则表示不在字符集合；如果出现在字符串中间就仅作为普通字符。连字符 `-` 如果出现在字符串中间表示字符范围描述；如果如果出现在首位（或末尾）则仅作为普通字符。右方括号应转义出现，也可以作为首位字符出现。

20. `[^xyz]`, 排除型字符集合（`negated character classes`）。匹配未列出的任意字符。例如，`[^abc]`可以匹配`plain`中的`plin`。

21. `[a-z]`, 字符范围。匹配指定范围内的任意字符。例如，`[a-z]`可以匹配`a`到`z`范围内的任意小写字母字符。

22. `[^a-z]`, 排除型的字符范围。匹配任何不在指定范围内的任意字符。例如，`[^a-z]`可以匹配任何不在`a`到`z`范围内的任意字符。

23. `\b`, 匹配一个单词边界，也就是指单词和空格间的位置。例如，`er\b`可以匹配`never`中的`er`，但不能匹配`verb`中的`er`。

24. `\B`, 匹配非单词边界。`er\B`能匹配`verb`中的`er`，但不能匹配`never`中的`er`。

25. `\cx`, 匹配由x指明的控制字符。例如，`\cM`匹配一个`Control-M`或回车符。`x`的值必须为`A-Z`或`a-z`之一。否则，将`c`视为一个原义的`c`字符。

26. `\d`, 匹配一个数字字符。等价于`[0-9]`。注意`Unicode`正则表达式会匹配全角数字字符。

27. `\D`, 匹配一个非数字字符。等价于`[^0-9]`。

28. `\f`, 匹配一个换页符。等价于`\x0c`和`\cL`。

29. `\n`, 匹配一个换行符。等价于`\x0a`和`\cJ`。

30. `\r`, 匹配一个回车符。等价于`\x0d`和`\cM`。

31. `\s`, 匹配任何空白字符，包括空格、制表符、换页符等等。等价于`[ \f\n\r\t\v]`。注意`Unicode`正则表达式会匹配全角空格符。

32. `\S`, 匹配任何非空白字符。等价于`[^ \f\n\r\t\v]`。

33. `\t`, 匹配一个制表符。等价于`\x09`和`\cI`。

34. `\v`, 匹配一个垂直制表符。等价于`\x0b`和`\cK`。

35. `\w`, 匹配包括下划线的任何单词字符。等价于`[A-Za-z0-9_]`。注意`Unicode`正则表达式会匹配中文字符。

36. `\W`, 匹配任何非单词字符。等价于`[^A-Za-z0-9_]`。

37. `\ck`, 匹配控制转义字符。`k`代表一个字符。等价于`Ctrl-k`。用于`ECMA`语法。

38. `\xnn`, 十六进制转义字符序列。匹配两个十六进制数字nn表示的字符。例如，`\x41`匹配`A`。`\x041`则等价于`\x04&1`。正则表达式中可以使用`ASCII`编码。

39. `\num`, 向后引用（`back-reference`）一个子字符串（`substring`），该子字符串与正则表达式的第`num`个用括号围起来的捕捉群（`capture group`）子表达式（`subexpression`）匹配。其中`num`是从`1`开始的十进制正整数，其上限可能是`9`、`31`、`99`甚至无限。例如：`(.)\1`匹配两个连续的相同字符。

40. `\n`, 标识一个八进制转义值或一个向后引用。如果`\n`之前至少`n`个获取的子表达式，则`n`为向后引用。否则，如果`n`为八进制数字`（0-7）`，则`n`为一个八进制转义值。

41. `\nm`, `3`位八进制数字，标识一个八进制转义值或一个向后引用。如果`\nm`之前至少有`nm`个获得子表达式，则`nm`为向后引用。如果`\nm`之前至少有`n`个获取，则`n`为一个后跟文字`m`的向后引用。如果前面的条件都不满足，若`n`和`m`均为八进制数字（`0-7`），则`\nm`将匹配八进制转义值`nm`。

42. `\nml`, 如果`n`为八进制数字（`0-3`），且`m`和`l`均为八进制数字（`0-7`），则匹配八进制转义值`nml`。

43. `\un`, `Unicode`转义字符序列。其中`n`是一个用四个十六进制数字表示的`Unicode`字符。例如，`\u00A9`匹配版权符号（`©`）。

### `POSIX`

![posix](posix.png)

### 优先权

| 优先权        | 符号           |
|:-------------:|:-------------:|
| 最高      | `\` |
| 高     | `( )、(?: )、(?= )、[ ]`      | 
| 中 | `*、+、?、{n}、{n,}、{m,n}`   |
|低|^、$、中介字符|
|次最低|串接，即相邻字符连接在一起| 
|最低|&#124;|

### 示例

-  匹配至少同时包含大小写字母，数字以及符号中其中两个的密码字符串：`^(?![A-Z]+$)(?![a-z]+$)(?!\d+$)(?!\W+$)\S{8,16}$`

    123131sdadad
    #%sdad@#$dsd

### 参考阅读

- [正则表达式](https://zh.wikipedia.org/wiki/%E6%AD%A3%E5%88%99%E8%A1%A8%E8%BE%BE%E5%BC%8F)
- [Regular_expression](http://en.wikipedia.org/wiki/Regular_expression)
- [正则表达式应用示例](http://regularexp.wordpress.com/)
- [正则表达式“派别”简述](http://liujiacai.net/blog/2014/12/07/regexp-favors/)
- [POSIX Bracket Expressions](http://www.regular-expressions.info/posixbrackets.html)
- [MSDN正则表达式语法介绍](http://msdn.microsoft.com/zh-cn/library/ae5bf541(v=vs.100).aspx)
- [正则表达式30分钟入门教程](http://deerchao.net/tutorials/regex/regex.htm)
- [`GNU Regular Expression Extensions`](http://www.regular-expressions.info/gnu.html)
- [`RegExr: Learn, Build, & Test RegEx`](https://regexr.com/)
- [Linux/Unix工具与正则表达式的POSIX规范](http://www.infoq.com/cn/news/2011/07/regular-expressions-6-POSIX)
- [`Comparison of regular expression engines`](https://zh.wikipedia.org/w/index.php?title=Comparison_of_regular_expression_engines&action=edit&redlink=1)
- [各种语言或工具软件的不同风格的正则表达式文法规定](http://www.greenend.org.uk/rjk/2002/06/regexp.html)
- [`Different types of regular expressions Gnulib supports`](https://www.gnu.org/software/gnulib/manual/html_node/Regular-expression-syntaxes.html)