---
title: Nginx
date: 2022-10-26 23:03:57
tags:
  - Nginx
categories:
  - Nginx
---

{% asset_img cover.png cover %}

### 环境准备

以下使用 `docker` 准备学习环境。

1. 先拉取`centos`的最新镜像：`docker image pull centos`
2. 创建一个数据卷用于存放容器中产生的文件：`docker volume create centos`
3. 启动我们的容器：`docker run -d -it -v centos:/workdir --name centos  centos /bin/bash`
4. 进入我们的容器：`docker exec -it centos /bin/bash`

### Nginx 的主要应用场景

1. 静态资源服务，即通过本地文件系统提供服务；
2. 反向代理服务，提供缓存，负载均衡功能；
3. `API`服务，通过`Openresty`直接访问数据库；

{% asset_img scene.png cover %}

<!-- more -->

### Nginx 的组成部分

1. `Nginx` 二进制可执行文件；
2. `Nginx.conf` `Nginx` 配置文件，控制`Nginx`的行文；
3. `access.log` 访问日志，记录一条 `http` 请求信息；
4. `error.log` 错误日志；

### 热部署

为了便于演示，在编译`Nginx`的时候添加[`echo-nginx-module`](https://github.com/openresty/echo-nginx-module)模块，记录一次编译（我所有的操作都是在目录 `/workdir`下）：

1. 源代码下载页面：[`http://nginx.org/en/download.html`](http://nginx.org/en/download.html) 先下载 `1.14.1` 版本，然后升级到 `1.15.6` 最新版；

2. 下载源代码并且解压，`wget http://nginx.org/download/nginx-1.14.1.tar.gz`，然后 `tar -xzvf nginx-1.14.1.tar.gz`

3. 下载 [`nginx-echo-module`](https://github.com/openresty/echo-nginx-module)，`wget https://github.com/openresty/echo-nginx-module/archive/master.zip -O nginx-echo-module.zip`，并且解压：`unzip nginx-echo-module.zip`

4. 我们开始编译，`./configure --prefix=/workdir/nginx --add-module=/workdir/echo-nginx-module-master`

5. 结束之后，我们执行：`make`，这时候nginx已经编译好，在 `objs` 目录下，例如：

    ![compile.png](compile.png)

6. 首次编译，我们执行 `make install` 安装我们执行的目录：`/workdir/nginx`

7. 至此将看到如下的目录结构：

    ![directory.png](directory.png)

8. 修改Nginx的配置文件让其输出版本号，便于以后升级比较，`vim nginx/cong/nginx.conf`：

    ![version](version.png)
    
    利用我们添加的`echo`模块中包含的 `echo` 指令输出 Nginx的版本号。

9. 启动 Nginx （执行命令 `./nginx/sbin/nginx`）之后，我们访问: `http://localhost/version`，将会看到：

    ![visit version](version-1.png)

10. 我们下载 `1.15.6` 版本，并且编译好，编译的时候依然带上`echo` 模块，但不要执行 `make install`，将会看到如下结构：

    ![new-version](new-version.png)

11. 由于热更新只是替换二进制文件，但是我们在操作之前先备份旧的二进制文件：`cp ./nginx/sbin/nginx ./nginx/sbin/nginx.old`

12. 使用新版的`Nginx`二进制文件替换掉当前正在使用中的：`cp -f  nginx-1.15.6/objs/nginx ./nginx/sbin/nginx`

13. 发送信号至正在运行的Nginx，告诉它我们要进行热部署，升级Nginx，`kill -USR2 MasterPID`

    ![查看正在运行的nginx进程](pids.png)

    这个时候会使用新的二进制文件新起一个`master`进程，并且将新的请求转到新的`worker`进程中处理，旧的`master`和`worker`虽然仍然存活，但已经不再监听相应的端口并且接受请求了，这个时候我们在查看版本号，就是升级之后的版本了：

        [root@5b4bb2c41637 sbin]# curl http://localhost/version
        1.15.6

14. 关闭老的 `worker` 进程，发送信号给旧的 `MasterPID`，`kill -WINCH MasterPID`：

    ![close-worker](close-worker.png)

    可以看到老的`worker`进程已经关闭了，但是此时老的`master`进程依然存在，是因为如果升级有问题，我们还可回退。回滚的时候，向老的 `master` 进程发送 `HUP`信号，向新的 `master` 发送 `QUIT` 信号。

15. 如果正常升级之后，应该给老的 `master` 进程发送 `QUIT` 信号，使其优雅退出。

### nginx 命令行

1. `nginx -s quit` 优雅退出进程
2. `nginx -s stop` 立即退出进程

### nginx 常用配置学习

#### 配置静态资源访问服务器

```
server {
    listen 8081;
    location / {
        root /workdir/libc;
        index index.html index.htm;
    }
}
```

#### 记录 `access` 日志

使用 [`ngx_http_log_module`](http://nginx.org/en/docs/http/ngx_http_log_module.html) 模块我们来配置记录访问日志：


```
http {
    include       mime.types;
    default_type  application/octet-stream;

    # 设置日志格式
    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_forwarded_for"';

    sendfile        on;
    #tcp_nopush     on;

    #keepalive_timeout  0;
    keepalive_timeout  65;

    #gzip  on;

    server {
        listen       80;
        server_name  localhost;
        # 开启访问日志
        access_log  logs/access.log  main;
        location / {
            root   html;
            index  index.html index.htm;
        }
        
        location /version {
	        echo $nginx_version;
	    }
        error_page   500 502 503 504  /50x.html;
        location = /50x.html {
            root   html;
        }
    }
    
    include vhost/*.conf;
}
```

#### 开启 `gzip` 压缩

使用 [`ngx_http_gzip_module`](http://nginx.org/en/docs/http/ngx_http_gzip_module.html) 提供的功能，对静态文件进行压缩

```
http {
    ....
    gzip on;
    # 小于1k不压缩
    gzip_min_length  1k;
    gzip_buffers     4 16k;
    gzip_http_version 1.1;
    # 设置压缩级别
    gzip_comp_level 2;
    gzip_types  text/plain application/javascript application/x-javascript text/javascript text/css application/xml;
    gzip_vary on;
    gzip_proxied   expired no-cache no-store private auth;
    # IE6 一下禁用
    gzip_disable   "MSIE [1-6]\.";
    ....
}
```

#### 开启防盗链

使用 [`ngx_http_referer_module`](http://nginx.org/en/docs/http/ngx_http_referer_module.html) 提供的功能实现防盗链：

```
location ~ .*\.(gif|jpg|jpeg|png|bmp|swf)$
{
    valid_referers blocked server_names *.fudenglong.site;
    if ($invalid_referer) {
        return 403;
    }
    expires      30d;
    access_log off; 
}
```

#### 反向代理

使用 [`ngx_http_upstream_module`](http://nginx.org/en/docs/http/ngx_http_upstream_module.html#upstream) 模块提供的 `upstream` 来配置上游服务器：

```
upstream local {
    server 127.0.0.1:8080
}
```

指定某些路径配置反向代理，使用[`ngx_http_proxy_module`](http://nginx.org/en/docs/http/ngx_http_proxy_module.html)提供的指令：

[`proxy_cache_path`](http://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_cache_path) 配置缓存存储路径：

```
proxy_cache_path /tmp/nginxcache levels=1:2 keys_zone=my_cache:10m max_size=10g inactive=60m use_temp_path=off;
```

```
location / {
    proxy_set_header Host $host;
    proxy_set_headet X-Real-IP $remote_addr;
    proxy_set_header X-Forward-For $proxy_add_x_forwarded_for;

    proxy_cache my_cache;
    proxy_cache_key $host$uri$is_args$args;
    proxy_cache_valid 200 304 302 1d;
    proxy_pass http://local;
}

```

### 配置指令

#### `location`

`location` 配置指令是由 [ngx_http_core_module](http://nginx.org/en/docs/http/ngx_http_core_module.html#location) 模块提供，它的配置是下面这个样组的：

```
语法:  location [ = | ~ | ~* | ^~ ] uri { ... }
       location @name { ... }
默认:   —
上下文: server, location
```

它主要是用于根据请求 `URL` 设置配置，在解码以 `％XX` 形式编码的文本，解析对相对路径组件 `.`和`..`的引用，并将两个或多个相邻斜杠`/`的可能[压缩](http://nginx.org/en/docs/http/ngx_http_core_module.html#merge_slashes)为单个斜杠之后，对规范化的URI执行匹配。

一个`location` 可以被一个前缀字符串定义或者一个正则表达式，正则表达式通过 `~*`(大小写不敏感) 或者 `~`(大小写敏感) 指定。为了找到与给定请求匹配的 `location` ，`nginx` 首先检查使用前缀字符串定义的 `location`，其中有最长匹配前缀的将被使用，然后按照他们在配置文件中出现的顺序检查正则表达式，正则表达式的搜索在第一个匹配时终止，并使用相应的配置。如果未找到与正则表达式的匹配，则使用先前记住的前缀位置的配置。

`location` 块是可以嵌套的，但是除了下面提到的。

对于不区分大小写的操作系统（如`macOS`和`Cygwi`n），与前缀字符串匹配会忽略大小写（`0.7.7`）。

正则表达式可以包含捕获组，用于后续的其他指令。

如果最长匹配前缀位置具有“^〜”修饰符，则不检查正则表达式。

此外，使用`=`修饰符可以定义`URI`和位置的精确匹配。如果找到完全匹配，则搜索终止。例如，如果频繁发生`/`请求，则定义`location = /`将加速这些请求的处理，因为搜索在第一次比较之后立即终止。这样的 `location` 显然不能包含嵌套 `location`。

我们来通过一个例子说明情况：

```
location = / {
    [ configuration A ]
}

location / {
    [ configuration B ]
}

location /documents/ {
    [ configuration C ]
}

location ^~ /images/ {
    [ configuration D ]
}

location ~* \.(gif|jpg|jpeg)$ {
    [ configuration E ]
}
```

`/` 请求将会匹配 `A`，`/index.html` 将会匹配 `B`，`/documents/document.html` 将会匹配 `C`，`/images/1.gif` 将会匹配 `D`，`/documents/1.jpg` 将会匹配 `E`。

`@` 用于定义一个命名 `location`，这样的 `location` 不用于常规请求处理，而是用于请求重定向。它们不能嵌套，也不能包含嵌套 `location`。

匹配顺序是：先精确匹配，然后前缀匹配取最长匹配，然后是正则表达式；但是如果前缀匹配到 `^~` 则不会进行正则表达式匹配，如果匹配到的最长前缀前面没有 `^~` 则会继续按声明顺序进行正则表达式匹配，取匹配到的第一个正则表达式，否则匹配前缀匹配。

#### 路由重写

`NGINX` 通过 [`ngx_http_rewrite_module`](http://nginx.org/en/docs/http/ngx_http_rewrite_module.html#internals) 模块支持`URL`重写，支持 if 条件判断，但不支持 else。

`NGINX rewrite` 指令执行顺序：

1. 执行 `server` 快的 `rewrite` 指令；
2. 执行 `location` 匹配；
3. 执行选定的 `location` 中的 `rewrite` 指令；

如果其中某一步 `URI` 被重写，则重新执行循环 `1-3`，直到找到真实存在的文件，如果循环超过`10`次，则返回 `500` 错误。


##### `break` 指令

`break` 的作用域为 `server, location, if`，用于停止当前虚拟主机的后续 `rewrite` 指令集：

```conf
if ($slow) {
    limit_rate 10k;
    break;
}
```

##### `if` 指令

语法：`if(condition) {...}`
默认值：无
作用域：`server, location`

对给定的条件 `condition` 进行判断。如果为真，大括号内的 `rewrite` 指令将被执行。`if`条件( `condition` )可以是如下任何内容：

*  一个变量名；`false`如果这个变量是空字符串或者以`0`开始的字符串；
* 使用`= ,!= `比较的一个变量和字符串
* 是用`~， ~*`与正则表达式匹配的变量，如果这个正则表达式中包含}，;则整个表达式需要用" 或' 包围
* 使用`-f ，!-f` 检查一个文件是否存在
* 使用`-d, !-d` 检查一个目录是否存在
* 使用`-e ，!-e` 检查一个文件、目录、符号链接是否存在
* 使用`-x ， !-x` 检查一个文件是否可执行

```conf
 if ($http_user_agent ~ MSIE) {
     rewrite ^(.*)$ /msie/$1 break;
 }

 if ($http_cookie ~* "id=([^;]+)(?:;|$)") {
     set $id $1;
 }

 if ($request_method = POST) {
     return 405;
 }

 if ($slow) {
     limit_rate 10k;
 }

 if ($invalid_referer) {
     return 403;
 }
```

##### `return` 指令

语法：`return code [text];`
     `return code URL;`
     `return URL;`

默认值：无
作用域：`server`，`location`，`if`

停止处理并返回指定状态码(code)给客户端。非标准状态码 `444` 表示关闭连接且不给客户端发响应头。

从0.8.42版本起，return 支持响应URL重定向(对于301，302，303，307），或者文本响应。对于文本或者URL重定向可以包含变量。作为特殊情况，可以将重定向 URL 指定为此服务器的本地URI，在这种情况下，根据请求方案（`$scheme`）以及 [server_name_in_redirect](http://nginx.org/en/docs/http/ngx_http_core_module.html#server_name_in_redirect) 和 [port_in_redirect](http://nginx.org/en/docs/http/ngx_http_core_module.html#port_in_redirect) 指令形成完整重定向URL。


##### `rewrite` 指令

语法：`	rewrite regex replacement [flag];`
作用域：`server, location, if`

如果指定的正则表达式匹配请求的`URL`，`URL` 将被改变为 `replacement` 中声明的字符串。`rewrite` 按照他们在配置文件出现的顺序执行，并且可以使用 `[flag]` 终止进一步处理。如果 `replacement` 是以 `http://`, `https://`, 或者 `$scheme` 开始，将不再继续处理，这个重定向将返回给客户端。

`flag` 参数可以是下列值之一：

`last`     : 停止处理后续 rewrite 指令集，然后对当前重写的新URI在 rewrite 指令集上重新查找；
`break`    : 停止处理后续rewrite指令集，并不在重新查找，但是当前 `location` 内剩余非 `rewrite` 语句和 `location` 外的的非 `rewrite` 语句可以执行；
`redirect` : 如果 `replacement` 不是以 `http://` 或 `https://` 开始，返回`302`临时重定向；
`permanent`: 返回 `301` 永久重定向。

例子：

```conf
server {
     ...
     rewrite ^(/download/.*)/media/(.*)..*$ $1/mp3/$2.mp3 last;
     rewrite ^(/download/.*)/audio/(.*)..*$ $1/mp3/$2.ra last;
     return 403;
     ...
}
```

如果这些 `rewrite` 放到 `/download/ location`，如下所示, 那么应使用 `break` 而不是 `last`, 使用 `last` 将循环`10`次匹配，然后返回 500错误:

```conf
 location /download/ {
     rewrite ^(/download/.*)/media/(.*)..*$ $1/mp3/$2.mp3 break;
     rewrite ^(/download/.*)/audio/(.*)..*$ $1/mp3/$2.ra break;
     return 403;
 }
```

对于重写后的`URL`（`replacement`）包含原请求的请求参数，原URL的?后的内容。如果不想带原请求的参数 ，可以在`replacement`后加一个问号。如下，我们加了一个自定义的参数`user=$1`,然后在结尾处放了一个问号?,把原请的参数去掉。

```conf
rewrite ^/users/(.*)$ /show?user=$1? last;
```

##### `rewrite_log` 指令

语法：`rewrite_log on | off;`
作用域：`http, server, location, if`

开启或关闭以 `notice` 级别打印 `rewrite` 处理日志到 `error_log` 文件。例子：

```conf
rewrite_log on;
error_log logs/xxx.error.log notice;
```

##### `set` 指令

语法：`set $variable value;`
作用域：`server, location, if`

定义一个变量并赋值，值可以是文本，变量或者文本变量混合体。

##### `uninitialized_variable_warn` 指令

语法：`uninitialized_variable_warn on | off;`
作用域：`http, server, location, if`

控制是否输出为初始化的变量到日志。


### 参考阅读
1. [nginx 平滑升级](http://www.nginx.cn/nginxchscommandline)
2. [nginx rewrite指令](http://www.nginx.cn/216.html)
3. [ngx_http_rewrite_module 官方模块](http://nginx.org/en/docs/htt
