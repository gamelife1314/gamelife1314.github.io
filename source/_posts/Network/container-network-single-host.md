---
title: 容器网络-单机容器通信
date: 2023-12-09 15:54:11
tags:
    - 容器网络
categories:
    - Linux
---

Docker 容器通过 Linux 提供的各种 `namespace` 技术，将运行中的容器封闭在一个沙箱中，看起来很像一个虚拟机，都拥有独立的网络栈，有独立的 `IP` 地址，但是这些同主机上的独立容器貌似天生互通，能通过各自的 `IP` 相互访问，这是如何做到的的？

如果我们想要实现两台独立主机之间互通，最简单的办法就是拿一根网线把它们连在一起；想要实现多台主机互通，这个时候就需要一台交换机了。

现在在不同的容器之间，想要实现互通，我们也可以借鉴交换机这种技术，毕竟容器看起来很像独立的主机。在 Linux 中，可以通过网桥（Bridge）模拟交换机，网桥工作是一个二层网络设备，工作在数据链路层，**主要功能是能够根据MAC地址将数据包发送到网桥的不同端口上**。

二层网络和三层网络的主要区别是，二层网络中可以仅靠MAC地址就实现互通，但是三层网络需要通过IP路由实现跨网络互通，这也能看出，二层网络的组网能力非常有限，一般只是小局域网，三层网络可以组建大型网络。

Docker 项目为了实现这种在相同主机上创建容器之间互通的目的，在主机上会创建一个名叫 `docker0` 的网桥，凡是连接在 `docker0` 上的容器，就可以通过它进行通信。要把一个容器插在网桥上，需要依赖 `Veth Pair` 这个虚拟设备了，它的特点是，它被创建出来之后，总是以两张虚拟网卡成对出现，并且从一张网卡发出的数据包，可以直接出现在与它对应的另一张网卡上，即使两张网卡在不同的 `namespace` 中。一旦一张虚拟网卡被插在了网桥设备上，它就会被降级成网桥的端口，丢失了处理数据包的能力，数据包会全部交由网桥进行处理。

如下是宿主机上 `docker0` 设备信息，`172.17.0.1/16` 是 Docker 默认的子网：

```
root@michael-host:/home/michael/linux# ifconfig docker0
docker0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet 172.17.0.1  netmask 255.255.0.0  broadcast 172.17.255.255
        inet6 fe80::42:adff:fec7:7598  prefixlen 64  scopeid 0x20<link>
        ether 02:42:ad:c7:75:98  txqueuelen 0  (Ethernet)
        RX packets 17901  bytes 944272 (944.2 KB)
        RX errors 0  dropped 0  overruns 0  frame 0
        TX packets 39165  bytes 63539349 (63.5 MB)
        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0
```

<!-- more -->

接下来我们创建两个容器，来验证这种通信的流程，整个通信流程如下图所示：

![单机容器通信](./single-host-contianer.png)


### 创建容器

这里以 `Ubuntu:22.04` 为例，创建两个名为 `ubuntu-1` 和 `ubuntu-2` 的容器，创建容器之后，可以执行下面的命令安装 `ifconfig`、`route` 以及 `ping` 这些必要的命令。

> apt install -y iproute2 net-tools iputils-ping

创建容器可以使用如下命令进行，`sleep 14400` 相当于启动后台程序，目的是为了容器不退出：

> docker run -d --name ubuntu-1 ubuntu:22.04 sleep 14400
> docker run -d --name ubuntu-2 ubuntu:22.04 sleep 14400

{% tabs 容器网络信息 %}

<!-- tab ubuntu-1 -->
```
root@8228a27f2052:/# ifconfig
eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet 172.17.0.3  netmask 255.255.0.0  broadcast 172.17.255.255
        ether 02:42:ac:11:00:03  txqueuelen 0  (Ethernet)
        RX packets 19925  bytes 31790965 (31.7 MB)
        RX errors 0  dropped 0  overruns 0  frame 0
        TX packets 9247  bytes 617413 (617.4 KB)
        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0

lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536
        inet 127.0.0.1  netmask 255.0.0.0
        loop  txqueuelen 1000  (Local Loopback)
        RX packets 0  bytes 0 (0.0 B)
        RX errors 0  dropped 0  overruns 0  frame 0
        TX packets 0  bytes 0 (0.0 B)
        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0

root@8228a27f2052:/# route
Kernel IP routing table
Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
default         172.17.0.1      0.0.0.0         UG    0      0        0 eth0
172.17.0.0      0.0.0.0         255.255.0.0     U     0      0        0 eth0

```
<!-- endtab -->

