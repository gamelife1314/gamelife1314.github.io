---
title: Kubernetes Service
date: 2024-01-02 16:34:43
tags:
    - Service
    - NodePort
    - Loadblance
    - ExternalName
categories:
    - k8s
---

`Service`是`Kubernetes`中的资源类型，用来将一组`Pod`的应用作为网络服务公开。虽然每个`Pod`都有自己的`IP`，但是这个`IP`的生命周期与`Pod`生命周期一致，也就是说`Pod`销毁后这个`IP`也就无效了，而`Service`的`IP（ClusterIP）` 则是在创建之后便不会改变，`Service` 与 `Pod` 之前通过`iptables`和`ipvs`代理等手段关联。`k8s`一共提供了四种不同目的类型的`Service`，分别是`ClusterIP`、`NodePort`、`LoadBalancer`以及`ExternalName`，本来我们就来探索这四种服务的使用场景以及背后的使用原理。

`k8s` 集群中的每个节点都是运行一个[kube-proxy](https://kubernetes.io/zh-cn/docs/reference/networking/virtual-ips/)，它用于实现流量从`Service`到`Pod`之间的转发。默认在 `Linux` 平台下，它使用 `iptables` 作为后端实现，通过监听`Kubernetes`控制平面，获知对 `Service`和`EndpointSlice`对象的添加和删除操作，对于每个`Service`，`kube-proxy` 会添加 `iptables` 规则，在这些这些规则的加持下，流向`Service`的流量会被重新路由到`Service`后端集合中的其中之一。

<!-- more -->

### 准备工作

为了验证这里面是如何工作的，我们先创建`Pod`，`Service`，然后一步步分析`k8s`和操作系统互相配合，是如何将数据包转发到对应`Pod`里面的服务中去。第一步，我这里有三个可用节点，所以创建一个具有`3`个`Pod`的`nginx-deployment`：

> `kubectl apply -f https://k8s.io/examples/application/deployment-update.yaml`
> `kubectl scale --current-replicas=2 --replicas=3 deployment/nginx-deployment`

![](nginx-deployment-create.png)

然后我们使用下面的命令创建两个不同类型的`Service`：`ClusterIP`和`NodePort`，`NodePort`和`ClusterIP`不同的是，我们可以从集群外访问我们的服务：

> `kubectl expose deploy nginx-deployment --port=8080 --target-port=80 --type=ClusterIP --name=nginx-deploy-clusterip-svc`
> `kubectl expose deploy nginx-deployment --port=8081 --target-port=80 --type=NodePort --name=nginx-deploy-nodeport-svc`

![](nginx-service-create.png)

这两个两服务对应的后端`Pod`集合是完全相同的：

```
root@ctrlnode:/home/ubuntu# kubectl get ep
NAME                         ENDPOINTS                                   AGE
kubernetes                   192.168.67.8:6443                           25m
nginx-deploy-clusterip-svc   10.244.0.4:80,10.244.1.2:80,10.244.2.2:80   103s
nginx-deploy-nodeport-svc    10.244.0.4:80,10.244.1.2:80,10.244.2.2:80   7m24s
root@ctrlnode:/home/ubuntu#
```

然后使用如下的命令创建一个`Pod`并且进入容器内进行验证：

> `kubectl run mytools -it --rm --image=praqma/network-multitool --image-pull-policy=IfNotPresent --command -- /bin/bash`

![](mytools-create.png)

在这个`Pod`中，可以使用`curl` 命令访问我们的服务，分别是 `10.105.145.136:8080` 和 `10.102.231.147:8081`。

### DNS

`k8s`集群创建的时候会创建一个`kube-dns`服务，用于对`Service`进行域名解析，每个`Service`都会被被自动分配一个 `<svc>.<namespace>.svc.<cluster-domain>` 格式的域名，在每个`Pod`中，也会存在关于域名解析的配置：

![](pod-dns-config.png)

这个文件中配置了多个`search`域，所以当我们写`nginx-deploy-clusterip-svc`、或者`nginx-deploy-clusterip-svc.default`，或者`nginx-deploy-clusterip-svc.default.svc`都是可以解析的：

![](nslookup-nginx-svc.png)

`ndots:5` 指的是如果域名中的`.`大于等于`5`个，则不走`search`域，目的是减少常规域名的解析次数。

### ClusterIP

我们来看当我们从`mytools`这个`Pod`访问我们的`nginx-deploy-clusterip-svc`时，它是怎么样一个过程：

![](mytools-curl-clusterip-svc.png)

`mytools`被调度了`node2`上：

```
root@ctrlnode:/home/ubuntu# kubectl get pods -owide
NAME                                READY   STATUS    RESTARTS   AGE     IP           NODE       NOMINATED NODE   READINESS GATES
mytools                             1/1     Running   0          4m15s   10.244.2.3   node2      <none>           <none>
nginx-deployment-848dd6cfb5-c9cm6   1/1     Running   0          17m     10.244.1.2   node1      <none>           <none>
nginx-deployment-848dd6cfb5-h48dk   1/1     Running   0          17m     10.244.2.2   node2      <none>           <none>
nginx-deployment-848dd6cfb5-zbvj5   1/1     Running   0          17m     10.244.0.4   ctrlnode   <none>           <none>
root@ctrlnode:/home/ubuntu#
```

从容器中发出去的报文出现在主机上时，一看系统的路由，也不知道如何处理，没有处理 `10.109.146.68` 的路由信息：

```
root@node2:/home/ubuntu# route -n
Kernel IP routing table
Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
0.0.0.0         192.168.67.1    0.0.0.0         UG    100    0        0 enp0s1
10.244.0.0      10.244.0.0      255.255.255.0   UG    0      0        0 flannel.1
10.244.1.0      10.244.1.0      255.255.255.0   UG    0      0        0 flannel.1
10.244.2.0      0.0.0.0         255.255.255.0   U     0      0        0 cni0
172.17.0.0      0.0.0.0         255.255.0.0     U     0      0        0 docker0
192.168.67.0    0.0.0.0         255.255.255.0   U     100    0        0 enp0s1
192.168.67.1    0.0.0.0         255.255.255.255 UH    100    0        0 enp0s1
```

所以就会流入默认网口`enp0s1`进行处理，按照我们对`iptables`的处理流程，这个包在处理之前会先触发`NF_INET_PRE_ROUTING`中的一系列钩子函数，对应于 `iptables` 中的 `PREROUTING` 链，而对于路由相关的信息都是在`nat`表中处理的，所以我们先来看下`nat`表中`PREROUTING`链的规则：

```shell
root@node2:/home/ubuntu# iptables -t nat -L PREROUTING | column -t
Chain          PREROUTING  (policy  ACCEPT)
target         prot        opt      source    destination
KUBE-SERVICES  all         --       anywhere  anywhere     /*        kubernetes  service   portals  */
DOCKER         all         --       anywhere  anywhere     ADDRTYPE  match       dst-type  LOCAL
root@node2:/home/ubuntu#
```

在`PREROUTING`找了`K8S`自定义的链`KUBE-SERVICES`，这个链中存储的是关于`Service`的一些规则：

```
root@node2:/home/ubuntu# iptables -t nat -L KUBE-SERVICES | column -t
Chain                      KUBE-SERVICES  (2   references)
target                     prot           opt  source       destination
KUBE-SVC-NPX46M4PTMTKRN6Y  tcp            --   anywhere     10.96.0.1       /*  default/kubernetes:https            cluster  IP          */     tcp   dpt:https
KUBE-SVC-TCOU7JCQXEZGVUNU  udp            --   anywhere     10.96.0.10      /*  kube-system/kube-dns:dns            cluster  IP          */     udp   dpt:domain
KUBE-SVC-ERIFXISQEP7F7OF4  tcp            --   anywhere     10.96.0.10      /*  kube-system/kube-dns:dns-tcp        cluster  IP          */     tcp   dpt:domain
KUBE-SVC-JD5MR3NA4I4DYORP  tcp            --   anywhere     10.96.0.10      /*  kube-system/kube-dns:metrics        cluster  IP          */     tcp   dpt:9153
KUBE-SVC-5KZKXYM2F4JEGSLN  tcp            --   anywhere     10.102.231.147  /*  default/nginx-deploy-nodeport-svc   cluster  IP          */     tcp   dpt:tproxy
KUBE-SVC-ATSXPZA6MCLBTOSW  tcp            --   anywhere     10.105.145.136  /*  default/nginx-deploy-clusterip-svc  cluster  IP          */     tcp   dpt:http-alt
KUBE-NODEPORTS             all            --   anywhere     anywhere        /*  kubernetes                          service  nodeports;  NOTE:  this  must          be  the  last  rule  in  this  chain  */  ADDRTYPE  match  dst-type  LOCAL
root@node2:/home/ubuntu#
```

然后对于目标地址为`10.105.145.136`的报文进入`KUBE-SVC-ATSXPZA6MCLBTOSW`处理，由于`nginx-deploy-clusterip-svc`有三个`pod`，所以做负载均衡，三个`POD`被访问的几率都是`1/3`：

```
root@node2:/home/ubuntu# iptables -t nat -L KUBE-SVC-ATSXPZA6MCLBTOSW | column -t
Chain                      KUBE-SVC-ATSXPZA6MCLBTOSW  (1   references)
target                     prot                       opt  source          destination
KUBE-MARK-MASQ             tcp                        --   !10.244.0.0/16  10.105.145.136  /*  default/nginx-deploy-clusterip-svc  cluster  IP             */  tcp        dpt:http-alt
KUBE-SEP-E4NSA7Z3P6FEYR22  all                        --   anywhere        anywhere        /*  default/nginx-deploy-clusterip-svc  ->       10.244.0.4:80  */  statistic  mode          random  probability  0.33333333349
KUBE-SEP-ENS4OGYPXWST7P2F  all                        --   anywhere        anywhere        /*  default/nginx-deploy-clusterip-svc  ->       10.244.1.2:80  */  statistic  mode          random  probability  0.50000000000
KUBE-SEP-T5LUV6MAWERK7MSM  all                        --   anywhere        anywhere        /*  default/nginx-deploy-clusterip-svc  ->       10.244.2.2:80  */
```

当匹配到某个`POD`时，进入到对应的 `KUBE-SEP-*`，然后通过`DNAT`转换，就把访问`Service`的请求转换到了具体的`Pod`中，而`Pod`在不同节点之间本来就是互通的，是有路由信息的：

```shell
root@node2:/home/ubuntu# iptables -t nat -L KUBE-SEP-E4NSA7Z3P6FEYR22 | column -t
Chain           KUBE-SEP-E4NSA7Z3P6FEYR22  (1   references)
target          prot                       opt  source       destination
KUBE-MARK-MASQ  all                        --   10.244.0.4   anywhere     /*  default/nginx-deploy-clusterip-svc  */
DNAT            tcp                        --   anywhere     anywhere     /*  default/nginx-deploy-clusterip-svc  */  tcp  to:10.244.0.4:80
root@node2:/home/ubuntu# iptables -t nat -L KUBE-SEP-ENS4OGYPXWST7P2F | column -t
Chain           KUBE-SEP-ENS4OGYPXWST7P2F  (1   references)
target          prot                       opt  source       destination
KUBE-MARK-MASQ  all                        --   10.244.1.2   anywhere     /*  default/nginx-deploy-clusterip-svc  */
DNAT            tcp                        --   anywhere     anywhere     /*  default/nginx-deploy-clusterip-svc  */  tcp  to:10.244.1.2:80
root@node2:/home/ubuntu# iptables -t nat -L KUBE-SEP-T5LUV6MAWERK7MSM | column -t
Chain           KUBE-SEP-T5LUV6MAWERK7MSM  (1   references)
target          prot                       opt  source       destination
KUBE-MARK-MASQ  all                        --   10.244.2.2   anywhere     /*  default/nginx-deploy-clusterip-svc  */
DNAT            tcp                        --   anywhere     anywhere     /*  default/nginx-deploy-clusterip-svc  */  tcp  to:10.244.2.2:80
root@node2:/home/ubuntu#
```

根据`node2`节点上的路由信息，会把发往`10.244.0.4/16`、`10.244.1.2/16` 网络的报文通过 `flannel.1` 发出去，而发往 `10.244.2.2/16` 的报文由于在本机上，所以通过 `cni0` 网口就可以处理。这部分不懂的可以看[容器网络 - 跨主机容器通信](/2023/12/12/Network/container-network-cross-host/)以及[Kubernetes CNI 网络](/2023/12/29/K8S/k8s-cni-network/)。

在`node2`上的`iptables`规则中还能找到很多`KUBE-MARK-MASQ`相关的规则，这个链中的规则是用于做`SNAT`转换的，它的流程是这样的，在`PREROUTING`阶段使用`Mark`这个`Target`给要`SNAT`的包打上标记，在`POSTROUTING`阶段使用`MASQUERADE`做`SNAT`转换，`MASQUERADE`和`SNAT`这两个`iptables`的`Target`区别是，`SNAT`需要指定的具体的原地址，而`MASQUERADE`会动态获取报文发出去的网卡上的`IP`作为原地址。例如，当我们访问`10.105.145.136`的报文最终被路由到了`node1`，那么在从`node2`上的`enp0s1`网卡发送出去时，通过`MASQUERADE`将报文的原地址设置成`node2`上`enp0s1`网卡的地址。

```shell
root@node2:/home/ubuntu# iptables -t nat -L KUBE-MARK-MASQ | column -t
Chain   KUBE-MARK-MASQ  (20  references)
target  prot            opt  source       destination
MARK    all             --   anywhere     anywhere     MARK  or  0x4000
root@node2:/home/ubuntu#
root@node2:/home/ubuntu# iptables -t nat -L KUBE-POSTROUTING | column -t
Chain       KUBE-POSTROUTING  (1   references)
target      prot              opt  source       destination
RETURN      all               --   anywhere     anywhere     mark  match       !        0x4000/0x4000
MARK        all               --   anywhere     anywhere     MARK  xor         0x4000
MASQUERADE  all               --   anywhere     anywhere     /*    kubernetes  service  traffic        requiring  SNAT  */  random-fully
root@node2:/home/ubuntu#
```

关于`MASQUERADE`的介绍可以看[这里](https://manpages.ubuntu.com/manpages/xenial/man8/iptables-extensions.8.html#target%20extensions)。

 ### NodePort

对于`NodePort`类型的`Service`，我们是可以通过每个节点的“公网”`IP`进行访问的，例如控制节点的`IP`是`192.168.67.8`，那么我们可以通过`192.168.67.8:30673`访问我们的服务：

![](ctrlnode-nodeport-svc.png)

通过浏览器进行访问：

![](browser-visit-nodeport-svc.png)

同理，我们先到处 `nat` 表中的 `PREROUTING` 链中的所有规则：

```
root@ctrlnode:/home/ubuntu# iptables -t nat -L PREROUTING | column -t
Chain          PREROUTING  (policy  ACCEPT)
target         prot        opt      source    destination
KUBE-SERVICES  all         --       anywhere  anywhere     /*        kubernetes  service   portals  */
DOCKER         all         --       anywhere  anywhere     ADDRTYPE  match       dst-type  LOCAL
root@ctrlnode:/home/ubuntu#
```

然后会在`KUBE-SERVICES`链中最后一条是和`NodePort`相关的规则，访问本地服务的链进入到`KUBE-NODEPORTS`链中的规则进行处理：

```
root@ctrlnode:/home/ubuntu# iptables -t nat -L KUBE-SERVICES | column -t
Chain                      KUBE-SERVICES  (2   references)
target                     prot           opt  source       destination
...
KUBE-NODEPORTS             all            --   anywhere     anywhere        /*  kubernetes                          service  nodeports;  NOTE:  this  must          be  the  last  rule  in  this  chain  */  ADDRTYPE  match  dst-type  LOCAL
```

`NodePort`链中的规则如下，只是简单跳转到了对应的`NodePort`服务的链中，对于{% label primary@30673 %}端口的访问进入到了`KUBE-EXT-5KZKXYM2F4JEGSLN`链中：

```
root@ctrlnode:/home/ubuntu# iptables -t nat -L KUBE-NODEPORTS | column -t
Chain                      KUBE-NODEPORTS  (1   references)
target                     prot            opt  source       destination
KUBE-EXT-5KZKXYM2F4JEGSLN  tcp             --   anywhere     anywhere     /*  default/nginx-deploy-nodeport-svc  */  tcp  dpt:30673
```

然后就是跳转到了对应的`Service`链中：

```
root@ctrlnode:/home/ubuntu# iptables -t nat -L KUBE-EXT-5KZKXYM2F4JEGSLN | column -t
Chain                      KUBE-EXT-5KZKXYM2F4JEGSLN  (1   references)
target                     prot                       opt  source       destination
KUBE-MARK-MASQ             all                        --   anywhere     anywhere     /*  masquerade  traffic  for  default/nginx-deploy-nodeport-svc  external  destinations  */
KUBE-SVC-5KZKXYM2F4JEGSLN  all                        --   anywhere     anywhere
```

到此就和`ClusterIP`类型的服务一样了：

```
root@ctrlnode:/home/ubuntu# iptables -t nat -L KUBE-SVC-5KZKXYM2F4JEGSLN | column -t
Chain                      KUBE-SVC-5KZKXYM2F4JEGSLN  (2   references)
target                     prot                       opt  source          destination
KUBE-MARK-MASQ             tcp                        --   !10.244.0.0/16  10.102.231.147  /*  default/nginx-deploy-nodeport-svc  cluster  IP             */  tcp        dpt:tproxy
KUBE-SEP-MVLCWZHJ2N4KWRDM  all                        --   anywhere        anywhere        /*  default/nginx-deploy-nodeport-svc  ->       10.244.0.4:80  */  statistic  mode        random  probability  0.33333333349
KUBE-SEP-67BWTVMW4OYVG527  all                        --   anywhere        anywhere        /*  default/nginx-deploy-nodeport-svc  ->       10.244.1.2:80  */  statistic  mode        random  probability  0.50000000000
KUBE-SEP-NVYXSNHSAWUISCCT  all                        --   anywhere        anywhere        /*  default/nginx-deploy-nodeport-svc  ->       10.244.2.2:80  */
root@ctrlnode:/home/ubuntu#
```

所以说`NodePort`类型的`Service`让集群中的服务可以从外部网络进行访问。

### 参考链接

1. [Understanding networking in Kubernetes](https://learncloudnative.com/blog/2023-05-31-kubeproxy-iptables)
2. [Kubernetes Services and Iptables](https://msazure.club/kubernetes-services-and-iptables/)
3. [nftables 中文教程](https://icloudnative.io/posts/using-nftables/)
4. [Redhat - nftables 入门](https://access.redhat.com/documentation/zh-cn/red_hat_enterprise_linux/8/html/securing_networks/getting-started-with-nftables_securing-networks#doc-wrapper)
5. [kubernetes - 虚拟IP和服务代理](https://kubernetes.io/zh-cn/docs/reference/networking/virtual-ips/)
6. [Kubernetes Service iptables 网络通信验证](https://lotabout.me/2022/Kubernetes-Service-Model-Verification/)
7. [服务发现与负载均衡](https://jimmysong.io/kubernetes-handbook/practice/service-discovery-and-loadbalancing.html)
8. [Kubernetes LoadBalancer Service 与负载均衡器](https://atbug.com/k8s-service-and-load-balancer/)