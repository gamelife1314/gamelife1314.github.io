---
title: Linux tun 设备介绍
date: 2024-02-04 14:59:33
tags:
  - tun
categories:
    - Linux
    - Network
---

`tun` 是一种虚拟的3层虚拟网络设备，同时它也是一个字符设备，字符设备意味着可以把它当做一个文件，可以使用文件`API`操作这个设备，例如 `open/read/write`，由于它同时也是一个网络设备，所以它也可以像一个网卡一样，从内核网络协议栈中收发报文。所以从它架构上来看，`tun` 设备的一端连接着应用程序，一端连接着网络协议栈，如下图所示：

{% asset_img linux-tun-device.png %}

从在系统中的表象来看，字符设备的文件类型是`c`，没有大小，但是有主次版本号：

```sh
$ ls -alh /dev/net/tun
crw-rw-rw- 1 root root 10, 200 Jan 30 17:00 /dev/net/tun
```

`tun` 设备的创建是通过打开`/dev/net/tun`这个文件，然后使用`ioctl`系统调用对其进行`clone`。也可以使用 `ip` 命令来实现`tun`设备的创建：

> `ip tuntap add dev tun1 mod tun`

新创建的 `tun1` 设备位于 `/sys/class/net/` 目录中：

```
$ ll /sys/class/net/tun1
lrwxrwxrwx 1 root root 0 Feb  4 15:44 /sys/class/net/tun1 -> ../../devices/virtual/net/tun1/
```

删除使用如下命令：

> `ip tuntap del dev tun1 mod tun`

<!-- more -->

### `ICMP` 示例

如前文所述，`tun`设备的使用需要打开`/dev/net/tun`并对其`clone`之后才能进行使用，所以通用的创建`tun`设备有如下的步骤：

```c
int tun_alloc(char *dev, int flags)
{
    assert(dev != NULL);

    struct ifreq ifr;
    int fd, err;

    char *clonedev = "/dev/net/tun";

    if ((fd = open(clonedev, O_RDWR)) < 0) {
        return fd;
    }

    memset(&ifr, 0, sizeof(ifr));
    ifr.ifr_flags = flags;
    
    if (*dev != '\0') {
        strncpy(ifr.ifr_name, dev, IFNAMSIZ);
    }
    if ((err = ioctl(fd, TUNSETIFF, (void *) &ifr)) < 0) {
        close(fd);
        return err;
    }

    strcpy(dev, ifr.ifr_name);

    return fd;
}
```

创建`tun`设备需要是`root`的用户，或者该应用程序需要具有`CAP_NET_ADMIN`权限，`/dev/net/tun`必须以读写方式打开，它是创建任何`tun/tap`虚拟接口的起点，因此也被称为克隆设备(`clone device`)。操作(`open()`)后会返回一个文件描述符，但此时还无法与接口通信。下一步会使用一个特殊的`ioctl()`系统调用，该函数的入参为上一步得到的文件描述符，以及一个`TUNSETIFF`常数和一个指向描述虚拟接口的结构体指针。

`tun_alloc` 函数的两个参数中：

- `dev`：指的是创建的`tun`设备的名称，如果`*dev`为`'\0'`，则内核会尝试使用第一个对应类型的可用的接口，例如从`tun0`开始，如果`tun0`存在就为`tun1`；
- `flags`：用于指定虚拟设备的类型，通常为`IFF_TUN`或者`IFF_TAP`，分别代表`tun`或者`tap`设备。除此之外，还有一个`IFF_NO_PI`标志，可以与`IFF_TUN`或`IFF_TAP`配合使用。`IFF_NO_PI` 会告诉内核不需要提供报文信息，即告诉内核仅需要提供"纯"`IP`报文，不需要其他字节。否则(不设置`IFF_NO_PI`)，会在报文开始处添加`4`个额外的字节(`2`字节的标识和`2`字节的协议)；

如果要完整的处理到达`tun`设备的`ICMP`请求，需要手动回响应：

