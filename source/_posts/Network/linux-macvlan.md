---
title: Linux 虚拟网络之MACVLAN
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
docker0: flags=4099<UP,BROADCAST,MULTICAST>  mtu 1500
    inet 172.17.0.1  netmask 255.255.0.0  broadcast 172.17.255.255
    ether 02:42:e1:51:24:cc  txqueuelen 0  (Ethernet)
    RX packets 0  bytes 0 (0.0 B)
    RX errors 0  dropped 0  overruns 0  frame 0
    TX packets 0  bytes 0 (0.0 B)
    TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0
```

而`macvlan` 允许单个物理接口使用`macvlan`子接口拥有多个`MAC`和`IP`地址，每个子接口都将获得唯一的 `MAC` 和 `IP` 地址，并直接暴露在底层网络中。`macvlan` 接口通常用于虚拟化应用，每个 `macvlan` 接口都连接到一个容器或虚拟机。`macvlan` 有`4`种类型（`Private`、`VEPA`、`Bridge`、`Passthru`），常用的类型是 `Bridge`，它允许单个主机中的实体在数据包不离开主机的情况下相互通信。对于外部连接，则使用底层网络，下图显示两个容器使用 `macvlan` 网桥相互通信并与外界通信，两个容器都将使用 `macvlan` 子接口直接接入底层网络。

{% asset_img arch.png %}

<!-- more -->

### `macvlan`示例

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
6: eth0: <BROADCAST,MULTICAST,PROMISC,UP,LOWER_UP> mtu 1500 qdisc mq state UP group default qlen 1000
    link/ether 00:15:5d:21:66:be brd ff:ff:ff:ff:ff:ff
    inet 172.19.106.26/20 brd 172.19.111.255 scope global eth0
       valid_lft forever preferred_lft forever
    inet6 fe80::215:5dff:fe21:66be/64 scope link
       valid_lft forever preferred_lft forever
```

所以，可以将两个 `macvlan` 设备的地址分别设置为 `172.19.111.2` 和 `172.19.111.3`：

```
$ ip netns exec net1 ip addr add 172.19.111.2/20 dev eth0
$ ip netns exec net2 ip addr add 172.19.111.3/20 dev eth0
$ ip netns exec net1 ip link set eth0 up
$ ip netns exec net2 ip link set eth0 up
$ ip netns exec net1 ip -detail link show eth0
137: eth0@if6: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP mode DEFAULT group default qlen 1000
    link/ether e6:43:92:2b:a7:02 brd ff:ff:ff:ff:ff:ff link-netnsid 0 promiscuity 0 minmtu 68 maxmtu 65521
    macvlan mode bridge bcqueuelen 1000 usedbcqueuelen 1000 addrgenmode eui64 numtxqueues 1 numrxqueues 1 gso_max_size 62780 gso_max_segs 65535
$ ip netns exec net2 ip -detail link show eth0
138: eth0@if6: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP mode DEFAULT group default qlen 1000
    link/ether e2:f0:ab:f6:ae:3d brd ff:ff:ff:ff:ff:ff link-netnsid 0 promiscuity 0 minmtu 68 maxmtu 65521
    macvlan mode bridge bcqueuelen 1000 usedbcqueuelen 1000 addrgenmode eui64 numtxqueues 1 numrxqueues 1 gso_max_size 62780 gso_max_segs 65535
$ ip netns exec net1 ip a s eth0
137: eth0@if6: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default qlen 1000
    link/ether e6:43:92:2b:a7:02 brd ff:ff:ff:ff:ff:ff link-netnsid 0
    inet 172.19.111.2/20 scope global eth0
       valid_lft forever preferred_lft forever
    inet6 fe80::e443:92ff:fe2b:a702/64 scope link
       valid_lft forever preferred_lft forever
$ ip netns exec net2 ip a s eth0
138: eth0@if6: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default qlen 1000
    link/ether e2:f0:ab:f6:ae:3d brd ff:ff:ff:ff:ff:ff link-netnsid 0
    inet 172.19.111.3/20 scope global eth0
       valid_lft forever preferred_lft forever
    inet6 fe80::e0f0:abff:fef6:ae3d/64 scope link
       valid_lft forever preferred_lft forever
```

测试网络之间的连通性：

