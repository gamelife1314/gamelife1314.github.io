---
title: 使用kubeadm创建多节点集群
date: 2023-12-17 18:44:12
tags:
    - kubeadm
    - k8s
categories:
    - K8S
---

本篇文章介绍使用 `kubeadm` 创建一个多节点的 `K8S`，使用 `containerd` 作为容器运行时，第一步，首先是准备 `3` 个虚拟机节点，使用 [`multipass`](https://multipass.run/) 创建`3`台虚拟机，该镜像中自带 `docker`，无需再安装，使用如下命令创建：

> multipass launch --name ctrlnode -d 40G docke
> multipass launch --name node1 -d 40G docker
> multipass launch --name node2 -d 40G docker

创建成功之后，如下所示：

```
$ multipass list
Name                    State             IPv4             Image
ctrlnode                Running           192.168.67.6     Ubuntu 22.04 LTS
                                          172.17.0.1
node1                   Running           192.168.67.4     Ubuntu 22.04 LTS
                                          172.17.0.1
node2                   Running           192.168.67.5     Ubuntu 22.04 LTS
                                          172.17.0.1
```

`VM` 版本如下：

```
ubuntu@node2:~$ lsb_release -a
No LSB modules are available.
Distributor ID:	Ubuntu
Description:	Ubuntu 22.04.3 LTS
Release:	22.04
Codename:	jammy
```

<!-- more -->

### 节点配置

在开始之前，三台节点做必要的设置。

#### swap
首先，禁止 `swap`：

> sudo swapoff -a  
> sudo sed -i '/ swap / s/^\(.*\)$/#\1/g' /etc/fstab

#### 防火墙

测试环境，直接关闭防火墙即可：

> sudo ufw disable

#### 桥接流量

转发 `IPv4` 并让 `iptables` 看到桥接流量，这部分内容来源于[这里](https://kubernetes.io/zh-cn/docs/setup/production-environment/container-runtimes/#install-and-configure-prerequisites)：

```
cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF

sudo modprobe overlay
sudo modprobe br_netfilter

# 设置所需的 sysctl 参数，参数在重新启动后保持不变
cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF

# 应用 sysctl 参数而不重新启动
sudo sysctl --system
```

通过运行以下指令确认 `br_netfilter` 和 `overlay` 模块被加载：

```
lsmod | grep br_netfilter
lsmod | grep overlay
```

`br_netfilter`（`Linux` 内核中的一个模块，它主要用于管理网桥设备上的数据包过滤。 此模块允许在网桥设备上使用`Netfilter`（`Linux`内核的防火墙框架）的功能，例如`iptables` 和`nftables`。 它允许对网桥连接的两个网络段之间的数据包进行过滤。）

通过运行以下指令确认 `net.bridge.bridge-nf-call-iptables`、`net.bridge.bridge-nf-call-ip6tables` 和 `net.ipv4.ip_forward` 系统变量在你的 `sysctl` 配置中被设置为 `1`：

> sysctl net.bridge.bridge-nf-call-iptables net.bridge.bridge-nf-call-ip6tables net.ipv4.ip_forward

#### hostname

为各个节点设置合适的名称，并且做域名解析：

>  sudo hostnamectl set-hostname "ctrlnode"
>  sudo hostnamectl set-hostname "node1"
>  sudo hostnamectl set-hostname "node2"

在`3`个节点的 `/etc/hosts` 文件中加入下面的解析条目：

```text /etc/hosts
192.168.67.6 ctrlnode
192.168.67.4 node1
192.168.67.5 node2
```


### containerd

在使用 `multipass`的`docker`模板创建的节点中，`Docker` 默认安装，作为 `Docker` 提供的容器运行时，`continaerd` 也会被安装。不过不管以哪种方式安装 `containerd` 之后，需要进行配置，首先生成默认配置：

```
sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml
```

[配置 `systemd cgroup`](https://kubernetes.io/zh-cn/docs/setup/production-environment/container-runtimes/#containerd-systemd) 驱动，在 /`etc/containerd/config.toml` 中设置：

```
[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc.options]
        ...
        SystemdCgroup = true
```

然后重新启动：

```
sudo systemctl restart containerd
```

如果需要给 `containerd` 设置代理，用于拉取镜像。可以编辑文件 `/etc/systemd/system/containerd.service.d/http-proxy.conf`，加入：

```text
[Service]
Environment="HTTP_PROXY=http://127.0.0.1:65001"
Environment="HTTPS_PROXY=http://127.0.0.1:65001"
```

然后重启：

```
sudo systemctl daemon-reload
sudo systemctl restart containerd
```

设置 `crictl` 的运行时，使用 `containerd`，这部分内容请看[这里](https://github.com/kubernetes-sigs/cri-tools/blob/master/docs/crictl.md)：

```text /etc/crictl.yaml
runtime-endpoint: unix:///var/run/containerd/containerd.sock
image-endpoint: unix:///var/run/containerd/containerd.sock
timeout: 2
debug: false
pull-image-on-create: false
```

### 安装K8S

{% tabs kubernets安装 %}

<!-- tab 官方 -->

这部分的内容来自于[这里](https://kubernetes.io/docs/tasks/tools/install-kubectl-linux/#install-using-native-package-management)：

```shell
# 安装一些必要的工具
sudo apt update
sudo apt-get install -y apt-transport-https ca-certificates curl

# 下载Kubernetes包存储库的公共签名密钥。
curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.29/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg

# 添加某个版本的 `Kubernetes api` 仓库。如果要使用不同于 `v1.29` 的 `Kubernetes` 版本，请将下面的命令中的 `v1.29` 替换为所需的次要版本。
echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.29/deb/ /' | sudo tee /etc/apt/sources.list.d/kubernetes.list

# 更新包索引，然后安装
sudo apt update
sudo apt install -y kubeadm kubelet kubectl
```


<!-- endtab -->

<!-- tab 阿里云 -->

这部分内容来自[这里](https://developer.aliyun.com/mirror/kubernetes?spm=a2c6h.13651102.0.0.70be1b11x53i7b)：

```
apt-get update && apt-get install -y apt-transport-https
curl https://mirrors.aliyun.com/kubernetes/apt/doc/apt-key.gpg | apt-key add - 
cat <<EOF >/etc/apt/sources.list.d/kubernetes.list
deb https://mirrors.aliyun.com/kubernetes/apt/ kubernetes-xenial main
EOF
apt-get update
apt-get install -y kubelet kubeadm kubectl
```

<!-- endtab -->

{% endtabs %}

### 集群初始化

在控制节点上执行下面的命令：

```
sudo kubeadm init --control-plane-endpoint "ctrlnode:6443" --upload-certs --service-cidr=10.96.0.0/12 --pod-network-cidr=10.244.0.0/16
```

执行成功之后，将会得到下面这样的输出：

![kubeadm-success](kubeadm-success.png)

如果要使用普通用户管理集群，可以执行下面的命令：

```shell
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config
```

如果用 `root` 用户使用集群，只需要设置如下的环境变量：

```shell
export KUBECONFIG=/etc/kubernetes/admin.conf
```

在加入新的节点之前，我们需要安装网络插件，这里以 `flannel` 为例：

> kubectl apply -f https://raw.githubusercontent.com/coreos/flannel/master/Documentation/kube-flannel.yml

在控制面节点初始化之后输出了其他 `worker` 节点加入的命令。如果忘记了，可以使用 `kubeadm token create --print-join-command` 重新生成加入命令：

```
root@ctrlnode:/home/ubuntu# kubeadm token create --print-join-command
kubeadm join ctrlnode:6443 --token sm2nmt.8u2z4yqov1w9i8a1 --discovery-token-ca-cert-hash sha256:5de053201e4c9928d9b919c951197626fad17f21edd95651bf5dae89c8dce82f
```

分别在 `ndoe1` 和 `node2` 执行之后，会有如下的输出：

![节点加入](node-join.png)

使用 `kubectl get node` 命令在控制节点上查看节点列表：

```
root@ctrlnode:/home/ubuntu# kubectl get node
NAME       STATUS   ROLES           AGE     VERSION
ctrlnode   Ready    control-plane   56m     v1.29.0
node1      Ready    <none>          5m53s   v1.29.0
node2      Ready    <none>          5m43s   v1.29.0
```

如果节点 `NotReady` 可能是由于网络插件或者 `kuube-proxy` 未启动，等它们就绪之后再去查看节点就 `Ready` 了。在节点上使用 `crictl ps` 查看相关容器是否启动：

```
root@node1:/home/ubuntu# crictl ps
CONTAINER           IMAGE               CREATED             STATE               NAME                ATTEMPT             POD ID              POD
652eb158b1df6       4875a1ba2d23f       3 minutes ago       Running             kube-flannel        0                   a66d1b9ceeefc       kube-flannel-ds-hd9mx
ea8e91242d453       73ab68401f869       5 minutes ago       Running             kube-proxy          0                   e533b68847e99       kube-proxy-97tn4
```

### 参考文章

1. [使用kubeadm部署一套高可用k8s集群 for Ubuntu](https://zahui.fan/posts/526ffc9a/)
2. [Deploy Kubernetes Cluster on Ubuntu 20.04 with Containerd](https://www.hostafrica.ng/blog/kubernetes/kubernetes-ubuntu-20-containerd/)