<!-- tab ubuntu-2 -->
```
root@679ef2c2dceb:/# ifconfig
eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet 172.17.0.2  netmask 255.255.0.0  broadcast 172.17.255.255
        ether 02:42:ac:11:00:02  txqueuelen 0  (Ethernet)
        RX packets 19227  bytes 31744801 (31.7 MB)
        RX errors 0  dropped 0  overruns 0  frame 0
        TX packets 8885  bytes 592586 (592.5 KB)
        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0

lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536
        inet 127.0.0.1  netmask 255.0.0.0
        loop  txqueuelen 1000  (Local Loopback)
        RX packets 0  bytes 0 (0.0 B)
        RX errors 0  dropped 0  overruns 0  frame 0
        TX packets 0  bytes 0 (0.0 B)
        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0

root@679ef2c2dceb:/#
root@679ef2c2dceb:/# route
Kernel IP routing table
Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
default         172.17.0.1      0.0.0.0         UG    0      0        0 eth0
172.17.0.0      0.0.0.0         255.255.0.0     U     0      0        0 eth0
root@679ef2c2dceb:/#
```
<!-- endtab -->

{% endtabs %}

上面的第二条路由信息表明这是一条直连规则，凡是发往 `172.17.0.0/16` 网络的数据包都经过 `eth0` 网卡发送，通过二层网络直达目的主机。这个 `eth0` 也正是 `Veth Pair` 设备的一端，它的另一端在主机上，怎么查找到这个另一端呢？`Veth Pair` 设备的两端 `iflink` 值是相同的的，根据这个执行下面的命令得到两个容器 `Veth Pair` 的另一端。

在 `ubuntu-1` 容器中：

> root@c41346a8eed5:/# cat /sys/class/net/eth0/iflink
> 5487

在主机上执行：

> grep -l 5220 /sys/class/net/veth*/ifindex
> /sys/class/net/veth6f3258e/ifindex

这得到了 `ubuntu-1` 容器在主机上 `Veth Pair` 端的设备号是 `veth6f3258e`，同样的方式获取到 `ubuntu-2` 在主机上对应的 `Veth Pair` 设备号是 `veth11089d0`。

```
root@michael-host:/home/michael/linux# ifconfig veth6f3258e
veth6f3258e: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet6 fe80::9c2d:b7ff:fe75:f5bf  prefixlen 64  scopeid 0x20<link>
        ether 9e:2d:b7:75:f5:bf  txqueuelen 0  (Ethernet)
        RX packets 9260  bytes 619353 (619.3 KB)
        RX errors 0  dropped 0  overruns 0  frame 0
        TX packets 19939  bytes 31792721 (31.7 MB)
        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0

root@michael-host:/home/michael/linux#
root@michael-host:/home/michael/linux# ifconfig veth11089d0
veth11089d0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet6 fe80::8d7:b9ff:fed8:3f38  prefixlen 64  scopeid 0x20<link>
        ether 0a:d7:b9:d8:3f:38  txqueuelen 0  (Ethernet)
        RX packets 8898  bytes 594403 (594.4 KB)
        RX errors 0  dropped 0  overruns 0  frame 0
        TX packets 19241  bytes 31746462 (31.7 MB)
        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0

root@michael-host:/home/michael/linux#

```

怎么样证明他们插在了 `docker0` 网桥上呢？通过 `brctl show` 命令，Ubuntu 可以通过下面的命令进行安装：

> apt install bridge-utils

`brctl show` 命令展示了插在 `docker0` 网桥上的设备，展示为 `interface`，表示一个端口：

```
root@michael-host:/home/michael/linux# brctl show
bridge name     bridge id               STP enabled     interfaces
docker0         8000.0242adc77598       no              veth11089d0
                                                        veth6f3258e
```

### 容器通信

