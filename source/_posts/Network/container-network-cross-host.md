---
title: 容器网络-跨主机容器通信
date: 2023-12-12 11:05:38
tags:
    - 容器网络
categories:
    - Linux
---

单机场景下，相同主机上的容器会通过 `Docker` 默认创建的 `veth pair` 设备以及 `docker0` 网桥实现互通。而对于跨主机容器通信，社区提供了很多种不同的方案，例如 [`weave`](https://github.com/weaveworks/weave)、[`flannel`](https://github.com/flannel-io/flannel)，本篇文章将以 `flannel` 为例，实现跨主机容器通信，`flannel` 还有多种后端实现，本篇文章以 `VXLAN` 为例，动手实践。

### 创建虚拟机

首先在本地准备两台单独的虚拟机，并且安装 `docker`，这里我使用 `multipass` 直接创建两台虚拟机 `docker1` 和 `docker2`，命令如下：

> multipass launch --name docker1 -d 40G docker
> multipass launch --name docker2 -d 40G docker

这不仅创建虚拟机，镜像中已经包含 `docker`，无需再手动安装。创建成功如下所示：

    $ multipass list
    Name                    State             IPv4             Image
    docker1                 Running           192.168.65.3     Ubuntu 22.04 LTS
                                              152.156.0.1
    docker2                 Running           192.168.65.4     Ubuntu 22.04 LTS
                                              188.172.0.1

### 安装 etcd

`flannel` 通过 `etcd` 保存配置信息，为了方便测试，通过 `docker` 在 `docker1` 节点上启动一个容器:

> docker run -it --env ALLOW_NONE_AUTHENTICATION=yes -d  --net=host  --name etcd bitnami/etcd

这里的 `--net=host` 让这个容器直接使用 `docker1` 的网络空间，这样 `etcd` 服务在启动之后，直接监听在 `docker1` 上，让 `docker2` 节点也可以访问：

```
root@docker1:/home/ubuntu# netstat -tualnp | grep etcd | grep LISTEN
    tcp        0      0 127.0.0.1:2380          0.0.0.0:*               LISTEN      10147/etcd
    tcp6       0      0 :::2379                 :::*                    LISTEN      10147/etcd
```


随候使用 `etcdctl` 写入基础配置信息，这里我们以 `vxlan` 作为 `flannel` 的后端实现为例（`flannel` 没有在 `Linux ARM` 上实现 `UDP`），`VXLAN（Virtual eXtensible Local Area Network）` 全称是虚拟可扩展局域网，利用它可以通过三层的网络来搭建虚拟的二层网络，是一种 `overlay` 技术：

```
root@docker1:/home/ubuntu# docker exec -itu root etcd bash
root@docker1:/opt/bitnami/etcd#
root@docker1:/opt/bitnami/etcd#
root@docker1:/opt/bitnami/etcd# etcdctl put /coreos.com/network/config '{ "Network": "188.172.0.0/16", "Backend": {"Type": "vxlan"}}'
OK
root@docker1:/opt/bitnami/etcd#
root@docker1:/opt/bitnami/etcd# etcdctl get /coreos.com/network/config
/coreos.com/network/config
{ "Network": "188.172.0.0/16", "Backend": {"Type": "vxlan"}}
root@docker1:/opt/bitnami/etcd#
```




### 参考链接

1. [weave net](https://cloud.tencent.com/developer/article/1027318)
2. [VXLAN 基础教程](https://icloudnative.io/posts/vxlan-linux/)