```
$ ip netns exec net2 ping -c 3 172.19.111.2
PING 172.19.111.2 (172.19.111.2) 56(84) bytes of data.
64 bytes from 172.19.111.2: icmp_seq=1 ttl=64 time=0.044 ms
64 bytes from 172.19.111.2: icmp_seq=2 ttl=64 time=0.023 ms
64 bytes from 172.19.111.2: icmp_seq=3 ttl=64 time=0.021 ms

--- 172.19.111.2 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2054ms
rtt min/avg/max/mdev = 0.021/0.029/0.044/0.010 ms
$ ip netns exec net1 ping -c 3 172.19.111.3
PING 172.19.111.3 (172.19.111.3) 56(84) bytes of data.
64 bytes from 172.19.111.3: icmp_seq=1 ttl=64 time=0.026 ms
64 bytes from 172.19.111.3: icmp_seq=2 ttl=64 time=0.022 ms
64 bytes from 172.19.111.3: icmp_seq=3 ttl=64 time=0.024 ms

--- 172.19.111.3 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2093ms
rtt min/avg/max/mdev = 0.022/0.024/0.026/0.001 ms
```

清理测试现场使用：

> `ip netns delete net1`
> `ip netns delete net2`

### `Docker Macvlan` 网络

`docker` 默认的容器网络实现方式是通过`docker0`网桥将容器都连接起来，实现容器之间的互通，也可以通过 `macvlan` 实现容器网络。首先在 `docker` 中需要创建基于 `macvlan` 的网络：

```
$ docker network create -d macvlan --subnet=172.19.108.0/22 --gateway=172.19.108.1 -o parent=eth0 macvlan
$ docker network ls
NETWORK ID     NAME      DRIVER    SCOPE
6fce98cf8895   bridge    bridge    local
4c4d1126194d   host      host      local
f46f08bb4d34   macvlan   macvlan   local
4b9479cf26f5   none      null      local
```

依然要注意的是这里的子网 `172.19.108.0/22` 必须和 `eth0` 同属一个网络内，或者必须是它的子集，`eth0` 的网络是 `172.19.96.0/20`。通过指定 `ip` 的方式创建两个容器，镜像 `ubuntu:local` 是本地构建的添加了很多网络测试工具：

> `docker run -itd --name ubuntu1 --ip=172.19.108.2 --network macvlan ubuntu:local`
> `docker run -itd --name ubuntu1 --ip=172.19.108.2 --network macvlan ubuntu:local`

查看容器的 `eth0` 网口详细信息并测试网络连通性：

```
$ docker exec -it ubuntu1 ip -detail addr show eth0
139: eth0@if6: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default
    link/ether 02:42:ac:13:6c:02 brd ff:ff:ff:ff:ff:ff link-netnsid 0 promiscuity 0 minmtu 68 maxmtu 65521
    macvlan mode bridge bcqueuelen 1000 usedbcqueuelen 1000 numtxqueues 1 numrxqueues 1 gso_max_size 62780 gso_max_segs 65535
    inet 172.19.108.2/22 brd 172.19.111.255 scope global eth0
       valid_lft forever preferred_lft forever
$ docker exec -it ubuntu2 ip -detail addr show eth0
140: eth0@if6: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default
    link/ether 02:42:ac:13:6c:03 brd ff:ff:ff:ff:ff:ff link-netnsid 0 promiscuity 0 minmtu 68 maxmtu 65521
    macvlan mode bridge bcqueuelen 1000 usedbcqueuelen 1000 numtxqueues 1 numrxqueues 1 gso_max_size 62780 gso_max_segs 65535
    inet 172.19.108.3/22 brd 172.19.111.255 scope global eth0
       valid_lft forever preferred_lft forever
$ docker exec -it ubuntu2 ping -c 3 172.19.108.2
PING 172.19.108.2 (172.19.108.2) 56(84) bytes of data.
64 bytes from 172.19.108.2: icmp_seq=1 ttl=64 time=0.031 ms
64 bytes from 172.19.108.2: icmp_seq=2 ttl=64 time=0.028 ms
64 bytes from 172.19.108.2: icmp_seq=3 ttl=64 time=0.028 ms

--- 172.19.108.2 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2097ms
rtt min/avg/max/mdev = 0.028/0.029/0.031/0.001 ms
```

#### 单主机多`Macvalan`网络

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

