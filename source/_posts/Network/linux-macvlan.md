---
title: Linux 虚拟网络之MACVLAN & IPVLAN
date: 2024-03-08 11:22:53
tags:
    - MACVLAN
categories:
    - Linux
    - Network
---

`Macvlan` 和 `ipvlan` 是 `Linux` 网络驱动程序，可将底层或主机接口直接暴露给主机中运行的虚拟机或容器。在运行裸机服务器时，主机联网可以很简单，只需几个以太网接口和一个默认网关即可提供外部连接。但是当在一台主机上运行多个虚拟机时，就需要在主机内和主机间提供虚拟机之间的连接。单个主机中的虚拟机数量平均不超过 `15-20` 个。在主机中运行容器时，单个主机中的容器数量很容易超过 `100` 个，这就需要有复杂的机制来实现容器之间的互联。容器或虚拟机之间的通信大致有两种方式，在底层网络中，通常使用网桥、macvlan、ipvlan将虚拟机或容器直接暴露于主机网络。但是在用于跨主机通信的`overlay`网络中，会使用 `VXLAN` 这样的技术进行额外的封装。

在安装 `docekr` 之后，会默认创建 `docker0` 这样的网桥，这也是`docker`默认的[容器网络](/2023/12/09/Network/container-network-single-host)实现方式，连接同一个网桥上的容器，处于相同的网络之内，可以直接在二层实现网络互通，对于外部访问则通过网桥实现。

```
$ ifconfig docker0
docker0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
    inet 172.17.0.1  netmask 255.255.0.0  broadcast 172.17.255.255
    inet6 fe80::42:92ff:feb9:e637  prefixlen 64  scopeid 0x20<link>
    ether 02:42:92:b9:e6:37  txqueuelen 0  (Ethernet)
    RX packets 15861  bytes 835715 (835.7 KB)
    RX errors 0  dropped 0  overruns 0  frame 0
    TX packets 31502  bytes 48605473 (48.6 MB)
    TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0
```

而`macvlan`和 `ipvlan`允许单个物理接口创建出多个子接口，其中每个`macvlan`子都有唯一的`MAC`和`IP`地址，并直接暴露在底层网络中。`macvlan` 接口通常用于虚拟化应用，每个 `macvlan` 接口都连接到一个容器或虚拟机。`macvlan` 有`4`种类型（`Private`、`VEPA`、`Bridge`、`Passthru`），常用的类型是 `Bridge`，它允许单个主机中的实体在数据包不离开主机的情况下相互通信。对于外部连接，则使用底层网络，下图显示两个容器使用 `macvlan` 网桥相互通信并与外界通信，两个容器都将使用 `macvlan` 子接口直接接入底层网络。

`ipvlan` 与 `macvlan` 类似，区别在于每个子接口具有相同的 `mac` 地址，`ipvlan` 支持 `L2` 和 `L3` 模式，父接口只能选择其中一种工作模式，在 `ipvlan l2` 模式下，父接口作为交换机来转发子接口的数据，同一个网络的子接口可以通过父接口来转发数据，而如果想发送到其他网络，报文则会通过父接口的路由转发出去。`L3` 模式下，`ipvlan` 有点像路由器的功能，它在各个虚拟网络和主机网络之间进行不同网络报文的路由转发工作。只要父接口相同，即使虚拟机/容器不在同一个网络，也可以互相 `ping` 通对方，因为 `ipvlan` 会在中间做报文的转发工作。

{% asset_img arch.png %}

<!-- more -->

### MACVLAN

可以使用 `ip` 命令来创建 `macvlan` 设备：

```
$ ip link add link eth0 name macvlan1 type macvlan mode bridge
$ ip link add link eth0 name macvlan2 type macvlan mode bridge
```

创建两个网络命名空间，将 `macvlan` 设备分别放入，模拟容器之间的通信，而且将它们的名字在两个命名空间之中都修改为了 `eth0`：

```
$ ip netns add net1
$ ip netns add net2
$ ip link set macvlan1 netns net1
$ ip link set macvlan2 netns net2
$ ip netns exec net1 ip link set macvlan1 name eth0
$ ip netns exec net2 ip link set macvlan2 name eth0
```

然后设置`IP`地址并且启用，要注意的是设置的`IP`地址和`eth0`必须在同一网段内，例如，这里 `eth0` 的网络是 `172.19.96.0/20`：

```
$ ip addr show eth0
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP group default qlen 1000
    link/ether 00:15:5d:41:e5:36 brd ff:ff:ff:ff:ff:ff
    inet 172.28.252.45/20 brd 172.28.255.255 scope global eth0
       valid_lft forever preferred_lft forever
    inet6 fe80::215:5dff:fe41:e536/64 scope link
       valid_lft forever preferred_lft forever
```

所以，可以将两个 `macvlan` 设备的地址分别设置为 `172.28.248.10` 和 `172.28.248.9`：

```
$ ip netns exec net1 ip addr add 172.28.248.10/20 dev eth0
$ ip netns exec net2 ip addr add 172.28.248.9/20 dev eth0
$ ip netns exec net1 ip link set eth0 up
$ ip netns exec net2 ip link set eth0 up
$ ip netns exec net1 ip -detail link show eth0
28: eth0@if2: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP mode DEFAULT group default qlen 1000
    link/ether 8e:c0:cd:f7:cb:3b brd ff:ff:ff:ff:ff:ff link-netnsid 0 promiscuity 0 minmtu 68 maxmtu 65521
    macvlan mode bridge bcqueuelen 1000 usedbcqueuelen 1000 addrgenmode eui64 numtxqueues 1 numrxqueues 1 gso_max_size 62780 gso_max_segs 65535
$ ip netns exec net2 ip -detail link show eth0
29: eth0@if2: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP mode DEFAULT group default qlen 1000
    link/ether 5e:54:bb:4c:55:b6 brd ff:ff:ff:ff:ff:ff link-netnsid 0 promiscuity 0 minmtu 68 maxmtu 65521
    macvlan mode bridge bcqueuelen 1000 usedbcqueuelen 1000 addrgenmode eui64 numtxqueues 1 numrxqueues 1 gso_max_size 62780 gso_max_segs 65535
$  ip netns exec net1 ip a s eth0
28: eth0@if2: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default qlen 1000
    link/ether 8e:c0:cd:f7:cb:3b brd ff:ff:ff:ff:ff:ff link-netnsid 0
    inet 172.28.248.10/20 scope global eth0
       valid_lft forever preferred_lft forever
    inet6 fe80::8cc0:cdff:fef7:cb3b/64 scope link
       valid_lft forever preferred_lft forever
$ ip netns exec net2 ip a s eth0
29: eth0@if2: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default qlen 1000
    link/ether 5e:54:bb:4c:55:b6 brd ff:ff:ff:ff:ff:ff link-netnsid 0
    inet 172.28.248.9/20 scope global eth0
       valid_lft forever preferred_lft forever
    inet6 fe80::5c54:bbff:fe4c:55b6/64 scope link
       valid_lft forever preferred_lft forever
```

