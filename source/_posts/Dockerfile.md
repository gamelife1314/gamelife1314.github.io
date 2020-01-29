---
title: Dockerfile
date: 2018-02-03 15:21:45
categories:
- Docker
tags:
- Docker
---

Docker可以通过从`Dockerfile`中读取指令自动构建镜像，`Dockerfile`是一个包含所有命令的文本文件，以便构建给定的镜像。`Dockerfile`遵循一定的文件格式并且使用一系列指定的命令。

本篇文章讲学习docker推荐的dockerfile书写✍️规范，可以参考[Dockerfile Reference ](https://docs.docker.com/engine/reference/builder/),本节参考官方原文[Dockerfile 最佳实践](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/).

{% asset_img docker.png docker %}

<!--more-->

### 用法

[`docker build`](https://docs.docker.com/engine/reference/commandline/build/)命令从`Dockerfile`和一个`contaxt`创建一个镜像。`context`是通过`PATH`或者`URL`指定的一系列文件。`PATH`是本地文件系统的一个目录，`URL`是一个git仓库地址。

一个上下文会被递归地处理，所以一个`PATH`包含了所有的它的子目录，一个`URL`包含了它的仓库以及它的子模块。下面是一个使用当前目录作为上下文的例子，注意命令最后面的那个`.`：

        $ docker build .
        Sending build context to Docker daemon  6.51 MB
        ...

要注意的是，整个的构建过程不是docker CLI运行的，而是由docker daemon操作，整个构建过程的第一步就是发送整个上下文目录到docker daemon。强烈建议，最好将你的Dockerfile放置在一个空目录下面然后再开始，只把你需要的文件添加进去。

`Dockerfile`通过指令引用一个上下文中的文件，例如`Copy`指令。为了增加构建的性能，可以通过`.dockerignore`排除上下文目录中的一些文件，具体可以查看[`.dockerignore`](https://docs.docker.com/engine/reference/builder/#dockerignore-file)。

通常情况下，`Dockerfile`通常被称作`Dockerfile`，并且位于上下文根目录中，不过你也可以通过`-f`命令指定任何操作系统上的`Dockerfile`文件，例如：

        $ docker build -f /path/to/a/Dockerfile .

你也可以指定一个仓库名称和标签用于在构建成功之后存储新的镜像：

        docker build -t shykes/myapp .

如果要给新的镜像打多个标签，你可以使用多个`-t`参数指定：

        $ docker build -t shykes/myapp:1.0.2 -t shykes/myapp:latest .

在Docker daemon 运行`Dockerfile`中的构建命令之前，会进行dockerfile中命令预检查，会在语法错误的时候返回异常消息，例如：

        $ docker build -t test/myapp .
        Sending build context to Docker daemon 2.048 kB
        Error response from daemon: Unknown instruction: RUNCMD

Docker daemon进程会一条一条滴运行`Dockerfile`中的命令，在必要的时候会将每个命令的结果提交至新的镜像，最后输出新镜像ID，结束之后 docker daemon会自动清理上下文。

要注意的是，每条指令都是独立运行的，并且会导致创建一个新的镜像。所以`RUN cd /tmp`对下一条指令没有影响。

只要有可能，docker会重新使用缓存的镜像以加速docker构建过程，这个对于镜像的构建提速有这非常大的意义。是否使用缓存会在控制台消息中看到，例如：

        $ docker build -t svendowideit/ambassador .
        Sending build context to Docker daemon 15.36 kB
        Step 1/4 : FROM alpine:3.2
        ---> 31f630c65071
        Step 2/4 : MAINTAINER SvenDowideit@home.org.au
        ---> Using cache
        ---> 2a1c91448f5f
        Step 3/4 : RUN apk update &&      apk add socat &&        rm -r /var/cache/
        ---> Using cache
        ---> 21ed6e7fbb73
        Step 4/4 : CMD env | grep _TCP= | (sed 's/.*_PORT_\([0-9]*\)_TCP=tcp:\/\/\(.*\):\(.*\)/socat -t 100000000 TCP4-LISTEN:\1,fork,reuseaddr TCP4:\2:\3 \&/' && echo wait) | sh
        ---> Using cache
        ---> 7ea8aef582cc
        Successfully built 7ea8aef582cc

### 格式

下面是`Dockerfile`的格式

        # Comment  注释
        INSTRUCTION arguments  指令

指令不区分大小写，但是惯例上是使用大写以便和他们的参数区分开。docker会顺序运行`Dockerfile`中的指令，**一个`Dockerfile`必须以`FROM`指令开始**。`FROM`指令用于声明构建的基础镜像。`FROM`命令只能在一个或者多个`ARG`命令之前，这些指令用于声明在`FROM`命令中用到的参数。

以`#`开头除非是解析器指令否则docker会将其当做注释，行中的`#`会被当做是一个参数，例如：

        # Comment
        RUN echo 'we are running some # of cool things'

注释中不支持换行符。

### 解析器指令

解析器指令是可选的，它会影响`Dockerfile`中其后的指令被处理的方式。解析器指令不会导致新的镜像层被添加，也不会出现在构建步骤中。解析器指令以一种特殊类型的注释写入，`# directive=value`， **一个指令只能使用一次**。

一旦注释，空行或构建器指令已经被处理，Docker不再查找解析器指令。相反，它将解析器指令格式的内容内容视为注释，并不再尝试验证它是否可能是解析器指令。因此，所有的解析器指令都必须位于Dockerfile的最顶端。

解析器指令也是大小写不敏感，但是，惯例上常将他们写作小写，惯例上也会在解析器指令后面保留一个空行，解析器指令中也不支持换行符。

由于以上规则的限制，下面的例子都是无效的：

由于换行导致无效：

        # direc \
        tive=value

由于出现两次导致无效：

        # directive=value1
        # directive=value2

        FROM ImageName

由于出现在一个构建命令之后会被当做注释：

        FROM ImageName
        # directive=value

由于出现在一个不是解析器指令的注释后面，因此被当做注释：

        # About my dockerfile
        # directive=value
        FROM ImageName

未知的指令由于无法解析被当做注释，已知的指令也被当做注释因为他出现在注释之后

        # unknowndirective=value
        # knowndirective=value

解析器指令中允许出现非换行空白符，因此下面的指令都是同样的效果：

        #directive=value
        # directive =value
        #	directive= value
        # directive = value
        #	  dIrEcTiVe=value

支持的解析器指令如下：

    - `escape`


### `escape`

- `# escape=\ (backslash)`

- 或者 

        # escape=` (backtick)

`escape`指令设置用于转义的字符，，默认是：`\`。`escape`即用于行中字符换衣也用于转义一个新行，这将允许dockerfile中的指令跨越多行。请注意，不管escapeer解析器指令是否包含在Dockerfile中，除了在行的末尾RUN命令中都不会执行转义。

设置转义字符为`` ` ``在Windows上是特别有用的，因为windows上`\`被用作路径分隔符。

考虑下面的例子，在Windows上会以一种非显而易见的方式失败，第二行结尾的`\`会被解释为开始一个新行，而不是和前一个`\`一起被解释成为`\`而表示路径分隔符。同样第三行的指令将会被认为是第二行指令的继续

        FROM microsoft/nanoserver
        COPY testfile.txt c:\\
        RUN dir c:\

这将导致：
        
        PS C:\John> docker build -t cmd .
        Sending build context to Docker daemon 3.072 kB
        Step 1/2 : FROM microsoft/nanoserver
        ---> 22738ff49c6d
        Step 2/2 : COPY testfile.txt c:\RUN dir c:
        GetFileAttributesEx c:RUN: The system cannot find the file specified.
        PS C:\John>

        PS： 意思为 Powershell

解析方案是通过添加转义解析器指令，以下Dockerfile成功按预期使用Windows上文件路径的自然语义：

        # escape=`

        FROM microsoft/nanoserver
        COPY testfile.txt c:\
        RUN dir c:\

这将会输出：

        PS C:\John> docker build -t succeeds --no-cache=true .
        Sending build context to Docker daemon 3.072 kB
        Step 1/3 : FROM microsoft/nanoserver
        ---> 22738ff49c6d
        Step 2/3 : COPY testfile.txt c:\
        ---> 96655de338de
        Removing intermediate container 4db9acbb1682
        Step 3/3 : RUN dir c:\
        ---> Running in a2c157f842f5
        Volume in drive C has no label.
        Volume Serial Number is 7E6D-E0F7

        Directory of c:\

        10/05/2016  05:04 PM             1,894 License.txt
        10/05/2016  02:22 PM    <DIR>          Program Files
        10/05/2016  02:14 PM    <DIR>          Program Files (x86)
        10/28/2016  11:18 AM                62 testfile.txt
        10/28/2016  11:20 AM    <DIR>          Users
        10/28/2016  11:20 AM    <DIR>          Windows
                2 File(s)          1,956 bytes
                4 Dir(s)  21,259,096,064 bytes free
        ---> 01c7f3bef04f
        Removing intermediate container a2c157f842f5
        Successfully built 01c7f3bef04f
        PS C:\John>


### `.dockerignore`文件

在docker命令行工具将上下文发送到docker daemon之前，它会去查找上下文根目录下是否有`.dockerignore`文件，如果有，docker CLI会排出`.dockerignore`中匹配的文件或者目录。这将有助于避免添加大型或者敏感文件到docker daemon，从而加快构建过程。

docker CLI将`.dockerignore`文件解释为以换行符分隔的模式列表，类似于Unix shell的文件格式。为了匹配，上下文的根目录被认为是工作目录和根目录。例如，`/foo/bar`或者`foo/bar`都会被用于去排除一个`PATH`中的`foo`子目录下的名为`bar`的文件或者目录，当`PATH`用作一个Git仓库的时候，是同样的道理。

`.dockerignore`文件中以`#`开始的行被docker CLI解释为一个注释。

下面是一个`.dockerignore`文件的例子：

        # comment
        */temp*
        */*/temp*
        temp?

这个文件将导致以下的构建行为：

|Rule|行为|
|:--:|:--:|
|`# comment`|注释被忽略|
|`*/temp*`|排除在根目录的任何直接子目录中名称以`temp`开头的文件和目录。例如，纯文件`/somedir/temporary.txt`被排除，目录`/somedir/temp`也被排除。|
|`*/*/temp*`|从根目录下两个级别的任何子目录中排除以`temp`开头的文件和目录。例如，排除`/somedir/subdir/temporary.txt`。|
|`temp?`|排除根目录中任何以`temp`开头的文件或者目录|

匹配是使用Go的[filepath.Match](http://golang.org/pkg/path/filepath#Match)规则完成的。预处理步骤删除前导和尾随空白，并消除`.`和`..`。预处理后空白的行将被忽略。

除了go的规则之外，docker还支持一个特别的通配符字符串`**`，用于匹配任意数量的目录（包括0）。例如：`**/*.go`将会排除所有目录包括上下文根目录中的任何以`.go`结尾的文件。

以`!`开始的行用于排除例外情况，下面是使用此机制的示例文件：
        
        *.md
        !README.md

所有除了`Readme.md`的markdown文件将被排除。

你甚至可以在`.dockerignore`中排除`Dockerfile`，但是它任然会被发送到docker daemon, 因为它需要他完成工作。但是`ADD`和`COPY`指令不能把它添加到镜像。

最后，如果你只是想去包含某些文件而不是排除某些文件，你可以这样做，先用`*`排除任何文件，然后用`!`指令指定那些你仅仅要包含的文件。


### `FROM`

`FROM`指令有三种格式，用于指定新镜像的[基础镜像](https://docs.docker.com/glossary/):

- `FROM <image> [AS <name>]`

- `FROM <image>[:<tag>] [AS <name>]`

- `FROM <image>[@<digest>] [AS <name>]`

FROM指令初始化一个新的构建环境，并设置后续指令的基础映像。由于这个，一个有效的`Dockerfile`文件必须以一个`FROM`指令开始，基础镜像可以是任何有效的镜像。关于`FROM`指令有以下的一些注意点：

- `ARG` 指令是唯一`Dockerfile`中在`FROM`之前被处理的命令；

- 在单个`Dockerfile`文件中`FROM`指令可以出现多次用于创建多个镜像或者将一个构建作为下一个的依赖；

- 可选地可以使用`AS name`指定新构建的名称，以用于之后的`FROM`指令和`COPY --from=<name|index>`以引用此阶段构建的镜像；

- `tag`和`digest`是可选的，`tag`默认值是`latest`，如果指定的`tag`没有找到，docker将会返回错误。


#### 理解`ARG`和`FROM`如何交互

`FROM`指令支持由第一个`FROM`之前发生的任何`ARG`指令声明的变量。

        ARG  CODE_VERSION=latest
        FROM base:${CODE_VERSION}
        CMD  /code/run-app

        FROM extras:${CODE_VERSION}
        CMD  /code/run-extras

在`FROM`之前声明的`ARG`不在构建阶段，所以它不能在`FROM`之后的任何指令中使用。要使用在第一个`FROM`之前声明的`ARG`的默认值，可以在构建阶段内使用没有值的`ARG`指令：

        ARG VERSION=latest
        FROM busybox:$VERSION
        ARG VERSION
        RUN echo $VERSION > image_version

### `RUN`

`RUN`命令有两种格式，关于这两种格式的不同请看：[https://stackoverflow.com/questions/42805750/dockerfile-cmd-shell-versus-exec-form](https://stackoverflow.com/questions/42805750/dockerfile-cmd-shell-versus-exec-form)

- shell 格式，命令被一个shell中运行，linux上默认是：`/bin/sh -c`, Windows上是：`cmd /S /C`;

- exec 格式，例如：`["executable", "param1", "param2"]`

`RUN`指令将在当前镜像的顶层运行命令，并将结果提交已构成新的镜像，生成的镜像用于接下来的步骤。分层运行指令并且生成提交符合Docker的核心概念，容器可以从镜像历史中的任何一点创建，这点很想代码版本控制系统。

exec格式可以避免字符串替换，并且可运行在一个没有指定shell可执行文件的镜像中。

shell格式的默认shell可执行文件可以通过`SHELL`指令设置。shell格式中可以通过`\`将较长的命令换行，例如：

        RUN /bin/bash -c 'source $HOME/.bashrc; \
        echo $HOME'

其实就是

        RUN /bin/bash -c 'source $HOME/.bashrc; echo $HOME'

为了除了`/bin/sh`之外的shell，可以在exec格式中指定，exec格式传入的是一个json数组，意味着你必须使用双引号而不能使用单引号，例如：

        RUN ["/bin/bash", "-c", "echo hello"]

还有，exec格式不同于shell格式的是它不会调用一个命令shell，这意味着正常的shell处理过程不会发生。例如：`RUN [ "echo", "$HOME" ]`, 将不会发生变量替换。你如果要实现这个你可以用shell格式或者在exec格式中直接使用shell，例如：`RUN [ "sh", "-c", "echo $HOME" ]`; 当用exec直接执行一个shell和使用shell格式就没区别了，环境变量的替换是由shell完成而不是docker。在json格式中，必须要转义反斜线。例如：`RUN ["c:\windows\system32\tasklist.exe"]` 由于不是一个有效的json将会被当做shell格式来执行，正确的应该是：`RUN ["c:\\windows\\system32\\tasklist.exe"]`。

`RUN`指令会缓存结果用于下次使用，例如：`RUN apt-get dist-upgrade -y`的执行结果将被缓存并用于下次构建。指令缓存可以被`--no-cache`禁止，例如：`docker build --no-cache`。

### `CMD`

CMD命令有三种格式：

- `CMD ["executable","param1","param2"]`, exec格式，推荐格式；

- `CMD ["param1","param2"]`, 作为`ENTRYPOINT`的默认参数；

- `CMD command param1 param2` shell 格式

`Dockerfile`中只允许有一个`CMD`命令，如果出现多个，只有第一个有用。

之前介绍容器的时候曾经说过，`Docker`不是虚拟机，容器就是进程，既然是进程，那么在启动容器的时候，需要指定所运行的程序及参数。`CMD`指令就是用于指定默认的容器主进程的启动命令的。

在运行时可以指定新的命令来替代镜像设置中的这个默认命令，比如，ubuntu 镜像默认的`CMD`是 `/bin/bash`，如果我们直接`docker run -it ubuntu`的话，会直接进入`bash`。我们也可以在运行时指定运行别的命令，如 `docker run -it ubuntu cat /etc/os-release`。这就是用 `cat /etc/os-release` 命令替换了默认的 `/bin/bash` 命令了，输出了系统版本信息。

如果在`CMD`命令中省略了可执行文件，你必须声明一个`ENTRYPOINT`指令。


`CMD`命令使用提醒：

- 如果`CMD`命令被用于为`ENTRYPOINT`指令提供参数，那么这两个命令都必须使用JSON数组格式。

- 如果`CMD`命令使用exec格式，因为其被解释为一个json数组，因此你必须使用双引号而不是单引号。

- 不同于shell格式，exec格式不会调用一个命令行shell，这意味着正常的shell处理过程不会发生。例如：`CMD [ "echo", "$HOME" ]`将不提供对变量`$HOME`的解析。如果你想要shell的处理过程，你可以使用shell格式或者直接执行一个shell，例如：`CMD [ "sh", "-c", "echo $HOME" ]`。

如果你想在没有shell的情况下运行你的`<command>`，那么你必须将这个命令表示为一个JSON数组，并给出可执行文件的完整路径。数组形式是CMD的首选格式。任何附加参数都必须在数组中分别表示为字符串：

        FROM ubuntu
        CMD ["/usr/bin/wc","--help"]

如果你的容器每次在启动的时候执行相同的可执行文件，那么你可以使用`ENTRYPOINT`指令配合`CMD`。

### `LABEL`

格式如下：`LABEL <key>=<value> <key>=<value> <key>=<value> ...`

`LABEL`用于给镜像添加元数据，一个`LABEL`是一个键值对，要在`LABEL`值中包含空格，可以像在命令行解析中一样使用引号和反斜杠。看着几个例子：

        LABEL "com.example.vendor"="ACME Incorporated"
        LABEL com.example.label-with-value="foo"
        LABEL version="1.0"
        LABEL description="This text illustrates \
        that label-values can span multiple lines."

一个镜像可以有多个标签，可以有两种方式来写，例如下面：

        LABEL multi.label1="value1" multi.label2="value2" other="value3"

或者

        LABEL multi.label1="value1" \
              multi.label2="value2" \
              other="value3"

标签是可以继承的，新的镜像会继承在来自父镜像的`LABEL`,对于同名的标签，最近设置的会覆盖先前设置的，可以通过`docker inspect`查看镜像的标签：

        "Labels": {
                "com.example.vendor": "ACME Incorporated"
                "com.example.label-with-value": "foo",
                "version": "1.0",
                "description": "This text illustrates that label-values can span multiple lines.",
                "multi.label1": "value1",
                "multi.label2": "value2",
                "other": "value3"
        },

### `EXPOSE`

        EXPOSE <port> [<port>/<protocol>...]

`EXPOSE`指令用于声明docker容器在运行时监听的端口，你也可以指定监听的协议是TCP还是UDP，默认：TCP；

`EXPOSE`指令不实际发布端口。它用作构建镜像的人和运行容器的人之间的文档类型，关于哪个端口打算发布。要在运行容器时实际发布端口，可以在`docker run`上使用`-p`标志来发布和映射一个或多个端口，或使用`-P`标志来发布所有公开的端口并将它们映射到高阶端口。

### `ENV`

        ENV <key> <value>
        ENV <key>=<value> ...

`ENV`指令用于设置环境变量`key`为值`value`, 这个值将存在于所有后代Dockerfile命令的环境中，并且可以在许多内联中被替换。

`ENV`有两种形式，第一种是：`ENV <key> <value>`, 将设置一个变量为一个值，`<key>`后面第一个空格之后的整个字符串将被视为`<value>` - 包括诸如空格和引号之类的字符。

第二种形式是`ENV <key>=<value> ...`，允许同时设置多个变量。注意这种格式使用`=`进行赋值，同命令行解析一样，引号和反斜线可以用于去在值中包含空格，例如：

        ENV myName="John Doe" myDog=Rex\ The\ Dog \
            myCat=fluffy

等同于：

        ENV myName John Doe
        ENV myDog Rex The Dog
        ENV myCat fluffy

使用`ENV`设置的环境变量将保留在镜像中，你可以通过`docker inspect`命令查看，可以在运行时通过`docker run --env <key>=<value>`进行更改。

### `ADD`

`ADD`命令有两种格式：

        ADD [--chown=<user>:<group>] <src>... <dest>
        ADD [--chown=<user>:<group>] ["<src>",... "<dest>"]  这种格式允许路径中存在空格

        --chown仅仅用于创建linux上的容器的时候

`ADD`用于从`<src>`指定的文件，目录或者远端URL复制文件，并且把他们添加到`<dest>`指定的镜像文件系统中。可以指定多个`<src>`，但如果他们是文件或者目录，他们相对于构建的上下文。

        ADD hom* /mydir/        # 添加所有以"home"开始的文件
        ADD hom?.txt /mydir/    # ? 将被替换为任何单一的字符，例如： "home.txt"

`<dest>`是一个绝对路径，或者是一个相对`WORKDIR`路径，源数据将被复制到目标容器中。

        ADD test relativeDir/          # 添加"test"到 `WORKDIR`/relativeDir/
        ADD test /absoluteDir/         # 添加"test"到 /absoluteDir/

如果要添加的目录或者文件包含特殊字符，你需要去转义这些字符而遵循golang的规则，防止他们被当做一个匹配模式。例如，为了添加一个名为`arr[0].txt`的文件，可以这样做：

        ADD arr[[]0].txt /mydir/    # copy a file named "arr[0].txt" to /mydir/

除非可选的`--chown`标志指定给定的用户名，组名或`UID`/`GID`组合来请求所添加内容的特定所有权，否则所有新文件和目录都将使用`UID`和`GID`为0创建。`--chown`标志的格式允许使用用户名和组名字符串，或者以任何组合方式直接使用整数`UID`和`GID`。如果只是提供了用户名而没有组名，或者只是提供了`UID`而没有提供`GID`，那么相同的`UID`将作为`GID`。下面展示使用`--chown`的例子：

        ADD --chown=55:mygroup files* /somedir/
        ADD --chown=bin files* /somedir/
        ADD --chown=1 files* /somedir/
        ADD --chown=10:11 files* /somedir/


如果容器根文件系统不包含`/etc/passwd`或`/etc/group`文件，并且在`--chown`标志中使用了用户名或组名，则构建将在ADD操作中失败。使用数字标识不需要查找，也不依赖于容器根文件系统内容。

在`<src>`是远程文件URL的情况下，目标将具有600的权限，如果正在检索的远程文件具有HTTP`Last-Modified`标头，则将使用该标头的时间戳来设置目标文件上的`mtime`。但是，与在ADD过程中处理的任何其他文件一样，在确定文件是否已更改以及缓存是否应更新时，`mtime`将不会在考虑之内。

需要注意以下几点：

1. 如果通过STDIN输入`Dockerfile`（`docker build - < somefile`）,是没有构建上下文的，所以`Dockerfile`只能包含一个机遇URL的`ADD`指令；你也可以传递一个压缩文件（`docker build - < archive.tar.gz`）,`Dockerfile`位于根目录下面，剩下的部分作为构建的上下文。

2. 如果你的URL文件使用身份验证进行保护，则你将需要使用`RUN wget`，`RUN curl`或使用容器内的其他工具，`ADD`指令不支持身份验证。

`ADD`指令遵循以下几个原则：

- `<src>`路径必须存在于构建上下文中，你不能这样：`ADD ../something /something`；

- 如果`<src>`是一个URL并且`<dest>`不以结尾的斜杠结尾，那么文件将从URL下载并复制到`<dest>`，文件将从URL下载复制到`<dest>`;

- 如果`<src>`是一个URL，并且`<dest>`以结尾的斜杠结束，则从URL中推断出该文件名，并将该文件下载到`<dest>/<filename>。`例如，`ADD http://example.com/foobar /`会创建文件`/foobar`。

- 如果`<src>`是一个目录，则目录的整个内容将被复制，包括文件系统的元数据。

- 如果指定了多个`<src>`资源（直接或由于使用通配符），则`<dest>`必须是一个目录，并且必须以斜杠/结尾。

- 如果`<dest>`不以结尾的斜杠结尾，则它将被视为常规文件，`<src>`的内容将写入`<dest>`。

- 如果`<dest>`不存在，则会在路径中创建所有缺少的目录.


### `COPY`

`COPY`命令有两种形式

- `COPY [--chown=<user>:<group>] <src>... <dest>` 
- `COPY [--chown=<user>:<group>] ["<src>",... "<dest>"]` 如果路径里面包含空格就用这中格式

`COPY`指令从`<src>`复制新的文件或者目录添加到容器文件系统中的`<dest>`路径。可以声明多个资源，但是文件或者目录的路径将被解释为相对于构建的上下文。文件路径中可以通配符：

        COPY hom* /mydir/        # adds all files starting with "hom"
        COPY hom?.txt /mydir/    # ? is replaced with any single character, e.g., "home.txt"

`<dest>`是一个绝对路径或者相对于`WORKDIR`的路径

        COPY test relativeDir/   # adds "test" to `WORKDIR`/relativeDir/
        COPY test /absoluteDir/  # adds "test" to /absoluteDir/

