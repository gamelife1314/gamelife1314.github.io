---
title: Nginx：rewrite 模块
date: 2018-11-27 23:11:31
categories:
- 工具
tags:
- rewrite
---

NGINX 通过 [ngx_http_rewrite_module](http://nginx.org/en/docs/http/ngx_http_rewrite_module.html#internals) 模块支持URL重写，支持 if 条件判断，但不支持 else。

NGINX rewrite 指令执行顺序：

1. 执行 server 快的 rewrite 指令；
2. 执行 location 匹配；
3. 执行选定的 location 中的 rewrite 指令；

如果其中某一步 URI 被重写，则重新执行循环 1-3，直到找到真实存在的文件，如果循环超过10次，则返回 500 错误。

<!-- more -->

### `break` 指令

`break` 的作用域为 `server, location, if`，用于停止当前虚拟主机的后续 `rewrite` 指令集：

```conf
if ($slow) {
    limit_rate 10k;
    break;
}
```

### `if` 指令

语法：`if(condition) {...}`
默认值：无
作用域：`server, location`

对给定的条件 condition 进行判断。如果为真，大括号内的 rewrite 指令将被执行。if条件( condition )可以是如下任何内容：

*  一个变量名；false如果这个变量是空字符串或者以0开始的字符串；
* 使用= ,!= 比较的一个变量和字符串
* 是用~， ~*与正则表达式匹配的变量，如果这个正则表达式中包含}，;则整个表达式需要用" 或' 包围
* 使用-f ，!-f 检查一个文件是否存在
* 使用-d, !-d 检查一个目录是否存在
* 使用-e ，!-e 检查一个文件、目录、符号链接是否存在
* 使用-x ， !-x 检查一个文件是否可执行

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

### `return` 指令

语法：`return code [text];`
     `return code URL;`
     `return URL;`

默认值：无
作用域：`server`，`location`，`if`

停止处理并返回指定状态码(code)给客户端。非标准状态码 `444` 表示关闭连接且不给客户端发响应头。

从0.8.42版本起，return 支持响应URL重定向(对于301，302，303，307），或者文本响应。对于文本或者URL重定向可以包含变量。作为特殊情况，可以将重定向 URL 指定为此服务器的本地URI，在这种情况下，根据请求方案（`$scheme`）以及 [server_name_in_redirect](http://nginx.org/en/docs/http/ngx_http_core_module.html#server_name_in_redirect) 和 [port_in_redirect](http://nginx.org/en/docs/http/ngx_http_core_module.html#port_in_redirect) 指令形成完整重定向URL。


### `rewrite` 指令

语法：`	rewrite regex replacement [flag];`
作用域：`server, location, if`

如果指定的正则表达式匹配请求的URL，URL 将被改变为 `replacement` 中声明的字符串。`rewrite` 按照他们在配置文件出现的顺序执行，并且可以使用 `[flag]` 终止进一步处理。如果 `replacement` 是以 `http://`, `https://`, 或者 `$scheme` 开始，将不再继续处理，这个重定向将返回给客户端。

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

如果这些 `rewrite` 放到 “/download/” location，如下所示, 那么应使用 `break` 而不是 `last`, 使用 `last` 将循环10次匹配，然后返回 500错误:

```conf
 location /download/ {
     rewrite ^(/download/.*)/media/(.*)..*$ $1/mp3/$2.mp3 break;
     rewrite ^(/download/.*)/audio/(.*)..*$ $1/mp3/$2.ra break;
     return 403;
 }
```

对于重写后的URL（replacement）包含原请求的请求参数，原URL的?后的内容。如果不想带原请求的参数 ，可以在replacement后加一个问号。如下，我们加了一个自定义的参数user=$1,然后在结尾处放了一个问号?,把原请的参数去掉。

```conf
rewrite ^/users/(.*)$ /show?user=$1? last;
```

### `rewrite_log` 指令

语法：`rewrite_log on | off;`
作用域：`http, server, location, if`

开启或关闭以 notice 级别打印 rewrite 处理日志到 error_log文件。例子：

```conf
rewrite_log on;
error_log logs/xxx.error.log notice;
```

### `set` 指令

语法：`set $variable value;`
作用域：`server, location, if`

定义一个变量并赋值，值可以是文本，变量或者文本变量混合体。

### `uninitialized_variable_warn` 指令

语法：`uninitialized_variable_warn on | off;`
作用域：`http, server, location, if`

控制是否输出为初始化的变量到日志。


### 参考阅读
1. [nginx 平滑升级](http://www.nginx.cn/nginxchscommandline)
2. [nginx rewrite指令](http://www.nginx.cn/216.html)
3. [ngx_http_rewrite_module 官方模块](http://nginx.org/en/docs/http/ngx_http_rewrite_module.html#internals)