通过 `ping` 命令来验证 `icmp` 报文是通过 `docker0` 网桥进行转发的，在 `ubuntu-1` 发起 `ping` 命令肯定是可以正常达到的：

```
root@michael-host:/# ping  172.17.0.2
PING 172.17.0.2 (172.17.0.2) 56(84) bytes of data.
64 bytes from 172.17.0.2: icmp_seq=1 ttl=64 time=0.100 ms
64 bytes from 172.17.0.2: icmp_seq=2 ttl=64 time=0.048 ms
^C
--- 172.17.0.2 ping statistics ---
2 packets transmitted, 2 received, 0% packet loss, time 1050ms
rtt min/avg/max/mdev = 0.048/0.074/0.100/0.026 ms
```

为了抓住这个信息，我们需要借助 `iptables` 工具在发出 `icmp` 报文的时候记录下日志，`iptables` 控制内核模块在收发到数据包时根据创建的规则进行处理，我们这里只进行日志记录，可以在主机上执行如下命令：

> iptables -t raw -A OUTPUT -p icmp -j LOG
> iptables -t raw -A PREROUTING -p icmp -j LOG

查看创建的规则使用如下命令：

```
root@michael-host:/home/michael/linux# iptables -t raw --list
Chain PREROUTING (policy ACCEPT)
target     prot opt source               destination
LOG        icmp --  anywhere             anywhere             LOG level warning

Chain OUTPUT (policy ACCEPT)
target     prot opt source               destination
LOG        icmp --  anywhere             anywhere             LOG level warning
```

如果要设置日志前缀，可以通过 `--log-prefix 'xx prefix'` 进行设置。 默认情况下，`iptables` 日志被发送到内核的消息缓冲区。要查看这些日志，需要配置 `syslog` 以读取消息缓冲区并将日志写入文件。可以通过编辑 `syslog` 配置文件来完成，该文件通常位于 `/etc/syslog.conf` 或 `/etc/rsyslog.conf`（Ubuntu），打开该文件添加如下配置：

```text /etc/rsyslog.conf
...
kern.warning /var/log/iptables.log
```

完成之后，需要重启 `syslog` 服务：

```
root@michael-host:/home/michael/linux# systemctl restart rsyslog
root@michael-host:/home/michael/linux#
root@michael-host:/home/michael/linux#
root@michael-host:/home/michael/linux# systemctl status rsyslog
● rsyslog.service - System Logging Service
     Loaded: loaded (/lib/systemd/system/rsyslog.service; enabled; vendor preset: enabled)
     Active: active (running) since Sat 2023-12-09 17:40:51 CST; 4s ago
TriggeredBy: ● syslog.socket
       Docs: man:rsyslogd(8)
             man:rsyslog.conf(5)
             https://www.rsyslog.com/doc/
   Main PID: 3392744 (rsyslogd)
      Tasks: 4 (limit: 19103)
     Memory: 1.1M
     CGroup: /system.slice/rsyslog.service
             └─3392744 /usr/sbin/rsyslogd -n -iNONE

...
```

一切就绪之后，再次从 `ubuntu-1` 之内发起 `ping` 请求，同时观察 `/var/log/iptables.log` 打印出来的日志消息：

```
Dec  9 19:27:59 michael-host kernel: [296914.161779] IN=docker0 OUT= PHYSIN=veth6f3258e MAC=02:42:ac:11:00:02:02:42:ac:11:00:03:08:00 SRC=172.17.0.3 DST=172.17.0.2 LEN=84 TOS=0x00 PREC=0x00 TTL=64 ID=56385 DF PROTO=ICMP TYPE=8 CODE=0 ID=53101 SEQ=1
Dec  9 19:27:59 michael-host kernel: [296914.161810] IN=docker0 OUT= PHYSIN=veth11089d0 MAC=02:42:ac:11:00:03:02:42:ac:11:00:02:08:00 SRC=172.17.0.2 DST=172.17.0.3 LEN=84 TOS=0x00 PREC=0x00 TTL=64 ID=54866 PROTO=ICMP TYPE=0 CODE=0 ID=53101 SEQ=1
```