```c
int main()
{
    int tun_fd, nread;
    char buffer[4096];
    char tun_name[IFNAMSIZ];

    tun_name[0] = '\0';

    tun_fd = tun_alloc(tun_name, IFF_TUN | IFF_NO_PI);

    if (tun_fd < 0) {
        perror("Allocating interface");
        exit(1);
    }

    printf("Open tun/tap device: %s for reading...\n", tun_name);

    while (1) {
        unsigned char ip[4];
        // 收包
        nread = read(tun_fd, buffer, sizeof(buffer));
        if (nread < 0) {
            perror("Reading from interface");
            close(tun_fd);
            exit(1);
        }

        // IP 报文第9个字节表示协议类型，其中：
        // 1:  ICMP
        // 6:  TCP
        // 17: UDP
        if (buffer[9] != 1) {
            continue;
        }

        printf("Read %d bytes from tun/tap device, icmp type: %d\n", nread, buffer[20]);

        // IP报文中，从12个字节开始的连续4个字节保存源IP地址，第16个字节开始的连续4字节保存目的IP
        // 这里调换 ICMP 请求中的源IP和目的IP。用于响应
        // 更多关于IP报文格式的请看：https://www.tutorialspoint.com/ipv4/ipv4_packet_structure.htm
        memcpy(ip, &buffer[12], 4);
        memcpy(&buffer[12], &buffer[16], 4);
        memcpy(&buffer[16], ip, 4);

        // IP 头的长度是20个字节，对于ICMP报文，第20个字节表示TCMP报文类型：
        //    0: 表示 Echo Reply
        //    8: 表示 Echo Request
        buffer[20] = 0;
        *((unsigned short *)&buffer[22]) += 8;

        printf("source ip addr: %d %d %d %d \n", ip[0], ip[1], ip[2], ip[3]);

        // 发包
        nread = write(tun_fd, buffer, nread);
        printf("Write %d bytes to tun device\n", nread);
    }
    return 0;
}
```

完整的示例程序如下所示：

{% note success 点击展开 %}
```c
#include <stdio.h>
#include <stdlib.h>
#include <assert.h>
#include <net/if.h>
#include <sys/ioctl.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <string.h>
#include <sys/types.h>
#include <linux/if_tun.h>
#include <unistd.h>

int tun_alloc(char *dev, int flags)
{
    assert(dev != NULL);

    struct ifreq ifr;
    int fd, err;

    char *clonedev = "/dev/net/tun";

    if ((fd = open(clonedev, O_RDWR)) < 0) {
        return fd;
    }

    memset(&ifr, 0, sizeof(ifr));
    ifr.ifr_flags = flags;
    
    if (*dev != '\0') {
        strncpy(ifr.ifr_name, dev, IFNAMSIZ);
    }
    if ((err = ioctl(fd, TUNSETIFF, (void *) &ifr)) < 0) {
        close(fd);
        return err;
    }

    strcpy(dev, ifr.ifr_name);

    return fd;
}

int main()
{
    int tun_fd, nread;
    char buffer[4096];
    char tun_name[IFNAMSIZ];

    tun_name[0] = '\0';

    tun_fd = tun_alloc(tun_name, IFF_TUN | IFF_NO_PI);

    if (tun_fd < 0) {
        perror("Allocating interface");
        exit(1);
    }

    printf("Open tun/tap device: %s for reading...\n", tun_name);

    while (1) {
        unsigned char ip[4];
        // 收包
        nread = read(tun_fd, buffer, sizeof(buffer));
        if (nread < 0) {
            perror("Reading from interface");
            close(tun_fd);
            exit(1);
        }

        // IP 报文第9个字节表示协议类型，其中：
        // 1:  ICMP
        // 6:  TCP
        // 17: UDP
        if (buffer[9] != 1) {
            continue;
        }

        printf("Read %d bytes from tun/tap device, icmp type: %d\n", nread, buffer[20]);
        printf("source ip addr: %d %d %d %d \n", buffer[12], buffer[13], buffer[14], buffer[15]);
        printf("destination ip addr: %d %d %d %d \n", buffer[16], buffer[17], buffer[18], buffer[19]);

        // IP报文中，从12个字节开始的连续4个字节保存源IP地址，第16个字节开始的连续4字节保存目的IP
        // 这里调换 ICMP 请求中的源IP和目的IP。用于响应
        // 更多关于IP报文格式的请看：https://www.tutorialspoint.com/ipv4/ipv4_packet_structure.htm
        memcpy(ip, &buffer[12], 4);
        memcpy(&buffer[12], &buffer[16], 4);
        memcpy(&buffer[16], ip, 4);

        // IP 头的长度是20个字节，对于ICMP报文，第20个字节表示TCMP报文类型：
        //    0: 表示 Echo Reply
        //    8: 表示 Echo Request
        buffer[20] = 0;
        *((unsigned short *)&buffer[22]) += 8;

        // 发包
        nread = write(tun_fd, buffer, nread);
        printf("Write %d bytes to tun device\n", nread);
    }
    return 0;
}
```
{% endnote %}

将完整的源代码保存成文件`tun.c`，使用如下的命令进行编译：

> `gcc -o taptun tun.c`

打开终端运行编译生成的可执行程序`taptun`可执行程序。然后打开另外一个终端，查询创建的`tun0`设备：

```
$ ifconfig tun0
tun0: flags=4240<POINTOPOINT,NOARP,MULTICAST>  mtu 1500
        unspec 00-00-00-00-00-00-00-00-00-00-00-00-00-00-00-00  txqueuelen 500  (UNSPEC)
        RX packets 0  bytes 0 (0.0 B)
        RX errors 0  dropped 0  overruns 0  frame 0
        TX packets 0  bytes 0 (0.0 B)
        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0
```

