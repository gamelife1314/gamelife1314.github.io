---
title: Linux 路由表
date: 2023-12-08 16:38:52
tags:
    - 路由表
categories:
    - Linux
---

在学习 Linux 网络相关的知识时或者在定位网络相关的问题中，经常需要使用 `route` 命令查看路由表，本节主要记录该命令的输出及其含义。Linux 系统上一般有3张路由表，可以通过 `ip rule` 命令查看：

```
# ip rule list
0:      from all lookup local
32766:  from all lookup main
32767:  from all lookup default
```

路由表的配置可以通过 `ip route list table {name}` 输出，如果是查看 `main` 表，可以直接使用 `route -n`，例如：

```
root:/mnt/e/github/proto# ip route list table main
default via 172.23.32.1 dev eth0
10.42.0.0/24 dev cni0 proto kernel scope link src 10.42.0.1
172.17.0.0/16 dev docker0 proto kernel scope link src 172.17.0.1 linkdown
172.23.32.0/20 dev eth0 proto kernel scope link src 172.23.45.94
root:/mnt/e/github/proto#
root:/mnt/e/github/proto#
root:/mnt/e/github/proto# route -n
Kernel IP routing table
Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
0.0.0.0         172.23.32.1     0.0.0.0         UG    0      0        0 eth0
10.42.0.0       0.0.0.0         255.255.255.0   U     0      0        0 cni0
172.17.0.0      0.0.0.0         255.255.0.0     U     0      0        0 docker0
172.23.32.0     0.0.0.0         255.255.240.0   U     0      0        0 eth0
10.244.186.193  0.0.0.0         255.255.255.255 UH    0      0        0 cali687d9beb32a
```

各字段主要说明如下：

- `Destination`：目标网络或目标主机；
- `Gateway`：网关，连接两个不同网络的设备；
- `Genmask`：目的地址的子网掩码。`255.255.255.255` 表示目的主机，`0.0.0.0` 表示默认路由，其他情况 `Genmask` 和 `Destination` 组成目标网络；
- `Flags`：标识 `U` 表示路由生效，`G` 表示网关，`H` 表示目标地址是一个主机；
- `Metric`：到目标地址的跳数；
- `Ref`：路由被引用数；
- `Use`: 路由被查询次数；
- `Iface`：接口，去往目的地址所经出口；

对于第一条路由，目标地址 `0.0.0.0`，表示没有明确指定的意思，既默认路由。路由匹配是按照掩码长短从长到端开始匹配，默认路由掩码也是 `0.0.0.0`，表示最后匹配；

对于中间三条路由，`Gateway` 都是 `0.0.0.0`，表示本条路由不经网关，网关是从一个网络进入另一个网络的边缘设备。换句话说，命中网关是 `0.0.0.0` 的报文，它的目标是可能是同一网络下的其它目标地址。这时候走的是二层直连，需要发起 `ARP` 请求换取 `MAC` 地址进行发送。这条路由通常是在网卡上配置 `IP` 时候自动生成的。在网卡上每绑定一个 `IP`，就相应地生成一条这样的记录。可以看到本条路由的 `Flags` 并没有 `G` 标志。

第五条路由，标志为 `H`，掩码是 `255.255.255.255`，表示目标地址是 `10.244.186.193`，直接发往 `cali687d9beb32a`，而这个设备的另一端是容器内的 `eth0`。这种情况也不需要网关，网关为 `0.0.0.0`。