`ping` 报文从 `ubuntu-1` 发出去之后，从 `veth6f3258e` 流入，被 `docker0` 处理发送至 `ubuntu-2`，应答报文从 `ubuntu-2` 发出去，经 `veth11089d0` 流入 `docker0` 处理最终发送到 `ubuntu-1`。这里的消息都是通过二层网络直达目的主机，对于 `ubuntu-1` 来说，在他的网络协议栈中，就需要 `eth0` 网卡发送 `ARP` 广播，来通过 `IP` 地址找到对应的 `MAC` 地址，这个 `ARP` 请求最终会被 `docker0` 接手并且广播到插在这个网桥上其他设备，`ubuntu-2` 收到之后应答对应的 `MAC` 地址给 `ubuntu-1` 容器，有了这个 `MAC` 地址，`ubuntu-1` 就可以把数据发送出去。

{% cq %}ARP（Address Resolution Protocol），是通过三层的IP地址找到对应的二层MAC地址的协议{% endcq %}


### Veth Pair 设备

通过下面的命令我们可以手动创建 `veth pair` 设备分别加入两个命名空间，不创建网桥，不添加路由，直接可以通信：

```
# 创建namespace
ip netns add ns1
ip netns add ns2

# 创建一对 veth pair
ip link add veth111 type veth peer name veth222

# 将 veth 两端分别加入两个命名空间
ip link set veth111 netns ns1
ip link set veth222 netns ns2

# 给两个 veth 设置ip 并且启用
ip netns exec ns1 ip addr add 10.1.1.2/24 dev veth111
ip netns exec ns2 ip addr add 10.1.1.3/24 dev veth222
ip netns exec ns1 ip link set veth111 up
ip netns exec ns2 ip link set veth222 up

# ping 一下试试
root@michael-host:/home/michael/linux# ip netns exec ns1 ping 10.1.1.3
PING 10.1.1.3 (10.1.1.3) 56(84) bytes of data.
64 bytes from 10.1.1.3: icmp_seq=1 ttl=64 time=0.057 ms
64 bytes from 10.1.1.3: icmp_seq=2 ttl=64 time=0.027 ms
64 bytes from 10.1.1.3: icmp_seq=3 ttl=64 time=0.035 ms
^C
--- 10.1.1.3 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2115ms
rtt min/avg/max/mdev = 0.027/0.039/0.057/0.012 ms
root@michael-host:/home/michael/linux#

# 删除命名空间
ip netns delete ns1 ns2
```

### 模拟容器通信

通过以下脚本创建两个命名空间，两对 `Veth Pair` 设备，以及网桥设备，模拟两个命名空间之内的通信：

{% note success 示例脚本 %}

```bash bridge.sh
#!/bin/bash

set -o pipefail

string="$1"

if [ "$string" = "up" ]; then

# 输出当前ip转发开关
echo "ip_forward: /proc/sys/net/ipv4/ip_forward"
cat /proc/sys/net/ipv4/ip_forward


# 添加命名空间
ip netns add net1
ip netns add net2

# 创建两对 veth 
ip link add veth1 type veth peer name vethpeer1
ip link add veth2 type veth peer name vethpeer2

# 启用 veth1 veth2
ip link set veth1 up
ip link set veth2 up

# 将他们的对端分别加入到两个命名空间
ip link set vethpeer1 netns net1
ip link set vethpeer2 netns net2

# 启用这两个网络空间下的 lo 设备和 veth 的另一端
ip netns exec net1 ip link set lo up
ip netns exec net2 ip link set lo up
ip netns exec net1 ip link set vethpeer1 up
ip netns exec net2 ip link set vethpeer2 up

# 给两个空间的 veth 设备设置ip地址
ip netns exec net1 ip addr add 10.100.0.10/16 dev vethpeer1
ip netns exec net2 ip addr add 10.100.0.20/16 dev vethpeer2

echo ""
echo ""
echo "[Debug] namespace: net1, vethpeer1:"
ip netns exec net1 ip addr show vethpeer1

echo ""
echo "[Debug] namespace: net2, vethpeer2:"
ip netns exec net2 ip addr show vethpeer2

# 添加网桥设备并启用
ip link add br00 type bridge
ip link set br00 up

# 将 veth1 veth2 作为端口添加在网桥上
ip link set veth1 master br00
ip link set veth2 master br00

# 给网桥设置ip地址
ip addr add 10.100.0.1/16 dev br00

echo ""
echo ""
echo "[Debug] ip addr show br00:"
ip addr show br00

# 给两个命名空间添加默认路由
ip netns exec net1 ip route add default via 10.100.0.1
ip netns exec net2 ip route add default via 10.100.0.1

# 显示两个命名空间路由信息
echo ""
echo ""
echo "[Debug] show default route for net1:"
ip netns exec net1 route -n

echo ""
echo ""
echo "[Debug]  show default route for net2:"
ip netns exec net2 route -n 

# 查看网桥设备信息
echo ""
echo ""
echo "[Debug] brctrl show:"
 brctl show


echo ""
echo ""
echo "[Debug] ping:"

# 从 net1 发起ping命令
ip netns exec net1 ping -c 2 10.100.0.20

# 从 net2 发起ping命令
ip netns exec net2 ping -c 2 10.100.0.10

fi



if [ "$1" == "down" ]; then

ip netns delete net1
ip netns delete net2

ip link delete br00

fi
```