测试命名空间之间的网络连通性：

```
$ ip netns exec net2 ping -c 3 172.28.248.10
PING 172.28.248.10 (172.28.248.10) 56(84) bytes of data.
64 bytes from 172.28.248.10: icmp_seq=1 ttl=64 time=0.035 ms
64 bytes from 172.28.248.10: icmp_seq=2 ttl=64 time=0.023 ms
64 bytes from 172.28.248.10: icmp_seq=3 ttl=64 time=0.024 ms

--- 172.28.248.10 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2058ms
rtt min/avg/max/mdev = 0.023/0.027/0.035/0.005 ms
$ ip netns exec net1 ping -c 3 172.28.248.9
PING 172.28.248.9 (172.28.248.9) 56(84) bytes of data.
64 bytes from 172.28.248.9: icmp_seq=1 ttl=64 time=0.016 ms
64 bytes from 172.28.248.9: icmp_seq=2 ttl=64 time=0.022 ms
64 bytes from 172.28.248.9: icmp_seq=3 ttl=64 time=0.021 ms

--- 172.28.248.9 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2098ms
rtt min/avg/max/mdev = 0.016/0.019/0.022/0.002 ms
```

但是此时从主机无法访问命名空间的网络，从命名空间也无法访问主机网络：

{% note danger %}
```
$ ping -c 3 172.28.248.10
PING 172.28.248.10 (172.28.248.10) 56(84) bytes of data.
From 172.28.252.45 icmp_seq=1 Destination Host Unreachable
From 172.28.252.45 icmp_seq=2 Destination Host Unreachable
From 172.28.252.45 icmp_seq=3 Destination Host Unreachable

--- 172.28.248.10 ping statistics ---
3 packets transmitted, 0 received, +3 errors, 100% packet loss, time 2079ms
pipe 3
$ ip netns exec net1 ping -c 3 172.28.252.45
PING 172.28.252.45 (172.28.252.45) 56(84) bytes of data.

--- 172.28.252.45 ping statistics ---
3 packets transmitted, 0 received, 100% packet loss, time 2098ms

```
{% endnote %}

