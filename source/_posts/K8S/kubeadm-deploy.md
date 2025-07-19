---
title: 使用kubeadm创建多节点集群
date: 2023-12-17 18:44:12
tags:
    - kubeadm
    - 集群部署
categories:
    - k8s
---

本篇文章介绍使用 `kubeadm` 创建一个多节点的 `K8S`，使用 `containerd` 作为容器运行时，第一步，首先是准备 `3` 个虚拟机节点，使用 [`multipass`](https://multipass.run/) 创建`3`台虚拟机，该镜像中自带 `docker`，无需再安装，使用如下命令创建：

> multipass launch --name ctrlnode -d 40G docker
> multipass launch --name node1 -d 40G docker
> multipass launch --name node2 -d 40G docker

每个节点至少`2GB`内存，`2`个CPU，具体要求请看[这里](https://kubernetes.io/zh-cn/docs/setup/production-environment/tools/kubeadm/install-kubeadm/#%E5%87%86%E5%A4%87%E5%BC%80%E5%A7%8B)。创建成功之后，如下所示：

```
$ multipass list
Name                    State             IPv4             Image
ctrlnode                Running           192.168.67.8     Ubuntu 22.04 LTS
                                          172.17.0.1
node1                   Running           192.168.67.10    Ubuntu 22.04 LTS
                                          172.17.0.1
node2                   Running           192.168.67.9     Ubuntu 22.04 LTS
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

> `sudo swapoff -a`  
> `sudo sed -i '/ swap / s/^\(.*\)$/#\1/g' /etc/fstab`

#### 防火墙

测试环境，直接关闭防火墙即可（`Ubuntu`）：

> `sudo ufw disable`

#### 桥接流量

转发 `IPv4` 并让 `iptables` 看到桥接流量，这部分内容来源于[这里](https://kubernetes.io/zh-cn/docs/setup/production-environment/container-runtimes/#install-and-configure-prerequisites)：

```
$ cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF

$ sudo modprobe overlay
$ sudo modprobe br_netfilter

# 设置所需的 sysctl 参数，参数在重新启动后保持不变
$ cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF

# 应用 sysctl 参数而不重新启动
$ sudo sysctl --system
```

通过运行以下指令确认 `br_netfilter` 和 `overlay` 模块被加载：

```
$ lsmod | grep br_netfilter
$ lsmod | grep overlay
```

`br_netfilter`（`Linux` 内核中的一个模块，它主要用于管理网桥设备上的数据包过滤。 此模块允许在网桥设备上使用`Netfilter`（`Linux`内核的防火墙框架）的功能，例如`iptables` 和`nftables`。 它允许对网桥连接的两个网络段之间的数据包进行过滤。）

通过运行以下指令确认 `net.bridge.bridge-nf-call-iptables`、`net.bridge.bridge-nf-call-ip6tables` 和 `net.ipv4.ip_forward` 系统变量在你的 `sysctl` 配置中被设置为 `1`：

> `sysctl net.bridge.bridge-nf-call-iptables net.bridge.bridge-nf-call-ip6tables net.ipv4.ip_forward`

#### hostname

为各个节点设置合适的名称，并且做域名解析：

> `sudo hostnamectl set-hostname "ctrlnode"`
> `sudo hostnamectl set-hostname "node1"`
> `sudo hostnamectl set-hostname "node2"`

在`3`个节点的 `/etc/hosts` 文件中加入下面的解析条目：

```text /etc/hosts
192.168.67.8 ctrlnode
192.168.67.10 node1
192.168.67.9 node2
```

### containerd

这里选用 `containerd` 作为容器运行时，更多的容器运行时看[这里](https://kubernetes.io/zh-cn/docs/setup/production-environment/container-runtimes/)。在使用 `multipass` 的 `docker` 模板创建的节点中，`Docker` 默认安装，作为 `Docker` 的一部分，`continaerd` 也会被安装。不过不管以哪种方式安装 `containerd` 之后，需要稍作配置，第一步生成默认配置：

```
# sudo mkdir -p /etc/containerd
# containerd config default | sudo tee /etc/containerd/config.toml
```

[配置cgroup驱动](https://kubernetes.io/zh-cn/docs/setup/production-environment/container-runtimes/#containerd-systemd) 驱动，在 `/etc/containerd/config.toml` 中设置：

```
[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc.options]
        ...
        SystemdCgroup = true
```

然后重新启动：

```
sudo systemctl restart containerd
```

如果需要给 `containerd` 设置代理，用于拉取镜像。可以编辑文件 `/etc/systemd/system/containerd.service.d/http-proxy.conf`，加入自己的代理信息：

```text
[Service]
Environment="HTTP_PROXY=http://192.168.3.119:1087"
Environment="HTTPS_PROXY=http://192.168.3.119:1087"
```

然后重启：

```
sudo systemctl daemon-reload
sudo systemctl restart containerd
```

设置 `crictl` 的运行时，使用 `containerd`，官方文档请看[这里](https://github.com/kubernetes-sigs/cri-tools/blob/master/docs/crictl.md)：

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

官方安装请看[这里](https://kubernetes.io/zh-cn/docs/tasks/tools/install-kubectl-linux/#install-using-native-package-management)：

```shell
# 安装一些必要的工具
sudo apt update
sudo apt-get install -y apt-transport-https ca-certificates curl

# 下载Kubernetes包存储库的公共签名密钥。
curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.28/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg

# 添加某个版本的 `Kubernetes api` 仓库。如果要使用不同于 `v1.28` 的 `Kubernetes` 版本，请将下面的命令中的 `v1.28` 替换为所需的次要版本。
echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.28/deb/ /' | sudo tee /etc/apt/sources.list.d/kubernetes.list

# 更新包索引
sudo apt update
```

查看`k8s`可用版本：

> sudo apt-cache madison kubeadm

```
root@ctrlnode:/home/ubuntu# sudo apt-cache madison kubeadm
   kubeadm | 1.28.5-1.1 | https://pkgs.k8s.io/core:/stable:/v1.28/deb  Packages
   kubeadm | 1.28.4-1.1 | https://pkgs.k8s.io/core:/stable:/v1.28/deb  Packages
   kubeadm | 1.28.3-1.1 | https://pkgs.k8s.io/core:/stable:/v1.28/deb  Packages
   kubeadm | 1.28.2-1.1 | https://pkgs.k8s.io/core:/stable:/v1.28/deb  Packages
   kubeadm | 1.28.1-1.1 | https://pkgs.k8s.io/core:/stable:/v1.28/deb  Packages
   kubeadm | 1.28.0-1.1 | https://pkgs.k8s.io/core:/stable:/v1.28/deb  Packages
```

安装指定版本：

> sudo apt install -y kubeadm=1.28.5-1.1 kubelet=1.28.5-1.1 kubectl=1.28.5-1.1

锁定版本，不随 `apt upgrade` 更新：

> sudo apt-mark hold kubelet kubeadm kubectl

<!-- endtab -->

<!-- tab 阿里云 -->

国内安装请看[这里](https://developer.aliyun.com/mirror/kubernetes?spm=a2c6h.13651102.0.0.70be1b11x53i7b)：

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

每个节点上的`kubelet`会选择一个容器运行时用于`Pod`管理，可以使用下面的命令进行查看：

![](kubelet-status.png)

### 集群初始化

在集群初始化之前，我们可以先使用下面的命令在控制节点预先拉取镜像：

> `kubeadm config images pull --kubernetes-version 1.28.5`

```
root@ctrlnode:/home/ubuntu# kubeadm config images pull --kubernetes-version 1.28.5
[config/images] Pulled registry.k8s.io/kube-apiserver:v1.28.5
[config/images] Pulled registry.k8s.io/kube-controller-manager:v1.28.5
[config/images] Pulled registry.k8s.io/kube-scheduler:v1.28.5
[config/images] Pulled registry.k8s.io/kube-proxy:v1.28.5
[config/images] Pulled registry.k8s.io/pause:3.9
[config/images] Pulled registry.k8s.io/etcd:3.5.9-0
[config/images] Pulled registry.k8s.io/coredns/coredns:v1.10.1
```

在控制节点上执行下面的命令，`kubeadm` 的使用文档请看[这里](https://kubernetes.io/zh-cn/docs/reference/setup-tools/kubeadm/)：

```
sudo kubeadm init --control-plane-endpoint "ctrlnode:6443" --upload-certs --service-cidr=10.96.0.0/12 --pod-network-cidr=10.244.0.0/16 --kubernetes-version 1.28.5 
```

`init` 会执行一系列的检查，例如内核版本版本是否满足要求（3.10及以上），Cgroups模块是否启用，是否安装容器运行时，`ip`、`mount` 这样的工具是否安装，`Kubernetes`的工作端口`10250/10251/10252`端口是不是已经被占用等等，完整的工作流程请看[这里](https://kubernetes.io/zh-cn/docs/reference/setup-tools/kubeadm/kubeadm-init/#init-workflow)。执行成功之后，将会得到下面这样的输出：

![kubeadm-success](kubeadm-success.png)

如果要使用普通用户管理集群，需要执行下面的命令为普通用户创建`kubectl`命令运行所需要的配置：

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

> `kubectl apply -f https://raw.githubusercontent.com/coreos/flannel/master/Documentation/kube-flannel.yml`

在控制面节点初始化之后输出了其他 `worker` 节点加入的命令。如果忘记了，可以使用 `kubeadm token create --print-join-command` 重新生成加入命令：

```
root@ctrlnode:/home/ubuntu# kubeadm token create --print-join-command
kubeadm join ctrlnode:6443 --token sm2nmt.8u2z4yqov1w9i8a1 --discovery-token-ca-cert-hash sha256:5de053201e4c9928d9b919c951197626fad17f21edd95651bf5dae89c8dce82f
```

分别在 `ndoe1` 和 `node2` 执行之后，会有如下的输出：

![节点加入](node-join.png)

使用 `kubectl get node` 命令在控制节点上查看节点列表：

```
root@ctrlnode:/home/ubuntu# kubectl get nodes -owide
NAME       STATUS   ROLES           AGE     VERSION   INTERNAL-IP     EXTERNAL-IP   OS-IMAGE             KERNEL-VERSION      CONTAINER-RUNTIME
ctrlnode   Ready    control-plane   12m     v1.28.5   192.168.67.8    <none>        Ubuntu 22.04.3 LTS   5.15.0-91-generic   containerd://1.6.26
node1      Ready    <none>          5m49s   v1.28.5   192.168.67.10   <none>        Ubuntu 22.04.3 LTS   5.15.0-91-generic   containerd://1.6.26
node2      Ready    <none>          5m38s   v1.28.5   192.168.67.9    <none>        Ubuntu 22.04.3 LTS   5.15.0-91-generic   containerd://1.6.26
```

如果节点 `NotReady` 可能是由于网络插件或者 `kube-proxy` 未启动，等它们就绪之后再去查看节点就 `Ready` 了。在节点上使用 `crictl ps` 查看相关容器是否启动：

```
root@node1:/home/ubuntu# crictl ps
CONTAINER           IMAGE               CREATED             STATE               NAME                ATTEMPT             POD ID              POD
652eb158b1df6       4875a1ba2d23f       3 minutes ago       Running             kube-flannel        0                   a66d1b9ceeefc       kube-flannel-ds-hd9mx
ea8e91242d453       73ab68401f869       5 minutes ago       Running             kube-proxy          0                   e533b68847e99       kube-proxy-97tn4
```

默认情况下，`control-plane` 所在节点被设置成了[污点（Taint）](https://kubernetes.io/zh-cn/docs/concepts/scheduling-eviction/taint-and-toleration/)，不允许 `Pod` 调度到这类节点，例如:

> kubectl describe  node ctrlnode

![污点node](taint-node.png)

测试环境中，可以使用下面的[命令](https://kubernetes.io/zh-cn/docs/reference/labels-annotations-taints/#node-role-kubernetes-io-control-plane-taint)清除污点，以便让 `Pod` 被允许调度到此类节点：

> kubectl taint nodes ctrlnode node-role.kubernetes.io/control-plane:NoSchedule-

![删除污点](unset-taint.png)

可以通过下面的命令给节点设置角色，例如，给 `node1` 和 `node2` 设置 `worker` 角色：

> kubectl label node node1 node-role.kubernetes.io/worker=worker
> kubectl label node node2 node-role.kubernetes.io/worker=worker

![worker节点](worke-node.png)

### 部署应用

为了测试集群的可用性，部署一个 `Deployment` 测试，这里使用官方的[无状态应用示例](https://kubernetes.io/zh-cn/docs/tasks/run-application/run-stateless-application-deployment/)，并且将其扩展为`3`个`Pod`：

> kubectl apply -f https://k8s.io/examples/application/deployment-update.yaml
> 
> kubectl scale --current-replicas=2 --replicas=3 deployment/nginx-deployment

等待部署成功，查看：

![nginx pod](nginx-pod-3.png)

可以使用如下的命令查看 `pod` 中有哪些容器：

> kubectl get pods nginx-deployment-848dd6cfb5-2gvg9 -o jsonpath={.spec.containers[*].name}

使用如下的命令进入 `pod` 的容器中：

> kubectl exec nginx-deployment-848dd6cfb5-2gvg9 -n default  -it -c nginx -- /bin/bash

![进入pod中的容器](exec-container.png)

### Dashboard

[`Dashboard`](https://kubernetes.io/zh-cn/docs/tasks/access-application-cluster/web-ui-dashboard/) 是基于网页的 `Kubernetes` 用户界面，可以使用 `Dashboard` 将容器应用部署到 `Kubernetes` 集群中，也可以对容器应用排错，还能管理集群资源，同时也展示了 `Kubernetes` 集群中的资源状态信息和所有报错信息。

执行下面的命令安装 `Dashboard`：

> kubectl apply -f https://raw.githubusercontent.com/kubernetes/dashboard/v2.7.0/aio/deploy/recommended.yaml

执行成功之后，你将会看到如下的输出：

![部署dashboard](deploy-dashbord.png)

等待`pod` 启动成功之后，执行如下命令，将会看到创建成功的服务：

> kubectl get svc -n kubernetes-dashboard

```
root@ctrlnode:/home/ubuntu# kubectl get svc -n kubernetes-dashboard
NAME                        TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)    AGE
dashboard-metrics-scraper   ClusterIP   10.105.70.85     <none>        8000/TCP   65s
kubernetes-dashboard        ClusterIP   10.109.106.107   <none>        443/TCP    65s
```

默认创建的服务是 `ClusterIP` 类型，没法通过集群外部进行访问，通过相面的命令将它修改为 `NodePort` 类型的：

> kubectl edit svc -n kubernetes-dashboard kubernetes-dashboard

修改内容为，将 `spec.type` 从 `ClusterIP` 修改为 `NodePort`。修改成功之后，再次查看服务，类型更新为 `NodePort`，也分配了随机的节点端口 `32688`：

```
root@ctrlnode:/home/ubuntu# kubectl get svc -n kubernetes-dashboard
NAME                        TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)         AGE
dashboard-metrics-scraper   ClusterIP   10.105.70.85     <none>        8000/TCP        113s
kubernetes-dashboard        NodePort    10.109.106.107   <none>        443:30175/TCP   113s
```

使用 `ctrlnode` 的节点访问 `https://192.168.67.6:30175/`，登录页面打开，我们使用 `Token` 进行访问，使用下面的命令生成 `Token`：

>  kubectl create token kubernetes-dashboard -n kubernetes-dashboard

![dashboard-login](dashboard-login.png)

但是默认创建的 `kubernetes-dashboard` 只能访问 `default` 命名空间的服务，权限太小了。我们可以手创建新的 `ServiceAccount`，并且给它绑定 `cluster-admin` 这个角色：

> kubectl create serviceaccount cluster-admin-dashboard -n kubernetes-dashboard

创建成功之后，使用如下的命令查看创建的 `ServiceAccount`：

> kubectl get serviceaccount -n kubernetes-dashboard

```
root@ctrlnode:/home/ubuntu# kubectl get serviceaccount -n kubernetes-dashboard
NAME                      SECRETS   AGE
cluster-admin-dashboard   0         19s
default                   0         7m44s
kubernetes-dashboard      0         7m44s
```

然后给它绑定 `cluster-admin` 这个角色:

```
kubectl create clusterrolebinding cluster-admin-dashboard --clusterrole=cluster-admin \
    --serviceaccount=kubernetes-dashboard:cluster-admin-dashboard \
    -n kubernetes-dashboard
```

使用下面的命令重新生成 `Token`：

>  kubectl create token cluster-admin-dashboard -n kubernetes-dashboard

退出使用新的`Token`重新登录之后，就可以看到所有的命名空间下的资源了：

![Dashboard部署成功](dashboard-success.png)

### 参考文章

1. [使用kubeadm部署一套高可用k8s集群 for Ubuntu](https://zahui.fan/posts/526ffc9a/)
2. [Deploy Kubernetes Cluster on Ubuntu 20.04 with Containerd](https://www.hostafrica.ng/blog/kubernetes/kubernetes-ubuntu-20-containerd/)
3. [Kubernetes Service Discovery](https://www.densify.com/kubernetes-autoscaling/kubernetes-service-discovery/)
4. [iptables — a comprehensive guide](https://sudamtm.medium.com/iptables-a-comprehensive-guide-276b8604eff1)
5. [A Deep Dive into Iptables and Netfilter Architecture](https://www.digitalocean.com/community/tutorials/a-deep-dive-into-iptables-and-netfilter-architecture)
6. [Kubernetes Service iptables 网络通信验证](https://lotabout.me/2022/Kubernetes-Service-Model-Verification/)
7. [Docker Overlay2 Cleanup: 5 Ways to Reclaim Disk Space](https://www.virtualizationhowto.com/2023/11/docker-overlay2-cleanup-5-ways-to-reclaim-disk-space/)
8. [Use the OverlayFS storage driver](https://docs.docker.com/storage/storagedriver/overlayfs-driver/)
9. [Details of the Kubernetes Cluster Network](https://www.alibabacloud.com/blog/from-confused-to-proficient-details-of-the-kubernetes-cluster-network_595656)