---
title: Nginx
date: 2018-11-07 23:01:34
categories:
  - 工具
tags:
  - Nginx
---

{% asset_img cover.png cover %}

<!-- more -->

### 环境准备

我准备使用 `docker` 准备我的学习环境，以供我试验测试，也不怕玩坏，更不用去倒腾虚拟机，麻烦。

1. 我们先拉取`centos`的最新镜像：`docker image pull centos`
2. 创建一个数据卷用于存放容器中产生的文件：`docker volume create centos`
3. 启动我们的容器：`docker run -d -it -v centos:/workdir --name centos  centos /bin/bash`
4. 进入我们的容器：`docker exec -it centos /bin/bash`


### Nginx 的主要应用场景

1. 静态资源服务，即通过本地文件系统提供服务；
2. 反向代理服务，提供缓存，负载均衡功能；
3. API服务，通过Openresty直接访问数据库；

![scene](scene.png)

### Nginx 的组成部分

1. Nginx 二进制可执行文件；
2. Nginx.conf Nginx 配置文件，控制Nginx的行文；
3. access.log 访问日志，记录一条 http 请求信息；
4. error.log 错误日志；

### 热部署

为了便于演示，我们在编译Nginx的时候添加[echo-nginx-module](https://github.com/openresty/echo-nginx-module)模块，记录一次编译（我所有的操作都是在目录 `/workdir`下）：

1. 源代码下载页面：[http://nginx.org/en/download.html](http://nginx.org/en/download.html)，我们先下载 1.14.1 版本，然后升级到 1.15.6 最新版；

2. 下载源代码并且解压，`wget http://nginx.org/download/nginx-1.14.1.tar.gz`，然后 `tar -xzvf nginx-1.14.1.tar.gz`

3. 下载 [nginx-echo-module](https://github.com/openresty/echo-nginx-module)，`wget https://github.com/openresty/echo-nginx-module/archive/master.zip -O nginx-echo-module.zip`，并且解压：`unzip nginx-echo-module.zip`

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

12. 使用新版的Nginx二进制文件替换掉当前正在使用中的：`cp -f  nginx-1.15.6/objs/nginx ./nginx/sbin/nginx`

13. 发送信号至正在运行的Nginx，告诉它我们要进行热部署，升级Nginx，`kill -USR2 MasterPID`

    ![查看正在运行的nginx进程](pids.png)

    这个时候会使用新的二进制文件新起一个`master`进程，并且将新的请求转到新的`worker`进程中处理，旧的`master`和`worker`虽然仍然存活，但已经不再监听相应的端口并且接受请求了，这个时候我们在查看版本号，就是升级之后的版本了：

        [root@5b4bb2c41637 sbin]# curl http://localhost/version
        1.15.6

14. 关闭老的 `worker` 进程，发送信号给旧的 `MasterPID`，`kill -WINCH MasterPID`：

    ![close-worker](close-worker.png)

    可以看到老的worker进程已经关闭了，但是此时老的master进程依然存在，是因为如果升级有问题，我们还可回退。回滚的时候，向老的 master 进程发送 `HUP`信号，向新的 master 发送 `QUIT` 信号。

15. 如果正常升级之后，应该给老的 master 进程发送 `QUIT` 信号，使其优雅退出。

### nginx 命令行

1. `nginx -s quit` 优雅退出进程
2. `nginx -s stop` 立即退出进程

### nginx 常用配置学习

#### 配置静态资源访问服务器

```conf
server {
    listen 8081;
    location / {
        root /workdir/libc;
        index index.html index.htm;
    }
}
```

#### 记录 access 日志

使用 [ngx_http_log_module](http://nginx.org/en/docs/http/ngx_http_log_module.html) 模块我们来配置记录访问日志：


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

#### 开启 gzip 压缩

使用 [ngx_http_gzip_module](http://nginx.org/en/docs/http/ngx_http_gzip_module.html) 提供的功能，对静态文件进行压缩

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

使用 [ngx_http_referer_module](http://nginx.org/en/docs/http/ngx_http_referer_module.html) 提供的功能实现防盗链：

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

使用 [ngx_http_upstream_module](http://nginx.org/en/docs/http/ngx_http_upstream_module.html#upstream) 模块提供的 `upstream` 来配置上游服务器：

```
upstream local {
    server 127.0.0.1:8080
}
```

指定某些路径配置反向代理，使用[ngx_http_proxy_module](http://nginx.org/en/docs/http/ngx_http_proxy_module.html)提供的指令：

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

#### location

`location` 配置指令是由 [ngx_http_core_module](http://nginx.org/en/docs/http/ngx_http_core_module.html#location) 模块提供，它的配置是下面这个样组的：

```
语法:  location [ = | ~ | ~* | ^~ ] uri { ... }
       location @name { ... }
默认:   —
上下文: server, location
```

它主要是用于根据请求 URL 设置配置，在解码以 `％XX` 形式编码的文本，解析对相对路径组件 `.`和`..`的引用，并将两个或多个相邻斜杠`/`的可能[压缩](http://nginx.org/en/docs/http/ngx_http_core_module.html#merge_slashes)为单个斜杠之后，对规范化的URI执行匹配。

一个location 可以被一个前缀字符串定义或者一个正则表达式，正则表达式通过 `~*`(大小写不敏感) 或者 `~`(大小写敏感) 指定。为了找到与给定请求匹配的 location ，nginx 首先检查使用前缀字符串定义的 location，其中有最长匹配前缀的将被使用，然后按照他们在配置文件中出现的顺序检查正则表达式，正则表达式的搜索在第一个匹配时终止，并使用相应的配置。如果未找到与正则表达式的匹配，则使用先前记住的前缀位置的配置。

location 块是可以嵌套的，但是除了下面提到的。

对于不区分大小写的操作系统（如macOS和Cygwin），与前缀字符串匹配会忽略大小写（0.7.7）。

正则表达式可以包含捕获组，用于后续的其他指令。

如果最长匹配前缀位置具有“^〜”修饰符，则不检查正则表达式。

此外，使用“=”修饰符可以定义URI和位置的精确匹配。如果找到完全匹配，则搜索终止。例如，如果频繁发生`/`请求，则定义`location = /`将加速这些请求的处理，因为搜索在第一次比较之后立即终止。这样的 location 显然不能包含嵌套 location。

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

`@` 用于定义一个命名 location，这样的 location 不用于常规请求处理，而是用于请求重定向。它们不能嵌套，也不能包含嵌套 location。

匹配顺序是：先精确匹配，然后前缀匹配取最长匹配，然后是正则表达式；但是如果前缀匹配到 `^~` 则不会进行正则表达式匹配，如果匹配到的最长前缀前面没有 `^~` 则会继续按声明顺序进行正则表达式匹配，取匹配到的第一个正则表达式，否则匹配前缀匹配。