这个是 `macvlan` 网络的限制，解决方案参见[这里](https://blog.oddbit.com/post/2018-03-12-using-docker-macvlan-networks/)，通过在主机上再创建一个`macvlan`子接口，通过它和 `net1` 和 `net2` 的网络打通：

{% note success %}
```
$ ip link add mynet-shim link eth0 type macvlan mode bridge
$ ip addr add 172.28.248.254/32 dev mynet-shim
$ ip link set mynet-shim up
$ ip route add 172.28.248.0/21 dev mynet-shim
$ ping -c 3 172.28.248.9
PING 172.28.248.9 (172.28.248.9) 56(84) bytes of data.
64 bytes from 172.28.248.9: icmp_seq=1 ttl=64 time=0.075 ms
64 bytes from 172.28.248.9: icmp_seq=2 ttl=64 time=0.047 ms
64 bytes from 172.28.248.9: icmp_seq=3 ttl=64 time=0.029 ms

--- 172.28.248.9 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2082ms
rtt min/avg/max/mdev = 0.029/0.050/0.075/0.018 ms
$ ip netns exec net1 ping -c 3 172.28.252.45
PING 172.28.252.45 (172.28.252.45) 56(84) bytes of data.
64 bytes from 172.28.252.45: icmp_seq=1 ttl=64 time=0.057 ms
64 bytes from 172.28.252.45: icmp_seq=2 ttl=64 time=0.037 ms
64 bytes from 172.28.252.45: icmp_seq=3 ttl=64 time=0.034 ms

--- 172.28.252.45 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2052ms
rtt min/avg/max/mdev = 0.034/0.042/0.057/0.010 ms
```
{% endnote %}

清理测试现场使用：

> `ip netns delete net1`
> `ip netns delete net2`
> `ip link delete mynet-shim`

#### `Docker Macvlan` 网络

`docker` 默认的容器网络实现方式是通过`docker0`网桥将容器都连接起来，实现容器之间的互通，也可以通过 `macvlan` 实现容器网络。首先在 `docker` 中需要创建基于 `macvlan` 的网络，限定容器只能分配 `172.28.244.0/22` 之内的地址，并且保留地址 `172.28.244.254`：

```
$ docker network create -d macvlan --subnet=172.28.240.0/20 --gateway=172.28.240.1 --ip-range 172.28.244.0/22 --aux-address 'host=172.28.244.254' -o parent=eth0 macvlan
$ docker network ls
NETWORK ID     NAME      DRIVER    SCOPE
8599456a5481   bridge    bridge    local
72f3e075f337   host      host      local
c2567c18f640   macvlan   macvlan   local
5daaac101de2   none      null      local
```

依然要注意的是这里的子网 `172.28.240.0/20` 必须和 `eth0` 同属一个网络内，或者必须是它的子集，`eth0` 的网络是 `172.28.240.0/20`。为避免`IP`冲突，通过指定 `ip` 的方式创建两个容器，镜像 `ubuntu:local` 是本地构建的添加了很多网络测试工具：

> `docker run -itd --name ubuntu1 --ip=172.28.244.2 --network macvlan ubuntu:local`
> `docker run -itd --name ubuntu2 --ip=172.28.244.3 --network macvlan ubuntu:local`

查看容器的 `eth0` 网口详细信息并测试网络连通性：

```
$ docker exec -it ubuntu1 ip -detail addr show eth0
33: eth0@if2: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default
    link/ether 02:42:ac:1c:f4:02 brd ff:ff:ff:ff:ff:ff link-netnsid 0 promiscuity 0 minmtu 68 maxmtu 65521
    macvlan mode bridge bcqueuelen 1000 usedbcqueuelen 1000 numtxqueues 1 numrxqueues 1 gso_max_size 62780 gso_max_segs 65535
    inet 172.28.244.2/22 brd 172.28.247.255 scope global eth0
       valid_lft forever preferred_lft forever
$ docker exec -it ubuntu2 ip -detail addr show eth0
34: eth0@if2: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default
    link/ether 02:42:ac:1c:f4:03 brd ff:ff:ff:ff:ff:ff link-netnsid 0 promiscuity 0 minmtu 68 maxmtu 65521
    macvlan mode bridge bcqueuelen 1000 usedbcqueuelen 1000 numtxqueues 1 numrxqueues 1 gso_max_size 62780 gso_max_segs 65535
    inet 172.28.244.3/22 brd 172.28.247.255 scope global eth0
       valid_lft forever preferred_lft forever
$ docker exec -it ubuntu2 ping -c 3 172.28.244.2
PING 172.28.244.2 (172.28.244.2) 56(84) bytes of data.
64 bytes from 172.28.244.2: icmp_seq=1 ttl=64 time=0.061 ms
64 bytes from 172.28.244.2: icmp_seq=2 ttl=64 time=0.025 ms
64 bytes from 172.28.244.2: icmp_seq=3 ttl=64 time=0.028 ms

--- 172.28.244.2 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2069ms
rtt min/avg/max/mdev = 0.025/0.038/0.061/0.016 ms
```

和上面的示例一样，此时从`Host`访问荣日和和从容器访问`Host`都会失败：

{% note danger %}
```
$ docker exec -it ubuntu2 ping -c 3 172.28.252.45
PING 172.28.252.45 (172.28.252.45) 56(84) bytes of data.
From 172.28.244.3 icmp_seq=1 Destination Host Unreachable
From 172.28.244.3 icmp_seq=2 Destination Host Unreachable
From 172.28.244.3 icmp_seq=3 Destination Host Unreachable

--- 172.28.252.45 ping statistics ---
3 packets transmitted, 0 received, +3 errors, 100% packet loss, time 2063ms
pipe 3
$ ping 172.28.244.2
PING 172.28.244.2 (172.28.244.2) 56(84) bytes of data.
From 172.28.252.45 icmp_seq=1 Destination Host Unreachable
From 172.28.252.45 icmp_seq=2 Destination Host Unreachable
From 172.28.252.45 icmp_seq=3 Destination Host Unreachable
^C
--- 172.28.244.2 ping statistics ---
5 packets transmitted, 0 received, +3 errors, 100% packet loss, time 4161ms
pipe 4
```
{% endnote %}

同样添加如下的设备用于打通主机和容器之间的网络，容器网络和主机网络的网络地址都是一样的，但是在添加路由时只限定了容器网络地址段的地址通过 `mynet-shim` 进行路由：

```
$ ip link add mynet-shim link eth0 type macvlan mode bridge
$ ip addr add 172.28.244.254/32 dev mynet-shim
$ ip link set mynet-shim up
$ ip route add 172.28.244.0/22 dev mynet-shim
```

然后进行测试网络连通正常：

{% note success %}
```
$ ping -c 3 172.28.244.2
PING 172.28.244.2 (172.28.244.2) 56(84) bytes of data.
64 bytes from 172.28.244.2: icmp_seq=1 ttl=64 time=0.040 ms
64 bytes from 172.28.244.2: icmp_seq=2 ttl=64 time=0.034 ms
64 bytes from 172.28.244.2: icmp_seq=3 ttl=64 time=0.030 ms

--- 172.28.244.2 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2109ms
rtt min/avg/max/mdev = 0.030/0.034/0.040/0.004 ms
$ docker exec -it ubuntu2 ping -c 3 172.28.252.45
PING 172.28.252.45 (172.28.252.45) 56(84) bytes of data.
64 bytes from 172.28.252.45: icmp_seq=1 ttl=64 time=0.081 ms
64 bytes from 172.28.252.45: icmp_seq=2 ttl=64 time=0.032 ms
64 bytes from 172.28.252.45: icmp_seq=3 ttl=64 time=0.039 ms

--- 172.28.252.45 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2058ms
rtt min/avg/max/mdev = 0.032/0.050/0.081/0.021 ms
```
{% endnote %}

#### `Docker`多`Macvalan`网络

如果想在单个主机上创建多个 `macvlan` 网络时会创建失败，因为 `Docker` 的 `Macvlan` 网络会独占整个物理网卡：

```
$ docker network create -d macvlan --subnet=172.19.104.0/22 --gateway=172.19.104.1 -o parent=eth0 macvlan1
Error response from daemon: network dm-f46f08bb4d34 is already using parent interface eth0
```

但是 `macvlan` 支持 `VLAN`，所以可以通过 `VLAN` 将 `eth0` 划分为不同的网络，然后基于 `VLAN` 再创建 `macvlan` 的网络。首先清除之前创建的 `macvlan` 网络：

```
$ docker stop ubuntu1 ubuntu2
$ docker container prune
$ docker network rm macvlan 
```

{% note danger 可以完全不执行这段命令，使用docker创建网络的命令能够自动创建vlan %}

创建 `VLAN`，设置`IP`，并启用，如果对网络地址、子网、广播地址不会计算，可以点击[这里](https://tool.chinaz.com/tools/subnetmask)：

```
$ ip link add link eth0 name eth0.10 type vlan id 10
$ ip link add link eth0 name eth0.20 type vlan id 20 
$ ip addr add 172.28.244.1/24 brd 172.28.244.255 dev eth0.10
$ ip addr add 172.19.248.1/24 brd 172.28.248.255 dev eth0.20
$ ip link set dev eth0.10 up
$ ip link set dev eth0.20 up
$ ip -d a s eth0.10
42: eth0.10@eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default qlen 1000
    link/ether 00:15:5d:41:e5:36 brd ff:ff:ff:ff:ff:ff promiscuity 0 minmtu 0 maxmtu 65535
    vlan protocol 802.1Q id 10 <REORDER_HDR> numtxqueues 1 numrxqueues 1 gso_max_size 62780 gso_max_segs 65535
    inet 172.28.244.1/24 brd 172.28.244.255 scope global eth0.10
       valid_lft forever preferred_lft forever
    inet6 fe80::215:5dff:fe41:e536/64 scope link tentative
       valid_lft forever preferred_lft forever
$ ip -d a s eth0.20
43: eth0.20@eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default qlen 1000
    link/ether 00:15:5d:41:e5:36 brd ff:ff:ff:ff:ff:ff promiscuity 0 minmtu 0 maxmtu 65535
    vlan protocol 802.1Q id 20 <REORDER_HDR> numtxqueues 1 numrxqueues 1 gso_max_size 62780 gso_max_segs 65535
    inet 172.19.248.1/24 brd 172.28.244.255 scope global eth0.20
       valid_lft forever preferred_lft forever
    inet6 fe80::215:5dff:fe41:e536/64 scope link
       valid_lft forever preferred_lft forever
```

{% endnote %}

然后创建两个 `Docker macvlan` 网络，这里的父接口指定的是 `eth0.10` 不再是 `eth0`，实际上它是一个 `VLAN`，`docker` 能够自动识别并且创建`vlan`：

```
$ docker network create -d macvlan --subnet=172.28.244.0/24 --gateway=172.28.244.1 --aux-address 'host=172.28.244.254' -o parent=eth0.10 macvlan1-net
$ docker network create -d macvlan --subnet=172.28.248.0/24 --gateway=172.28.248.1 --aux-address 'host=172.28.248.254' -o parent=eth0.20 macvlan2-net
$ docker network ls
NETWORK ID     NAME           DRIVER    SCOPE
8599456a5481   bridge         bridge    local
72f3e075f337   host           host      local
934949bed44c   macvlan1-net   macvlan   local
b49e873d9e89   macvlan2-net   macvlan   local
5daaac101de2   none           null      local
$ ip -d addr show type vlan
44: eth0.10@eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default
    link/ether 00:15:5d:41:e5:36 brd ff:ff:ff:ff:ff:ff promiscuity 0 minmtu 0 maxmtu 65535
    vlan protocol 802.1Q id 10 <REORDER_HDR> numtxqueues 1 numrxqueues 1 gso_max_size 62780 gso_max_segs 65535
    inet6 fe80::215:5dff:fe41:e536/64 scope link
       valid_lft forever preferred_lft forever
45: eth0.20@eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default
    link/ether 00:15:5d:41:e5:36 brd ff:ff:ff:ff:ff:ff promiscuity 0 minmtu 0 maxmtu 65535
    vlan protocol 802.1Q id 20 <REORDER_HDR> numtxqueues 1 numrxqueues 1 gso_max_size 62780 gso_max_segs 65535
    inet6 fe80::215:5dff:fe41:e536/64 scope link
       valid_lft forever preferred_lft forever
```

基于两个不同的 `macvlan` 网络创建两个容器，发现他们之间并不互通，因为它们处于不同的 `vlan`：

```
$ docker run -itd --name ubuntu1 --ip=172.28.244.2 --network macvlan1-net ubuntu:local
$ docker run -itd --name ubuntu2 --ip=172.28.244.3 --network macvlan1-net ubuntu:local
$ docker run -itd --name ubuntu3 --ip=172.28.248.2 --network macvlan2-net ubuntu:local
$ docker run -itd --name ubuntu4 --ip=172.28.248.3 --network macvlan2-net ubuntu:local
```

相同 `vlan` 之间的容器网络互通：

{% tabs 相同 vlan 容器互通 %}

<!-- tab eth.10 -->

```
$ docker exec -it ubuntu1 ip -d addr show eth0
46: eth0@if44: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default
    link/ether 02:42:ac:1c:f4:02 brd ff:ff:ff:ff:ff:ff link-netnsid 0 promiscuity 0 minmtu 68 maxmtu 65535
    macvlan mode bridge bcqueuelen 1000 usedbcqueuelen 1000 numtxqueues 1 numrxqueues 1 gso_max_size 62780 gso_max_segs 65535
    inet 172.28.244.2/24 brd 172.28.244.255 scope global eth0
       valid_lft forever preferred_lft forever
$ docker exec -it ubuntu2 ip -d addr show eth0
47: eth0@if44: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default
    link/ether 02:42:ac:1c:f4:03 brd ff:ff:ff:ff:ff:ff link-netnsid 0 promiscuity 0 minmtu 68 maxmtu 65535
    macvlan mode bridge bcqueuelen 1000 usedbcqueuelen 1000 numtxqueues 1 numrxqueues 1 gso_max_size 62780 gso_max_segs 65535
    inet 172.28.244.3/24 brd 172.28.244.255 scope global eth0
       valid_lft forever preferred_lft forever
$ docker exec -it ubuntu1 ping -c 3 172.28.244.3
PING 172.28.244.3 (172.28.244.3) 56(84) bytes of data.
64 bytes from 172.28.244.3: icmp_seq=1 ttl=64 time=0.026 ms
64 bytes from 172.28.244.3: icmp_seq=2 ttl=64 time=0.025 ms
64 bytes from 172.28.244.3: icmp_seq=3 ttl=64 time=0.028 ms

--- 172.28.244.3 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2060ms
rtt min/avg/max/mdev = 0.025/0.026/0.028/0.001 ms
```

<!-- endtab -->

<!-- tab eth.20 -->
```
$ docker exec -it ubuntu3 ip -d addr show eth0
48: eth0@if45: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default
    link/ether 02:42:ac:1c:f8:02 brd ff:ff:ff:ff:ff:ff link-netnsid 0 promiscuity 0 minmtu 68 maxmtu 65535
    macvlan mode bridge bcqueuelen 1000 usedbcqueuelen 1000 numtxqueues 1 numrxqueues 1 gso_max_size 62780 gso_max_segs 65535
    inet 172.28.248.2/24 brd 172.28.248.255 scope global eth0
       valid_lft forever preferred_lft forever
$ docker exec -it ubuntu4 ip -d addr show eth0
49: eth0@if45: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default
    link/ether 02:42:ac:1c:f8:03 brd ff:ff:ff:ff:ff:ff link-netnsid 0 promiscuity 0 minmtu 68 maxmtu 65535
    macvlan mode bridge bcqueuelen 1000 usedbcqueuelen 1000 numtxqueues 1 numrxqueues 1 gso_max_size 62780 gso_max_segs 65535
    inet 172.28.248.3/24 brd 172.28.248.255 scope global eth0
       valid_lft forever preferred_lft forever
$ docker exec -it ubuntu4 ping -c 3 172.28.248.2
PING 172.28.248.2 (172.28.248.2) 56(84) bytes of data.
64 bytes from 172.28.248.2: icmp_seq=1 ttl=64 time=0.079 ms
64 bytes from 172.28.248.2: icmp_seq=2 ttl=64 time=0.025 ms
64 bytes from 172.28.248.2: icmp_seq=3 ttl=64 time=0.025 ms

--- 172.28.248.2 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2065ms
rtt min/avg/max/mdev = 0.025/0.043/0.079/0.025 ms
```
<!-- endtab -->

{% endtabs %}

但是不同 `vlan` 之间的网络相互隔离，不能互通：

{% note danger %}
```
$ docker exec -it ubuntu4 ping -c 3 172.28.244.2
PING 172.28.244.2 (172.28.244.2) 56(84) bytes of data.
From 172.28.248.3 icmp_seq=1 Destination Host Unreachable
From 172.28.248.3 icmp_seq=2 Destination Host Unreachable
From 172.28.248.3 icmp_seq=3 Destination Host Unreachable

--- 172.28.244.2 ping statistics ---
3 packets transmitted, 0 received, +3 errors, 100% packet loss, time 2071ms
pipe 3
```
{% endnote %}

如果想要实现容器和主机的互通，可以使用如下的方法，可以使用如下的方法：

```
$ ip link add macvlan1-shim link eth0.10 type macvlan mode bridge
$ ip addr add 172.28.244.254/32 dev macvlan1-shim
$ ip link set macvlan1-shim up
$ ip route add 172.28.244.0/24 dev macvlan1-shim
$ ip link add macvlan2-shim link eth0.20 type macvlan mode bridge
$ ip addr add 172.28.248.254/32 dev macvlan2-shim
$ ip link set macvlan2-shim up
$ ip route add 172.28.248.0/24 dev macvlan2-shim
```

测试主机到容器的网络连通性：

```
$ ping -c 2 172.28.244.2
PING 172.28.244.2 (172.28.244.2) 56(84) bytes of data.
64 bytes from 172.28.244.2: icmp_seq=1 ttl=64 time=0.050 ms
64 bytes from 172.28.244.2: icmp_seq=2 ttl=64 time=0.045 ms

--- 172.28.244.2 ping statistics ---
2 packets transmitted, 2 received, 0% packet loss, time 1061ms
rtt min/avg/max/mdev = 0.045/0.047/0.050/0.002 ms
$ ping -c 2 172.28.248.2
PING 172.28.248.2 (172.28.248.2) 56(84) bytes of data.
64 bytes from 172.28.248.2: icmp_seq=1 ttl=64 time=0.047 ms
64 bytes from 172.28.248.2: icmp_seq=2 ttl=64 time=0.037 ms

--- 172.28.248.2 ping statistics ---
2 packets transmitted, 2 received, 0% packet loss, time 1059ms
rtt min/avg/max/mdev = 0.037/0.042/0.047/0.005 ms
```

如果还没有为 `vlan` 设置 `IP` 地址，执行如下的命令：

```
$ ip addr add 172.28.244.1/24 dev eth0.10
$ ip addr add 172.28.248.1/24 dev eth0.20
$ ip route delete 172.28.248.0/24 dev eth0.20
$ ip route delete 172.28.244.0/24 dev eth0.10
```

此时系统的路由如下：

```
$ route -n
Kernel IP routing table
Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
0.0.0.0         172.28.240.1    0.0.0.0         UG    0      0        0 eth0
10.42.0.0       0.0.0.0         255.255.255.0   U     0      0        0 cni0
172.17.0.0      0.0.0.0         255.255.0.0     U     0      0        0 docker0
172.28.240.0    0.0.0.0         255.255.240.0   U     0      0        0 eth0
172.28.244.0    0.0.0.0         255.255.255.0   U     0      0        0 macvlan1-shim
172.28.248.0    0.0.0.0         255.255.255.0   U     0      0        0 macvlan2-shim
```

再测试容器到主机的网络连通情况：

```
$ docker exec -it ubuntu1 ping -c 2 172.28.252.45
PING 172.28.252.45 (172.28.252.45) 56(84) bytes of data.
64 bytes from 172.28.252.45: icmp_seq=1 ttl=64 time=0.071 ms
64 bytes from 172.28.252.45: icmp_seq=2 ttl=64 time=0.037 ms

--- 172.28.252.45 ping statistics ---
2 packets transmitted, 2 received, 0% packet loss, time 1040ms
rtt min/avg/max/mdev = 0.037/0.054/0.071/0.017 ms
$ docker exec -it ubuntu4 ping -c 2 172.28.252.45
PING 172.28.252.45 (172.28.252.45) 56(84) bytes of data.
64 bytes from 172.28.252.45: icmp_seq=1 ttl=64 time=0.081 ms
64 bytes from 172.28.252.45: icmp_seq=2 ttl=64 time=0.027 ms

--- 172.28.252.45 ping statistics ---
2 packets transmitted, 2 received, 0% packet loss, time 1036ms
rtt min/avg/max/mdev = 0.027/0.054/0.081/0.027 ms
```

清理现场使用如下方式，`vlan` 和 `macvlan` 设备会被自动删除：

```
$ docker stop ubuntu1 ubuntu2 ubuntu3 ubuntu4
$ docker container prune
$ docker network rm macvlan1-net macvlan2-net
```

### ipvlan

[ipvlan](https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/8/html/configuring_and_managing_networking/getting-started-with-ipvlan_configuring-and-managing-networking) 有两种不同的模式：`L2` 和 `L3`。一个父接口只能选择一种模式，依附于它的所有虚拟接口都运行在这个模式下，不能混用模式。`ipvlan L2` 模式和 `macvlan bridge` 模式工作原理很相似，父接口作为交换机来转发子接口的数据，同一个网络的子接口可以通过父接口来转发数据，而如果想发送到其他网络，报文则会通过父接口的路由转发出去。`L3` 模式下，`ipvlan` 有点像路由器的功能，它在各个虚拟网络和主机网络之间进行不同网络报文的路由转发工作。只要父接口相同，即使虚拟机/容器不在同一个网络，也可以互相 `ping` 通对方，因为 `ipvlan` 会在中间做报文的转发工作。

```
$ ifconfig eth0
eth0: flags=4419<UP,BROADCAST,RUNNING,PROMISC,MULTICAST>  mtu 1500
    inet 172.28.252.45  netmask 255.255.240.0  broadcast 172.28.255.255
    inet6 fe80::215:5dff:fe41:e536  prefixlen 64  scopeid 0x20<link>
    ether 00:15:5d:41:e5:36  txqueuelen 1000  (Ethernet)
    RX packets 1098707  bytes 1348388965 (1.3 GB)
    RX errors 0  dropped 0  overruns 0  frame 0
    TX packets 690040  bytes 42806080 (42.8 MB)
    TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0
```

#### L2

创建三个个 `ipvlan` 子接口，设置`l2`工作模式：

```
ip link add link eth0 name ipvlan1 type ipvlan mode l2
ip link add link eth0 name ipvlan2 type ipvlan mode l2
ip link add link eth0 name ipvlan3 type ipvlan mode l2
```

创建三个命名空间，将新创建的子接口移入且重命名：

```
ip netns add net1
ip netns add net2
ip netns add net3
ip link set ipvlan1 netns net1
ip link set ipvlan2 netns net2
ip link set ipvlan3 netns net3
ip netns exec net1 ip link set ipvlan1 name eth0
ip netns exec net2 ip link set ipvlan2 name eth0
ip netns exec net3 ip link set ipvlan3 name eth0
```

为子接口设置`IP`地址，其中`net1` 和 `net2` 在同一个网络内，`net3` 属于其他网络：

```
ip netns exec net1 ip addr add 172.28.248.2/24 dev eth0
ip netns exec net2 ip addr add 172.28.248.3/24 dev eth0
ip netns exec net3 ip addr add 172.28.244.2/24 dev eth0
ip netns exec net1 ip link set eth0 up
ip netns exec net2 ip link set eth0 up
ip netns exec net3 ip link set eth0 up
```

`net1` 和 `net2` 网络连通性正常：

{% note success %}
```
$ ip netns exec net1 route -n
Kernel IP routing table
Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
172.28.248.0    0.0.0.0         255.255.255.0   U     0      0        0 eth0
$ ip netns exec net1 ping -c 3 172.28.248.3
PING 172.28.248.3 (172.28.248.3) 56(84) bytes of data.
64 bytes from 172.28.248.3: icmp_seq=1 ttl=64 time=0.306 ms
64 bytes from 172.28.248.3: icmp_seq=2 ttl=64 time=0.029 ms
64 bytes from 172.28.248.3: icmp_seq=3 ttl=64 time=0.021 ms

--- 172.28.248.3 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2103ms
rtt min/avg/max/mdev = 0.021/0.118/0.306/0.132 ms
```
{% endnote %}

`net1` 和 `net3` 由于在不同的网络内，即使手动添加路由，网络也不能连通：

{% note danger %}
```
$ ip netns exec net1 ip route add default via 172.28.248.1
$ ip netns exec net1 route -n
Kernel IP routing table
Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
0.0.0.0         172.28.248.1    0.0.0.0         UG    0      0        0 eth0
172.28.248.0    0.0.0.0         255.255.255.0   U     0      0        0 eth0
$ ip netns exec net1 ping -c 3 172.28.244.2
PING 172.28.244.2 (172.28.244.2) 56(84) bytes of data.

--- 172.28.244.2 ping statistics ---
3 packets transmitted, 0 received, 100% packet loss, time 2077ms
```
{% endnote %}

此时从命名空间内也是无法访问到主机的：

{% note danger %}
```
$ ip netns exec net1 ping -c 3 172.28.252.45
PING 172.28.252.45 (172.28.252.45) 56(84) bytes of data.

--- 172.28.252.45 ping statistics ---
3 packets transmitted, 0 received, 100% packet loss, time 2062ms
```
{% endnote %}

但是和主机的连通性可以通过在主机上创建另外一个`ipvlan`设备当做跳板：

```
ip link add link eth0 name ipvlan_shim type ipvlan mode l3
ip addr add 172.28.248.222/32 dev ipvlan_shim
ip link set ipvlan_shim up
ip route add 172.28.248.0/24 dev ipvlan_shim
ip route add 172.28.244.0/24 dev ipvlan_shim
```

再次测试网络连通性，正常：

{% note success %}
```
$ ip netns exec net1 ping -c 3 172.28.252.45
PING 172.28.252.45 (172.28.252.45) 56(84) bytes of data.
64 bytes from 172.28.252.45: icmp_seq=1 ttl=64 time=0.130 ms
64 bytes from 172.28.252.45: icmp_seq=2 ttl=64 time=0.039 ms
64 bytes from 172.28.252.45: icmp_seq=3 ttl=64 time=0.036 ms

--- 172.28.252.45 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2110ms
rtt min/avg/max/mdev = 0.036/0.068/0.130/0.043 ms
```
{% endnote %}

清理现场使用如下方式：

```
ip netns delete net1
ip netns delete net2
ip netns delete net3
ip link delete ipvlan_shim
```

#### L3

创建两个 `ipvlan` 子接口：

```
ip link add link eth0 name ipvlan1 type ipvlan mode l3
ip link add link eth0 name ipvlan2 type ipvlan mode l3
ip link add link eth0 name ipvlan3 type ipvlan mode l3
```

创建两个命名空间，将新创建的子接口移入且重命名：

```
ip netns add net1
ip netns add net2
ip netns add net3
ip link set ipvlan1 netns net1
ip link set ipvlan2 netns net2
ip link set ipvlan3 netns net3
ip netns exec net1 ip link set ipvlan1 name eth0
ip netns exec net2 ip link set ipvlan2 name eth0
ip netns exec net3 ip link set ipvlan3 name eth0
```

为两个子接口设置`IP`地址，而且他们不在同一个网络内：

```
ip netns exec net1 ip addr add 172.28.248.2/24 dev eth0
ip netns exec net2 ip addr add 172.28.248.3/24 dev eth0
ip netns exec net3 ip addr add 172.28.244.2/24 dev eth0
ip netns exec net1 ip link set eth0 up
ip netns exec net2 ip link set eth0 up
ip netns exec net3 ip link set eth0 up
```

`net1` 和 `net2` 处于相同的网络，网络连通性正常：

{% note success %}
```
$ ip netns exec net1 route -n
Kernel IP routing table
Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
172.28.248.0    0.0.0.0         255.255.255.0   U     0      0        0 eth0
$ ip netns exec net1 ping -c 3 172.28.248.3
PING 172.28.248.3 (172.28.248.3) 56(84) bytes of data.
64 bytes from 172.28.248.3: icmp_seq=1 ttl=64 time=0.023 ms
64 bytes from 172.28.248.3: icmp_seq=2 ttl=64 time=0.022 ms
64 bytes from 172.28.248.3: icmp_seq=3 ttl=64 time=0.024 ms

--- 172.28.248.3 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2107ms
rtt min/avg/max/mdev = 0.022/0.023/0.024/0.000 ms
```
{% endnote %}

`net1` 和 `net3` 不在同一个命名空间内网络不能互通：

{% note danger %}
```
$ ip netns exec net1 ping -c 3 172.28.244.3
ping: connect: Network is unreachable
```
{% endnote %}


但是 `l3` 模式下，可以通过设置默认路由的方式让两个网络互通：

```
ip netns exec net2 ip route add default via 172.28.248.1
ip netns exec net1 ip route add default via 172.28.248.1
ip netns exec net3 ip route add default via 172.28.244.1
```

验证 `net1` 和 `net3` 之间的连通性：

{% note success %}
```
$ ip netns exec net1 ping -c 3 172.28.244.2
PING 172.28.244.2 (172.28.244.2) 56(84) bytes of data.
64 bytes from 172.28.244.2: icmp_seq=1 ttl=64 time=0.029 ms
64 bytes from 172.28.244.2: icmp_seq=2 ttl=64 time=0.022 ms
64 bytes from 172.28.244.2: icmp_seq=3 ttl=64 time=0.029 ms

--- 172.28.244.2 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2112ms
rtt min/avg/max/mdev = 0.022/0.026/0.029/0.003 ms
$ ip netns exec net3 ping -c 3 172.28.248.3
PING 172.28.248.3 (172.28.248.3) 56(84) bytes of data.
64 bytes from 172.28.248.3: icmp_seq=1 ttl=64 time=0.022 ms
64 bytes from 172.28.248.3: icmp_seq=2 ttl=64 time=0.021 ms
64 bytes from 172.28.248.3: icmp_seq=3 ttl=64 time=0.022 ms

--- 172.28.248.3 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2109ms
rtt min/avg/max/mdev = 0.021/0.021/0.022/0.000 ms
```
{% endnote %}


如果想要从命名空间内访问到主机，需要额外创建一个 `ipvlan` 设备用作跳板：

```
ip link add link eth0 name ipvlan_shim type ipvlan mode l3
ip addr add 172.28.248.222/32 dev ipvlan_shim
ip link set ipvlan_shim up
ip route add 172.28.248.0/24 dev ipvlan_shim
ip route add 172.28.244.0/24 dev ipvlan_shim
```

测试从命名空间到达宿主机的网络连通性：

{% note success %}
```
$ ip netns exec net3 ping -c 3 172.28.252.45
PING 172.28.252.45 (172.28.252.45) 56(84) bytes of data.
64 bytes from 172.28.252.45: icmp_seq=1 ttl=64 time=0.047 ms
64 bytes from 172.28.252.45: icmp_seq=2 ttl=64 time=0.029 ms
64 bytes from 172.28.252.45: icmp_seq=3 ttl=64 time=0.052 ms

--- 172.28.252.45 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2050ms
rtt min/avg/max/mdev = 0.029/0.042/0.052/0.009 ms
$ ip netns exec net1 ping -c 3 172.28.252.45
PING 172.28.252.45 (172.28.252.45) 56(84) bytes of data.
64 bytes from 172.28.252.45: icmp_seq=1 ttl=64 time=0.057 ms
64 bytes from 172.28.252.45: icmp_seq=2 ttl=64 time=0.038 ms
64 bytes from 172.28.252.45: icmp_seq=3 ttl=64 time=0.036 ms

--- 172.28.252.45 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2068ms
rtt min/avg/max/mdev = 0.036/0.043/0.057/0.009 ms
```
{% endnote %}



清理现场：

```
ip netns delete net1
ip netns delete net2
ip netns delete net3
ip link delete ipvlan_shim
```

#### docker

创建基于 `ipvlan` 的容器网络：

```
$ docker network create -d ipvlan --subnet=172.28.240.0/20 --gateway=172.28.240.1 --ip-range 172.28.244.0/22 \
> --aux-address 'host=172.28.244.254' -o parent=eth0 -o ipvlan_mode=l2 ipvlan_l2
$ docker network ls
NETWORK ID     NAME        DRIVER    SCOPE
8599456a5481   bridge      bridge    local
72f3e075f337   host        host      local
b92fa8a5d1eb   ipvlan_l2   ipvlan    local
5daaac101de2   none        null      local
```

基于 `ipvlan` 网络创建两个容器：

```
docker run -itd --name ubuntu1 --ip=172.28.244.2 --network ipvlan_l2 ubuntu:local
docker run -itd --name ubuntu2 --ip=172.28.244.3 --network ipvlan_l2 ubuntu:local
```

查看容器的 eth0 网口详细信息并测试网络连通性：

```
$ docker exec -it ubuntu1 ip -detail addr show eth0
135: eth0@if2: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UNKNOWN group default
    link/ether 00:15:5d:41:e5:36 brd ff:ff:ff:ff:ff:ff link-netnsid 0 promiscuity 0 minmtu 68 maxmtu 65535
    ipvlan  mode l2 bridge numtxqueues 1 numrxqueues 1 gso_max_size 62780 gso_max_segs 65535
    inet 172.28.244.2/20 brd 172.28.255.255 scope global eth0
       valid_lft forever preferred_lft forever
$ docker exec -it ubuntu2 ip -detail addr show eth0
136: eth0@if2: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UNKNOWN group default
    link/ether 00:15:5d:41:e5:36 brd ff:ff:ff:ff:ff:ff link-netnsid 0 promiscuity 0 minmtu 68 maxmtu 65535
    ipvlan  mode l2 bridge numtxqueues 1 numrxqueues 1 gso_max_size 62780 gso_max_segs 65535
    inet 172.28.244.3/20 brd 172.28.255.255 scope global eth0
       valid_lft forever preferred_lft forever
$ docker exec -it ubuntu2 ping -c 3 172.28.244.2
PING 172.28.244.2 (172.28.244.2) 56(84) bytes of data.
64 bytes from 172.28.244.2: icmp_seq=1 ttl=64 time=0.071 ms
64 bytes from 172.28.244.2: icmp_seq=2 ttl=64 time=0.041 ms
64 bytes from 172.28.244.2: icmp_seq=3 ttl=64 time=0.039 ms

--- 172.28.244.2 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2048ms
rtt min/avg/max/mdev = 0.039/0.050/0.071/0.014 ms
```

清除现场：

```
docker stop ubuntu1 ubuntu2
docker container prune
docker network rm ipvlan_l2 
```

### benchmark

使用 [betperf](https://github.com/HewlettPackard/netperf) 测试工具对容器三种组网方式的性能进行压测，测试机条件：

> `12Core Intel(R) Core(TM) i7-8700 CPU @ 3.20GHz 5.15.146.1-microsoft-standard-WSL2+`

{% tabs 压测 %}

<!-- tab bridge -->

启动 `Server`：

> `docker run -it --rm --name perfserver alectolytic/netperf /usr/bin/netserver -D -p 4444`

启动客户端之前需要知道`Server`的`IP`地址：

```
$ docker run -it --rm --name perfclient alectolytic/netperf netperf -H 172.17.0.3 -p 4444 -t TCP_STREAM -l 60
$ docker run -it --rm --name perfclient alectolytic/netperf netperf -H 172.17.0.3 -p 4444 -t UDP_STREAM -l 60
$ docker run -it --rm --name perfclient alectolytic/netperf netperf -H 172.17.0.3 -p 4444 -t TCP_RR -l 60
$ docker run -it --rm --name perfclient alectolytic/netperf netperf -H 172.17.0.3 -p 4444 -t TCP_CRR -l 60
$ docker run -it --rm --name perfclient alectolytic/netperf netperf -H 172.17.0.3 -p 4444 -t UDP_RR -l 60
```

清理现场：

> `docker stop perfserver`

<!-- endtab -->

<!-- tab macvlan -->

创建网络：

> `docker network create -d macvlan --subnet=172.28.240.0/20 --gateway=172.28.240.1 --ip-range 172.28.244.0/22 --aux-address 'host=172.28.244.254' -o parent=eth0 macvlan`

启动 `Server`：

> `docker run -it --rm --name perfserver --ip=172.28.244.2 --network macvlan alectolytic/netperf /usr/bin/netserver -D -p 4444`

启动客户端测试：

```
$ docker run -it --rm --name perfclient --ip=172.28.244.3 --network macvlan alectolytic/netperf netperf -H 172.28.244.2 -p 4444 -t TCP_STREAM -l 60
$ docker run -it --rm --name perfclient --ip=172.28.244.3 --network macvlan alectolytic/netperf netperf -H 172.28.244.2 -p 4444 -t UDP_STREAM -l 60
$ docker run -it --rm --name perfclient --ip=172.28.244.3 --network macvlan alectolytic/netperf netperf -H 172.28.244.2 -p 4444 -t TCP_RR -l 60
$ docker run -it --rm --name perfclient --ip=172.28.244.3 --network macvlan alectolytic/netperf netperf -H 172.28.244.2 -p 4444 -t TCP_CRR -l 60
$ docker run -it --rm --name perfclient --ip=172.28.244.3 --network macvlan alectolytic/netperf netperf -H 172.28.244.2 -p 4444 -t UDP_RR -l 60
```

清理现场：

> `docker stop perfserver`
> `docker network rm macvlan`

<!-- endtab -->

<!-- tab ipvlan -->

创建网络：

> `docker network create -d ipvlan --subnet=172.28.240.0/20 --gateway=172.28.240.1 --ip-range 172.28.244.0/22 -o parent=eth0 -o ipvlan_mode=l2 ipvlan_l2`

启动 `Server`：

> `docker run -it --rm --name perfserver --ip=172.28.244.2 --network ipvlan_l2 alectolytic/netperf /usr/bin/netserver -D -p 4444`

启动客户端测试：

```
$ docker run -it --rm --name perfclient --ip=172.28.244.3 --network ipvlan_l2 alectolytic/netperf netperf -H 172.28.244.2 -p 4444 -t TCP_STREAM -l 60
$ docker run -it --rm --name perfclient --ip=172.28.244.3 --network ipvlan_l2 alectolytic/netperf netperf -H 172.28.244.2 -p 4444 -t UDP_STREAM -l 60
$ docker run -it --rm --name perfclient --ip=172.28.244.3 --network ipvlan_l2 alectolytic/netperf netperf -H 172.28.244.2 -p 4444 -t TCP_RR -l 60
$ docker run -it --rm --name perfclient --ip=172.28.244.3 --network ipvlan_l2 alectolytic/netperf netperf -H 172.28.244.2 -p 4444 -t TCP_CRR -l 60
$ docker run -it --rm --name perfclient --ip=172.28.244.3 --network ipvlan_l2 alectolytic/netperf netperf -H 172.28.244.2 -p 4444 -t UDP_RR -l 60
```

清理现场：

> `docker stop perfserver`
> `docker network rm ipvlan_l2`

<!-- endtab -->

{% endtabs %}

测试结果如下：

|容器组网方式|TCP_STREAM|UDP_STREAM|TCP_RR|TCP_CRR|UDP_RR|
|:--:|:--:|:--:|:--:|:--:|:--:|
|bridge|14739.80 Mbit/s|6560.40 Mbit/s、6559.54 Mbit/s|14782.62次/s|6819.55次/s|15110.83次/s|
|macvlan（bridge）|21311.05 Mbit/s|9805.24 Mbit/s、9801.57 Mbit/s|16331.71次/s|8798.79次/s|16847.11次/s|
|ipvlan（l2）	  |22691.55 Mbit/s|10500.90 Mbit/s、10488.34 Mbit/s|16573.58次/s|8875.21次/s|17010.19次/s|
|ipvlan（l3）	  |22535.93 Mbit/s|10598.59 Mbit/s、10592.38 Mbit/s|16412.51次/s|9049.53次/s|16898.77次/s|

指标介绍：

1. TCP_STREAM：用来测试进行TCP批量传输时的网络性能，结果表示吞吐量大小；
2. UDP_STREAM：用来测试进行UDP批量传输时的网络性能。UDP_STREAM方式的结果中有两组数据，分别表示客户端发送和服务端接收的能力；												
3. TCP_RR：TCP_RR方式的测试对象是多次TCP request和response的交易过程，但发生在同一个TCP连接中，这种模式常常出现在数据库应用中。数据库的client程序与server程序建立一个TCP连接以后，就在这个连接中传送数据库的多次交易过程；
4. TCP_CRR：TCP_CRR的测试对象是多次TCP request和response的交易过程，但为每次交易建立一个新的TCP连接。最典型的应用就是HTTP，每次HTTP交易是在一条单独的TCP连接中进行的。因此，由于需要不停地建立新的TCP连接，并且在交易结束后拆除TCP连接，交易率一定会受到很大的影响；
5. UDP_RR：使用UDP分组进行request/response的交易过程。由于没有TCP连接所带来的负担，所以相比TCP_RR交易率一定会有相应的提升；									



### 网卡混杂模式

使用如下命令设置：

```
$ ifconfig eth0 promisc
$ 或者
$ ip link set eth0 promisc on
```

取消设置：

```
$ ifconfig eth0 -promisc
$ 或者
$ ip link set eth0 promisc off
```

### 参考链接

1. https://sreeninet.wordpress.com/2016/05/29/macvlan-and-ipvlan/
2. https://wiki.archlinux.org/title/VLAN
3. https://hicu.be/docker-networking-macvlan-vlan-configuration
4. https://blog.oddbit.com/post/2018-03-12-using-docker-macvlan-networks/
5. https://cloud.tencent.com/developer/article/1432601
6. https://kiosk007.top/post/%E4%BD%BF%E7%94%A8open-vswitch%E6%9E%84%E5%BB%BA%E8%99%9A%E6%8B%9F%E7%BD%91%E7%BB%9C/

{% pdf https://events.static.linuxfound.org/sites/events/files/slides/LinuxConJapan2014_makita_0.pdf 800px %}