创建 `VLAN`，设置`IP`，并启用，如果对网络地址、子网、广播地址不会计算，可以点击[这里](https://tool.chinaz.com/tools/subnetmask)：

```
$ ip link add link eth0 name eth0.10 type vlan id 10
$ ip link add link eth0 name eth0.20 type vlan id 20 
$ ip addr add 172.19.108.1/22 brd 172.19.111.255 dev eth0.10
$ ip addr add 172.19.104.1/22 brd 172.19.107.255 dev eth0.20
$ ip link set dev eth0.10 up
$ ip link set dev eth0.20 up
$ ip -d a s eth0.10
144: eth0.10@eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default qlen 1000
    link/ether 00:15:5d:21:66:be brd ff:ff:ff:ff:ff:ff promiscuity 0 minmtu 0 maxmtu 65535
    vlan protocol 802.1Q id 10 <REORDER_HDR> numtxqueues 1 numrxqueues 1 gso_max_size 62780 gso_max_segs 65535
    inet 172.19.108.1/22 brd 172.19.111.255 scope global eth0.10
       valid_lft forever preferred_lft forever
    inet6 fe80::215:5dff:fe21:66be/64 scope link
       valid_lft forever preferred_lft forever
$ ip -d a s eth0.20
145: eth0.20@eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default qlen 1000
    link/ether 00:15:5d:21:66:be brd ff:ff:ff:ff:ff:ff promiscuity 0 minmtu 0 maxmtu 65535
    vlan protocol 802.1Q id 20 <REORDER_HDR> numtxqueues 1 numrxqueues 1 gso_max_size 62780 gso_max_segs 65535
    inet 172.19.104.1/22 brd 172.19.107.255 scope global eth0.20
       valid_lft forever preferred_lft forever
    inet6 fe80::215:5dff:fe21:66be/64 scope link
       valid_lft forever preferred_lft forever
```

然后创建两个 `Docker macvlan` 网络，这里基于的是创建的 `VLAN`，不再是 `eth0`：

```
$ docker network create -d macvlan --subnet=172.19.108.0/22 --gateway=172.19.108.1 -o parent=eth0.10 macvlan1-net
$ docker network create -d macvlan --subnet=172.19.104.0/22 --gateway=172.19.104.1 -o parent=eth0.20 macvlan2-net
$ docker network ls
NETWORK ID     NAME           DRIVER    SCOPE
6fce98cf8895   bridge         bridge    local
4c4d1126194d   host           host      local
e759632b99bd   macvlan1-net   macvlan   local
0c1a286532ef   macvlan2-net   macvlan   local
4b9479cf26f5   none           null      local 
```

基于两个不同的 `macvlan` 网络创建两个容器，发现他们之间并不互通，因为它们处于不同的 `vlan`：

```
$ docker run -itd --name ubuntu1 --ip=172.19.108.2 --network macvlan1-net ubuntu:local
$ docker run -itd --name ubuntu2 --ip=172.19.104.2 --network macvlan2-net ubuntu:local
$ docker exec -it ubuntu1 ip -d addr show eth0
148: eth0@if144: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default
    link/ether 02:42:ac:13:6c:02 brd ff:ff:ff:ff:ff:ff link-netnsid 0 promiscuity 0 minmtu 68 maxmtu 65535
    macvlan mode bridge bcqueuelen 1000 usedbcqueuelen 1000 numtxqueues 1 numrxqueues 1 gso_max_size 62780 gso_max_segs 65535
    inet 172.19.108.2/22 brd 172.19.111.255 scope global eth0
       valid_lft forever preferred_lft forever
$ docker exec -it ubuntu2 ip -d addr show eth0
149: eth0@if145: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default
    link/ether 02:42:ac:13:68:02 brd ff:ff:ff:ff:ff:ff link-netnsid 0 promiscuity 0 minmtu 68 maxmtu 65535
    macvlan mode bridge bcqueuelen 1000 usedbcqueuelen 1000 numtxqueues 1 numrxqueues 1 gso_max_size 62780 gso_max_segs 65535
    inet 172.19.104.2/22 brd 172.19.107.255 scope global eth0
       valid_lft forever preferred_lft forever
$ docker exec -it ubuntu1 ping -c 3 172.19.104.2
PING 172.19.104.2 (172.19.104.2) 56(84) bytes of data.
From 172.19.108.2 icmp_seq=1 Destination Host Unreachable
From 172.19.108.2 icmp_seq=2 Destination Host Unreachable
From 172.19.108.2 icmp_seq=3 Destination Host Unreachable

--- 172.19.104.2 ping statistics ---
3 packets transmitted, 0 received, +3 errors, 100% packet loss, time 2115ms
```

相同 `vlan` 之间的网络连通正常：

```
$ docker run -itd --name ubuntu3 --ip=172.19.108.3 --network macvlan1-net ubuntu:local
$ docker exec -it ubuntu1 ping -c 3 172.19.108.3
PING 172.19.108.3 (172.19.108.3) 56(84) bytes of data.
64 bytes from 172.19.108.3: icmp_seq=1 ttl=64 time=0.050 ms
64 bytes from 172.19.108.3: icmp_seq=2 ttl=64 time=0.034 ms
64 bytes from 172.19.108.3: icmp_seq=3 ttl=64 time=0.027 ms

--- 172.19.108.3 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2113ms
rtt min/avg/max/mdev = 0.027/0.037/0.050/0.009 m
```


### 参考链接

1. https://sreeninet.wordpress.com/2016/05/29/macvlan-and-ipvlan/
2. https://wiki.archlinux.org/title/VLAN
3. https://hicu.be/docker-networking-macvlan-vlan-configuration
4. https://blog.oddbit.com/post/2018-03-12-using-docker-macvlan-networks/