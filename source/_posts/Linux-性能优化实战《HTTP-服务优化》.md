---
title: Linux 性能优化实战《HTTP 服务优化》
date: 2020-07-25 22:38:14
tags:
- Linux 性能优化
---

{% asset_img cover.jpg bg %}

<!--more-->

[案例篇：服务吞吐量下降很厉害，怎么分析？](https://time.geekbang.org/column/article/87342)

使用 `wrk` 测试服务吞吐量：

    # 默认测试时间为10s，请求超时2s
    $ wrk --latency -c 1000 http://192.168.0.30
    Running 10s test @ http://192.168.0.30
    2 threads and 1000 connections
    Thread Stats   Avg      Stdev     Max   +/- Stdev
        Latency    14.82ms   42.47ms 874.96ms   98.43%
        Req/Sec   550.55      1.36k    5.70k    93.10%
    Latency Distribution
        50%   11.03ms
        75%   15.90ms
        90%   23.65ms
        99%  215.03ms
    1910 requests in 10.10s, 573.56KB read
    Non-2xx or 3xx responses: 1910
    Requests/sec:    189.10
    Transfer/sec:     56.78KB

长时间观测：

    # 测试时间30分钟
    $ wrk --latency -c 1000 -d 1800 http://192.168.0.30

#### 连接数优化

连接数优化，可以使用 `ss -s` 命令查看当前的连接数：

    $ ss -s
    Total: 177 (kernel 1565)
    TCP:   1193 (estab 5, closed 1178, orphaned 0, synrecv 0, timewait 1178/0), ports 0

    Transport Total     IP        IPv6
    *    1565      -         -
    RAW    1         0         1
    UDP    2         2         0
    TCP    15        12        3
    INET    18        14        4
    FRAG    0         0         0

如果案例是基于 Docker 运行，而 Docker 使用的 iptables ，就会使用连接跟踪模块来管理 NAT，首先确认是不是连接跟踪导致的问题，可以通过查看系统日志确认：

    $ dmesg | tail
    [88356.354329] nf_conntrack: nf_conntrack: table full, dropping packet
    [88356.354374] nf_conntrack: nf_conntrack: table full, dropping packet

nf_conntrack: table full, dropping packet 的错误日志。这说明，正是连接跟踪导致的问题。我们应该想起前面学过的两个内核选项——连接跟踪数的最大限制 nf_conntrack_max ，以及当前的连接跟踪数 nf_conntrack_count。执行下面的命令，你就可以查询这两个选项：


    $ sysctl net.netfilter.nf_conntrack_max
    net.netfilter.nf_conntrack_max = 200
    $ sysctl net.netfilter.nf_conntrack_count
    net.netfilter.nf_conntrack_count = 200

执行下面的命令，将 nf_conntrack_max 增大：

    # 将连接跟踪限制增大到1048576
    $ sysctl -w net.netfilter.nf_conntrack_max=1048576

#### 工作进程优化

如果是 php 项目，php-fpm 会采用工作进程处理来自用户的请求，一般来说，每个 php-fpm 子进程可能会占用 20 MB 左右的内存。所以，需要根据内存和 CPU 个数，估算一个合理的值。如果查看 php-fpm 日志得到下面的信息，就应该重新设置：

    $ docker logs phpfpm --tail 5
    [15-Mar-2019 22:28:56] WARNING: [pool www] server reached max_children setting (5), consider raising it
    [15-Mar-2019 22:43:17] WARNING: [pool www] server reached max_children setting (5), consider raising it


#### 套接字优化

可以使用 netstat 命令来观测有没有套接字丢包现象：

    # 只关注套接字统计
    $ netstat -s | grep socket
        73 resets received for embryonic SYN_RECV sockets
        308582 TCP sockets finished time wait in fast timer
        8 delayed acks further delayed because of locked socket
        290566 times the listen queue of a socket overflowed
        290566 SYNs to LISTEN sockets dropped

    # 稍等一会，再次运行
    $ netstat -s | grep socket
        73 resets received for embryonic SYN_RECV sockets
        314722 TCP sockets finished time wait in fast timer
        8 delayed acks further delayed because of locked socket
        344440 times the listen queue of a socket overflowed
        344440 SYNs to LISTEN sockets dropped

可以看到，有大量的套接字丢包，并且丢包都是套接字队列溢出导致的。所以，接下来，我们应该分析连接队列的大小是不是有异常。可以执行下面的命令，查看套接字的队列大小：

    $ ss -ltnp
    State     Recv-Q     Send-Q            Local Address:Port            Peer Address:Port
    LISTEN    10         10                      0.0.0.0:80                   0.0.0.0:*         users:(("nginx",pid=10491,fd=6),("nginx",pid=10490,fd=6),("nginx",pid=10487,fd=6))
    LISTEN    7          10                            *:9000                       *:*         users:(("php-fpm",pid=11084,fd=9),...,("php-fpm",pid=10529,fd=7))

可以看到，Nginx 和 php-fpm 的监听队列 （Send-Q）只有 10，而 nginx 的当前监听队列长度 （Recv-Q）已经达到了最大值，php-fpm 也已经接近了最大值。很明显，套接字监听队列的长度太小了，需要增大。

关于套接字监听队列长度的设置，既可以在应用程序中，通过套接字接口调整，也支持通过内核选项来配置。我们继续在终端一中，执行下面的命令，分别查询 Nginx 和内核选项对监听队列长度的配置：

    # 查询nginx监听队列长度配置
    $ docker exec nginx cat /etc/nginx/nginx.conf | grep backlog
            listen       80  backlog=10;

    # 查询php-fpm监听队列长度
    $ docker exec phpfpm cat /opt/bitnami/php/etc/php-fpm.d/www.conf | grep backlog
    ; Set listen(2) backlog.
    ;listen.backlog = 511

    # somaxconn是系统级套接字监听队列上限
    $ sysctl net.core.somaxconn
    net.core.somaxconn = 10

优化方法就是增大这三个配置，比如，可以把 Nginx 和 php-fpm 的队列长度增大到 8192，而把 somaxconn 增大到 65536。

#### 端口号优化

根据网络套接字的原理，当客户端连接服务器端时，需要分配一个临时端口号，而  Nginx 正是 PHP-FPM 的客户端。端口号的范围并不是无限的，最多也只有 6 万多。

    $ sysctl net.ipv4.ip_local_port_range
    net.ipv4.ip_local_port_range=20000 20050

你可以看到，临时端口的范围只有 50 个，显然太小了 。优化方法很容易想到，增大这个范围就可以了。

    $ sysctl -w net.ipv4.ip_local_port_range="10000 65535"
    net.ipv4.ip_local_port_range = 10000 65535

#### 端口重用

执行 top ，观察服务器 CPU 和内存的使用：

    $ top
    ...
    %Cpu0  : 30.7 us, 48.7 sy,  0.0 ni,  2.3 id,  0.0 wa,  0.0 hi, 18.3 si,  0.0 st
    %Cpu1  : 28.2 us, 46.5 sy,  0.0 ni,  2.0 id,  0.0 wa,  0.0 hi, 23.3 si,  0.0 st
    KiB Mem :  8167020 total,  5867788 free,   490400 used,  1808832 buff/cache
    KiB Swap:        0 total,        0 free,        0 used.  7361172 avail Mem

    PID USER      PR  NI    VIRT    RES    SHR S  %CPU %MEM     TIME+ COMMAND
    20379 systemd+  20   0   38068   8692   2392 R  36.1  0.1   0:28.86 nginx
    20381 systemd+  20   0   38024   8700   2392 S  33.8  0.1   0:29.29 nginx
    1558 root      20   0 1118172  85868  39044 S  32.8  1.1  22:55.79 dockerd
    20313 root      20   0   11024   5968   3956 S  27.2  0.1   0:22.78 docker-containe
    13730 root      20   0       0      0      0 I   4.0  0.0   0:10.07 kworker/u4:0-ev

从 top 的结果中可以看到，可用内存还是很充足的，但系统 CPU 使用率（sy）比较高，两个 CPU 的系统 CPU 使用率都接近 50%，且空闲 CPU 使用率只有 2%。再看进程部分，CPU 主要被两个 Nginx 进程和两个 docker 相关的进程占用，使用率都是 30% 左右。

执行 perf 和 flamegraph 脚本，生成火焰图：

    # 执行perf记录事件
    $ perf record -g

    # 切换到FlameGraph安装路径执行下面的命令生成火焰图
    $ perf script -i ~/perf.data | ./stackcollapse-perf.pl --all | ./flamegraph.pl > nginx.svg

然后，使用浏览器打开生成的 nginx.svg ，你就可以看到下面的火焰图：

![HTTP 服务性能优化](http-service-pef-optimize.png) 

火焰图原理，这个图应该从下往上、沿着调用栈中最宽的函数，来分析执行次数最多的函数。

这儿中间的 do_syscall_64、tcp_v4_connect、inet_hash_connect 这个堆栈，很明显就是最需要关注的地方。inet_hash_connect() 是 Linux 内核中负责分配临时端口号的函数。所以，这个瓶颈应该还在临时端口的分配上。

顺着 inet_hash_connect 往堆栈上面查看，下一个热点是 __init_check_established 函数。而这个函数的目的，是检查端口号是否可用。如果有大量连接占用着端口，那么检查端口号可用的函数，就会消耗更多的 CPU，可以通过  `ss -s` 查看连接状态统计：

    $ ss -s
    TCP:   32775 (estab 1, closed 32768, orphaned 0, synrecv 0, timewait 32768/0), ports 0
    ...

有大量连接（这儿是 32768）处于 timewait 状态，而 timewait 状态的连接，本身会继续占用端口号。如果这些端口号可以重用，那么自然就可以缩短 __init_check_established 的过程。而 Linux 内核中，恰好有一个 tcp_tw_reuse 选项，用来控制端口号的重用。

运行下面的命令，查询它的配置：

    $ sysctl net.ipv4.tcp_tw_reuse
    net.ipv4.tcp_tw_reuse = 0   

0 表示禁止，改成1开启。