这个时候的`tun0`还未设置`IP`地址，可以使用如下的命令进行设置并启用：

> `ip a a 10.1.1.2/24 dev tun0`
> `ip l s tun0 up`

再次查看该设备，可以看到`IP`地址已经设置，并且处于启用状态：

```
$ ifconfig tun0
tun0: flags=4305<UP,POINTOPOINT,RUNNING,NOARP,MULTICAST>  mtu 1500
        inet 10.1.1.2  netmask 255.255.255.0  destination 10.1.1.2
        inet6 fe80::2ee1:4ade:16e4:8355  prefixlen 64  scopeid 0x20<link>
        unspec 00-00-00-00-00-00-00-00-00-00-00-00-00-00-00-00  txqueuelen 500  (UNSPEC)
        RX packets 1  bytes 48 (48.0 B)
        RX errors 0  dropped 0  overruns 0  frame 0
        TX packets 1  bytes 48 (48.0 B)
        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0
```

创建设置并且设置`IP`以后，可以看到操作系统会自动添加一条路由，表示发往 `10.1.1.0/24` 这个网段的所有报文都会经 `tun0` 设备发出：

```
$ route -n
Kernel IP routing table
Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
10.1.1.0        0.0.0.0         255.255.255.0   U     0      0        0 tun0
```

所以只要`ping`这个网段内的任一`IP`都会到达`tun0`设备，并且被我们的`taptun`应用程序收到并处理，例如：

```
$ ping -c 1 10.1.1.10
PING 10.1.1.10 (10.1.1.10) 56(84) bytes of data.
64 bytes from 10.1.1.10: icmp_seq=1 ttl=64 time=0.080 ms

--- 10.1.1.10 ping statistics ---
1 packets transmitted, 1 received, 0% packet loss, time 0ms
rtt min/avg/max/mdev = 0.080/0.080/0.080/0.000 ms
$ ping -c 1 10.1.1.111
PING 10.1.1.111 (10.1.1.111) 56(84) bytes of data.
64 bytes from 10.1.1.111: icmp_seq=1 ttl=64 time=0.189 ms

--- 10.1.1.111 ping statistics ---
1 packets transmitted, 1 received, 0% packet loss, time 0ms
rtt min/avg/max/mdev = 0.189/0.189/0.189/0.000 ms
```

应用程序将会有如下的输出：

```
$ ./taptun
Open tun/tap device: tun0 for reading...
Read 84 bytes from tun/tap device, icmp type: 8
source ip addr: 10 1 1 2
destination ip addr: 10 1 1 10
Write 84 bytes to tun device
Read 84 bytes from tun/tap device, icmp type: 8
source ip addr: 10 1 1 2
destination ip addr: 10 1 1 111
Write 84 bytes to tun device
```

### 参考链接

1. [IP packets](https://www.khanacademy.org/computing/computers-and-internet/xcae6f4a7ff015e7d:the-internet/xcae6f4a7ff015e7d:routing-with-redundancy/a/ip-packets)
2. [IPv4 - Packet Structure](https://www.tutorialspoint.com/ipv4/ipv4_packet_structure.htm)
3. [ICMP Explained and Packet Format](https://learnduty.com/articles/icmp-explained-and-packet-format/)
4. https://juejin.cn/post/7057833934947614750
5. https://blog.51cto.com/u_11299290/5107265
6. https://ctimbai.github.io/2019/03/01/tech/net/vnet/%E5%9F%BA%E4%BA%8Etaptun%E5%86%99%E4%B8%80%E4%B8%AAICMP%E7%A8%8B%E5%BA%8F/
7. https://www.zhengwenfeng.com/pages/143447/#%E5%BA%94%E7%94%A8%E7%A8%8B%E5%BA%8F%E9%80%9A%E8%BF%87tun%E8%AE%BE%E5%A4%87%E8%8E%B7%E5%8F%96ping%E6%95%B0%E6%8D%AE%E5%8C%85
8. https://lxd.me/a-simple-vpn-tunnel-with-tun-device-demo-and-some-basic-concepts
9. https://www.rectcircle.cn/posts/linux-net-virual-05-tunnel/#tun-tap-%e8%99%9a%e6%8b%9f%e8%ae%be%e5%a4%87
10. https://www.zhaohuabing.com/post/2020-02-24-linux-taptun/
11. https://www.luozhiyun.com/archives/684
12. https://blog.avdancedu.com/52f625ca/
13. https://www.xzcoder.com/posts/network/05-simple-vpn.html#%E7%A8%8B%E5%BA%8F%E6%B5%8B%E8%AF%95