{% endnote %}

保存并且执行之后，将会输出如下的结果：

```
root@michael-host:/home/michael/linux#  ./bridge.sh up
ip_forward: /proc/sys/net/ipv4/ip_forward
1


[Debug] namespace: net1, vethpeer1:
551: vethpeer1@if552: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default qlen 1000
    link/ether 32:4c:27:44:51:25 brd ff:ff:ff:ff:ff:ff link-netnsid 0
    inet 10.100.0.10/16 scope global vethpeer1
       valid_lft forever preferred_lft forever
    inet6 fe80::304c:27ff:fe44:5125/64 scope link tentative
       valid_lft forever preferred_lft forever

[Debug] namespace: net2, vethpeer2:
553: vethpeer2@if554: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default qlen 1000
    link/ether b2:98:86:bb:f7:c9 brd ff:ff:ff:ff:ff:ff link-netnsid 0
    inet 10.100.0.20/16 scope global vethpeer2
       valid_lft forever preferred_lft forever
    inet6 fe80::b098:86ff:febb:f7c9/64 scope link tentative
       valid_lft forever preferred_lft forever


[Debug] ip addr show br00:
555: br00: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default qlen 1000
    link/ether 0a:63:b7:ef:ad:3d brd ff:ff:ff:ff:ff:ff
    inet 10.100.0.1/16 scope global br00
       valid_lft forever preferred_lft forever
    inet6 fe80::4c56:d4ff:fe42:7b2/64 scope link tentative
       valid_lft forever preferred_lft forever


[Debug] show default route for net1:
Kernel IP routing table
Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
0.0.0.0         10.100.0.1      0.0.0.0         UG    0      0        0 vethpeer1
10.100.0.0      0.0.0.0         255.255.0.0     U     0      0        0 vethpeer1


[Debug]  show default route for net2:
Kernel IP routing table
Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
0.0.0.0         10.100.0.1      0.0.0.0         UG    0      0        0 vethpeer2
10.100.0.0      0.0.0.0         255.255.0.0     U     0      0        0 vethpeer2


[Debug] brctrl show:
bridge name     bridge id               STP enabled     interfaces
br00            8000.0a63b7efad3d       no              veth1
                                                        veth2


[Debug] ping:
PING 10.100.0.20 (10.100.0.20) 56(84) bytes of data.
64 bytes from 10.100.0.20: icmp_seq=1 ttl=64 time=0.108 ms
64 bytes from 10.100.0.20: icmp_seq=2 ttl=64 time=0.038 ms

--- 10.100.0.20 ping statistics ---
2 packets transmitted, 2 received, 0% packet loss, time 1009ms
rtt min/avg/max/mdev = 0.038/0.073/0.108/0.035 ms
PING 10.100.0.10 (10.100.0.10) 56(84) bytes of data.
64 bytes from 10.100.0.10: icmp_seq=1 ttl=64 time=0.057 ms
64 bytes from 10.100.0.10: icmp_seq=2 ttl=64 time=0.065 ms

--- 10.100.0.10 ping statistics ---
2 packets transmitted, 2 received, 0% packet loss, time 1021ms
rtt min/avg/max/mdev = 0.057/0.061/0.065/0.004 ms
```
